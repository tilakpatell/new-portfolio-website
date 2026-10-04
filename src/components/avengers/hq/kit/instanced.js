// A pool of copies of a many-part model: one InstancedMesh per part, all
// moved together, so a crowd of drones or arrows is one draw call per material.

import * as THREE from 'three';

export function instanced(geos, mats, max, { shadows = true, noShadow = [] } = {}) {
  const group = new THREE.Group();
  const meshes = [];
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (const [k, g] of Object.entries(geos)) {
    const m = new THREE.InstancedMesh(g, mats[k], max);
    m.name = k;
    m.castShadow = shadows && !noShadow.includes(k);
    m.receiveShadow = true;
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < max; i++) m.setMatrixAt(i, zero);
    group.add(m);
    meshes.push(m);
  }
  let n = 0;
  return {
    group,
    meshes,
    // start a frame, set instances, finish
    begin() {
      n = 0;
    },
    // `colors` tints parts of this copy: { partName: THREE.Color }
    set(matrix, colors) {
      if (n >= max) return;
      for (const m of meshes) {
        m.setMatrixAt(n, matrix);
        const c = colors?.[m.name];
        if (c) m.setColorAt(n, c);
      }
      n++;
    },
    end() {
      for (const m of meshes) {
        for (let i = n; i < max; i++) m.setMatrixAt(i, zero);
        m.count = Math.max(n, 1);
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }
    },
    get count() {
      return n;
    },
  };
}
