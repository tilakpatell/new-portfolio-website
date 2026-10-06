// What keeps a world standing on its floor instead of floating over it,
// without a shadow map: three layers, after Bruno Simon's folio
// (docs/research/2026-10-06-bruno-simon-folio.md).
//
//   floorShadow(material, bake)   the floor reads a mask baked offline from
//                                 the world's own static geometry: how much of
//                                 the sun reaches each point at each named
//                                 time of day, and how much of the sky. The
//                                 sun's light is cut by the first, the sky's
//                                 by the second (what an aoMap does), and what
//                                 is left in the dark is tinted the world's
//                                 shade, so a shadow goes warm, not grey.
//   standIn(material, bake)       a thing that moves dims in the floor's
//                                 baked shade where it stands.
//   bounce(material, opts)        the lower, downward faces of anything are
//                                 tinted toward the floor's colour, as light
//                                 thrown up off the ground would: nothing
//                                 looks as if it hovers.
//   createBlobShadows(opts)       a soft dark pool under each thing that
//                                 moves, slid away from the sun by how high
//                                 it is, fading as it rises or tips: one
//                                 instanced draw for all of them.
//
//   maskWeights(tod, times) → [channelA, channelB, t]   (pure)
//   blobPlacement(sun, pos, height, tilt, out)          (pure)
//   floorShadowShader(shader, { areas }, chunks)        (pure, tested on stubs)
//   bounceShader(shader, { base }, chunks)              (pure)
//   loadFloorShadow(dir, { renderer, shade }) → bake, from a baked index.json
//   setFloorTime(bake, tod)
//
// The masks are made by scripts/bake-floor-shadows.mjs, through a world's
// own scene (./grounding-bake.js). A world that has them turns its shadow
// pass off: what replaces it costs a texture fetch or two per floor pixel,
// on every tier alike.

import * as THREE from 'three';
import { forgetTexture, loadTexture } from './textures';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// ── the time of day, between the masks ──

// A mask holds one channel of sun per named time (0 R, 1 G, 2 B; 3 means no
// sun at all, the sky term only). For a time of day, the two named times
// either side of it (round the clock) and how far it is from the first to
// the second: the shadows ease from one picture to the next rather than
// sweep, which is the trade of baking them.
export function maskWeights(tod, times) {
  if (!times?.length) return [3, 3, 0];
  const t = (((tod % 1) + 1) % 1) || 0;
  const list = [...times].sort((a, b) => a.tod - b.tod);
  let i = list.length - 1;
  for (let k = 0; k < list.length; k++) if (list[k].tod <= t) i = k;
  const a = list[i];
  const b = list[(i + 1) % list.length];
  if (list.length === 1) return [a.channel, a.channel, 0];
  let span = b.tod - a.tod;
  if (span <= 0) span += 1;
  let into = t - a.tod;
  if (into < 0) into += 1;
  return [a.channel, b.channel, clamp01(into / span)];
}

// ── the varyings the floor and the bounce read ──

// The world position (and, for the bounce, the world normal) of each vertex,
// instancing included, added once however many hooks ask for them.
function groundVertex(vs, { normal = false, base = false } = {}) {
  let out = vs;
  const decl = [];
  if (!out.includes('varying vec3 vGroundPos;')) decl.push('varying vec3 vGroundPos;');
  if (normal && !out.includes('varying vec3 vGroundN;')) decl.push('varying vec3 vGroundN;');
  if (base && !out.includes('varying float vGroundBase;')) decl.push('varying float vGroundBase;');
  if (!decl.length) return out;
  out = out.replace('#include <common>', `#include <common>\n${decl.join('\n')}`);
  const nrm = out.includes('#include <beginnormal_vertex>') ? 'objectNormal' : 'normal';
  const body = [];
  if (decl.includes('varying vec3 vGroundPos;')) body.push('vGroundPos = (modelMatrix * gp).xyz;');
  if (decl.includes('varying vec3 vGroundN;')) body.push(`{ vec3 gn = ${nrm};\n  #ifdef USE_INSTANCING\n  gn = mat3(instanceMatrix) * gn;\n  #endif\n  vGroundN = mat3(modelMatrix) * gn; }`);
  if (decl.includes('varying float vGroundBase;')) body.push('vGroundBase = (modelMatrix * gb).y;');
  // (a matcap's shader works out no world position: there, after the
  // projection, where `transformed` is final all the same)
  const at = out.includes('#include <worldpos_vertex>') ? '#include <worldpos_vertex>' : '#include <project_vertex>';
  return out.replace(
    at,
    `${at}
    {
      vec4 gp = vec4(transformed, 1.0);
      vec4 gb = vec4(0.0, 0.0, 0.0, 1.0);
      #ifdef USE_INSTANCING
        gp = instanceMatrix * gp;
        gb = instanceMatrix * gb;
      #endif
      ${body.join('\n      ')}
    }`,
  );
}

