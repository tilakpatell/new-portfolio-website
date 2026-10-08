// The physics library's failure cases, one each (the audit's repros: R for
// the world, P for props, V for the car), so none comes back.
import { describe, expect, it } from 'vitest';
import { createPhysics } from './world';
import { addProps } from './props';
import { addHeightfield } from './heightfield';
import { addVehicle } from './vehicle';

const flat = (p, x = -32, z = -32) => addHeightfield(p, { heights: new Float32Array(65 * 65), x, z });
const ball = (p, at, more = {}) => p.add({ position: at, colliders: [{ shape: 'ball', args: [0.5] }], ...more });
const ground = (p) => p.add({ type: 'fixed', position: [0, -0.5, 0], group: 'floor', colliders: [{ shape: 'cuboid', args: [20, 0.5, 20] }] });

describe('world robustness', () => {
  it('R1 a NaN or missing dt does not stop the clock', async () => {
    const p = await createPhysics();
    p.step(NaN);
    p.step();
    expect(p.step(1 / 60)).toBe(1);
    p.dispose();
  });
  it('R2 maxSubsteps NaN/Infinity still caps a long pause', async () => {
    const p = await createPhysics({ maxSubsteps: NaN });
    expect(p.step(5)).toBeLessThanOrEqual(4);
    p.dispose();
  });
  it('R3 reset() after remove() leaves the world alive', async () => {
    const p = await createPhysics();
    const b = ball(p, [0, 2, 0]);
    p.remove(b);
    expect(() => b.reset()).not.toThrow();
    expect(() => p.step(1 / 60)).not.toThrow();
    expect(() => ball(p, [0, 2, 0])).not.toThrow();
    p.dispose();
  });
  it('R4 an onHit that removes its own body leaves the world alive', async () => {
    const p = await createPhysics();
    // the ball first, so its collider is collider1 and its onHit runs before the ground's (which reads its position)
    const a = ball(p, [0, 2, 0], { hitThreshold: 0, onHit: () => p.remove(a) });
    p.add({ type: 'fixed', position: [0, -0.5, 0], group: 'floor', onHit: () => {}, hitThreshold: 0, colliders: [{ shape: 'cuboid', args: [5, 0.5, 5] }] });
    for (let i = 0; i < 120; i++) try { p.step(1 / 60); } catch { /* (it may throw; the world must live) */ }
    expect(() => ball(p, [3, 2, 0])).not.toThrow();
    expect(() => p.dispose()).not.toThrow();
  });
  it('R5 an onHit that throws is reported, not swallowed', async () => {
    const seen = [];
    const p = await createPhysics({ onError: (e) => seen.push(e) });
    ground(p);
    ball(p, [0, 2, 0], { hitThreshold: 0, onHit: () => { throw new Error('boom'); } });
    for (let i = 0; i < 120 && !seen.length; i++) p.step(1 / 60);
    expect(seen[0]?.message).toBe('boom');
    p.dispose();
  });
  it('R6a step() from inside a substep hook is refused (one level), the world lives', async () => {
    const seen = [];
    const p = await createPhysics({ onError: (e) => seen.push(e) });
    ground(p);
    let once = false;
    let inner = null;
    const off = p.onSubstep(() => { if (once) return; once = true; inner = p.step(1 / 60); });
    expect(p.step(1 / 60)).toBe(1);
    expect(inner).toBe(null);
    expect(String(seen[0])).toMatch(/inside/i);
    off();
    expect(() => p.step(1 / 60)).not.toThrow();
    p.dispose();
  });
  it('R6b step() from inside onHit is refused, the world lives', async () => {
    const p = await createPhysics();
    ground(p);
    let once = false;
    ball(p, [0, 2, 0], { hitThreshold: 0, onHit: () => { if (once) return; once = true; try { p.step(1 / 60); } catch { /* (it may throw; the world must live) */ } } });
    for (let i = 0; i < 120; i++) try { p.step(1 / 60); } catch { /* (it may throw; the world must live) */ }
    expect(() => ball(p, [3, 2, 0])).not.toThrow();
    expect(() => p.step(1 / 60)).not.toThrow();
    p.dispose();
  });
  it('R7 dispose twice; step/add after dispose are no-ops or clear errors', async () => {
    const p = await createPhysics();
    p.dispose();
    expect(() => p.dispose()).not.toThrow();
    expect(() => p.step(1 / 60)).not.toThrow();
  });
  it('R8 a failed add leaves no orphan body', async () => {
    const p = await createPhysics();
    expect(() => p.add({ colliders: [{ shape: 'hull', args: [new Float32Array([0, 0, 0, 1, 0, 0, 2, 0, 0])] }] })).toThrow();
    expect(p.world.bodies.len()).toBe(0);
    p.dispose();
  });
  it('R9 an unknown group is an error, not a collider that meets nothing', async () => {
    const p = await createPhysics();
    expect(() => p.add({ group: 'flor', colliders: [{ shape: 'ball', args: [1] }] })).toThrow();
    p.dispose();
  });
  it('R10 onHit force does not depend on whether the ground is a cuboid or a heightfield', async () => {
    const first = async (mk) => {
      const p = await createPhysics();
      mk(p);
      let f = null;
      ball(p, [0, 5, 0], { hitThreshold: 0, onHit: (force) => (f ??= force) });
      for (let i = 0; i < 120; i++) p.step(1 / 60);
      p.dispose();
      return f;
    };
    const a = await first(ground);
    const b = await first((p) => flat(p));
    expect(a / b).toBeGreaterThan(0.5);
    expect(a / b).toBeLessThan(2);
  });
  it('R11 onHit at is near the contact, not the heightfield body centre', async () => {
    const p = await createPhysics();
    flat(p);
    let at = null;
    ball(p, [10, 3, 10], { hitThreshold: 0, onHit: (f, a) => (at ??= a) });
    for (let i = 0; i < 90; i++) p.step(1 / 60);
    expect(Math.hypot(at[0] - 10, at[2] - 10)).toBeLessThan(1.5);
    p.dispose();
  });
  it('R12 reset() keeps a body made disabled disabled', async () => {
    const p = await createPhysics();
    const b = ball(p, [0, 9, 0], { enabled: false });
    b.reset();
    p.step(1 / 60);
    expect(b.body.isEnabled()).toBe(false);
    p.dispose();
  });
  it('R13 desc.mass is the body mass even with a collider of its own mass', async () => {
    const p = await createPhysics();
    const b = p.add({ mass: 1, colliders: [{ shape: 'ball', args: [0.5], mass: 0.5 }, { shape: 'ball', args: [0.5], position: [1, 0, 0] }, { shape: 'ball', args: [0.5], position: [-1, 0, 0] }] });
    expect(b.body.mass()).toBeCloseTo(1, 3);
    p.dispose();
  });
  it('R14 sleepOutside leaves a canSleep:false body (the car) moving', async () => {
    const p = await createPhysics({ gravity: 0 });
    const car = ball(p, [100, 0, 0], { canSleep: false });
    car.body.setLinvel({ x: 5, y: 0, z: 0 }, true);
    p.sleepOutside([0, 0, 0], 10);
    expect(car.body.linvel().x).toBeCloseTo(5, 3);
    p.dispose();
  });
  it('R15 bodies placed asleep on the ground are still asleep after the first step', async () => {
    const p = await createPhysics();
    flat(p);
    const c = p.add({ position: [5, 0.5, 0], sleeping: true, mass: 0.02, colliders: [{ shape: 'cuboid', args: [0.5, 0.5, 0.5] }] });
    p.step(1 / 60);
    expect(c.sleeping).toBe(true);
    p.dispose();
  });
  it('R16 a heightfield can fix its internal edges (a sliding crate does not hop)', async () => {
    const p = await createPhysics();
    flat(p, -40, -32);
    const c = p.add({ position: [-4, 0.5, 0.3], canSleep: false, mass: 0.02, friction: 0, colliders: [{ shape: 'cuboid', args: [0.5, 0.5, 0.5] }] });
    c.body.setLinvel({ x: 8, y: 0, z: 0 }, true);
    let mv = 0;
    for (let i = 0; i < 90; i++) { p.step(1 / 60); mv = Math.max(mv, Math.abs(c.body.linvel().y)); }
    expect(mv).toBeLessThan(0.2);
    p.dispose();
  });
  it('R17 a removed body\'s handle says so instead of trapping', async () => {
    const p = await createPhysics();
    const b = ball(p, [0, 2, 0]);
    p.remove(b);
    expect(() => b.position()).not.toThrow();
    expect(() => p.step(1 / 60)).not.toThrow();
    p.dispose();
  });
});

