import { describe, expect, it } from 'vitest';
import { ECLIPSE, bodyAt, canEclipse, cover, eclipseAt, eclipsePlan } from './eclipse';

// a seeded random, so a run is the same every time
const seeded = (seed = 5) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

describe('cover', () => {
  it('is how much of one disc another hides: all, none, and some between', () => {
    expect(cover(1, 2, 0)).toBe(1);
    expect(cover(1, 1, 0)).toBeCloseTo(1, 9);
    expect(cover(1, 1, 2.01)).toBe(0);
    const half = cover(1, 1, 0.8);
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(1);
    // (a small body on a big sun: its own share and no more)
    expect(cover(2, 1, 0)).toBeCloseTo(0.25, 9);
    // (and the further off, the less)
    expect(cover(1, 1, 1.2)).toBeLessThan(half);
  });
});

describe('eclipseAt', () => {
  const eye = [0, 0, 0];
  const sun = { at: [0, 0, -2000], r: 40 };

  it('finds the body in front of the sun and how much of it it hides', () => {
    const k = eclipseAt({ eye, sun, bodies: [{ id: 'moon', at: [0, 0, -60], r: 4 }] });
    expect(k.body.id).toBe('moon');
    expect(k.k).toBeCloseTo(1, 6);
    const part = eclipseAt({ eye, sun, bodies: [{ id: 'moon', at: [4.3, 0, -60], r: 4 }] });
    expect(part.k).toBeGreaterThan(0);
    expect(part.k).toBeLessThan(1);
  });

  it('is nothing with the body aside, behind you or beyond the sun', () => {
    expect(eclipseAt({ eye, sun, bodies: [{ id: 'aside', at: [30, 0, -60], r: 4 }] })).toBeNull();
    expect(eclipseAt({ eye, sun, bodies: [{ id: 'behind', at: [0, 0, 60], r: 4 }] })).toBeNull();
    expect(eclipseAt({ eye, sun, bodies: [{ id: 'beyond', at: [0, 0, -2600], r: 200 }] })).toBeNull();
    expect(eclipseAt({ eye, sun, bodies: [] })).toBeNull();
  });
});

describe('eclipsePlan', () => {
  it('takes a body across the sun from where you are: clear of it at the ends, all of it covered in the middle', () => {
    const eye = [100, 20, -40];
    const sun = { at: [2100, 300, -900], r: 37 };
    const plan = eclipsePlan({ eye, sun, rand: seeded() });
    expect(plan.time).toBe(ECLIPSE.time);
    expect(plan.r).toBe(ECLIPSE.r);
    const k = (t, from = eye) => eclipseAt({ eye: from, sun, bodies: [{ id: 'm', at: bodyAt(plan, t, from, sun), r: plan.r }] })?.k ?? 0;
    expect(k(0)).toBe(0);
    expect(k(plan.time)).toBe(0);
    expect(k(plan.time / 2)).toBeCloseTo(1, 6);
    // (going on and coming off it, part of it)
    expect(k(plan.time * 0.15)).toBeGreaterThan(0);
    expect(k(plan.time * 0.15)).toBeLessThan(1);
    expect(k(plan.time * 0.85)).toBeGreaterThan(0);
    expect(k(plan.time * 0.85)).toBeLessThan(1);
    // (and it's out where it was put, between you and the sun)
    const mid = bodyAt(plan, plan.time / 2, eye, sun);
    expect(Math.hypot(mid[0] - eye[0], mid[1] - eye[1], mid[2] - eye[2])).toBeCloseTo(ECLIPSE.dist, 0);
  });

  it('brings a moon big enough to cover a big star close by, too', () => {
    const eye = [0, 0, 0];
    const sun = { at: [0, 0, -900], r: 160 };
    const plan = eclipsePlan({ eye, sun, rand: seeded(3) });
    expect(plan.r).toBeGreaterThan(ECLIPSE.r);
    const k = eclipseAt({ eye, sun, bodies: [{ id: 'm', at: bodyAt(plan, plan.time / 2, eye, sun), r: plan.r }] })?.k ?? 0;
    expect(k).toBeCloseTo(1, 6);
  });

  it('stays across the sun from wherever you fly to meanwhile (a far moon, not one beside you)', () => {
    const sun = { at: [2100, 300, -900], r: 37 };
    const plan = eclipsePlan({ eye: [0, 0, 0], sun, rand: seeded(9) });
    for (const eye of [[0, 0, 0], [60, -10, 40], [300, 80, -200]]) {
      const k = eclipseAt({ eye, sun, bodies: [{ id: 'm', at: bodyAt(plan, plan.time / 2, eye, sun), r: plan.r }] })?.k ?? 0;
      expect(k).toBeCloseTo(1, 6);
    }
  });
});

describe('canEclipse', () => {
  it('is for a sun that looks small from where you are, not one filling the sky', () => {
    expect(canEclipse({ eye: [0, 0, 0], sun: { at: [0, 0, -2000], r: 37 } })).toBe(true);
    expect(canEclipse({ eye: [0, 0, 0], sun: { at: [0, 0, -180], r: 42 } })).toBe(false);
    expect(canEclipse({ eye: [0, 0, 0], sun: { at: [0, 0, -(37 / Math.sin(ECLIPSE.most) - 1)], r: 37 } })).toBe(false);
  });
});
