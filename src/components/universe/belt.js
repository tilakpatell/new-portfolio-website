// Two things that give the space between the places some depth.
//
// The asteroid belt, in the gap between the stations' ring and the planets:
// rocks of three lumpy shapes (each a ball pushed about by noise, so no two
// faces match), in a band that's thicker in the middle and thins at its
// edges, greys and browns with a few darker and a few rustier, turning slowly
// round the sun. Each shape is one instanced draw.
//
// The dust: specks drifting in a box that rides with the camera, so they
// stream past while you fly (and you can feel how fast you're going), fading
// in from the box's edges so it never shows. One draw, moved on the GPU.
//
// createBelt({ small }) → { group, update(t) }
// createDust({ small }) → { points, update(cameraInParent, amount) }

import * as THREE from 'three';
import { BELT } from './layout';

// a deterministic "random", so the belt is the same every visit
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// a lumpy rock: an icosphere with its points pushed in and out by a few
// waves, squashed a little
function rock(seed) {
  const rand = rng(seed);
  const g = new THREE.IcosahedronGeometry(1, 1);
  const pos = g.attributes.position;
  const waves = Array.from({ length: 5 }, () => [new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(), 1.5 + rand() * 3.5, rand() * 6, 0.06 + rand() * 0.1]);
  const v = new THREE.Vector3();
  const squash = new THREE.Vector3(1, 0.65 + rand() * 0.3, 0.8 + rand() * 0.25);
  // the same point on every face that shares it moves the same way
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    let k = 1;
    for (const [dir, f, ph, amp] of waves) k += Math.sin(v.dot(dir) * f + ph) * amp;
    k -= Math.max(0, v.dot(waves[0][0]) - 0.6) * 0.5; // a flat, broken side
    v.multiplyScalar(k).multiply(squash);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

export function createBelt({ small = false } = {}) {
  const rand = rng(1977);
  const N = small ? 420 : 1100;
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0.05, flatShading: true, envMapIntensity: 0.4 });
  const shapes = [rock(11), rock(23), rock(37)];
  const counts = [Math.ceil(N * 0.4), Math.ceil(N * 0.35), Math.floor(N * 0.25)];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const at = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const c = new THREE.Color();
  const TONES = ['#8b857c', '#6f6a63', '#9a8f80', '#7a6a58', '#5b5550', '#a08466'];
  shapes.forEach((geo, s) => {
    const mesh = new THREE.InstancedMesh(geo, mat, counts[s]);
    for (let i = 0; i < counts[s]; i++) {
      // across the band: most in the middle, a few toward its edges
      const across = (rand() + rand() + rand()) / 3 - 0.5;
      const r = (BELT.inner + BELT.outer) / 2 + across * (BELT.outer - BELT.inner);
      const a = rand() * Math.PI * 2;
      const y = (rand() - 0.5) * BELT.height * (1 - Math.abs(across) * 1.4);
      at.set(Math.cos(a) * r, y, Math.sin(a) * r);
      // mostly small, now and then a big one
      const size = 0.04 + rand() ** 4 * 0.46;
      sc.set(size, size * (0.7 + rand() * 0.6), size * (0.8 + rand() * 0.4));
      q.setFromEuler(e.set(rand() * 6.3, rand() * 6.3, rand() * 6.3));
      mesh.setMatrixAt(i, m.compose(at, q, sc));
      mesh.setColorAt(i, c.set(TONES[Math.floor(rand() * TONES.length)]).multiplyScalar(0.75 + rand() * 0.45));
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  });
  return {
    group,
    update(t) {
      group.rotation.y = t * 0.006; // slowly round the sun
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
  const N = small ? 260 : 600;
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
