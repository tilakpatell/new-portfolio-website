import { beforeAll, describe, expect, it } from 'vitest';
import { createPhysics } from './world';
import { CHARACTER, createCharacter } from './character';

const STEP = 1 / 60;
let phys;
const stand = (c) => c.halfHeight + c.radius + CHARACTER.offset; // the capsule's centre, standing on y 0

const floor = (p) => p.add({ type: 'fixed', position: [0, -0.5, 0], group: 'floor', colliders: [{ shape: 'cuboid', args: [50, 0.5, 50] }] });
const box = (p, at, half, yaw = 0) => p.add({ type: 'fixed', position: at, rotation: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)], group: 'object', colliders: [{ shape: 'cuboid', args: half }] });
// a ramp: a cuboid tilted about z by `deg`, its top face rising along +x from `at`
const ramp = (p, at, deg) => {
  const a = (deg * Math.PI) / 180;
  return p.add({ type: 'fixed', position: at, rotation: [0, 0, Math.sin(a / 2), Math.cos(a / 2)], group: 'object', colliders: [{ shape: 'cuboid', args: [6, 0.2, 3] }] });
};
async function world() {
  const p = await createPhysics({ gravity: -CHARACTER.gravity });
  floor(p);
  return p;
}
const run = (p, c, intent, seconds) => {
  const off = p.onSubstep((dt) => c.move(intent, dt));
  for (let i = 0; i < Math.round(seconds / STEP); i++) p.step(STEP);
  off();
};
const walk = (x, z = 0) => ({ vel: { x, z }, face: null });
const STILL = walk(0);

beforeAll(async () => {
  phys = await world();
});

