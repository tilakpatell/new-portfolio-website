// The way into a galaxy far, far away, on the universe map (planets.js
// builds it in the Star Wars planet's place): the galaxy itself, in
// miniature, hanging in space. A spiral of thousands of stars round a warm
// core, turning slowly, with the galaxy's own systems lit where they are on
// it (names.js SYSTEM_MARKS: Coruscant in the bright middle, Tatooine out
// on the rim, Sorgan far out west), and in front of it, always
// facing you, a hyperspace gate: a ring of blue light round a tunnel of
// stars streaming away into it. Fly into the gate and you jump to lightspeed
// into the galaxy (the universe map's scene and page do that: the place is
// a `portal`, universes.js).
//
// buildGateway(r, { small }) → { group, disc, update(t, camera), dispose() }
// r: the gate's radius (the place's own, the size the ship flies into); the
// galaxy behind it is a few times wider. `disc` is the galaxy alone, without
// the gate: all a planets.js place keeps of it when it's a few pixels tall.

import * as THREE from 'three';
import { SYSTEM_MARKS } from './names';

const STARS = 7000;
const STARS_SMALL = 2600;
const DISC = 2.7; // the galaxy's radius, in gate radii
const TILT = [0.52, 0, 0.18]; // seen at a slant, not edge on, nor flat
const TURN = 0.018; // radians a second: a galaxy turning, slowly

