import { describe, expect, it } from 'vitest';
import { BODIES, bodyOf, shapeFor } from './bodies';

const box = (min, max) => ({ min, max });

describe('bodyOf', () => {
  it('takes a model spec’s own body first, then the kind’s, else none', () => {
    expect(bodyOf('barrel')).toEqual(BODIES.barrel);
    expect(bodyOf('barrel', { body: { shape: 'ball', mass: 9 } })).toEqual({ shape: 'ball', mass: 9 });
    expect(bodyOf('bagEnd')).toBe(null);
    expect(bodyOf('bagEnd', { url: '/x.glb' })).toBe(null);
  });

  it('takes a model’s own physical nodes before anything named for it', () => {
    const model = [{ name: 'crate_physical_dynamic', desc: { type: 'dynamic', mass: 3, position: [0, 0, 0], rotation: [0, 0, 0, 1], colliders: [{ shape: 'cuboid', args: [0.5, 0.5, 0.5] }] } }];
    expect(bodyOf('barrel', { body: { shape: 'ball', mass: 9 } }, model)).toEqual({ shape: 'model', bodies: model });
    expect(bodyOf('barrel', null, [])).toEqual(BODIES.barrel);
  });

  it('gives every body a shape it knows and a mass, unless it stands fixed', () => {
    for (const [kind, b] of Object.entries(BODIES)) {
      expect(['box', 'cylinder', 'ball'], kind).toContain(b.shape);
      if (!b.fixed) expect(b.mass, kind).toBeGreaterThan(0);
    }
  });
});

describe('shapeFor', () => {
  it('makes a box from the thing’s own box, at its scale, round its middle', () => {
    const s = shapeFor({ shape: 'box', mass: 2 }, box([-0.5, 0, -0.25], [0.5, 1, 0.25]), 2);
    expect(s.type).toBe('dynamic');
    expect(s.colliders).toEqual([{ shape: 'cuboid', args: [1, 1, 0.5], position: [0, 1, 0] }]);
    expect(s.mass).toBeCloseTo(16, 9); // (twice the size, eight times the mass)
  });

  it('makes a standing cylinder as wide as its widest way', () => {
    const s = shapeFor({ shape: 'cylinder', mass: 1 }, box([-0.3, 0, -0.2], [0.3, 0.9, 0.2]));
    expect(s.colliders[0].shape).toBe('cylinder');
    expect(s.colliders[0].args[0]).toBeCloseTo(0.45, 9);
    expect(s.colliders[0].args[1]).toBeCloseTo(0.3, 9);
    expect(s.colliders[0].position).toEqual([0, 0.45, 0]);
  });

  it('makes a ball as big as its biggest way, its foot on the thing’s', () => {
    const s = shapeFor({ shape: 'ball', mass: 0.2 }, box([-0.1, 0, -0.1], [0.1, 0.4, 0.1]));
    expect(s.colliders[0]).toEqual({ shape: 'ball', args: [0.2], position: [0, 0.2, 0] });
    // (a wide one doesn't reach down into the ground under it)
    const wide = shapeFor({ shape: 'ball', mass: 0.2 }, box([-0.5, 0, -0.5], [0.5, 0.2, 0.5]), 2);
    const [r] = wide.colliders[0].args;
    expect(wide.colliders[0].position[1] - r).toBeCloseTo(0, 9);
  });

  it('makes the flat lumps boxes, not balls bigger than they are', () => {
    expect(BODIES.stones.shape).toBe('box');
    expect(BODIES.rubble.shape).toBe('box');
  });

  it('stands a fixed one still, with no mass', () => {
    const s = shapeFor({ shape: 'box', fixed: true }, box([0, 0, 0], [1, 1, 1]));
    expect(s.type).toBe('fixed');
    expect(s.mass).toBeUndefined();
  });

  it('never makes a shape too thin to collide', () => {
    const s = shapeFor({ shape: 'box', mass: 1 }, box([-0.5, 0, -0.5], [0.5, 0, 0.5]));
    expect(Math.min(...s.colliders[0].args)).toBeGreaterThanOrEqual(0.02);
  });

  it('says none for a box that isn’t numbers', () => {
    expect(shapeFor({ shape: 'box', mass: 1 }, box([NaN, 0, 0], [1, 1, 1]))).toBe(null);
    expect(shapeFor({ shape: 'box', mass: 1 }, box([Infinity, 0, 0], [-Infinity, 1, 1]))).toBe(null);
    expect(shapeFor({ shape: 'piano', mass: 1 }, box([0, 0, 0], [1, 1, 1]))).toBe(null);
  });
});

describe('shapeFor a model’s own bodies', () => {
  const turn = [0, Math.SQRT1_2, 0, Math.SQRT1_2]; // a quarter turn about y
  const crate = { name: 'crate_physical_dynamic', desc: { type: 'dynamic', mass: 3, sleeping: true, position: [1, 0, 0], rotation: turn, colliders: [{ shape: 'cuboid', args: [0.5, 0.25, 0.5], position: [1, 0.25, 0], rotation: [0, 0, 0, 1] }] } };
  const lid = { name: 'lid_physical_dynamic', desc: { type: 'dynamic', mass: 1, position: [0, 1, 0], rotation: [0, 0, 0, 1], colliders: [{ shape: 'ball', args: [0.2] }] } };

  it('is one body of all their colliders, each where its own body put it, at the scale asked', () => {
    const s = shapeFor({ shape: 'model', bodies: [crate, lid] }, null, 2);
    expect(s.type).toBe('dynamic');
    expect(s.mass).toBeCloseTo(4 * 8, 9);
    expect(s.colliders).toHaveLength(2);
    const [a, b] = s.colliders;
    expect(a.shape).toBe('cuboid');
    a.args.forEach((v, i) => expect(v).toBeCloseTo([1, 0.5, 1][i], 9));
    // (its offset +x turned a quarter about y is −z, from the body at x = 1; all twice the size)
    a.position.forEach((v, i) => expect(v).toBeCloseTo([2, 0.5, -2][i], 9));
    a.rotation.forEach((v, i) => expect(v).toBeCloseTo(turn[i], 9));
    expect(b.args[0]).toBeCloseTo(0.4, 9);
    b.position.forEach((v, i) => expect(v).toBeCloseTo([0, 2, 0][i], 9));
  });

  it('stands fixed when its first body is fixed, with no mass', () => {
    const wall = { name: 'wall_physical', desc: { type: 'fixed', position: [0, 0, 0], rotation: [0, 0, 0, 1], colliders: [{ shape: 'cuboid', args: [1, 1, 1] }] } };
    expect(shapeFor({ shape: 'model', bodies: [wall] }, null)).toEqual({ type: 'fixed', colliders: [{ shape: 'cuboid', args: [1, 1, 1], position: [0, 0, 0], rotation: [0, 0, 0, 1] }] });
  });

  it('scales a hull’s points with the rest', () => {
    const rock = { name: 'rock_physical_dynamic', desc: { type: 'dynamic', mass: 1, position: [0, 0, 0], rotation: [0, 0, 0, 1], colliders: [{ shape: 'hull', args: [new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1])] }] } };
    expect(Array.from(shapeFor({ shape: 'model', bodies: [rock] }, null, 3).colliders[0].args[0])).toEqual([0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 3]);
  });
});
