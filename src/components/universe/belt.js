// Two things that give the space between the places some depth.
//
// The asteroid belt, in the gap between the stations' ring and the planets:
// rocks of three lumpy shapes (each a ball pushed about by noise, so no two
// faces match) and, one in forty, a bigger cratered boulder, in a band
// that's thicker in the middle and thins at its edges, greys and browns
// with a few darker and a few rustier, pitted stone up close (lib/three/rock),
// turning slowly round the sun. Each shape is one instanced draw.
//
// The dust: specks drifting in a box that rides with the camera, so they
// stream past while you fly (and you can feel how fast you're going), fading
// in from the box's edges so it never shows. One draw, moved on the GPU.
//
// createBelt({ small, band, seed, tones, scale, spin, count, tier }) → { group, rocks, hide(i), show(i), update(t) }
// beltRocks({ small, band, seed, scale, count }) → where each of its rocks is (pure)
// rock(seed, { craters }) → a lumpy rock's geometry, about a unit across
//   (lib/three/rock; meteors.js uses it too)
// createDust({ small }) → { points, update(cameraInParent, amount) }

import * as THREE from 'three';
import { BELT } from './layout';
import { rng, rock, rockMaterial } from '../../lib/three/rock';

export { rock };

// one rock in this many is a boulder: twice the size, cratered
const BOULDER = 40;

const TONES = ['#8b857c', '#6f6a63', '#9a8f80', '#7a6a58', '#5b5550', '#a08466'];

// Where each rock of a ring is, as plain numbers, so the belt's mesh and the
// ship's collider (rockHits.js) read the same rocks. `band`: where it goes
// ({ inner, outer, height }: the home belt, layout.js's BELT, unless another
// ring is wanted: the rim at the edge of the map, RIM); `scale`: how many
// times bigger than the belt's rocks (the rim's are seen from thousands of
// units off). The draws from the seeded random are in the order they always
// were, so the belt looks as it did.
// → [{ x, y, z, sx, sy, sz, rx, ry, rz, shape, tone, tint, r }]: r, how near
// the ship's way must come to it (a little inside its biggest side: the
// rocks are lumpy)
export function beltRocks({ small = false, band = BELT, seed = 1977, scale = 1, count = 3200, tones = TONES.length } = {}) {
  const rand = rng(seed);
  const N = small ? Math.round(count * 0.375) : count;
  const counts = [Math.ceil(N * 0.4), Math.ceil(N * 0.35), Math.floor(N * 0.25)];
  const rocks = [];
  counts.forEach((n, shape) => {
    for (let i = 0; i < n; i++) {
      // across the band: most in the middle, a few toward its edges
      const across = (rand() + rand() + rand()) / 3 - 0.5;
      const r = (band.inner + band.outer) / 2 + across * (band.outer - band.inner);
      const a = rand() * Math.PI * 2;
      const y = (rand() - 0.5) * band.height * (1 - Math.abs(across) * 1.4);
      // mostly small, now and then a big one
      const size = (0.15 + rand() ** 4 * 1.9) * scale;
      const sx = size;
      const sy = size * (0.7 + rand() * 0.6);
      const sz = size * (0.8 + rand() * 0.4);
      const rx = rand() * 6.3;
      const ry = rand() * 6.3;
      const rz = rand() * 6.3;
      const tone = Math.floor(rand() * tones);
      const tint = 0.75 + rand() * 0.45;
      rocks.push({ x: Math.cos(a) * r, y, z: Math.sin(a) * r, sx, sy, sz, rx, ry, rz, shape, tone, tint, r: Math.max(sx, sy, sz) * 0.9 });
    }
  });
  // one in each forty a boulder, picked by a draw of its own (so every other
  // rock is where it always was)
  const pick = rng(seed ^ 0xb01d);
  for (let b = 0; b + BOULDER <= rocks.length; b += BOULDER) {
    const o = rocks[b + Math.floor(pick() * BOULDER)];
    o.shape = 3;
    o.sx *= 2;
    o.sy *= 2;
    o.sz *= 2;
    o.r = Math.max(o.sx, o.sy, o.sz) * 0.9;
  }
  return rocks;
}

