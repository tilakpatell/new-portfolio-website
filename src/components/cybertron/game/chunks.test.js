import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bake, centresOf, cluster, makeTransformer, pairChunks } from './chunks';

const sphere = () => {
  const root = new THREE.Group();
  root.add(new THREE.Mesh(new THREE.SphereGeometry(2, 40, 26), new THREE.MeshStandardMaterial()));
  return root;
};

describe('cutting a model into chunks', () => {
  it('bakes every triangle', () => {
    const root = sphere();
    const parts = bake(root, root);
    expect(parts).toHaveLength(1);
    expect(parts[0].triangles).toBe(root.children[0].geometry.index.count / 3);
  });

  it('puts every triangle in one of the chunks asked for, the same way each time', () => {
    const root = sphere();
    const parts = bake(root, root);
    const a = cluster(parts, 40, 7);
    const b = cluster(parts, 40, 7);
    expect(a.n).toBe(40);
    expect(new Set(a.ids[0]).size).toBe(40);
    expect([...a.ids[0]]).toEqual([...b.ids[0]]);
    // the chunks' middles are inside the model
    for (let q = 0; q < a.n; q++) expect(Math.hypot(a.centres[q * 3], a.centres[q * 3 + 1], a.centres[q * 3 + 2])).toBeLessThanOrEqual(2.001);
  });

  it('finds the same middles again from the same triangles', () => {
    const root = sphere();
    const parts = bake(root, root);
    const { ids, centres, n } = cluster(parts, 20, 3);
    const again = centresOf(parts, ids, n);
    for (let i = 0; i < centres.length; i++) expect(again[i]).toBeCloseTo(centres[i], 4);
  });
});

describe('pairing the chunks', () => {
  const column = (n) => {
    const c = new Float32Array(n * 3);
    for (let q = 0; q < n; q++) c.set([0, q, 0], q * 3);
    return c;
  };

  it('gives every chunk a partner, top with top and bottom with bottom', () => {
    const a = column(10);
    const b = column(5);
    const p = pairChunks(a, b);
    expect(p).toHaveLength(10);
    for (const q of p) expect(q).toBeLessThan(5);
    expect(p[9]).toBe(4); // the top of one to the top of the other
    expect(p[0]).toBe(0);
    // going up one, the partner never goes down
    for (let q = 1; q < 10; q++) expect(p[q]).toBeGreaterThanOrEqual(p[q - 1]);
  });
});

describe('a transformation', () => {
  it('builds both shapes and runs from 0 to 1', () => {
    const robot = sphere();
    const truck = new THREE.Group();
    truck.add(new THREE.Mesh(new THREE.BoxGeometry(4, 2, 8, 4, 2, 8), new THREE.MeshStandardMaterial()));
    const fromParts = bake(robot, robot);
    const toParts = bake(truck, truck);
    const from = { parts: fromParts, ...cluster(fromParts, 30, 1), kind: 'robot' };
    const to = { parts: toParts, ...cluster(toParts, 30, 2), kind: 'vehicle' };
    const t = makeTransformer(from, to);
    expect(t.group.children).toHaveLength(2);
    t.set(0.5);
    const out = [];
    expect(t.sparks(0.5, out)).toBeGreaterThan(0);
    t.dispose();
  });
});
