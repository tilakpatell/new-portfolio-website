// The CC0 models the 3D games use (Poly Haven scans, simplified and
// meshopt-compressed by scripts/cc0.mjs into /games/models). A model loads
// once per game, and can be drawn many times as instances: each instance's
// matrix is where it goes times the mesh's own place in the model, so the
// compressed geometry is used exactly as it came.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export function createModels({ base = '/games/models' } = {}) {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const cache = new Map();
  const owned = [];

  // Resolves to { parts: [{ geometry, material, base }], box, size } with the
  // model resting on y = 0 and centred in x and z, or null if it can't load.
  const load = (name) => {
    if (!cache.has(name)) {
      cache.set(
        name,
        loader
          .loadAsync(`${base}/${name}.glb`)
          .then((gltf) => {
            const root = gltf.scene;
            root.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(root);
            const centre = new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
            const parts = [];
            root.traverse((o) => {
              if (!o.isMesh) return;
              parts.push({ geometry: o.geometry, material: o.material, base: centre.clone().multiply(o.matrixWorld) });
              owned.push(o.geometry, o.material);
            });
            const size = box.getSize(new THREE.Vector3());
            return { parts, size, name };
          })
          .catch(() => null),
      );
    }
    return cache.get(name);
  };

  // An instanced copy of a model for `count` placements. set(i, matrix) puts
  // instance i at matrix (or hides it with a zero scale); commit() uploads.
  const instanced = (model, count, { shadow = false, receive = true, scale = 1 } = {}) => {
    const k = new THREE.Matrix4().makeScale(scale, scale, scale);
    const meshes = model.parts.map((p) => {
      const m = new THREE.InstancedMesh(p.geometry, p.material, count);
      m.castShadow = shadow;
      m.receiveShadow = receive;
      m.frustumCulled = false;
      m.userData.shared = true; // the geometry and material belong to the library
      return m;
    });
    const tmp = new THREE.Matrix4();
    return {
      meshes,
      count,
      setMatrixAt(i, matrix) {
        model.parts.forEach((p, j) => meshes[j].setMatrixAt(i, tmp.multiplyMatrices(matrix, k).multiply(p.base)));
      },
      commit() {
        for (const m of meshes) m.instanceMatrix.needsUpdate = true;
      },
      addTo(parent) {
        meshes.forEach((m) => parent.add(m));
      },
    };
  };

  // A single placed copy (for things that move one at a time, like debris).
  const single = (model, scale = 1) => {
    const g = new THREE.Group();
    for (const p of model.parts) {
      const m = new THREE.Mesh(p.geometry, p.material);
      m.matrixAutoUpdate = false;
      m.matrix.copy(new THREE.Matrix4().makeScale(scale, scale, scale).multiply(p.base));
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.shared = true;
      g.add(m);
    }
    return g;
  };

  const dispose = () => {
    for (const o of owned) {
      if (o.isMaterial) for (const v of Object.values(o)) if (v && v.isTexture) v.dispose();
      o.dispose?.();
    }
    owned.length = 0;
    cache.clear();
  };

  return { load, instanced, single, dispose };
}
