// Weighing options: the Infinite Axis Utility System (Dave Mark; Guild Wars
// 2, Project Borealis) cut to what a brain needs. An option is scored by
// its considerations, each a number 0…1 read off the situation through a
// response curve; they multiply, so any one at zero rules the option out
// (and the rest aren't looked at: put the cheap ones first). The best
// option wins, the running one with a little momentum so near-equals don't
// flip-flop; a rank (Kevin Dill's dual utility) makes a class of options
// beat every class below it whatever their weights; a spread with a rand
// picks among the near-best, for variety that is never stupid. Pure.
//
//   curve.linear | inverse | poly(k) | logistic(k, mid) | peak(at, width): (x: 0…1) → 0…1
//   consider(value, [lo, hi], fn) → 0…1 (clamped between the bookends, then through the curve)
//   score(option, ctx) → number; option: { id, weight = 1, considerations: [(ctx) → 0…1] }
//   pick(options, ctx, { current, momentum, rank, rand, spread }) → { id, score, scores } | null
//   runtime(t, [lo, hi]) → 1 − x^6 (an option stops being chosen after a while)
//   cooldown(since, s) → x^5 (and can't be chosen again at once)

import { clamp } from './vec';

export const curve = {
  linear: (x) => x,
  inverse: (x) => 1 - x,
  poly: (k) => (x) => Math.pow(x, k),
  logistic:
    (k = 10, mid = 0.5) =>
    (x) =>
      1 / (1 + Math.exp(-k * (x - mid))),
  // 1 at `at`, falling to 0 `width` either side (a hump: an ideal distance)
  peak: (at, width) => (x) => Math.max(0, 1 - Math.abs(x - at) / width),
};

export function consider(value, [lo, hi], fn = curve.linear) {
  const x = hi === lo ? (value >= hi ? 1 : 0) : clamp((value - lo) / (hi - lo), 0, 1);
  return clamp(fn(x), 0, 1);
}

export function score(option, ctx) {
  let s = option.weight ?? 1;
  for (const c of option.considerations ?? []) {
    if (s <= 0) return 0;
    s *= c(ctx);
  }
  return s > 0 ? s : 0;
}

export function pick(options, ctx, { current = null, momentum = 0.15, rank = null, rand = null, spread = 0 } = {}) {
  const scores = {};
  let top = -Infinity;
  let bestRank = -Infinity;
  const live = [];
  for (const o of options) {
    let s = score(o, ctx);
    if (s <= 0) {
      scores[o.id] = 0;
      continue;
    }
    if (o.id === current) s *= 1 + momentum;
    scores[o.id] = s;
    const r = rank ? rank(o, ctx) : 0;
    if (r > bestRank) {
      bestRank = r;
      live.length = 0;
      top = -Infinity;
    }
    if (r < bestRank) continue;
    live.push({ o, s });
    if (s > top) top = s;
  }
  if (!live.length) return null;
  let chosen = live[0];
  if (rand && spread > 0) {
    // weighted random among those within `spread` of the best
    const near = live.filter((l) => l.s >= top * (1 - spread));
    const total = near.reduce((n, l) => n + l.s, 0);
    let k = rand() * total;
    chosen = near[near.length - 1];
    for (const l of near) {
      k -= l.s;
      if (k <= 0) {
        chosen = l;
        break;
      }
    }
  } else for (const l of live) if (l.s > chosen.s) chosen = l;
  return { id: chosen.o.id, score: chosen.s, scores };
}

export const runtime = (t, [lo, hi]) => 1 - Math.pow(consider(t, [lo, hi]), 6);
export const cooldown = (since, s) => (s <= 0 ? 1 : Math.pow(consider(since, [0, s]), 5));
