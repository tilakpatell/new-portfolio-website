// One wind for a world, after Bruno Simon's folio-2025 (Wind.js;
// docs/research/2026-10-06-why-theirs-look-expensive.md): the whole "sway"
// is two lookups in one noise picture, a quick one and a slow, broad gust,
// scrolling along the wind's way. Their sum, centred on nought, pushes along
// the wind's direction by its strength. The grass tips, the flower heads and
// the trees' crowns all read the same function, so everything moves together.
//
//   createWind({ strength, angle }) → { uniforms, glsl, update(dt),
//     set({ strength, angle }), sway(material, { strength, height }), dispose() }
//   WIND_GLSL           the uniforms and `vec2 windOffset(vec2 xz)`, for a shader
//   swayShader(shader, { strength, height }) → { vertexShader, fragmentShader, swapped } (pure)
//   windNoise(size)     the tiling noise picture it reads
//   sampleNoise(image, u, v), windOffsetAt(uniforms, x, z)   the same, on the CPU (pure)
//
// `strength` 0 to 1 (a breath to a gale); `angle` the way it blows, radians
// round from +x toward +z. A stronger wind also moves faster.

import * as THREE from 'three';
import { fbm, makeNoise } from '../paint';

export const WIND_GLSL = /* glsl */ `
uniform sampler2D uWindNoise;
uniform float uWindTime;
uniform float uWindStrength;
uniform vec2 uWindDir;
vec2 windOffset(vec2 xz) {
  float a = texture2D(uWindNoise, xz * 0.1 + uWindDir * uWindTime).r;
  float b = texture2D(uWindNoise, xz * 0.05 + uWindDir * uWindTime * 0.2).r;
  return uWindDir * (a + b - 1.0) * uWindStrength;
}
`;
// the scales WIND_GLSL reads at (kept equal to it: wind.test.js checks the text)
export const WIND_SCALE = { quick: 0.1, slow: 0.05, slowTime: 0.2 };

// The noise picture as texture2D reads it at its full size: bilinear,
// repeating, texel centres at (i + 0.5) / N; 0…1
export function sampleNoise(image, u, v) {
  const { data, width: W, height: H } = image;
  const x = u * W - 0.5;
  const y = v * H - 0.5;
  const i0 = Math.floor(x);
  const j0 = Math.floor(y);
  const fx = x - i0;
  const fy = y - j0;
  const m = (a, n) => ((a % n) + n) % n;
  const at = (i, j) => data[m(j, H) * W + m(i, W)] / 255;
  const a = at(i0, j0) + (at(i0 + 1, j0) - at(i0, j0)) * fx;
  const b = at(i0, j0 + 1) + (at(i0 + 1, j0 + 1) - at(i0, j0 + 1)) * fx;
  return a + (b - a) * fy;
}

// windOffset on the CPU, from a wind's live uniforms: { x, z, k } (k: how
// far along the wind's way)
export function windOffsetAt(u, x, z, out = { x: 0, z: 0, k: 0 }) {
  const img = u.uWindNoise.value.image;
  const d = u.uWindDir.value;
  const t = u.uWindTime.value;
  const a = sampleNoise(img, x * WIND_SCALE.quick + d.x * t, z * WIND_SCALE.quick + d.y * t);
  const b = sampleNoise(img, x * WIND_SCALE.slow + d.x * t * WIND_SCALE.slowTime, z * WIND_SCALE.slow + d.y * t * WIND_SCALE.slowTime);
  out.k = (a + b - 1) * u.uWindStrength.value;
  out.x = d.x * out.k;
  out.z = d.y * out.k;
  return out;
}

// A tiling picture of soft noise, stretched to its full range.
export function windNoise(size = 128, seed = 11) {
  const n = makeNoise(seed);
  const raw = new Float32Array(size * size);
  let lo = Infinity;
  let hi = -Infinity;
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const v = fbm(n, (i / size) * 8, (j / size) * 8, { period: 8, octaves: 3 });
      raw[j * size + i] = v;
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
  const px = new Uint8Array(size * size);
  for (let k = 0; k < px.length; k++) px[k] = Math.round(((raw[k] - lo) / (hi - lo || 1)) * 255);
  const t = new THREE.DataTexture(px, size, size, THREE.RedFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

// Bends a thing's top by the wind where it stands (its instance's origin,
// or the mesh's), by the square of how far up it is over `height`, as pure
// strings.
export function swayShader({ vertexShader, fragmentShader }, { strength = 0.2, height = 1 } = {}) {
  if (!vertexShader.includes('#include <begin_vertex>')) return { vertexShader, fragmentShader, swapped: false };
  const vs = vertexShader.replace('#include <common>', `#include <common>\n${WIND_GLSL}`).replace(
    '#include <begin_vertex>',
    `#include <begin_vertex>
    {
      vec3 swRoot = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      #ifdef USE_INSTANCING
        swRoot = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
      #endif
      float swUp = clamp(position.y / ${height.toFixed(3)}, 0.0, 2.0);
      transformed.xz += windOffset(swRoot.xz) * swUp * swUp * ${strength.toFixed(3)};
    }`,
  );
  return { vertexShader: vs, fragmentShader, swapped: true };
}

export function createWind({ strength = 0.45, angle = 0.6 * Math.PI } = {}) {
  const noise = windNoise();
  const uniforms = {
    uWindNoise: { value: noise },
    uWindTime: { value: 0 },
    uWindStrength: { value: strength },
    uWindDir: { value: new THREE.Vector2(Math.cos(angle), Math.sin(angle)) },
  };
  const set = ({ strength: s = null, angle: a = null } = {}) => {
    if (s != null) uniforms.uWindStrength.value = s;
    if (a != null) uniforms.uWindDir.value.set(Math.cos(a), Math.sin(a));
  };
  return {
    uniforms,
    glsl: WIND_GLSL,
    set,
    // the gusts move on, faster the harder it blows (never quite still)
    update(dt) {
      uniforms.uWindTime.value += dt * 0.1 * Math.max(0.2, uniforms.uWindStrength.value);
    },
    // a material swaying in this wind: `strength` metres at `height` up
    sway(material, { strength: k = 0.2, height = 1 } = {}) {
      if (!material || material.userData.sway) return material;
      const before = material.onBeforeCompile;
      material.onBeforeCompile = (sh, r) => {
        before?.call(material, sh, r);
        Object.assign(sh.uniforms, uniforms);
        const out = swayShader(sh, { strength: k, height });
        sh.vertexShader = out.vertexShader;
        sh.fragmentShader = out.fragmentShader;
      };
      const key = material.customProgramCacheKey;
      material.customProgramCacheKey = () => `${key ? key.call(material) : ''}|sway:${k}:${height}`;
      material.userData.sway = uniforms;
      material.needsUpdate = true;
      return material;
    },
    dispose() {
      noise.dispose();
    },
  };
}
