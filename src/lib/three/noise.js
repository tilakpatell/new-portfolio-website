// Blue noise, for dithering the last pass and for a little film grain.
//
// A dark gradient written out at 8 bits shows its steps as bands; adding a
// fraction of a step of noise before the rounding hides them. White noise
// does that but reads as speckle; blue noise (no low frequencies: every
// value has neighbours far from it) does it invisibly. Made here by
// void-and-cluster (Ulichney): start from a few scattered points, move the
// most clustered one to the biggest gap until they settle, then rank every
// pixel by taking points out of the tightest cluster and putting them into
// the biggest void, each pixel's rank its value. The "energy" that finds
// clusters and voids is a Gaussian (sigma 1.9) summed round each point, the
// tile wrapping so it repeats without a seam.
//
// blueNoise(size = 64, seed = 1) → Float32Array(size²) of 0…1, each of the
//   size² levels once (a permutation)
// blueNoiseTexture(size, seed) → a THREE.DataTexture of it (red, float,
//   repeating, nearest, no mipmaps: it's read a texel a pixel)
// grainFor({ rush, reduced }) → how much grain: a little, more in the boost's
//   rush, none under reduced motion (grain moves)

import * as THREE from 'three';

const SIGMA = 1.9;

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const made = new Map(); // (size, seed) → the noise: worked out once a page

export function blueNoise(size = 64, seed = 1) {
  const key = `${size}:${seed}`;
  if (made.has(key)) return made.get(key);
  const n = size * size;
  // the Gaussian's weight at every wrapped offset (dx, dy), one table
  const kernel = new Float32Array(n);
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      const x = Math.min(dx, size - dx);
      const y = Math.min(dy, size - dy);
      kernel[dy * size + dx] = Math.exp(-(x * x + y * y) / (2 * SIGMA * SIGMA));
    }
  }
  const on = new Uint8Array(n);
  const energy = new Float32Array(n);
  const splat = (p, sign) => {
    const px = p % size;
    const py = (p - px) / size;
    for (let y = 0; y < size; y++) {
      const ky = ((y - py + size) % size) * size;
      const row = y * size;
      for (let x = 0; x < size; x++) energy[row + x] += sign * kernel[ky + ((x - px + size) % size)];
    }
  };
  // the tightest cluster among the points set (or not set), and the biggest void
  const extreme = (set, most) => {
    let best = -1;
    let bv = most ? -Infinity : Infinity;
    for (let i = 0; i < n; i++) {
      if (on[i] !== set) continue;
      const e = energy[i];
      if (most ? e > bv : e < bv) {
        bv = e;
        best = i;
      }
    }
    return best;
  };
  // a few scattered points (a tenth), then settled: the most clustered moved
  // to the biggest void until it would go straight back
  const rand = rng(seed);
  const start = Math.max(1, Math.floor(n / 10));
  for (let k = 0; k < start; ) {
    const p = Math.floor(rand() * n);
    if (on[p]) continue;
    on[p] = 1;
    splat(p, 1);
    k++;
  }
  for (let guard = 0; guard < n * 4; guard++) {
    const c = extreme(1, true);
    on[c] = 0;
    splat(c, -1);
    const v = extreme(0, false);
    on[v] = 1;
    splat(v, 1);
    if (v === c) break;
  }
  const rank = new Int32Array(n);
  // the points there are, ranked down by taking out the tightest cluster
  const saved = on.slice();
  const savedE = energy.slice();
  for (let r = start - 1; r >= 0; r--) {
    const c = extreme(1, true);
    on[c] = 0;
    splat(c, -1);
    rank[c] = r;
  }
  on.set(saved);
  energy.set(savedE);
  // and the rest ranked up by filling the biggest void
  for (let r = start; r < n; r++) {
    const v = extreme(0, false);
    on[v] = 1;
    splat(v, 1);
    rank[v] = r;
  }
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = rank[i] / (n - 1);
  made.set(key, out);
  return out;
}

export function blueNoiseTexture(size = 64, seed = 1) {
  const t = new THREE.DataTexture(blueNoise(size, seed), size, size, THREE.RedFormat, THREE.FloatType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

export const grainFor = ({ rush = 0, reduced = false } = {}) => (reduced ? 0 : 0.025 + 0.025 * Math.max(0, Math.min(1, rush)));
