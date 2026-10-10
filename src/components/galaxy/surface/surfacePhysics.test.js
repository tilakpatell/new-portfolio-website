import { describe, expect, it } from 'vitest';
import { createSolids } from './walker';
import { filterOf } from '../../../lib/physics/groups';
import { budgetFor, createSurfacePhysics } from './surfacePhysics';

// a sloping world with a trunk, a low wall, a gate and a floor in the air
function fixture() {
  const solids = createSolids();
  solids.circle(5, 0, 1);
  solids.box(0, 5, 2, 0.5, 0.3, { top: 1 });
  solids.box(-6, 0, 0.2, 2, 0, { tag: 'gate' });
  return { heightAt: (x) => 0.1 * x, normalAt: () => [0, 1, 0], solids, floors: [{ x: 10, z: 10, r: 3, y: 4 }], reach: 32 };
}

describe('createSurfacePhysics', () => {
  it('the ground is where heightAt says', async () => {
    const sp = await createSurfacePhysics(fixture());
    expect(sp.q.floorAt(8, 0).y).toBeCloseTo(0.8, 0);
    expect(Math.abs(sp.q.floorAt(8, 0).y - 0.8)).toBeLessThan(0.15);
    expect(sp.q.floorAt(-20, 20).y).toBeCloseTo(-2, 0);
    sp.dispose();
  });

  it('a ray meets the trunk and the wall, and a bolt over the low wall passes', async () => {
    const sp = await createSurfacePhysics(fixture());
    const trunk = sp.q.ray([0, 1, 0], [1, 0, 0], 20);
    expect(trunk.dist).toBeCloseTo(4, 1);
    const wall = sp.q.ray([0, 0.5, 0], [0, 0, 1], 20);
    expect(wall.dist).toBeCloseTo(4.5, 0);
    expect(sp.q.ray([0, 1.5, 0], [0, 0, 1], 20)).toBeNull();
    sp.dispose();
  });

  it('the floor disc is a floor at y 4', async () => {
    const sp = await createSurfacePhysics(fixture());
    expect(sp.q.floorAt(10, 10, { from: 6 }).y).toBeCloseTo(4, 1);
    expect(sp.q.floorAt(10, 10, { from: 3 }).y).toBeCloseTo(1, 0);
    sp.dispose();
  });

  it('seesThrough is false across the trunk and true beside it', async () => {
    const sp = await createSurfacePhysics(fixture());
    expect(sp.seesThrough({ x: 0, z: 0 }, { x: 10, z: 0 })).toBe(false);
    expect(sp.seesThrough({ x: 0, z: 3 }, { x: 10, z: 3 })).toBe(true);
    expect(sp.seesThrough({ x: 0, y: 0, z: 0 }, { x: 10, y: 1, z: 0 })).toBe(false);
    sp.dispose();
  });

  it('toggle(tag, false) lets a ray through a tagged box, and on again stops it', async () => {
    const sp = await createSurfacePhysics(fixture());
    expect(sp.byTag.get('gate')).toHaveLength(1);
    expect(sp.q.ray([0, 1, 0], [-1, 0, 0], 20).dist).toBeCloseTo(5.8, 1);
    sp.toggle('gate', false);
    sp.step(1 / 60);
    expect(sp.q.ray([0, 1, 0], [-1, 0, 0], 20)).toBeNull();
    sp.toggle('gate', true);
    sp.step(1 / 60);
    expect(sp.q.ray([0, 1, 0], [-1, 0, 0], 20).dist).toBeCloseTo(5.8, 1);
    sp.dispose();
  });

  it('a solid added after building is solid once stepped', async () => {
    const w = fixture();
    const sp = await createSurfacePhysics(w);
    expect(sp.q.ray([0, 1, 0], [0, 0, -1], 20)).toBeNull();
    w.solids.circle(0, -5, 1);
    sp.step(1 / 60);
    expect(sp.q.ray([0, 1, 0], [0, 0, -1], 20).dist).toBeCloseTo(4, 1);
    sp.dispose();
  });

  it('a refused sight ray keeps its last answer', async () => {
    const sp = await createSurfacePhysics(fixture(), { budget: { rays: 1, sweeps: 1, overlaps: 1 } });
    expect(sp.seesThrough({ x: 0, z: 0 }, { x: 10, z: 0 })).toBe(false);
    expect(sp.seesThrough({ x: 0, z: 0 }, { x: 10, z: 0 })).toBe(false);
    expect(sp.q.stats().rays.refused).toBe(1);
    sp.step(1 / 60);
    expect(sp.seesThrough({ x: 0, z: 3 }, { x: 10, z: 3 })).toBe(true);
    expect(sp.seesThrough({ x: 0, z: 0 }, { x: 10, z: 0 })).toBe(false); // (refused: the kept answer)
    sp.dispose();
  });

  it('step spends the frame, and the sight filter names the floor and objects', async () => {
    const sp = await createSurfacePhysics(fixture());
    expect(sp.SIGHT).toBe(filterOf('floor', 'object'));
    sp.q.ray([0, 1, 0], [1, 0, 0], 20);
    expect(sp.q.stats().rays.used).toBe(1);
    sp.step(1 / 60);
    expect(sp.q.stats().rays.used).toBe(0);
    sp.dispose();
  });

  it('budgetFor scales by tier', () => {
    expect(budgetFor('high')).toEqual({ rays: 24, sweeps: 8, overlaps: 4 });
    expect(budgetFor('mid')).toEqual({ rays: 16, sweeps: 6, overlaps: 3 });
    expect(budgetFor('low')).toEqual({ rays: 10, sweeps: 4, overlaps: 2 });
    expect(budgetFor(undefined)).toEqual(budgetFor('mid'));
  });

  // (placer.js adds a built thing's floors after the world is built, and a
  // platform's floor moves: both must reach the physics world)
  it('a floor added after building through onFloor is a floor, and a tagged one toggles', async () => {
    const w = fixture();
    const sp = await createSurfacePhysics(w);
    expect(sp.q.floorAt(-10, -10, { from: 8, down: 6 })).toBeNull();
    const f = { x: -10, z: -10, r: 2, y: 5, tag: 'lift' };
    w.floors.push(f);
    w.onFloor(f);
    sp.step(1 / 60);
    expect(sp.q.floorAt(-10, -10, { from: 8, down: 6 }).y).toBeCloseTo(5, 1);
    sp.toggle('lift', false);
    sp.step(1 / 60);
    expect(sp.q.floorAt(-10, -10, { from: 8, down: 6 })).toBeNull();
    sp.dispose();
    expect(w.onFloor).toBeUndefined();
  });

  it('a floor that moves follows its height each step', async () => {
    const w = fixture();
    let y = 6;
    const f = { x: -10, z: -10, r: 2, moves: true };
    Object.defineProperty(f, 'y', { get: () => y, enumerable: true });
    w.floors.push(f);
    const sp = await createSurfacePhysics(w);
    expect(sp.q.floorAt(-10, -10, { from: 9, down: 8 }).y).toBeCloseTo(6, 1);
    y = 3;
    sp.step(1 / 60);
    sp.step(1 / 60);
    expect(sp.q.floorAt(-10, -10, { from: 9, down: 8 }).y).toBeCloseTo(3, 1);
    sp.dispose();
  });
});
