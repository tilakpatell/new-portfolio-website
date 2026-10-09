import { describe, expect, it } from 'vitest';
import { KNOCK, STUN, WHERE, resolve } from './damage';

const hit = (tag, dir = [0, 0, 1]) => ({ victim: 'v', tag, at: [0, 1, 0], dir });
const light = { damage: 1, kind: 'light' };
const heavy = { damage: 3, kind: 'heavy' };

describe('resolve', () => {
  it('a head hit doubles the damage', () => {
    const r = resolve(hit('head'), light, { hp: 10 });
    expect(r.damage).toBe(2);
    expect(r.hp).toBe(8);
    expect(r.where).toBe('head');
  });

  it('a light hit on the chest is 1× damage, 2.5 force, 0.3 stun', () => {
    const r = resolve(hit('chest'), light, { hp: 10 });
    expect(r).toMatchObject({ damage: 1, hp: 9, force: KNOCK.light, kind: 'light', stun: STUN.light, where: 'chest' });
  });

  it('a limb hit is worth its share', () => {
    expect(resolve(hit('foreArmL'), light, { hp: 10 }).damage).toBe(WHERE.foreArmL);
    expect(resolve(hit('whole'), light, { hp: 10 }).damage).toBe(1);
    expect(resolve(hit('tail'), light, { hp: 10 }).damage).toBe(1); // (an unknown region counts as the body)
  });

  it('a blocked hit does no damage, half the force, no stun', () => {
    const r = resolve(hit('chest'), heavy, { hp: 10, blocking: true });
    expect(r).toMatchObject({ damage: 0, hp: 10, force: KNOCK.heavy / 2, kind: 'blocked', stun: 0 });
  });

  it('a kill is lethal with KNOCK.lethal and no stun', () => {
    const r = resolve(hit('chest'), heavy, { hp: 2 });
    expect(r).toMatchObject({ damage: 3, hp: -1, force: KNOCK.lethal, kind: 'lethal', stun: 0 });
  });

  it('dir is flat and unit for a light hit and lifted for a heavy', () => {
    const l = resolve(hit('chest', [3, 2, 4]), light, { hp: 10 });
    expect(l.dir[0]).toBeCloseTo(0.6, 5);
    expect(l.dir[1]).toBe(0);
    expect(l.dir[2]).toBeCloseTo(0.8, 5);
    const h = resolve(hit('chest', [3, 2, 4]), heavy, { hp: 10 });
    expect(h.dir[1]).toBe(0.25);
    expect(Math.hypot(h.dir[0], h.dir[2])).toBeCloseTo(1, 5);
    const none = resolve(hit('chest', [0, 1, 0]), light, { hp: 10 });
    expect(none.dir).toEqual([0, 0, 0]);
  });

  it('damage is rounded to one decimal', () => {
    expect(resolve(hit('upperArmL'), { damage: 1.25, kind: 'light' }, { hp: 10 }).damage).toBe(0.8);
  });
});
