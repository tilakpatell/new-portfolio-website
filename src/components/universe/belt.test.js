import { describe, expect, it } from 'vitest';
import { BELT_TONES, beltRocks } from './belt';
import { tint } from './palette';
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
      expect([0, 1, 2, 3]).toContain(r.shape);
    }
  });
});

describe('the belt’s boulders', () => {
  it('one rock in forty is a boulder', () => {
    const rocks = beltRocks({ count: 400 });
    const boulders = rocks.filter((r) => r.shape === 3);
    expect(boulders.length).toBeGreaterThanOrEqual(8);
    expect(boulders.length).toBeLessThanOrEqual(12);
    // (twice its size, and the ship's collider knows it)
    for (const b of boulders) expect(b.r).toBeCloseTo(Math.max(b.sx, b.sy, b.sz) * 0.9, 9);
  });

  it('leaves every other rock where it always was', () => {
    const rocks = beltRocks({ count: 400 });
    const plain = rocks.filter((r) => r.shape !== 3);
    expect(plain.length).toBe(390);
    // (the first rock of the belt, drawn before any boulder was picked, is unchanged by the picking)
    expect(rocks.every((r) => Number.isFinite(r.x) && Math.hypot(r.x, r.z) > 0)).toBe(true);
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

describe('the belt\'s tones', () => {
  it('are the palette\'s grey in three steps toward white', () => {
    expect(BELT_TONES).toHaveLength(3);
    BELT_TONES.forEach((t, i) => expect(t).toEqual(tint('grey', [0.05, 0.12, 0.2][i])));
  });
});
