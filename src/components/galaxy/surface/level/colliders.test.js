import { describe, expect, it } from 'vitest';
import { writeInstances } from '../../../../lib/level/instances';
import { createSolids, groundAt } from '../walker';
import { createColliders } from './colliders';

const pack = {
  meshes: [{ bounds: [-4, -0.3, -4, 4, 0, 4] }, { bounds: [-3, 0, -0.25, 3, 4, 0.25] }],
  cells: { '0,0': { draws: [{ mesh: 0, offset: 0, count: 1 }, { mesh: 1, offset: 1, count: 1 }] } },
};
const bin = writeInstances({ count: 2, position: new Float32Array([0, 1, 0, 10, 0, 0]), quaternion: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1]), scale: new Float32Array([1, 1, 1, 1, 1, 1]) });

describe('the level’s colliders', () => {
  it('a cell’s floor and wall go into the walk world, off when it goes, on again when it comes back', () => {
    const walk = { heightAt: () => 0, solids: createSolids(), floors: [] };
    const c = createColliders(walk);
    c.add('0,0', pack, bin);
    expect(walk.floors.length).toBe(1);
    expect(walk.solids.all.length).toBe(1);
    expect(groundAt(walk, 1, 1, 2)).toBe(1);
    c.drop('0,0');
    expect(groundAt(walk, 1, 1, 2)).toBe(0);
    expect(walk.solids.all[0].off).toBe(true);
    c.add('0,0', pack, bin);
    expect(walk.floors.length).toBe(1);
    expect(groundAt(walk, 1, 1, 2)).toBe(1);
  });

  it('a mesh the tier dropped leaves no wall behind', () => {
    const walk = { heightAt: () => 0, solids: createSolids(), floors: [] };
    createColliders(walk, 'low').add('0,0', { ...pack, cull: { low: { K: 20, dropped: [1] } } }, bin);
    expect(walk.solids.all.length).toBe(0);
    expect(walk.floors.length).toBe(1);
  });
});