// ── the floor's masks ──

const SUN_LINE = 'getDirectionalLightInfo( directionalLight, directLight );';

// The rewrite of a shader pair for `areas` masks, as pure strings. `chunks`
// is three's ShaderChunk (passed in so this can be tested with stubs): the
// lights chunk is expanded from it, with the sun's light cut by the mask
// where three works out each directional light. Each part says whether it
// found the line it looks for (another three version may move one), and a
// part that didn't is left out.
export function floorShadowShader({ vertexShader, fragmentShader }, { areas = 1, mover = false } = {}, chunks = THREE.ShaderChunk) {
  const n = Math.max(1, Math.floor(areas));
  const vs = groundVertex(vertexShader);
  // (the masks' samplers are indexed by a number, never a variable: GLSL ES
  // 3 won't index an array of samplers any other way)
  const reads = Array.from(
    { length: n },
    (_, i) => `
    {
      vec2 uv = (p.xz - uMaskRect[${i}].xy) * uMaskRect[${i}].zw;
      if (uv.x > 0.0 && uv.y > 0.0 && uv.x < 1.0 && uv.y < 1.0) {
        vec4 m = texture2D(uMask[${i}], uv);
        v = vec2(mix(gPick(m, uMaskMix.x), gPick(m, uMaskMix.y), uMaskMix.z), m.a);
      }
    }`,
  ).join('');
  const pars = /* glsl */ `
${fragmentShader.includes('varying vec3 vGroundPos;') ? '' : 'varying vec3 vGroundPos;'}
${mover ? 'uniform vec2 uMoverRange;' : ''}
uniform sampler2D uMask[${n}];
uniform vec4 uMaskRect[${n}];
uniform vec3 uMaskMix;
uniform vec3 uShadeTint;
uniform float uShadeMix;
float gPick(vec4 m, float c) { return c < 0.5 ? m.r : c < 1.5 ? m.g : c < 2.5 ? m.b : 1.0; }
// the sun's and the sky's share of a point on the floor (1 and 1 outside every mask)
vec2 gRead(vec3 p) {
  vec2 v = vec2(1.0);${reads}
  return v;
}
`;
  const lights = chunks.lights_fragment_begin;
  const sun = typeof lights === 'string' && lights.includes(SUN_LINE) ? lights.replace(SUN_LINE, `${SUN_LINE}\n\t\tdirectLight.color *= gSun;`) : null;
  const swapped = { sun: false, sky: false, shade: false };
  let fs = fragmentShader.replace('#include <common>', `#include <common>\n${pars}`).replace(
    '#include <clipping_planes_fragment>',
    `#include <clipping_planes_fragment>
    vec2 gV = gRead(vGroundPos);${mover ? '\n    if (vGroundPos.y < uMoverRange.x || vGroundPos.y > uMoverRange.y) gV = vec2(1.0);' : ''}
    float gSun = gV.x;
    float gSky = ${mover ? 'mix(0.7, 1.0, gV.y)' : 'mix(0.35, 1.0, gV.y)'};`,
  );
  if (sun && fs.includes('#include <lights_fragment_begin>')) {
    fs = fs.replace('#include <lights_fragment_begin>', sun);
    swapped.sun = true;
  }
  if (fs.includes('#include <aomap_fragment>')) {
    // (after the material's own occlusion, if it has a map of it)
    fs = fs.replace('#include <aomap_fragment>', '#include <aomap_fragment>\n\treflectedLight.indirectDiffuse *= gSky;\n\treflectedLight.indirectSpecular *= gSky;');
    swapped.sky = true;
  }
  if (!mover && fs.includes('#include <opaque_fragment>')) {
    // What's left in the shade, the sky's light (bluish, the shadows would
    // read grey by it), warmed toward the shade's hue and a little dimmed, by
    // as much as the sun and the sky are kept off a point: at the darkest it
    // keeps about two thirds of its light (SHADE_TINT), since the sun's light
    // and the sky's are already cut.
    fs = fs.replace('#include <opaque_fragment>', 'outgoingLight *= mix(vec3(1.0), uShadeTint, uShadeMix * (1.0 - min(gSun, gV.y)));\n#include <opaque_fragment>');
    swapped.shade = true;
  }
  return { vertexShader: vs, fragmentShader: fs, swapped };
}

