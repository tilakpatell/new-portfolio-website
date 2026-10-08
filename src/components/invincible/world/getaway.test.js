import { describe, expect, it } from 'vitest';
import { getawayAt, getawayDir, newGetaway, stepGetaway, stopGetaway } from './getaway';
import { CITY, GRID } from './map';

// distance from a coordinate to the nearest street centre line
const offLine = (v) => Math.abs(((((v - GRID.cell / 2) % GRID.cell) + GRID.cell * 1.5) % GRID.cell) - GRID.cell / 2);
const run = (g, t, dt = 1 / 30) => {
  const trail = [];
  for (let s = 0; s < t; s += dt) {
    g = stepGetaway(g, dt);
    trail.push([...g.p]);
  }
  return { g, trail };
};

describe('the getaway', () => {
  it('starts on the nearest street, heading away from whoever is after it', () => {
    const g = newGetaway({ from: [50, 0, 0], speed: 22, away: [0, 0, 0] });
    expect(offLine(g.p[0]) < 0.01 || offLine(g.p[2]) < 0.01).toBe(true);
    const d = getawayDir(g);
    expect(d[0] * (g.p[0] - 0) + d[2] * (g.p[2] - 0)).toBeGreaterThanOrEqual(0);
  });
  it('keeps to the street lines and the city, at its speed, turning now and then', () => {
    const g0 = newGetaway({ from: [50, 0, 0], speed: 22, seed: 7 });
    const { g, trail } = run(g0, 120);
    for (const p of trail) {
      expect(Math.min(offLine(p[0]), offLine(p[2]))).toBeLessThan(0.01);
      expect(p[0]).toBeGreaterThan(CITY.x0);
      expect(p[0]).toBeLessThan(CITY.x1);
      expect(p[2]).toBeGreaterThan(CITY.z0);
      expect(p[2]).toBeLessThan(CITY.z1);
    }
    // 22 m/s along the streets: the path's length is the time's worth
    let len = 0;
    for (let i = 1; i < trail.length; i++) len += Math.hypot(trail[i][0] - trail[i - 1][0], trail[i][2] - trail[i - 1][2]);
    expect(len).toBeCloseTo(22 * 120, -1);
    // and it turned at least once in two minutes
    const axes = new Set(trail.map((p, i) => (i && p[0] !== trail[i - 1][0] ? 'x' : 'z')));
    expect(axes.size).toBe(2);
    expect(g.yaw).toBeDefined();
  });
  it('stops where it is, and a hidden tab is one short step', () => {
    let g = newGetaway({ from: [50, 0, 0], speed: 22 });
    g = stepGetaway(g, 60);
    expect(g.t).toBeCloseTo(0.05, 5);
    const at = getawayAt(g);
    g = stopGetaway(g);
    g = stepGetaway(g, 1);
    expect(getawayAt(g)).toEqual(at);
    expect(stepGetaway(null, 1)).toBe(null);
    expect(stepGetaway(g, NaN)).toBe(g);
  });
});