// `tones`: its rocks' colours; `spin`: radians a second round the sun.
// hide(i) and show(i) take one of `rocks` out of the ring and put it back
// (one the ship has smashed)
export function createBelt({ small = false, band = BELT, seed = 1977, tones = TONES, scale = 1, spin = 0.006, count = 3200, tier = 'high' } = {}) {
  const rocks = beltRocks({ small, band, seed, scale, count, tones: tones.length });
  const group = new THREE.Group();
  const mat = rockMaterial({ tier });
  // (the home belt's own shapes as they always were, and its boulder; another seed, other shapes)
  const shapes = [...[11, 23, 37].map((k) => rock(k + seed - 1977)), rock(53 + seed - 1977, { craters: true })];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const at = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const c = new THREE.Color();
  const meshes = shapes.map((geo, s) => new THREE.InstancedMesh(geo, mat, rocks.filter((o) => o.shape === s).length));
  const slot = []; // each rock's [mesh, instance]
  const filled = [0, 0, 0, 0];
  const place = (i, gone = false) => {
    const o = rocks[i];
    const [mesh, k] = slot[i];
    at.set(o.x, o.y, o.z);
    q.setFromEuler(e.set(o.rx, o.ry, o.rz));
    sc.set(o.sx, o.sy, o.sz);
    if (gone) sc.setScalar(0);
    mesh.setMatrixAt(k, m.compose(at, q, sc));
    mesh.instanceMatrix.needsUpdate = true;
  };
  rocks.forEach((o, i) => {
    const mesh = meshes[o.shape];
    const k = filled[o.shape]++;
    slot[i] = [mesh, k];
    place(i);
    mesh.setColorAt(k, c.set(tones[o.tone]).multiplyScalar(o.tint));
  });
  for (const mesh of meshes) {
    mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  return {
    group,
    rocks,
    hide: (i) => slot[i] && place(i, true),
    show: (i) => slot[i] && place(i),
    update(t) {
      group.rotation.y = t * spin; // slowly round the sun
    },
  };
}

const DUST_VERT = `
uniform vec3 uCam;
uniform float uBox;
uniform float uDpr;
attribute float aSize;
varying float vFade;
void main() {
  // each speck's place in a box round the camera, wrapping as it moves
  vec3 p = mod(position - uCam + uBox * 0.5, uBox) - uBox * 0.5;
  vFade = 1.0 - smoothstep(uBox * 0.28, uBox * 0.5, length(p));
  vec4 mv = modelViewMatrix * vec4(p + uCam, 1.0);
  gl_PointSize = clamp(aSize * uDpr * (6.0 / -mv.z), 1.0, 3.0 * uDpr);
  gl_Position = projectionMatrix * mv;
}`;

const DUST_FRAG = `
uniform float uAmount;
varying float vFade;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.15, d) * vFade * uAmount;
  gl_FragColor = vec4(vec3(0.75, 0.82, 1.0) * a * 0.6, 1.0);
}`;

export function createDust({ small = false } = {}) {
  const rand = rng(42);
  const N = small ? 320 : 800;
  const BOX = 14;
  const pos = new Float32Array(N * 3);
  const size = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos.set([(rand() - 0.5) * BOX, (rand() - 0.5) * BOX * 0.6, (rand() - 0.5) * BOX], i * 3);
    size[i] = 0.6 + rand() * 1.4;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: DUST_VERT,
    fragmentShader: DUST_FRAG,
    uniforms: { uCam: { value: new THREE.Vector3() }, uBox: { value: BOX }, uDpr: { value: 1 }, uAmount: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(g, mat);
  points.frustumCulled = false;
  points.visible = false;
  return {
    points,
    // cam: the camera's position in the dust's parent; amount 0…1
    update(cam, amount, dpr = 1) {
      points.visible = amount > 0.01;
      mat.uniforms.uAmount.value = amount;
      mat.uniforms.uCam.value.copy(cam);
      mat.uniforms.uDpr.value = dpr;
    },
  };
}
