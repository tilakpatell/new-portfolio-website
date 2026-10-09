// An instanced pool of one shape (the Expanse’s, moved down so every world
// can have one): one InstancedMesh, its slots taken, placed and freed; a free
// slot is scaled to nothing, so it draws nothing. One draw a kind of thing,
// however many of them there are. A slot placed or freed lets the bounds be
// found again at the next draw (three finds them once, at the first, when
// every slot is at nothing, and would cull the pool for good).
//
//   pool(geometry, material, count, name) → { mesh, take() → slot | −1,
//     place(i, position, quaternion, scale = 1), free(i), dispose() }

import * as THREE from 'three';

export function pool(geometry, material, count, name) {
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const free = [];
  for (let i = count - 1; i >= 0; i--) {
    free.push(i);
    mesh.setMatrixAt(i, zero);
  }
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  return {
    mesh,
    take: () => (free.length ? free.pop() : -1),
    place(i, position, quaternion, scale = 1) {
      mesh.setMatrixAt(i, m.compose(p.fromArray(position), q.fromArray(quaternion), s.setScalar(scale)));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.boundingSphere = null;
    },
    free(i) {
      mesh.setMatrixAt(i, zero);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.boundingSphere = null;
      free.push(i);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
