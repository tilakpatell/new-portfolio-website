// What the walkable towns (the Shire, Bree) share for drawing: merging the
// buildings that never move into a few meshes, a far-off tree for the hills
// round about, and a soft dot for glints.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Merge every static mesh under `root` that shares a material into one, in
// world space; `keep` (and what's under them) stay as they are, to move.
export function bake(root, keep = []) {
  root.updateMatrixWorld(true);
  const skip = new Set();
  for (const k of keep) k?.traverse((o) => skip.add(o));
  const buckets = new Map();
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || skip.has(o) || Array.isArray(o.material)) return;
    const g = o.geometry;
    const key = `${o.material.uuid}|${g.index ? 'i' : 'n'}|${Object.keys(g.attributes).sort().join()}|${Object.keys(g.morphAttributes).length}|${o.castShadow}|${o.receiveShadow}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(o);
  });
  const out = new THREE.Group();
  out.name = 'baked';
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    const geos = list.map((o) => o.geometry.clone().applyMatrix4(o.matrixWorld));
    let merged = null;
    try {
      merged = mergeGeometries(geos, false);
    } catch {
      merged = null;
    }
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, list[0].material);
    mesh.castShadow = list[0].castShadow;
    mesh.receiveShadow = list[0].receiveShadow;
    out.add(mesh);
    for (const o of list) o.parent?.remove(o);
  }
  return out;
}

// A tree for the far hills: a trunk and three blobs of leaf, in one
// geometry with its colours in the vertices. `leaf` shifts the greens.
export function farTree({ leaf = [0x3f6e2a, 0x4a7a30, 0x36602a], trunk = 0x4a3a28 } = {}) {
  const parts = [];
  const paint = (g, hex) => {
    const c = new THREE.Color(hex);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const k = 0.85 + ((i * 7919) % 13) / 60;
      col.set([c.r * k, c.g * k, c.b * k], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.deleteAttribute('uv');
    return g;
  };
  parts.push(paint(new THREE.CylinderGeometry(0.22, 0.32, 3, 6).translate(0, 1.5, 0), trunk));
  for (const [x, y, z, r, hex, d] of [[0, 3.9, 0, 2.1, leaf[0], 1], [0.9, 3.3, 0.5, 1.5, leaf[1], 0], [-0.8, 3.5, -0.4, 1.6, leaf[2], 0]]) parts.push(paint(new THREE.IcosahedronGeometry(r, d).translate(x, y, z), hex));
  const g = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)), false);
  g.computeVertexNormals();
  return g;
}

// a soft round dot, for the glints
export function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,240,200,0.6)');
  grad.addColorStop(1, 'rgba(255,220,150,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
