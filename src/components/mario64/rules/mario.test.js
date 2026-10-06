import { describe, expect, it } from 'vitest';
import { createKit } from '../courses/shapes';
import { makeWorld } from './collide';
import { intent, newMario, stepMario } from './mario';

const worldFrom = (build) => {
  const k = createKit();
  build(k);
  const o = k.done();
  return makeWorld(o.tris, o.kinds, { water: o.water ?? [] });
};
const flat = (more = () => {}) =>
  worldFrom((k) => {
    k.box({ x: 0, y: -100, z: 0, w: 40000, h: 100, d: 40000, mat: 'g' });
    more(k);
  });
const input = (o = {}) => ({ sx: 0, sy: 0, a: false, ap: false, b: false, bp: false, z: false, zp: false, walk: false, camYaw: 0, ...o });
// steps m n times; inp is an input or a function of the frame
function run(m, w, inp, n) {
  const events = [];
  for (let i = 0; i < n; i++) events.push(...stepMario(m, typeof inp === 'function' ? inp(i) : inp, w));
  return events;
}
const up = input({ sy: 1 });

describe('intent', () => {
  it('turns the stick into a heading relative to the camera', () => {
    expect(intent(input({ sy: 1 }), 0).yaw).toBeCloseTo(0);
    expect(intent(input({ sx: 1 }), 0).yaw).toBeCloseTo(-Math.PI / 2);
    expect(intent(input({ sy: 1 }), Math.PI / 2).yaw).toBeCloseTo(Math.PI / 2);
    expect(intent(input({ sy: 1, walk: true }), 0).mag).toBeCloseTo(0.5);
  });
});

describe('Mario on the ground', () => {
  it('walks toward +z with the stick up and the camera at yaw 0', () => {
    const w = flat();
    const m = newMario({ x: 0, y: 0, z: 0, yaw: 0 });
    run(m, w, up, 30);
    expect(m.action).toBe('walk');
    expect(m.pos.z).toBeGreaterThan(300);
    expect(Math.abs(m.pos.x)).toBeLessThan(1);
  });

  it('walks toward -x with the stick right and the camera at yaw 0', () => {
    const w = flat();
    const m = newMario({ x: 0, y: 0, z: 0, yaw: 0 });
    run(m, w, input({ sx: 1 }), 60);
    expect(m.pos.x).toBeLessThan(-300);
  });

  it('builds speed toward 32 and no further', () => {
    const w = flat();
    const m = newMario({ x: 0, y: 0, z: 0, yaw: 0 });
    let top = 0;
    run(m, w, (i) => {
      top = Math.max(top, m.fwd);
      return up;
    }, 120);
    expect(m.fwd).toBeGreaterThan(31.5);
    expect(top).toBeLessThanOrEqual(32);
  });

  it('caps a walk at 16', () => {
    const w = flat();
    const m = newMario({ x: 0, y: 0, z: 0, yaw: 0 });
    run(m, w, input({ sy: 1, walk: true }), 120);
    expect(m.fwd).toBeLessThanOrEqual(16);
    expect(m.fwd).toBeGreaterThan(15);
  });

  it('skids on a hard reverse at speed', () => {
    const w = flat();
    const m = newMario({ x: 0, y: 0, z: 0, yaw: 0 });
    run(m, w, up, 60);
    run(m, w, input({ sy: -1 }), 2);
    expect(m.action).toBe('skid');
  });

  it('walks up a step of 70 and is stopped by a wall of 200', () => {
    const w = flat((k) => {
      k.box({ x: 0, y: 0, z: 1000, w: 2000, h: 70, d: 1000, mat: 'g' });
      k.box({ x: 0, y: 70, z: 2000, w: 2000, h: 200, d: 1000, mat: 'g' });
    });
    const m = newMario({ x: 0, y: 0, z: 0, yaw: 0 });
    run(m, w, up, 90);
    expect(m.pos.y).toBeCloseTo(70);
    expect(m.pos.z).toBeLessThan(1500 - 49);
    expect(m.action).toBe('walk');
  });

  it('leaves the ground walking off a ledge', () => {
    const w = worldFrom((k) => {
      k.box({ x: 0, y: -100, z: 0, w: 2000, h: 100, d: 2000, mat: 'g' });
      k.box({ x: 0, y: -2100, z: 0, w: 20000, h: 100, d: 20000, mat: 'g' });
    });
    const m = newMario({ x: 0, y: 0, z: 0, yaw: 0 });
    const seen = new Set();
    run(m, w, (i) => {
      seen.add(m.action);
      return up;
    }, 60);
    expect(seen.has('freefall')).toBe(true);
  });

  it('punches, punches again, then kicks', () => {
    const w = flat();
    const m = newMario({ x: 0, y: 0, z: 0, yaw: 0 });
    run(m, w, input({ bp: true, b: true }), 1);
    expect(m.action).toBe('punch');
    expect(m.arg).toBe(0);
    run(m, w, input(), 4);
    run(m, w, input({ bp: true, b: true }), 1);
    expect(m.action).toBe('punch');
    expect(m.arg).toBe(1);
    run(m, w, input(), 4);
    run(m, w, input({ bp: true, b: true }), 1);
    expect(m.arg).toBe(2);
    run(m, w, input(), 30);
    expect(m.action).toBe('idle');
  });

  it('crouches on Z, and crawls no faster than 8', () => {
    const w = flat();
    const m = newMario({ x: 0, y: 0, z: 0, yaw: 0 });
    run(m, w, input({ z: true, zp: true }), 1);
    expect(m.action).toBe('crouch');
    run(m, w, input({ z: true, sy: 1 }), 40);
    expect(m.action).toBe('crawl');
    expect(m.fwd).toBeLessThanOrEqual(8);
    expect(m.pos.z).toBeGreaterThan(50);
  });

  it('never falls through the seams of a terrain while walking its diagonals', () => {
    const w = worldFrom((k) => {
      k.terrain({ id: 't', x0: -5000, z0: -5000, w: 10000, d: 10000, res: 40, height: () => 0, mats: ['g', 'g', 'g'] });
    });
    const m = newMario({ x: -4000, y: 0, z: -4000, yaw: Math.PI / 4 });
    const seen = new Set();
    run(m, w, (i) => {
      seen.add(m.action);
      return input({ sx: -Math.SQRT1_2, sy: Math.SQRT1_2 });
    }, 200);
    expect(seen.has('freefall')).toBe(false);
    expect(m.pos.x).toBeGreaterThan(-1000);
  });
});
