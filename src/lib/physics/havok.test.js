import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { createPhysics } from './world';
import { budgetCell, cellBodies, collidersOf, instanceBody, readShapes, solidsOf } from './havok';
import { packShapes } from './shapesBin';

const fixture = (name) => readShapes(readFileSync(new URL(`../../../scripts/fixtures/bf2017/physics/pack/physics/${name}.bin`, import.meta.url)));

// a 1 m square floor at y = 0, its triangles facing up
const floor = () => [
  {
    kind: 'mesh',
    part: 0,
    material: 14,
    root: 0,
    points: new Float32Array([0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1]),
    indices: new Uint32Array([0, 2, 1, 0, 3, 2]),
  },
];
// a box hull, w × h × d, its corner at the origin
const box = (w, h, d, material = 15) => {
  const p = [];
  for (const x of [0, w]) for (const y of [0, h]) for (const z of [0, d]) p.push(x, y, z);
  return { kind: 'hull', part: 0, material, root: 0, points: new Float32Array(p) };
};

let physics;
beforeAll(async () => {
  physics = await createPhysics();
});

function down(x, z, from = 50) {
  const { Ray } = physics.RAPIER;
  return physics.world.castRayAndGetNormal(new Ray({ x, y: from, z }, { x: 0, y: -1, z: 0 }), 1000, true);
}

describe('collidersOf and instanceBody', () => {
  it('stands the snow pile where its top is: a ray from above stops on it within 2 cm', () => {
    const shapes = fixture('arctic_corridorsnowpile_01');
    const body = physics.add(instanceBody(collidersOf(shapes)));
    physics.world.step();
    const pts = shapes[0].points;
    let top = 0;
    for (let i = 3; i < pts.length; i += 3) if (pts[i + 1] > pts[top + 1]) top = i;
    // (a millimetre in from the highest corner, toward the middle)
    const hit = down(pts[top] * 0.999, pts[top + 2] * 0.999);
    expect(hit).toBeTruthy();
    expect(Math.abs(50 - hit.timeOfImpact - pts[top + 1])).toBeLessThan(0.02);
    expect(body.desc.colliders[0].tag).toBe(28);
    physics.remove(body);
  });

  it('turns a mirrored floor’s triangles round, so it still faces up', () => {
    const colliders = collidersOf(floor());
    const body = physics.add(instanceBody(colliders, { position: [10, 0, 0], scale: [-1, 1, 1] }));
    physics.world.step();
    const hit = down(9.5, 0.5);
    expect(hit).toBeTruthy();
    expect(hit.normal.y).toBeGreaterThan(0.99);
    // (the unmirrored arrays left as they were)
    expect([...colliders[0].args[1]]).toEqual([0, 2, 1, 0, 3, 2]);
    physics.remove(body);
  });

  it('gives two instances of one mesh the same arrays', () => {
    const byMesh = { 7: collidersOf(fixture('arctic_corridorsnowpile_01')) };
    const before = physics.world.colliders.len();
    const descs = cellBodies(
      [
        { mesh: 7, position: [20, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] },
        { mesh: 7, position: [30, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] },
        { mesh: 8, position: [40, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] },
      ],
      byMesh,
    );
    expect(descs).toHaveLength(2);
    expect(descs[0].colliders[0].args[0]).toBe(descs[1].colliders[0].args[0]);
    const bodies = descs.map((d) => physics.add(d));
    expect(physics.world.colliders.len()).toBe(before + 2);
    for (const b of bodies) physics.remove(b);
  });

  it('shares a scaled mesh’s copy between its instances too', () => {
    const colliders = collidersOf([box(1, 1, 1)]);
    const a = instanceBody(colliders, { scale: [2, 2, 2] });
    const b = instanceBody(colliders, { scale: [2, 2, 2] });
    expect(a.colliders).toBe(b.colliders);
    expect(a.colliders[0].args[0][3 * 7]).toBe(2);
  });

  it('lays a capsule along its axis and keeps its radius', () => {
    const [c] = collidersOf([{ kind: 'capsule', part: 0, material: 22, root: 0, a: [0, 0, 0], b: [0, 0, 4], radius: 0.25 }]);
    expect(c.args).toEqual([2, 0.25]);
    expect(c.position).toEqual([0, 0, 2]);
    const body = physics.add(instanceBody([c], { position: [50, 0, 0] }));
    physics.world.step();
    const hit = down(50, 3.5);
    expect(50 - hit.timeOfImpact).toBeCloseTo(0.25, 3);
    physics.remove(body);
  });

  it('refuses a hull of more than 64 points', () => {
    const many = new Float32Array(65 * 3).map((_, i) => Math.sin(i * 12.9898) * 3);
    expect(() => collidersOf([{ kind: 'hull', part: 0, material: 0, root: 0, points: many }])).toThrow(/65 points/);
  });

  it('leaves trimeshes out of a moving body', () => {
    expect(collidersOf([...floor(), box(1, 1, 1)], { statics: false }).map((c) => c.shape)).toEqual(['hull']);
  });

  it('round-trips through the bin into the same colliders', () => {
    const shapes = [box(1, 2, 3), ...floor()];
    expect(collidersOf(readShapes(packShapes(shapes))).map((c) => c.shape)).toEqual(['hull', 'trimesh']);
  });
});

