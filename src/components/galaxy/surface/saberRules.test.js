import { describe, expect, it } from 'vitest';
import { SABER, throwAt } from './saberRules';

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
