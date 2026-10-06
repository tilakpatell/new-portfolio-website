import { describe, expect, it } from 'vitest';
import { FLOOR_UP, addDynamic, findCeil, findFloor, makeWorld, moveDynamic, pushWalls, raycast, waterAt } from './collide';
import { angleDiff, approach } from './vec';

// a quad as two triangles, corners in order round its face (counter-clockwise
// seen from the side it faces)
const quad = (a, b, c, d) => [...a, ...b, ...c, ...a, ...c, ...d];
const floorQuad = (x0, z0, x1, z1, y) => quad([x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0]);
// a wall in the plane z = z0 facing +z, from x0 to x1 and y0 to y1
const wallFacingZ = (x0, x1, y0, y1, z0) => quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]);
// a wall in the plane x = x0 facing +x
const wallFacingX = (z0, z1, y0, y1, x0) => quad([x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1]);
const world = (...parts) => {
  const flat = parts.flat();
  return makeWorld(new Float32Array(flat), new Array(flat.length / 9).fill('default'));
};

describe('vec', () => {
  it('angleDiff takes the short way round', () => {
    expect(angleDiff(0.1, -0.1)).toBeCloseTo(0.2);
    expect(angleDiff(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(-0.2);
  });
  it('approach stops at the target', () => {
    expect(approach(0, 10, 3)).toBe(3);
    expect(approach(9, 10, 3)).toBe(10);
    expect(approach(10, 0, 3, 4)).toBe(6);
  });
});

describe('floors', () => {
  it('finds the floor under a flat box top at its height', () => {
    const w = world(floorQuad(-500, -500, 500, 500, 200));
    expect(findFloor(w, 0, 300, 0).y).toBeCloseTo(200);
    expect(findFloor(w, 0, 300, 0).surf.n[1]).toBeCloseTo(1);
  });

  it('steps onto a floor 70 above, but not 90 above', () => {
    const w = world(floorQuad(-500, -500, 500, 500, 70), floorQuad(1000, -500, 2000, 500, 90), floorQuad(-3000, -3000, 3000, 3000, 0));
    expect(findFloor(w, 0, 0, 0).y).toBeCloseTo(70);
    expect(findFloor(w, 1500, 0, 0).y).toBeCloseTo(0);
    expect(FLOOR_UP).toBe(78);
  });

  it('finds a floor on a shared edge and on a shared vertex of two triangles', () => {
    const w = world(floorQuad(-500, -500, 500, 500, 0));
    // the quad's diagonal runs from (-500,-500) to (500,500)
    expect(findFloor(w, 0, 10, 0)).not.toBeNull();
    expect(findFloor(w, 250, 10, 250)).not.toBeNull();
    expect(findFloor(w, 500, 10, 500)).not.toBeNull();
    expect(findFloor(w, -500, 10, -500)).not.toBeNull();
  });

  it('interpolates a slope: a ramp rising 400 over 800', () => {
    const w = world(quad([-200, 0, 0], [-200, 400, 800], [200, 400, 800], [200, 0, 0]));
    expect(findFloor(w, 0, 1000, 400).y).toBeCloseTo(200);
    expect(findFloor(w, 0, 1000, 600).y).toBeCloseTo(300);
  });

  it('has none past the edge', () => {
    const w = world(floorQuad(-500, -500, 500, 500, 0));
    expect(findFloor(w, 600, 10, 0)).toBeNull();
  });
});

describe('walls', () => {
  it('pushes a point 30 from a wall out to radius 50, along its normal', () => {
    const w = world(wallFacingZ(-500, 500, 0, 400, 0));
    const p = { x: 0, y: 0, z: 30 };
    const hit = pushWalls(w, p, 60, 50);
    expect(hit).not.toBeNull();
    expect(p.z).toBeCloseTo(50);
    expect(p.x).toBeCloseTo(0);
  });

  it('leaves a point 60 behind a wall alone', () => {
    const w = world(wallFacingZ(-500, 500, 0, 400, 0));
    const p = { x: 0, y: 0, z: -60 };
    expect(pushWalls(w, p, 60, 50)).toBeNull();
    expect(p.z).toBe(-60);
  });

  it('skips a wall whose top is below ignoreBelow (a step to walk up)', () => {
    const w = world(wallFacingZ(-500, 500, 0, 70, 0));
    const p = { x: 0, y: 0, z: 30 };
    expect(pushWalls(w, p, 30, 24, 78)).toBeNull();
    expect(p.z).toBe(30);
    expect(pushWalls(w, p, 30, 50)).not.toBeNull();
  });

  it('ignores a wall above or below the check height', () => {
    const w = world(wallFacingZ(-500, 500, 300, 600, 0));
    const p = { x: 0, y: 0, z: 30 };
    expect(pushWalls(w, p, 60, 50)).toBeNull();
  });

  it('pushes out diagonally at a convex corner, never through it', () => {
    // a box corner at (0, 0): faces +z along x < 0 and +x along z < 0
    const w = world(wallFacingZ(-500, 0, 0, 400, 0), wallFacingX(-500, 0, 0, 400, 0));
    const p = { x: 20, y: 0, z: 20 };
    pushWalls(w, p, 60, 50);
    expect(Math.hypot(p.x, p.z)).toBeGreaterThanOrEqual(49.9);
    expect(p.x).toBeGreaterThan(0);
    expect(p.z).toBeGreaterThan(0);
  });
});

describe('ceilings, water and rays', () => {
  it('finds a ceiling above, and none below', () => {
    // a ceiling faces down: wound the other way
    const ceil = quad([-500, 300, -500], [500, 300, -500], [500, 300, 500], [-500, 300, 500]);
    const w = world(ceil);
    expect(findCeil(w, 0, 100, 0).y).toBeCloseTo(300);
    expect(findCeil(w, 0, 400, 0)).toBeNull();
  });

  it('knows the water level inside a box and -Infinity outside', () => {
    const w = makeWorld(new Float32Array(0), [], { water: [{ x0: -100, z0: -100, x1: 100, z1: 100, y: 50 }] });
    expect(waterAt(w, 0, 0)).toBe(50);
    expect(waterAt(w, 200, 0)).toBe(-Infinity);
  });

  it('hits the nearer of two walls', () => {
    const w = world(wallFacingZ(-500, 500, 0, 400, 0), wallFacingZ(-500, 500, 0, 400, -300));
    const hit = raycast(w, { x: 0, y: 100, z: 500 }, { x: 0, y: 100, z: -500 });
    expect(hit.z).toBeCloseTo(0);
    expect(hit.t).toBeCloseTo(0.5);
  });
});

describe('dynamic colliders', () => {
  it('reports a platform moved up 100 as a floor 100 higher', () => {
    const w = world(floorQuad(-3000, -3000, 3000, 3000, -1000));
    const top = new Float32Array(floorQuad(-200, -200, 200, 200, 0));
    const c = addDynamic(w, { id: 'lift', tris: top, kinds: ['default', 'default'] });
    expect(findFloor(w, 0, 50, 0).y).toBeCloseTo(0);
    moveDynamic(c, [1, 0, 0, 0, 0, 1, 0, 100, 0, 0, 1, 0]);
    const f = findFloor(w, 0, 150, 0);
    expect(f.y).toBeCloseTo(100);
    expect(f.surf.owner).toBe(c);
  });
});
