import { describe, expect, it } from 'vitest';
import { createSpring, springGroups, springStep } from './spring';

// steps a spring for `secs` at `dt`, the largest |x| seen and the last x back
const run = (s, secs, dt) => {
  let most = 0;
  let x = 0;
  for (let i = 0; i < Math.round(secs / dt); i++) {
    x = s.step(dt);
    most = Math.max(most, Math.abs(Array.isArray(x) ? x[0] : x));
  }
  return { most, x };
};

describe('springStep', () => {
  it('is semi-implicit: the velocity first, then the place with the new velocity', () => {
    const [x, v] = springStep(1, 0, 0, 100, 0, 0.01);
    expect(v).toBeCloseTo(-1, 9);
    expect(x).toBeCloseTo(0.99, 9);
  });
});

describe('createSpring', () => {
  it('stays at rest', () => {
    expect(run(createSpring(), 2, 1 / 60).most).toBe(0);
  });

  it('rings a kick out: under 0.1 at its peak, under 0.01 a second on', () => {
    const s = createSpring({ k: 120, c: 8 });
    s.kick(1);
    expect(run(s, 0.5, 1 / 60).most).toBeLessThan(0.1);
    expect(Math.abs(run(s, 0.5, 1 / 60).x)).toBeLessThan(0.01);
  });

  it('peaks alike at 30 and 120 frames a second', () => {
    const peak = (dt) => {
      const s = createSpring({ k: 120, c: 8 });
      s.kick(1);
      return run(s, 0.5, dt).most;
    };
    const slow = peak(1 / 30);
    const fast = peak(1 / 120);
    expect(Math.abs(slow - fast) / fast).toBeLessThan(0.2);
  });

  it('stays bounded at k 300 stepped at 1/30 s', () => {
    for (const k of [120, 240, 300]) {
      const s = createSpring({ k, c: 8 });
      s.kick(5);
      const { most, x } = run(s, 5, 1 / 30);
      expect(most).toBeLessThan(1);
      expect(Math.abs(x)).toBeLessThan(0.01);
    }
  });

  it('can be set at once, and rings back from there', () => {
    const s = createSpring();
    s.x = 0.2;
    expect(s.x).toBe(0.2);
    expect(s.step(1 / 60)).toBeLessThan(0.2);
  });

  it('clamps to its max', () => {
    const s = createSpring({ max: 0.05 });
    s.kick(10);
    expect(run(s, 1, 1 / 60).most).toBeLessThanOrEqual(0.05);
  });

  it('settles on its target', () => {
    const s = createSpring();
    s.target(1);
    expect(run(s, 3, 1 / 60).x).toBeCloseTo(1, 3);
  });

  it('kicks every dimension with one number, or each with its own', () => {
    const s = createSpring({ dims: 2 });
    s.kick(1);
    expect(s.v).toEqual([1, 1]);
    s.kick([0, -2]);
    expect(s.v).toEqual([1, -1]);
    const x = s.step(1 / 60);
    expect(x[0]).toBeGreaterThan(0);
    expect(x[1]).toBeLessThan(0);
  });

  it('resets, and takes new numbers', () => {
    const s = createSpring({ x: 0.5 });
    s.kick(1);
    s.step(1 / 60);
    s.reset();
    expect(s.x).toBe(0.5);
    expect(s.v).toBe(0);
    s.set({ k: 200, max: 0.2 });
    expect(s.values()).toEqual({ k: 200, c: 8, max: 0.2 });
  });

  it('takes nothing from a bad number', () => {
    const s = createSpring();
    s.kick(NaN);
    s.target(Infinity);
    expect(s.step(NaN)).toBe(0);
    expect(s.step(1 / 60)).toBe(0);
  });
});

describe('springGroups', () => {
  it('puts the stiffness and damping on the panel under the given name', () => {
    const s = createSpring();
    const [group] = springGroups(s, 'squash');
    expect(group.name).toBe('squash');
    expect(group.items.map((it) => it.key)).toEqual(['k', 'c']);
    group.items[0].set(60);
    expect(s.values().k).toBe(60);
    expect(group.items[0].get()).toBe(60);
    expect(springGroups(createSpring({ max: 0.3 }), 'lean')[0].items.map((it) => it.key)).toEqual(['k', 'c', 'max']);
  });
});
