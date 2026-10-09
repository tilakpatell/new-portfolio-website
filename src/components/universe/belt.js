// Two things that give the space between the places some depth.
//
// The asteroid belt, in the gap between the stations' ring and the planets:
// rocks of three lumpy shapes (each a ball pushed about by noise, so no two
// faces match) and, one in forty, a bigger cratered boulder, in a band
// that's thicker in the middle and thins at its edges, greys and browns
// with a few darker and a few rustier, pitted stone up close (lib/three/rock),
// turning slowly round the sun. Each shape is one instanced draw, and so is
// a fifth, a plain twenty-faced stone that every rock under three pixels tall
// is drawn as instead (most of them, from across the home system: each
// rock's own shape is 80 faces, its boulder 320): the same place, size,
// turn and colour, its extent on each axis its own shape's, so nothing
// shows as a rock goes from one to the other. Which rocks are far is sorted
// again every half second, or once the camera has come 20 units
// (lib/three/lod.js's cadence and its lodBand, the edge held a tenth either
// way), from where it is in the belt's own turn.
//
// The dust: specks drifting in a box that rides with the camera, so they
// stream past while you fly (and you can feel how fast you're going), fading
// in from the box's edges so it never shows. One draw, moved on the GPU.
//
// createBelt({ small, band, seed, tones, scale, spin, count, tier })
//   → { group, rocks, meshes, bands, slotOf(i), hide(i), show(i), update(t, cam, { fov, height, dt }) }
//   (`cam`: the camera in the belt's parent's space, the map's; without it,
//   only the turn; `meshes`: the four shapes' and the far one; `slotOf(i)`:
//   [the mesh rock i is in now, its instance])
// beltRocks({ small, band, seed, scale, count }) → where each of its rocks is (pure)
// rockBands(rocks, cam, { fov, height, bands }) → how many rocks changed band:
//   each one's 0 (its own shape) or 1 (the far one), in `bands`, in place (pure)
// rock(seed, { craters }) → a lumpy rock's geometry, about a unit across
//   (lib/three/rock; meteors.js uses it too)
// createDust({ small }) → { points, update(cameraInParent, amount) }

import * as THREE from 'three';
import { BELT } from './layout';
import { rng, rock, rockMaterial } from '../../lib/three/rock';
import { lodBand } from '../../lib/three/lod';
import { pxDistance } from './planetLod';

export { rock };

// one rock in this many is a boulder: twice the size, cratered
const BOULDER = 40;

const TONES = ['#8b857c', '#6f6a63', '#9a8f80', '#7a6a58', '#5b5550', '#a08466'];

export const FAR_PX = 3; // a rock under this tall on screen takes the far shape
const HOLD = 0.1; // (the edge's dead zone, a tenth of its distance: lodBand)
const EVERY = 0.5; // re-sorted every half second,
const MOVE = 20; // or once the camera has come this far
const Y = new THREE.Vector3(0, 1, 0);

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

// Which shape each rock is drawn in from `cam` (in the rocks' own space):
// its own while it's FAR_PX tall or more (a rock's own shape is about a
// unit out from its middle, times its size), the far one under that, each
// edge held a tenth either way of where it is (lodBand), so a rock on it
// doesn't flick between the two
export function rockBands(rocks, cam, { fov, height, bands }) {
  const unit = pxDistance(1, FAR_PX, fov, height); // (how far off a rock of size 1 is FAR_PX tall)
  const edge = [0];
  let changed = 0;
  for (let i = 0; i < rocks.length; i++) {
    const o = rocks[i];
    edge[0] = unit * Math.max(o.sx, o.sy, o.sz);
    const b = lodBand(Math.hypot(o.x - cam.x, o.y - cam.y, o.z - cam.z), edge, bands[i], HOLD);
    if (b === bands[i]) continue;
    bands[i] = b;
    changed++;
  }
  return changed;
}

