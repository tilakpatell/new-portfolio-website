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
import { bodyById, swatchById } from './looks';

export const MAX_REGIONS = 6; // (five a body’s own at most, and Mr. White’s hands besides)

// 0 head, 1 torso and arms, 2 hips and thighs, 3 shins, 4 feet, 5 hands (a
// zone no region takes: skin stays skin)
export const zoneOf = (bone) => (/neck|Head|head/.test(bone) ? 0 : /Hand/.test(bone) ? 5 : /Foot|Toe/.test(bone) ? 4 : /UpLeg|Hips/.test(bone) ? 2 : /Leg/.test(bone) ? 3 : 1);

// A float `zone` for each vertex, from its strongest bone; and `lower`, how
// much of it the hips and legs move (zones 2 to 4), which blends smoothly
// across the body where `zone` steps: a waist follows its 0.5. `upper`, how
// much the head and neck move it (zone 0), does the same for a collar.
export function addZones(geometry, boneNames) {
  if (geometry.attributes.zone && geometry.attributes.lower && geometry.attributes.upper) return geometry;
  const idx = geometry.attributes.skinIndex;
  const w = geometry.attributes.skinWeight;
  const n = geometry.attributes.position.count;
  const out = new Float32Array(n);
  const lower = new Float32Array(n);
  const upper = new Float32Array(n);
  if (idx && w) {
    const zones = boneNames.map(zoneOf);
    for (let i = 0; i < n; i++) {
      let best = 0;
      for (let k = 1; k < 4; k++) if (w.getComponent(i, k) > w.getComponent(i, best)) best = k;
      out[i] = zones[idx.getComponent(i, best)] ?? 1;
      for (let k = 0; k < 4; k++) {
        const z = zones[idx.getComponent(i, k)] ?? 1;
        if (z >= 2 && z <= 4) lower[i] += w.getComponent(i, k);
        else if (z === 0) upper[i] += w.getComponent(i, k);
      }
    }
  }
  if (!geometry.attributes.zone) geometry.setAttribute('zone', new THREE.BufferAttribute(out, 1));
  geometry.setAttribute('lower', new THREE.BufferAttribute(lower, 1));
  geometry.setAttribute('upper', new THREE.BufferAttribute(upper, 1));
  return geometry;
}

