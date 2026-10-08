import { describe, expect, it } from 'vitest';
import { aimDir, capsuleOf, groundSolids, lookFriction } from './aimShot';
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
    expect(groundSolids(hill)([0, 2, 0], [0, 2, 30]).at[2]).toBeCloseTo(11, 0);
    const d = aimDir({ cam, dir: fwd, from: muzzle, targets: [trooper(0, 20)], world: hill, cone: null });
    expect(d[1]).toBeLessThan(0.3);
  });

  it('a target that is down or gone is not aimed at', () => {
    const d = aimDir({ cam, dir: { x: 0.03, y: 0, z: 1 }, from: { x: 0, y: 1.35, z: 0 }, targets: [trooper(0, 20, { hp: 0 })], world: flat, cone: ASSIST.touch });
    expect(d[0]).toBeGreaterThan(0.02);
  });

  it('friction slows the look over a target and not off it', () => {
    expect(lookFriction({ cam, dir: fwd, targets: [trooper(0, 20)], cone: ASSIST.mouse })).toBeLessThan(1);
    expect(lookFriction({ cam, dir: fwd, targets: [trooper(8, 20)], cone: ASSIST.mouse })).toBe(1);
  });
});
