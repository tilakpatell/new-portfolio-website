import { describe, expect, it } from 'vitest';
import { byName } from './blocks';
import { FACE } from './mesher';
import { normal, raycast } from './raycast';

const id = (n) => byName.get(n).id;
// a world of the cells listed, air elsewhere
const world = (cells) => {
  const m = new Map(cells.map(([x, y, z, name]) => [`${x},${y},${z}`, id(name)]));
  return { get: (x, y, z) => m.get(`${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`) ?? 0 };
};
const eye = { x: 0.5, y: 65.62, z: 0.5 };

describe('the raycast', () => {
  it('hits the near face of a block 3 away with face 2 (north) when looking +z', () => {
    const hit = raycast(world([[0, 65, 3, 'stone']]), eye, { x: 0, y: 0, z: 1 });
    expect(hit).toMatchObject({ x: 0, y: 65, z: 3, face: FACE.north, id: id('stone') });
    expect(hit.t).toBeCloseTo(2.5, 10);
  });

  it('misses at 5', () => {
    expect(raycast(world([[0, 65, 5, 'stone']]), eye, { x: 0, y: 0, z: 1 })).toBeNull();
    // and reaches no further than 4.5
    expect(raycast(world([[0, 65, 4, 'stone']]), eye, { x: 0, y: 0, z: 1 })).not.toBeNull();
    expect(raycast(world([[0, 65, 4, 'stone']]), eye, { x: 0, y: 0, z: 1 }, 3)).toBeNull();
  });

  it('picks the face by the entry axis at a corner', () => {
    // looking down and east onto a block below: it enters through the top
    const down = raycast(world([[2, 63, 0, 'stone']]), { x: 0.5, y: 65.5, z: 0.5 }, { x: 1, y: -0.75, z: 0 });
    expect(down).toMatchObject({ x: 2, y: 63, face: FACE.top });
    // the same block met side on enters through the west face
    const side = raycast(world([[2, 65, 0, 'stone']]), { x: 0.5, y: 65.5, z: 0.5 }, { x: 1, y: 0.1, z: 0 });
    expect(side).toMatchObject({ x: 2, face: FACE.west });
    // looking -x hits the east face; up hits the bottom; -z the south
    expect(raycast(world([[-2, 65, 0, 'stone']]), eye, { x: -1, y: 0, z: 0 }).face).toBe(FACE.east);
    expect(raycast(world([[0, 68, 0, 'stone']]), eye, { x: 0, y: 1, z: 0 }).face).toBe(FACE.bottom);
    expect(raycast(world([[0, 65, -2, 'stone']]), eye, { x: 0, y: 0, z: -1 }).face).toBe(FACE.south);
  });

  it('passes through water', () => {
    const hit = raycast(world([[0, 65, 1, 'water'], [0, 65, 2, 'water'], [0, 65, 3, 'sand']]), eye, { x: 0, y: 0, z: 1 });
    expect(hit).toMatchObject({ z: 3, id: id('sand') });
  });

  it('a cross block is picked, and leaves and glass', () => {
    for (const name of ['short_grass', 'oak_leaves', 'glass', 'torch']) expect(raycast(world([[0, 65, 2, name]]), eye, { x: 0, y: 0, z: 1 })?.id, name).toBe(id(name));
  });

  it('takes a direction of any length', () => {
    expect(raycast(world([[0, 65, 3, 'stone']]), eye, { x: 0, y: 0, z: 7 }).t).toBeCloseTo(2.5, 10);
  });

  it('gives each face’s outward step', () => {
    expect(normal(FACE.top)).toEqual([0, 1, 0]);
    expect(normal(FACE.north)).toEqual([0, 0, -1]);
    expect(normal(FACE.east)).toEqual([1, 0, 0]);
    expect(normal(FACE.west)).toEqual([-1, 0, 0]);
  });
});