// Each body's regions, as windows in its texture's sRGB colour (hue in
// degrees, a window that wraps if it starts after it ends; saturation and
// value 0…1), the zones they're in (zoneOf's), the value a typical texel of it has (ref), the range the shade is
// held to, a colour it takes when none is picked (fix), and (Walt’s and
// Jesse’s only) how much of it the hips and legs must move (lower: a
// window, 0…1).
const key = (zones, hue, sat, val, ref, shade = [0.45, 1.25], fix = null, lower = null, upper = null) => ({ zones, hue, sat, val, ref, shade, fix, lower, upper });
const ANY = [0, 360];
const GREY = [0, 0.13];
const HAIR_BLUE = key([0], [178, 232], [0.06, 0.55], [0.72, 1], 0.95);
const MORTY = {
  inner: key([0, 1, 2, 3], [42, 78], [0.3, 1], [0.55, 1], 0.98),
  legs: key([2, 3, 4], [192, 240], [0.3, 1], [0.2, 0.85], 0.55),
  hair: key([0], [12, 48], [0.5, 1], [0.15, 0.62], 0.4),
};
// Walt’s and Jesse’s, read off Albuquerque’s figures of them (sampled by
// zone as lab/zones.mjs does: every triangle at fifteen points in UV space,
// each texel’s HSV counted by the zone of its nearest corner’s strongest
// bone; then each region shown in a loud colour on the turntable, to see it
// takes its part and nothing else). Every region is measured by one of the
// few windows here, so a new texture on the same figures (an HD retexture)
// is retuned here, sampled the same way.
//
// Walt’s one figure, in the lab’s yellow suit: by zone, the suit is a
// jacket (the torso and arms), a shirt’s collar (its hood, down round his
// neck) and trousers (the hips down); and his long black gloves, his brown
// work boots. Mr. White’s and Heisenberg’s gloves are his bare forearms
// and hands (`gloves` and `hands` aren’t their regions: nobody picks them).
const SUIT = [[36, 58], [0.42, 1], [0.45, 1], 0.85];
const suit = (zones, fix = null, lower = null, upper = null) => key(zones, ...SUIT, undefined, fix, lower, upper);
const ABOVE = [0, 0.5]; // (the jacket, down to his waist: half his weight the hips’…)
const BELOW = [0.5, 1]; // (…and the trousers from there)
// (and the hood round his neck: the collar where the head and neck move it
// most, the jacket below; the hood's triangles are split between the head's
// zone and the torso's every which way, so the line is drawn by `upper`)
const COLLAR = [0.45, 1]; // (a little over each other: where both edges soften at once, the suit’s own yellow would show between)
const UNDER = [0, 0.55];
const gloves = (fix = null, zones = [1, 5]) => key(zones, [160, 300], [0, 0.8], [0, 0.22], 0.09, [0.8, 1.15], fix);
const BOOTS = key([3, 4], ANY, [0, 0.66], [0, 0.37], 0.24);
const HANDS = '#c39283'; // (his skin’s own colour, off his face)
// (his hands are all glove: any dark texel there, its creases and shine too;
// his forearms, `gloves` in zone 1, only the glove’s own blue-black)
const HANDS_KEY = key([5], ANY, [0, 1], [0, 0.45], 0.12, [0.8, 1.15], HANDS);
// Jesse: the burnt-orange hoodie (its hood down round his neck), baggy
// jeans, white high-tops, his buzzed light-brown hair (and brows)
// (the buzzed sides lighter than the top: 24–32°, value to 0.58, where
// his skin’s 13–20° and brighter)
const jesseHair = key([0], [21, 40], [0.26, 0.68], [0.2, 0.6], 0.34);
const BB = {
  walt: { outer: suit([0, 1, 2, 3, 4]), inner: gloves(), shoes: BOOTS },
  mrwhite: { outer: suit([0, 1, 2], 'tanjacket', ABOVE, UNDER), inner: suit([0, 1], 'waltgreen', null, COLLAR), legs: suit([1, 2, 3, 4], 'khaki', BELOW), shoes: BOOTS, gloves: gloves(HANDS, [1]), hands: HANDS_KEY },
  heisenberg: { outer: suit([0, 1, 2], 'heisenbergblack', ABOVE, UNDER), inner: suit([0, 1], 'beaniegrey', null, COLLAR), legs: suit([1, 2, 3, 4], 'khaki', BELOW), shoes: BOOTS, gloves: gloves(HANDS, [1]), hands: HANDS_KEY },
  jesse: {
    outer: key([0, 1, 2], [4, 28], [0.55, 1], [0.3, 0.72], 0.54),
    legs: key([2, 3], [192, 240], [0.14, 0.85], [0.08, 0.62], 0.25),
    hair: jesseHair,
    shoes: key([3, 4], ANY, [0, 0.12], [0.4, 1], 0.8),
  },
  jesselab: { outer: suit([0, 1, 2, 3, 4]), inner: gloves(), hair: key([0], [15, 40], [0.15, 0.6], [0.2, 0.52], 0.34) }, // (his own figure, its hair painted darker and warmer)
};
const WEIGHED = new Set(Object.keys(BB)); // (the bodies whose shader reads `lower`, its zones one a triangle)
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
  ...BB,
};

