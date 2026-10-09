import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { drawnHeight, groundAt, terrainGeometry } from './ground';
import { FIELD, POND, WORLD, height } from './rules';

const at = (x, z) => {
  const out = [0, 0, 0];
  const grass = groundAt(x, z, out);
  return { out, grass };
};
const greenish = ([r, g, b]) => g > r && g > b;

describe('the Shire’s ground, as one function for its colour and its grass', () => {
  it('grows grass on the open green, and paints it green', () => {
    const p = at(-8, -16);
    expect(p.grass).toBeGreaterThan(0.9);
    expect(greenish(p.out)).toBe(true);
  });

  it('wears the lanes to dirt, with no grass on them', () => {
    // (the lane runs east-west along z = -4)
    const p = at(20, -4);
    expect(p.grass).toBeLessThan(0.1);
    expect(greenish(p.out)).toBe(false);
  });

  it('grows nothing in Maggot’s tilled field, under the water or round the doors', () => {
    expect(at((FIELD.x0 + FIELD.x1) / 2, (FIELD.z0 + FIELD.z1) / 2).grass).toBe(0);
    expect(at(POND.x, POND.z).grass).toBe(0);
  });

  it('stays a colour everywhere in the world', () => {
    for (let x = -WORLD.edge; x <= WORLD.edge; x += 13)
      for (let z = -WORLD.edge; z <= WORLD.edge; z += 11) {
        const p = at(x, z);
        for (const c of p.out) expect(c >= 0 && c <= 1).toBe(true);
        expect(p.grass >= 0 && p.grass <= 1).toBe(true);
      }
  });
});

describe('the Shire’s ground as it’s drawn', () => {
  // (a coarse one, so the drawn ground and the height function part)
  const geo = terrainGeometry(40);
  const drawn = drawnHeight(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })));
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));

  it('is the height function at the terrain’s corners', () => {
    const cell = (WORLD.edge * 2) / 40;
    for (const [i, j] of [[0, 0], [7, 31], [20, 20], [40, 40], [33, 2]]) {
      const x = -WORLD.edge + i * cell;
      const z = -WORLD.edge + j * cell;
      expect(drawn(x, z)).toBeCloseTo(height(x, z), 4);
    }
  });

  it('is the terrain’s own triangles between them, not the height function', () => {
    let apart = 0;
    for (let k = 0; k < 200; k++) {
      const x = ((k * 37) % 190) - 95 + 0.31;
      const z = ((k * 53) % 190) - 95 + 0.17;
      ray.set(new THREE.Vector3(x, 100, z), down);
      const hit = ray.intersectObject(mesh)[0];
      expect(drawn(x, z)).toBeCloseTo(hit.point.y, 4);
      apart = Math.max(apart, Math.abs(drawn(x, z) - height(x, z)));
    }
    expect(apart).toBeGreaterThan(0.05);
  });

  it('holds its edge past the edge of the world', () => {
    expect(drawn(1e4, 0)).toBeCloseTo(drawn(WORLD.edge, 0), 6);
    expect(drawn(0, -1e4)).toBeCloseTo(drawn(0, -WORLD.edge), 6);
  });
});