describe('more of the world', () => {
  it('says how far into the next step it is, for drawing between steps', async () => {
    const p = await createPhysics();
    p.step(1 / 120);
    expect(p.alpha).toBeCloseTo(0.5, 5);
    p.step(1 / 60);
    expect(p.alpha).toBeCloseTo(0.5, 5);
    p.step(60);
    expect(p.alpha).toBe(0);
    p.dispose();
  });
  it('refuses a moving body made of a triangle mesh (it falls through the ground)', async () => {
    const p = await createPhysics();
    const v = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const i = new Uint32Array([0, 1, 2]);
    expect(() => p.add({ colliders: [{ shape: 'trimesh', args: [v, i] }] })).toThrow(/hull/);
    expect(() => p.add({ type: 'fixed', colliders: [{ shape: 'trimesh', args: [v, i] }] })).not.toThrow();
    expect(p.world.bodies.len()).toBe(1);
    p.dispose();
  });
  it('checks a heightfield has all its heights', async () => {
    const p = await createPhysics();
    expect(() => addHeightfield(p, { heights: new Float32Array(10) })).toThrow(/heights/);
    const h = new Float32Array(65 * 65);
    h[7] = NaN;
    expect(() => addHeightfield(p, { heights: h })).toThrow(/heights/);
    expect(p.world.bodies.len()).toBe(0);
    p.dispose();
  });
  it('tells whoever asks when the origin moves', async () => {
    const p = await createPhysics();
    const seen = [];
    const off = p.onOriginShift((s) => seen.push(s));
    p.onOrigin([64, 0, 0]);
    off();
    p.onOrigin([64, 0, 0]);
    expect(seen).toEqual([[64, 0, 0]]);
    p.dispose();
  });
});

