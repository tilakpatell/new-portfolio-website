// What's round the lot: an overcast Pennsylvania sky with slow grey cloud
// (the same sky the office's windows look out on), a ring of trees and the
// business park's low buildings on every horizon so the lot isn't an island,
// and the lot's own trees, each grown from a seed: a trunk that leans a
// little, three or four boughs and a crown of lumpy clumps, darker under
// than on top.
//
// buildScenery({ centre }) → { group, step(t), dispose() }
// makeTree(seed) → { bark, leaves } geometries (a tree at the origin, ~6 m tall)

import * as THREE from 'three';
import { rng } from '../../../lib/texture';
import { parkStrip } from './windows';

const SKY_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec3 vDir;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; }
    return s;
  }
  void main() {
    vec3 v = normalize(vDir);
    float up = clamp(v.y, 0.0, 1.0);
    vec3 c = mix(vec3(0.8, 0.84, 0.87), vec3(0.52, 0.61, 0.73), smoothstep(0.02, 0.6, up));
    vec2 q = v.xz / max(v.y, 0.05) * 0.5 + vec2(uTime * 0.003, 0.0);
    c = mix(c, vec3(0.93, 0.93, 0.92), smoothstep(0.42, 0.78, fbm(q * 1.4)) * 0.7 * smoothstep(0.0, 0.08, v.y));
    c = mix(c, vec3(0.62, 0.65, 0.7), smoothstep(0.55, 0.9, fbm(q * 2.6 + 3.1)) * 0.45 * smoothstep(0.0, 0.08, v.y));
    // below the horizon: the haze over the land
    c = mix(c, vec3(0.62, 0.66, 0.62), smoothstep(0.0, -0.06, v.y));
    gl_FragColor = vec4(c * 1.18, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww; // on the far plane, behind everything
  }`;
// the horizon's ring: the painted tree line, cut out by its mask, hazed
const RING_FRAG = /* glsl */ `
  uniform sampler2D uMap, uMask;
  varying vec2 vUv;
  void main() {
    if (texture2D(uMask, vUv).r < 0.5) discard;
    vec3 c = mix(texture2D(uMap, vUv).rgb, vec3(0.74, 0.78, 0.8), 0.28);
    gl_FragColor = vec4(c, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const RING_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

export function buildScenery({ centre }) {
  const group = new THREE.Group();
  group.name = 'scenery';
  const own = [];
  const keep = (x) => (own.push(x), x);
  const sky = new THREE.Mesh(keep(new THREE.SphereGeometry(150, 32, 16)), keep(new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false })));
  sky.position.set(centre.x, 0, centre.z);
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  group.add(sky);
  // the tree line, 70 m out all round, 18 m tall, the strip repeated eight times
  const [map, mask] = parkStrip().map(keep);
  const ringGeo = keep(new THREE.CylinderGeometry(70, 70, 18, 96, 1, true));
  const uv = ringGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 8);
  const ring = new THREE.Mesh(ringGeo, keep(new THREE.ShaderMaterial({ uniforms: { uMap: { value: map }, uMask: { value: mask } }, vertexShader: RING_VERT, fragmentShader: RING_FRAG, side: THREE.BackSide })));
  ring.position.set(centre.x, 9 - 0.6, centre.z);
  group.add(ring);
  return {
    group,
    step(t) {
      sky.material.uniforms.uTime.value = t;
    },
    dispose() {
      for (const o of own) o.dispose?.();
    },
  };
}

// a few shapes as one geometry, keeping position, normal and colour
function mergeColoured(list) {
  const flat = list.map((g) => (g.index ? g.toNonIndexed() : g));
  const geo = new THREE.BufferGeometry();
  for (const key of ['position', 'normal', 'color']) {
    if (!flat.every((g) => g.attributes[key])) continue;
    const total = flat.reduce((n, g) => n + g.attributes[key].array.length, 0);
    const a = new Float32Array(total);
    let o = 0;
    for (const g of flat) {
      a.set(g.attributes[key].array, o);
      o += g.attributes[key].array.length;
    }
    geo.setAttribute(key, new THREE.BufferAttribute(a, 3));
  }
  for (const g of [...list, ...flat]) g.dispose();
  return geo;
}

export function makeTree(seed) {
  const r = rng(1000 + seed * 17);
  const bark = [];
  const leaves = [];
  const h = 2.4 + r() * 0.8; // where the crown starts
  const lean = new THREE.Vector3((r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3);
  const trunk = new THREE.CylinderGeometry(0.12, 0.2, h, 9, 3);
  trunk.translate(0, h / 2, 0);
  const tp = trunk.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const y = tp.getY(i) / h;
    tp.setX(i, tp.getX(i) + lean.x * y * y);
    tp.setZ(i, tp.getZ(i) + lean.z * y * y);
  }
  trunk.computeVertexNormals();
  bark.push(trunk);
  const top = new THREE.Vector3(lean.x, h, lean.z);
  // the boughs: up and out from the top of the trunk
  const ends = [];
  const n = 3 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.8;
    const len = 1.1 + r() * 0.7;
    const dir = new THREE.Vector3(Math.cos(a) * 0.75, 0.9 + r() * 0.4, Math.sin(a) * 0.75).normalize();
    const b = new THREE.CylinderGeometry(0.05, 0.1, len, 6);
    b.translate(0, len / 2, 0);
    b.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
    b.translate(top.x, top.y - 0.25, top.z);
    bark.push(b);
    ends.push(top.clone().add(dir.multiplyScalar(len)).add(new THREE.Vector3(0, -0.25, 0)));
  }
  ends.push(top.clone().add(new THREE.Vector3(0, 1.4, 0)));
  // the crown: a lumpy clump at each bough's end and round the middle
  const dark = new THREE.Color(0x2f4424);
  const light = new THREE.Color(0x6f8a45);
  const c = new THREE.Color();
  const clump = (at, size) => {
    const g = new THREE.IcosahedronGeometry(size, 2);
    const p = g.attributes.position;
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
      const k = 0.78 + 0.32 * Math.abs(Math.sin(v.x * 7.1 + seed) * Math.cos(v.z * 6.3 + v.y * 5.1));
      v.multiplyScalar(k);
      v.y *= 0.82;
      p.setXYZ(i, v.x + at.x, v.y + at.y, v.z + at.z);
      // darker underneath and inside, lighter on top
      c.copy(dark).lerp(light, Math.max(0, Math.min(1, 0.45 + (v.y / size) * 0.5 + (k - 0.9))));
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.deleteAttribute('uv');
    g.computeVertexNormals();
    leaves.push(g);
  };
  for (const e of ends) clump(e, 0.95 + r() * 0.45);
  for (let i = 0; i < 3; i++) clump(top.clone().add(new THREE.Vector3((r() - 0.5) * 1.2, 1.0 + r() * 0.8, (r() - 0.5) * 1.2)), 1.0 + r() * 0.3);
  for (const g of bark) g.deleteAttribute('uv');
  return { bark: mergeColoured(bark), leaves: mergeColoured(leaves) };
}
