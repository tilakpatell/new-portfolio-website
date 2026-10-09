import { describe, expect, it } from 'vitest';
import { PICKUP_RULES, PICKUPS, createPickups } from './pickups';

const seeded = (seed = 7) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const ship = (x = 0) => ({ x, y: 0, z: 0 });

describe('pickups', () => {
  it('drops about a third of the time, always for an ace', () => {
    const p = createPickups({ rand: seeded() });
    let n = 0;
    for (let i = 0; i < 400; i++) {
      if (p.drop({ x: 1000, y: 0, z: 0 }, { shield: 100 })) n++;
      p.clear();
    }
    expect(n / 400).toBeGreaterThan(0.25);
    expect(n / 400).toBeLessThan(0.45);
    expect(p.drop({ x: 0, y: 0, z: 50 }, { ace: true, shield: 100 })).not.toBeNull();
  });
  it('always drops for a capital ship, and copies where it was', () => {
    const p = createPickups({ rand: () => 0.99 });
    expect(p.drop({ x: 1, y: 2, z: 3 }, { shield: 100 })).toBeNull();
    const at = { x: 1, y: 2, z: 3 };
    const d = p.drop(at, { capital: true, shield: 100 });
    expect(d.at).toEqual(at);
    expect(d.at).not.toBe(at);
    expect(p.drop([4, 5, 6], { capital: true }).at).toEqual({ x: 4, y: 5, z: 6 });
  });
  it('keeps at most four out', () => {
    const p = createPickups({ rand: () => 0 });
    for (let i = 0; i < 9; i++) p.drop({ x: 100 + i, y: 0, z: 0 }, { ace: true, shield: 100 });
    expect(p.list.length).toBe(PICKUP_RULES.max);
  });
  it('weights repairs up when the deflectors are low', () => {
    const count = (shield) => {
      const p = createPickups({ rand: seeded(11) });
      let r = 0;
      for (let i = 0; i < 300; i++) {
        const d = p.drop({ x: 500, y: 0, z: 0 }, { ace: true, shield });
        if (d?.kind === 'repair') r++;
        p.clear();
      }
      return r;
    };
    expect(count(20)).toBeGreaterThan(count(100) * 2);
  });
  it('can be told which kind, and ignores one it does not know', () => {
    const p = createPickups({ rand: () => 0 });
    expect(p.drop({ x: 9, y: 0, z: 0 }, { ace: true, kind: 'bubble' }).kind).toBe('bubble');
    expect(Object.keys(PICKUPS)).toContain(p.drop({ x: 9, y: 0, z: 0 }, { ace: true, kind: 'nope' }).kind);
  });
  it('is taken when flown through, and only while live', () => {
    const p = createPickups({ rand: () => 0 });
    p.drop({ x: 2, y: 0, z: 0 }, { ace: true, shield: 100 });
    expect(p.step(0.016, ship(), { live: false })).toEqual([]);
    const got = p.step(0.016, ship(), { live: true });
    expect(got.length).toBe(1);
    expect(p.list.length).toBe(0);
  });
  it('says what a take gives: deflectors, a charge, or nothing more for a timed one', () => {
    const p = createPickups({ rand: () => 0 });
    p.drop({ x: 1, y: 0, z: 0 }, { ace: true, kind: 'repair' });
    p.drop({ x: 1, y: 0, z: 1 }, { ace: true, kind: 'charge' });
    p.drop({ x: 1, y: 0, z: 2 }, { ace: true, kind: 'rapid' });
    const got = p.step(0.016, ship(), { live: true });
    expect(got.find((t) => t.kind === 'repair').heal).toBe(40);
    expect(got.find((t) => t.kind === 'charge').charge).toBe(true);
    expect(got.find((t) => t.kind === 'rapid').heal).toBeUndefined();
    expect(p.mods().delay).toBeCloseTo(0.6);
  });
  it('drifts toward the ship within reach, and expires', () => {
    const p = createPickups({ rand: () => 0 });
    p.drop({ x: 10, y: 0, z: 0 }, { ace: true, shield: 100 });
    p.step(0.5, ship(), { live: true });
    expect(p.list[0]?.at.x ?? 0).toBeLessThan(10);
    const q = createPickups({ rand: () => 0 });
    q.drop({ x: 500, y: 0, z: 0 }, { ace: true, shield: 100 });
    q.step(PICKUP_RULES.life + 0.1, ship(), { live: true });
    expect(q.list.length).toBe(0);
  });
  it('does not drift while the ship is not live', () => {
    const p = createPickups({ rand: () => 0 });
    p.drop({ x: 10, y: 0, z: 0 }, { ace: true, shield: 100 });
    p.step(0.5, ship(), { live: false });
    expect(p.list[0].at.x).toBe(10);
  });
  it('gives timed effects their mods, stacking to twice at most', () => {
    const p = createPickups({ rand: () => 0 });
    p.give('rapid');
    expect(p.mods().delay).toBeCloseTo(0.6);
    p.give('rapid');
    p.give('rapid');
    expect(p.buffs().find((b) => b.kind === 'rapid').left).toBeLessThanOrEqual(24);
    p.step(25, ship(), { live: true });
    expect(p.mods().delay).toBe(1);
  });
  it('overcharge lifts the boost and the pull-up together', () => {
    const p = createPickups({ rand: () => 0 });
    p.give('overcharge');
    expect(p.mods()).toMatchObject({ boost: 1.35, accel: 1.35, delay: 1 });
  });
  it('the bubble takes damage first', () => {
    const p = createPickups({ rand: () => 0 });
    p.give('bubble');
    expect(p.absorb(25)).toBe(0);
    expect(p.absorb(50)).toBe(15);
    expect(p.absorb(10)).toBe(10);
  });
  it('lists the bubble with its points, and a timed effect with its time left', () => {
    const p = createPickups({ rand: () => 0 });
    p.give('bubble');
    p.absorb(20);
    p.give('rapid');
    p.step(2, ship(), { live: true });
    const b = p.buffs();
    expect(b.find((x) => x.kind === 'bubble')).toMatchObject({ name: 'Bubble shield', points: 40, of: 15 });
    expect(b.find((x) => x.kind === 'rapid')).toMatchObject({ left: 10, of: 12, points: null });
  });
  it('clears on a jump', () => {
    const p = createPickups({ rand: () => 0 });
    p.drop({ x: 50, y: 0, z: 0 }, { ace: true, shield: 100 });
    p.give('overcharge');
    p.clear();
    expect(p.list.length).toBe(0);
    expect(p.mods().boost).toBe(1);
  });
});
