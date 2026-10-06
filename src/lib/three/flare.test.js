import { describe, expect, it } from 'vitest';
import { flareWeight, occluded } from './flare';

describe('the sun in the lens', () => {
  it('is full in the frame, gone past the edge', () => {
    expect(flareWeight({ ndc: [0, 0] })).toBe(1);
    expect(flareWeight({ ndc: [1.15, 0] })).toBe(0);
    expect(flareWeight({ ndc: [1.0, 0] })).toBeGreaterThan(0);
    expect(flareWeight({ ndc: [1.0, 0] })).toBeLessThan(1);
    expect(flareWeight({ ndc: [0, -1.3] })).toBe(0);
  });

  it('is cut by occlusion', () => {
    expect(flareWeight({ ndc: [0, 0], occluded: 1 })).toBe(0);
    expect(flareWeight({ ndc: [0, 0], occluded: 0.5 })).toBeCloseTo(0.5);
  });

  it('a planet across the ray hides the star, softly at its limb', () => {
    const solids = [{ at: [0, 0, 5], r: 1 }];
    expect(occluded({ from: [0, 0, 0], to: [0, 0, 10], solids })).toBe(1);
    expect(occluded({ from: [0, 0, 0], to: [0, 3, 10], solids })).toBe(0);
    const limb = occluded({ from: [0, 0, 0], to: [0, 1.04 * 2, 10], solids }); // passes 1.02 r from the centre: inside the soft band
    expect(limb).toBeGreaterThan(0);
    expect(limb).toBeLessThan(1);
    expect(occluded({ from: [0, 0, 0], to: [0, 0, 10], solids: [] })).toBe(0);
  });

  it('only counts what’s between the eye and the star, not behind either', () => {
    expect(occluded({ from: [0, 0, 0], to: [0, 0, 10], solids: [{ at: [0, 0, 14], r: 1 }] })).toBe(0);
    expect(occluded({ from: [0, 0, 0], to: [0, 0, 10], solids: [{ at: [0, 0, -4], r: 1 }] })).toBe(0);
  });
});
