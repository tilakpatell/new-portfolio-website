import { describe, expect, it } from 'vitest';
import { LOCK_ON, createLockOn, turnTo, yawToward } from './lockOn';

describe('the lock-on', () => {
  it('on a coarse pointer, comes on by itself when a hostile is within 14 m', () => {
    const l = createLockOn({ coarse: true });
    expect(l.step({ near: 20 })).toBe(false);
    expect(l.step({ near: LOCK_ON.near })).toBe(true);
    expect(l.step({ near: 30 })).toBe(false); // (they've gone: off again)
  });

  it('never comes on by itself on a mouse; Tab or the button toggles it', () => {
    const l = createLockOn({ coarse: false });
    expect(l.step({ near: 5 })).toBe(false);
    expect(l.toggle()).toBe(true);
    expect(l.step({ near: 5 })).toBe(true);
    expect(l.toggle()).toBe(false);
  });

  it('keeps a choice made by hand where there’s no fight at all', () => {
    const l = createLockOn({ coarse: true });
    l.toggle();
    expect(l.step({ near: Infinity })).toBe(true);
    expect(l.step({ near: Infinity })).toBe(true);
  });

  it('keeps a choice made by hand while there’s a fight, and forgets it after', () => {
    const l = createLockOn({ coarse: true });
    l.step({ near: 8 });
    expect(l.toggle()).toBe(false); // turned off by hand
    expect(l.step({ near: 8 })).toBe(false); // stays off
    l.step({ near: Infinity }); // nobody left
    expect(l.step({ near: 8 })).toBe(true); // the next one: on again
  });
});

describe('turning onto the lock', () => {
  it('eases a heading round the short way', () => {
    const a = turnTo(3, -3, 1 / 60, 8); // (across ±π: the short way is up through π)
    expect(a).toBeGreaterThan(3);
    expect(turnTo(0, 1, 10, 8)).toBeCloseTo(1, 9); // (a long frame lands on it)
  });
  it('finds the heading toward a point in a world’s own convention', () => {
    // a yaw whose forward is (−sin, −cos), as the galaxy's camera and Rick and Morty's
    const y = yawToward({ x: 0, z: 0 }, { x: 0, z: -5 }, (yaw) => [-Math.sin(yaw), -Math.cos(yaw)]);
    expect(Math.abs(y)).toBeLessThan(1e-9);
    const e = yawToward({ x: 0, z: 0 }, { x: 5, z: 0 }, (yaw) => [-Math.sin(yaw), -Math.cos(yaw)]);
    expect(e).toBeCloseTo(-Math.PI / 2, 9);
  });
});
