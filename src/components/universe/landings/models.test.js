import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

// (the loader, as a scene built here: a kit of two models, each a node of
// its own, placed as a compressed file places them, scaled and moved)
const kit = () => {
  const scene = new THREE.Group();
  const holder = new THREE.Group();
  holder.position.set(10, 0, 0);
  holder.scale.setScalar(2);
  scene.add(holder);
  const tree = new THREE.Mesh(new THREE.BoxGeometry(1, 3, 1).translate(0, 1.5, 0), new THREE.MeshStandardMaterial({ color: '#808080' }));
  tree.name = 'Tree_1';
  tree.position.set(0, 0.5, 0);
  holder.add(tree);
  const rock = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 2), new THREE.MeshStandardMaterial({ color: '#ffffff' }));
  rock.name = 'Rock_1';
  rock.position.set(-30, 4, 0);
  scene.add(rock);
  return scene;
};
// (parsed once, as the loader caches it: a fresh copy a use, unless it's a kit's model)
let cached = null;
vi.mock('../../../lib/three/gltf', () => ({ loadGltf: async (url, { fresh } = {}) => ({ scene: fresh ? kit() : (cached ??= kit()) }) }));

const { createModels, foliage, pick, sizeFor, tinted } = await import('./models');

const bounds = (o) => {
  o.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(o);
};

describe('a landing’s models', () => {
  it('bring a model to the size asked, by its height, length or width', () => {
    const size = new THREE.Vector3(2, 4, 3);
    expect(sizeFor(size, { tall: 2 })).toBe(0.5);
    expect(sizeFor(size, { long: 6 })).toBe(2);
    expect(sizeFor(size, { wide: 1.5 })).toBe(0.5);
    expect(sizeFor(size, {})).toBe(1);
  });

  it('take one model out of a kit, where the kit has it', () => {
    const scene = kit();
    const tree = pick(scene, 'Tree_1');
    const b = bounds(tree);
    // (2 × 3 m tall, its foot 2 × 0.5 up, 10 m along: as the kit has it)
    expect(b.min.y).toBeCloseTo(1);
    expect(b.max.y).toBeCloseTo(7);
    expect((b.min.x + b.max.x) / 2).toBeCloseTo(10);
    // (on its own: not the kit's other models)
    let meshes = 0;
    tree.traverse((o) => (meshes += o.isMesh ? 1 : 0));
    expect(meshes).toBe(1);
    // (and the kit's own left as it was)
    expect(scene.getObjectByName('Tree_1').parent.parent).toBe(scene);
    expect(pick(scene, 'Nothing')).toBeNull();
  });

  it('stand a kit’s model on the ground at its size, centred, its footprint known', async () => {
    const models = createModels();
    const tree = await models.get({ url: '/models/kit.glb', node: 'Tree_1', tall: 9 });
    const b = bounds(tree);
    expect(b.min.y).toBeCloseTo(0);
    expect(b.max.y).toBeCloseTo(9);
    expect((b.min.x + b.max.x) / 2).toBeCloseTo(0);
    expect((b.min.z + b.max.z) / 2).toBeCloseTo(0);
    expect(tree.userData.footprint).toBeCloseTo(1.5);
    expect(tree.userData.shared).toBe(true);
    expect(tree.name).toBe('Tree_1');
    expect(await models.get({ url: '/models/kit.glb', node: 'Nothing', tall: 1 })).toBeNull();
    // (a whole file, as before: both models, together)
    const all = await models.get({ url: '/models/kit.glb', wide: 1 });
    expect(bounds(all).min.y).toBeCloseTo(0);
    expect(all.name).toBe('kit.glb');
  });

  it('tint a model with a colour of the landing’s, sharing one material a tint', async () => {
    const models = createModels();
    const a = await models.get({ url: '/models/kit.glb', node: 'Rock_1', long: 1, tint: '#ff8000' });
    const b = await models.get({ url: '/models/kit.glb', node: 'Rock_1', long: 1, tint: '#ff8000' });
    const plain = await models.get({ url: '/models/kit.glb', node: 'Rock_1', long: 1 });
    const mat = (o) => o.getObjectByProperty('isMesh', true).material;
    expect(mat(a).color.getHexString()).toBe('ff8000');
    expect(mat(plain).color.getHexString()).toBe('ffffff');
    // (one tinted copy of a material for every use of that tint)
    const source = new THREE.MeshStandardMaterial({ color: '#808080' });
    expect(tinted(source, '#ff0000')).toBe(tinted(source, '#ff0000'));
    expect(tinted(source, '#ff0000')).not.toBe(source);
    expect(tinted(source, '#ff0000').color.r).toBeCloseTo(source.color.r);
    expect(tinted(source, '#ff0000').color.g).toBe(0);
    expect(source.color.getHexString()).toBe('808080');
    expect(mat(a)).toBe(mat(b));
  });

  it('lights a leaf card’s back as its front (its normals point out of the crown, whichever side you see)', async () => {
    const leaf = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide });
    leaf.userData.foliage = true;
    expect(foliage(leaf)).toBe(leaf);
    const shader = { fragmentShader: '#include <common>\n#include <normal_fragment_begin>\n', vertexShader: '' };
    leaf.onBeforeCompile(shader);
    expect(shader.fragmentShader).toContain('float faceDirection = 1.0;');
    expect(shader.fragmentShader).not.toContain('gl_FrontFacing');
    expect(leaf.customProgramCacheKey()).not.toBe(new THREE.MeshStandardMaterial().customProgramCacheKey());
    // (a tinted copy of a patched leaf, patched too)
    const gold = foliage(tinted(leaf, '#ffcc00'));
    const again = { fragmentShader: '#include <normal_fragment_begin>', vertexShader: '' };
    gold.onBeforeCompile(again);
    expect(again.fragmentShader).toContain('float faceDirection = 1.0;');
    // (and its cut kept as full far off as near: the alpha a mip level
    // averages away given back, between the map's read and the cut)
    const far = { fragmentShader: '#include <map_fragment>\n#include <alphatest_fragment>\n#include <normal_fragment_begin>', vertexShader: '' };
    foliage(Object.assign(new THREE.MeshStandardMaterial(), { userData: { foliage: true } })).onBeforeCompile(far);
    const at = (s) => far.fragmentShader.indexOf(s);
    expect(at('textureSize( map, 0 )')).toBeGreaterThan(at('#include <map_fragment>'));
    expect(at('textureSize( map, 0 )')).toBeLessThan(at('#include <alphatest_fragment>'));
    expect(far.fragmentShader).toContain('diffuseColor.a *=');
    // (anything else as it was)
    const bark = new THREE.MeshStandardMaterial();
    const before = bark.onBeforeCompile;
    foliage(bark);
    expect(bark.onBeforeCompile).toBe(before);
    // (and a model's leaves, as loaded)
    const models = createModels();
    const tree = await models.get({ url: '/models/kit.glb', node: 'Tree_1', tall: 1 });
    expect(tree.getObjectByProperty('isMesh', true).material.userData.foliage).toBeUndefined();
  });
});
