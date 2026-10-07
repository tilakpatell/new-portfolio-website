// Minecraft, the noise the world is made from: simplex noise in two and
// three dimensions (Stefan Gustavson's reference, 2012), its permutation
// shuffled from the world seed, so a seed is a world and the same seed is the
// same world for anyone. Octaves stack it for the terrain's broad shapes and
// its fine detail; chunkRandom gives each chunk its own stream of numbers for
// what's scattered (trees, plants), the same whenever that chunk is made.
//
// A word typed as a seed becomes a number the way the game makes it, by
// Java's String.hashCode; a number is its own seed.

import { seeded } from '../../../lib/seeded.js';

export function hashSeed(seed) {
  if (typeof seed === 'number') return seed | 0;
  const s = String(seed).trim();
  if (/^-?\d+$/.test(s) && Number.isSafeInteger(Number(s))) return Number(s) | 0;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

// mixes three integers into one, so neighbouring chunks get unrelated streams
function mix(a, b, c) {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13) ^ Math.imul(b, 0xc2b2ae35), 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 15) ^ Math.imul(c, 0x165667b1), 0x85ebca6b);
  return h ^ (h >>> 16);
}

export const chunkRandom = (seed, cx, cz) => seeded(mix(hashSeed(seed), cx | 0, cz | 0));

const GRAD3 = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const F3 = 1 / 3;
const G3 = 1 / 6;

export function makeNoise(seed) {
  const rand = seeded(mix(hashSeed(seed), 0x51, 0x7a));
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512);
  const mod12 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
    mod12[i] = perm[i] % 12;
  }

  function noise2(xin, yin) {
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = 1 - i1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    let n = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) {
      const g = GRAD3[mod12[ii + perm[jj]]];
      t0 *= t0;
      n += t0 * t0 * (g[0] * x0 + g[1] * y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) {
      const g = GRAD3[mod12[ii + i1 + perm[jj + j1]]];
      t1 *= t1;
      n += t1 * t1 * (g[0] * x1 + g[1] * y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) {
      const g = GRAD3[mod12[ii + 1 + perm[jj + 1]]];
      t2 *= t2;
      n += t2 * t2 * (g[0] * x2 + g[1] * y2);
    }
    // 70 brings the reference's sum to −1..1; the clamp guards its rounding
    return Math.max(-1, Math.min(1, 70 * n));
  }

  function noise3(xin, yin, zin) {
    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const k = Math.floor(zin + s);
    const t = (i + j + k) * G3;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    const z0 = zin - (k - t);
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) [i1, j1, k1, i2, j2, k2] = [1, 0, 0, 1, 1, 0];
      else if (x0 >= z0) [i1, j1, k1, i2, j2, k2] = [1, 0, 0, 1, 0, 1];
      else [i1, j1, k1, i2, j2, k2] = [0, 0, 1, 1, 0, 1];
    } else if (y0 < z0) [i1, j1, k1, i2, j2, k2] = [0, 0, 1, 0, 1, 1];
    else if (x0 < z0) [i1, j1, k1, i2, j2, k2] = [0, 1, 0, 0, 1, 1];
    else [i1, j1, k1, i2, j2, k2] = [0, 1, 0, 1, 1, 0];
    const x1 = x0 - i1 + G3;
    const y1 = y0 - j1 + G3;
    const z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3;
    const y2 = y0 - j2 + 2 * G3;
    const z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3;
    const y3 = y0 - 1 + 3 * G3;
    const z3 = z0 - 1 + 3 * G3;
    const ii = i & 255;
    const jj = j & 255;
    const kk = k & 255;
    const corner = (tt, gi, x, y, z) => {
      if (tt <= 0) return 0;
      const g = GRAD3[gi];
      tt *= tt;
      return tt * tt * (g[0] * x + g[1] * y + g[2] * z);
    };
    const n =
      corner(0.6 - x0 * x0 - y0 * y0 - z0 * z0, mod12[ii + perm[jj + perm[kk]]], x0, y0, z0) +
      corner(0.6 - x1 * x1 - y1 * y1 - z1 * z1, mod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]], x1, y1, z1) +
      corner(0.6 - x2 * x2 - y2 * y2 - z2 * z2, mod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]], x2, y2, z2) +
      corner(0.6 - x3 * x3 - y3 * y3 - z3 * z3, mod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]], x3, y3, z3);
    return Math.max(-1, Math.min(1, 32 * n));
  }

  return { noise2, noise3 };
}

// Octaves of a noise, each twice the frequency and half the weight of the
// last, divided by the weights' sum so the result keeps the noise's range.
export function octaves(fn, { octaves: count = 4, lacunarity = 2, persistence = 0.5 } = {}) {
  let total = 0;
  for (let o = 0, a = 1; o < count; o++, a *= persistence) total += a;
  return (x, y, z) => {
    let sum = 0;
    let f = 1;
    let a = 1;
    for (let o = 0; o < count; o++) {
      sum += a * (z === undefined ? fn(x * f, y * f) : fn(x * f, y * f, z * f));
      f *= lacunarity;
      a *= persistence;
    }
    return sum / total;
  };
}
