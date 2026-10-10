import { describe, expect, it } from 'vitest';
import { LIFE_CELL, cellBounds, cellKeyOf, cellLife, routesFor } from './routes';
import { LIFE } from './lifeTables';

// a planet in miniature: three biomes in bands across x, rolling ground, one place
const spec = { id: 'test', seed: 1234, biomes: [{ id: 'plains' }, { id: 'ridges' }, { id: 'glacier' }], pois: [{ id: 'base', name: 'Base', at: [1200, -800], r: 220, edge: 160, h: 12 }] };
const field = {
  heightAt: (x, z) => 30 * Math.sin(x / 300) + 20 * Math.cos(z / 410) + (x > 4096 ? 200 : 0),
  biomeAt: (x) => (x < 2048 ? 0 : x < 4096 ? 1 : 2),
};

describe('routes', () => {
  it('keys cells on the shared grid', () => {
    expect(LIFE_CELL).toBe(2048);
    expect(cellKeyOf(0, 0)).toBe('0,0');
    expect(cellKeyOf(-1, 2048)).toBe('-1,1');
    expect(cellBounds('1,-1')).toEqual([2048, -2048, 4096, 0]);
  });

  it('reads a cell’s kinds and places', () => {
    const c = cellLife(spec, LIFE.hoth, '0,-1', field);
    expect(c.kinds.has('wild')).toBe(true);
    expect(c.kinds.has('hostile')).toBe(true); // (the base's)
    expect(c.pois.map((p) => p.id)).toEqual(['base']);
    expect(c.biomes.has('plains')).toBe(true);
    expect(cellLife(spec, LIFE.hoth, '5,5', field).pois).toEqual([]);
  });

  it('is the same twice', () => {
    expect(routesFor(spec, LIFE.hoth, '0,-1', field)).toEqual(routesFor(spec, LIFE.hoth, '0,-1', field));
  });

  it('flies every point at least its band’s floor over the ground', () => {
    for (const key of ['0,-1', '0,0', '1,0', '2,3', '-3,-2'])
      for (const life of [LIFE.hoth, LIFE.coruscant, LIFE.tatooine, LIFE.bespin])
        for (const r of routesFor(spec, life, key, field)) {
          expect(r.points.length).toBeGreaterThan(2);
          expect(r.loop).toBe(true);
          for (const [x, y, z] of r.points) expect(y - field.heightAt(x, z), `${r.id}`).toBeGreaterThanOrEqual(r.alt[0] - 1e-6);
          // (and between points, where the ground may rise)
          for (let i = 0; i < r.points.length; i++) {
            const a = r.points[i];
            const b = r.points[(i + 1) % r.points.length];
            const mx = (a[0] + b[0]) / 2;
            const mz = (a[2] + b[2]) / 2;
            expect(Math.min(a[1], b[1]) - field.heightAt(mx, mz)).toBeGreaterThan(r.alt[0] * 0.5);
          }
        }
  });

  it('gives a hostile place a patrol that scrambles', () => {
    const routes = routesFor(spec, LIFE.hoth, '0,-1', field);
    const patrol = routes.find((r) => r.scramble);
    expect(patrol).toBeTruthy();
    expect(patrol.route).toBe('patrol');
    expect(Math.hypot(patrol.anchor[0] - 1200, patrol.anchor[1] + 800)).toBeLessThan(1);
    // (and none where there's no place to guard)
    expect(routesFor(spec, LIFE.hoth, '5,5', field).some((r) => r.scramble)).toBe(false);
  });

  it('lays Coruscant’s lanes at three heights', () => {
    const lanes = routesFor(spec, LIFE.coruscant, '0,0', field).filter((r) => r.name === 'airspeeder');
    expect(lanes).toHaveLength(3);
    const heights = lanes.map((r) => r.points[0][1]).sort((a, b) => a - b);
    expect(heights[1] - heights[0]).toBeGreaterThan(40);
    expect(heights[2] - heights[1]).toBeGreaterThan(40);
    // a lane stays in its cell
    const [x0, z0, x1, z1] = cellBounds('0,0');
    for (const r of lanes) for (const [x, , z] of r.points) expect(x >= x0 && x <= x1 && z >= z0 && z <= z1).toBe(true);
  });

  it('makes nothing on a dead world', () => {
    expect(routesFor(spec, { kinds: { default: 'dead' }, air: [], ground: [] }, '0,0', field)).toEqual([]);
  });
});
