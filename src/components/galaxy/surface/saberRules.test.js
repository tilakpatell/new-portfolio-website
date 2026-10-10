import { describe, expect, it } from 'vitest';
import BLADES from '../../../data/bf2017/blades.json';
import { BLADE_OF, SABER, throwAt } from './saberRules';

describe('the lightsaber’s rules', () => {
  it('throws the blade out to its range and back to the hand, spinning', () => {
    expect(throwAt(0).d).toBe(0);
    expect(throwAt(0.5).d).toBeCloseTo(SABER.throw.range, 5);
    expect(throwAt(1).d).toBeCloseTo(0, 5);
    expect(throwAt(0.25).d).toBeCloseTo(SABER.throw.range / 2, 5);
    expect(throwAt(0.25).back).toBe(false);
    expect(throwAt(0.75).back).toBe(true);
    expect(throwAt(1).spin).toBeCloseTo(Math.PI * 2 * SABER.throw.spins, 5);
  });
});

describe('a 2017 hilt’s blade', () => {
  it('comes out of the emitter on the hilt’s axis, where the game’s rod starts, as wide as the rod', () => {
    const luke = BLADE_OF.hiltluke;
    expect(Math.abs(luke.base[1] - BLADES.rod.from)).toBeLessThan(0.005);
    expect(luke.radius).toBe(BLADES.rod.radius);
    for (const [kind, b] of Object.entries(BLADE_OF)) {
      expect(Math.hypot(b.base[0], b.base[2]), kind).toBeLessThan(0.035);
      expect(b.base[1], kind).toBeGreaterThan(0);
      expect(b.length, kind).toBe(1);
    }
  });

  it('gives a staff a blade out of each end', () => {
    expect(BLADE_OF.hiltmaul.base2[1]).toBeCloseTo(-BLADE_OF.hiltmaul.base[1], 2);
    expect(BLADE_OF.hiltmaulcrimson.base2[1]).toBeLessThan(0);
    expect(BLADE_OF.hiltluke.base2).toBeUndefined();
  });
});
