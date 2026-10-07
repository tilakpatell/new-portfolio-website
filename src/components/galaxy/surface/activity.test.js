import { describe, expect, it } from 'vitest';
import { friendlyAim, hostileAim, nextForce } from './activity';

const one = (x, z, over = {}) => ({ b: { x, z, yaw: 0 }, hostile: { range: 20, every: 2, damage: 8 }, spec: {}, down: 0, fig: {}, holder: { position: { x, y: 1500, z } }, ...over });

describe('a duellist’s Force', () => {
  it('a force push falls due every `force.every` seconds within 8 m and never beyond', () => {
    const h = { force: { every: 7, push: 9 } };
    const t = { forceAt: -99 };
    expect(nextForce(t, h, 5, 10)).toBe(true);
    t.forceAt = 10;
    expect(nextForce(t, h, 5, 12)).toBe(false);
    expect(nextForce(t, h, 5, 16.9)).toBe(false);
    expect(nextForce(t, h, 5, 17.1)).toBe(true);
    expect(nextForce(t, h, 8.5, 40)).toBe(false);
    expect(nextForce(t, {}, 2, 40)).toBe(false);
    expect(nextForce(t, null, 2, 40)).toBe(false);
  });
});

describe('a friend who fights beside you', () => {
  it('a friendly spawn’s shot is at the nearest hostile, not you', () => {
    const me = one(0, 0, { spec: { side: 'yours' } });
    const far = one(15, 0);
    const near = one(4, 3);
    const down = one(1, 1, { down: 2 });
    const friend = one(2, 0, { spec: { side: 'yours' } });
    const civil = one(1, 0, { hostile: null });
    expect(friendlyAim(me, [far, near, down, friend, civil, me])).toBe(near);
    expect(friendlyAim(me, [down, friend, civil])).toBe(null);
    // (a hostile isn't a friend: nothing for it here)
    expect(friendlyAim(far, [me, near])).toBe(null);
  });
  it('a hostile fires at the friend nearer than you, else at you', () => {
    const trooper = one(0, 0);
    const friend = one(3, 0, { spec: { side: 'yours' } });
    const you = { x: 10, z: 0 };
    expect(hostileAim(trooper, you, [trooper, friend])).toEqual({ x: 3, z: 0, victim: friend });
    expect(hostileAim(trooper, you, [trooper, one(12, 0, { spec: { side: 'yours' } })])).toEqual({ x: 10, z: 0, victim: null });
    expect(hostileAim(trooper, null, [trooper, friend]).victim).toBe(friend);
    expect(hostileAim(trooper, null, [trooper])).toBe(null);
    // (a friend down is no target)
    expect(hostileAim(trooper, you, [trooper, one(3, 0, { spec: { side: 'yours' }, down: 1 })]).victim).toBe(null);
  });
});
