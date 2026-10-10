// The other pilots' ships (./online.js's peers()), drawn from one pool of
// the wedge, a slot a pilot: a peer who goes quiet, or flies out of the
// cells round you, is no longer listed, and their slot is let go of. Their
// hulls are the look's ice blue, so they read apart from yours.
//
//   createPeers(parent, palette) → { draw(list, at), count(), dispose() }

import * as THREE from 'three';
import { createPool } from './pools';
import { wedgeGeometry } from './models';
import { MAX_PEERS } from './online';

export function createPeers(parent, palette) {
  const pool = createPool(parent, wedgeGeometry(), new THREE.MeshStandardMaterial({ color: palette[3], roughness: 0.6, metalness: 0.2, flatShading: true, side: THREE.DoubleSide }), MAX_PEERS);
  const seen = new Set();
  return {
    draw(list, at) {
      seen.clear();
      for (const { id, pose } of list) {
        if (pool.add(id) < 0) continue;
        seen.add(id);
        // (scene.js's own ship: pitch, yaw, then the roll the other way)
        pool.place(id, pose.x, pose.y, pose.z, pose.yaw, pose.pitch, -pose.roll);
      }
      for (const id of [...pool.ids()]) if (!seen.has(id)) pool.free(id);
      pool.draw(at);
    },
    count: () => pool.size,
    dispose: () => pool.dispose(),
  };
}
