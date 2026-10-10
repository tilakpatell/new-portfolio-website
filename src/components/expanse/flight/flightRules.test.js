import { describe, expect, it } from 'vitest';
import { SHIP, crashed, forwardOf, stepShip } from './flightRules';

const at = (o = {}) => ({ x: 0, y: 200, z: 0, pitch: 0, yaw: 0, roll: 0, speed: 100, ...o });
const none = { pitch: 0, yaw: 0, roll: 0, throttle: 0 };
const run = (ship, input, seconds, dt = 1 / 60) => {
  let s = ship;
  for (let t = 0; t < seconds - 1e-9; t += dt) s = stepShip(s, input, dt);
  return s;
};

describe('the ship', () => {
  it('keeps the spec’s numbers', () => {
    expect(SHIP).toEqual({ speedMin: 40, speedMax: 320, accel: 60, pitchRate: 1.2, yawRate: 0.9, rollRate: 2.4, clearance: 3 });
  });

  it('speeds up by accel a second, to speedMax at most', () => {
    expect(run(at(), { ...none, throttle: 1 }, 1).speed).toBeCloseTo(160, 6);
    expect(run(at({ speed: 300 }), { ...none, throttle: 1 }, 1).speed).toBe(SHIP.speedMax);
    expect(run(at({ speed: 60 }), { ...none, throttle: -1 }, 1).speed).toBe(SHIP.speedMin);
  });

  it('flies straight ahead, down −z, with no input', () => {
    const s = run(at(), none, 1);
    expect(s.z).toBeCloseTo(-100, 6);
    expect(s.x).toBeCloseTo(0, 6);
    expect(s.y).toBeCloseTo(200, 6);
  });

  it('loses height with the nose down (pitch −1)', () => {
    const s = run(at(), { ...none, pitch: -1 }, 1);
    expect(s.pitch).toBeLessThan(0);
    expect(s.y).toBeLessThan(200);
  });

  it('turns the heading by yawRate × dt', () => {
    const s = stepShip(at(), { ...none, yaw: 1 }, 0.1);
    expect(s.yaw).toBeCloseTo(SHIP.yawRate * 0.1, 9);
  });

  it('banks under roll, and the bank turns it', () => {
    const s = run(at(), { ...none, roll: 1 }, 0.5);
    expect(s.roll).not.toBe(0);
    expect(s.yaw).not.toBe(0);
  });

  it('levels its wings when let go', () => {
    const banked = run(at(), { ...none, roll: 1 }, 0.4);
    expect(Math.abs(run(banked, none, 3).roll)).toBeLessThan(0.05);
  });

  it('never loops: the pitch is held short of straight up or down', () => {
    expect(run(at(), { ...none, pitch: 1 }, 5).pitch).toBeLessThan(Math.PI / 2);
    expect(run(at(), { ...none, pitch: -1 }, 5).pitch).toBeGreaterThan(-Math.PI / 2);
  });

  it('does not change the ship it was given', () => {
    const a = at();
    stepShip(a, { ...none, throttle: 1, pitch: 1 }, 1);
    expect(a).toEqual(at());
  });

  it('points forward as it flies', () => {
    const f = forwardOf({ pitch: 0, yaw: Math.PI / 2 });
    expect(f[0]).toBeCloseTo(-1, 9);
    expect(f[2]).toBeCloseTo(0, 9);
  });
});

describe('crashed', () => {
  it('is under the ground plus the clearance', () => {
    expect(crashed({ y: 10 }, 6)).toBe(false);
    expect(crashed({ y: 10 }, 7.5)).toBe(true);
    expect(crashed({ y: 10 }, 8)).toBe(true);
  });

  it('is never over ground not yet in', () => {
    expect(crashed({ y: -50 }, NaN)).toBe(false);
  });
});
