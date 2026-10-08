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

  it('makes a ball as big as its biggest way', () => {
    const s = shapeFor({ shape: 'ball', mass: 0.2 }, box([-0.1, 0, -0.1], [0.1, 0.4, 0.1]));
    expect(s.colliders[0]).toEqual({ shape: 'ball', args: [0.2], position: [0, 0.2, 0] });
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
