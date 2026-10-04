import { describe, expect, it } from 'vitest';
import { cutWiden, fbm, hash, LAND, landColumns, noise } from './terrain';

describe('the land under Roll out', () => {
  it('hashes and noise are deterministic and stay in range', () => {
    expect(hash(3, -7)).toBe(hash(3, -7));
    expect(hash(3, -7)).not.toBe(hash(-7, 3));
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < 4000; i++) {
      const v = noise(i * 0.37 - 400, i * 0.61 - 900);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    expect(lo).toBeGreaterThan(-0.05);
    expect(hi).toBeLessThan(1.05);
    expect(fbm(12.5, -3.25, 4)).toBe(fbm(12.5, -3.25, 4));
  });

  it('lies under the road and level with its edge, for every stage', () => {
    for (const land of Object.values(LAND)) {
      for (let z = -3000; z < 0; z += 37) {
        for (const x of [-6, -3, 0, 3, 6]) expect(land.height(x, z)).toBeCloseTo(-0.35, 2);
        for (const x of [-8, -7, 7, 8]) expect(Math.abs(land.height(x, z))).toBeLessThan(0.06);
      }
    }
  });

  it('keeps the buttes off the road and rolls gently near it', () => {
    let tallest = 0;
    let far = 0;
    for (let z = -5000; z < 0; z += 11) {
      for (let x = 9; x < 80; x += 7) tallest = Math.max(tallest, LAND.desert.height(x, z), LAND.desert.height(-x, z));
      for (let x = 170; x < 600; x += 23) far = Math.max(far, LAND.desert.height(x, z));
    }
    expect(tallest).toBeLessThan(26);
    expect(far).toBeGreaterThan(40); // there are buttes out there
  });

  it('cuts a canyon that starts at the road and widens away from it', () => {
    expect(cutWiden(0)).toBe(0);
    expect(cutWiden(5)).toBe(0);
    expect(cutWiden(-200)).toBeGreaterThan(cutWiden(-30));
    expect(cutWiden(400)).toBeGreaterThan(10);
  });

  it('lays columns symmetrically, close by the road and wider apart far off', () => {
    const xs = landColumns(820);
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    expect(xs[0]).toBe(-xs[xs.length - 1]);
    for (const edge of [6.3, 6.5]) expect(xs).toContain(edge);
    const mid = xs.indexOf(0);
    expect(xs[mid + 1] - xs[mid]).toBeLessThan(xs[xs.length - 1] - xs[xs.length - 2]);
  });
});
