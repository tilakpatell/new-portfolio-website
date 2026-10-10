import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { capsuleOf, createBlaster } from './blaster';
import { createSolids } from './walker';

// a flat world with a wall across x = 10
const worldOf = () => {
  const world = { heightAt: () => 0, normalAt: () => [0, 1, 0], solids: createSolids(), floors: [] };
  world.solids.box(10, 0, 0.5, 5);
  return world;
};
const figure = (x, z, tall = 1.8) => ({ holder: { position: new THREE.Vector3(x, 0, z) }, fig: { tall } });
const fly = (blaster, world, frames = 120) => {
  const all = [];
  for (let i = 0; i < frames && blaster.bolts.live().length; i++) all.push(...blaster.update(1 / 60, world));
  return all;
};

describe('the galaxy’s blaster on the one bolt step', () => {
  it('a body is a capsule from the feet to the crown', () => {
    const c = capsuleOf(figure(2, 3));
    expect(c.a).toEqual([2, c.r, 3]);
    expect(c.b[1]).toBeCloseTo(1.8 - c.r);
    expect(c.r).toBeCloseTo(0.45);
  });

  it('your shot aims at the first thing on your eyes’ line, and its hit comes when the bolt gets there', () => {
    const blaster = createBlaster({ parent: new THREE.Scene(), world: worldOf() });
    const t = figure(6, 0);
    const shot = blaster.fire(new THREE.Vector3(0, 1.4, 0), new THREE.Vector3(1, 0, 0), [t], '#ff3b30', 90, new THREE.Vector3(0.3, 1.3, 0.2), { yours: true });
    expect(shot.target).toBe(t);
    expect(shot.at.x).toBeLessThan(6);
    expect(blaster.update(1 / 120, { bodies: [] })).toHaveLength(0); // (still in the air)
    const ev = fly(blaster, { bodies: [{ id: 't', ...capsuleOf(t), side: 'them', ref: t }] });
    expect(ev.map((e) => e.type)).toEqual(['hit']);
    expect(ev[0].body.ref).toBe(t);
    expect(ev[0].bolt.tag).toEqual({ yours: true });
  });

  it('an enemy behind a wall is never hit', () => {
    const blaster = createBlaster({ parent: new THREE.Scene(), world: worldOf() });
    const t = figure(14, 0);
    const shot = blaster.fire(new THREE.Vector3(0, 1.4, 0), new THREE.Vector3(1, 0, 0), [t]);
    expect(shot.target).toBeNull();
    expect(shot.at.x).toBeCloseTo(9.5);
    const ev = fly(blaster, { bodies: [{ id: 't', ...capsuleOf(t), side: 'them', ref: t }] });
    expect(ev.map((e) => e.type)).toEqual(['solid']);
  });

  it('theirs is turned by a raised blade and comes home', () => {
    const blaster = createBlaster({ parent: new THREE.Scene(), world: { heightAt: () => 0, solids: createSolids() } });
    blaster.enemy([0, 1.2, 0], [8, 1.2, 0], 0, '#ff3b30', 8, { owner: 'trooper' });
    const blades = [{ id: 'you', base: [7.4, 0.5, 0], tip: [7.4, 1.8, 0], r: 0.4, side: 'you' }];
    const ev = fly(blaster, { bodies: [{ id: 'trooper', a: [-0.3, 0.4, 0], b: [-0.3, 1.4, 0], r: 0.4, side: 'them' }, { id: 'you', a: [8, 0.4, 0], b: [8, 1.4, 0], r: 0.4, side: 'you' }], blades });
    expect(ev.map((e) => e.type)).toEqual(['deflect', 'hit']);
    expect(ev[1].body.id).toBe('trooper');
  });

  it('a battle’s tracer hurts nobody', () => {
    const blaster = createBlaster({ parent: new THREE.Scene(), world: { heightAt: () => -5, solids: createSolids() } });
    blaster.tracer([0, 1, 0], [20, 1, 0]);
    const ev = fly(blaster, { bodies: [{ id: 'x', a: [10, 0.4, 0], b: [10, 1.4, 0], r: 0.4, side: 'them' }] });
    expect(ev.map((e) => e.type)).toEqual(['gone']);
  });
});

describe('on a physics world', () => {
  it('flies against the world’s ray when it has one', async () => {
    const { createPhysics } = await import('../../../lib/physics/world');
    const { segmentRay } = await import('../../../lib/physics/blast');
    const physics = await createPhysics({ gravity: 0 });
    physics.add({ type: 'fixed', position: [6, 1, 0], colliders: [{ shape: 'cuboid', args: [0.2, 2, 2] }] });
    physics.step(1 / 60);
    const world = { ...worldOf(), physicsRay: segmentRay(physics) };
    const blaster = createBlaster({ parent: new THREE.Scene(), world });
    expect(blaster.solids([0, 1, 0], [20, 1, 0]).at[0]).toBeCloseTo(5.8, 4);
    blaster.shoot({ from: [0, 1, 0], dir: [1, 0, 0], owner: 'you', side: 'you' });
    const ev = fly(blaster, { bodies: [] });
    expect(ev.map((e) => e.type)).toEqual(['solid']);
    expect(ev[0].at[0]).toBeCloseTo(5.8, 4);
    physics.dispose();
  });

  it('flies your bolts by a row when it is given one', () => {
    const blaster = createBlaster({ parent: new THREE.Scene(), world: worldOf(), ballistic: { speed: 350, gravity: -9.8, drag: 0, ttl: 3 } });
    const shot = blaster.fire(new THREE.Vector3(0, 1.4, 0), new THREE.Vector3(1, 0, 0), [], '#ff3b30', 90);
    blaster.update(0.5, { bodies: [] });
    expect(shot.bolt.pos[1]).toBeLessThan(1.4);
  });
});
