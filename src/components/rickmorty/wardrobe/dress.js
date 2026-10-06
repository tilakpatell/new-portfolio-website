// A look's colours on a figure. A Meshy figure is one mesh with one
// texture, so a coat can't be given a colour as a part: each texel is read
// instead, as Morty's clones' shirts are (portal/meshyCast.js shirted()),
// and told apart twice over. First by where it is on the body: each
// vertex's zone is the zone of the bone that moves it most (head, torso and
// arms, thighs, shins, feet; and the hands, which keep their skin), so Rick's
// light-blue hair and his light-blue shirt are
// two things. Then by its colour, in that zone: a hue, saturation and value
// window for each region of each body (KEYS, read off each texture by
// lab/zones.mjs). A texel in a region takes the swatch at its own
// brightness against the region's (so its light and shade stay), held
// inside `shade` (a floor that flattens the darker patches some textures
// bake in: HD Rick's coat comes out grey down one side, and is white again
// here with nothing picked: `fix`).
//
// addZones(geometry, boneNames) once per geometry; recolor(material, body,
// colors) on a figure's own copy of its material; dressColors(figure, look)
// does both for a figure from createMeshyCast().make().

import * as THREE from 'three';
import { BODIES, swatchById } from './looks';

export const MAX_REGIONS = 5;

// 0 head, 1 torso and arms, 2 hips and thighs, 3 shins, 4 feet, 5 hands (a
// zone no region takes: skin stays skin)
export const zoneOf = (bone) => (/neck|Head|head/.test(bone) ? 0 : /Hand/.test(bone) ? 5 : /Foot|Toe/.test(bone) ? 4 : /UpLeg|Hips/.test(bone) ? 2 : /Leg/.test(bone) ? 3 : 1);

// A float `zone` for each vertex, from its strongest bone.
export function addZones(geometry, boneNames) {
  if (geometry.attributes.zone) return geometry;
  const idx = geometry.attributes.skinIndex;
  const w = geometry.attributes.skinWeight;
  const n = geometry.attributes.position.count;
  const out = new Float32Array(n);
  if (idx && w) {
    const zones = boneNames.map(zoneOf);
    for (let i = 0; i < n; i++) {
      let best = 0;
      for (let k = 1; k < 4; k++) if (w.getComponent(i, k) > w.getComponent(i, best)) best = k;
      out[i] = zones[idx.getComponent(i, best)] ?? 1;
    }
  }
  geometry.setAttribute('zone', new THREE.BufferAttribute(out, 1));
  return geometry;
}

