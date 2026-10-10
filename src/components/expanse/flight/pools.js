// One InstancedMesh as a pool of slots, a slot a thing by its id: one draw
// however many there are. A slot is placed in world metres and drawn
// relative to the floating origin (`at`, rt.origin's), so the matrices are
// written again each frame from where each thing is; a slot let go of is
// scaled to nothing and handed to the next. Over `max`, a thing is not
// drawn (and `add` says so with -1) rather than growing the buffer mid-flight.
//
//   createPool(parent, geometry, material, max) → { add(id), has(id), free(id),
//     place(id, x, y, z, yaw, pitch, roll, scale), tint(id, color), draw(at),
//     ids(), size, dispose() }

import * as THREE from 'three';

const NONE = new THREE.Matrix4().makeScale(0, 0, 0);
const WHITE = new THREE.Color(1, 1, 1);

export function createPool(parent, geometry, material, max) {
  const mesh = new THREE.InstancedMesh(geometry, material, max);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // (the instances move with the origin, wherever they are: the mesh's own bounds mean nothing)
  mesh.frustumCulled = false;
  for (let i = 0; i < max; i++) mesh.setMatrixAt(i, NONE);
  parent.add(mesh);
  const slots = new Map(); // id → { i, x, y, z, yaw, pitch, roll, scale }
  const free = [];
  for (let i = max - 1; i >= 0; i--) free.push(i);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler(0, 0, 0, 'YXZ');
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  let dirty = true;

  return {
    mesh,
    add(id) {
      if (slots.has(id)) return slots.get(id).i;
      const i = free.pop();
      if (i === undefined) return -1;
      slots.set(id, { i, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, scale: 1 });
      return i;
    },
    has: (id) => slots.has(id),
    free(id) {
      const slot = slots.get(id);
      if (!slot) return;
      slots.delete(id);
      mesh.setMatrixAt(slot.i, NONE);
      // (its next thing starts untinted)
      if (mesh.instanceColor) mesh.setColorAt(slot.i, WHITE);
      free.push(slot.i);
      dirty = true;
    },
    place(id, x, y, z, yaw = 0, pitch = 0, roll = 0, scale = 1) {
      const slot = slots.get(id);
      if (slot) Object.assign(slot, { x, y, z, yaw, pitch, roll, scale });
    },
    tint(id, color) {
      const slot = slots.get(id);
      if (!slot) return;
      mesh.setColorAt(slot.i, color);
      mesh.instanceColor.needsUpdate = true;
    },
    // every slot's matrix, from where it is and the origin's `at`
    draw(at) {
      if (!slots.size && !dirty) return;
      for (const slot of slots.values()) {
        e.set(slot.pitch, slot.yaw, slot.roll);
        q.setFromEuler(e);
        p.set(slot.x - at[0], slot.y - at[1], slot.z - at[2]);
        s.setScalar(slot.scale);
        mesh.setMatrixAt(slot.i, m.compose(p, q, s));
      }
      mesh.instanceMatrix.needsUpdate = true;
      dirty = false;
    },
    ids: () => slots.keys(),
    get size() {
      return slots.size;
    },
    dispose() {
      parent.remove(mesh);
      mesh.dispose();
      geometry.dispose();
      material.dispose();
    },
  };
}
