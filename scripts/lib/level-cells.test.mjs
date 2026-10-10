import { describe, expect, it } from 'vitest';
import { cellsOf, weightOf } from './level-cells.mjs';

const inst = (pos, scale = []) => ({
  count: pos.length / 3,
  position: Float32Array.from(pos),
  quaternion: new Int16Array((pos.length / 3) * 4),
  scale: Float32Array.from(scale.length ? scale : pos.map(() => 1)),
});

describe('cellsOf', () => {
  it('groups by cell, then by mesh and side, sorted by mesh', () => {
    const cells = cellsOf(inst([1, 0, 1, 2, 0, 2, 3, 0, 3, 130, 0, 1], [1, 1, 1, -1, 1, 1, 1, 1, 1, 1, 1, 1]), Int32Array.from([5, 5, 2, 5]));
    expect(cells.get('0,0').draws).toEqual([
      { mesh: 2, indices: [2], mirrored: false },
      { mesh: 5, indices: [0], mirrored: false },
      { mesh: 5, indices: [1], mirrored: true },
    ]);
    expect(cells.get('1,0').draws).toEqual([{ mesh: 5, indices: [3], mirrored: false }]);
  });

  it('bounds a cell by its instances, grown by each mesh’s reach', () => {
    const cells = cellsOf(inst([1, 0, 1, 3, 2, 5]), Int32Array.from([0, 0]), { reach: () => 1 });
    expect(cells.get('0,0').bounds).toEqual([0, -1, 0, 4, 3, 6]);
  });

  it('takes a cell size', () => {
    expect([...cellsOf(inst([70, 0, 0]), Int32Array.from([0]), { cell: 64 }).keys()]).toEqual(['1,0']);
  });
});

describe('weightOf', () => {
  it('is the instances times the mesh’s bounding volume', () => {
    expect(weightOf({ indices: [0, 1, 2] }, { bounds: [0, 0, 0, 2, 3, 4] })).toBe(72);
    // (a flat decal still weighs something)
    expect(weightOf({ indices: [0] }, { bounds: [0, 0, 0, 2, 0, 2] })).toBeGreaterThan(0);
  });
});
