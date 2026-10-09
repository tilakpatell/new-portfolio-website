import { describe, expect, it } from 'vitest';
import { sight } from './interiors/rickall';
import { ASSIST } from '../../../lib/combat/aim';
import { createShots, rickallBodies } from './rmShots';

// An open floor, Morty at the origin and the camera looking east (+x, a
// yaw of −π/2): the sight line runs at z 0.55, over his right shoulder.
const m = { x: 0, z: 0, y: 0, face: 0 };
const yaw = -Math.PI / 2;
const person = (id, x, z, h = 1.8) => ({ id, name: id, r: 0.3, h, x, z, parasite: true });
const game = (people) => ({ people, shot: [], told: {}, state: 'on', t: 0 });
const floor = (a, b) => (b[1] <= 0 && a[1] > 0 ? { at: [a[0] + ((b[0] - a[0]) * a[1]) / (a[1] - b[1]), 0, a[2] + ((b[2] - a[2]) * a[1]) / (a[1] - b[1])], normal: [0, 1, 0] } : null);
// a wall across x = 2, as high as a room
const wall = (a, b) => (a[0] < 2 && b[0] >= 2 ? { at: [2, a[1] + ((b[1] - a[1]) * (2 - a[0])) / (b[0] - a[0]), a[2] + ((b[2] - a[2]) * (2 - a[0])) / (b[0] - a[0])], normal: [-1, 0, 0] } : floor(a, b));
const run = (shots, world, seconds = 0.5) => {
  const out = [];
  for (let t = 0; t < seconds; t += 1 / 60) out.push(...shots.step(1 / 60, world));
  return out;
};

describe('Total Rickall’s shot', () => {
  it('is a bolt that hits whoever is in the sights when it gets there, not at once', () => {
    const g = game([person('pencilvester', 4, 0.55)]);
    const shots = createShots();
    const s = sight(m, yaw);
    shots.rickall({ m, sight: s, aim: 'pencilvester', game: g });
    const world = { solids: floor, bodies: rickallBodies(g, []) };
    expect(shots.step(0.001, world)).toEqual([]);
    const hit = run(shots, world).find((e) => e.type === 'hit');
    expect(hit?.body.ref.id).toBe('pencilvester');
    expect(hit.bolt.tag).toBe('rickall');
  });

  it('stops at the furniture between', () => {
    const g = game([person('pencilvester', 4, 0.55)]);
    const shots = createShots();
    shots.rickall({ m, sight: sight(m, yaw), aim: 'pencilvester', game: g });
    const evs = run(shots, { solids: wall, bodies: rickallBodies(g, []) });
    expect(evs.find((e) => e.type === 'hit')).toBe(undefined);
    expect(evs.find((e) => e.type === 'solid')?.at[0]).toBeCloseTo(2, 6);
  });

  it('with nobody in the sights, flies down the line to whatever it meets', () => {
    const g = game([]);
    const shots = createShots();
    shots.rickall({ m, sight: sight(m, yaw), aim: null, game: g, solids: wall });
    const evs = run(shots, { solids: wall, bodies: [] });
    expect(evs.find((e) => e.type === 'solid')?.at[0]).toBeCloseTo(2, 6);
  });

  it('a tap on touch snaps onto someone just off the line; a mouse’s shot doesn’t', () => {
    // 10° off the sight line at 5 m: nobody in the sights
    const off = 10 * (Math.PI / 180);
    const g = game([person('pencilvester', 5 * Math.cos(off), 0.55 + 5 * Math.sin(off))]);
    const world = { solids: floor, bodies: rickallBodies(g, []) };
    const tap = createShots();
    tap.rickall({ m, sight: sight(m, yaw), aim: null, game: g, solids: floor, cone: ASSIST.touch, bodies: world.bodies });
    expect(run(tap, world).find((e) => e.type === 'hit')?.body.ref.id).toBe('pencilvester');
    const click = createShots();
    click.rickall({ m, sight: sight(m, yaw), aim: null, game: g, solids: floor, cone: ASSIST.mouse, bodies: world.bodies });
    expect(run(click, world).find((e) => e.type === 'hit')).toBe(undefined);
  });

  it('can’t hit anyone shot already or left out of the picture', () => {
    const g = game([person('a', 3, 0), person('b', 5, 0), person('c', 7, 0)]);
    g.shot.push('a');
    expect(rickallBodies(g, ['b']).map((b) => b.ref.id)).toEqual(['c']);
    expect(rickallBodies({ ...g, state: 'won' }, [])).toEqual([]);
  });
});

describe('a duel’s shot', () => {
  const hunter = { id: 'evilrick', a: [5, 0.4, 0], b: [5, 1.4, 0], r: 0.4, side: 'them', ref: 'duel' };
  it('flies at the hunter it was aimed at, and lands on him', () => {
    const shots = createShots();
    shots.duel({ m, at: { x: 5, y: 1, z: 0 } });
    const hit = run(shots, { solids: floor, bodies: [hunter] }).find((e) => e.type === 'hit');
    expect(hit?.body.id).toBe('evilrick');
    expect(hit.bolt.tag).toBe('duel');
  });
  it('is stopped by the arena’s walls', () => {
    const shots = createShots();
    shots.duel({ m, at: { x: 5, y: 1, z: 0 } });
    const evs = run(shots, { solids: wall, bodies: [hunter] });
    expect(evs.some((e) => e.type === 'hit')).toBe(false);
  });
  it('with no one in the cone, goes along his facing', () => {
    const shots = createShots();
    const b = shots.duel({ m: { ...m, face: Math.PI / 2 }, at: null });
    expect(b.dir[0]).toBeCloseTo(0, 6);
    expect(b.dir[2]).toBeCloseTo(-1, 6); // facing π/2 looks along (cos, −sin): −z
  });
});
