import { describe, expect, it } from 'vitest';
import { ESCORT, escortHull, escortPlan, escortTo } from './escort';

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('escortPlan', () => {
  it('runs toward the next place and stops short of it, the pirates coming at two points of the way', () => {
    const plan = escortPlan({ from: [0, 0, 0], to: [0, 0, -100], reach: 10, speed: 3 });
    expect(plan.arrives).toBe(true);
    const end = plan.path[2];
    expect(end[0]).toBeCloseTo(0, 9);
    expect(end[2]).toBeCloseTo(-(100 - 10 * ESCORT.stop), 9);
    expect(plan.time).toBeCloseTo(plan.length / 3, 9);
    expect(plan.pirates.length).toBe(2);
    const [a, b] = plan.pirates;
    expect(a.at).toBeGreaterThan(0);
    expect(b.at).toBeGreaterThan(a.at);
    expect(b.at).toBeLessThan(plan.time);
    // (where it is then: on the way)
    for (const p of plan.pirates) expect(dist(p.where, [0, 0, -(p.at / plan.time) * plan.length])).toBeLessThan(1e-9);
  });

  it('goes only so far toward a place a long way off, and jumps from there', () => {
    const plan = escortPlan({ from: [0, 0, 0], to: [5000, 0, 0], reach: 30, speed: 3 });
    expect(plan.arrives).toBe(false);
    expect(plan.length).toBeCloseTo(ESCORT.most, 9);
    expect(plan.path[2][0]).toBeCloseTo(ESCORT.most, 9);
  });
});

describe('escortTo', () => {
  const ship = { x: 0, y: 0, z: 0, heading: 0 }; // (nose along −z)
  const places = [
    { id: 'behind', at: [0, 0, 150], r: 10 },
    { id: 'ahead', at: [20, 0, -200], r: 10 },
    { id: 'far', at: [0, 0, -900], r: 10 },
    { id: 'here', at: [0, 0, -20], r: 10 },
  ];

  it('picks the nearest place ahead, past the one you are at', () => {
    expect(escortTo(ship, places).id).toBe('ahead');
  });

  it('and, with nothing ahead, the nearest that is not where you are', () => {
    expect(escortTo(ship, places.filter((p) => p.id === 'behind' || p.id === 'here')).id).toBe('behind');
    expect(escortTo(ship, [])).toBeNull();
  });
});

describe('escortHull', () => {
  it('wears down with the pirates on it, and holds with none', () => {
    expect(escortHull(1, 0, 1)).toBe(1);
    const two = escortHull(1, 2, 1);
    expect(two).toBeLessThan(escortHull(1, 1, 1));
    expect(two).toBeGreaterThan(0);
    expect(escortHull(0.01, 3, 5)).toBe(0);
  });
});
