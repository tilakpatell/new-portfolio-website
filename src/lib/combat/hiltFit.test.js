import { describe, expect, it } from 'vitest';
import { hiltFit } from './hiltFit';

describe('a hilt from the game, fitted to its length', () => {
  it('keeps a hilt already its length, the blade from its top', () => {
    const f = hiltFit({ min: [-0.02, 0, -0.02], max: [0.02, 0.28, 0.02] }, 0.28, 1);
    expect(f.scale).toBeCloseTo(1, 9);
    expect(f.bladeY).toBeCloseTo(0.28, 9);
  });
  it('refuses to guess the blade axis', () => {
    expect(() => hiltFit({ min: [0, 0, 0], max: [1, 1, 1] }, 0.3)).toThrow(/axis/);
  });
  it('scales by the blade axis alone, never recentring the game’s grip origin', () => {
    const f = hiltFit({ min: [0, 0, 0], max: [1, 2, 1] }, 0.26, 1);
    expect(f.scale).toBeCloseTo(0.13, 9);
    expect(f.bladeY).toBeCloseTo(0.26, 9);
    // (an origin part-way up the grip: the blade still leaves from the scaled top)
    const g = hiltFit({ min: [0, -0.1, 0], max: [0, 0.2, 0] }, 0.3, 1);
    expect(g.scale).toBeCloseTo(1, 9);
    expect(g.bladeY).toBeCloseTo(0.2, 9);
  });
});
