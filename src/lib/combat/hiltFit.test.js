import { describe, expect, it } from 'vitest';
import { hiltFit } from './hiltFit';

describe('a hilt model fitted to the saber', () => {
  it('keeps a hilt already the length asked, its blade from its top', () => {
    const f = hiltFit({ min: [-0.02, 0, -0.02], max: [0.02, 0.28, 0.02] }, 0.28);
    expect(f.scale).toBeCloseTo(1, 6);
    expect(f.bladeY).toBeCloseTo(0.28, 6);
  });

  it('scales one to the length along its blade’s axis, the origin (the game’s grip) kept', () => {
    const f = hiltFit({ min: [0, 0, 0], max: [1, 2, 1] }, 0.26);
    expect(f.scale).toBeCloseTo(0.13, 6);
    expect(f.bladeY).toBeCloseTo(0.26, 6);
  });

  it('puts the blade at the emitter however far the grip is from it', () => {
    // (Luke's: the grip 0.07 below the emitter, the pommel 0.22 under it)
    const f = hiltFit({ min: [-0.03, -0.216, -0.03], max: [0.03, 0.07, 0.03] }, 0.286);
    expect(f.scale).toBeCloseTo(1, 2);
    expect(f.bladeY).toBeCloseTo(0.07, 2);
  });
});
