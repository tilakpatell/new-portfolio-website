import { describe, expect, it } from 'vitest';
import { rng } from './noise';
import { spotMaker, tintOf, trailItems } from './layout';

describe('where scattered things go', () => {
  it('draws an annulus round the origin exactly as before (two numbers a spot)', () => {
    const a = rng(5);
    const b = rng(5);
    const next = spotMaker({ within: [10, 20] }, a, 590);
    for (let i = 0; i < 5; i++) {
      const [x, z] = next();
      const ang = b() * Math.PI * 2;
      const d = Math.sqrt(100 + b() * 300);
      expect(x).toBeCloseTo(Math.cos(ang) * d);
      expect(z).toBeCloseTo(Math.sin(ang) * d);
    }
  });

  it('reaches the world’s edge without a `within`', () => {
    const next = spotMaker({}, rng(9), 590);
    for (let i = 0; i < 200; i++) expect(Math.hypot(...next())).toBeLessThanOrEqual(590 + 1e-9);
  });

  it('rings a place with `around`', () => {
    const next = spotMaker({ within: [28, 40], around: [372, 330] }, rng(1), 590);
    for (let i = 0; i < 50; i++) {
      const [x, z] = next();
      const d = Math.hypot(x - 372, z - 330);
      expect(d).toBeGreaterThanOrEqual(28 - 1e-9);
      expect(d).toBeLessThanOrEqual(40 + 1e-9);
    }
  });

  it('gathers `clumps` into patches, each within its spread of its centre', () => {
    const next = spotMaker({ within: [20, 500], clumps: [6, 8] }, rng(2), 590);
    const spots = Array.from({ length: 300 }, next);
    const centres = [];
    for (const [x, z] of spots) if (!centres.some(([cx, cz]) => Math.hypot(x - cx, z - cz) <= 16)) centres.push([x, z]);
    expect(centres.length).toBeLessThanOrEqual(6);
    expect(centres.length).toBeGreaterThan(1);
  });

  it('lays a trail along its path, a stone every spacing, turned along it', () => {
    const items = trailItems(
      [
        [0, 0],
        [10, 0],
        [10, 10],
      ],
      { spacing: 2, jitter: 0, rand: rng(3) },
    );
    expect(items).toHaveLength(11);
    expect(items[0].at).toEqual([0, 0]);
    expect(items[0].yaw).toBeCloseTo(Math.PI / 2);
    expect(items[6].yaw).toBeCloseTo(0);
    expect(items[6].at[0]).toBeCloseTo(10);
    expect(items[6].at[1]).toBeCloseTo(2);
    // (evenly spaced round the corner too)
    for (let i = 1; i < items.length; i++) expect(Math.abs(items[i].at[0] - items[i - 1].at[0]) + Math.abs(items[i].at[1] - items[i - 1].at[1])).toBeCloseTo(2);
  });

  it('keeps a trail’s stones within its jitter of the path', () => {
    const items = trailItems(
      [
        [0, 0],
        [0, 30],
      ],
      { spacing: 1.5, jitter: 0.3, rand: rng(4) },
    );
    expect(items.length).toBe(21);
    for (const it of items) expect(Math.abs(it.at[0])).toBeLessThanOrEqual(0.3 + 1e-9);
  });

  it('gives nothing for a path of one point', () => {
    expect(trailItems([[3, 4]], { rand: rng(1) })).toEqual([]);
  });

  it('mixes a colour pair, in linear light', () => {
    expect(tintOf(['#000000', '#ffffff'], 1)).toEqual([1, 1, 1]);
    expect(tintOf(['#000000', '#ffffff'], 0)).toEqual([0, 0, 0]);
    const [r, g, b] = tintOf(['#ff0000', '#ff0000'], 0.4);
    expect([r, g, b]).toEqual([1, 0, 0]);
    // (a mid grey is darker than half, in linear light)
    expect(tintOf(['#808080', '#808080'], 0)[0]).toBeLessThan(0.25);
  });
});
