import { describe, expect, it } from 'vitest';
import { HOBBIT, behindYaw, cameraMove, makeWalker, newWalker, pushOut, sightClear } from './walker';
import * as shire from '../shire/rules';

// walk with a steady push for `s` seconds
function walk(w, h, move, s, opts) {
  for (let t = 0; t < s; t += 1 / 60) h = w.step(h, move, 1 / 60, opts);
  return h;
}

describe('the walker', () => {
  it('walks the way it is pushed, and turns to face it', () => {
    const w = makeWalker({ radius: 46 });
    const h = walk(w, newWalker({ x: 0, z: 0, face: Math.PI }), { x: 1, z: 0 }, 1);
    expect(h.x).toBeGreaterThan(2.5);
    expect(Math.abs(h.z)).toBeLessThan(1e-6);
    expect(Math.cos(h.face)).toBeGreaterThan(0.99);
    expect(h.speed).toBeGreaterThan(HOBBIT.walk - 0.2);
  });

  it('gets up to speed and turns as fast at 30, 60 or 120 frames a second', () => {
    const w = makeWalker({ radius: 50 });
    const after = (hz) => {
      let h = newWalker({ x: 0, z: 0, face: 0 });
      for (let i = 0; i < hz * 0.2; i++) h = w.step(h, { x: 0, z: -1 }, 1 / hz);
      return h;
    };
    const [a, b, c] = [after(30), after(60), after(120)];
    expect(Math.abs(a.vz - b.vz) / Math.abs(b.vz)).toBeLessThan(0.01);
    expect(Math.abs(c.vz - b.vz) / Math.abs(b.vz)).toBeLessThan(0.01);
    expect(Math.abs(a.face - b.face)).toBeLessThan(0.01);
    expect(Math.abs(c.face - b.face)).toBeLessThan(0.01);
  });

  it('runs faster than it walks', () => {
    const w = makeWalker({ radius: 46 });
    const a = walk(w, newWalker({ x: 0, z: 0 }), { x: 1, z: 0 }, 1);
    const b = walk(w, newWalker({ x: 0, z: 0 }), { x: 1, z: 0, run: true }, 1);
    expect(b.x).toBeGreaterThan(a.x + 1.5);
    expect(b.running).toBe(true);
  });

  it('stops at a round thing', () => {
    const w = makeWalker({ radius: 46, colliders: [{ kind: 'circle', x: 3, z: 0, r: 1 }] });
    const h = walk(w, newWalker({ x: 0, z: 0 }), { x: 1, z: 0 }, 3);
    expect(h.x).toBeLessThanOrEqual(3 - 1 - HOBBIT.radius + 1e-6);
    expect(h.x).toBeGreaterThan(1.4);
  });

  it('never walks into a turned box', () => {
    const box = { kind: 'box', x: 0, z: 3, w: 4, d: 1, turn: Math.PI / 4 };
    const w = makeWalker({ radius: 46, colliders: [box] });
    let h = newWalker({ x: 0, z: 0 });
    for (let i = 0; i < 240; i++) {
      h = w.step(h, { x: 0, z: 1 }, 1 / 60);
      // into the box's own frame (its +x turned by `turn`, as rotation.y turns a model)
      const dx = h.x - box.x;
      const dz = h.z - box.z;
      const lx = dx * Math.cos(box.turn) - dz * Math.sin(box.turn);
      const lz = dx * Math.sin(box.turn) + dz * Math.cos(box.turn);
      expect(Math.abs(lx) < box.w / 2 && Math.abs(lz) < box.d / 2).toBe(false);
    }
    // it slid along the slanted face rather than sticking
    expect(Math.abs(h.x)).toBeGreaterThan(0.5);
  });

  it('stops at a wall, and at a closed gate in front of it', () => {
    const w = makeWalker({ radius: 46, walls: [[-5, 2, 5, 2]] });
    const open = walk(w, newWalker({ x: 0, z: 0 }), { x: 0, z: 1 }, 2);
    expect(open.z).toBeCloseTo(2 - HOBBIT.radius - 0.08, 2);
    const shut = walk(w, newWalker({ x: 0, z: 0 }), { x: 0, z: 1 }, 2, { closed: [[-1, 1, 1, 1]] });
    expect(shut.z).toBeCloseTo(1 - HOBBIT.radius - 0.08, 2);
  });

  it('keeps out of what `blocked` says, sliding along it', () => {
    const w = makeWalker({ radius: 46, blocked: (x) => x > 2 });
    const h = walk(w, newWalker({ x: 0, z: 0 }), { x: 1, z: 1 }, 2);
    expect(h.x).toBeLessThanOrEqual(2);
    expect(h.z).toBeGreaterThan(2);
  });

  it('stops at the rim of its world and says so', () => {
    const w = makeWalker({ radius: 46 });
    const h = walk(w, newWalker({ x: 40, z: 0 }), { x: 1, z: 0, run: true }, 3);
    expect(Math.hypot(h.x, h.z)).toBeCloseTo(46, 4);
    expect(h.edge).toBe(true);
    expect(walk(w, newWalker({ x: 0, z: 0 }), { x: 1, z: 0 }, 1).edge).toBe(false);
  });

  it('pushes a point out of a box from the inside, by the nearest side', () => {
    const [x, z] = pushOut(0.9, 0, 0.4, [{ kind: 'box', x: 0, z: 0, w: 2, d: 4 }]);
    expect(x).toBeCloseTo(1.4, 6);
    expect(z).toBeCloseTo(0, 6);
  });
});

describe('sight', () => {
  const house = { kind: 'box', x: 0, z: 0, w: 4, d: 4 };
  it('is blocked by a house in between, and clear round it', () => {
    expect(sightClear(-6, 0, 6, 0, [house], [])).toBe(false);
    expect(sightClear(-6, 3, 6, 3, [house], [])).toBe(true);
  });
  it('is blocked by a round thing and by a wall, but not by low things', () => {
    expect(sightClear(-6, 0, 6, 0, [{ kind: 'circle', x: 0, z: 0.5, r: 1 }], [])).toBe(false);
    expect(sightClear(-6, 0, 6, 0, [], [[0, -3, 0, 3]])).toBe(false);
    expect(sightClear(-6, 0, 6, 0, [{ ...house, low: true }], [[0, -3, 0, 3, 0.1, true]])).toBe(true);
  });
});

describe('the camera’s helpers', () => {
  it('are the Shire’s, to the bit', () => {
    for (const a of [-3.1, -1.2, 0, 0.4, Math.PI / 2, 2.9]) {
      expect(behindYaw(a)).toBe(shire.behindYaw(a));
      for (const [f, r] of [[1, 0], [0, 1], [-0.6, 0.3], [0.25, -1]]) expect(cameraMove(a, f, r)).toEqual(shire.cameraMove(a, f, r));
    }
  });
});