// Each body's regions, as windows in its texture's sRGB colour (hue in
// degrees, a window that wraps if it starts after it ends; saturation and
// value 0…1), the zones they're in (zoneOf's), the value a typical texel of it has (ref), the range the shade is
// held to, and a colour it takes when none is picked (fix).
const key = (zones, hue, sat, val, ref, shade = [0.45, 1.25], fix = null) => ({ zones, hue, sat, val, ref, shade, fix });
const ANY = [0, 360];
const GREY = [0, 0.13];
const HAIR_BLUE = key([0], [178, 232], [0.06, 0.55], [0.72, 1], 0.95);
const MORTY = {
  inner: key([0, 1, 2, 3], [42, 78], [0.3, 1], [0.55, 1], 0.98),
  legs: key([2, 3, 4], [192, 240], [0.3, 1], [0.2, 0.85], 0.55),
  hair: key([0], [12, 48], [0.5, 1], [0.15, 0.62], 0.4),
};
export const KEYS = {
  rick: { outer: key([1, 2, 3], ANY, GREY, [0.3, 1], 0.95, [0.86, 1.08], 'labwhite'), inner: key([1], [158, 205], [0.06, 0.5], [0.55, 1], 0.85), legs: key([2, 3], [22, 66], [0.28, 1], [0.15, 0.7], 0.4), hair: HAIR_BLUE },
  tinyrick: { outer: key([1, 2, 3], ANY, GREY, [0.3, 1], 0.9, [0.86, 1.08], 'labwhite'), inner: key([1], [158, 205], [0.06, 0.5], [0.55, 1], 0.85), legs: key([2, 3], [22, 66], [0.28, 1], [0.15, 0.7], 0.4), hair: HAIR_BLUE },
  cowboyrick: { outer: key([1, 2], [12, 48], [0.28, 0.85], [0.22, 0.62], 0.42), inner: key([1], ANY, GREY, [0.72, 1], 0.97), legs: key([2, 3], [188, 232], [0.22, 0.75], [0.38, 0.85], 0.62) },
  cop: { outer: key([0, 1, 2, 3], [198, 248], [0.3, 0.95], [0.08, 0.58], 0.35), hair: HAIR_BLUE },
  detectiverick: { outer: key([1, 2, 3], [12, 48], [0.24, 0.62], [0.45, 0.82], 0.62), legs: key([2, 3], ANY, [0, 0.16], [0.05, 0.35], 0.22) },
  sweaterrick: { outer: key([1, 2, 3], [338, 16], [0.5, 1], [0.3, 1], 0.8), legs: key([2, 3], [14, 52], [0.22, 0.7], [0.08, 0.36], 0.22), hair: HAIR_BLUE },
  suitrick: { outer: key([1, 2, 3], [188, 232], [0.08, 0.55], [0.42, 0.96], 0.8), hair: key([0], [178, 232], [0.06, 0.55], [0.86, 1], 0.97) },
  factoryrick: { outer: key([1, 2, 3], [178, 222], [0.08, 0.48], [0.52, 0.96], 0.8) },
  constructionrick: { outer: key([0, 1, 2, 3], [4, 40], [0.55, 1], [0.6, 1], 0.98) },
  'councilrick-a': { outer: key([1, 2, 3], ANY, GREY, [0.55, 1], 0.95), hair: key([0], [188, 232], [0.06, 0.5], [0.75, 1], 0.95) },
  'councilrick-b': { outer: key([1, 2, 3], [198, 252], [0.22, 0.85], [0.06, 0.42], 0.22), hair: HAIR_BLUE },
  'councilrick-c': { outer: key([1, 2, 3], ANY, GREY, [0.6, 1], 0.97), legs: key([2, 3], [195, 240], [0.25, 0.7], [0.25, 0.6], 0.42) },
  morty: { ...MORTY, shoes: key([4], ANY, [0, 0.16], [0.6, 1], 0.97) },
  evilmorty: { inner: MORTY.inner, legs: key([2, 3, 4], [192, 245], [0.3, 1], [0.15, 0.7], 0.4), hair: MORTY.hair },
  copmorty: { outer: key([0, 1, 2, 3], [198, 248], [0.3, 0.95], [0.08, 0.58], 0.35), hair: MORTY.hair },
};

const BODY = new Map(Object.values(BODIES).flatMap((list) => list.map((b) => [b.id, b])));

// The shader's numbers for a body and the colours picked: for each of
// MAX_REGIONS slots (the body's regions in order, then empty ones) whether
// it's on, its swatch, its zones, windows, ref and shade.
export function regionUniforms(bodyId, colors = {}) {
  const body = BODY.get(bodyId);
  const order = [...Object.keys(body?.regions ?? {})].slice(0, MAX_REGIONS);
  while (order.length < MAX_REGIONS) order.push(null);
  const u = { order, on: [], swatch: [], zones: [], hue: [], sat: [], val: [], ref: [], shade: [] };
  for (const r of order) {
    const k = r ? KEYS[bodyId]?.[r] : null;
    const pick = r ? (swatchById(colors[r]) ?? (k?.fix ? swatchById(k.fix) : null)) : null;
    const on = Boolean(k && pick);
    u.on.push(on ? 1 : 0);
    u.swatch.push(new THREE.Color().setStyle(pick?.hex ?? '#ffffff', THREE.NoColorSpace)); // (sRGB numbers, as the windows are)
    u.zones.push((k?.zones ?? []).reduce((n, z) => n + 2 ** z, 0)); // (a bit for each zone)
    u.hue.push(new THREE.Vector2(...(k?.hue ?? ANY)));
    // (a window open at 0 or 1 is open past it: its soft edge would halve a texel right at the end)
    const open = ([lo, hi]) => new THREE.Vector2(lo <= 0 ? -1 : lo, hi >= 1 ? 2 : hi);
    u.sat.push(open(k?.sat ?? [0, 1]));
    u.val.push(open(k?.val ?? [0, 1]));
    u.ref.push(k?.ref ?? 1);
    u.shade.push(new THREE.Vector2(...(k?.shade ?? [0.45, 1.25])));
  }
  return u;
}

