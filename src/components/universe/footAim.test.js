import { describe, expect, it } from 'vitest';
import { ASSIST } from '../../lib/combat/aim';
import { footAim } from './footAim';

// A flat stretch for the pure part: the camera behind and over your
// shoulder looking down −z, you at the origin, a trooper `deg` off the
// reticle's line at 10 m from where the shot's ray starts (level with you).
// No solids (the planet's own are foot.js's, tested there).
const DEG = Math.PI / 180;
const cam = [0.45, 1.4, 4];
const dir = [0, 0, -1];
const from = [0, 1.4, 0];
const trooper = (id, deg, dist = 10) => {
  const x = cam[0] + Math.sin(deg * DEG) * dist;
  const z = -Math.cos(deg * DEG) * dist;
  return { id, a: [x, 0.5, z], b: [x, 1.6, z], r: 0.45 };
};
const noSolids = () => null;

describe('the universe’s shot on foot', () => {
  it('goes where the reticle is, not to a lock 20° off on a mouse', () => {
    const lock = trooper('t1', 20);
    const r = footAim({ cam, dir, from, targets: [lock], solids: noSolids, cone: ASSIST.mouse, lock: 't1' });
    expect(r.target).toBe(null);
    expect(r.locked).toBe(false);
    // straight down the reticle's line: at x as the camera's, far ahead
    expect(r.at[0]).toBeCloseTo(cam[0], 5);
    expect(r.at[2]).toBeLessThan(-50);
  });

  it('takes the lock on touch within 12°', () => {
    const lock = trooper('t1', 11.5);
    const r = footAim({ cam, dir, from, targets: [lock], solids: noSolids, cone: ASSIST.touch, lock: 't1' });
    expect(r.target?.id).toBe('t1');
    expect(r.locked).toBe(true);
  });

  it('on touch, prefers the lock to a nearer one in the cone', () => {
    const lock = trooper('t1', 9);
    const other = trooper('t2', 3);
    const r = footAim({ cam, dir, from, targets: [lock, other], solids: noSolids, cone: ASSIST.touch, lock: 't1' });
    expect(r.target?.id).toBe('t1');
  });

  it('bends a mouse’s shot no more than its cap', () => {
    // 1.5° off: inside the mouse's outer cone, past its 0.01 rad pull
    const t = trooper('t1', 1.5, 40);
    const r = footAim({ cam, dir, from, targets: [t], solids: noSolids, cone: ASSIST.mouse, lock: 't1' });
    const along = [r.at[0] - r.ray.from[0], r.at[1] - r.ray.from[1], r.at[2] - r.ray.from[2]];
    const l = Math.hypot(...along);
    const off = Math.acos(-along[2] / l);
    expect(off).toBeGreaterThan(0.009);
    expect(off).toBeLessThan(0.0101);
  });

  it('hits what the reticle is on, and a wall in front stops the aim', () => {
    const t = trooper('t1', 0);
    expect(footAim({ cam, dir, from, targets: [t], solids: noSolids, cone: ASSIST.mouse }).target?.id).toBe('t1');
    // a wall 3 m ahead of you
    const wall = (a, b) => (a[2] > -3 && b[2] < -3 ? { at: [a[0] + ((b[0] - a[0]) * (a[2] + 3)) / (a[2] - b[2]), a[1], -3], normal: [0, 0, 1] } : null);
    const r = footAim({ cam, dir, from, targets: [t], solids: wall, cone: ASSIST.mouse });
    expect(r.target).toBe(null);
    expect(r.at[2]).toBeCloseTo(-3, 3);
  });

  it('starts the ray level with you, so nothing behind your back is aimed at', () => {
    const behind = { id: 'b', a: [0.45, 0.5, 2], b: [0.45, 1.6, 2], r: 0.45 };
    const r = footAim({ cam, dir, from, targets: [behind], solids: noSolids, cone: ASSIST.mouse });
    expect(r.target).toBe(null);
    expect(r.ray.from[2]).toBeCloseTo(0, 6);
  });

  it('scales its reach and its least distance with the world', () => {
    const r = footAim({ cam, dir, from, targets: [], solids: noSolids, cone: ASSIST.mouse, range: 5 });
    expect(r.dist).toBeCloseTo(5, 6);
  });
});
