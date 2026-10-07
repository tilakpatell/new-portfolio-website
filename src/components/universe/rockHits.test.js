import { describe, expect, it } from 'vitest';
import { beltRocks } from './belt';
import { ROCK_HIT, boxOf, nearBox, nearRing, rockDamage, rockGrid, sweep, toBelt } from './rockHits';

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
    expect(rockDamage(12, 1)).toBe(0);
    expect(rockDamage(ROCK_HIT.fast, 2)).toBe(0);
  });

  it('grows with speed and the rock’s size, to at most 45', () => {
    expect(rockDamage(300, 1)).toBeCloseTo(6 + 7 + 0.05 * (300 - ROCK_HIT.fast), 6);
    expect(rockDamage(300, 2)).toBeGreaterThan(rockDamage(300, 1));
    expect(rockDamage(900, 2)).toBe(45);
    expect(ROCK_HIT.most).toBe(45);
  });
});

describe('nearRing', () => {
  const band = { inner: 130, outer: 185, height: 16 };
  it('is near when the way crosses the ring, even from well inside it to well outside', () => {
    expect(nearRing({ x: 100, y: 0, z: 0 }, { x: 300, y: 0, z: 0 }, band)).toBe(true);
    expect(nearRing({ x: 150, y: 2, z: 0 }, { x: 151, y: 2, z: 0 }, band)).toBe(true);
  });
  it('is not near inside the ring, outside it, or well above it', () => {
    expect(nearRing({ x: 10, y: 0, z: 0 }, { x: 50, y: 0, z: 0 }, band)).toBe(false);
    expect(nearRing({ x: 400, y: 0, z: 0 }, { x: 500, y: 0, z: 0 }, band)).toBe(false);
    expect(nearRing({ x: 150, y: 40, z: 0 }, { x: 160, y: 40, z: 0 }, band)).toBe(false);
  });
  it('is near when the way cuts across the ring’s middle on a chord', () => {
    // from one side of the ring to the other through the gap in the middle: it passes the band twice
    expect(nearRing({ x: -160, y: 0, z: 0 }, { x: 160, y: 0, z: 0 }, band)).toBe(true);
    // a chord that stays inside the hole
    expect(nearRing({ x: -60, y: 0, z: 50 }, { x: 60, y: 0, z: 50 }, band)).toBe(false);
  });
});

describe('boxOf and nearBox', () => {
  const box = boxOf([
    { x: 0, y: 0, z: 0, r: 1 },
    { x: 100, y: 10, z: -50, r: 2 },
  ]);
  it('holds every rock, its size too', () => {
    expect(box).toEqual({ min: { x: -1, y: -1, z: -52 }, max: { x: 102, y: 12, z: 1 } });
  });
  it('says whether a way comes into the box', () => {
    expect(nearBox({ x: -500, y: 0, z: -20 }, { x: 500, y: 0, z: -20 }, box)).toBe(true);
    expect(nearBox({ x: -500, y: 50, z: -20 }, { x: 500, y: 50, z: -20 }, box)).toBe(false);
  });
});
