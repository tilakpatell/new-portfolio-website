import { describe, expect, it } from 'vitest';
import { chunkRandom, hashSeed, makeNoise, octaves } from './noise';

describe('seeded noise', () => {
  it('same seed same value', () => {
    const a = makeNoise(42);
    const b = makeNoise(42);
    for (const [x, y, z] of [[0.5, 1.5, 2.5], [-10.3, 4.4, 99.9], [1000.1, -7, 3]]) {
      expect(a.noise2(x, y)).toBe(b.noise2(x, y));
      expect(a.noise3(x, y, z)).toBe(b.noise3(x, y, z));
    }
  });

  it('different seeds differ', () => {
    const a = makeNoise(1);
    const b = makeNoise(2);
    let differ = 0;
    for (let i = 0; i < 50; i++) if (a.noise2(i * 0.37, i * 0.21) !== b.noise2(i * 0.37, i * 0.21)) differ++;
    expect(differ).toBeGreaterThan(45);
  });

  it('range within -1..1 over 10000 samples, and uses most of it', () => {
    const n = makeNoise(9);
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < 10000; i++) {
      const v2 = n.noise2(i * 0.173, i * 0.091 - 50);
      const v3 = n.noise3(i * 0.131, i * 0.077, -i * 0.05);
      lo = Math.min(lo, v2, v3);
      hi = Math.max(hi, v2, v3);
    }
    expect(lo).toBeGreaterThanOrEqual(-1);
    expect(hi).toBeLessThanOrEqual(1);
    expect(lo).toBeLessThan(-0.6);
    expect(hi).toBeGreaterThan(0.6);
  });

  it('is smooth: near points are near in value', () => {
    const n = makeNoise(5);
    for (let i = 0; i < 100; i++) expect(Math.abs(n.noise2(i * 0.7, 3) - n.noise2(i * 0.7 + 0.001, 3))).toBeLessThan(0.01);
  });

  it('octaves of a constant is the constant', () => {
    const f = octaves(() => 0.25, { octaves: 5 });
    expect(f(1, 2)).toBeCloseTo(0.25, 10);
    expect(f(1, 2, 3)).toBeCloseTo(0.25, 10);
  });

  it('octaves stay within -1..1', () => {
    const n = makeNoise(3);
    const f = octaves(n.noise2, { octaves: 6 });
    for (let i = 0; i < 2000; i++) expect(Math.abs(f(i * 0.11, i * 0.07))).toBeLessThanOrEqual(1);
  });

  it('chunkRandom is stable per chunk and differs between chunks', () => {
    const a = chunkRandom(7, 3, -4);
    const b = chunkRandom(7, 3, -4);
    const c = chunkRandom(7, 4, -3);
    const sa = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(sa);
    expect([c(), c(), c()]).not.toEqual(sa);
    expect(chunkRandom(8, 3, -4)()).not.toBe(sa[0]);
  });

  it('hashSeed("pumpkin") is an integer and equals itself again', () => {
    const h = hashSeed('pumpkin');
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBe(hashSeed('pumpkin'));
    expect(h).toBeGreaterThanOrEqual(-(2 ** 31));
    expect(h).toBeLessThan(2 ** 31);
    expect(hashSeed('pumpkins')).not.toBe(h);
    // a number is its own seed, as the game takes one
    expect(hashSeed(12345)).toBe(12345);
    expect(hashSeed('12345')).toBe(12345);
  });
});
