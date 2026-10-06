import { describe, expect, it } from 'vitest';
import { beltRocks } from './belt';
import { DEBRIS_DRIFT, debrisRocks } from './deepspace';
import { BELT, RIM } from './layout';

describe('beltRocks', () => {
  it('places as many rocks as the belt draws, fewer on a small screen', () => {
    expect(beltRocks()).toHaveLength(3200);
    expect(beltRocks({ small: true })).toHaveLength(1200);
    expect(beltRocks({ band: RIM, seed: 2049, scale: 14, count: 700 })).toHaveLength(700);
  });

  it('places the same rocks every time for a seed', () => {
    expect(beltRocks({ count: 50 })).toEqual(beltRocks({ count: 50 }));
    expect(beltRocks({ count: 50, seed: 7 })).not.toEqual(beltRocks({ count: 50 }));
  });

  it('keeps every rock inside its band', () => {
    for (const r of beltRocks()) {
      const d = Math.hypot(r.x, r.z);
      expect(d).toBeGreaterThanOrEqual(BELT.inner - 1e-6);
      expect(d).toBeLessThanOrEqual(BELT.outer + 1e-6);
      expect(Math.abs(r.y)).toBeLessThanOrEqual(BELT.height / 2 + 1e-6);
    }
  });

  it('gives each rock a collision radius a little inside its biggest side', () => {
    for (const r of beltRocks({ count: 200 })) {
      expect(r.r).toBeCloseTo(Math.max(r.sx, r.sy, r.sz) * 0.9, 9);
      expect([0, 1, 2]).toContain(r.shape);
    }
  });
});

describe('debrisRocks', () => {
  it('places the two streams’ rocks, fewer on a small screen', () => {
    expect(debrisRocks()).toHaveLength(840);
    expect(debrisRocks({ small: true })).toHaveLength(320);
    expect(debrisRocks()).toEqual(debrisRocks());
  });

  it('drifts the streams the way the scene does', () => {
    const d = DEBRIS_DRIFT(0);
    expect(d.x).toBeCloseTo(0, 9);
    expect(d.y).toBeCloseTo(Math.sin(1) * 1.5, 9);
    expect(d.z).toBeCloseTo(5, 9);
  });
});
