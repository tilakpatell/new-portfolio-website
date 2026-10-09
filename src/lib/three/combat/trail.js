// The ribbon behind a lightsaber's blade through a stroke: the blade's last
// frames as lib/combat/blade.js keeps them (its ring buffer, the same one
// its sweep tests), each a hilt-to-tip line, joined into a strip that's
// drawn additive over the scene. The newest frame is at the front; once
// the stroke's over it shortens a frame at a time and is gone. One per
// blade: a staff's two and a pair's two each draw their own.
//
//   createTrail(parent, { color, length = 14 }) → {
//     sync(frames, on): frames, oldest first ({ base, tip } as [x, y, z]),
//       drawn while `on`; off, the strip shortens a frame each call
//     color(c), dispose()
//   }

import * as THREE from 'three';

export function createTrail(parent, { color = '#4aa8ff', length = 14 } = {}) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(length * 2 * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const idx = [];
  for (let i = 0; i < length - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  geo.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.visible = false;
  parent?.add(mesh);
  let shown = 0; // frames drawn
  let last = []; // what was drawn, newest first, for the shortening after
  return {
    mesh,
    sync(frames, on) {
      if (on && frames.length) {
        last = frames.slice(-length).reverse();
        shown = last.length;
      } else shown = Math.max(0, shown - 1);
      mesh.visible = shown > 1;
      if (!mesh.visible) return;
      for (let i = 0; i < length; i++) {
        const f = last[Math.min(i, shown - 1)];
        pos.set([f.base[0], f.base[1], f.base[2], f.tip[0], f.tip[1], f.tip[2]], i * 6);
      }
      geo.attributes.position.needsUpdate = true;
    },
    color(c) {
      mat.color.set(c);
    },
    dispose() {
      mesh.removeFromParent();
      geo.dispose();
      mat.dispose();
    },
  };
}
