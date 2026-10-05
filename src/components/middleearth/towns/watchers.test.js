import { describe, expect, it } from 'vitest';
import { makeWalker } from './walker';
import { newWatchers, stepWatchers, watcherSees } from './watchers';

const OPTS = { sight: 8, cone: 0.6, smell: 1.6, hear: 2.5, ringSight: 30, alert: 0.5, chase: 4, patrol: 1.5, giveUp: 8, leash: 12, catch: 0.8, look: 1.2 };
const hobbit = (x, z, o = {}) => ({ x, z, face: 0, speed: 0, running: false, ...o });
// a watcher standing at the origin looking east (+x)
const eastward = () => ({ id: 0, x: 0, z: 0, face: 0, look: 0, mode: 'patrol', t: 0, wait: 9, leg: 1, unseen: 0 });
const house = { kind: 'box', x: 3, z: 0, w: 2, d: 3 };

describe('what a watcher sees', () => {
  it('sees ahead in its cone, not behind it or off to the side', () => {
    expect(watcherSees(eastward(), hobbit(5, 0), OPTS)).toBe(true);
    expect(watcherSees(eastward(), hobbit(-5, 0), OPTS)).toBe(false);
    expect(watcherSees(eastward(), hobbit(1, 5), OPTS)).toBe(false);
    expect(watcherSees(eastward(), hobbit(9, 0), OPTS)).toBe(false);
  });
  it('does not see through a house', () => {
    expect(watcherSees(eastward(), hobbit(5, 0), OPTS, { colliders: [house] })).toBe(false);
  });
  it('smells you close by through a wall, and sees the Ring from afar through anything', () => {
    const wall = [[0.7, -3, 0.7, 3]];
    expect(watcherSees(eastward(), hobbit(1.2, 0), OPTS, { walls: wall })).toBe(true);
    expect(watcherSees(eastward(), hobbit(-20, 0), OPTS, { colliders: [house], ring: true })).toBe(true);
  });
  it('hears you running close behind, if nothing is between', () => {
    expect(watcherSees(eastward(), hobbit(-2, 0, { running: true }), OPTS)).toBe(true);
    expect(watcherSees(eastward(), hobbit(-2, 0), OPTS)).toBe(false);
  });
});

describe('a watch', () => {
  const run = (ws, h, s, world) => {
    const ev = [];
    for (let t = 0; t < s; t += 1 / 30) ev.push(...stepWatchers(ws, typeof h === 'function' ? h() : h, 1 / 30, OPTS, world));
    return ev;
  };

  it('walks its round, corner to corner', () => {
    const ws = newWatchers([[[0, 0], [6, 0]]]);
    let far = 0;
    for (let t = 0; t < 8; t += 1 / 30) {
      stepWatchers(ws, hobbit(0, 40), 1 / 30, OPTS);
      far = Math.max(far, ws.list[0].x);
    }
    expect(far).toBeGreaterThan(5.8);
    // and turned back for the first corner after looking about at the second
    expect(ws.list[0].x).toBeLessThan(far - 1);
  });

  it('sees you, takes a moment, then gives chase and catches you', () => {
    const ws = newWatchers([[[0, 0], [10, 0]]]);
    ws.list[0].wait = 0;
    const ev = run(ws, hobbit(5, 0), 4);
    const types = ev.map((e) => e.type);
    expect(types[0]).toBe('seen');
    expect(types).toContain('caught');
    expect(ws.list[0].mode).not.toBe('patrol');
  });

  it('loses you once you are out of reach', () => {
    const ws = newWatchers([[[0, 0], [10, 0]]]);
    Object.assign(ws.list[0], { mode: 'chase', t: 0 });
    const ev = run(ws, hobbit(30, 0), 1);
    expect(ev.map((e) => e.type)).toContain('lost');
    expect(ws.list[0].mode).toBe('back');
  });

  it('notices nothing while the watch is off', () => {
    const ws = newWatchers([[[0, 0], [10, 0]]]);
    ws.list[0].wait = 0;
    expect(run(ws, hobbit(4, 0), 2, { active: false })).toEqual([]);
  });

  it('chases round a house, not through it', () => {
    const walls = makeWalker({ radius: 50, colliders: [house] });
    const ws = newWatchers([[[0, 0], [0, 1]]]);
    Object.assign(ws.list[0], { mode: 'chase', t: 0 });
    for (let i = 0; i < 90; i++) {
      stepWatchers(ws, hobbit(6, 0), 1 / 30, { ...OPTS, giveUp: 99 }, { colliders: [house], ring: true, push: (x, z) => walls.push(x, z, 0.4) });
      const w = ws.list[0];
      expect(Math.abs(w.x - house.x) < house.w / 2 && Math.abs(w.z - house.z) < house.d / 2).toBe(false);
    }
  });
});
