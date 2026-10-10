import { describe, expect, it } from 'vitest';
import { GLOW, LOOK, poseOf } from './pickupFx';
import { PICKUPS, PICKUP_RULES } from './pickups';

const fresh = { age: 2, life: PICKUP_RULES.life };
const dying = { age: PICKUP_RULES.life - 2, life: PICKUP_RULES.life };

describe('how a pickup is drawn', () => {
  it('has a glow colour for every kind', () => {
    expect(Object.keys(GLOW).sort()).toEqual(Object.keys(PICKUPS).sort());
  });
  it('spins and bobs by the clock, within its reach of up and down', () => {
    const a = poseOf(fresh, 0.3, false);
    expect(a.spin).toBeCloseTo(0.3 * LOOK.spin);
    for (let t = 0; t < 4; t += 0.05) expect(Math.abs(poseOf(fresh, t, false).bob)).toBeLessThanOrEqual(LOOK.bob + 1e-9);
    expect(poseOf(fresh, 0.1, false).bob).not.toBe(0);
  });
  it('blinks only through its last seconds, four times a second', () => {
    for (let t = 0; t < 3; t += 0.05) expect(poseOf(fresh, t, false).shown).toBe(true);
    const states = [];
    for (let t = 0; t < 1; t += 0.05) states.push(poseOf(dying, t, false).shown);
    expect(states).toContain(true);
    expect(states).toContain(false);
    let flips = 0;
    for (let i = 1; i < states.length; i++) if (states[i] !== states[i - 1]) flips++;
    expect(flips).toBeGreaterThanOrEqual(6); // (four off-and-on in a second is eight changes, at twenty steps)
  });
  it('sits still and shows with reduced motion', () => {
    for (let t = 0; t < 2; t += 0.07) {
      const p = poseOf(dying, t, true);
      expect(p).toEqual({ spin: 0, bob: 0, shown: true });
    }
  });
  it('writes into the record it is given', () => {
    const out = { spin: 9, bob: 9, shown: false };
    expect(poseOf(fresh, 1, false, out)).toBe(out);
    expect(out.shown).toBe(true);
  });
});
