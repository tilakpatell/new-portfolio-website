import { describe, expect, it } from 'vitest';
import { byName } from './blocks';
import { inWater, moveBox, onLadder } from './physics';
import { EYE, makePlayer, stepPlayer } from './player';

const id = (n) => byName.get(n).id;
// A world from a function of the cell: what's there.
function world(at) {
  return {
    get: (x, y, z) => at(Math.floor(x), Math.floor(y), Math.floor(z)),
    solid: (x, y, z) => byName.get([...byName.keys()][at(Math.floor(x), Math.floor(y), Math.floor(z))]).solid,
  };
}
const flat = (top = 63) => world((x, y) => (y <= top ? id('stone') : 0));
const idle = { forward: 0, strafe: 0, jump: false, sneak: false, sprint: false, yaw: 0, pitch: 0 };
const standOn = (w, x, z, y = 64) => {
  const p = makePlayer({ x, y, z });
  for (let i = 0; i < 5; i++) stepPlayer(w, p, idle);
  return p;
};

describe('moveBox', () => {
  it('stops a falling box on the floor and says it’s on the ground', () => {
    const r = moveBox(flat(), { x: 0.5, y: 64.3, z: 0.5, w: 0.6, h: 1.8 }, { x: 0, y: -1, z: 0 });
    expect(r.y).toBe(64);
    expect(r.onGround).toBe(true);
  });

  it('a box at x exactly 16.0 resolves against both chunks', () => {
    const asked = new Set();
    const base = flat();
    const spy = { ...base, solid: (x, y, z) => (asked.add(Math.floor(x)), base.solid(x, y, z)) };
    const r = moveBox(spy, { x: 16, y: 64.2, z: 8, w: 0.6, h: 1.8 }, { x: 0, y: -0.5, z: 0 });
    expect(r.y).toBe(64);
    expect(asked.has(15)).toBe(true);
    expect(asked.has(16)).toBe(true);
  });

  it('stops at a wall and says so', () => {
    const w = world((x, y) => (y <= 63 || x >= 3 ? id('stone') : 0));
    const r = moveBox(w, { x: 2.5, y: 64, z: 0.5, w: 0.6, h: 1.8 }, { x: 0.5, y: 0, z: 0 });
    expect(r.x).toBeCloseTo(2.7, 10);
    expect(r.hitX).toBe(true);
    expect(r.hitZ).toBe(false);
  });

  it('a 0.6 step is taken; a 1-block step is not', () => {
    const slab = world((x, y) => (y <= 63 || (x >= 3 && y === 64) ? id('stone') : 0));
    // a half step: a slab's box, half a block high
    const half = {
      get: () => 0,
      solid: (x, y) => Math.floor(y) <= 63 || (Math.floor(x) >= 3 && Math.floor(y) === 64),
      boxes: (x, y) => (Math.floor(y) === 64 ? [[0, 0, 0, 1, 0.5, 1]] : null),
    };
    const r1 = moveBox(half, { x: 2.5, y: 64, z: 0.5, w: 0.6, h: 1.8 }, { x: 0.3, y: -0.08, z: 0 }, { onGround: true });
    expect(r1.x).toBeCloseTo(2.8, 10);
    expect(r1.y).toBeCloseTo(64.5, 10);
    const r2 = moveBox(slab, { x: 2.5, y: 64, z: 0.5, w: 0.6, h: 1.8 }, { x: 0.3, y: -0.08, z: 0 }, { onGround: true });
    expect(r2.x).toBeCloseTo(2.7, 10);
    expect(r2.y).toBe(64);
  });

  it('bumps its head', () => {
    const w = world((x, y) => (y <= 63 || y === 66 ? id('stone') : 0));
    const r = moveBox(w, { x: 0.5, y: 64, z: 0.5, w: 0.6, h: 1.8 }, { x: 0, y: 0.42, z: 0 });
    expect(r.y).toBeCloseTo(64.2, 10);
    expect(r.hitHead).toBe(true);
  });

  it('knows water and ladders', () => {
    const w = world((x, y) => (y <= 60 ? id('stone') : y <= 63 ? id('water') : x === 0 && y < 70 ? id('ladder') : 0));
    expect(inWater(w, { x: 3.5, y: 62, z: 0.5, w: 0.6, h: 1.8 })).toBe(true);
    expect(inWater(w, { x: 3.5, y: 64, z: 0.5, w: 0.6, h: 1.8 })).toBe(false);
    expect(onLadder(w, { x: 0.5, y: 65, z: 0.5, w: 0.6, h: 1.8 })).toBe(true);
    expect(onLadder(w, { x: 2.5, y: 65, z: 0.5, w: 0.6, h: 1.8 })).toBe(false);
  });
});

