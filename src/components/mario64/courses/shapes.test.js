import { describe, expect, it } from 'vitest';
import { findFloor, makeWorld, pushWalls } from '../rules/collide';
import { createKit } from './shapes';

const worldOf = (k) => {
  const out = k.done();
  return { out, w: makeWorld(out.tris, out.kinds) };
};

describe('the shape kit', () => {
  it('makes a box of 12 triangles whose top is a floor at y + h', () => {
    const k = createKit();
    k.box({ x: 0, y: 100, z: 0, w: 400, h: 300, d: 400, mat: 'stone' });
    const { out, w } = worldOf(k);
    expect(out.tris.length / 9).toBe(12);
    expect(findFloor(w, 0, 500, 0).y).toBeCloseTo(400);
    expect(out.meshes.get('stone').pos.length).toBe(12 * 9);
  });

  it('makes a yawed box whose walls face outward', () => {
    const k = createKit();
    k.box({ x: 1000, y: 0, z: 0, w: 400, h: 300, d: 400, yaw: Math.PI / 4, mat: 'stone' });
    const { w } = worldOf(k);
    // a point 20 outside the middle of each face is pushed further out
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2; // each face's outward heading
      const p = { x: 1000 + Math.sin(a) * 220, y: 0, z: Math.cos(a) * 220 };
      const before = Math.hypot(p.x - 1000, p.z);
      pushWalls(w, p, 60, 50);
      expect(Math.hypot(p.x - 1000, p.z)).toBeGreaterThan(before);
    }
  });

  it('makes a ramp whose top is a floor rising to h along +z', () => {
    const k = createKit();
    k.ramp({ x: 0, y: 0, z: 0, w: 400, d: 800, h: 400, mat: 'stone' });
    const { w } = worldOf(k);
    expect(findFloor(w, 0, 1000, -400 + 1).y).toBeCloseTo(0.5, 1);
    expect(findFloor(w, 0, 1000, 0).y).toBeCloseTo(200, 0);
    expect(findFloor(w, 0, 1000, 399).y).toBeCloseTo(399.5, 0);
  });

  it('makes a terrain of res² × 2 triangles whose heights match its function', () => {
    const k = createKit();
    const height = (x, z) => 100 + x * 0.1 + z * 0.05;
    k.terrain({ id: 'ground', x0: -1000, z0: -1000, w: 2000, d: 2000, res: 8, height, splat: () => [1, 0, 0], mats: ['grass', 'rock', 'path'] });
    const { out, w } = worldOf(k);
    expect(out.tris.length / 9).toBe(8 * 8 * 2);
    expect(out.terrains).toHaveLength(1);
    expect(out.terrains[0].splat.length / 3).toBe(9 * 9);
    expect(findFloor(w, 120, 1000, -340).y).toBeCloseTo(height(120, -340));
  });

  it('adds meshes but no triangles to stand on when collide is false', () => {
    const k = createKit();
    k.box({ x: 0, y: 0, z: 0, w: 100, h: 100, d: 100, mat: 'leaf', collide: false });
    const { out } = worldOf(k);
    expect(out.tris.length).toBe(0);
    expect(out.meshes.get('leaf').pos.length).toBeGreaterThan(0);
  });

  it('makes a cylinder with a floor on top', () => {
    const k = createKit();
    k.cyl({ x: 0, y: 0, z: 0, r: 300, h: 500, mat: 'stone' });
    const { w } = worldOf(k);
    expect(findFloor(w, 100, 600, 50).y).toBeCloseTo(500);
    const p = { x: 330, y: 100, z: 0 };
    pushWalls(w, p, 60, 50);
    expect(p.x).toBeGreaterThan(340);
  });

  it('makes a strip whose top is a floor along its points', () => {
    const k = createKit();
    // a straight climb, then a flat turn (a turn on a grade warps the corner)
    k.strip({ pts: [[0, 0, 0], [0, 200, 1000], [0, 400, 2000]], width: 300, thick: 50, mat: 'path' });
    k.strip({ pts: [[3000, 200, 0], [3000, 200, 1000], [4000, 200, 1000]], width: 300, thick: 50, mat: 'path' });
    const { w } = worldOf(k);
    expect(findFloor(w, 0, 500, 500).y).toBeCloseTo(100, 0);
    expect(findFloor(w, 100, 500, 1500).y).toBeCloseTo(300, 0);
    expect(findFloor(w, 3500, 500, 1000).y).toBeCloseTo(200, 0);
    expect(findFloor(w, 3000, 500, 1100).y).toBeCloseTo(200, 0);
  });
});