// The uniforms every floor material of one bake shares, so a frame sets the
// time once for all of them.
const shared = new WeakMap();
function floorUniforms(bake) {
  let u = shared.get(bake);
  if (!u) {
    const shade = bake.shade?.isColor ? bake.shade : new THREE.Color(bake.shade ?? 0x5a3420);
    u = {
      uMask: { value: bake.areas.map((a) => a.texture) },
      uMaskRect: { value: bake.areas.map((a) => new THREE.Vector4(a.x0, a.z0, 1 / a.w, 1 / a.d)) },
      uMaskMix: { value: new THREE.Vector3(3, 3, 0) },
      uShadeTint: { value: shadeTint(shade, bake.shadeLuminance ?? SHADE_TINT.luminance, SHADE_TINT.saturation) },
      uShadeMix: { value: bake.shadeMix ?? SHADE_TINT.mix },
    };
    shared.set(bake, u);
  }
  return u;
}

// How the shade colours a shadow on the floor: its hue at this brightness,
// this saturated, this much of it at the darkest (a shadow there keeps about
// two thirds of its light, and goes warm brown). Found by eye at dawn, noon
// and golden hour: at full strength the shade's hue turned the pools under
// the trees red, and at three quarters' brightness the shadows hardly read.
export const SHADE_TINT = { luminance: 0.45, saturation: 0.6, mix: 0.65 };

// A colour's hue at the linear luminance asked for, softened toward grey by
// `saturation` (1 keeps it as it is): the shade as a tint to multiply by.
// Black has no hue, so it comes back grey.
export function shadeTint(color, luminance = SHADE_TINT.luminance, saturation = 1) {
  const c = new THREE.Color(color);
  const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  if (l <= 0) return c.setRGB(luminance, luminance, luminance);
  c.multiplyScalar(luminance / l);
  return c.setRGB(luminance + (c.r - luminance) * saturation, luminance + (c.g - luminance) * saturation, luminance + (c.b - luminance) * saturation);
}

// The floor of a world (a lit material: the ground, the roads, a car park)
// shadowed by its baked masks. `bake` is { areas: [{ texture, x0, z0, w, d }],
// times: [{ tod, channel }], shade } (loadFloorShadow's). Call it last on a
// material other hooks change too; the mesh should stop receiving the shadow
// map (its `receiveShadow` off), or the shadow is counted twice.
export function floorShadow(material, bake) {
  if (!material || !bake?.areas?.length) return material;
  const uniforms = floorUniforms(bake);
  const areas = bake.areas.length;
  const before = material.onBeforeCompile;
  material.onBeforeCompile = (sh, r) => {
    before?.call(material, sh, r);
    Object.assign(sh.uniforms, uniforms);
    const out = floorShadowShader(sh, { areas });
    sh.vertexShader = out.vertexShader;
    sh.fragmentShader = out.fragmentShader;
  };
  const key = material.customProgramCacheKey;
  material.customProgramCacheKey = () => `${key ? key.call(material) : ''}|floorShadow:${areas}`;
  material.userData.floorShadow = uniforms;
  material.needsUpdate = true;
  return material;
}

// A new picture for one of a bake's masks (a bake on arrival landing in
// place of its blank), reaching every material that reads it.
export function setFloorMask(bake, index, texture) {
  const area = bake?.areas?.[index];
  if (!area) return;
  area.texture = texture;
  const u = shared.get(bake);
  if (u) u.uMask.value[index] = texture;
}

