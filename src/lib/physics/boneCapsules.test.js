import { describe, expect, it } from 'vitest';
import bones from '../../data/bf2017/physics/bones.json';
import { capsulesOf, figureCapsules, isGameSkeleton, regionOf, regionsOf } from './boneCapsules';

const SOLDIER = bones.sets.find((s) => s.id === 'defaultsoldierbonecollision');

// a column-major matrix: the bone's x, y and z axes in the world, its origin, a scale
const mat = (x, y, z, t, s = 1) => ({ matrixWorld: { elements: [...x.map((v) => v * s), 0, ...y.map((v) => v * s), 0, ...z.map((v) => v * s), 0, ...t, 1] } });
const at = (t) => mat([1, 0, 0], [0, 1, 0], [0, 0, 1], t);

// the game's bones run along their x: a head bone standing up at the neck (x up), a spine
// below it, and the names that mark the game's skeleton
const gameFigure = (s = 1) => ({
  Hips: at([0, 1, 0]),
  Spine: mat([0, 1, 0], [-1, 0, 0], [0, 0, 1], [0, 1.1, 0], s),
  Spine1: at([0, 1.25, 0]),
  Neck: at([0, 1.5, 0]),
  Head: mat([0, 1, 0], [-1, 0, 0], [0, 0, 1], [0, 1.6, 0], s),
});

const near = (a, b, tol = 1e-9) => a.every((v, i) => Math.abs(v - b[i]) < tol);

describe('the game’s capsules on the game’s skeleton', () => {
  it('lays the head capsule from its offset along the bone’s x, on the head', () => {
    const caps = capsulesOf(gameFigure(), SOLDIER);
    const head = caps.find((c) => c.region === 'Head');
    // offset (−0.01, 0.01, 0) in the bone: x is up (−0.01 m), y is −x (−0.01 m)
    expect(near(head.a, [-0.01, 1.59, 0])).toBe(true);
    expect(near(head.b, [-0.01, 1.635, 0])).toBe(true);
    expect(head.r).toBe(0.16);
    expect(head.reaction).toBe('HRT_Head');
    // on the head, not beside it: within a few centimetres of the head bone across
    expect(Math.hypot(head.a[0], head.a[2])).toBeLessThan(0.03);
  });

  it('scales with the bone', () => {
    const head = capsulesOf(gameFigure(2), SOLDIER).find((c) => c.region === 'Head');
    expect(head.r).toBeCloseTo(0.32, 9);
    expect(head.b[1] - head.a[1]).toBeCloseTo(0.09, 9);
  });

  it('takes the hi or the low set, and skips the zero-radius marker and missing bones', () => {
    const hi = capsulesOf(gameFigure(), SOLDIER);
    expect(hi.map((c) => c.region).sort()).toEqual(['Head', 'Spine', 'Spine']);
    const low = capsulesOf(gameFigure(), SOLDIER, { lod: 'low' });
    expect(low.map((c) => c.region)).toEqual(['Head']);
    expect(SOLDIER.bones.filter((b) => b.lowLod).length).toBeLessThan(SOLDIER.bones.filter((b) => b.hiLod).length);
  });

  it('names a hit’s region by its reaction', () => {
    expect(regionOf('HRT_Head')).toBe('head');
    expect(regionOf('HRT_Body')).toBe('chest');
    expect(regionOf('HRT_LeftLeg')).toBe('limb');
  });
});

describe('a Meshy figure', () => {
  const meshy = {
    Hips: at([0, 1, 0]),
    Spine01: at([0, 1.2, 0]),
    Spine: at([0, 1.3, 0]),
    neck: at([0, 1.5, 0]),
    Head: at([0, 1.6, 0]),
    head_end: at([0, 1.8, 0]),
    LeftArm: at([0.2, 1.45, 0]),
    LeftForeArm: at([0.45, 1.45, 0]),
    LeftHand: at([0.7, 1.45, 0]),
  };

  it('is not on the game’s skeleton, and gets hurtbox.js’s regions from its own bones', () => {
    expect(isGameSkeleton(meshy)).toBe(false);
    expect(isGameSkeleton(gameFigure())).toBe(true);
    const caps = figureCapsules(meshy, SOLDIER);
    expect(caps.map((c) => c.region)).toEqual(['head', 'chest', 'upperArmL', 'foreArmL']);
    expect(caps[0]).toMatchObject({ a: [0, 1.5, 0], b: [0, 1.8, 0], r: 0.12 });
    expect(regionsOf(meshy)).toEqual(caps);
  });

  it('has all ten regions when every bone is there', () => {
    const full = { ...meshy };
    for (const n of ['RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot']) full[n] = at([0, 0.5, 0]);
    expect(regionsOf(full)).toHaveLength(10);
  });
});
