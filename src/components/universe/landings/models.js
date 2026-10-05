// The GLBs a landing stands about (landings.js's `models`): loaded once a
// landing (meshopt, as the site's models are), brought to the size the
// landing asks (by height, length or width, in metres), stood on y = 0 and
// centred; each use a clone. A model that won't load is just missing.
//
// createModels() → { get(spec) → Promise<Object3D | null>, dispose() }

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { disposeTree } from '../../../lib/three/renderer';

// the scale that brings a model of `size` (a Vector3) to the spec's size
export function sizeFor(size, { tall, long, wide } = {}) {
  if (tall) return tall / (size.y || 1);
  if (long) return long / (Math.max(size.x, size.z) || 1);
  if (wide) return wide / (Math.max(size.x, size.z) || 1);
  return 1;
}

export function createModels() {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const loads = new Map(); // url → Promise<gltf scene | null>
  const made = [];
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  const mid = new THREE.Vector3();
  const load = (url) => {
    if (!loads.has(url)) loads.set(url, loader.loadAsync(url).then((g) => g.scene, () => null));
    return loads.get(url);
  };
  return {
    async get(spec) {
      const scene = await load(spec.url);
      if (!scene) return null;
      const inner = cloneSkinned(scene);
      inner.updateMatrixWorld(true);
      box.setFromObject(inner);
      box.getSize(size);
      box.getCenter(mid);
      const k = sizeFor(size, spec);
      inner.scale.multiplyScalar(k);
      inner.position.set(-mid.x * k, -box.min.y * k + (spec.y ?? 0), -mid.z * k);
      const object = new THREE.Group();
      object.name = spec.url.split('/').pop();
      object.rotation.y = spec.yaw ?? 0;
      object.add(inner);
      object.userData.footprint = (Math.max(size.x, size.z) * k) / 2;
      made.push(object);
      return object;
    },
    dispose() {
      for (const o of made) disposeTree(o);
      made.length = 0;
      for (const p of loads.values()) p.then((s) => s && disposeTree(s));
      loads.clear();
    },
  };
}
