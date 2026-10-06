// A world's water, out to the horizon. A sea or a swamp (Scarif's lagoons
// and surf, Kamino's storm, Naboo's lakes, Dagobah's black water) is a disc
// of Gerstner waves round the camera (ocean.js: each world's own swell),
// fine near it and coarse to the horizon; a depth map baked from the ground
// colours the shallows and the sand under them, stands the swell up on the
// beaches where it breaks, and washes foam up to the waterline. The sky in
// it by angle, light through the crests toward the sun, the sun's road,
// whitecaps where the waves pinch. Lava (Mustafar's rivers, glowing,
// crusting over) and a sea of cloud (Bespin, far below the city) stay one
// plane at the site's level; lava lights itself.
//
// site.water: { level, color, deep, kind, foam?, glow? }
// createWater(site, sunDir, sunColor, { heightAt, small, id }) →
//   { mesh, glow, depth, update(t, camera), height(x, z, t), dispose() }

import * as THREE from 'three';
import { FAR, HALF } from './terrain';
import { noiseTexture } from './noiseTex';
import { WAVES_GLSL, bakeDepth, discRings, heightAt as waveHeight, seaFor, snapCentre, wavesFor } from './ocean';

const PLANE_VERT = `
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const PLANE_FRAG = `
varying vec3 vWorld;
uniform vec3 uColor, uDeep, uSun, uSunColor, uSky;
uniform float uTime, uKind, uFoam, uGlow, uWaves;
#include <fog_pars_fragment>
uniform sampler2D uNoise;
float wFbm(vec2 p) { vec4 a = texture2D(uNoise, p * 0.08); vec4 b = texture2D(uNoise, p * 0.19 + 0.37); return a.r * 0.35 + a.g * 0.3 + b.b * 0.2 + b.a * 0.15; }
void main() {
  vec2 xz = vWorld.xz;
  float dist = length(vWorld - cameraPosition);
  vec3 view = normalize(cameraPosition - vWorld);
  vec3 c;
  if (uKind > 1.5) {
    // lava: hot channels under a crust that cracks and drifts
    float flow = wFbm(xz * 0.05 + vec2(uTime * 0.02, uTime * 0.013));
    float crust = smoothstep(0.42, 0.62, wFbm(xz * 0.11 - vec2(uTime * 0.03, 0.0)));
    vec3 hot = mix(uColor, vec3(1.0, 0.85, 0.4), smoothstep(0.55, 0.8, flow));
    c = mix(hot * uGlow * (0.8 + 0.4 * flow), uDeep, crust * 0.85);
  } else {
    // water (or cloud): waves in the light, darker looking down into it
    float e = 0.6;
    vec2 p = xz * 0.09 * uWaves;
    float t = uTime * 0.6;
    float h0 = wFbm(p + vec2(t * 0.3, t * 0.2));
    float hx = wFbm(p + vec2(e * 0.09, 0.0) + vec2(t * 0.3, t * 0.2));
    float hz = wFbm(p + vec2(0.0, e * 0.09) + vec2(t * 0.3, t * 0.2));
    float fade = 1.0 - smoothstep(80.0, 900.0, dist);
    vec3 n = normalize(vec3((h0 - hx) * 3.0 * fade, 1.0, (h0 - hz) * 3.0 * fade));
    float facing = clamp(dot(n, view), 0.0, 1.0);
    float fresnel = pow(1.0 - facing, 4.0);
    c = mix(uDeep, uColor, 0.35 + 0.65 * (1.0 - facing));
    c = mix(c, uSky, fresnel * 0.75);
    vec3 h = normalize(uSun + view);
    float spec = pow(max(dot(n, h), 0.0), uKind > 0.5 ? 40.0 : 220.0);
    c += uSunColor * spec * (uKind > 0.5 ? 0.25 : 1.6);
    // foam, in streaks
    c = mix(c, vec3(0.92), smoothstep(0.72, 0.8, wFbm(p * 2.3 + t * 0.4)) * uFoam * fade);
  }
  gl_FragColor = vec4(c, 1.0);
  #include <fog_fragment>
}`;

const KIND = { sea: 0, swamp: 0, clouds: 1, lava: 2, salt: 0 };

export function createWater(site, sunDir, sunColor, opts = {}) {
  const w = site.water;
  if (w.kind === 'sea' || w.kind === 'swamp' || w.kind === 'salt') return createSea(site, sunDir, sunColor, opts);
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uColor: { value: new THREE.Color(w.color) },
      uDeep: { value: new THREE.Color(w.deep ?? w.color) },
      uSun: { value: sunDir.clone() },
      uSunColor: { value: new THREE.Color(sunColor) },
      uSky: { value: new THREE.Color(site.sky.horizon) },
      uTime: { value: 0 },
      uKind: { value: KIND[w.kind] ?? 0 },
      uFoam: { value: w.foam ?? (w.kind === 'sea' ? 0.5 : 0) },
      uGlow: { value: w.glow ?? 3 },
      uWaves: { value: w.waves ?? (w.kind === 'swamp' ? 2.2 : w.kind === 'clouds' ? 0.12 : 1) },
      uNoise: { value: noiseTexture() },
    },
  ]);
  const material = new THREE.ShaderMaterial({ vertexShader: PLANE_VERT, fragmentShader: PLANE_FRAG, uniforms, fog: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(FAR * 2.2, FAR * 2.2, 1, 1).rotateX(-Math.PI / 2), material);
  mesh.position.y = w.level;
  mesh.receiveShadow = false;
  mesh.name = 'water';
  // lava lights what's round it
  const glow = w.kind === 'lava' ? new THREE.HemisphereLight('#000000', '#ff6a1a', 0.9) : null;
  return {
    mesh,
    glow,
    update(t) {
      uniforms.uTime.value = t;
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}

// ── The sea and the swamp ──

const SEA_VERT = (waves) => `
uniform vec2 uCentre;
uniform sampler2D uDepth;
uniform float uHalf, uMax, uReach, uBreakers, uLevel, uTime;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vPinch;
varying float vDepth;
varying float vCrest;
varying float vShore;
#include <fog_pars_vertex>
${WAVES_GLSL(waves)}
// the depth there, and how far from the waterline (open sea past the map)
vec2 depthAt(vec2 p) {
  vec2 uv = (p + uHalf) / (2.0 * uHalf);
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec2(uMax, uReach);
  return texture2D(uDepth, uv).rg * vec2(uMax, uReach);
}
// (ocean.js's damp: still on the sand, standing up in the shallows)
float shoal(float d) {
  if (d <= 0.0) return 0.0;
  return smoothstep(0.0, 1.2, d) * (1.0 + uBreakers * 0.45 * (1.0 - smoothstep(1.5, 9.0, d)));
}
void main() {
  vec2 p = position.xz + uCentre;
  vec2 dw = depthAt(p);
  float depth = dw.x;
  vec3 n;
  float pinch;
  vec3 d = gerstner(p, length(position.xz), shoal(depth), n, pinch);
  vWorld = vec3(p.x, uLevel, p.y) + d;
  vNormal = n;
  vPinch = pinch;
  vDepth = depth;
  vCrest = d.y;
  vShore = dw.y;
  vec4 mvPosition = viewMatrix * vec4(vWorld, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const SEA_FRAG = `
uniform vec3 uColor, uDeep, uShallow, uBed, uSun, uSunColor, uZenith, uHorizon;
uniform float uTime, uClarity, uCaps, uShore, uBreakers, uGlint, uRough, uScum;
uniform sampler2D uNoise;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vPinch;
varying float vDepth;
varying float vCrest;
varying float vShore;
#include <fog_pars_fragment>
void main() {
  vec3 toEye = cameraPosition - vWorld;
  float dist = length(toEye);
  vec3 V = toEye / dist;
  vec2 w = vWorld.xz;
  // fine ripples: two layers of the noise tile sliding past each other
  float near = 1.0 / (1.0 + dist * 0.01);
  vec4 r1 = texture2D(uNoise, w * 0.045 + uTime * vec2(0.012, 0.008));
  vec4 r2 = texture2D(uNoise, w * 0.11 - uTime * vec2(0.018, 0.011));
  vec2 rip = ((r1.rg - 0.5) * 0.9 + (r2.ba - 0.5) * 0.6) * uRough * (0.3 + 0.7 * near);
  vec3 N = normalize(vNormal + vec3(rip.x, 0.0, rip.y));
  // mirror or water, by the angle you look at it
  float facing = max(dot(N, V), 0.0);
  float fresnel = 0.02 + 0.98 * pow(1.0 - facing, 5.0);
  vec3 R = reflect(-V, N);
  vec3 sky = mix(uHorizon, uZenith, pow(smoothstep(0.0, 0.8, abs(R.y)), 0.6));
  // the body: dark in the troughs, lit where a crest stands between you and
  // the sun, then the shallows' colour, then the bed showing through
  float crest = smoothstep(-0.5, 1.5, vCrest);
  vec3 sunFlat = normalize(vec3(uSun.x, 0.0, uSun.z) + vec3(1e-4));
  float through = pow(max(dot(V, -sunFlat), 0.0), 3.0) * crest;
  vec3 body = mix(uDeep, uColor, 0.35 + crest * 0.4 + through * 0.8);
  float shallow = exp(-vDepth / max(uClarity, 0.1));
  body = mix(body, uShallow, smoothstep(0.02, 0.6, shallow) * 0.85);
  body = mix(body, uBed, pow(shallow, 4.0) * 0.7);
  vec3 col = mix(body, sky, fresnel * (1.0 - shallow * 0.4));
  // the sun's road on the water
  vec3 H = normalize(uSun + V);
  col += uSunColor * pow(max(dot(N, H), 0.0), 260.0) * uGlint * (0.3 + 0.7 * near);
  // foam: whitecaps where the waves pinch, the crests breaking in the surf,
  // and the wash running up to the waterline in bands, with lace at its edge
  vec4 n1 = texture2D(uNoise, w * 0.06 + uTime * vec2(0.01, 0.006));
  vec4 n2 = texture2D(uNoise, w * 0.21 - uTime * vec2(0.008, 0.012));
  float lumpy = n1.b * 0.6 + n2.a * 0.4;
  float wet = step(0.001, vDepth);
  float caps = smoothstep(0.82, 0.55, vPinch) * smoothstep(0.42, 0.66, lumpy) * uCaps;
  // (by the distance from the waterline, so a gentle beach's surf is as
  // narrow as a steep one's: breakers 5–28 m out, the wash in the last 9 m,
  // its bands running in toward the sand, lace along the edge)
  float surf = smoothstep(3.0, 7.0, vShore) * (1.0 - smoothstep(18.0, 30.0, vShore)) * wet;
  float breaking = surf * smoothstep(0.05, 0.45, vCrest) * uBreakers * smoothstep(0.35, 0.62, lumpy);
  float wash = (1.0 - smoothstep(2.0, 9.0, vShore)) * (0.5 + 0.5 * sin(vShore * 1.15 + uTime * 1.5 + lumpy * 2.5));
  wash = smoothstep(0.62, 0.92, wash) * uShore * wet;
  float lace = (1.0 - smoothstep(0.4, 2.2, vShore)) * uShore * 0.85 * wet;
  float foam = clamp(max(max(caps, breaking), max(wash, lace) * smoothstep(0.25, 0.55, lumpy + 0.2)), 0.0, 1.0);
  vec3 foamCol = vec3(0.86, 0.9, 0.92) * (0.55 + 0.6 * max(dot(N, uSun), 0.0));
  col = mix(col, foamCol, foam * 0.92);
  // a swamp's skin: scum and duckweed in patches
  float scum = smoothstep(0.55, 0.75, n1.r * 0.7 + r2.g * 0.3) * uScum;
  col = mix(col, uBed * 1.4 + vec3(0.03, 0.05, 0.0), scum * 0.7);
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}`;

function discGeometry({ radii, around }) {
  const pos = new Float32Array(radii.length * around * 3);
  radii.forEach((r, i) => {
    for (let j = 0; j < around; j++) {
      const a = (j / around) * Math.PI * 2 + (i % 2) * (Math.PI / around);
      const o = (i * around + j) * 3;
      pos[o] = Math.cos(a) * r;
      pos[o + 2] = Math.sin(a) * r;
    }
  });
  const index = [];
  for (let i = 0; i < radii.length - 1; i++)
    for (let j = 0; j < around; j++) {
      const a = i * around + j;
      const b = i * around + ((j + 1) % around);
      index.push(a, b, a + around, b, b + around, a + around);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(index);
  return g;
}

function createSea(site, sunDir, sunColor, { heightAt, small = false, id } = {}) {
  const w = site.water;
  const sea = seaFor(id, w);
  const waves = wavesFor(sea);
  const rings = discRings({ small });
  // (no ground to bake: all of it deep)
  const depth = bakeDepth(heightAt ?? (() => -Infinity), w.level, { half: HALF, n: small ? 256 : 512, max: 24 });
  const depthTex = new THREE.DataTexture(depth.rg, depth.n, depth.n, THREE.RGFormat, THREE.UnsignedByteType);
  depthTex.magFilter = depthTex.minFilter = THREE.LinearFilter;
  depthTex.wrapS = depthTex.wrapT = THREE.ClampToEdgeWrapping;
  depthTex.colorSpace = THREE.NoColorSpace;
  depthTex.needsUpdate = true;
  const sun = new THREE.Color(sunColor);
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uCentre: { value: new THREE.Vector2() },
      uHalf: { value: depth.half },
      uMax: { value: depth.max },
      uReach: { value: depth.reach },
      uLevel: { value: w.level },
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(w.color) },
      uDeep: { value: new THREE.Color(w.deep ?? w.color) },
      uShallow: { value: new THREE.Color(sea.shallow) },
      uBed: { value: new THREE.Color(sea.bed) },
      uSun: { value: sunDir.clone() },
      uSunColor: { value: sun.multiplyScalar(sea.glint > 0.5 ? 2.2 : 1) },
      uZenith: { value: new THREE.Color(site.sky.zenith ?? site.sky.horizon) },
      uHorizon: { value: new THREE.Color(site.sky.horizon) },
      uClarity: { value: sea.clarity },
      uCaps: { value: sea.caps * (w.foam != null ? 0.5 + w.foam : 1) },
      uShore: { value: sea.shore },
      uBreakers: { value: sea.breakers },
      uGlint: { value: sea.glint },
      uRough: { value: sea.rough },
      uScum: { value: sea.scum ?? 0 },
    },
  ]);
  // (the textures after the merge, which would clone them)
  uniforms.uDepth = { value: depthTex };
  uniforms.uNoise = { value: noiseTexture() };
  const material = new THREE.ShaderMaterial({ vertexShader: SEA_VERT(waves), fragmentShader: SEA_FRAG, uniforms, fog: true });
  const mesh = new THREE.Mesh(discGeometry(rings), material);
  mesh.frustumCulled = false; // (it goes where the camera goes)
  mesh.receiveShadow = false;
  mesh.name = 'water';
  return {
    mesh,
    glow: null,
    depth,
    update(t, camera) {
      uniforms.uTime.value = t;
      if (camera) {
        const [x, z] = snapCentre(camera.position.x, camera.position.z, rings.step);
        uniforms.uCentre.value.set(x, z);
      }
    },
    // the water's surface there and then (what's drawn, to a few cm)
    height: (x, z, t = uniforms.uTime.value) => w.level + waveHeight(x, z, t, waves, depth.at(x, z), sea),
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
      depthTex.dispose();
    },
  };
}
