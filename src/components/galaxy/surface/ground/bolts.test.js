import { describe, expect, test } from 'vitest';
import { createBolts, farExchange } from './bolts';
import { aimError } from './fight';
import { damageOf, hurt, newSoldier } from './troops';

const clear = () => true;
const body = (id, x, z, side = 'rebel') => ({ id, x, y: 0, z, r: 0.45, h: 1.8, side });
const seeded = (s = 3) => () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;

describe('bolts', () => {
  test('a bolt stops at a wall: one wall, no hit', () => {
    const bolts = createBolts({ speed: 90, life: 2 });
    bolts.fire({ from: [0, 1.2, 0], dir: [0, 0, 1], side: 'empire', owner: 'a', damage: 10, range: 100 });
    const wallAt = 10;
    const seesThrough = (a, b) => Math.max(a.z, b.z) < wallAt;
    const events = [];
    for (let i = 0; i < 30; i++) events.push(...bolts.step(1 / 30, { bodies: [body('r', 0, 20)], seesThrough }));
    expect(events.filter((e) => e.type === 'hit')).toHaveLength(0);
    const walls = events.filter((e) => e.type === 'wall');
    expect(walls).toHaveLength(1);
    expect(walls[0].at[2]).toBeGreaterThan(wallAt - 1.5);
    expect(walls[0].at[2]).toBeLessThanOrEqual(wallAt + 0.5);
    expect(bolts.bolts).toHaveLength(0);
  });
  test('a hit swept across a long step', () => {
    const bolts = createBolts({ speed: 90, life: 2 });
    bolts.fire({ from: [0, 1.2, 0], dir: [0, 0, 1], side: 'empire', owner: 'a', damage: 10, range: 100 });
    const events = bolts.step(0.5, { bodies: [body('r', 0, 20)], seesThrough: clear });
    const hit = events.find((e) => e.type === 'hit');
    expect(hit.target).toBe('r');
    expect(hit.at[2]).toBeCloseTo(20, 0);
    expect(hit.dir[2]).toBeCloseTo(1);
  });
  test('never its own shooter; the nearest body along the way first', () => {
    const bolts = createBolts({ speed: 90, life: 2 });
    bolts.fire({ from: [0, 1.2, 0], dir: [0, 0, 1], side: 'empire', owner: 'a', damage: 10, range: 100 });
    const events = bolts.step(0.5, { bodies: [body('a', 0, 0.2, 'empire'), body('far', 0, 30), body('near', 0.2, 12)], seesThrough: clear });
    expect(events.find((e) => e.type === 'hit').target).toBe('near');
  });
  test('near, once a bolt, for a body it passes within 2 m of', () => {
    const bolts = createBolts({ speed: 90, life: 2 });
    bolts.fire({ from: [0, 1.2, 0], dir: [0, 0, 1], side: 'empire', owner: 'a', damage: 10, range: 100 });
    const events = [];
    for (let i = 0; i < 40; i++) events.push(...bolts.step(1 / 30, { bodies: [body('r', 1.5, 20)], seesThrough: clear }));
    expect(events.filter((e) => e.type === 'near' && e.target === 'r')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'hit')).toHaveLength(0);
  });
  test('a bolt at you is handed on, not resolved', () => {
    const bolts = createBolts({ speed: 90, life: 2 });
    bolts.fire({ from: [0, 1.2, 0], dir: [0, 0, 1], side: 'empire', owner: 'a', damage: 10, range: 100, target: 'you' });
    const events = bolts.step(1 / 30, { bodies: [body('you', 0, 1, 'rebel')], seesThrough: clear });
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('atYou');
    expect(events[0].bolt.damage).toBe(10);
    expect(bolts.bolts).toHaveLength(0);
  });
  test('an enemy bolt near an unsworn you is a near on you, nothing more', () => {
    const bolts = createBolts({ speed: 90, life: 2 });
    bolts.fire({ from: [0, 1.2, 0], dir: [0, 0, 1], side: 'empire', owner: 'a', damage: 10, range: 100, target: 'r' });
    const events = [];
    for (let i = 0; i < 40; i++) events.push(...bolts.step(1 / 30, { bodies: [body('you', 1.2, 10, null), body('r', 0, 30)], seesThrough: clear }));
    expect(events.filter((e) => e.target === 'you').map((e) => e.type)).toEqual(['near']);
  });
  test('out of range, gone', () => {
    const bolts = createBolts({ speed: 90, life: 2 });
    bolts.fire({ from: [0, 1.2, 0], dir: [0, 0, 1], side: 'empire', owner: 'a', damage: 10, range: 20 });
    const events = [];
    for (let i = 0; i < 30; i++) events.push(...bolts.step(1 / 30, { bodies: [body('r', 0, 40)], seesThrough: clear }));
    expect(events).toHaveLength(0);
    expect(bolts.bolts).toHaveLength(0);
  });
  test('farExchange: over 10 s the better-armed side kills more, within a band', () => {
    const kills = { clone: 0, droid: 0 };
    for (let seed = 1; seed <= 20; seed++) {
      const rand = seeded(seed);
      const clones = [0, 1, 2].map((i) => newSoldier({ id: `c${i}`, kind: 'clone', side: 'republic', role: 'patrol', at: [i * 2, 0], squad: 'c' }, rand));
      const droids = [0, 1, 2].map((i) => newSoldier({ id: `d${i}`, kind: 'battledroid', side: 'separatists', role: 'patrol', at: [i * 2, 30], squad: 'd' }, rand));
      const byId = new Map([...clones, ...droids].map((s) => [s.id, s]));
      for (let t = 0; t < 10; t += 0.5) {
        const { hits } = farExchange(clones, droids, 0.5, rand, { aimError, damageOf });
        for (const h of hits) {
          const v = byId.get(h.to);
          if (v.alive && hurt(v, h.damage) === 'down') kills[h.from.startsWith('c') ? 'clone' : 'droid'] += 1;
        }
      }
    }
    expect(kills.clone).toBeGreaterThan(kills.droid);
    expect(kills.clone / 20).toBeGreaterThan(0.5);
    expect(kills.clone / 20).toBeLessThanOrEqual(3);
    expect(kills.droid / 20).toBeLessThan(2.5);
  });
});
