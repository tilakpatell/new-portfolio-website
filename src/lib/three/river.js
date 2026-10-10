// Water, Bruno Simon's look on our geometry (folio-2025's WaterSurface.js;
// research note Part 2 §2). His is a flat white quad that draws only where
// the floor's mask is deep enough, the floor's own depth gradient showing
// through the shallows; ours is a mesh per cell at the water's level (a
// river runs downhill, a lake is flat: lib/land/cell.js's water), with his
// mask unchanged:
//
//   - the shore: white wherever the depth B is past 0.17;
//   - the ripples: in the shallow band under it, contour bands of the depth,
//     fract((B + t·0.5)·10) − (1.3 − 1.3B) + noise, thresholded, drifting by
//     the wind's time and, here, along the river's flow (the mask's A);
//   - alpha the larger, so between bank and shore the ground shows through.
//
// His solid water is white, lit; on his small map that is a few pools, on
// an open sea it is the whole screen, one flat colour: ours is the land's
// own depth gradient there (his floor's turquoise to deep blue, which his
// shallows show through anyway), white in the bands.
//
// On high and ultra the shallows are the opaque frame blurred (his fake
// refraction): the world draws its opaque pass into a texture first and
// hands it over (setOpaque); 9 taps of radius 0.01 of the screen in place of
// his 25. On mid and low, plain transparency. waterlineShader is his white
// band, 0.013 m, round anything where it crosses the surface.
//
//   createWaterSurface({ map, wind, tier }) → { group, material, blur,
//     set(cx, cz, cell), drop(cx, cz), update(dt), setOpaque(texture | null),
//     dispose() }
//   waterMesh(cell) → { positions, indices } | null (pure: the cell's water
//     triangles, those with a dry corner left out; null when all dry)
//   waterShader(shader, { blur }) → { vertexShader, fragmentShader, swapped } (pure)
//   waterlineShader(shader) → { vertexShader, fragmentShader, swapped } (pure;
//     a uWaterLevel uniform per object, the world sets it)

import * as THREE from 'three';
import { LAND_GLSL } from './landmap';
import { WIND_GLSL } from './wind';

const CELL = 64;
const N = 65;

export function waterMesh(cell) {
  const w = cell.water;
  const positions = new Float32Array(N * N * 3);
  const indices = [];
  for (let iz = 0; iz < N; iz++)
    for (let ix = 0; ix < N; ix++) {
      const k = iz * N + ix;
      positions[k * 3] = ix;
      positions[k * 3 + 1] = Number.isNaN(w[k]) ? 0 : w[k];
      positions[k * 3 + 2] = iz;
    }
  // the land's split, (ix + 1, iz)–(ix, iz + 1), wound to face up
  const wet = (k) => !Number.isNaN(w[k]);
  for (let iz = 0; iz < CELL; iz++)
    for (let ix = 0; ix < CELL; ix++) {
      const a = iz * N + ix;
      const b = a + 1;
      const c = a + N;
      const d = c + 1;
      if (wet(a) && wet(b) && wet(c)) indices.push(a, c, b);
      if (wet(b) && wet(c) && wet(d)) indices.push(b, c, d);
    }
  if (!indices.length) return null;
  return { positions, indices: new Uint32Array(indices) };
}

const BLUR_PARS = /* glsl */ `
uniform float uBlur;
uniform sampler2D uOpaque;
uniform vec2 uOpaqueSize;
`;

const PARS_FS = /* glsl */ `
varying vec3 vWaterWorld;
${LAND_GLSL}
${WIND_GLSL}
// his mask: the shore past B 0.17 and the ripple bands in the shallows;
// the colour is what the water shows where it is solid: the land's own depth
// gradient (his floor's turquoise to deep blue), white in the bands
float waterAlpha(vec2 xz, out vec3 colour) {
  vec4 m = landMask(xz);
  float b = m.b;
  // his shore: solid past 0.17
  float shore = step(0.17, b);
  // his ripples: contour bands of the depth, drifting with the wind's time,
  // each band its own noise, the noise carried along the flow
  float flow = m.a * 6.2831853;
  vec2 along = vec2(cos(flow), sin(flow)) * step(0.001, m.a);
  float base = (b + uWindTime * 0.5) * 10.0;
  float band = floor(base);
  float noise = texture2D(uWindNoise, (xz - along * uWindTime * 2.0 + band / 0.345) * 0.1).r - 0.5;
  float ripples = fract(base) - (1.3 - 1.3 * b) + noise;
  ripples = step(-0.4, ripples) * step(0.001, b);
  colour = mix(landColour(vec4(0.0, 0.0, max(b, 0.2), 0.0), 0.0, -1e4), vec3(1.0), ripples * (1.0 - shore * 0.6));
  return max(shore, ripples);
}
`;