const N = MAX_REGIONS;
const DECLARE = `
varying float vZone;
uniform float rgOn[${N}];
uniform vec3 rgSwatch[${N}];
uniform float rgZones[${N}];
uniform vec2 rgHue[${N}];
uniform vec2 rgSat[${N}];
uniform vec2 rgVal[${N}];
uniform float rgRef[${N}];
uniform vec2 rgShade[${N}];
vec3 rgHsv(vec3 c) {
  float mx = max(c.r, max(c.g, c.b));
  float mn = min(c.r, min(c.g, c.b));
  float d = mx - mn;
  float h = 0.0;
  if (d > 1e-5) {
    if (mx == c.r) h = mod((c.g - c.b) / d, 6.0);
    else if (mx == c.g) h = (c.b - c.r) / d + 2.0;
    else h = (c.r - c.g) / d + 4.0;
  }
  return vec3(h * 60.0, mx > 1e-5 ? d / mx : 0.0, mx);
}
float rgIn(float x, vec2 w, float soft) {
  return smoothstep(w.x - soft, w.x + soft, x) * (1.0 - smoothstep(w.y - soft, w.y + soft, x));
}
float rgHueIn(float h, vec2 w) {
  if (w.y - w.x >= 359.0) return 1.0;
  if (w.x <= w.y) return rgIn(h, w, 5.0);
  return max(rgIn(h, vec2(w.x, 366.0), 5.0), rgIn(h, vec2(-6.0, w.y), 5.0));
}`;

const RECOLOR = `
{
  vec3 lin = diffuseColor.rgb;
  vec3 srgb = pow(max(lin, vec3(0.0)), vec3(1.0 / 2.2));
  vec3 hsv = rgHsv(srgb);
  float zone = floor(vZone + 0.5);
  for (int i = 0; i < ${N}; i++) {
    if (rgOn[i] < 0.5) continue;
    float m = mod(floor(rgZones[i] / exp2(zone)), 2.0) * rgHueIn(hsv.x, rgHue[i]) * rgIn(hsv.y, rgSat[i], 0.04) * rgIn(hsv.z, rgVal[i], 0.04);
    float shade = clamp(hsv.z / rgRef[i], rgShade[i].x, rgShade[i].y);
    vec3 col = pow(clamp(rgSwatch[i] * shade, 0.0, 1.0), vec3(2.2));
    lin = mix(lin, col, m);
  }
  diffuseColor.rgb = lin;
}`;

// A material taught a body's regions (on top of whatever it's already
// taught: its rim, a paint). Its uniforms are in userData.regions; set(colors)
// changes the colours without a new program.
export function recolor(material, bodyId, colors = {}) {
  const u = regionUniforms(bodyId, colors);
  const uniforms = {
    rgOn: { value: u.on },
    rgSwatch: { value: u.swatch },
    rgZones: { value: u.zones },
    rgHue: { value: u.hue },
    rgSat: { value: u.sat },
    rgVal: { value: u.val },
    rgRef: { value: u.ref },
    rgShade: { value: u.shade },
  };
  const before = material.onBeforeCompile;
  const keyBefore = material.customProgramCacheKey;
  material.onBeforeCompile = (s, r) => {
    before?.call(material, s, r);
    Object.assign(s.uniforms, uniforms);
    s.vertexShader = s.vertexShader.replace('void main() {', 'attribute float zone;\nvarying float vZone;\nvoid main() {\nvZone = zone;');
    s.fragmentShader = s.fragmentShader.replace('void main() {', `${DECLARE}\nvoid main() {`).replace('#include <map_fragment>', `#include <map_fragment>\n${RECOLOR}`);
  };
  material.customProgramCacheKey = () => `${keyBefore.call(material)}|regions-${bodyId}`;
  material.userData.regions = {
    uniforms,
    set(next) {
      const v = regionUniforms(bodyId, next);
      uniforms.rgOn.value = v.on;
      uniforms.rgSwatch.value = v.swatch;
    },
  };
  material.needsUpdate = true;
  return material;
}

// A look's colours on a figure from createMeshyCast().make(): its meshes'
// zones, and its own copies of their materials, taught the body's regions.
// Returns the copies, for the caller to dispose (or set() again).
// A material's copy that keeps what's been done to its shaders (its rim of
// light, a shirt's colour): Material.clone() leaves those behind.
export function cloneShaded(material) {
  const m = material.clone();
  m.onBeforeCompile = material.onBeforeCompile;
  m.customProgramCacheKey = material.customProgramCacheKey;
  return m;
}

export function dressColors(figure, look) {
  const made = [];
  figure.group.traverse((o) => {
    if (!o.isSkinnedMesh || o.userData.ink) return;
    addZones(o.geometry, o.skeleton.bones.map((b) => b.name));
    const m = recolor(cloneShaded(o.material), look.body, look.colors);
    o.material = m;
    made.push(m);
  });
  return made;
}
