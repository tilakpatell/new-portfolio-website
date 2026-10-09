// A lightsaber's blade as a segment, kept frame by frame, and what it
// touches: a body (a capsule) it swept through since the last frame,
// another blade it crossed, a bolt that flew through it. Pure: plain
// [x, y, z] arrays in, no three.js. The trail draws from the same frames
// (lib/three/combat/trail.js); a stroke asks `sweep` only inside its
// clip's contact window and keeps its own set of who it has hit, so a
// body is hit once a stroke (galaxy/surface/saber.js). OpenJK's saber
// samples the blade between frames the same way, so a fast stroke can't
// step over someone (codemp/game/w_saber.c).
//
//   createBlade({ r = 0.12, keep = 8 }) → {
//     push(base, tip, t)   this frame's blade
//     sweep(targets, { steps }) → [{ target, at, dist }]: the capsules
//       ({ a, b, r, … }) the blade passed within r of between the last two
//       frames, sampled at `steps` blades between them (at least 4, more
//       for a tip that went far: one a quarter of a metre), each with the
//       nearest point on the blade, nearest first
//     clash(other) → { at } | null: where this blade and another's (their
//       latest) pass within both radii
//     crosses(a, b, within = r) → { at } | null: where a bolt's flown
//       segment passes within `within` of the blade
//     history() → [{ base, tip, t }], oldest first; clear()
//   }
//   segSeg(a, b, c, d) → { s, t, dist }: the nearest points of two
//     segments, s along ab and t along cd (0…1), and how far apart
//   segCapsule(a, b, ca, cb, r) → { t, at } | null: where the segment ab
//     first comes within r of the segment ca–cb (t 0…1 along ab)

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.sqrt(dot(a, a));
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

export function segSeg(a, b, c, d) {
  const u = sub(b, a);
  const v = sub(d, c);
  const w = sub(a, c);
  const A = dot(u, u);
  const B = dot(u, v);
  const C = dot(v, v);
  const D = dot(u, w);
  const E = dot(v, w);
  const den = A * C - B * B;
  let s;
  let t;
  if (A < 1e-12 && C < 1e-12) [s, t] = [0, 0];
  else if (A < 1e-12) [s, t] = [0, clamp01(E / C)];
  else if (C < 1e-12) [s, t] = [clamp01(-D / A), 0];
  else {
    // (parallel: any s will do; the start, then the nearest t to it)
    s = den > 1e-12 ? clamp01((B * E - C * D) / den) : 0;
    t = (B * s + E) / C;
    if (t < 0) [s, t] = [clamp01(-D / A), 0];
    else if (t > 1) [s, t] = [clamp01((B - D) / A), 1];
  }
  const p = add(a, u, s);
  const q = add(c, v, t);
  return { s, t, dist: len(sub(p, q)) };
}

// (bisected along ab for the first touch: a bolt hits the near side of a
// body, not its middle)
export function segCapsule(a, b, ca, cb, r) {
  const m = segSeg(a, b, ca, cb);
  if (m.dist > r) return null;
  // (whether the first s of ab comes within r: false, then true from the touch on)
  const near = (s) => segSeg(a, add(a, sub(b, a), s), ca, cb).dist <= r;
  if (near(0)) return { t: 0, at: a.slice() };
  let lo = 0;
  let hi = m.s;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (near(mid)) hi = mid;
    else lo = mid;
  }
  return { t: hi, at: add(a, sub(b, a), hi) };
}

// a blade between two frames: the base moved straight, the blade turned
// round (its direction slerped, its length eased), so a sweeping arc
// isn't cut short across its chord
function between(p, q, k) {
  const base = lerp(p.base, q.base, k);
  const u = sub(p.tip, p.base);
  const v = sub(q.tip, q.base);
  const lu = len(u);
  const lv = len(v);
  const l = lu + (lv - lu) * k;
  if (lu < 1e-9 || lv < 1e-9) return { base, tip: lerp(p.tip, q.tip, k) };
  const cos = Math.max(-1, Math.min(1, dot(u, v) / (lu * lv)));
  const th = Math.acos(cos);
  let dir;
  if (th < 1e-4) dir = lerp(u, v, k);
  else {
    const s = Math.sin(th);
    const ka = Math.sin((1 - k) * th) / s;
    const kb = Math.sin(k * th) / s;
    dir = [(u[0] / lu) * ka + (v[0] / lv) * kb, (u[1] / lu) * ka + (v[1] / lv) * kb, (u[2] / lu) * ka + (v[2] / lv) * kb];
  }
  const n = len(dir) || 1;
  return { base, tip: add(base, dir, l / n) };
}

export function createBlade({ r = 0.12, keep = 8 } = {}) {
  const frames = [];
  const latest = () => frames[frames.length - 1] ?? null;
  return {
    r,
    push(base, tip, t) {
      frames.push({ base: base.slice(), tip: tip.slice(), t });
      if (frames.length > keep) frames.shift();
    },
    sweep(targets, { steps = null } = {}) {
      const q = latest();
      if (!q || frames.length < 2) return [];
      const p = frames[frames.length - 2];
      const n = steps ?? Math.max(4, Math.ceil(len(sub(q.tip, p.tip)) / 0.25));
      const out = [];
      for (const target of targets) {
        let best = null;
        for (let i = 0; i <= n; i++) {
          const s = between(p, q, i / n);
          const m = segSeg(s.base, s.tip, target.a, target.b);
          if (m.dist <= target.r + r && (!best || m.dist < best.dist)) best = { target, at: add(s.base, sub(s.tip, s.base), m.s), dist: m.dist };
        }
        if (best) out.push(best);
      }
      return out.sort((x, y) => x.dist - y.dist);
    },
    clash(other) {
      const a = latest();
      const b = other.history().at(-1);
      if (!a || !b) return null;
      const m = segSeg(a.base, a.tip, b.base, b.tip);
      if (m.dist > r + (other.r ?? r)) return null;
      return { at: lerp(add(a.base, sub(a.tip, a.base), m.s), add(b.base, sub(b.tip, b.base), m.t), 0.5) };
    },
    crosses(a, b, within = r) {
      const q = latest();
      if (!q) return null;
      const m = segSeg(a, b, q.base, q.tip);
      return m.dist <= within ? { at: add(q.base, sub(q.tip, q.base), m.t) } : null;
    },
    history: () => frames.map((f) => ({ base: f.base.slice(), tip: f.tip.slice(), t: f.t })),
    clear() {
      frames.length = 0;
    },
  };
}
