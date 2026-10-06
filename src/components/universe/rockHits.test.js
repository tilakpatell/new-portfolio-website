import { describe, expect, it } from 'vitest';
import { beltRocks } from './belt';
import { ROCK_HIT, rockDamage, rockGrid, sweep, toBelt } from './rockHits';

const one = (x, y, z, r) => rockGrid([{ x, y, z, r }]);

describe('sweep', () => {
  it('finds a rock on the ship’s way, where the way first touches it', () => {
    const hit = sweep(one(0, 0, 0, 1), { x: -50, y: 0, z: 0 }, { x: 50, y: 0, z: 0 }, 0.15);
    expect(hit).not.toBeNull();
    expect(hit.i).toBe(0);
    // the nearest point of the way is the middle; the way's touched it 1.15 short of there
    expect(hit.t).toBeCloseTo((50 - 1.15) / 100, 2);
    expect(hit.at.x).toBeCloseTo(-1.15, 1);
  });

  it('misses a rock the way passes clear of', () => {
    expect(sweep(one(0, 2, 0, 1), { x: -50, y: 0, z: 0 }, { x: 50, y: 0, z: 0 }, 0.15)).toBeNull();
  });

  it('finds a rock midway through one frame at super speed', () => {
    const grid = rockGrid([
      { x: 630, y: 0, z: 0.4, r: 0.5 },
      { x: 2000, y: 0, z: 0, r: 0.5 },
    ]);
    const hit = sweep(grid, { x: 0, y: 0, z: 0 }, { x: 1260, y: 0, z: 0 }, 0.15);
    expect(hit?.i).toBe(0);
  });

  it('takes the first of two rocks along the way', () => {
    const grid = rockGrid([
      { x: 30, y: 0, z: 0, r: 1 },
      { x: 10, y: 0, z: 0, r: 1 },
    ]);
    expect(sweep(grid, { x: 0, y: 0, z: 0 }, { x: 40, y: 0, z: 0 }, 0.1)?.i).toBe(1);
  });

  it('a rock once hit is skipped while hidden', () => {
    const grid = rockGrid([
      { x: 10, y: 0, z: 0, r: 1 },
      { x: 30, y: 0, z: 0, r: 1 },
    ]);
    expect(sweep(grid, { x: 0, y: 0, z: 0 }, { x: 40, y: 0, z: 0 }, 0.1, new Set([0]))?.i).toBe(1);
    expect(sweep(grid, { x: 0, y: 0, z: 0 }, { x: 40, y: 0, z: 0 }, 0.1, new Set([0, 1]))).toBeNull();
  });

  it('finds a belt rock where it’s drawn while the belt turns', () => {
    const rocks = beltRocks({ count: 400 });
    const grid = rockGrid(rocks);
    const spin = 0.006;
    const t = 100;
    const o = rocks[17];
    // where the turning belt has carried it on the map (the group turned by t·spin about y)
    const a = t * spin;
    const map = { x: o.x * Math.cos(a) + o.z * Math.sin(a), y: o.y, z: -o.x * Math.sin(a) + o.z * Math.cos(a) };
    const from = toBelt({ x: map.x - 5, y: map.y, z: map.z }, a);
    const to = toBelt({ x: map.x + 5, y: map.y, z: map.z }, a);
    const hit = sweep(grid, from, to, 0.15);
    expect(hit).not.toBeNull();
    const h = rocks[hit.i];
    expect(Math.hypot(h.x - o.x, h.y - o.y, h.z - o.z)).toBeLessThan(o.r + h.r + 0.2);
  });
});

describe('rockDamage', () => {
  it('is nothing at the boost or under', () => {
    expect(rockDamage(20, 1)).toBe(0);
    expect(rockDamage(ROCK_HIT.fast, 2)).toBe(0);
  });

  it('grows with speed and the rock’s size, to at most 45', () => {
    expect(rockDamage(420, 1)).toBeCloseTo(6 + 7 + 0.035 * (420 - 23), 6);
    expect(rockDamage(420, 2)).toBeGreaterThan(rockDamage(420, 1));
    expect(rockDamage(1260, 2)).toBe(45);
    expect(ROCK_HIT.most).toBe(45);
  });
});
