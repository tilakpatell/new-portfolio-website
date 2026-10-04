// The Space Cruiser's way down the Rick and Morty page, worked out with no
// drawing in it. It comes out of the hero's portal and swoops from side to
// side down the page, as the Office's paper plane does; but at the things not
// worth flying over (the game, the TV) the page cracks open, a portal opens in
// the hole, the cruiser dives in, and it comes out of another past it: beside
// its top and then beside its bottom on the other side where there's room
// either side of it, otherwise above it and below it on the right (the page's
// text keeps to the left).
//
// Everything is in page pixels, y down the page. The way only ever goes down,
// so a y finds a place on it.

import { rng } from './portal/rules';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// a portal is an upright oval, this much taller than wide
export const TALL = 1.3;
// how far above a portal it starts to shrink in, and below one to grow out
export const DIVE = 110;

// flight(w, h, { launch, jumps }):
//   w, h    the page's size
//   launch  { x, y }, where the cruiser comes from (the hero's portal); the
//           top middle without one
//   jumps   [{ top, bottom, left, right }], the things to portal past (left
//           and right default to the page's edges)
// Returns the way as an SVG path (`d`, one piece per stretch it flies), the
// same sampled (X, Y, y only ever growing), the portals ({ x, y, r, kind
// 'in' | 'out', jump }) and the jumps ({ a, b }, the two portals' centres).
export function flight(w, h, { launch = null, jumps = [], narrow = w < 640 } = {}) {
  const reach = narrow ? 0.3 : 0.24;
  const left = w * (0.5 - reach);
  const right = w * (0.5 + reach);
  const edge = narrow ? 0.1 : 0.12; // the portals open out to the side
  const r = clamp(w * 0.055, 44, 84); // a portal's half width
  const pad = r * TALL + 24; // a portal sits clear of what it jumps
  const step = clamp(h / 8, 380, 560);
  const start = { x: launch?.x ?? w * 0.5, y: Math.max(20, launch?.y ?? 40) };
  const end = Math.max(start.y + 1, h - 40);

  // the stretches it flies: from the start (or out of a portal) to the next
  // portal in (or the end)
  const legs = [];
  const portals = [];
  const hops = [];
  let from = start;
  let side = 1; // which side the next portal in opens on, beside a jump
  const ry = r * TALL;
  const room = r * 2.7 + 24; // a portal's width, haze and all, with a margin
  for (const j of [...jumps].sort((p, q) => p.top - q.top)) {
    const roomL = j.left ?? 0;
    const roomR = w - (j.right ?? w);
    const beside = roomL >= room && roomR >= room && j.bottom - j.top >= ry * 2 + DIVE * 2;
    let a;
    let b;
    if (beside) {
      const l = roomL / 2;
      const rr = w - roomR / 2;
      a = { x: side > 0 ? rr : l, y: j.top + ry };
      b = { x: side > 0 ? l : rr, y: j.bottom - ry };
    } else {
      a = { x: w * (1 - edge), y: j.top - pad };
      b = { x: w * (1 - edge), y: j.bottom + pad };
    }
    // skip one that's too near where it is, or runs off the page
    if (a.y < from.y + DIVE * 2 || b.y > end - DIVE || b.y <= a.y) continue;
    legs.push([from, a]);
    portals.push({ x: a.x, y: a.y, r, kind: 'in', jump: hops.length }, { x: b.x, y: b.y, r, kind: 'out', jump: hops.length });
    hops.push({ a, b, beside });
    if (beside) side = -side;
  }
  legs.push([from, { x: w * 0.5, y: end }]);

  let d = '';
  const X = [];
  const Y = [];
  for (const [p, q] of legs) {
    // swoops from side to side, about a step apart, ending where the leg does
    const n = Math.max(1, Math.round((q.y - p.y) / step));
    const dy = (q.y - p.y) / n;
    let x = p.x;
    let y = p.y;
    // the first swoop heads for the side it isn't on
    let out = x < w * 0.5 ? 1 : -1;
    d += `${d ? ' ' : ''}M ${x.toFixed(1)} ${y.toFixed(1)}`;
    if (!X.length || Y[Y.length - 1] < y) {
      X.push(x);
      Y.push(y);
    }
    for (let i = 1; i <= n; i++) {
      const nx = i === n ? q.x : out > 0 ? right : left;
      const ny = p.y + dy * i;
      const c = [x, y, x, y + dy * 0.5, nx, ny - dy * 0.5, nx, ny];
      d += ` C ${c.slice(2).map((v) => v.toFixed(1)).join(' ')}`;
      // sample it: with the control points' y in order, y only grows
      const k = Math.max(8, Math.ceil(dy / 6));
      for (let s = 1; s <= k; s++) {
        const t = s / k;
        const u = 1 - t;
        const bx = u * u * u * c[0] + 3 * u * u * t * c[2] + 3 * u * t * t * c[4] + t * t * t * c[6];
        const by = u * u * u * c[1] + 3 * u * u * t * c[3] + 3 * u * t * t * c[5] + t * t * t * c[7];
        if (by > Y[Y.length - 1]) {
          X.push(bx);
          Y.push(by);
        }
      }
      x = nx;
      y = ny;
      out = -out;
    }
  }
  return { d, X, Y, portals, jumps: hops, start, r };
}

