import { describe, expect, it } from 'vitest';
import { exposureFor, sunShareOf } from './exposure';

describe('the exposure', () => {
  it('stops down into the sun and opens up in the dark', () => {
    expect(exposureFor({ sunShare: 1, last: 1, dt: 10 })).toBeCloseTo(0.85);
    expect(exposureFor({ darkShare: 1, sunShare: 0, last: 1, dt: 10 })).toBeCloseTo(1.25);
  });

  it('eases at 0.6 a second up and 2 a second down', () => {
    expect(exposureFor({ darkShare: 1, last: 1, dt: 0.1 })).toBeCloseTo(1.06);
    expect(exposureFor({ sunShare: 1, last: 1.25, dt: 0.1 })).toBeCloseTo(1.05);
  });

  it('is instant under reduced motion', () => {
    expect(exposureFor({ darkShare: 1, last: 1, dt: 0.01, reduced: true })).toBeCloseTo(1.25);
  });

  it('counts the sun’s share of the frame, nothing once it’s off the edge', () => {
    expect(sunShareOf({ ndc: [0, 0], size: 0.1 })).toBeCloseTo((Math.PI * 0.25 ** 2) / 4, 4);
    expect(sunShareOf({ ndc: [2, 0], size: 0.1 })).toBe(0);
    expect(sunShareOf({ ndc: [0, 0], size: 5 })).toBe(1);
  });
});
