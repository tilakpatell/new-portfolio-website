// Where on a planet each of its biomes lives. Two low-frequency warped
// noises (temperature t and moisture m, each 0…1) place every point in a
// climate square; a biome sits at a point of that square with a reach, and
// its weight falls off over the outer 40 % of the reach, so two biomes blend
// across a band instead of meeting at a cliff. The weights sum to 1; a point
// outside every reach belongs wholly to the first biome.
//
// Pure: runs in Node and in the flight's terrain worker.
//
//   biomeWeights(spec, x, z) → number[] (one a biome, summing to 1)
//   climateOf(spec) → (x, z) → [t, m] (cached by spec)

import { noiseFor } from './fnl.js';

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// one pair of noises a spec, not one a call: a leaf asks 1,225 points
const climates = new WeakMap();
export function climateOf(spec) {
  let c = climates.get(spec);
  if (!c) {
    const t = noiseFor(spec.seed, { ...spec.climate, octaves: 3 });
    const m = noiseFor(spec.seed + 1, { ...spec.climate, octaves: 3 });
    c = (x, z) => [t(x, z) * 0.5 + 0.5, m(x, z) * 0.5 + 0.5];
    climates.set(spec, c);
  }
  return c;
}

export function biomeWeights(spec, x, z) {
  const [t, m] = climateOf(spec)(x, z);
  const w = spec.biomes.map((b) => 1 - smoothstep(b.reach * 0.6, b.reach, Math.hypot(t - b.at[0], m - b.at[1])));
  const sum = w.reduce((a, b) => a + b, 0);
  if (sum <= 0) return w.map((_, i) => (i === 0 ? 1 : 0));
  return w.map((v) => v / sum);
}
