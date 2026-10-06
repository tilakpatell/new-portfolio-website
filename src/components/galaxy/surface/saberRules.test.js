import { describe, expect, it } from 'vitest';
import { SABER, SWINGS, arcHit, deflects, nextSwing, swingPose, throwAt } from './saberRules';

describe('the lightsaber’s rules', () => {
  it('swings each arc from its start to its end, eased, and never past', () => {
    SWINGS.forEach((s, i) => {
      expect(swingPose(i, 0)).toEqual({ yaw: s.yaw[0], pitch: s.pitch[0] });
      expect(swingPose(i, 1)).toEqual({ yaw: s.yaw[1], pitch: s.pitch[1] });
      const mid = swingPose(i, 0.5);
      expect(mid.yaw).toBeCloseTo((s.yaw[0] + s.yaw[1]) / 2, 5);
      expect(swingPose(i, 2)).toEqual(swingPose(i, 1));
      expect(s.dur).toBeGreaterThan(0.2);
    });
  });

  it('chains the combo while the swings come quickly, and starts over after a pause', () => {
    expect(nextSwing(null, 10)).toBe(0);
    expect(nextSwing({ i: 0, endedAt: 10 }, 10.2)).toBe(1);
    expect(nextSwing({ i: 1, endedAt: 10 }, 10.3)).toBe(2);
    expect(nextSwing({ i: 2, endedAt: 10 }, 10.1)).toBe(0);
    expect(nextSwing({ i: 0, endedAt: 10 }, 10 + SABER.combo + 0.01)).toBe(0);
  });

  it('reaches what’s in front within the arc, not behind or too far', () => {
    const me = { x: 0, z: 0, yaw: 0 }; // facing +z
    expect(arcHit(me, { x: 0, z: 2 })).toBe(true);
    expect(arcHit(me, { x: 1.5, z: 1.5 })).toBe(true);
    expect(arcHit(me, { x: 0, z: -2 })).toBe(false);
    expect(arcHit(me, { x: 0, z: 4 })).toBe(false);
    expect(arcHit(me, { x: 0, z: 3.2, r: 1 })).toBe(true); // (a big one's edge)
    expect(arcHit({ x: 0, z: 0, yaw: Math.PI / 2 }, { x: 2, z: 0 })).toBe(true); // facing +x
  });

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
