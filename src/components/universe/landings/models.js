// The GLBs a landing stands about (landings.js's `models`): through the
// site's shared loader (lib/three/gltf.js: meshopt, KTX2, cached by URL for
// the page's life), brought to the size the landing asks (by height,
// length or width, in metres), stood on y = 0 and centred; each use a copy
// whose geometry and textures are the cache's, so it's marked `shared` and
// a landing never frees them. A model that won't load is just missing.
//
// createModels({ renderer }) → { get(spec) → Promise<Object3D | null> }

import * as THREE from 'three';
import { loadGltf } from '../../../lib/three/gltf';

// the scale that brings a model of `size` (a Vector3) to the spec's size
export function sizeFor(size, { tall, long, wide } = {}) {
  if (tall) return tall / (size.y || 1);
  if (long) return long / (Math.max(size.x, size.z) || 1);
  if (wide) return wide / (Math.max(size.x, size.z) || 1);
  return 1;
}

export function createModels({ renderer = null } = {}) {
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  const mid = new THREE.Vector3();
  return {
    async get(spec) {
      const got = await loadGltf(spec.url, { renderer, fresh: true });
      if (!got?.scene) return null;
      const inner = got.scene;
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
      object.userData.shared = true;
      return object;
    },
  };
}
