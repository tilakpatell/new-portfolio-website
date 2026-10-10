import { describe, expect, it } from 'vitest';
import book from '../../data/bf2017/physics/soldier.json';
import { createPhysics } from './world';
import { CHARACTER, createCharacter } from './character';
import { GRAVITY, accelFor, controllerOptions, eyeFor, jumpSpeed, poseFor, slideOn, speedFor } from './soldier';

const row = book.rows[book.default];
const hero = book.rows.DefaultHeroPhysics;
const STEP = 1 / 60;
const normalAt = (deg) => [Math.sin((deg * Math.PI) / 180), Math.cos((deg * Math.PI) / 180), 0];

describe('controllerOptions', () => {
  it('gives the capsule’s half-length, not its height', () => {
    const stand = controllerOptions(row);
    expect(stand.radius).toBe(0.3);
    expect(stand.halfHeight).toBeCloseTo(0.55, 6);
    expect(controllerOptions(row, 'crouch').halfHeight).toBeCloseTo(0.275, 6);
  });

  it('carries the step, the slopes, the snap and the mass', () => {
    const o = controllerOptions(row);
    expect(o.step).toEqual({ height: 0.4, minWidth: 0.2 });
    expect(controllerOptions(row, 'crouch').step.height).toBe(0.3);
    expect(o.slope).toEqual({ climb: 45, slide: 45 });
    expect(o.snap).toBe(0.8);
    expect(o.gravity).toBe(GRAVITY);
    expect(o.mass).toBe(100);
  });
});

describe('speedFor', () => {
  it('walks, sprints, backs and strafes at the ground state’s numbers', () => {
    expect(speedFor(row, { dir: { x: 0, y: 1 } })).toBeCloseTo(3.8, 6);
    expect(speedFor(row, { dir: { x: 0, y: 1 }, sprint: true })).toBeCloseTo(3.8 * 1.57, 6);
    expect(speedFor(row, { dir: { x: 0, y: -1 } })).toBeCloseTo(3.8 * 0.8, 6);
    expect(speedFor(row, { dir: { x: 0, y: -1 }, sprint: true })).toBeCloseTo(3.8 * 0.8, 6);
    expect(speedFor(row, { dir: { x: 1, y: 0 } })).toBeCloseTo(3.8 * 0.9, 6);
    expect(speedFor(row, { pose: 'crouch', dir: { x: 0, y: 1 } })).toBeCloseTo(2.5, 6);
    expect(speedFor(row, { pose: 'crouch', dir: { x: 0, y: 1 }, sprint: true })).toBeCloseTo(2.5, 6);
  });

  it('a half stick is half the speed; none is still', () => {
    expect(speedFor(row, { dir: { x: 0, y: 0.5 } })).toBeCloseTo(1.9, 6);
    expect(speedFor(row, { dir: { x: 0, y: 0 } })).toBe(0);
  });

  it('a hero walks faster than a soldier', () => {
    expect(speedFor(hero, { dir: { x: 0, y: 1 } })).toBeCloseTo(4.5, 6);
  });
});

describe('accelFor', () => {
  it('a stop is a frame or two and never a reversal', () => {
    let v = { x: 0, z: 3.8 * 1.57 };
    const seen = [];
    for (let i = 0; i < 6; i++) {
      v = accelFor(row, 'stand', { x: 0, z: 0 }, v, STEP);
      seen.push(v.z);
    }
    expect(seen[2]).toBe(0);
    expect(seen.every((z) => z >= 0)).toBe(true);
    expect(seen.slice(2).every((z) => z === 0)).toBe(true);
  });

  it('speeds up by the gain, never past the wanted speed', () => {
    let v = { x: 0, z: 0 };
    v = accelFor(row, 'stand', { x: 0, z: 3.8 }, v, STEP);
    expect(v.z).toBeCloseTo(3.8 * 0.4 * 0.5, 6);
    for (let i = 0; i < 60; i++) v = accelFor(row, 'stand', { x: 0, z: 3.8 }, v, STEP);
    expect(v.z).toBeLessThanOrEqual(3.8);
    expect(v.z).toBeGreaterThan(3.79);
  });
});

describe('poseFor', () => {
  it('a crouch asked at 0 is a stand until its transition time', () => {
    let s = poseFor(row, null, 'crouch', 0);
    expect(s.pose).toBe('stand');
    s = poseFor(row, s, 'crouch', 0.19);
    expect(s.pose).toBe('stand');
    s = poseFor(row, s, 'crouch', 0.2);
    expect(s).toEqual({ pose: 'crouch', next: null, until: 0 });
  });

  it('a change of mind before it lands keeps the pose', () => {
    let s = poseFor(row, null, 'crouch', 0);
    s = poseFor(row, s, 'stand', 0.1);
    expect(s).toEqual({ pose: 'stand', next: null, until: 0 });
  });
});

describe('the rest', () => {
  it('slides on a slope over the slide angle', () => {
    expect(slideOn(row, normalAt(50))).toBe(true);
    expect(slideOn(row, normalAt(40))).toBe(false);
  });

  it('the eye is over the shoulder', () => {
    expect(eyeFor(row)).toEqual([-0.15, 1.55, 0]);
    expect(eyeFor(row, 'crouch')[1]).toBe(1);
  });

  it('the jump reaches the record’s height, or the site’s speed', () => {
    const v = jumpSpeed(row);
    expect((v * v) / (2 * GRAVITY)).toBeCloseTo(1.1, 6);
    expect(jumpSpeed(hero)).toBe(5.4);
  });
});

describe('against the engine', () => {
  // a beam 1.3 m over the ground, from x 1.5 to 2.5; walk at it in a pose
  async function underBeam(pose) {
    const p = await createPhysics({ gravity: -GRAVITY });
    p.add({ type: 'fixed', position: [0, -0.5, 0], group: 'floor', colliders: [{ shape: 'cuboid', args: [50, 0.5, 50] }] });
    p.add({ type: 'fixed', position: [2, 1.3 + 0.25, 0], group: 'object', colliders: [{ shape: 'cuboid', args: [0.5, 0.25, 3] }] });
    const o = controllerOptions(row, pose);
    const c = createCharacter(p, { position: [0, o.halfHeight + o.radius + CHARACTER.offset, 0], ...o });
    const off = p.onSubstep((dt) => c.move({ vel: { x: 2, z: 0 }, face: null }, dt));
    for (let i = 0; i < 120; i++) p.step(STEP);
    off();
    const x = c.position()[0];
    p.dispose();
    return x;
  }

  it('a crouch passes under a 1.3 m beam and a stand does not', async () => {
    expect(await underBeam('crouch')).toBeGreaterThan(3);
    expect(await underBeam('stand')).toBeLessThan(1.5);
  });
});
