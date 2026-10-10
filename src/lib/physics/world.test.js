import { beforeAll, describe, expect, it, vi } from 'vitest';
import { GROUPS, createPhysics } from './world';

let physics;
beforeAll(async () => {
  physics = await createPhysics();
});

const ground = (p, at = [0, -0.5, 0], group = 'floor') => p.add({ type: 'fixed', position: at, group, colliders: [{ shape: 'cuboid', args: [20, 0.5, 20] }] });
const ball = (p, at, more = {}) => p.add({ position: at, colliders: [{ shape: 'ball', args: [0.5] }], ...more });

describe('createPhysics', () => {
  it('loads the engine and has his groups', () => {
    expect(physics.RAPIER).toBeTruthy();
    expect(physics.world).toBeTruthy();
    // (his values plus the character bit in the floor's and the object's filter: groups.js)
    expect(GROUPS.floor).toBe((1 << 16) | 9);
    expect(GROUPS.object).toBe((3 << 16) | 13);
    expect(GROUPS.bumper).toBe((4 << 16) | 2);
  });

  it('brings a ball to rest on the ground', async () => {
    const p = await createPhysics();
    ground(p);
    const b = ball(p, [0, 3, 0]);
    for (let i = 0; i < 120; i++) p.step(1 / 60);
    expect(Math.abs(b.body.linvel().y)).toBeLessThan(0.01);
    expect(b.position()[1]).toBeCloseTo(0.5, 1);
    p.dispose();
  });

  it('steps fixed, at most maxSubsteps after a long pause', async () => {
    const p = await createPhysics();
    expect(p.step(60)).toBe(4);
    expect(p.step(1 / 120)).toBe(0);
    expect(p.step(1 / 120)).toBe(1);
    expect(p.step(1 / 60)).toBe(1);
    p.dispose();
    const slow = await createPhysics({ timeScale: 0.5 });
    expect(slow.step(1 / 60)).toBe(0);
    expect(slow.step(1 / 60)).toBe(1);
    slow.dispose();
  });

  it('runs its substep hooks before each substep', async () => {
    const p = await createPhysics();
    const seen = [];
    const off = p.onSubstep((dt) => seen.push(dt));
    p.step(3 / 60);
    expect(seen).toHaveLength(3);
    expect(seen[0]).toBeCloseTo(1 / 60, 9);
    off();
    p.step(1 / 60);
    expect(seen).toHaveLength(3);
    p.dispose();
  });

  it('moves every body by an origin shift, keeping their velocities', async () => {
    const p = await createPhysics();
    const b = ball(p, [10, 5, 0], { canSleep: false });
    b.body.setLinvel({ x: 3, y: 1, z: -2 }, true);
    const before = b.position()[0];
    const v = b.body.linvel();
    p.onOrigin([50000, 0, 0]);
    expect(b.position()[0]).toBeCloseTo(before - 50000, 3);
    expect(b.body.linvel()).toEqual(v);
    p.dispose();
  });

  it('lets a bumper through the floor and onto an object', async () => {
    const p = await createPhysics();
    ground(p, [0, -0.5, 0], 'floor');
    ground(p, [0, -10.5, 0], 'object');
    const b = ball(p, [0, 2, 0], { group: 'bumper' });
    for (let i = 0; i < 240; i++) p.step(1 / 60);
    expect(b.position()[1]).toBeCloseTo(-9.5, 1);
    p.dispose();
  });

  it('resets a body to where it began, asleep if it began asleep', async () => {
    const p = await createPhysics();
    ground(p);
    const b = ball(p, [0, 4, 0], { sleeping: true });
    expect(b.sleeping).toBe(true);
    b.body.wakeUp();
    for (let i = 0; i < 30; i++) p.step(1 / 60);
    expect(b.position()[1]).toBeLessThan(4);
    b.reset();
    p.step(1 / 60);
    p.step(1 / 60);
    expect(b.position()).toEqual([0, 4, 0]);
    expect(b.sleeping).toBe(true);
    p.dispose();
  });

  it('puts awake bodies far away to sleep', async () => {
    const p = await createPhysics();
    const far = ball(p, [100, 50, 0]);
    const near = ball(p, [10, 50, 0]);
    p.step(1 / 60);
    p.sleepOutside([0, 0, 0], 50);
    expect(far.sleeping).toBe(true);
    expect(near.sleeping).toBe(false);
    p.dispose();
  });

  it('calls onHit over its threshold, with the force by mass', async () => {
    for (const [threshold, want] of [[0, true], [1e6, false]]) {
      const p = await createPhysics();
      ground(p);
      let hit = null;
      ball(p, [0, 5, 0], { hitThreshold: threshold, onHit: (force, at) => (hit ??= { force, at }) });
      for (let i = 0; i < 120; i++) p.step(1 / 60);
      expect(hit !== null).toBe(want);
      if (want) {
        expect(hit.force).toBeGreaterThan(0);
        expect(hit.at).toHaveLength(3);
      }
      p.dispose();
    }
  });

  it('removes a body', async () => {
    const p = await createPhysics();
    const b = ball(p, [0, 5, 0]);
    expect(p.world.bodies.len()).toBe(1);
    p.remove(b);
    expect(p.world.bodies.len()).toBe(0);
    p.dispose();
  });
});