const STAR_VERT = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
uniform float uScale;
varying vec3 vColor;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(aSize * uScale / -mv.z, 1.0, 14.0);
  vColor = aColor;
  gl_Position = projectionMatrix * mv;
}`;
const STAR_FRAG = /* glsl */ `
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vColor * a * a, 1.0);
  #include <colorspace_fragment>
}`;

// the galaxy's glow under its stars: the core, the arms' haze (faint: it's
// a wide thing, and the bloom would wash the whole view out)
const DISC_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const DISC_FRAG = /* glsl */ `
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float a = atan(p.y, p.x);
  float arm = cos(2.0 * (a - log(r + 0.04) * 2.6));
  float arms = pow(max(arm, 0.0), 3.0) * smoothstep(1.0, 0.25, r) * smoothstep(0.02, 0.2, r);
  float core = exp(-r * r * 28.0);
  float glow = exp(-r * 3.4);
  vec3 col = vec3(1.0, 0.8, 0.52) * core * 0.9 + vec3(0.42, 0.56, 1.0) * arms * 0.14 + vec3(0.5, 0.56, 0.95) * glow * 0.05;
  gl_FragColor = vec4(col * smoothstep(1.0, 0.82, r), 1.0);
  #include <colorspace_fragment>
}`;

// the gate's tunnel: streaks of starlight running away down it, lanes of
// them at their own speeds, and a blaze at the far end
const TUNNEL_FRAG = /* glsl */ `
uniform float uT;
uniform float uPulse;
varying vec2 vUv;
float hash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float a = atan(p.y, p.x) / 6.2831853 + 0.5;
  float lane = floor(a * 180.0);
  float h = hash(lane);
  float s = fract(r * (0.8 + h * 1.4) + uT * (0.35 + h * 0.6) + h * 9.0);
  float streak = smoothstep(0.0, 0.06, s) * smoothstep(0.42, 0.06, s) * step(0.45, hash(lane + 7.3));
  float edge = smoothstep(1.0, 0.8, r);
  float centre = exp(-r * r * 22.0);
  vec3 col = vec3(0.5, 0.75, 1.0) * streak * (0.15 + r * 1.9) + vec3(0.9, 0.96, 1.0) * centre * (0.55 + uPulse * 0.5) + vec3(0.03, 0.08, 0.22) * (1.0 - r);
  gl_FragColor = vec4(col * edge, 1.0);
  #include <colorspace_fragment>
}`;

// the same numbers every visit (and for every pilot)
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (rand) => (rand() + rand() + rand() - 1.5) / 1.5;

export function buildGateway(r, { small = false } = {}) {
  const group = new THREE.Group();
  const made = [];
  const R = r * DISC;

  // the galaxy: its disc of stars, tilted, turning
  const disc = new THREE.Group();
  disc.rotation.set(...TILT);
  group.add(disc);
  const spin = new THREE.Group();
  disc.add(spin);

  const rand = seeded(1977);
  const n = small ? STARS_SMALL : STARS;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const size = new Float32Array(n);
  const warm = new THREE.Color(1.0, 0.82, 0.58);
  const cool = new THREE.Color(0.62, 0.76, 1.0);
  const pink = new THREE.Color(1.0, 0.45, 0.72);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    let x;
    let y;
    let z;
    let k; // how far out, 0 … 1
    if (rand() < 0.2) {
      // the bulge round the core
      k = Math.abs(gauss(rand)) * 0.22;
      const a = rand() * Math.PI * 2;
      x = Math.cos(a) * k * R;
      z = -Math.sin(a) * k * R;
      y = gauss(rand) * R * 0.06 * (1 - k * 2);
    } else {
      // the two arms, as the glow has them (angle = log(r) × 2.6), spread
      // wider toward the middle
      k = 0.08 + 0.92 * rand() ** 0.75;
      const arm = rand() < 0.5 ? 0 : Math.PI;
      const a = arm + Math.log(k + 0.04) * 2.6 + gauss(rand) * (0.5 - k * 0.32);
      x = Math.cos(a) * k * R;
      z = -Math.sin(a) * k * R;
      y = gauss(rand) * R * 0.025;
    }
    pos.set([x, y, z], i * 3);
    c.copy(warm).lerp(cool, Math.min(1, k * 1.6));
    if (k > 0.3 && rand() < 0.05) c.copy(pink); // a nebula's glow, here and there along the arms
    const b = 0.4 + rand() ** 3 * 1.5 + (k < 0.12 ? 0.6 : 0);
    col.set([c.r * b, c.g * b, c.b * b], i * 3);
    size[i] = r * (0.011 + rand() ** 4 * 0.035);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  starGeo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const starMat = new THREE.ShaderMaterial({ vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, uniforms: { uScale: { value: 900 } }, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat);
  spin.add(stars);
  made.push(starGeo, starMat);

  // its glow, under the stars
  const glowGeo = new THREE.PlaneGeometry(R * 2, R * 2).rotateX(-Math.PI / 2);
  const glowMat = new THREE.ShaderMaterial({ vertexShader: DISC_VERT, fragmentShader: DISC_FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  spin.add(new THREE.Mesh(glowGeo, glowMat));
  made.push(glowGeo, glowMat);

  // the galaxy's own systems, each a bright point in its own colour, where
  // the galaxy map has it
  const marks = Object.values(SYSTEM_MARKS);
  const markPos = new Float32Array(marks.length * 3);
  const markCol = new Float32Array(marks.length * 3);
  const markSize = new Float32Array(marks.length);
  marks.forEach(([mx, mz, hex], i) => {
    markPos.set([mx * R * 0.92, R * 0.012, mz * R * 0.92], i * 3);
    c.set(hex).multiplyScalar(2.6);
    markCol.set([c.r, c.g, c.b], i * 3);
    markSize[i] = r * 0.06;
  });
  const markGeo = new THREE.BufferGeometry();
  markGeo.setAttribute('position', new THREE.BufferAttribute(markPos, 3));
  markGeo.setAttribute('aColor', new THREE.BufferAttribute(markCol, 3));
  markGeo.setAttribute('aSize', new THREE.BufferAttribute(markSize, 1));
  spin.add(new THREE.Points(markGeo, starMat));
  made.push(markGeo);

  // the gate, facing whoever's looking: its tunnel, its ring of light, and a
  // second, thinner ring turning against it
  const gate = new THREE.Group();
  group.add(gate);
  const tunnelGeo = new THREE.CircleGeometry(r, small ? 64 : 128);
  const tunnelMat = new THREE.ShaderMaterial({ vertexShader: DISC_VERT, fragmentShader: TUNNEL_FRAG, uniforms: { uT: { value: 0 }, uPulse: { value: 0 } }, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  gate.add(new THREE.Mesh(tunnelGeo, tunnelMat));
  const ringGeo = new THREE.TorusGeometry(r, r * 0.022, 12, small ? 96 : 160);
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.8, 1.6).multiplyScalar(1.6), toneMapped: false });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  gate.add(ring);
  const halo2Geo = new THREE.TorusGeometry(r * 1.09, r * 0.008, 6, small ? 96 : 160);
  const halo2Mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 0.9, 1.8), toneMapped: false, transparent: true, opacity: 0.8 });
  const halo2 = new THREE.Mesh(halo2Geo, halo2Mat);
  gate.add(halo2);
  made.push(tunnelGeo, tunnelMat, ringGeo, ringMat, halo2Geo, halo2Mat);
  // its ring's beacons: eight points of light going round
  const beaconGeo = new THREE.SphereGeometry(r * 0.03, 10, 6);
  const beaconMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.9, 2.2), toneMapped: false });
  const beacons = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const b = new THREE.Mesh(beaconGeo, beaconMat);
    const a = (i / 8) * Math.PI * 2;
    b.position.set(Math.cos(a) * r * 1.09, Math.sin(a) * r * 1.09, 0);
    beacons.add(b);
  }
  gate.add(beacons);
  made.push(beaconGeo, beaconMat);

  const toCamera = new THREE.Vector3();
  const here = new THREE.Vector3();
  const parentQ = new THREE.Quaternion();
  return {
    group,
    disc,
    update(t, camera) {
      spin.rotation.y = t * TURN;
      tunnelMat.uniforms.uT.value = t;
      const pulse = 0.5 + 0.5 * Math.sin(t * 1.6);
      tunnelMat.uniforms.uPulse.value = pulse * 0.6;
      ringMat.color.setRGB(0.55, 0.8, 1.6).multiplyScalar(1.4 + pulse * 0.5);
      halo2.rotation.z = -t * 0.3;
      beacons.rotation.z = t * 0.5;
      // facing the camera: the gate's round from wherever you come at it
      if (camera) {
        group.getWorldPosition(here);
        toCamera.copy(camera.position).sub(here);
        if (toCamera.lengthSq() > 1e-6) {
          gate.parent.getWorldQuaternion(parentQ);
          gate.quaternion.copy(parentQ.invert()).multiply(camera.quaternion);
        }
      }
    },
    dispose() {
      for (const x of made) x.dispose();
    },
  };
}