// A thing that moves, standing in the floor's baked light: the sun's light
// on it is cut by the mask's sun under each of its points, the way a shadow
// map would have it walk into a building's shadow, and the sky's a little
// (a figure standing in an alley is lit by less of the sky, not by none of
// it). No tint: the floor's warm shade is the floor's. It reads the same
// masks as the floor (the same uniform objects, so a bake landing reaches
// both), but not a static thing: a wall would read its own footprint, the
// darkest place there is.
export function standIn(material, bake) {
  if (!material || !bake?.areas?.length || material.userData?.standIn) return material;
  const f = floorUniforms(bake);
  // (a mover is read only near the floor's own heights, from 2 m under its
  // lowest to 8 m over its highest: one in an interior far below, or high
  // above in the air, isn't under the floor's shadows)
  const [lo, hi] = bake.range ?? [-1e9, 1e9];
  const uniforms = { uMask: f.uMask, uMaskRect: f.uMaskRect, uMaskMix: f.uMaskMix, uShadeTint: { value: new THREE.Color(1, 1, 1) }, uShadeMix: { value: 0 }, uMoverRange: { value: new THREE.Vector2(lo - 2, hi + 8) } };
  const areas = bake.areas.length;
  const before = material.onBeforeCompile;
  material.onBeforeCompile = (sh, r) => {
    before?.call(material, sh, r);
    Object.assign(sh.uniforms, uniforms);
    const out = floorShadowShader(sh, { areas, mover: true });
    sh.vertexShader = out.vertexShader;
    sh.fragmentShader = out.fragmentShader;
  };
  const key = material.customProgramCacheKey;
  material.customProgramCacheKey = () => `${key ? key.call(material) : ''}|standIn:${areas}`;
  material.userData.standIn = uniforms;
  material.needsUpdate = true;
  return material;
}

// The masks' blend for a time of day (once a frame, for every floor material).
// `sun` is how much of the floor's light the sun gives now, 0 to 1: the
// shade's tint follows it, so a sun just up, which hardly lights the street,
// doesn't darken whatever it would have shadowed, and night has no tint at
// all (the sky's term still darkens a wall's foot by night).
export function setFloorTime(bake, tod, sun = 1) {
  if (!bake?.areas?.length) return;
  const [a, b, t] = maskWeights(tod, bake.times);
  const u = floorUniforms(bake);
  u.uMaskMix.value.set(a, b, t);
  u.uShadeMix.value = (bake.shadeMix ?? SHADE_TINT.mix) * clamp01(Number.isFinite(sun) ? sun : 1);
}

// A world's masks, from the index the bake wrote beside them: { areas,
// times, shade, dispose() }, or null where they can't be had (the world then
// stands without them). The textures are data, not colour, clamped, with no
// mipmaps (a mask is seen from far above as often as from the street).
export async function loadFloorShadow(dir, { renderer = null, shade = 0x5a3420, fetcher = globalThis.fetch } = {}) {
  try {
    const res = await fetcher(`${dir}/index.json`);
    if (!res.ok) return null;
    const index = await res.json();
    const urls = index.areas.map((a) => `${dir}/${a.file}`);
    const textures = await Promise.all(urls.map((u) => loadTexture(u, { renderer, color: false, mipmaps: false, wrap: false })));
    return {
      areas: index.areas.map((a, i) => ({ texture: textures[i], x0: a.x0, z0: a.z0, w: a.w, d: a.d })),
      times: index.times,
      shade: new THREE.Color(shade),
      dispose() {
        textures.forEach((t, i) => {
          t.dispose();
          forgetTexture(urls[i]);
        });
      },
    };
  } catch {
    return null;
  }
}

// ── the bounce ──

export const BOUNCE = { height: 1.75, strength: 0.5, angleOffset: 0.6 };