describe('createPhysics, when things go wrong', () => {
  it('shrugs off a bad frame time and keeps stepping', async () => {
    const p = await createPhysics();
    expect(p.step(NaN)).toBe(0);
    expect(p.step(-1)).toBe(0);
    expect(p.step(undefined)).toBe(0);
    expect(p.step(1 / 60)).toBe(1);
    p.dispose();
  });

  it('can be disposed twice, and does nothing after', async () => {
    const p = await createPhysics();
    const b = ball(p, [0, 1, 0]);
    p.dispose();
    expect(() => p.dispose()).not.toThrow();
    expect(p.step(1 / 60)).toBe(0);
    expect(() => p.add({ colliders: [{ shape: 'ball', args: [1] }] })).toThrow(/disposed/);
    expect(() => p.remove(b)).not.toThrow();
    expect(p.disposed).toBe(true);
  });

  it('keeps stepping and drains every hit when one onHit throws', async () => {
    const errors = [];
    const p = await createPhysics({ onError: (e) => errors.push(e) });
    ground(p);
    let bad = 0;
    let good = 0;
    ball(p, [-3, 2, 0], { hitThreshold: 0, onHit: () => (bad++, (() => { throw new Error('boom'); })()) });
    ball(p, [3, 2, 0], { hitThreshold: 0, onHit: () => good++ });
    for (let i = 0; i < 90; i++) expect(p.step(1 / 60)).toBe(1);
    expect(bad).toBeGreaterThan(1);
    expect(good).toBeGreaterThan(1);
    expect(errors.length).toBe(bad);
    expect(String(errors[0])).toMatch(/boom/);
    p.dispose();
  });

  it('keeps stepping when a substep hook or the lost test throws', async () => {
    const errors = [];
    const p = await createPhysics({ onError: (e) => errors.push(e), lost: () => { throw new Error('lost?'); } });
    ball(p, [0, 5, 0], { canSleep: false });
    let ran = 0;
    p.onSubstep(() => { throw new Error('hook'); });
    p.onSubstep(() => ran++);
    expect(p.step(3 / 60)).toBe(3);
    expect(ran).toBe(3);
    expect(errors.map(String).join()).toMatch(/hook/);
    expect(errors.map(String).join()).toMatch(/lost\?/);
    p.dispose();
  });

  it('removes a body from inside its own onHit without breaking the step', async () => {
    const p = await createPhysics({ onError: (e) => { throw e; } });
    ground(p);
    let b = null;
    b = ball(p, [0, 2, 0], { hitThreshold: 0, onHit: () => p.remove(b) });
    for (let i = 0; i < 90; i++) p.step(1 / 60);
    expect(b.removed).toBe(true);
    expect(p.world.bodies.len()).toBe(1); // (the ground)
    p.dispose();
  });

  it('adds nothing when a body is described wrong', async () => {
    const p = await createPhysics();
    expect(() => p.add({ colliders: [{ shape: 'nope' }] })).toThrow(/shape/);
    expect(() => p.add({ position: [0, NaN, 0], colliders: [{ shape: 'ball', args: [1] }] })).toThrow(/position/);
    expect(() => p.add({ type: 'floaty', colliders: [{ shape: 'ball', args: [1] }] })).toThrow(/type/);
    expect(() => p.add({ group: 'wall', colliders: [{ shape: 'ball', args: [1] }] })).toThrow(/group/);
    expect(() => p.add({ colliders: [{ shape: 'hull', args: [new Float32Array([0, 0, 0, 0, 0, 0, 0, 0, 0])] }] })).toThrow(/hull/);
    expect(() => p.add({ colliders: [{ shape: 'ball', args: [1] }, { shape: 'nope' }] })).toThrow(/shape/);
    expect(p.world.bodies.len()).toBe(0);
    expect(p.world.colliders.len()).toBe(0);
    p.dispose();
  });

  it('answers with the last place it was once a body is gone', async () => {
    const p = await createPhysics();
    const b = ball(p, [1, 2, 3]);
    p.remove(b);
    expect(b.removed).toBe(true);
    expect(b.position()).toEqual([1, 2, 3]);
    expect(b.quaternion()).toEqual([0, 0, 0, 1]);
    expect(b.sleeping).toBe(true);
    expect(() => b.reset()).not.toThrow();
    expect(() => p.remove(b)).not.toThrow();
    p.dispose();
  });

  it('puts back a body that is lost, or whose numbers have gone bad', async () => {
    const p = await createPhysics({ lost: ([, y]) => y < -20 });
    const fell = ball(p, [0, 0, 0]);
    for (let i = 0; i < 180; i++) p.step(1 / 60);
    expect(fell.position()[1]).toBeGreaterThan(-20);
    expect(fell.resets).toBeGreaterThan(0);
    const bad = ball(p, [5, 0, 0], { canSleep: false });
    p.step(1 / 60);
    bad.body.setLinvel({ x: NaN, y: 0, z: 0 }, true);
    p.step(1 / 60);
    p.step(1 / 60);
    expect(bad.position().every(Number.isFinite)).toBe(true);
    expect(bad.resets).toBeGreaterThan(0);
    p.dispose();
  });

  it('brings back a body the engine turned off, but not one turned off on purpose', async () => {
    const p = await createPhysics();
    const quiet = ball(p, [0, 10, 0], { canSleep: false });
    const off = ball(p, [5, 10, 0], { canSleep: false });
    p.step(1 / 60);
    quiet.body.setEnabled(false); // (as Rapier does to a body whose numbers went bad mid-step)
    off.enable(false);
    for (let i = 0; i < 61; i++) p.step(1 / 60);
    expect(quiet.body.isEnabled()).toBe(true);
    expect(quiet.resets).toBe(1);
    expect(off.body.isEnabled()).toBe(false);
    expect(off.resets).toBe(0);
    off.enable(true);
    expect(off.body.isEnabled()).toBe(true);
    p.dispose();
  });

  it('holds every body under its speed limit', async () => {
    const p = await createPhysics({ maxSpeed: 30 });
    const b = ball(p, [0, 100, 0], { canSleep: false });
    b.body.applyImpulse({ x: 1e6, y: 0, z: 0 }, true);
    p.step(1 / 60);
    const v = b.body.linvel();
    expect(Math.hypot(v.x, v.y, v.z)).toBeLessThanOrEqual(30.001);
    p.dispose();
  });
});

