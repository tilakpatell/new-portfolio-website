// The sky over a star system, as it is from where that system sits in the
// galaxy (systems.js): the galaxy's own disc seen from inside it, a band of
// stars and dust lanes all the way round the horizon (the galactic plane is
// each system's y = 0, its +x east and +z south as the map has them), with
// the core's bulge glowing in the direction of the galaxy's middle: huge and
// blazing over Coruscant, small and far off over Tatooine ("the planet it's
// farthest from"), and from the Unknown Regions the whole galaxy hangs off
// to one side, the other side all but empty. A field of stars, thickest
// along the band; a nebula or two; and the system's own star or stars,
// glaring, the way the light comes from (they light the planet: bodies.js).
// Everything rides with the camera, so it's always as far off.
//
// createSky({ small }) → { group, setSystem(system), update(camera), sunDirs, dispose() }

import * as THREE from 'three';
import { RIM, coreBearing } from './systems';

const SKY_R = 5200; // (inside the camera's far plane, outside everything else)
const SUN_R = 4800;
const STARS = 4200;
const STARS_SMALL = 1700;

const NOISE = /* glsl */ `
float hash3(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.13));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.4);
    a *= 0.5;
  }
  return s;
}`;

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = vec4(p.xy, p.w * 0.99999, p.w); // (on the far plane, whatever its distance)
}`;

const SKY_FRAG = /* glsl */ `
uniform vec3 uCore;
uniform float uNear;
uniform float uSide;
uniform float uSeed;
uniform vec3 uNeb1;
uniform vec3 uNeb2;
uniform vec3 uNebCol1;
uniform vec3 uNebCol2;
uniform vec3 uTint;
uniform float uDim;
varying vec3 vDir;
${NOISE}
void main() {
  vec3 d = normalize(vDir);
  float lat = d.y;
  // the band: the disc seen edge on, wider nearer the middle
  float width = mix(0.11, 0.2, uNear);
  float band = exp(-lat * lat / (width * width));
  vec3 level = normalize(vec3(d.x, 0.0, d.z) + vec3(1e-5, 0.0, 0.0));
  float toward = dot(level, uCore) * 0.5 + 0.5;
  // out at the rim the galaxy's all to one side
  float side = mix(1.0, 0.08 + 0.92 * pow(toward, 1.6), uSide);
  float clouds = fbm(d * 7.0 + uSeed);
  float fine = fbm(d * 23.0 + uSeed * 1.7);
  float lanes = smoothstep(0.46, 0.7, fbm(d * vec3(5.0, 14.0, 5.0) + 3.1 + uSeed)) * exp(-lat * lat / (width * width * 0.18));
  vec3 bandCol = mix(vec3(0.5, 0.58, 0.85), vec3(1.0, 0.86, 0.68), toward);
  vec3 col = bandCol * band * side * (0.18 + 0.62 * clouds + 0.35 * fine * fine) * 0.32;
  col *= 1.0 - lanes * 0.82;
  // the core's bulge: bigger and brighter the nearer the middle
  float ang = acos(clamp(dot(d, uCore), -1.0, 1.0));
  float size = mix(0.13, 0.95, uNear);
  float squash = exp(-(lat * lat) / (size * size * 0.32));
  float bulge = exp(-(ang * ang) / (size * size)) * mix(1.0, squash, 0.6);
  float core = exp(-(ang * ang) / (size * size * 0.06));
  vec3 coreCol = mix(vec3(1.0, 0.78, 0.5), vec3(1.0, 0.95, 0.85), core);
  col += coreCol * (bulge * mix(0.22, 0.9, uNear) + core * mix(0.18, 0.7, uNear)) * (1.0 - lanes * 0.55) * (0.75 + 0.25 * clouds);
  // nebulae, here and there
  float n1 = exp(-pow(acos(clamp(dot(d, uNeb1), -1.0, 1.0)) / 0.32, 2.0)) * smoothstep(0.35, 0.75, fbm(d * 4.0 + 7.0 + uSeed));
  float n2 = exp(-pow(acos(clamp(dot(d, uNeb2), -1.0, 1.0)) / 0.22, 2.0)) * smoothstep(0.3, 0.8, fbm(d * 6.0 + 2.0 + uSeed));
  col += uNebCol1 * n1 * 0.16 + uNebCol2 * n2 * 0.12;
  // and the dark between
  col += vec3(0.0035, 0.005, 0.011);
  col = col * uTint * uDim;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

const STAR_VERT = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
uniform float uDpr;
uniform float uDim;
varying vec3 vColor;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(aSize * uDpr, 1.0, 5.0 * uDpr);
  vColor = aColor * uDim;
  vec4 p = projectionMatrix * mv;
  gl_Position = vec4(p.xy, p.w * 0.99999, p.w);
}`;
const STAR_FRAG = /* glsl */ `
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5);
  gl_FragColor = vec4(vColor * smoothstep(0.5, 0.1, d), 1.0);
  #include <colorspace_fragment>
}`;

// a star of its own: a white-hot disc in a glare, with faint rays
const SUN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv * 2.0 - 1.0;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec2 scale = vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
  mv.xy += position.xy * scale;
  vec4 p = projectionMatrix * mv;
  gl_Position = vec4(p.xy, p.w * 0.99999, p.w);
}`;
const SUN_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uDim;
varying vec2 vUv;
void main() {
  float r = length(vUv);
  float disc = smoothstep(0.075, 0.06, r);
  float glow = exp(-r * 9.0) * 0.9 + exp(-r * 3.2) * 0.22;
  float a = atan(vUv.y, vUv.x);
  float rays = pow(abs(cos(a * 3.0)), 60.0) * exp(-r * 4.0) * 0.35 + pow(abs(cos(a * 2.0 + 0.6)), 90.0) * exp(-r * 5.0) * 0.25;
  vec3 c = uColor * (glow + rays) + vec3(6.0) * disc;
  gl_FragColor = vec4(c * uDim * smoothstep(1.0, 0.7, r), 1.0);
  #include <colorspace_fragment>
}`;

// the same numbers for the same system, every visit (and for every pilot)
function seeded(text) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const NEBULAE = [
  ['#c4508f', '#4f7fd0'],
  ['#5fa8c8', '#9a5fc8'],
  ['#d07a4a', '#4a9a8a'],
  ['#7a5fd0', '#d05f7a'],
];

export function createSky({ small = false } = {}) {
  const group = new THREE.Group();
  group.renderOrder = -20;
  const made = [];

  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms: {
      uCore: { value: new THREE.Vector3(1, 0, 0) },
      uNear: { value: 0.3 },
      uSide: { value: 0.3 },
      uSeed: { value: 0 },
      uNeb1: { value: new THREE.Vector3(0, 0.3, 1).normalize() },
      uNeb2: { value: new THREE.Vector3(1, -0.2, 0).normalize() },
      uNebCol1: { value: new THREE.Color('#c4508f') },
      uNebCol2: { value: new THREE.Color('#4f7fd0') },
      uTint: { value: new THREE.Color(1, 1, 1) },
      uDim: { value: 1 },
    },
    side: THREE.BackSide,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(SKY_R, 64, 32), skyMat);
  sky.renderOrder = -20;
  sky.frustumCulled = false;
  group.add(sky);
  made.push(sky.geometry, skyMat);

  // the stars: positions made per system (setSystem), drawn in one go
  const n = small ? STARS_SMALL : STARS;
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(n), 1));
  starGeo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const starMat = new THREE.ShaderMaterial({ vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, uniforms: { uDpr: { value: 1 }, uDim: { value: 1 } }, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  stars.renderOrder = -19;
  group.add(stars);
  made.push(starGeo, starMat);

  // the system's suns (up to two)
  const sunGeo = new THREE.PlaneGeometry(2, 2);
  made.push(sunGeo);
  const suns = [0, 1].map(() => {
    const mat = new THREE.ShaderMaterial({ vertexShader: SUN_VERT, fragmentShader: SUN_FRAG, uniforms: { uColor: { value: new THREE.Color() }, uDim: { value: 1 } }, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
    const m = new THREE.Mesh(sunGeo, mat);
    m.frustumCulled = false;
    m.renderOrder = -18;
    m.visible = false;
    group.add(m);
    made.push(mat);
    return m;
  });
  const sunDirs = [];

  const tints = [
    [1, 1, 1],
    [0.78, 0.86, 1],
    [1, 0.9, 0.76],
    [1, 0.78, 0.62],
  ];

  return {
    group,
    // the directions toward the system's suns, unit vectors (bodies.js lights by them)
    sunDirs,
    setSystem(sys) {
      const rand = seeded(sys.id);
      const { dir, d } = coreBearing(sys);
      const near = Math.max(0, 1 - d / RIM);
      const u = skyMat.uniforms;
      u.uCore.value.set(...dir);
      u.uNear.value = near * near * 0.85 + near * 0.15;
      u.uSide.value = Math.min(0.95, Math.max(0, (d / RIM - 0.45) * 1.6));
      u.uSeed.value = rand() * 40;
      const pick = (v) => v.set(rand() * 2 - 1, (rand() * 2 - 1) * 0.5, rand() * 2 - 1).normalize();
      pick(u.uNeb1.value);
      pick(u.uNeb2.value);
      const neb = NEBULAE[Math.floor(rand() * NEBULAE.length)];
      u.uNebCol1.value.set(neb[0]);
      u.uNebCol2.value.set(neb[1]);
      u.uTint.value.set(sys.id === 'exegol' ? '#b8a0c8' : '#ffffff');
      // the stars: half anywhere, the rest along the band, thickest toward the core
      const pos = starGeo.attributes.position.array;
      const size = starGeo.attributes.aSize.array;
      const col = starGeo.attributes.aColor.array;
      const v = new THREE.Vector3();
      const core = new THREE.Vector3(...dir);
      for (let i = 0; i < n; i++) {
        const k = rand();
        if (k < 0.5) v.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1);
        else {
          const a = rand() * Math.PI * 2;
          const lat = (rand() + rand() + rand() - 1.5) * 0.16;
          v.set(Math.cos(a), lat, Math.sin(a));
          if (k > 0.82) v.lerp(core, rand() * 0.45 * near + 0.05);
        }
        v.normalize();
        // fewer on the empty side, out at the rim
        if (u.uSide.value > 0.2 && v.dot(core) < -0.2 && rand() < u.uSide.value * 0.7) v.lerp(core, 0.9).normalize();
        pos[i * 3] = v.x * SKY_R * 0.98;
        pos[i * 3 + 1] = v.y * SKY_R * 0.98;
        pos[i * 3 + 2] = v.z * SKY_R * 0.98;
        const b = 0.18 + rand() ** 3 * 0.9;
        const t = tints[rand() < 0.66 ? 0 : Math.floor(rand() * tints.length)];
        col[i * 3] = t[0] * b;
        col[i * 3 + 1] = t[1] * b;
        col[i * 3 + 2] = t[2] * b;
        size[i] = 0.8 + rand() ** 5 * 2.6;
      }
      starGeo.attributes.position.needsUpdate = true;
      starGeo.attributes.aSize.needsUpdate = true;
      starGeo.attributes.aColor.needsUpdate = true;
      // its suns
      sunDirs.length = 0;
      suns.forEach((m, i) => {
        const s = sys.suns[i];
        m.visible = Boolean(s);
        if (!s) return;
        const d3 = new THREE.Vector3(...s.dir).normalize();
        sunDirs.push(d3);
        m.position.copy(d3).multiplyScalar(SUN_R);
        m.scale.setScalar(SUN_R * 0.11 * s.size);
        m.material.uniforms.uColor.value.set(s.color).multiplyScalar(2.2);
      });
    },
    // the sky and its stars round the camera, wherever it flies; `dim`, 0…1:
    // a star being drained (Starkiller Base), the sky going with it
    update(camera, dim = 1) {
      group.position.copy(camera.position);
      skyMat.uniforms.uDim.value = 0.6 + 0.4 * dim;
      starMat.uniforms.uDim.value = 0.5 + 0.5 * dim;
      for (const m of suns) m.material.uniforms.uDim.value = dim;
    },
    setRatio(dpr) {
      starMat.uniforms.uDpr.value = dpr;
    },
    dispose() {
      for (const x of made) x.dispose();
    },
  };
}
