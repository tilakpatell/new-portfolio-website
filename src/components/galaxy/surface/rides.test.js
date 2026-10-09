import { describe, expect, it } from 'vitest';
import { RIDES, RIDE_FOV, rideFov } from './rides';
import { ride, rider } from './walker';

const flat = (h = 0) => ({ heightAt: () => h, normalAt: () => [0, 1, 0], reach: 1e6 });
const go = (spec, input, secs) => {
  const s = rider(0, 0, 0);
  const outs = [];
  for (let t = 0; t < secs; t += 1 / 60) outs.push(ride(s, input, 1 / 60, flat(0), spec));
  return { s, outs };
};

describe('the rides', () => {
  it.each(Object.entries(RIDES))('%s handles as its table says', (id, spec) => {
    // a name, a seat and a camera, and numbers that make sense together
    expect(spec.name).toMatch(/^the /);
    expect(spec.seat).toHaveLength(3);
    expect(spec.cam).toHaveLength(2);
    expect(spec.boost).toBeGreaterThan(spec.top);
    expect(spec.grip).toBeGreaterThan(0);
    expect(spec.grip).toBeLessThanOrEqual(1);
    // it reaches its top speed, and its boost with run held
    const { s } = go(spec, { x: 0, y: 1 }, 12);
    expect(s.speed).toBeCloseTo(spec.top, 0);
    const b = go(spec, { x: 0, y: 1, run: true }, 14).s;
    expect(b.speed).toBeGreaterThan(spec.top);
    // a turn banks it no further than its bank, and the right way
    const t = go(spec, { x: 1, y: 1 }, 3).s;
    expect(Math.abs(t.bank)).toBeLessThanOrEqual(spec.bank + 1e-6);
    if (spec.bank > 0) expect(t.bank).toBeGreaterThan(0);
  });

  it('stops when let go and braked', () => {
    const spec = RIDES.speederbike;
    const { s } = go(spec, { x: 0, y: 1 }, 4);
    for (let i = 0; i < 400; i++) ride(s, { x: 0, y: -1 }, 1 / 60, flat(0), spec);
    expect(s.speed).toBeLessThanOrEqual(0.01);
  });
});

describe('the field widens with the ride’s speed', () => {
  const bike = RIDES.speederbike;
  it('is the base stood still and on foot', () => {
    expect(rideFov(60, 0, bike)).toBe(60);
    expect(rideFov(60, 30, null)).toBe(60);
  });
  it('grows with speed, to RIDE_FOV more at the boost’s top, never past it', () => {
    expect(rideFov(60, bike.top * 0.5, bike)).toBeGreaterThan(60);
    expect(rideFov(60, bike.top, bike)).toBeGreaterThan(rideFov(60, bike.top * 0.5, bike));
    expect(rideFov(60, bike.boost, bike)).toBeCloseTo(60 + RIDE_FOV, 6);
    expect(rideFov(60, bike.boost * 2, bike)).toBeCloseTo(60 + RIDE_FOV, 6);
    // backwards too
    expect(rideFov(60, -bike.boost, bike)).toBeCloseTo(60 + RIDE_FOV, 6);
  });
  it('is the base under reduced motion', () => {
    expect(rideFov(60, bike.boost, bike, { calm: true })).toBe(60);
  });
  it('barely moves on a bantha', () => {
    expect(rideFov(60, RIDES.bantha.boost, RIDES.bantha)).toBeLessThan(62);
  });
});
