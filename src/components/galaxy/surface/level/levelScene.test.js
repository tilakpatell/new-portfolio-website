import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { writeInstances } from '../../../../lib/level/instances';
import { createLevelScene } from './levelScene';

// the fixture's pack: a rock (two in cell 0,0), a crate mirrored (one in 0,0),
// a hangar in 1,0; the far list has all four
const glb = (m) => ({ far: `m${m}.far.glb`, lod1: `m${m}.lod1.glb`, plain: `m${m}.plain.glb`, ultra: `m${m}.ultra.glb` });
const all = { low: 'lod1', mid: 'lod1', high: 'plain', ultra: 'ultra' };
const pack = {
  cell: 128,
  meshes: [{ glb: glb(0) }, { glb: glb(1) }, { glb: glb(2) }],
  cells: {
    '0,0': { draws: [{ mesh: 0, offset: 0, count: 2, mirrored: false, lod: all }, { mesh: 2, offset: 2, count: 1, mirrored: true, lod: all }] },
    '1,0': { draws: [{ mesh: 1, offset: 0, count: 1, mirrored: false, lod: all }] },
  },
  far: {
    draws: [
      { mesh: 0, offset: 0, count: 2, mirrored: false, lod: { high: 'far' }, cells: { '0,0': [0, 2] } },
      { mesh: 1, offset: 2, count: 1, mirrored: false, lod: { high: 'far' }, cells: { '1,0': [0, 1] } },
      { mesh: 2, offset: 3, count: 1, mirrored: true, lod: { high: 'far' }, cells: { '0,0': [0, 1] } },
    ],
  },
};
const recs = (list) => writeInstances({ count: list.length, position: new Float32Array(list.flatMap((r) => r[0])), quaternion: new Float32Array(list.flatMap(() => [0, 0, 0, 1])), scale: new Float32Array(list.flatMap((r) => r[1] ?? [1, 1, 1])) });
const cell00 = recs([[[1, 0, 1]], [[2, 0, 2]], [[3, 0, 3], [-1, 1, 1]]]);
const cell10 = recs([[[130, 0, 1]]]);
const far = recs([[[1, 0, 1]], [[2, 0, 2]], [[130, 0, 1]], [[3, 0, 3], [-1, 1, 1]]]);

// a GLB that is one indexed triangle pair, as the loader gives it
const loadGltf = async () => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0], 3));
  g.setIndex([0, 1, 2, 2, 1, 3]);
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial()));
  return { scene };
};

const meshes = (scene) => {
  const out = [];
  scene.traverse((o) => o.isInstancedMesh && out.push(o));
  return out;
};
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('createLevelScene', () => {
  it('draws one InstancedMesh per mesh, cut and side, with the right counts', async () => {
    const scene = new THREE.Scene();
    const level = createLevelScene({ scene, pack, loadGltf, tier: 'high' });
    level.addCell('0,0', cell00, 'near');
    await settle();
    const ims = meshes(scene);
    expect(ims.length).toBe(2);
    expect(ims.map((m) => m.count).sort()).toEqual([1, 2]);
    expect(level.stats()).toEqual({ tris: 6, calls: 2, cells: 1 });
    level.dispose();
  });

  it('gives a mirrored draw its own mesh with its triangles wound the other way', async () => {
    const scene = new THREE.Scene();
    const level = createLevelScene({ scene, pack, loadGltf, tier: 'high' });
    level.addCell('0,0', cell00, 'near');
    await settle();
    const mirrored = meshes(scene).find((m) => m.userData.mirrored);
    const plain = meshes(scene).find((m) => !m.userData.mirrored);
    expect(Array.from(plain.geometry.index.array.slice(0, 3))).toEqual([0, 1, 2]);
    expect(Array.from(mirrored.geometry.index.array.slice(0, 3))).toEqual([0, 2, 1]);
    // (so the material keeps its own side: a back-side material would flip the normals too)
    expect(mirrored.material.side).toBe(THREE.FrontSide);
    const m = new THREE.Matrix4();
    mirrored.getMatrixAt(0, m);
    expect(m.determinant()).toBeLessThan(0);
    level.dispose();
  });

  it('the far list stands in for a cell until the cell is drawn, and again after it goes', async () => {
    const scene = new THREE.Scene();
    const level = createLevelScene({ scene, pack, loadGltf, tier: 'high' });
    level.setFar(far);
    await settle();
    const farCount = () => meshes(scene).filter((m) => m.userData.cut === 'far').reduce((a, m) => a + m.count, 0);
    expect(farCount()).toBe(4);
    level.addCell('0,0', cell00, 'near');
    await settle();
    expect(farCount()).toBe(1); // (the hangar's, in 1,0)
    level.removeCell('0,0');
    await settle();
    expect(farCount()).toBe(4);
    expect(meshes(scene).filter((m) => m.userData.cut !== 'far').every((m) => m.count === 0)).toBe(true);
    level.dispose();
    expect(meshes(scene).length).toBe(0);
  });

  it('a cell moving from mid to near changes its cut, not its count', async () => {
    const scene = new THREE.Scene();
    const level = createLevelScene({ scene, pack, loadGltf, tier: 'high' });
    level.addCell('1,0', cell10, 'mid');
    await settle();
    expect(meshes(scene).filter((m) => m.count).map((m) => m.userData.cut)).toEqual(['lod1']);
    level.addCell('1,0', cell10, 'near');
    await settle();
    expect(meshes(scene).filter((m) => m.count).map((m) => m.userData.cut)).toEqual(['plain']);
    expect(level.stats().cells).toBe(1);
    level.dispose();
  });

  it('a mesh that fails to load draws nothing and breaks nothing', async () => {
    const scene = new THREE.Scene();
    const level = createLevelScene({ scene, pack, loadGltf: async () => null, tier: 'high' });
    level.addCell('0,0', cell00, 'near');
    await settle();
    expect(meshes(scene).length).toBe(0);
    level.dispose();
  });
});
