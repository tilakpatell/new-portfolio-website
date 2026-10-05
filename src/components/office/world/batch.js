// The office's furniture never moves, so it needn't be drawn piece by
// piece: every mesh that stays put is baked into its world position and
// merged with the others that share its material, a few metres of floor at
// a time (so what's behind the camera is still culled). A few hundred desks,
// chairs, phones, keyboards and signs become a few dozen draws.
//
// bakeStatic(root, { keep, cell, shadowMin }) → { meshes, before, after, dispose() }
//   keep       objects (and everything under them) left alone: the things
//              the jobs move, hide or show
//   cell       the size of a patch of floor, in metres
//   shadowMin  anything smaller than this (metres, its longest side) stops
//              casting a shadow: a phone's or a mug's is a few pixels the
//              shadow map has to draw it all again for, and the contact
//              shade (./ao.js) grounds them anyway
//
// Left as they are: skinned, instanced and morphing meshes, transparent
// materials (they sort back to front one object at a time), multi-material
// meshes, and anything invisible.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const signature = (g) =>
  Object.keys(g.attributes)
    .sort()
    .map((k) => `${k}${g.attributes[k].itemSize}${g.attributes[k].normalized ? 'n' : ''}`)
    .join(',') + (g.index ? '|i' : '|n');

// a mesh's geometry, moved to where it is in the world (winding kept right
// when a mirror flips it)
function baked(mesh) {
  const g = mesh.geometry.clone();
  for (const k of Object.keys(g.morphAttributes)) delete g.morphAttributes[k];
  g.clearGroups();
  g.applyMatrix4(mesh.matrixWorld);
  if (mesh.matrixWorld.determinant() < 0) {
    if (g.index) {
      const a = g.index.array;
      for (let i = 0; i < a.length; i += 3) {
        const t = a[i + 1];
        a[i + 1] = a[i + 2];
        a[i + 2] = t;
      }
    } else {
      for (const attr of Object.values(g.attributes)) {
        const n = attr.itemSize;
        const arr = attr.array;
        for (let v = 0; v < attr.count; v += 3)
          for (let c = 0; c < n; c++) {
            const t = arr[(v + 1) * n + c];
            arr[(v + 1) * n + c] = arr[(v + 2) * n + c];
            arr[(v + 2) * n + c] = t;
          }
      }
    }
  }
  return g;
}

// Materials made one per prop (every mug, phone and sign builds its own)
// that are the same in every way that shows are made one material, so their
// meshes can merge. Textures count as the same when they're the same image
// laid the same way.
const texKey = (t) => (t ? [t.source.uuid, t.repeat.x, t.repeat.y, t.offset.x, t.offset.y, t.rotation, t.wrapS, t.wrapT, t.colorSpace, t.flipY].join('/') : '-');
const PROPS = ['color', 'emissive', 'roughness', 'metalness', 'emissiveIntensity', 'opacity', 'transparent', 'alphaTest', 'side', 'flatShading', 'depthWrite', 'depthTest', 'toneMapped', 'vertexColors', 'envMapIntensity', 'polygonOffset', 'polygonOffsetFactor', 'polygonOffsetUnits', 'visible', 'wireframe', 'fog'];
const MAPS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'alphaMap', 'aoMap', 'bumpMap', 'envMap', 'lightMap'];
function materialKey(m) {
  if (m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile || m.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey) return null;
  const v = (x) => (x?.isColor ? x.getHexString() : x);
  return [m.type, ...PROPS.map((k) => v(m[k])), m.normalScale ? `${m.normalScale.x},${m.normalScale.y}` : '', ...MAPS.map((k) => texKey(m[k]))].join('|');
}
export function shareMaterials(root, kept = new Set()) {
  const seen = new Map();
  let shared = 0;
  root.traverse((o) => {
    if (!o.isMesh || kept.has(o) || Array.isArray(o.material) || o.isSkinnedMesh) return;
    const key = materialKey(o.material);
    if (!key) return;
    const first = seen.get(key);
    if (!first) seen.set(key, o.material);
    else if (first !== o.material) {
      o.material = first;
      shared += 1;
    }
  });
  return shared;
}