describe('createCharacter', () => {
  it('stands on the ground within a second', () => {
    const c = createCharacter(phys, { position: [0, 2, 0] });
    run(phys, c, STILL, 1);
    expect(c.grounded).toBe(true);
    expect(c.position()[1]).toBeCloseTo(stand(c), 1);
    c.remove();
  });

  it('walks at the asked speed', () => {
    const c = createCharacter(phys, { position: [0, 1, 0] });
    run(phys, c, STILL, 0.5);
    const x0 = c.position()[0];
    run(phys, c, walk(2), 1);
    expect(c.position()[0] - x0).toBeCloseTo(2, 1);
    expect(c.blocked).toBe(false);
    c.remove();
  });

  it('is stopped by a wall and blocked says so', async () => {
    const p = await world();
    box(p, [2, 1, 0], [0.1, 1, 3]);
    const c = createCharacter(p, { position: [0, 1, 0] });
    run(p, c, walk(2), 2);
    expect(c.position()[0]).toBeLessThan(1.7);
    expect(c.position()[0]).toBeGreaterThan(1.3);
    expect(c.blocked).toBe(true);
    p.dispose();
  });

  it('steps a 0.3 m kerb and not a 0.5 m one', async () => {
    const p = await world();
    box(p, [2, 0.15, 0], [0.5, 0.15, 3]);
    box(p, [5, 0.25, 0], [0.5, 0.25, 3]);
    const c = createCharacter(p, { position: [0, 1, 0] });
    run(p, c, walk(2), 1);
    expect(c.position()[0]).toBeCloseTo(2, 0);
    expect(c.position()[1]).toBeCloseTo(stand(c) + 0.3, 1);
    run(p, c, walk(2), 2);
    expect(c.position()[0]).toBeLessThan(4.7);
    p.dispose();
  });

  it('climbs 40° and slides on 65°', async () => {
    const p = await world();
    ramp(p, [3.3, 0, 0], 40);
    const c = createCharacter(p, { position: [2, 1, 0] });
    run(p, c, walk(3), 1.2);
    expect(c.position()[1]).toBeGreaterThan(stand(c) + 1);
    expect(c.position()[0]).toBeGreaterThan(4);
    p.dispose();
    const p2 = await world();
    ramp(p2, [3.3, 0, 0], 65);
    const d = createCharacter(p2, { position: [2, 1, 0] });
    run(p2, d, walk(3), 1.2);
    expect(d.position()[1]).toBeLessThan(stand(d) + 1);
    p2.dispose();
  });

  it('a jump leaves the ground and lands', () => {
    const c = createCharacter(phys, { position: [0, 1, 0] });
    run(phys, c, STILL, 1);
    const base = c.position()[1];
    let apex = base;
    let left = false;
    const off = phys.onSubstep((dt) => {
      c.move({ vel: { x: 0, z: 0 }, face: null, jump: left ? 0 : 5.4 }, dt);
      if (!c.grounded) left = true;
      apex = Math.max(apex, c.position()[1]);
    });
    for (let i = 0; i < 3; i++) phys.step(STEP);
    expect(c.grounded).toBe(false);
    for (let i = 0; i < 90; i++) phys.step(STEP);
    off();
    expect(c.grounded).toBe(true);
    expect(apex - base).toBeGreaterThan(0.6);
    expect(apex - base).toBeLessThan(1.2);
    c.remove();
  });

  it('a knock decays and slides along a wall', async () => {
    const p = await world();
    // a wall along z, its face turned 30° from the yz plane, a metre ahead
    box(p, [1.6, 1, 0], [0.1, 1, 6], Math.PI / 6);
    const c = createCharacter(p, { position: [0, 1, 0] });
    run(p, c, STILL, 0.5);
    c.knock([12, 0, 0]);
    run(p, c, STILL, 1);
    const [x, , z] = c.position();
    expect(x).toBeLessThan(1.6);
    expect(Math.abs(z)).toBeGreaterThan(0.3);
    expect(c.knockLeft()).toBeLessThan(0.1);
    p.dispose();
  });

  it('a figure placed inside a wall is pushed out on its first move', async () => {
    const p = await world();
    box(p, [0, 1, 0], [1, 1, 1]);
    const c = createCharacter(p, { position: [0.5, 1, 0] });
    run(p, c, STILL, 0.5);
    const [x, , z] = c.position();
    expect(Math.max(Math.abs(x), Math.abs(z))).toBeGreaterThan(1 + c.radius - 0.05);
    p.dispose();
  });

  it('prev and position differ by one substep’s motion', () => {
    const c = createCharacter(phys, { position: [0, 1, 0] });
    run(phys, c, STILL, 1);
    run(phys, c, walk(3), STEP);
    expect(c.position()[0] - c.prev()[0]).toBeCloseTo(3 * STEP, 3);
    c.remove();
  });

  it('face turns at most turn × dt a step', () => {
    const c = createCharacter(phys, { position: [0, 1, 0], turn: 2 });
    run(phys, c, { vel: { x: 0, z: 0 }, face: Math.PI / 2 }, STEP);
    expect(c.yaw).toBeCloseTo(2 * STEP, 5);
    run(phys, c, { vel: { x: 0, z: 0 }, face: Math.PI / 2 }, 2);
    expect(c.yaw).toBeCloseTo(Math.PI / 2, 3);
    const q = c.quaternion();
    expect(q[1]).toBeCloseTo(Math.sin(Math.PI / 4), 3);
    c.remove();
  });

  it('a walker pushes a dynamic crate', async () => {
    const p = await world();
    const crate = p.add({ position: [1.5, 0.5, 0], mass: 10, colliders: [{ shape: 'cuboid', args: [0.4, 0.4, 0.4] }] });
    const c = createCharacter(p, { position: [0, 1, 0] });
    run(p, c, walk(2), 1.5);
    expect(crate.position()[0]).toBeGreaterThan(1.8);
    p.dispose();
  });

  it('teleport places and clears the knock', () => {
    const c = createCharacter(phys, { position: [0, 1, 0] });
    c.knock([6, 0, 0]);
    c.teleport([10, 1, 5], Math.PI);
    expect(c.position()).toEqual([10, 1, 5]);
    expect(c.prev()).toEqual([10, 1, 5]);
    expect(c.knockLeft()).toBe(0);
    expect(c.yaw).toBeCloseTo(Math.PI, 5);
    c.remove();
  });

  it('remove() leaves no body and no controller', async () => {
    const p = await world();
    const n = p.world.bodies.len();
    const c = createCharacter(p, { position: [0, 1, 0] });
    run(p, c, STILL, 0.1);
    c.remove();
    expect(p.world.bodies.len()).toBe(n);
    expect(() => c.move(STILL, STEP)).not.toThrow();
    p.dispose();
  });

  it('face turns the body without touching the jump or the knock', () => {
    const c = createCharacter(phys, { position: [0, 1, 0], turn: 100 });
    run(phys, c, STILL, 1);
    c.knock([3, 0, 0]);
    c.jump(4);
    c.face(1.2);
    expect(c.yaw).toBeCloseTo(1.2, 5);
    expect(c.vy).toBe(4);
    expect(c.knockLeft()).toBeCloseTo(3, 5);
    run(phys, c, STILL, STEP);
    expect(c.grounded).toBe(false);
    c.remove();
  });

  it('remove() after the world is disposed does not throw', async () => {
    const p = await world();
    const c = createCharacter(p, { position: [0, 1, 0] });
    p.dispose();
    expect(() => c.remove()).not.toThrow();
  });
});
