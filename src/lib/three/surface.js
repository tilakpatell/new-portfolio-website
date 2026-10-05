// Big tiled surfaces without the tiling: a lawn, a desert, an apron, a
// courtyard's paving are one scan repeated dozens of times, and the eye
// finds the repeat from a few metres up. `antiTile` blends a second copy of
// the same maps, turned and shifted (and scaled if asked), into the first,
// weighted by a slow noise of where on the ground you are, so no two
// repeats line up any more; with `detail`, a fine tiling normal fades in
// within a few metres of the camera for the grain a 1K scan hasn't got at
// that range. Colour, normal, roughness, metalness and occlusion maps are
// all blended with the same weight, so the surface stays one material.
//
// Cost: one extra fetch per blended map (two for a detail normal), no
// extra passes; on the `low` tier it does nothing.
//
//   antiTile(material, { angle, scale, frequency, mix, axis, detail }) → material
//   detailNormal({ size, seed, strength }) → a tiling normal texture for `detail`
//
// Call it last on a material whose shader other hooks also change (it
// expands three's #include lines for the maps it blends, so a hook that
// looks for them afterwards would miss them). Pure parts (the shader
// rewrite) are tested on stub shaders.

import * as THREE from 'three';
import { budget } from '../device';
import { bufferCanvas, heightToNormal, tileFbm } from '../texture';
import { sharpen } from './textures';

export const DEFAULTS = { angle: 0.61, scale: 1, frequency: 0.045, mix: 1, axis: 'xz', detail: null };

const AXES = { xz: 'vAtPos.xz', xy: 'vAtPos.xy', yz: 'vAtPos.yz' };

const PARS = /* glsl */ `
varying vec3 vAtPos;
uniform float uAtAngle;
uniform float uAtScale;
uniform float uAtFreq;
uniform float uAtMix;
float atHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float atNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(atHash(i), atHash(i + vec2(1.0, 0.0)), f.x), mix(atHash(i + vec2(0.0, 1.0)), atHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
// the second copy's place in the texture: turned, scaled and shifted
vec2 atUv2(vec2 uv) {
  float c = cos(uAtAngle), s = sin(uAtAngle);
  return mat2(c, -s, s, c) * (uv * uAtScale) + vec2(0.37, 0.61);
}
vec4 atMix(sampler2D t, vec2 uv, float w) { return mix(texture2D(t, uv), texture2D(t, atUv2(uv)), w); }
`;

const DETAIL_PARS = /* glsl */ `
uniform sampler2D uAtDetail;
uniform float uAtDetailScale;
uniform float uAtDetailStrength;
uniform float uAtDetailRange;
`;

// The rewrite of a shader pair, as pure strings. `chunks` is three's
// ShaderChunk (passed in so this can be tested with stubs): each map's
// include is expanded from it with its one texture read swapped for the
// blend. A chunk whose read isn't where this expects it (another three
// version) is left alone, and that map simply isn't blended.
export function antiTileShader({ vertexShader, fragmentShader }, { axis = 'xz', detail = false } = {}, chunks = THREE.ShaderChunk) {
  const pos = AXES[axis] ?? AXES.xz;
  const vs = vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vAtPos;').replace(
    '#include <worldpos_vertex>',
    `#include <worldpos_vertex>
    {
      vec4 atp = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        atp = instanceMatrix * atp;
      #endif
      vAtPos = (modelMatrix * atp).xyz;
    }`,
  );
  const swap = (name, from, to) => {
    const src = chunks[name];
    if (typeof src !== 'string' || !src.includes(from)) return null;
    return src.replace(from, to);
  };
  const map = swap('map_fragment', 'texture2D( map, vMapUv )', 'atMix( map, vMapUv, atW )');
  const rough = swap('roughnessmap_fragment', 'texture2D( roughnessMap, vRoughnessMapUv )', 'atMix( roughnessMap, vRoughnessMapUv, atW )');
  const metal = swap('metalnessmap_fragment', 'texture2D( metalnessMap, vMetalnessMapUv )', 'atMix( metalnessMap, vMetalnessMapUv, atW )');
  const ao = swap('aomap_fragment', 'texture2D( aoMap, vAoMapUv ).r', 'mix( texture2D( aoMap, vAoMapUv ).r, texture2D( aoMap, atUv2( vAoMapUv ) ).r, atW )');
  // the second copy's normal turns with its texture; a detail normal, if
  // any, is added within range of the camera
  const normal = swap(
    'normal_fragment_maps',
    'vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;',
    `vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
    {
      vec3 atN2 = texture2D( normalMap, atUv2( vNormalMapUv ) ).xyz * 2.0 - 1.0;
      float atc = cos(uAtAngle), ats = sin(uAtAngle);
      atN2.xy = mat2(atc, ats, -ats, atc) * atN2.xy;
      mapN = normalize(mix(mapN, atN2, atW));
    }
    ${
      detail
        ? `{
      float atD = length(vViewPosition);
      float atFade = (1.0 - smoothstep(uAtDetailRange * 0.4, uAtDetailRange, atD)) * uAtDetailStrength;
      vec3 atDN = texture2D( uAtDetail, ${pos} * uAtDetailScale ).xyz * 2.0 - 1.0;
      mapN = normalize(vec3(mapN.xy + atDN.xy * atFade, mapN.z));
    }`
        : ''
    }`,
  );
  let fs = fragmentShader.replace('#include <common>', `#include <common>\n${PARS}${detail ? DETAIL_PARS : ''}`).replace(
    '#include <clipping_planes_fragment>',
    `#include <clipping_planes_fragment>
    float atW = smoothstep(0.3, 0.7, atNoise(${pos} * uAtFreq) * 0.65 + atNoise(${pos} * uAtFreq * 2.7 + 11.3) * 0.35) * uAtMix;`,
  );
  if (map) fs = fs.replace('#include <map_fragment>', map);
  if (rough) fs = fs.replace('#include <roughnessmap_fragment>', rough);
  if (metal) fs = fs.replace('#include <metalnessmap_fragment>', metal);
  if (ao) fs = fs.replace('#include <aomap_fragment>', ao);
  if (normal) fs = fs.replace('#include <normal_fragment_maps>', normal);
  return { vertexShader: vs, fragmentShader: fs, blended: { map: !!map, roughness: !!rough, metalness: !!metal, ao: !!ao, normal: !!normal } };
}