describe('createPhysics, on a round planet', () => {
  const planet = (p, centre, r) => p.add({ type: 'fixed', position: centre, group: 'floor', colliders: [{ shape: 'ball', args: [r] }] });
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

  it('pulls toward the middle, wherever you are on it', async () => {
    const centre = [0, -100, 0];
    const p = await createPhysics({ gravity: { centre, g: 9.81 } });
    planet(p, centre, 100);
    const top = ball(p, [30, -3, 0]);
    const under = ball(p, [0, -205, 0]);
    for (let i = 0; i < 300; i++) p.step(1 / 60);
    expect(dist(top.position(), centre)).toBeCloseTo(100.5, 1);
    expect(dist(under.position(), centre)).toBeCloseTo(100.5, 1);
    // (and it stayed where it came down: straight down, not off sideways)
    const t = top.position();
    expect(Math.atan2(t[0], t[1] + 100)).toBeCloseTo(Math.atan2(30, 97), 1);
    p.dispose();
  });

  it('leaves sleepers asleep', async () => {
    const p = await createPhysics({ gravity: { centre: [0, -100, 0], g: 9.81 } });
    const b = ball(p, [0, 50, 0], { sleeping: true });
    for (let i = 0; i < 60; i++) p.step(1 / 60);
    expect(b.sleeping).toBe(true);
    expect(b.position()).toEqual([0, 50, 0]);
    p.dispose();
  });

  it('moves its middle with the origin', async () => {
    const p = await createPhysics({ gravity: { centre: [1000, -100, 0], g: 9.81 } });
    planet(p, [1000, -100, 0], 100);
    const b = ball(p, [1000, 3, 0]);
    p.onOrigin([1000, 0, 0]);
    for (let i = 0; i < 200; i++) p.step(1 / 60);
    expect(dist(b.position(), [0, -100, 0])).toBeCloseTo(100.5, 1);
    p.dispose();
  });
});

