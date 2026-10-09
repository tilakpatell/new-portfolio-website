import { beforeAll, describe, expect, it } from 'vitest';
import { createPhysics } from './world';
import { createCharacter } from './character';
import { createQueries } from './queries';
import { filterOf } from './groups';
import { REGIONS, capsuleBetween, createHurtboxes } from './hurtbox';

let phys;
beforeAll(async () => {
  phys = await createPhysics();
  phys.add({ type: 'fixed', position: [0, -0.5, 0], group: 'floor', colliders: [{ shape: 'cuboid', args: [20, 0.5, 20] }] });
});

const near = (a, b, tol = 1e-4) => a.every((v, i) => Math.abs(v - b[i]) < tol);

describe('capsuleBetween', () => {
  it('puts the capsule’s centre at the midpoint and its axis along the segment', () => {
    const c = capsuleBetween([0, 1, 0], [0, 2, 0], [5, 0, 0], [0, 0, 0, 1]);
    expect(near(c.translation, [-5, 1.5, 0])).toBe(true);
    expect(near(c.rotation, [0, 0, 0, 1])).toBe(true);
    expect(c.halfHeight).toBeCloseTo(0.5, 6);
  });

  it('turns the capsule onto a segment along x', () => {
    const c = capsuleBetween([0, 1, 0], [2, 1, 0], [0, 0, 0], [0, 0, 0, 1]);
    expect(near(c.translation, [1, 1, 0])).toBe(true);
    // (Rapier's capsule stands along y: a quarter turn about z lays it along x)
    const [x, y, z, w] = c.rotation;
    const axis = [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)]; // the rotated y axis
    expect(Math.abs(axis[0])).toBeCloseTo(1, 5);
    expect(c.halfHeight).toBeCloseTo(1, 6);
  });

  it('a yawed body undoes its yaw in the wrt-parent translation', () => {
    const s = Math.SQRT1_2;
    const c = capsuleBetween([5, 1, 0], [5, 2, 0], [5, 0, -3], [0, s, 0, s]); // the body turned 90° about y
    // the segment is 3 m along +z from the body; turned 90° about y, the body's −x points along world +z
    expect(near(c.translation, [-3, 1.5, 0], 1e-5)).toBe(true);
  });

  it('a zero-length segment is a ball-sized capsule, never NaN', () => {
    const c = capsuleBetween([1, 1, 1], [1, 1, 1], [0, 0, 0], [0, 0, 0, 1]);
    expect(c.halfHeight).toBe(0);
    expect(c.rotation.every(Number.isFinite)).toBe(true);
  });
});

describe('createHurtboxes', () => {
  it('every region exists as a sensor collider tagged by its name', () => {
    const before = phys.world.colliders.len();
    const c = createCharacter(phys, { position: [0, 1, 0] });
    const h = createHurtboxes(phys, c);
    expect(h.regions).toEqual(Object.keys(REGIONS));
    expect(phys.world.colliders.len()).toBe(before + 1 + 10);
    for (const col of c.body.colliders.slice(1)) expect(col.isSensor()).toBe(true);
    h.remove();
    expect(phys.world.colliders.len()).toBe(before + 1);
    c.remove();
  });

  it('a ray against the hurtbox group hits the head where it was set', () => {
    const c = createCharacter(phys, { position: [0, 1, 0] });
    const h = createHurtboxes(phys, c);
    h.set('head', [0, 1.6, 0], [0, 1.8, 0]);
    h.set('chest', [0, 0.5, 0], [0, 1.4, 0]);
    phys.step(1 / 60);
    const q = createQueries(phys);
    const head = q.ray([2, 1.7, 0], [-1, 0, 0], 10, { groups: filterOf('hurtbox') });
    expect(head.tag).toBe('head');
    expect(head.body).toBe(c.body);
    expect(q.ray([2, 1, 0], [-1, 0, 0], 10, { groups: filterOf('hurtbox') }).tag).toBe('chest');
    // a sight ray never sees a hurtbox: it meets the figure's own capsule
    expect(q.ray([2, 1, 0], [-1, 0, 0], 10).tag).toBeNull();
    h.remove();
    c.remove();
  });

  it('a hurtbox follows the body it is on', () => {
    const c = createCharacter(phys, { position: [0, 1, 0] });
    const h = createHurtboxes(phys, c);
    h.set('head', [0, 1.6, 0], [0, 1.8, 0]);
    c.teleport([5, 1, 0]);
    phys.step(1 / 60);
    const q = createQueries(phys);
    expect(q.ray([7, 1.7, 0], [-1, 0, 0], 10, { groups: filterOf('hurtbox') }).tag).toBe('head');
    h.remove();
    c.remove();
  });

  it('single: true makes one capsule tagged whole', () => {
    const before = phys.world.colliders.len();
    const c = createCharacter(phys, { position: [0, 1, 0] });
    const h = createHurtboxes(phys, c, { single: true, tall: 1.8 });
    expect(h.regions).toEqual(['whole']);
    expect(phys.world.colliders.len()).toBe(before + 2);
    h.remove();
    c.remove();
  });

  it('set on an unknown region does nothing', () => {
    const c = createCharacter(phys, { position: [0, 1, 0] });
    const h = createHurtboxes(phys, c);
    expect(() => h.set('tail', [0, 0, 0], [0, 1, 0])).not.toThrow();
    h.remove();
    c.remove();
  });
});
