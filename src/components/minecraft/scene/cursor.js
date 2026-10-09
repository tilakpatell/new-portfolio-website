// Minecraft, the block under the crosshair: the game's thin black outline
// (40% black, just proud of the block so it never sinks into it) and, while
// a block is being broken, its crack: the pack's ten destroy stages over
// every face, multiplied into what's under them as the game blends them
// (the texel times the colour behind, twice), so the crack darkens the
// block's own pixels rather than painting over them.
//
// createCursor(scene, { array, layers }) → { set(hit | null, crack: 0–9 | -1), dispose }

import * as THREE from 'three';
import { crackMaterial } from './nodes.js';

export function createCursor(scene, { array, layers }) {
  const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false }));
  outline.visible = false;
  outline.renderOrder = 4;
  scene.add(outline);

  // (the game's crack blend, source × destination + destination × source: nodes.js)
  const { material: crackLook, u: crackU } = crackMaterial({ array, layer: layers[0] ?? 0 });
  const crack = new THREE.Mesh(new THREE.BoxGeometry(1.002, 1.002, 1.002), crackLook);
  crack.visible = false;
  crack.renderOrder = 3;
  scene.add(crack);

  return {
    set(hit, stage = -1) {
      outline.visible = Boolean(hit);
      crack.visible = Boolean(hit) && stage >= 0;
      if (!hit) return;
      outline.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      crack.position.copy(outline.position);
      if (stage >= 0) crackU.layer.value = layers[Math.min(9, stage)];
    },
    dispose() {
      scene.remove(outline);
      scene.remove(crack);
      outline.geometry.dispose();
      outline.material.dispose();
      crack.geometry.dispose();
      crackLook.dispose();
    },
  };
}
