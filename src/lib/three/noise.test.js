import { describe, expect, it } from 'vitest';
import { blueNoise, grainFor } from './noise';

// the mean absolute difference between each value and its right and lower neighbours (wrapping)
const neighbourDiff = (n) => {
  const size = Math.round(Math.sqrt(n.length));
  let sum = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = n[y * size + x];
      sum += Math.abs(v - n[y * size + ((x + 1) % size)]) + Math.abs(v - n[((y + 1) % size) * size + x]);
    }
  }
  return sum / (2 * n.length);
};
// a fixed shuffle, so the test is the same every run
const shuffle = (n) => {
  const a = [...n];
  let s = 7;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

describe('blue noise', () => {
  it('is a permutation of the levels: every value once, in 0…1', () => {
    const n = blueNoise(16, 3);
    const sorted = [...n].sort((a, b) => a - b);
    sorted.forEach((v, i) => expect(v).toBeCloseTo(i / 255, 3));
  });

  it('has less energy at low frequencies than white noise', () => {
    expect(neighbourDiff(blueNoise(32, 5))).toBeGreaterThan(neighbourDiff(shuffle(blueNoise(32, 5))) * 1.15);
  });

  it('is the same for the same seed, and different for another', () => {
    expect([...blueNoise(16, 2)]).toEqual([...blueNoise(16, 2)]);
    expect([...blueNoise(16, 2)]).not.toEqual([...blueNoise(16, 4)]);
  });

  it('grain is off under reduced motion and rises with the rush', () => {
    expect(grainFor({ reduced: true, rush: 1 })).toBe(0);
    expect(grainFor({ rush: 0 })).toBeCloseTo(0.025);
    expect(grainFor({ rush: 1 })).toBeCloseTo(0.05);
  });
});
