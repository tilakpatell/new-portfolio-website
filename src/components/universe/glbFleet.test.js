import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

// the page's model cache, stood in for: each url loads as the test says
const loads = new Map();
vi.mock('../../lib/three/gltfCache', () => ({
  loadGLTF: vi.fn((url) => loads.get(url) ?? Promise.reject(new Error('no such model'))),
  cloneScene: (gltf) => gltf.scene.clone(),
}));

const { createFleet } = await import('./glbFleet');
const { loadGLTF } = await import('../../lib/three/gltfCache');

const glb = { good: { url: 'good.glb', nose: 0, built: true }, bad: { url: 'bad.glb', nose: 0, built: false } };
const built = (kind) => {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
  group.name = kind;
  return { group, size: new THREE.Vector3(1, 1, 1), update() {}, dispose: vi.fn() };
};
const model = () => {
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1), new THREE.MeshStandardMaterial()));
  return { scene };
};

beforeEach(() => {
  loads.clear();
  loadGLTF.mockClear();
});

describe('glbFleet', () => {
  it("want() resolves, never rejects, when a model doesn't load", async () => {
    const fleet = createFleet({ build: built, glb });
    await expect(fleet.want(['bad'])).resolves.toBeUndefined();
    expect(fleet.loaded('bad')).toBe(false);
  });

  it('a kind wanted again shares the first load', async () => {
    loads.set('good.glb', Promise.resolve(model()));
    const fleet = createFleet({ build: built, glb });
    const a = fleet.want(['good']);
    const b = fleet.want(['good', 'notamodel']);
    await Promise.all([a, b]);
    expect(loadGLTF).toHaveBeenCalledTimes(1);
    expect(fleet.loaded('good')).toBe(true);
  });

  it('roots() lists the built ships made ahead and the loaded models', async () => {
    const fleet = createFleet({ build: built, glb });
    const one = built('tie');
    const two = built('tie');
    fleet.stock('tie', one);
    fleet.stock('tie', two);
    expect(fleet.roots()).toEqual([one.group, two.group]);
    loads.set('good.glb', Promise.resolve(model()));
    await fleet.want(['good']);
    const roots = fleet.roots();
    expect(roots).toHaveLength(3);
    expect(roots).toContain(one.group);
    // (a model's root is its holder, not in any scene)
    expect(roots.find((r) => r !== one.group && r !== two.group).parent).toBeNull();
  });
});