describe('budgetCell', () => {
  it('drops the hull before the trimesh, and says so', () => {
    const descs = [instanceBody(collidersOf([box(1, 1, 1)]), {}, 3), instanceBody(collidersOf(floor()), {}, 4)];
    const { kept, dropped } = budgetCell(descs, { colliders: 1 });
    expect(kept).toHaveLength(1);
    expect(kept[0].colliders[0].shape).toBe('trimesh');
    expect(dropped).toEqual([{ mesh: 3, hulls: 1, triangles: 0 }]);
  });

  it('drops the lightest hull first', () => {
    const descs = [instanceBody(collidersOf([box(5, 5, 5)]), {}, 1), instanceBody(collidersOf([box(0.2, 0.2, 0.2)]), {}, 2), instanceBody(collidersOf([box(2, 2, 2)]), {}, 3)];
    const { kept, dropped } = budgetCell(descs, { colliders: 2 });
    expect(kept.map((d) => d.mesh)).toEqual([1, 3]);
    expect(dropped).toEqual([{ mesh: 2, hulls: 1, triangles: 0 }]);
  });

  it('keeps a cell inside its budget as it is', () => {
    const descs = [instanceBody(collidersOf([box(1, 1, 1)]))];
    expect(budgetCell(descs, { colliders: 4, triangles: 10 }).kept).toBe(descs);
  });

  it('drops trimeshes by triangles when they are over on their own', () => {
    const descs = [instanceBody(collidersOf(floor()), {}, 1), instanceBody(collidersOf([box(1, 1, 1)]), {}, 2)];
    const { kept, dropped } = budgetCell(descs, { triangles: 1 });
    expect(kept.map((d) => d.mesh)).toEqual([2]);
    expect(dropped).toEqual([{ mesh: 1, hulls: 0, triangles: 2 }]);
  });
});

describe('solidsOf', () => {
  it('gives a 2 × 1 m hull turned 30° a box with that yaw', () => {
    const yaw = Math.PI / 6;
    const q = [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
    const hull = box(2, 1.5, 1);
    hull.points = hull.points.map((v, i) => (i % 3 === 0 ? v - 1 : i % 3 === 2 ? v - 0.5 : v));
    const [s] = solidsOf([hull], { position: [3, 2, 4], quaternion: q });
    expect(s.type).toBe('box');
    expect(s.yaw).toBeCloseTo(yaw, 6);
    expect(s.hw).toBeCloseTo(1, 6);
    expect(s.hd).toBeCloseTo(0.5, 6);
    expect(s.x).toBeCloseTo(3, 6);
    expect(s.z).toBeCloseTo(4, 6);
    expect(s.top).toBeCloseTo(3.5, 6);
    expect(s.base).toBeCloseTo(2, 6);
  });

  it('stands a capsule up as a circle and leaves trimeshes out', () => {
    const out = solidsOf([{ kind: 'capsule', part: 0, material: 0, root: 0, a: [0, 0.3, 0], b: [0, 1.4, 0], radius: 0.3 }, ...floor()], { position: [1, 0, 2] });
    expect(out).toEqual([{ type: 'circle', x: 1, z: 2, r: 0.3, top: expect.closeTo(1.7, 6), base: expect.closeTo(0, 6) }]);
  });

  it('scales a mirrored hull’s footprint and keeps it the right way round', () => {
    const [s] = solidsOf([box(2, 1, 1)], { scale: [-1, 1, 1] });
    expect(s.x).toBeCloseTo(-1, 6);
    expect(s.hw).toBeCloseTo(1, 6);
  });
});