describe('sensors, tags and collision events', () => {
  const zoneAt = (p, at, on) => p.add({ type: 'fixed', position: at, group: 'zone', onEnter: on.enter, onLeave: on.leave, colliders: [{ shape: 'ball', args: [1], sensor: true, tag: 'bite' }] });
  const walker = (p, at) => p.add({ type: 'kinematicPositionBased', position: at, group: 'character', colliders: [{ shape: 'capsule', args: [0.6, 0.4] }] });
  const stroll = (p, w, from, to, steps = 20) => {
    for (let i = 1; i <= steps && !w.removed; i++) {
      const t = i / steps;
      w.body.setNextKinematicTranslation({ x: from[0] + (to[0] - from[0]) * t, y: from[1], z: from[2] });
      p.step(1 / 60);
    }
  };

  it('a sensor zone reports a kinematic capsule entering and leaving', async () => {
    const p = await createPhysics();
    ground(p);
    const enter = vi.fn();
    const leave = vi.fn();
    zoneAt(p, [0, 1, 0], { enter, leave });
    const w = walker(p, [-4, 1, 0]);
    p.step(1 / 60);
    stroll(p, w, [-4, 1, 0], [4, 1, 0]);
    expect(enter).toHaveBeenCalledTimes(1);
    expect(enter).toHaveBeenCalledWith(w, 'bite', null);
    expect(leave).toHaveBeenCalledTimes(1);
    expect(leave).toHaveBeenCalledWith(w, 'bite', null);
    expect(enter.mock.invocationCallOrder[0]).toBeLessThan(leave.mock.invocationCallOrder[0]);
    p.dispose();
  });

  it('a sensor zone never pushes the capsule', async () => {
    const p = await createPhysics();
    ground(p);
    zoneAt(p, [0, 1, 0], { enter: () => {}, leave: () => {} });
    const w = walker(p, [-4, 1, 0]);
    p.step(1 / 60);
    stroll(p, w, [-4, 1, 0], [0, 1, 0]);
    expect(w.position()[0]).toBeCloseTo(0, 5);
    p.dispose();
  });

  it('a throwing onEnter goes to onError and the step finishes', async () => {
    const errors = [];
    const p = await createPhysics({ onError: (e) => errors.push(e) });
    ground(p);
    const leave = vi.fn();
    zoneAt(p, [0, 1, 0], { enter: () => { throw new Error('bitten'); }, leave });
    const w = walker(p, [-4, 1, 0]);
    p.step(1 / 60);
    stroll(p, w, [-4, 1, 0], [4, 1, 0]);
    expect(errors.map((e) => e.message)).toEqual(['bitten']);
    expect(leave).toHaveBeenCalledTimes(1);
    p.dispose();
  });

  it('a body removed from inside onEnter is gone after the step', async () => {
    const p = await createPhysics();
    ground(p);
    const leave = vi.fn();
    zoneAt(p, [0, 1, 0], { enter: (other) => p.remove(other), leave });
    const w = walker(p, [-4, 1, 0]);
    p.step(1 / 60);
    const before = p.world.bodies.len();
    stroll(p, w, [-4, 1, 0], [4, 1, 0]);
    expect(w.removed).toBe(true);
    expect(p.world.bodies.len()).toBe(before - 1);
    expect(leave).not.toHaveBeenCalled();
    p.dispose();
  });

  it('tagOf gives a collider’s tag', async () => {
    const p = await createPhysics();
    const z = zoneAt(p, [0, 1, 0], { enter: () => {}, leave: () => {} });
    const w = walker(p, [-4, 1, 0]);
    expect(p.tagOf(z.colliders[0])).toBe('bite');
    expect(p.tagOf(w.colliders[0])).toBeNull();
    expect(p.tagOf(null)).toBeNull();
    p.dispose();
  });
});
