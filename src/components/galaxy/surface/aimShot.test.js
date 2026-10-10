import { describe, expect, it } from 'vitest';
import { aimDir, capsuleOf, lookFriction } from './aimShot';
import { createSolids } from './walker';
import { ASSIST } from '../../../lib/combat/aim';

const flat = { heightAt: () => 0 };
const hill = { heightAt: (x, z) => (z > 10 ? 5 : 0) }; // (a bank 10 m ahead)
const trooper = (x, z, extra = {}) => ({ holder: { position: { x, y: 0, z } }, fig: { tall: 1.8 }, hp: 3, ...extra });
// the camera 4 m behind a figure, at its shoulder, at the origin, looking down +z
const cam = { x: 0, y: 1.5, z: -4 };
const fwd = { x: 0, y: 0, z: 1 };
const muzzle = { x: -0.25, y: 1.35, z: 0.5 }; // (off to the side, as scene.js's is)

describe('aimShot', () => {
  it('a capsule stands from near the feet to near the head', () => {
    const c = capsuleOf(trooper(3, 4));
    expect(c.a[1]).toBeGreaterThan(0);
    expect(c.b[1]).toBeLessThan(1.8);
    expect(c.a[0]).toBe(3);
  });

  it('the muzzle aims at what the crosshair is on, not along the camera', () => {
    const d = aimDir({ cam, dir: fwd, from: muzzle, targets: [trooper(0, 20)], world: flat, cone: null });
    // from x −0.25 to the trooper at x 0: turned in a little to the right
    expect(d[0]).toBeGreaterThan(0);
    const at = [muzzle.x + d[0] * 19.5, muzzle.z + d[2] * 19.5];
    expect(Math.abs(at[0])).toBeLessThan(0.1);
  });

  it('the ground in the way is where it goes', () => {
    // (a bank rising 10 m out, in front of the trooper at 20: the nearer aim
    // turns the muzzle, off to the left, in more)
    const open = aimDir({ cam, dir: fwd, from: muzzle, targets: [trooper(0, 20)], world: flat, cone: null });
    const banked = aimDir({ cam, dir: fwd, from: muzzle, targets: [trooper(0, 20)], world: hill, cone: null });
    expect(banked[0]).toBeGreaterThan(open[0] * 1.5);
  });

  it('a wall in the way is where it goes, as for a bolt (solids.js)', () => {
    const walled = { heightAt: () => 0, solids: createSolids(), floors: [] };
    walled.solids.box(0, 10, 4, 0.5);
    const open = aimDir({ cam, dir: fwd, from: muzzle, targets: [trooper(0, 20)], world: flat, cone: null });
    const blocked = aimDir({ cam, dir: fwd, from: muzzle, targets: [trooper(0, 20)], world: walled, cone: null });
    // (the muzzle's off to the left: aiming at the nearer wall turns it in more)
    expect(blocked[0]).toBeGreaterThan(open[0] * 1.5);
  });

  it('a target that is down or gone is not aimed at', () => {
    const d = aimDir({ cam, dir: { x: 0.03, y: 0, z: 1 }, from: { x: 0, y: 1.35, z: 0 }, targets: [trooper(0, 20, { hp: 0 })], world: flat, cone: ASSIST.touch });
    expect(d[0]).toBeGreaterThan(0.02);
  });

  it('friction slows the look over a target and not off it', () => {
    expect(lookFriction({ cam, dir: fwd, targets: [trooper(0, 20)], cone: ASSIST.mouse })).toBeLessThan(1);
    expect(lookFriction({ cam, dir: fwd, targets: [trooper(8, 20)], cone: ASSIST.mouse })).toBe(1);
  });

  it('a touch tap snaps onto a trooper anywhere in the touch cone', () => {
    // 0.19 rad off the ray (which starts level with the figure): the plain pull barely moves it
    const t = trooper(Math.tan(0.19) * 20, 20);
    const d = aimDir({ cam, dir: fwd, from: muzzle, targets: [t], world: flat, cone: ASSIST.touch });
    const at = [muzzle.x + (d[0] * (20 - muzzle.z)) / d[2], 20];
    expect(Math.abs(at[0] - t.holder.position.x)).toBeLessThan(0.5);
    // (a mouse's cone doesn't reach it)
    const m = aimDir({ cam, dir: fwd, from: muzzle, targets: [t], world: flat, cone: ASSIST.mouse });
    expect(Math.abs(muzzle.x + (m[0] * (20 - muzzle.z)) / m[2] - t.holder.position.x)).toBeGreaterThan(2);
  });
});