// A plain painted material (one colour, no textures, nothing glowing) can
// give its colour to its vertices instead: then every plain prop with about
// the same finish (roughness and metalness to the nearest step, which nobody
// can tell apart) merges into one draw however many colours it comes in.
const STEP = 0.125;
const near = (v) => Math.round(v / STEP) * STEP;
function tintKey(m, g) {
  if (!m.isMeshStandardMaterial || m.isMeshPhysicalMaterial || m.transparent || m.vertexColors || g.attributes.color) return null;
  if (MAPS.some((k) => m[k]) || (m.emissive && m.emissive.getHex() !== 0 && m.emissiveIntensity > 0)) return null;
  if (m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) return null;
  return ['tint', near(m.roughness), near(m.metalness), m.side, m.flatShading, m.alphaTest, m.envMapIntensity].join('|');
}
// the merged material for a tint key: white, coloured by the vertices
function tintMaterial(from) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: near(from.roughness), metalness: near(from.metalness), side: from.side, flatShading: from.flatShading, envMapIntensity: from.envMapIntensity });
  m.name = 'tinted';
  return m;
}
function tinted(geo, color) {
  const n = geo.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    a[i * 3] = color.r;
    a[i * 3 + 1] = color.g;
    a[i * 3 + 2] = color.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}

export function bakeStatic(root, { keep = [], cell = 10, shadowMin = 0 } = {}) {
  root.updateMatrixWorld(true);
  const kept = new Set();
  for (const k of keep) k?.traverse?.((o) => kept.add(o));
  shareMaterials(root, kept);
  const groups = new Map();
  const tints = new Map(); // tint key → its material
  let before = 0;
  const box = new THREE.Box3();
  const mid = new THREE.Vector3();
  const size = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh || kept.has(o)) return;
    if (o.isSkinnedMesh || o.isInstancedMesh || Array.isArray(o.material) || !o.geometry?.attributes?.position) return;
    if (o.material.transparent || Object.keys(o.geometry.morphAttributes).length) return;
    // hidden, or under something hidden
    for (let p = o; p; p = p.parent) if (!p.visible) return;
    before += 1;
    box.setFromObject(o).getCenter(mid);
    if (o.castShadow && shadowMin > 0 && Math.max(...box.getSize(size).toArray()) < shadowMin) o.castShadow = false;
    const tint = tintKey(o.material, o.geometry);
    const key = [tint ?? o.material.uuid, Math.floor(mid.x / cell), Math.floor(mid.z / cell), o.castShadow ? 1 : 0, o.receiveShadow ? 1 : 0, o.renderOrder, signature(o.geometry)].join(':');
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { material: o.material, tint: tint && (tints.get(tint) ?? tints.set(tint, tintMaterial(o.material)).get(tint)), cast: o.castShadow, receive: o.receiveShadow, order: o.renderOrder, list: [] }));
    g.list.push(o);
  });
  const meshes = [];
  const home = root.matrixWorld.clone().invert();
  const moved = !home.equals(new THREE.Matrix4());
  for (const g of groups.values()) {
    if (g.list.length < 2) continue;
    const merged = mergeGeometries(g.list.map((o) => (g.tint ? tinted(baked(o), o.material.color) : baked(o))), false);
    if (!merged) continue;
    if (moved) merged.applyMatrix4(home);
    const m = new THREE.Mesh(merged, g.tint ?? g.material);
    m.castShadow = g.cast;
    m.receiveShadow = g.receive;
    m.renderOrder = g.order;
    m.matrixAutoUpdate = false;
    m.name = 'baked';
    for (const o of g.list) o.removeFromParent();
    root.add(m);
    meshes.push(m);
  }
  let after = 0;
  root.traverse((o) => o.isMesh && (after += 1));
  return {
    meshes,
    before,
    after,
    dispose() {
      for (const m of meshes) m.geometry.dispose();
      for (const t of tints.values()) t.dispose();
    },
  };
}
