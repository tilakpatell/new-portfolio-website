import { describe, expect, it } from 'vitest';
import { SABER, deflects, throwAt } from './saberRules';

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

  it('turns away the bolts from in front of a raised blade, not the ones from behind', () => {
    const me = { x: 0, z: 0, yaw: 0 };
    expect(deflects(me, [0, 1.4, 10])).toBe(true);
    expect(deflects(me, [6, 1.4, 6])).toBe(true);
    expect(deflects(me, [0, 1.4, -10])).toBe(false);
    expect(deflects(me, [-10, 1.4, 0.5])).toBe(false);
  });
});
