// A seeded random source (mulberry32, the same as the trench run's), so a game
// replays the same way from the same seed and its rules can be tested.
export function rng(seed) {
  let a = (seed >>> 0) + 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const range = (r, lo, hi) => lo + r() * (hi - lo);
export const pick = (r, list) => list[Math.floor(r() * list.length)];
export const newSeed = () => (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