// The rewrite of a shader pair for the bounce, as pure strings: by how near a
// point is to its floor and how much its face looks down, its colour goes
// toward the floor's. `base`: the floor is each instance's own origin (an
// instanced flock standing about on ground of different heights) rather
// than the one height in uBounceFloor.
export function bounceShader({ vertexShader, fragmentShader }, { base = false, mask = false } = {}) {
  const vs = groundVertex(vertexShader, { normal: true, base });
  const decl = ['uniform vec3 uBounceColor;', 'uniform float uBounceFloor, uBounceHeight, uBounceStrength, uBounceOffset;'];
  if (mask) {
    // the floor's height under a point, from a mask baked on arrival (G and
    // B, lib/three/grounding-bake's packHeight); outside it, or where it saw
    // no floor, the one height
    decl.push(`uniform sampler2D uBounceMask;
uniform vec4 uBounceRect;
uniform vec2 uBounceRange;
float gFloor(vec3 p) {
  vec2 uv = (p.xz - uBounceRect.xy) * uBounceRect.zw;
  if (uv.x <= 0.0 || uv.y <= 0.0 || uv.x >= 1.0 || uv.y >= 1.0) return uBounceFloor;
  vec4 m = texture2D(uBounceMask, uv);
  float v = m.g * 65280.0 + m.b * 255.0;
  if (v < 0.5) return uBounceFloor;
  return uBounceRange.x + (v - 1.0) / 65534.0 * (uBounceRange.y - uBounceRange.x);
}`);
  }
  if (!fragmentShader.includes('varying vec3 vGroundPos;')) decl.unshift('varying vec3 vGroundPos;');
  decl.unshift('varying vec3 vGroundN;');
  if (base) decl.unshift('varying float vGroundBase;');
  const floor = base ? 'vGroundBase + uBounceFloor' : mask ? 'gFloor(vGroundPos)' : 'uBounceFloor';
  const found = fragmentShader.includes('#include <opaque_fragment>');
  const fs = fragmentShader.replace('#include <common>', `#include <common>\n${decl.join('\n')}`).replace(
    '#include <opaque_fragment>',
    `{
      float bD = pow(clamp(1.0 - (vGroundPos.y - (${floor})) / uBounceHeight, 0.0, 1.0), 2.0) * uBounceStrength;
      float bA = clamp((dot(normalize(vGroundN), vec3(0.0, -1.0, 0.0)) + uBounceOffset) * 1.5, 0.0, 1.0);
      outgoingLight = mix(outgoingLight, uBounceColor, bD * bA);
    }
    #include <opaque_fragment>`,
  );
  return { vertexShader: vs, fragmentShader: fs, swapped: { bounce: found } };
}

// Bruno's indirect term, Y up, on any lit or matcap material. `color` is the
// floor's colour now (a THREE.Color: share one across materials and change it
// with the time of day); `floor` the height of the floor under the thing, or
// 'instance' for an instanced flock, each on its own (its origin is its
// foot). Returns the material; its uniforms are on userData.bounce.
export function bounce(material, { color, height = BOUNCE.height, strength = BOUNCE.strength, angleOffset = BOUNCE.angleOffset, floor = 0, mask = null } = {}) {
  if (!material || material.userData?.bounce) return material;
  const base = floor === 'instance';
  const area = !base && mask?.areas?.[0];
  const uniforms = {
    uBounceColor: { value: color?.isColor ? color : new THREE.Color(color ?? 0xb08a5a) },
    uBounceFloor: { value: base ? 0 : Number(floor) || 0 },
    uBounceHeight: { value: height },
    uBounceStrength: { value: strength },
    uBounceOffset: { value: angleOffset },
  };
  if (area) {
    const [lo, hi] = mask.range ?? [0, 1];
    Object.assign(uniforms, {
      uBounceMask: { value: area.texture },
      uBounceRect: { value: new THREE.Vector4(area.x0, area.z0, 1 / area.w, 1 / area.d) },
      uBounceRange: { value: new THREE.Vector2(lo, hi) },
    });
  }
  const before = material.onBeforeCompile;
  material.onBeforeCompile = (sh, r) => {
    before?.call(material, sh, r);
    Object.assign(sh.uniforms, uniforms);
    const out = bounceShader(sh, { base, mask: Boolean(area) });
    sh.vertexShader = out.vertexShader;
    sh.fragmentShader = out.fragmentShader;
  };
  const key = material.customProgramCacheKey;
  material.customProgramCacheKey = () => `${key ? key.call(material) : ''}|bounce:${base ? 1 : 0}${area ? ':mask' : ''}`;
  material.userData.bounce = uniforms;
  material.needsUpdate = true;
  return material;
}

// ── blobs under what moves ──

const MIN_UP = 0.08; // the lowest sun a blob is slid by (below it, a blob would run off to the horizon)

