import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { bakeStatic, shareMaterials } from './batch';

const box = (mat, x = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), mat);
  m.position.set(x, 0.25, z);
  return m;
};
const meshes = (root) => {
  const out = [];
  root.traverse((o) => o.isMesh && out.push(o));
  return out;
};

describe('bakeStatic', () => {
  it('merges what shares a material into one mesh, in place', () => {
    const root = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ map: new THREE.Texture() });
    root.add(box(wood, 0, 0), box(wood, 2, 0), box(wood, 4, 1));
    const r = bakeStatic(root);
    const left = meshes(root);
    expect(left).toHaveLength(1);
    expect(left[0].material).toBe(wood);
    left[0].geometry.computeBoundingBox();
    expect(left[0].geometry.boundingBox.max.x).toBeCloseTo(4.25);
    expect(r.before).toBe(3);
  });

  it('leaves alone what the jobs move, and what is hidden or see-through', () => {
    const root = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ map: new THREE.Texture() });
    const moved = box(mat, 1);
    const hidden = box(mat, 2);
    hidden.visible = false;
    const glass = box(new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.2 }), 3);
    root.add(box(mat), box(mat, 0.5), moved, hidden, glass);
    bakeStatic(root, { keep: [moved] });
    const left = meshes(root);
    expect(left).toContain(moved);
    expect(left).toContain(hidden);
    expect(left).toContain(glass);
    expect(left).toHaveLength(4);
  });

  it('merges plain painted props of different colours by their vertices', () => {
    const root = new THREE.Group();
    root.add(box(new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.5 })), box(new THREE.MeshStandardMaterial({ color: 0x0000ff, roughness: 0.52 }), 1));
    bakeStatic(root);
    const [m] = meshes(root);
    expect(meshes(root)).toHaveLength(1);
    expect(m.material.vertexColors).toBe(true);
    const c = m.geometry.attributes.color;
    const colours = new Set();
    for (let i = 0; i < c.count; i++) colours.add(`${c.getX(i).toFixed(2)},${c.getZ(i).toFixed(2)}`);
    expect(colours).toEqual(new Set(['1.00,0.00', '0.00,1.00']));
  });

  it('keeps a patch of floor apart from the next', () => {
    const root = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ map: new THREE.Texture() });
    root.add(box(mat, 0), box(mat, 1), box(mat, 30), box(mat, 31));
    bakeStatic(root, { cell: 10 });
    expect(meshes(root)).toHaveLength(2);
  });

  it('turns off the shadows of small things', () => {
    const root = new THREE.Group();
    const a = box(new THREE.MeshStandardMaterial({ map: new THREE.Texture() }));
    a.castShadow = true;
    root.add(a);
    bakeStatic(root, { shadowMin: 0.6 });
    expect(a.castShadow).toBe(false);
  });

  it('keeps a mirrored mesh facing out', () => {
    const root = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ map: new THREE.Texture() });
    const a = box(mat);
    const b = box(mat, 2);
    b.scale.x = -1;
    root.add(a, b);
    bakeStatic(root);
    const [m] = meshes(root);
    // each triangle's winding agrees with its normal
    const g = m.geometry;
    const p = g.attributes.position;
    const n = g.attributes.normal;
    const idx = g.index.array;
    const v = (i) => new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
    for (let t = 0; t < idx.length; t += 3) {
      const [i0, i1, i2] = [idx[t], idx[t + 1], idx[t + 2]];
      const face = v(i1).sub(v(i0)).cross(v(i2).sub(v(i0)));
      expect(face.dot(new THREE.Vector3(n.getX(i0), n.getY(i0), n.getZ(i0)))).toBeGreaterThan(0);
    }
  });
});

describe('shareMaterials', () => {
  it('makes materials that look the same one material', () => {
    const root = new THREE.Group();
    const a = box(new THREE.MeshStandardMaterial({ color: 0x123456, roughness: 0.4 }));
    const b = box(new THREE.MeshStandardMaterial({ color: 0x123456, roughness: 0.4 }));
    const c = box(new THREE.MeshStandardMaterial({ color: 0x123457, roughness: 0.4 }));
    root.add(a, b, c);
    expect(shareMaterials(root)).toBe(1);
    expect(a.material).toBe(b.material);
    expect(c.material).not.toBe(a.material);
  });
});
