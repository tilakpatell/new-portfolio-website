import { describe, expect, it } from 'vitest';
import { bindVertices, bonesOf, islands, nearestBone } from './rig-bind.mjs';

// a two-bone leg: the hip at 2 m, the knee at 1 m, the foot on the ground,
// under the game's helpers, which nothing is bound to
const NODES = [
  { name: 'Reference', at: [0, 0, 0], children: ['AITrajectory'] },
  { name: 'AITrajectory', at: [0, 0, 0], children: ['Hips'] },
  { name: 'Hips', at: [0, 2, 0], children: ['Knee'] },
  { name: 'Knee', at: [0, 1, 0], children: ['Foot'] },
  { name: 'Foot', at: [0, 0, 0], children: [] },
];

describe('binding a rigid model to its game skeleton', () => {
  it('leaves the game’s helpers out of the bones a vertex can go to', () => {
    const bones = bonesOf(NODES);
    expect(bones.map((b) => b.name)).toEqual(['Hips', 'Knee', 'Foot']);
    expect(bones[0].ends).toEqual([[0, 1, 0]]);
  });

  it('gives a vertex the bone whose segment it is nearest', () => {
    const bones = bonesOf(NODES);
    expect(bones[nearestBone([0.2, 1.6, 0], bones)].name).toBe('Hips');
    expect(bones[nearestBone([0.2, 0.4, 0], bones)].name).toBe('Knee');
    expect(bones[nearestBone([0, -0.1, 0.3], bones)].name).toBe('Foot');
  });

  it('finds the mesh’s connected pieces', () => {
    const piece = islands([0, 1, 2, 3, 4, 5, 2, 6, 0], 7);
    expect(piece[0]).toBe(piece[6]);
    expect(piece[3]).toBe(piece[5]);
    expect(piece[0]).not.toBe(piece[3]);
  });

  it('gives a plate wholly to the bone most of it chose, so no plate tears at a joint', () => {
    const bones = bonesOf(NODES);
    // a plate from 0.9 m to 1.6 m: three vertices by the thigh, one by the shin
    const pos = [0.1, 1.6, 0, 0.1, 1.4, 0, 0.1, 1.2, 0, 0.1, 0.9, 0];
    const bound = bindVertices(pos, [0, 1, 2, 1, 2, 3], bones);
    expect([...bound].map((b) => bones[b].name)).toEqual(['Hips', 'Hips', 'Hips', 'Hips']);
  });

  it('keeps each vertex’s own bone on a piece split evenly across a joint', () => {
    const bones = bonesOf(NODES);
    const pos = [0.1, 1.6, 0, 0.1, 1.4, 0, 0.1, 0.6, 0, 0.1, 0.4, 0];
    const bound = bindVertices(pos, [0, 1, 2, 1, 2, 3], bones);
    expect([...bound].map((b) => bones[b].name)).toEqual(['Hips', 'Hips', 'Knee', 'Knee']);
  });
});
