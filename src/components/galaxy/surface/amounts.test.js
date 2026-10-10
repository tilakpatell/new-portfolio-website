import { describe, expect, it } from 'vitest';
import { amountsFor } from './amounts';
import { discRings } from './ocean';

const verts = ({ radii, around }) => radii.length * around;

describe("a surface's amounts by level", () => {
  it("are today's numbers at high", () => {
    expect(amountsFor({ level: 'high', small: false })).toEqual({
      grid: { n: 256, grow: 1.08 },
      scatter: 1,
      grass: { side: 280, size: 44 },
      map: 512,
      marks: 512,
      rings: { scale: 1 },
      depthN: 512,
      relief: 0,
      splat: false,
      seat: false,
      clouds: 0,
    });
  });

  it("are today's phone numbers on a small screen", () => {
    const a = amountsFor({ level: 'high', small: true });
    expect(a.grid).toEqual({ n: 160, grow: 1.13 });
    expect(a.scatter).toBe(0.6);
    expect(a.grass.side).toBe(120);
    expect([a.map, a.marks, a.depthN]).toEqual([256, 256, 256]);
    expect(a.rings).toEqual({ small: true, scale: 1 });
    expect(a.splat).toBe(false);
    expect(a.seat).toBe(false);
  });

  it('are the phone numbers on a small screen whatever the level', () => {
    for (const level of ['low', 'mid', 'ultra']) {
      const a = amountsFor({ level, small: true });
      expect(a.grid.n, level).toBe(160);
      expect(a.scatter, level).toBe(0.6);
      expect(a.grass.side, level).toBe(120);
    }
  });

  it('double the ground and the water, and half as much again of the props, at ultra', () => {
    const a = amountsFor({ level: 'ultra', small: false });
    expect(a.grid.n).toBe(512);
    expect(a.grid.grow).toBeLessThan(1.08);
    expect(a.scatter).toBe(1.5);
    // (twice the blades, over a patch reaching further)
    expect(a.grass.side ** 2 / 280 ** 2).toBeCloseTo(2, 1);
    expect(a.grass.size).toBeGreaterThan(44);
    expect(a.depthN).toBe(1024);
    expect(a.relief).toBe(1);
    expect(a.splat).toBe(true);
    expect(a.seat).toBe(true);
    expect(a.clouds).toBe(1);
    expect(verts(discRings(a.rings)) / verts(discRings({}))).toBeGreaterThan(1.7);
  });

  it('draw less at mid and low than at high', () => {
    for (const level of ['mid', 'low']) {
      const a = amountsFor({ level, small: false });
      expect(a.grid.n).toBeLessThan(256);
      expect(a.scatter).toBeLessThan(1);
      expect(a.grass.side).toBeLessThan(280);
    }
  });
});
