import { describe, expect, it } from 'vitest';
import { BODIES, KNOCK, bodyOf, knockOf, shapeFor, shotImpulse } from './bodies';

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

describe('knockOf', () => {
  it('gives nothing to what has no mass (a fixed thing) or none that’s a number', () => {
    for (const m of [0, NaN, undefined, -1, Infinity]) expect(knockOf(m), String(m)).toBe(0);
  });

  it('pushes a heavier thing harder, but gives it less speed', () => {
    const masses = [0.01, 0.2, 0.4, 1, 2, 3, 4, 8, 14, 25, 30, 1000];
    for (let i = 1; i < masses.length; i++) {
      const [a, b] = [masses[i - 1], masses[i]];
      expect(knockOf(b), `${a} → ${b} kg`).toBeGreaterThanOrEqual(knockOf(a));
      expect(knockOf(b) / b, `${a} → ${b} kg`).toBeLessThanOrEqual(knockOf(a) / a);
    }
  });

  it('slides a crate, an AC unit too, and doesn’t send a pebble out of sight', () => {
    expect(knockOf(0.01) / 0.01).toBeCloseTo(KNOCK.vMax, 9); // (at most 7 m/s)
    expect(knockOf(1)).toBeCloseTo(4.5, 6);
    expect(knockOf(8) / 8).toBeGreaterThanOrEqual(2.5);
    expect(knockOf(8) / 8).toBeLessThanOrEqual(3.5);
    expect(knockOf(25) / 25).toBeGreaterThanOrEqual(2);
    expect(knockOf(1000)).toBe(KNOCK.jMax); // (at most 60 N·s)
    // (a plumbus is sent no more than three times as fast as an AC unit)
    expect(knockOf(0.2) / 0.2 / (knockOf(25) / 25)).toBeLessThan(3);
  });
});

describe('shotImpulse', () => {
  const j = 10;
  const up = [0, 1, 0];
  const close = (got, want) => want.forEach((w, i) => expect(got[i], `[${i}]`).toBeCloseTo(w, 9));

  it('pushes a level shot all along its way, and hops the thing up a little', () => {
    const { side, lift } = shotImpulse(j, [1, 0, 0], up);
    close(side, [j, 0, 0]);
    close(lift, [0, KNOCK.lift * j, 0]);
  });

  it('pushes nothing along the ground for a shot from straight above', () => {
    close(shotImpulse(j, [0, -1, 0], up).side, [0, 0, 0]);
  });

  it('leaves out the part of a downward shot that goes into the ground', () => {
    const s = Math.SQRT1_2;
    const { side } = shotImpulse(j, [s, -s, 0], up);
    close(side, [j, 0, 0]);
  });

  it('keeps an upward shot as it is', () => {
    close(shotImpulse(j, [0.6, 0.8, 0], up).side, [0.6 * j, 0.8 * j, 0]);
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