export function waterShader({ vertexShader, fragmentShader }, { blur = false } = {}) {
  const ok = vertexShader.includes('#include <worldpos_vertex>') && fragmentShader.includes('#include <color_fragment>') && fragmentShader.includes('#include <opaque_fragment>');
  if (!ok) return { vertexShader, fragmentShader, swapped: false };
  const vs = vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vWaterWorld;')
    .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWaterWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  // (the shallows, on high: the opaque frame behind, blurred, 9 taps of 0.01)
  const shallows = blur
    ? `
if (uBlur > 0.5 && waterA < 0.5) {
  vec2 uv = gl_FragCoord.xy / uOpaqueSize;
  vec3 sum = vec3(0.0);
  for (int i = 0; i < 9; i++) {
    float a = float(i) * 2.3999632;
    float r = 0.01 * sqrt((float(i) + 0.5) / 9.0);
    sum += texture2D(uOpaque, uv + vec2(cos(a), sin(a)) * r).rgb;
  }
  outgoingLight = sum / 9.0;
  diffuseColor.a = 1.0;
}`
    : '';
  const fs = fragmentShader
    .replace('#include <common>', `#include <common>\n${PARS_FS}${blur ? BLUR_PARS : ''}`)
    .replace('#include <color_fragment>', '#include <color_fragment>\nvec3 waterC;\nfloat waterA = waterAlpha(vWaterWorld.xz, waterC);\ndiffuseColor.rgb *= waterC;\ndiffuseColor.a *= waterA;')
    .replace('#include <opaque_fragment>', `${shallows}\n#include <opaque_fragment>`);
  return { vertexShader: vs, fragmentShader: fs, swapped: true };
}

export function waterlineShader({ vertexShader, fragmentShader }) {
  const ok = vertexShader.includes('#include <worldpos_vertex>') && fragmentShader.includes('#include <color_fragment>');
  if (!ok) return { vertexShader, fragmentShader, swapped: false };
  const vs = vertexShader
    .replace('#include <common>', '#include <common>\nvarying float vWaterlineY;')
    .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWaterlineY = (modelMatrix * vec4(transformed, 1.0)).y;');
  const fs = fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vWaterlineY;\nuniform float uWaterLevel;')
    .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(vec3(1.0), diffuseColor.rgb, step(0.013, abs(vWaterlineY - uWaterLevel)));');
  return { vertexShader: vs, fragmentShader: fs, swapped: true };
}

export function createWaterSurface({ map, wind, tier = 'high' } = {}) {
  const blur = tier === 'high' || tier === 'ultra';
  const uniforms = { uBlur: { value: 0 }, uOpaque: { value: null }, uOpaqueSize: { value: new THREE.Vector2(1, 1) } };
  const material = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, depthWrite: false });
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, map.uniforms, wind.uniforms, uniforms);
    const out = waterShader(sh, { blur });
    sh.vertexShader = out.vertexShader;
    sh.fragmentShader = out.fragmentShader;
  };
  material.customProgramCacheKey = () => (blur ? 'water|blur' : 'water');
  const group = new THREE.Group();
  group.name = 'water';
  const meshes = new Map();
  const drop = (key) => {
    const m = meshes.get(key);
    if (!m) return;
    group.remove(m);
    m.geometry.dispose();
    meshes.delete(key);
  };
  return {
    group,
    material,
    uniforms,
    blur,
    set(cx, cz, cell) {
      const key = `${cx},${cz}`;
      drop(key);
      const w = waterMesh(cell);
      if (!w) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(w.positions, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N * N * 3).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
      g.setIndex(new THREE.BufferAttribute(w.indices, 1));
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, material);
      mesh.position.set(cx * CELL, 0, cz * CELL);
      mesh.renderOrder = 1;
      mesh.name = `water ${key}`;
      group.add(mesh);
      meshes.set(key, mesh);
      return mesh;
    },
    drop(cx, cz) {
      drop(`${cx},${cz}`);
    },
    // (the wind's own update moves its time, which the ripples read)
    update() {},
    // the opaque frame for the shallows, or null for plain transparency
    setOpaque(texture, width = 1, height = 1) {
      uniforms.uOpaque.value = texture;
      uniforms.uBlur.value = texture && blur ? 1 : 0;
      uniforms.uOpaqueSize.value.set(width, height);
    },
    dispose() {
      for (const k of [...meshes.keys()]) drop(k);
      material.dispose();
    },
  };
}
