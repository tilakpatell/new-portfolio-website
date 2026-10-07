// Picking a place: Killzone's tactical position picking (score candidate
// points by weighted tests, take the best) with the fixes Eric Johnson's
// "Taming Spatial Queries" gives for what goes wrong: hysteresis so the
// point isn't swapped for one a hair better (an orbit that re-picks every
// frame otherwise approaches head on, weaving), a bias to break symmetric
// ties the same way every time, and a choice of normalisation (clamped
// between bookends for "near enough to matter", relative to the set,
// unclamped when more enemies in range should keep getting worse,
// targeted on an ideal value). Pure.
//
//   candidates(around, { ring, n, walkable }) → [{ x, y, z }]
//   scorePlace(point, tests) → number; a test: { weight, value(p) → number, norm, bookends, target, width }
//   pickPlace(points, tests, { current, hysteresis, bias }) → { at, score } | null
//   tests: cover(threats, seesThrough), visible(threat, seesThrough), nearTo(p, range),
//          awayFrom(p, range), apart(others, spacing), offLine(allies, threat, width)

import { apart as dist, clamp } from './vec';

export function candidates(around, { ring = 8, n = 12, walkable = null, y = around.y ?? 0 } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const p = { x: around.x + Math.sin(a) * ring, y, z: around.z + Math.cos(a) * ring };
    if (walkable && !walkable(p.x, p.z)) continue;
    out.push(p);
  }
  return out;
}

function normalise(v, t, set) {
  const [lo, hi] = t.bookends ?? [0, 1];
  switch (t.norm ?? 'clamped') {
    case 'relative': {
      const min = Math.min(...set);
      const max = Math.max(...set);
      return max === min ? 1 : (v - min) / (max - min);
    }
    case 'unclamped':
      return hi === lo ? v : (v - lo) / (hi - lo);
    case 'targeted': {
      const w = t.width ?? Math.max(1e-6, hi - lo);
      return Math.max(0, 1 - Math.abs(v - (t.target ?? 0)) / w);
    }
    default:
      return hi === lo ? (v >= hi ? 1 : 0) : clamp((v - lo) / (hi - lo), 0, 1);
  }
}

export function scorePlace(point, tests, sets = null) {
  let s = 0;
  tests.forEach((t, i) => {
    s += (t.weight ?? 1) * normalise(t.value(point), t, sets?.[i] ?? [t.value(point)]);
  });
  return s;
}

export function pickPlace(points, tests, { current = null, hysteresis = 0.15, bias = null } = {}) {
  if (!points.length) return null;
  const all = current ? [...points, current] : points;
  const sets = tests.map((t) => all.map((p) => t.value(p)));
  let best = null;
  let bestScore = -Infinity;
  const scoreOf = (p) => scorePlace(p, tests, sets) + (bias ? bias(p) : 0);
  for (const p of points) {
    const s = scoreOf(p);
    if (s > bestScore) {
      bestScore = s;
      best = p;
    }
  }
  if (current) {
    const now = scoreOf(current);
    if (bestScore <= now * (1 + hysteresis) + (now <= 0 ? hysteresis : 0)) return { at: current, score: now, kept: true };
  }
  return { at: best, score: bestScore, kept: false };
}

// the standard tests, as factories
export const cover = (threats, seesThrough, weight = 1) => ({ weight, value: (p) => (threats.every((t) => !seesThrough(t.at ?? t, p)) ? 1 : 0) });
export const visible = (threat, seesThrough, weight = 1) => ({ weight, value: (p) => (seesThrough(threat.at ?? threat, p) ? 1 : 0) });
export const nearTo = (q, range, weight = 1) => ({ weight, value: (p) => 1 - Math.min(1, dist(p, q) / range) });
export const awayFrom = (q, range, weight = 1) => ({ weight, value: (p) => Math.min(1, dist(p, q) / range) });
export const apart = (others, spacing, weight = 1) => ({ weight, value: (p) => (others.every((o) => dist(p, o.at ?? o) >= spacing) ? 1 : 0) });
// not within `width` of the line from any ally to the threat (a friend's line of fire)
export const offLine = (allies, threat, width, weight = 1) => ({
  weight,
  value: (p) => {
    const t = threat.at ?? threat;
    for (const a0 of allies) {
      const a = a0.at ?? a0;
      const dx = t.x - a.x;
      const dz = t.z - a.z;
      const l2 = dx * dx + dz * dz;
      if (l2 < 1e-9) continue;
      const k = clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / l2, 0, 1);
      const px = a.x + dx * k - p.x;
      const pz = a.z + dz * k - p.z;
      if (Math.hypot(px, pz) < width) return 0;
    }
    return 1;
  },
});