describe('the player', () => {
  it('stands 1.8 tall with eyes at 1.62, 1.27 sneaking', () => {
    expect(EYE).toEqual({ stand: 1.62, sneak: 1.27 });
    const p = makePlayer({ x: 0, y: 64, z: 0 });
    expect(p).toMatchObject({ health: 20, hunger: 20, air: 300, w: 0.6, h: 1.8 });
  });

  it('a jump from flat ground peaks between 1.25 and 1.26 above', () => {
    const w = flat();
    const p = standOn(w, 0.5, 0.5);
    expect(p.y).toBe(64);
    expect(p.onGround).toBe(true);
    stepPlayer(w, p, { ...idle, jump: true });
    let top = p.y;
    for (let i = 0; i < 30 && p.vy > 0; i++) {
      stepPlayer(w, p, idle);
      top = Math.max(top, p.y);
    }
    expect(top - 64).toBeGreaterThan(1.25);
    expect(top - 64).toBeLessThan(1.26);
  });

  it('walking 20 ticks on flat ground covers 4.317 ± 0.05 blocks (once up to speed)', () => {
    const w = flat();
    const p = standOn(w, 0.5, 0.5);
    const walk = { ...idle, forward: 1 };
    for (let i = 0; i < 20; i++) stepPlayer(w, p, walk);
    const z0 = p.z;
    for (let i = 0; i < 20; i++) stepPlayer(w, p, walk);
    // yaw 0 looks north, −z
    expect(z0 - p.z).toBeCloseTo(4.317, 1);
    expect(Math.abs(z0 - p.z - 4.317)).toBeLessThan(0.05);
    expect(p.x).toBeCloseTo(0.5, 10);
  });

  it('sprints at 5.612 and sneaks at 1.295', () => {
    const w = flat();
    for (const [mode, speed] of [[{ sprint: true }, 5.612], [{ sneak: true }, 1.295]]) {
      const p = standOn(w, 0.5, 0.5);
      for (let i = 0; i < 20; i++) stepPlayer(w, p, { ...idle, forward: 1, ...mode });
      const z0 = p.z;
      for (let i = 0; i < 20; i++) stepPlayer(w, p, { ...idle, forward: 1, ...mode });
      expect(Math.abs(z0 - p.z - speed)).toBeLessThan(0.05);
    }
  });

  it('turns with its yaw: a quarter turn left walks west', () => {
    const w = flat();
    const p = standOn(w, 0.5, 0.5);
    for (let i = 0; i < 20; i++) stepPlayer(w, p, { ...idle, forward: 1, yaw: Math.PI / 2 });
    expect(p.x).toBeLessThan(-2);
    expect(Math.abs(p.z - 0.5)).toBeLessThan(1e-9);
  });

  it('sneaking at an edge stops at the edge', () => {
    // a floor that ends at z = 0 (north of it, a drop)
    const w = world((x, y, z) => (y <= 40 || (y <= 63 && z >= 0) ? id('stone') : 0));
    const p = standOn(w, 0.5, 0.5);
    for (let i = 0; i < 60; i++) stepPlayer(w, p, { ...idle, forward: 1, sneak: true });
    expect(p.y).toBe(64);
    expect(p.z).toBeGreaterThan(-0.3);
    expect(p.z).toBeLessThan(0.0);
  });

  it('a 3-block fall hurts 0; a 4-block fall hurts 1', () => {
    for (const [drop, hurt] of [[3, 0], [4, 1], [6, 3]]) {
      const w = flat();
      const p = makePlayer({ x: 0.5, y: 64 + drop, z: 0.5 });
      const events = [];
      for (let i = 0; i < 60; i++) events.push(...stepPlayer(w, p, idle));
      expect(p.health, `${drop} blocks`).toBe(20 - hurt);
      expect(events.find((e) => e.type === 'land').fell).toBeCloseTo(drop, 1);
      expect(events.filter((e) => e.type === 'hurt').reduce((s, e) => s + e.amount, 0)).toBe(hurt);
    }
  });

  it('in water the player sinks slowly and rises on jump', () => {
    const w = world((x, y) => (y <= 40 ? id('stone') : y <= 70 ? id('water') : 0));
    const p = makePlayer({ x: 0.5, y: 60, z: 0.5 });
    for (let i = 0; i < 20; i++) stepPlayer(w, p, idle);
    expect(60 - p.y).toBeGreaterThan(0.5);
    expect(60 - p.y).toBeLessThan(3);
    const y0 = p.y;
    for (let i = 0; i < 20; i++) stepPlayer(w, p, { ...idle, jump: true });
    expect(p.y).toBeGreaterThan(y0 + 0.5);
  });

  it('runs out of air under water and is hurt', () => {
    const w = world((x, y) => (y <= 40 ? id('stone') : y <= 70 ? id('water') : 0));
    const p = makePlayer({ x: 0.5, y: 41, z: 0.5 });
    const events = [];
    for (let i = 0; i < 330; i++) events.push(...stepPlayer(w, p, idle));
    expect(p.air).toBeLessThanOrEqual(0);
    expect(events.some((e) => e.type === 'hurt' && e.cause === 'drown')).toBe(true);
  });

  it('on a ladder it falls no faster than 0.15 a tick and climbs at the game’s 2.35 m/s', () => {
    // a ladder column at x 0 against a wall at x −1
    const w = world((x, y) => (y <= 63 || x < 0 ? id('stone') : x === 0 && y <= 80 ? id('ladder') : 0));
    const p = makePlayer({ x: 0.3, y: 75, z: 0.5 });
    p.vy = -1;
    for (let i = 0; i < 10; i++) {
      const y0 = p.y;
      stepPlayer(w, p, idle);
      expect(y0 - p.y).toBeLessThanOrEqual(0.15 + 1e-9);
    }
    const q = standOn(w, 0.3, 0.5);
    // pushing into the wall climbs
    for (let i = 0; i < 5; i++) stepPlayer(w, q, { ...idle, forward: 1, yaw: Math.PI / 2 });
    const y0 = q.y;
    for (let i = 0; i < 20; i++) stepPlayer(w, q, { ...idle, forward: 1, yaw: Math.PI / 2 });
    expect((q.y - y0) / 20).toBeCloseTo(0.1176, 2);
  });

  it('says when it steps', () => {
    const w = flat();
    const p = standOn(w, 0.5, 0.5);
    const events = [];
    for (let i = 0; i < 40; i++) events.push(...stepPlayer(w, p, { ...idle, forward: 1 }));
    const steps = events.filter((e) => e.type === 'step').length;
    expect(steps).toBeGreaterThanOrEqual(5);
    expect(steps).toBeLessThanOrEqual(8);
  });
});