// Break a material's tiling. Options:
//   angle      how far the second copy is turned (radians)
//   scale      the second copy's size relative to the first (1: the same
//              texel density; 0.5: features twice as big)
//   frequency  how quickly the blend wanders, per world unit (metres)
//   mix        how much of the second copy at most (0..1)
//   axis       which world plane the surface lies in: 'xz' (ground), 'xy', 'yz'
//   detail     { texture, scale, strength, range }: a tiling normal map
//              (detailNormal()'s, or any) laid over at `scale` repeats per
//              metre, `strength` (0..1) strong, fading out by `range` metres
// Does nothing on the `low` tier, or when `enabled` is false.
export function antiTile(material, { enabled = budget().tier !== 'low', ...opts } = {}) {
  if (!material || !enabled) return material;
  const o = { ...DEFAULTS, ...opts };
  const detail = o.detail?.texture ? { scale: 1, strength: 0.5, range: 24, ...o.detail } : null;
  const uniforms = {
    uAtAngle: { value: o.angle },
    uAtScale: { value: o.scale },
    uAtFreq: { value: o.frequency },
    uAtMix: { value: o.mix },
  };
  if (detail) {
    Object.assign(uniforms, {
      uAtDetail: { value: detail.texture },
      uAtDetailScale: { value: detail.scale },
      uAtDetailStrength: { value: detail.strength },
      uAtDetailRange: { value: detail.range },
    });
  }
  const before = material.onBeforeCompile;
  material.onBeforeCompile = (sh, r) => {
    before?.call(material, sh, r);
    Object.assign(sh.uniforms, uniforms);
    const out = antiTileShader(sh, { axis: o.axis, detail: !!detail });
    sh.vertexShader = out.vertexShader;
    sh.fragmentShader = out.fragmentShader;
  };
  // (code differs by axis and detail, so programs aren't shared across them)
  const key = material.customProgramCacheKey;
  material.customProgramCacheKey = () => `${key ? key.call(material) : ''}|antiTile:${o.axis}:${detail ? 1 : 0}`;
  material.userData.antiTile = uniforms;
  material.needsUpdate = true;
  return material;
}

// A tiling normal map of fine grain, for `detail`: small ridges and
// pebbles from layered noise, in a canvas texture that repeats.
export function detailNormal({ size = 256, seed = 7, strength = 2.2, renderer = null } = {}) {
  const f = tileFbm(seed, { base: 6, octaves: 4, gain: 0.55 });
  const g = tileFbm(seed + 3, { base: 14, octaves: 3, gain: 0.5, ridged: true });
  const height = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const h = f(u, v) * 0.7 + g(u, v) * 0.3;
      const i = (y * size + x) * 4;
      height[i] = h * 255;
      height[i + 3] = 255;
    }
  const normal = heightToNormal(height, size, size, strength);
  const t = new THREE.CanvasTexture(bufferCanvas(normal, size));
  return sharpen(t, { renderer, color: false, wrap: true });
}