// A key that isn’t one of the body’s regions (Mr. White’s gloves) is
// nobody’s to pick: it’s always its `fix` (a swatch’s id, or a colour of
// its own), in a slot after the regions’.
const fixed = (f) => swatchById(f) ?? (/^#[0-9a-f]{6}$/.test(f ?? '') ? { hex: f } : null);
export function regionUniforms(bodyId, colors = {}) {
  const body = bodyById(bodyId);
  const regions = Object.keys(body?.regions ?? {});
  const order = [...regions, ...Object.keys(KEYS[bodyId] ?? {}).filter((r) => !regions.includes(r))].slice(0, MAX_REGIONS);
  while (order.length < MAX_REGIONS) order.push(null);
  const u = { order, on: [], swatch: [], zones: [], hue: [], sat: [], val: [], ref: [], shade: [], lower: [], upper: [] };
  for (const r of order) {
    const k = r ? KEYS[bodyId]?.[r] : null;
    const pick = r ? ((regions.includes(r) ? swatchById(colors[r]) : null) ?? fixed(k?.fix)) : null;
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
    u.lower.push(open(k?.lower ?? [0, 1]));
    u.upper.push(open(k?.upper ?? [0, 1]));
  }
  return u;
}

const N = MAX_REGIONS;
const DECLARE = `
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
  // (multisampled, an edge pixel is shaded at its centre, off the triangle:
  // a blended zone goes on past its corners there, on a sliver far under 0,
  // where exp2 of it is 0 and the bit read NaN, which the bloom spreads over
  // the whole frame. A zone past 0 to 5 has no bit anyway: read only those.)
  bool known = zone >= 0.0 && zone <= ${zoneOf('LeftHand')}.0;
  for (int i = 0; i < ${N}; i++) {
    if (rgOn[i] < 0.5) continue;
    float m = (known ? mod(floor(rgZones[i] / exp2(zone)), 2.0) : 0.0) * rgHueIn(hsv.x, rgHue[i]) * rgIn(hsv.y, rgSat[i], 0.04) * rgIn(hsv.z, rgVal[i], 0.04)/*lower*/;
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
  // (a zone blended across a triangle whose corners are in two, a wrist’s
  // between the forearm’s 1 and the hand’s 5, passes through 2, 3 and 4 on
  // the way: a band the keys for the hips, shins and feet would take. Walt’s
  // and Jesse’s keep one zone a triangle; Rick and Morty’s were tuned as
  // they blend, and are left so.)
  const weighed = WEIGHED.has(bodyId);
  const zoneVarying = weighed ? 'flat varying float vZone;\nvarying float vLower;\nvarying float vUpper;' : 'varying float vZone;';
  const recolorChunk = weighed ? RECOLOR.replace('/*lower*/', ' * rgIn(vLower, rgLower[i], 0.03) * rgIn(vUpper, rgUpper[i], 0.03)') : RECOLOR.replace('/*lower*/', '');
  const uniforms = {
    rgOn: { value: u.on },
    rgSwatch: { value: u.swatch },
    rgZones: { value: u.zones },
    rgHue: { value: u.hue },
    rgSat: { value: u.sat },
    rgVal: { value: u.val },
    rgRef: { value: u.ref },
    rgShade: { value: u.shade },
    ...(weighed ? { rgLower: { value: u.lower }, rgUpper: { value: u.upper } } : {}),
  };
  const before = material.onBeforeCompile;
  const keyBefore = material.customProgramCacheKey;
  material.onBeforeCompile = (s, r) => {
    before?.call(material, s, r);
    Object.assign(s.uniforms, uniforms);
    s.vertexShader = s.vertexShader.replace('void main() {', weighed ? `attribute float zone;\nattribute float lower;\nattribute float upper;\n${zoneVarying}\nvoid main() {\nvZone = zone;\nvLower = lower;\nvUpper = upper;` : `attribute float zone;\n${zoneVarying}\nvoid main() {\nvZone = zone;`);
    s.fragmentShader = s.fragmentShader.replace('void main() {', `${zoneVarying}${DECLARE}${weighed ? `\nuniform vec2 rgLower[${N}];\nuniform vec2 rgUpper[${N}];` : ''}\nvoid main() {`).replace('#include <map_fragment>', `#include <map_fragment>\n${recolorChunk}`);
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
  // (and the marks that say what's in them, which a copy leaves behind:
  // lib/three/house.js and core.js would put theirs on it a second time)
  for (const k of ['house', 'core']) if (material.userData[k]) Object.defineProperty(m.userData, k, { value: material.userData[k], enumerable: false, configurable: true });
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