// Where on the way the cruiser is at y, and which way it's heading:
// { x, y, dx, dy } (dx, dy a step along it).
export function along(X, Y, y) {
  const n = Y.length;
  if (n < 2) return { x: X[0] ?? 0, y: Y[0] ?? 0, dx: 1, dy: 0 };
  const yy = clamp(y, Y[0], Y[n - 1]);
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (Y[mid] < yy) lo = mid + 1;
    else hi = mid;
  }
  const i = clamp(lo, 1, n - 1);
  const k = clamp((yy - Y[i - 1]) / Math.max(0.001, Y[i] - Y[i - 1]), 0, 1);
  return { x: X[i - 1] + (X[i] - X[i - 1]) * k, y: yy, dx: X[i] - X[i - 1], dy: Y[i] - Y[i - 1] };
}

// The cruiser at y: gone while it's between two portals; shrinking and
// spinning into one as it arrives, growing out of the next (and out of the
// hero's portal at the start). { hidden, scale, spin } with spin in degrees.
export function cruiserAt(y, { jumps, start }) {
  for (const { a, b } of jumps) {
    if (y > a.y && y < b.y) return { hidden: true, scale: 0, spin: 0 };
    if (y > a.y - DIVE && y <= a.y) {
      const k = smooth(0, 1, (a.y - y) / DIVE); // 1 far off, 0 at the portal
      return { hidden: false, scale: 0.12 + 0.88 * k, spin: (1 - k) * 220 };
    }
    if (y >= b.y && y < b.y + DIVE) return out((y - b.y) / DIVE);
  }
  if (y < start.y + DIVE) return out(Math.max(0, (y - start.y) / DIVE));
  return { hidden: false, scale: 1, spin: 0 };
}
function out(k) {
  // a little past full size, then settling: popping out of the goo
  const pop = 1 + 0.18 * Math.sin(Math.min(1, k) * Math.PI);
  return { hidden: false, scale: (0.12 + 0.88 * smooth(0, 0.75, k)) * (k > 0.4 ? pop : 1), spin: -(1 - smooth(0, 1, k)) * 180 };
}

// How open a portal is with the cruiser at y (0 shut … 1 open), and how far
// the page has cracked round it (0 … 1; the cracks stay once made). A portal
// in opens as the cruiser comes and shuts after it's gone in; a portal out
// opens just before it comes out and shuts once it's away.
export function riftAt(p, y) {
  if (p.kind === 'in') {
    return { open: smooth(p.y - 430, p.y - 140, y) * (1 - smooth(p.y + 60, p.y + 280, y)), crack: smooth(p.y - 560, p.y - 180, y) };
  }
  return { open: smooth(p.y - 320, p.y - 30, y) * (1 - smooth(p.y + 170, p.y + 440, y)), crack: smooth(p.y - 360, p.y - 60, y) };
}

// The broken page round a portal of half width r, centred on 0, 0: cracks
// running out from the rim (each an SVG path), the hole's jagged edge, and
// the shards of page lifting off round it ({ d, x, y }: the shard and where
// it sits, to push it out from), and how far out from the middle it all
// reaches (`reach`, either way), to size a drawing of it.
export function breakage(r, seed = 1) {
  const rand = rng(Math.floor(seed * 9973) + 7);
  const ry = r * TALL;
  let ext = 0; // how far out anything reaches, either way
  const at = (a, k) => {
    const pt = [Math.cos(a) * r * k, Math.sin(a) * ry * k];
    ext = Math.max(ext, Math.abs(pt[0]), Math.abs(pt[1]));
    return pt;
  };
  const fmt = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');

  const n = 7 + Math.floor(rand() * 3);
  const angles = Array.from({ length: n }, (_, i) => ((i + 0.2 + rand() * 0.6) / n) * Math.PI * 2);
  const cracks = [];
  for (const a0 of angles) {
    let a = a0;
    let k = 1.12;
    const reach = 1.9 + rand() * 1.3;
    const pts = [at(a, k)];
    let fork = null;
    while (k < reach) {
      k += 0.16 + rand() * 0.22;
      a += (rand() - 0.5) * 0.32;
      pts.push(at(a, k));
      if (!fork && k > 1.5 && rand() < 0.5) fork = { a, k };
    }
    cracks.push(fmt(pts));
    if (fork) {
      let { a: fa, k: fk } = fork;
      const turn = (rand() < 0.5 ? -1 : 1) * (0.35 + rand() * 0.3);
      const twig = [at(fa, fk)];
      for (let i = 0; i < 3; i++) {
        fk += 0.14 + rand() * 0.14;
        fa += turn * 0.35 + (rand() - 0.5) * 0.2;
        twig.push(at(fa, fk));
      }
      cracks.push(fmt(twig));
    }
  }

  // the hole: jagged, a little bigger than the portal
  const m = 22;
  const hole = [];
  for (let i = 0; i < m; i++) {
    const a = (i / m) * Math.PI * 2;
    hole.push(at(a, 1.06 + (i % 2 ? 0.1 : 0.02) + rand() * 0.08));
  }

  // shards: the bits of page between two cracks, round the rim
  const shards = [];
  for (let i = 0; i < n; i++) {
    if (rand() < 0.3) continue;
    const a = angles[i];
    const b = angles[(i + 1) % n] + (i + 1 === n ? Math.PI * 2 : 0);
    const mid = (a + b) / 2;
    const span = (b - a) * (0.35 + rand() * 0.25);
    const k0 = 1.1;
    const k1 = 1.3 + rand() * 0.25;
    const pts = [at(mid - span / 2, k0), at(mid - span / 2.6, k1), at(mid + span / 3, k1 + rand() * 0.1), at(mid + span / 2, k0)];
    const [x, y] = at(mid, (k0 + k1) / 2);
    shards.push({ d: `${fmt(pts)} Z`, x, y });
  }
  return { cracks, hole: `${fmt(hole)} Z`, shards, reach: Math.ceil(ext + 4) };
}