describe('props robustness', () => {
  it('P1 a hull kind can be scaled', async () => {
    const p = await createPhysics();
    const pts = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1]);
    const props = addProps(p, [{ kind: 'h', x: 0, y: 0, z: 0, scale: 2 }], { h: { type: 'dynamic', mass: 0.1, lift: 0, colliders: [{ shape: 'hull', args: [pts] }] } });
    expect(props.bodies).toHaveLength(1);
    p.dispose();
  });
  it('P2 a scaled kind scales its colliders\' offsets too', async () => {
    const p = await createPhysics();
    const props = addProps(p, [{ kind: 'lamp', x: 0, y: 0, z: 0, scale: 2 }], { lamp: { type: 'fixed', lift: 0, colliders: [{ shape: 'cylinder', args: [1, 0.1], position: [0, 1, 0] }, { shape: 'ball', args: [0.3], position: [0, 2.1, 0] }] } });
    expect(props.bodies[0].colliders[1].translation().y).toBeCloseTo(4.2, 3);
    p.dispose();
  });
  it('P3 a kind\'s onHit, restitution and damping reach the body', async () => {
    const p = await createPhysics();
    const onHit = () => {};
    const props = addProps(p, [{ kind: 'c', x: 0, y: 0, z: 0 }], { c: { type: 'dynamic', mass: 0.1, lift: 0.5, restitution: 0.6, linearDamping: 0.5, onHit, colliders: [{ shape: 'cuboid', args: [0.5, 0.5, 0.5] }] } });
    expect(props.bodies[0].onHit).toBe(onHit);
    expect(props.bodies[0].colliders[0].restitution()).toBeCloseTo(0.6, 5);
    expect(props.bodies[0].body.linearDamping()).toBeCloseTo(0.5, 5);
    p.dispose();
  });
  it('P4 reset of a prop whose start touches nothing is written once by sync', async () => {
    const p = await createPhysics();
    const props = addProps(p, [{ kind: 'crate', x: 5, y: 1, z: 5, yaw: 0, scale: 1 }]);
    props.wake(0);
    for (let i = 0; i < 30; i++) p.step(1 / 60);
    props.reset();
    p.step(1 / 60);
    p.step(1 / 60);
    const writes = [];
    props.sync((i, pos) => writes.push([...pos]));
    expect(writes).toEqual([[5, 1.5, 5]]);
    p.dispose();
  });
});

describe('vehicle robustness', () => {
  it('V1 an origin shift does not spike the car\'s speed', async () => {
    const p = await createPhysics();
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) flat(p, i * 64 - 32, j * 64 - 32);
    const car = addVehicle(p);
    car.moveTo(0, 3, 0, 0);
    const run = (n, input = {}) => { for (let i = 0; i < n; i++) { car.drive({ throttle: 0, ...input }, 1 / 60); p.step(1 / 60); car.measure(); } };
    run(120);
    run(60, { throttle: 1 });
    p.onOrigin([50, 0, 0]);
    run(1, { throttle: 1 });
    expect(car.state.speed).toBeLessThan(10);
    expect(car.state.goingForward).toBe(true);
    p.dispose();
  });
  it('V2 removing the chassis under a live controller does not kill the world', async () => {
    const p = await createPhysics();
    flat(p);
    const car = addVehicle(p);
    p.remove(car.chassis);
    expect(() => p.step(1 / 60)).not.toThrow();
    p.dispose();
  });
  it('V3 car.remove() after physics.dispose() is a no-op', async () => {
    const p = await createPhysics();
    const car = addVehicle(p);
    p.dispose();
    expect(() => car.remove()).not.toThrow();
  });
  it('V4 the chassis can carry an onHit (spec: a crate hit fires it)', async () => {
    const p = await createPhysics();
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) flat(p, i * 64 - 32, j * 64 - 32);
    let hit = 0;
    const car = addVehicle(p, undefined, { onHit: () => hit++, hitThreshold: 5 });
    car.moveTo(0, 3, 0, 0);
    addProps(p, [{ kind: 'crate', x: 8, y: 0, z: 0, yaw: 0, scale: 1 }]);
    for (let i = 0; i < 240; i++) { car.drive({ throttle: 1 }, 1 / 60); p.step(1 / 60); car.measure(); }
    expect(hit).toBeGreaterThan(0);
    p.dispose();
  });
  it('V5 flipped is computed, and it unflips itself after unflip.after seconds upside down', async () => {
    const p = await createPhysics();
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) flat(p, i * 64 - 32, j * 64 - 32);
    const car = addVehicle(p);
    car.moveTo(0, 2, 0, 0);
    car.chassis.body.setRotation({ x: 1, y: 0, z: 0, w: 0 }, true);
    let upright = false;
    for (let i = 0; i < 60 * 6 && !upright; i++) { car.drive({}, 1 / 60); p.step(1 / 60); car.measure(); upright = i > 60 && !car.state.upsideDown; }
    expect(upright).toBe(true);
    p.dispose();
  });
});
