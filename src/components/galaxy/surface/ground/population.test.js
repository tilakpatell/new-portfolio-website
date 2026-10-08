import { describe, expect, test } from 'vitest';
import { E, SITE, kit } from './fixtures/site';
import { turfsOf } from './turf';
import { CELL, DENSITY, POP, RADIUS, SWAP, createPopulation, rosterFor } from './population';

const ok = () => true;
const F = { ...E, front: true };
const turfs = turfsOf(SITE, F, kit);
const seeded = (s = 1) => () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
const keyOf = (x, z) => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
// every cell's roster within the radius of a point
const around = (x, z, tier, effects = F, ts = turfs) => {
  const out = [];
  const [cx, cz] = [Math.floor(x / CELL), Math.floor(z / CELL)];
  for (let i = -RADIUS - 4; i <= RADIUS + 4; i++) for (let j = -RADIUS - 4; j <= RADIUS + 4; j++) out.push(...rosterFor(`${cx + i},${cz + j}`, ts, effects, tier, 7, ok));
  return out;
};

describe('population', () => {
  test('the numbers are the spec’s', () => {
    expect(CELL).toBe(48);
    expect(RADIUS).toBe(3);
    expect(DENSITY).toEqual({ high: 3, mid: 2, low: 1 });
    expect(POP).toEqual({ ultra: 32, high: 28, mid: 18, low: 10 });
  });
  test('a cell’s roster is the same every time, and only in turf', () => {
    expect(rosterFor('0,0', turfs, F, 'high', 7, ok)).toEqual(rosterFor('0,0', turfs, F, 'high', 7, ok));
    expect(rosterFor('0,0', turfs, F, 'high', 7, ok).length).toBeGreaterThan(0);
    expect(rosterFor('9,9', turfs, F, 'high', 7, ok)).toEqual([]); // (no man's land)
  });
  test('a post holds two (one on low), a patrol is three (two on low), fill is DENSITY × strength', () => {
    const count = (list, role) => list.filter((s) => s.role === role).length;
    const high = around(0, 0, 'high');
    const low = around(0, 0, 'low');
    const posts = turfs.reduce((n, t) => n + t.posts.length, 0);
    const beats = turfs.reduce((n, t) => n + t.beats.length, 0);
    expect(count(high, 'post')).toBe(posts * 2);
    expect(count(low, 'post')).toBe(posts);
    expect(count(high, 'patrol')).toBe(beats * 3);
    expect(count(low, 'patrol')).toBe(beats * 2);
    // (a cell wholly in the pad's turf: round(3 × 0.7) on high, round(1 × 0.7) on low)
    const fill = (tier) => rosterFor('0,-1', turfs, F, tier, 7, ok).filter((s) => s.role === 'fill').length;
    expect(fill('high')).toBe(2);
    expect(fill('low')).toBe(1);
  });
  test('every soldier is its turf’s side, standing on ground it can stand on', () => {
    const dry = ([x]) => x > -30;
    for (const s of around(0, 0, 'high', F)) {
      const t = turfs.find((u) => u.id === s.turf);
      expect(s.side).toBe(t.side);
      // (in its disc, or on its beat's bend to the front)
      const onFront = t.front && Math.hypot(s.at[0] - t.front.at[0], s.at[1] - t.front.at[1]) < 8;
      if (!onFront) expect(Math.hypot(s.at[0] - t.at[0], s.at[1] - t.at[1])).toBeLessThanOrEqual(t.r + 12);
    }
    const all = [];
    for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) all.push(...rosterFor(`${i},${j}`, turfs, F, 'high', 7, dry));
    for (const s of all) expect(dry(s.at), s.id).toBe(true);
  });
  test('walking across cells makes ahead and drops behind, dead stay dead', () => {
    const p = createPopulation({ site: SITE, turfs, effects: F, tier: 'high', seed: 7, rand: seeded(), standable: ok });
    let made = [];
    for (let i = 0; i < 80; i++) made.push(...p.update({ x: 0, z: 0, heading: [1, 0] }).make);
    expect(made.length).toBeGreaterThan(0);
    const id = made[0].id;
    p.died(id);
    expect(p.soldiers.has(id)).toBe(false);
    expect(p.isDead(id)).toBe(true);
    let dropped = [];
    for (let i = 0; i < 80; i++) dropped.push(...p.update({ x: -2000, z: 0, heading: [-1, 0] }).drop);
    expect(dropped.length).toBeGreaterThan(0);
    expect(p.soldiers.size).toBe(0);
    made = [];
    for (let i = 0; i < 80; i++) made.push(...p.update({ x: 0, z: 0, heading: [1, 0] }).make);
    expect(made.length).toBeGreaterThan(0);
    expect(made.find((s) => s.id === id)).toBeUndefined();
  });
  test('the cap: never more than POP[tier] live, the furthest left unmade', () => {
    const dense = [{ id: 'pad', at: [0, 0], r: 200, holder: 'owner', side: 'empire', war: 'gcw', posts: Array.from({ length: 30 }, (_, i) => [Math.cos(i) * (10 + i * 4), Math.sin(i) * (10 + i * 4)]), beats: [] }];
    const p = createPopulation({ site: SITE, turfs: dense, effects: { ...E, control: 1 }, tier: 'low', seed: 7, rand: seeded(), standable: ok });
    for (let i = 0; i < 80; i++) p.update({ x: 0, z: 0, heading: [1, 0] });
    expect(p.soldiers.size).toBe(POP.low);
    const live = [...p.soldiers.values()].map((s) => Math.hypot(s.b.x, s.b.z));
    const waiting = p.waiting().map((s) => Math.hypot(s.at[0], s.at[1]));
    expect(waiting.length).toBeGreaterThan(0);
    expect(Math.max(...live)).toBeLessThanOrEqual(Math.min(...waiting) + SWAP);
  });
  test('a soldier is owned by the cell it walked into', () => {
    const p = createPopulation({ site: SITE, turfs, effects: F, tier: 'high', seed: 7, rand: seeded(), standable: ok });
    let made = [];
    for (let i = 0; i < 80; i++) made.push(...p.update({ x: 0, z: 0, heading: [1, 0] }).make);
    const s = made.find((m) => m.b.x < -30);
    expect(s).toBeTruthy();
    // it walks east, 120 m past where it was made, mid-fight; you walk east too
    s.b.x = 150;
    p.move(s.id, 150, s.b.z);
    expect(p.cellOf(150, s.b.z)).toBe(keyOf(150, s.b.z));
    const drop = [];
    for (let i = 0; i < 80; i++) drop.push(...p.update({ x: 200, z: 0, heading: [1, 0] }).drop);
    expect(drop).not.toContain(s.id);
    expect(p.soldiers.get(s.id)).toBe(s);
  });
  test('nobody within 25 m of a covert landing', () => {
    const at = [40, -20];
    for (const s of around(0, 0, 'high', { ...F, covertAt: at })) expect(Math.hypot(s.at[0] - at[0], s.at[1] - at[1]), s.id).toBeGreaterThanOrEqual(25);
  });
  test('reinforcements join a cell and are made once it is loaded', () => {
    const p = createPopulation({ site: SITE, turfs, effects: F, tier: 'high', seed: 7, rand: seeded(), standable: ok });
    for (let i = 0; i < 80; i++) p.update({ x: 0, z: 0, heading: [1, 0] });
    p.reinforce(p.cellOf(10, 10), [{ id: 'r1', kind: 'stormtrooper', side: 'empire', role: 'raid', at: [10, 10], yaw: 0, home: [0, 26], turf: 'pad', squad: 'raid1' }]);
    const made = p.update({ x: 0, z: 0, heading: [1, 0] }).make;
    expect(made.map((s) => s.id)).toContain('r1');
  });
});
