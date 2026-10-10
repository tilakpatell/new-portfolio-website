// Minecraft, the items lying about: a dropped block is a quarter-size copy
// of itself, a plant or an item its tile on a little card, each turning and
// bobbing as the game's do (a turn every 6 seconds, a tenth of a block up
// and down), lit by the face shades the world uses.
//
// createDrops(scene, { blocks, items, blockLayers, itemLayers, colours }) →
//   { sync(drops, ticks), dispose }

import * as THREE from 'three';
import { BLOCKS, TINTS } from '../rules/blocks.js';
import { ITEMS } from '../rules/items.js';
import { dropMaterial } from './nodes.js';

// a box's faces go +x, −x, +y, −y, +z, −z
const BOX = [
  ['east', 0.6],
  ['west', 0.6],
  ['top', 1],
  ['bottom', 0.5],
  ['south', 0.8],
  ['north', 0.8],
];

export function createDrops(scene, { blocks, items, blockLayers, itemLayers, colours }) {
  const group = new THREE.Group();
  group.name = 'drops';
  scene.add(group);
  const blockMat = dropMaterial(blocks);
  const itemMat = items ? dropMaterial(items) : null;
  const geometries = new Map();
  const tintOf = (b, face) => {
    const name = TINTS[Math.max(0, TINTS.indexOf(b.tint))];
    if (!name || (b.tintTopOnly && face !== 'top')) return [1, 1, 1];
    const c = colours[name];
    return c ? c.map((v) => v / 255) : [1, 1, 1];
  };

  // one geometry (and its material) per item, made the first time it's dropped
  function shapeOf(name) {
    if (geometries.has(name)) return geometries.get(name);
    const it = ITEMS[name];
    let made = null;
    if (it?.icon === 'cube') {
      const b = BLOCKS[it.block];
      const g = new THREE.BoxGeometry(0.25, 0.25, 0.25).translate(0, 0.125, 0);
      const layer = new Float32Array(24);
      const tint = new Float32Array(72);
      BOX.forEach(([face, shade], f) => {
        const t = tintOf(b, face).map((v) => v * shade);
        for (let k = 0; k < 4; k++) {
          layer[f * 4 + k] = blockLayers.get(b.faces[face]) ?? 0;
          tint.set(t, (f * 4 + k) * 3);
        }
      });
      g.setAttribute('layer', new THREE.BufferAttribute(layer, 1));
      g.setAttribute('tint', new THREE.BufferAttribute(tint, 3));
      made = { geometry: g, material: blockMat };
    } else if (it) {
      const g = new THREE.PlaneGeometry(0.5, 0.5).translate(0, 0.25, 0);
      const flat = it.icon === 'flat';
      const b = flat ? BLOCKS[it.block] : null;
      const l = flat ? blockLayers.get(b.faces.north) ?? 0 : itemLayers.get(it.texture) ?? 0;
      const t = flat ? tintOf(b, 'north') : [1, 1, 1];
      g.setAttribute('layer', new THREE.BufferAttribute(new Float32Array(4).fill(l), 1));
      g.setAttribute('tint', new THREE.BufferAttribute(new Float32Array([...t, ...t, ...t, ...t]), 3));
      made = { geometry: g, material: flat || !itemMat ? blockMat : itemMat };
    }
    geometries.set(name, made);
    return made;
  }

  const shown = new Map(); // drop → mesh
  return {
    sync(drops, ticks) {
      const live = new Set(drops);
      for (const [d, m] of shown)
        if (!live.has(d)) {
          group.remove(m);
          shown.delete(d);
        }
      for (const d of drops) {
        let m = shown.get(d);
        if (!m) {
          const shape = shapeOf(d.item);
          if (!shape) continue;
          m = new THREE.Mesh(shape.geometry, shape.material);
          m.userData.phase = (d.x * 7.3 + d.z * 3.1) % (Math.PI * 2);
          shown.set(d, m);
          group.add(m);
        }
        const t = (d.age ?? 0) + (ticks % 1);
        m.position.set(d.x, d.y + 0.1 + Math.sin(t / 10 + m.userData.phase) * 0.1, d.z);
        m.rotation.y = t / 20 + m.userData.phase;
      }
    },
    dispose() {
      scene.remove(group);
      for (const s of geometries.values()) s?.geometry.dispose();
      blockMat.dispose();
      itemMat?.dispose();
    },
  };
}
