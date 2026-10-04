// Small helpers for building models from code: rounded boxes, tapered and
// bent shapes, lathed profiles, and merging many parts that share a material
// into one mesh (one draw call per material, however detailed the model).

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const rbox = (w, h, d, r = Math.min(w, h, d) * 0.18, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, r);

// Scale x and z along y: `bottom` at the lowest point, `top` at the highest.
export function taper(geo, bottom = 1, top = 1, { axis = 'y', zToo = true } = {}) {
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const a = { x: 0, y: 1, z: 2 }[axis];
  const lo = bb.min.getComponent(a);
  const hi = bb.max.getComponent(a);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = hi > lo ? (p.getComponent(i, a) - lo) / (hi - lo) : 0;
    const s = bottom + (top - bottom) * k;
    for (const c of [0, 1, 2]) if (c !== a && (zToo || c === 0)) p.setComponent(i, c, p.getComponent(i, c) * s);
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// A lathed profile: points [[radius, y], ...] from bottom to top.
export const lathe = (pts, seg = 24) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

// A capsule from y = 0 to y = len, radius r (optionally tapering to r2).
export function limb(r, len, r2 = r, seg = 14) {
  const g = new THREE.CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 4, seg);
  g.translate(0, len / 2, 0);
  // taper towards the end
  if (r2 !== r) taper(g, 1, r2 / r);
  return g;
}

// Place a geometry: translate, rotate (euler, radians), scale.
export function placed(geo, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] } = {}) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...(Array.isArray(s) ? s : [s, s, s])));
  return geo.clone().applyMatrix4(m);
}

// Many parts by material key → one mesh per material.
export class PartBuilder {
  constructor() {
    this.parts = new Map();
  }
  add(key, geo, opts) {
    const g = opts ? placed(geo, opts) : geo;
    // every part needs the same attributes to merge
    if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!this.parts.has(key)) this.parts.set(key, []);
    this.parts.get(key).push(g);
    return this;
  }
  // { key: geometry }
  geometries() {
    const out = {};
    for (const [k, list] of this.parts) out[k] = mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)), false);
    return out;
  }
  // a group of meshes, one per material
  build(materials, { shadows = true } = {}) {
    const group = new THREE.Group();
    for (const [k, geo] of Object.entries(this.geometries())) {
      const mesh = new THREE.Mesh(geo, materials[k]);
      mesh.name = k;
      mesh.castShadow = shadows;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    return group;
  }
}

// A canvas texture painted by `draw(ctx, w, h)`.
export function canvasTexture(w, h, draw, { srgb = true, repeat } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  return t;
}
