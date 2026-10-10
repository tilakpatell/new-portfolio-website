import { describe, expect, it } from 'vitest';
import { createSolids, groundAt, walk, walker } from '../../components/galaxy/surface/walker';
import { writeInstances } from './instances';
import { colliderOf, solidsOf, yawOf } from './collision';

const S = Math.SQRT1_2;
// a floor plate 8 × 8 m and 0.3 m thick, and a wall 6 m long, 0.5 m deep, 4 m high
const pack = {
  meshes: [{ bounds: [-4, -0.3, -4, 4, 0, 4] }, { bounds: [-3, 0, -0.25, 3, 4, 0.25] }],
};
const bin = writeInstances({
  count: 2,
  position: new Float32Array([0, 1, 0, 10, 0, 0]),
  quaternion: new Float32Array([0, 0, 0, 1, 0, S, 0, S]), // the wall turned a quarter: it runs along z
  scale: new Float32Array([1, 1, 1, 1, 1, 1]),
});
const draws = [
  { mesh: 0, offset: 0, count: 1 },
  { mesh: 1, offset: 1, count: 1 },
];

describe('the level’s collision', () => {
  it('reads an instance’s turn about y', () => {
    expect(yawOf([0, S, 0, S])).toBeCloseTo(Math.PI / 2, 6);
    expect(yawOf([0, 0, 0, 1])).toBe(0);
  });

  it('a flat piece is a floor, a tall one a solid box', () => {
    expect(colliderOf(pack.meshes[0], [0, 1, 0], 0, [1, 1, 1])).toEqual({ floor: { x: 0, z: 0, hw: 4, hd: 4, yaw: 0, y: 1 } });
    const wall = colliderOf(pack.meshes[1], [10, 0, 0], Math.PI / 2, [1, 1, 1]);
    expect(wall.box).toMatchObject({ x: 10, z: 0, hw: 3, hd: 0.25, top: 4, base: 0 });
  });

  it('a point over the floor stands on it; walking into the wall stops you', () => {
    const { floors, boxes } = solidsOf(pack, draws, bin);
    const solids = createSolids();
    for (const b of boxes) solids.box(b.x, b.z, b.hw, b.hd, b.yaw, { top: b.top, base: b.base });
    const world = { heightAt: () => 0, normalAt: () => [0, 1, 0], solids, floors, reach: 1000 };
    expect(groundAt(world, 1, 1, 2)).toBe(1);
    expect(groundAt(world, 6, 1, 2)).toBe(0);
    // walk east from x 7 toward the wall at x 10 (its face at 9.75; the stick's -x is east, looking along +z)
    const s = walker(7, 0, 0, 0);
    s.grounded = true;
    for (let i = 0; i < 120; i++) walk(s, { x: -1, y: 0, heading: 0 }, 1 / 60, world);
    expect(s.x).toBeLessThan(9.75);
    expect(s.x).toBeGreaterThan(8);
  });

  it('leaves a huge piece to its real shape, not a box of air', () => {
    expect(colliderOf({ bounds: [-90, 0, -90, 90, 60, 90] }, [0, 0, 0], 0, [1, 1, 1])).toBe(null);
  });

  it('leaves out what is too small to stop anyone', () => {
    const tiny = { meshes: [{ bounds: [-0.1, 0, -0.1, 0.1, 0.2, 0.1] }] };
    const one = writeInstances({ count: 1, position: new Float32Array(3), quaternion: new Float32Array([0, 0, 0, 1]), scale: new Float32Array([1, 1, 1]) });
    expect(solidsOf(tiny, [{ mesh: 0, offset: 0, count: 1 }], one)).toEqual({ floors: [], boxes: [] });
  });
});
