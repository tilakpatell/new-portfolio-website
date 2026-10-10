// One configured FastNoiseLite per use, behind a function of (x, z), so the
// class is named in this file only (docs/stack/fastnoise-lite.md). Seeds are
// 32-bit: a planet's bigint is folded, its low 32 bits xor its high 32.
//
// Pure: runs in Node and in the flight's terrain worker.
//
//   noiseFor(seed, { type, frequency, octaves, lacunarity, gain, fractal, warp }) → (x, z) → −1…1
//   fold(seed: bigint | number) → int32

import FastNoiseLite from 'fastnoise-lite';

export const fold = (seed) => (typeof seed === 'bigint' ? Number((seed ^ (seed >> 32n)) & 0xffffffffn) | 0 : seed | 0);

const TYPES = {
  simplex: FastNoiseLite.NoiseType.OpenSimplex2,
  cellular: FastNoiseLite.NoiseType.Cellular,
  perlin: FastNoiseLite.NoiseType.Perlin,
  value: FastNoiseLite.NoiseType.Value,
};
const FRACTALS = {
  fbm: FastNoiseLite.FractalType.FBm,
  ridged: FastNoiseLite.FractalType.Ridged,
  pingpong: FastNoiseLite.FractalType.PingPong,
  none: FastNoiseLite.FractalType.None,
};

const make = (seed, type, frequency, fractal, octaves, lacunarity, gain) => {
  const n = new FastNoiseLite(seed);
  n.SetNoiseType(TYPES[type]);
  n.SetFrequency(frequency);
  n.SetFractalType(FRACTALS[fractal]);
  n.SetFractalOctaves(octaves);
  n.SetFractalLacunarity(lacunarity);
  n.SetFractalGain(gain);
  return n;
};

export function noiseFor(seed, { type = 'simplex', frequency = 0.01, octaves = 4, lacunarity = 2, gain = 0.5, fractal = 'fbm', warp = 0 } = {}) {
  const s = fold(seed);
  const n = make(s, type, frequency, fractal, octaves, lacunarity, gain);
  if (!warp) return (x, z) => n.GetNoise(x, z);
  // The warp is two more noises at half the frequency pushing (x, z) by up
  // to `warp` metres. Not the class's own DomainWrap: in 1.1.1 it checks its
  // argument against a Vector2 class the package doesn't export, so a plain
  // { x, y } goes through unwarped and nothing says so.
  const wx = make(s ^ 0x5bd1e995, 'simplex', frequency * 0.5, 'fbm', 3, 2, 0.5);
  const wz = make(s ^ 0x27d4eb2f, 'simplex', frequency * 0.5, 'fbm', 3, 2, 0.5);
  return (x, z) => n.GetNoise(x + wx.GetNoise(x, z) * warp, z + wz.GetNoise(x, z) * warp);
}