// Where a thing's blob goes, and how strong it is: slid away from the sun by
// the thing's height above the floor, fading as it rises (gone 3 m up) and as
// it tips (`tilt` 0 upright, 1 on its side), a little wider higher up.
// `sun` points at the sun (unit). Fills `out` with { x, z, alpha, scale }.
export function blobPlacement(sun, pos, height = 0, tilt = 0, out = {}) {
  const up = Math.max(MIN_UP, sun?.y ?? 1);
  const h = Math.max(0, Number.isFinite(height) ? height : 0);
  out.x = pos.x - ((sun?.x ?? 0) / up) * h;
  out.z = pos.z - ((sun?.z ?? 0) / up) * h;
  out.alpha = clamp01((3 - h) / 3) ** 2 * clamp01(1 - (Number.isFinite(tilt) ? tilt : 0)) ** 2;
  out.scale = 1 + 0.15 * h;
  return out;
}

const BLOB_VERT = /* glsl */ `
attribute float aBlob;
varying vec2 vUv;
varying float vA;
void main() {
  vUv = uv;
  vA = aBlob;
  vec4 p = vec4(position, 1.0);
  #ifdef USE_INSTANCING
    p = instanceMatrix * p;
  #endif
  gl_Position = projectionMatrix * modelViewMatrix * p;
}`;

// a rounded rectangle, solid in its middle, falling off over `uFade` of its
// size to nothing at its edge (sine in and out); drawn premultiplied over a
// multiply, so the floor under it is the floor times mix(1, shade, a): it
// takes light away, warm, by day or by night
const BLOB_FRAG = /* glsl */ `
uniform vec3 uShade;
uniform float uOpacity;
uniform float uFade;
varying vec2 vUv;
varying float vA;
void main() {
  vec2 q = abs(vUv - 0.5);
  float d = clamp(length(max(q - (0.5 - uFade), 0.0)) / uFade, 0.0, 1.0);
  float a = (0.5 + 0.5 * cos(3.14159265 * d)) * vA * uOpacity;
  gl_FragColor = vec4(uShade * a, a);
}`;

// createBlobShadows({ color, max, ground, opacity, fade }) → { mesh, set(i,
// pos, height, tilt, size, yaw), setSun(dir, strength), clear(), dispose() }.
// `ground(x, z)` is the floor's height where a blob lands; `size` is [w, d]
// in metres (across, along the heading), `pos` { x, z } where the thing is.
export function createBlobShadows({ color = 0x5a3420, max = 64, ground = () => 0, opacity = 0.75, fade = 0.35 } = {}) {
  const geometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const alpha = new Float32Array(max);
  const attr = new THREE.InstancedBufferAttribute(alpha, 1);
  attr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aBlob', attr);
  const material = new THREE.ShaderMaterial({
    uniforms: { uShade: { value: color?.isColor ? color : new THREE.Color(color) }, uOpacity: { value: opacity }, uFade: { value: fade } },
    vertexShader: BLOB_VERT,
    fragmentShader: BLOB_FRAG,
    transparent: true,
    depthWrite: false,
    premultipliedAlpha: true,
    blending: THREE.MultiplyBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, max);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.frustumCulled = false;
  // (straight after the floor, before anything else see-through: a puff of
  // dust over a blob isn't darkened by it)
  mesh.renderOrder = -1;
  const sun = new THREE.Vector3(0, 1, 0);
  let strength = 1;
  let used = 0;
  const place = {};
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  return {
    mesh,
    // the light that throws them now (the sun, or the moon at half strength)
    setSun(dir, k = 1) {
      if (dir) sun.copy(dir).normalize();
      strength = k;
    },
    set(i, pos, height = 0, tilt = 0, size = [2, 2], yaw = 0) {
      if (i < 0 || i >= max) return;
      blobPlacement(sun, pos, height, tilt, place);
      p.set(place.x, ground(place.x, place.z) + 0.012, place.z);
      q.setFromAxisAngle(UP, yaw);
      s.set(size[0] * place.scale, 1, size[1] * place.scale);
      mesh.setMatrixAt(i, m4.compose(p, q, s));
      alpha[i] = place.alpha * strength;
      if (i + 1 > used) used = i + 1;
      mesh.count = used;
      mesh.instanceMatrix.needsUpdate = true;
      attr.needsUpdate = true;
    },
    clear() {
      used = 0;
      mesh.count = 0;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      mesh.dispose();
    },
  };
}