// `tones`: its rocks' colours; `spin`: radians a second round the sun.
// hide(i) and show(i) take one of `rocks` out of the ring and put it back
// (one the ship has smashed), in whichever shape it's drawn in, and it
// stays that way as it goes from one to the other
export function createBelt({ small = false, band = BELT, seed = 1977, tones = TONES, scale = 1, spin = 0.006, count = 3200, tier = 'high' } = {}) {
  const rocks = beltRocks({ small, band, seed, scale, count, tones: tones.length });
  const N = rocks.length;
  const group = new THREE.Group();
  const mat = rockMaterial({ tier });
  // (the home belt's own shapes as they always were, and its boulder; another seed, other shapes)
  const shapes = [...[11, 23, 37].map((k) => rock(k + seed - 1977)), rock(53 + seed - 1977, { craters: true })];
  // the far shape, and how it's stretched and moved to fill each shape's own box
  const farGeo = new THREE.IcosahedronGeometry(1, 0);
  const boxOf = (g) => (g.computeBoundingBox(), g.boundingBox);
  const farBox = boxOf(farGeo).getSize(new THREE.Vector3());
  const fill = shapes.map((g) => {
    const box = boxOf(g);
    const k = box.getSize(new THREE.Vector3()).divide(farBox);
    return new THREE.Matrix4().makeTranslation(box.getCenter(new THREE.Vector3())).multiply(new THREE.Matrix4().makeScale(k.x, k.y, k.z));
  });
  const all = [...shapes.map((geo, s) => new THREE.InstancedMesh(geo, mat, rocks.filter((o) => o.shape === s).length)), new THREE.InstancedMesh(farGeo, mat, N)];
  for (const mesh of all) {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(mesh.instanceMatrix.count * 3), 3);
    group.add(mesh);
  }
  // each rock's matrix in its own shape and in the far one, and its colour
  const own = new Float32Array(N * 16);
  const far = new Float32Array(N * 16);
  const colour = new Float32Array(N * 3);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const at = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const c = new THREE.Color();
  rocks.forEach((o, i) => {
    m.compose(at.set(o.x, o.y, o.z), q.setFromEuler(e.set(o.rx, o.ry, o.rz)), sc.set(o.sx, o.sy, o.sz)).toArray(own, i * 16);
    m.multiply(fill[o.shape]).toArray(far, i * 16);
    c.set(tones[o.tone]).multiplyScalar(o.tint).toArray(colour, i * 3);
  });
  const bands = new Int8Array(N).fill(-1); // (−1: not sorted yet, so its own shape)
  const gone = new Uint8Array(N);
  const inMesh = new Uint8Array(N); // each rock's mesh (in `all`) and instance there
  const inSlot = new Uint32Array(N);
  const put = (i) => {
    const mesh = all[inMesh[i]];
    const a = mesh.instanceMatrix.array;
    const k = inSlot[i] * 16;
    a.set((inMesh[i] === 4 ? far : own).subarray(i * 16, i * 16 + 16), k);
    // (a smashed rock scaled to nothing where it is)
    if (gone[i]) for (const j of [0, 1, 2, 4, 5, 6, 8, 9, 10]) a[k + j] = 0;
    mesh.instanceMatrix.needsUpdate = true;
  };
  const pack = () => {
    const n = [0, 0, 0, 0, 0];
    for (let i = 0; i < N; i++) {
      const mi = bands[i] === 1 ? 4 : rocks[i].shape;
      inMesh[i] = mi;
      inSlot[i] = n[mi]++;
      put(i);
      all[mi].instanceColor.array.set(colour.subarray(i * 3, i * 3 + 3), inSlot[i] * 3);
    }
    all.forEach((mesh, mi) => {
      mesh.count = n[mi];
      mesh.visible = n[mi] > 0; // (an empty one not drawn at all)
      mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    });
  };
  pack();
  const cam = new THREE.Vector3();
  const last = new THREE.Vector3(Infinity, Infinity, Infinity);
  let wait = 0;
  return {
    group,
    rocks,
    meshes: all,
    bands,
    slotOf: (i) => [all[inMesh[i]], inSlot[i]],
    hide: (i) => {
      if (!rocks[i]) return;
      gone[i] = 1;
      put(i);
    },
    show: (i) => {
      if (!rocks[i]) return;
      gone[i] = 0;
      put(i);
    },
    update(t, camera = null, { fov = 50, height = 720, dt = 0 } = {}) {
      group.rotation.y = t * spin; // slowly round the sun
      if (!camera) return;
      // (the camera in the rocks' own space: the belt's turn undone)
      cam.set(camera.x, camera.y, camera.z).sub(group.position).applyAxisAngle(Y, -group.rotation.y);
      wait -= dt;
      if (wait > 0 && cam.distanceTo(last) < MOVE) return;
      wait = EVERY;
      last.copy(cam);
      if (rockBands(rocks, cam, { fov, height, bands })) pack();
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
