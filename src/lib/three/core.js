// The core surfaces every world wears, so the worlds read as one place
// (docs/superpowers/specs/2026-10-07-house-look-design.md). One kit of
// photo-scanned surfaces (public/cc0/galaxy/<role>: stone, wood, bark,
// adobe, metal, concrete, rock, grass, sand, mud and the rest, CC0 from Poly
// Haven, made into detail maps centred on one brightness by
// scripts/galaxy-textures.mjs) laid over a material's own colour in the
// world, not its UVs: projected from the three axes and blended by which way
// the surface faces (triplanar), at the scan's real size. A wall shows the
// grain of real stone at the same density in every world, whatever its UVs
// and however big it is; the scan darkens and lightens the material's own
// colour (a stain stays a stain), and its normal map adds relief.
//
//   CORE, coreOf(role)       the kit: { metres, mean, … } per role
//   coreFiles(role, { xl })  its files: the 1K set, or the 8192 set at ultra where it's made
//   loadCore(role, { xl })   its textures, loaded once for the page
//   wear(material, scan, { metres, strength, normal, mean })
//   dress(materials, roles, { strength, normal, keep, load }) → how many it dressed
//     a world's named materials ({ stone: mat, … }) onto roles
//     ({ stone: 'stone', timber: 'wood', … }): each one's own painted picture
//     is folded into its colour, and the role's scan goes on instead (with
//     `keep`, the picture stays and the scan's grain goes over it, its
//     shader on at once and its pictures in when they've loaded)
//   meanColour(texture)      a picture's mean colour (linear)
//   wearShader(shader, { normal }) → { vertexShader, fragmentShader, swapped } (pure)

import * as THREE from 'three';
import SCANS from '../../../public/cc0/galaxy/index.json';
import { budget } from '../device';
import { loadTexture, sharpen } from './textures';

export const CORE = SCANS;
export const coreOf = (role) => SCANS[role] ?? null;

const BASE = '/cc0/galaxy';

// A scan's files: its 1K WebPs, or with `xl` (ultra's, asked for only
// there) its 8192 colour and normal maps where scripts/galaxy-textures.mjs
// --ultra has made them (the index's `xl`: 'ktx2' or 'webp'); the 1K set
// where it hasn't. The ARM map stays the small one.
export function coreFiles(role, { xl = false, index = SCANS } = {}) {
  const big = xl ? index[role]?.xl : null;
  const file = (name) => (big ? `${BASE}/${role}/${name}-xl.${big}` : `${BASE}/${role}/${name}.webp`);
  return { color: file('color'), normal: file('normal'), arm: index[role]?.arm ? `${BASE}/${role}/arm.webp` : null };
}

// The scans, each loaded once for the page (every world shares them; a new
// renderer uploads them again by itself): role → a promise of { map,
// normalMap, arm }, or of null where they can't be had. With `xl` (ultra),
// the 8192 set where there is one, the 1K set if it won't load.
const loaded = new Map();
export function loadCore(role, { xl = false } = {}) {
  const files = coreFiles(role, { xl });
  const key = files.color;
  if (!loaded.has(key)) {
    const loader = new THREE.TextureLoader();
    const get = (url, srgb) =>
      (/\.ktx2$/.test(url) ? loadTexture(url, { color: srgb }) : loader.loadAsync(url)).then((t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        sharpen(t);
        if (srgb) t.colorSpace = THREE.SRGBColorSpace;
        return t;
      });
    const small = xl && key !== coreFiles(role).color ? () => loadCore(role) : () => null;
    loaded.set(
      key,
      Promise.all([get(files.color, true), get(files.normal, false), files.arm ? get(files.arm, false) : null])
        .then(([map, normalMap, arm]) => ({ map, normalMap, arm }))
        .catch(small),
    );
  }
  return loaded.get(key);
}

const VERT_HEAD = /* glsl */ `
varying vec3 vCorePos;
varying vec3 vCoreNormal;
`;
const vertBody = (nrm) => /* glsl */ `
{
  vec4 cw = vec4(transformed, 1.0);
  vec3 cn = ${nrm};
  #ifdef USE_INSTANCING
  cw = instanceMatrix * cw;
  cn = mat3(instanceMatrix) * cn;
  #endif
  cw = modelMatrix * cw;
  vCorePos = cw.xyz;
  vCoreNormal = normalize(mat3(modelMatrix) * cn);
}
`;
const FRAG_HEAD = /* glsl */ `
uniform sampler2D uCoreMap;
uniform sampler2D uCoreNormal;
uniform float uCoreScale;
uniform float uCoreStrength;
uniform float uCoreNormalStrength;
uniform float uCoreMean;
varying vec3 vCorePos;
varying vec3 vCoreNormal;
vec3 coreWeights(vec3 n) {
  vec3 w = pow(abs(n), vec3(4.0));
  return w / (w.x + w.y + w.z);
}
`;
const FRAG_COLOUR = /* glsl */ `
{
  vec3 cwt = coreWeights(normalize(vCoreNormal));
  vec3 cp = vCorePos * uCoreScale;
  vec3 cc = texture2D(uCoreMap, cp.zy).rgb * cwt.x + texture2D(uCoreMap, cp.xz).rgb * cwt.y + texture2D(uCoreMap, cp.xy).rgb * cwt.z;
  diffuseColor.rgb *= mix(vec3(1.0), cc / uCoreMean, uCoreStrength);
}
`;
// (the relief: each axis's tangent-space normal swizzled into the world and
// blended the way Ben Golus's "UDN" triplanar does, then added to the
// material's own view-space normal as a change from the surface's)
const FRAG_NORMAL = /* glsl */ `
{
  vec3 nw = normalize(vCoreNormal);
  vec3 cwt = coreWeights(nw);
  vec3 cp = vCorePos * uCoreScale;
  vec3 tx = texture2D(uCoreNormal, cp.zy).xyz * 2.0 - 1.0;
  vec3 ty = texture2D(uCoreNormal, cp.xz).xyz * 2.0 - 1.0;
  vec3 tz = texture2D(uCoreNormal, cp.xy).xyz * 2.0 - 1.0;
  tx = vec3(tx.xy * uCoreNormalStrength + nw.zy, nw.x);
  ty = vec3(ty.xy * uCoreNormalStrength + nw.xz, nw.y);
  tz = vec3(tz.xy * uCoreNormalStrength + nw.xy, nw.z);
  vec3 dn = normalize(tx.zyx * cwt.x + ty.xzy * cwt.y + tz.xyz * cwt.z);
  vec3 shift = (viewMatrix * vec4(dn - nw, 0.0)).xyz;
  normal = normalize(normal + shift * faceDirection);
}
`;

export function wearShader({ vertexShader, fragmentShader }, { normal = true } = {}) {
  const swapped = { colour: false, normal: false };
  if (!vertexShader.includes('#include <project_vertex>') || !fragmentShader.includes('#include <map_fragment>')) return { vertexShader, fragmentShader, swapped };
  const nrm = vertexShader.includes('#include <beginnormal_vertex>') ? 'objectNormal' : 'normal';
  const vs = vertexShader.replace('#include <common>', `#include <common>${VERT_HEAD}`).replace('#include <project_vertex>', `#include <project_vertex>${vertBody(nrm)}`);
  let fs = fragmentShader.replace('#include <common>', `#include <common>${FRAG_HEAD}`).replace('#include <map_fragment>', `#include <map_fragment>${FRAG_COLOUR}`);
  swapped.colour = true;
  if (normal && fs.includes('#include <normal_fragment_maps>')) {
    fs = fs.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>${FRAG_NORMAL}`);
    swapped.normal = true;
  }
  return { vertexShader: vs, fragmentShader: fs, swapped };
}

const LIT = (m) => Boolean(m && (m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial || m.isMeshToonMaterial));

// A scan ({ map, normalMap }) on a lit material, once: `metres` of world a
// repeat, `strength` of its colour (0 to 1), `normal` its relief, `mean` the
// sRGB brightness its detail map is centred on.
export function wear(material, scan, { metres = 2, strength = 0.55, normal = 0.8, mean = 0.8 } = {}) {
  if (!LIT(material) || !scan?.map || material.userData.core) return material;
  const uniforms = {
    uCoreMap: { value: scan.map },
    uCoreNormal: { value: scan.normalMap ?? null },
    uCoreScale: { value: 1 / metres },
    uCoreStrength: { value: strength },
    uCoreNormalStrength: { value: scan.normalMap ? normal : 0 },
    // (the map is read decoded to linear: its sRGB mean, linear)
    uCoreMean: { value: mean ** 2.2 },
  };
  // (a mark a copy doesn't take: Material.copy copies userData through JSON)
  Object.defineProperty(material.userData, 'core', { value: uniforms, enumerable: false, configurable: true });
  const withNormal = Boolean(scan.normalMap);
  const before = material.onBeforeCompile;
  material.onBeforeCompile = (sh, r) => {
    before?.call(material, sh, r);
    Object.assign(sh.uniforms, uniforms);
    const out = wearShader(sh, { normal: withNormal });
    sh.vertexShader = out.vertexShader;
    sh.fragmentShader = out.fragmentShader;
  };
  const key = material.customProgramCacheKey;
  material.customProgramCacheKey = () => `${key ? key.call(material) : ''}|core${withNormal ? ':n' : ''}`;
  material.needsUpdate = true;
  return material;
}

// A picture's mean colour, linear: a DataTexture's bytes, or a canvas or
// bitmap drawn small.
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export function meanColour(texture) {
  const img = texture?.image;
  if (!img) return null;
  let data = img.data;
  if (!data && typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const g = c.getContext('2d');
    try {
      g.drawImage(img, 0, 0, 16, 16);
      data = g.getImageData(0, 0, 16, 16).data;
    } catch {
      return null;
    }
  }
  if (!data?.length) return null;
  const srgb = texture.colorSpace === THREE.SRGBColorSpace || !img.data;
  const sum = [0, 0, 0];
  const n = data.length / 4;
  for (let i = 0; i < data.length; i += 4)
    for (let k = 0; k < 3; k++) {
      const v = data[i + k] / 255;
      sum[k] += srgb ? toLin(v) : v;
    }
  return new THREE.Color().setRGB(sum[0] / n, sum[1] / n, sum[2] / n, THREE.LinearSRGBColorSpace);
}

// Stand-ins for a role's scan until it has loaded (dress with `keep`): a
// picture at the scan's centred brightness and a flat relief, so the
// material looks as it did, but it's drawn from the first frame with the
// shader the scan will be, and the scan's pictures go in later with no
// shader made again. Made again just after a world's first frame, that
// shader was left out of the frame by lib/three/frameGuard for a few frames
// while it readied it: walls on screen dropped out and came back.
const standIns = new Map(); // centred brightness → { map, normalMap }
function standIn(mean) {
  let s = standIns.get(mean);
  if (!s) {
    const px = (r, g, b) => {
      const t = new THREE.DataTexture(Uint8Array.from([r, g, b, 255]), 1, 1);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.needsUpdate = true;
      return t;
    };
    // (linear, at what the scan's sRGB mean decodes to: the detail's divided by it, so 1)
    const v = Math.round(255 * mean ** 2.2);
    s = { map: px(v, v, v), normalMap: px(128, 128, 255) };
    standIns.set(mean, s);
  }
  return s;
}

// A world's named materials onto the kit's roles: each one's own painted
// picture folded into its colour (and its own relief dropped), and the
// role's scan put on, at its real size. `keep` leaves the picture and the
// relief where they carry the design (cobbles, ruts, coursed blocks) and
// lays the scan's grain over them. Not on the lowest tier, where
// everything stays as it was. Resolves to how many it dressed.
export async function dress(materials, roles, { strength = 0.55, normal = 0.9, keep = false, load = loadCore, tier = budget().tier } = {}) {
  if (tier === 'low') return 0;
  const jobs = Object.entries(roles).map(async ([name, role]) => {
    const m = materials[name];
    if (!LIT(m) || m.userData.core) return 0;
    const { metres = 2, mean: centre = 0.8 } = coreOf(role) ?? {};
    // (with `keep` nothing of the material changes when the scan comes but
    // its pictures, so it's worn at once, on stand-ins)
    if (keep) wear(m, standIn(centre), { metres, mean: centre, strength, normal });
    const scan = await load(role);
    if (keep) {
      const u = m.userData.core;
      if (!scan?.map) {
        u.uCoreStrength.value = 0;
        u.uCoreNormalStrength.value = 0;
        return 0;
      }
      u.uCoreMap.value = scan.map;
      u.uCoreNormal.value = scan.normalMap ?? u.uCoreNormal.value;
      u.uCoreNormalStrength.value = scan.normalMap ? normal : 0;
      return 1;
    }
    if (!scan) return 0;
    const mean = meanColour(m.map);
    if (mean) m.color.multiply(mean);
    if (m.map) m.map = null;
    if (m.normalMap) m.normalMap = null;
    wear(m, scan, { metres, mean: centre, strength, normal });
    return 1;
  });
  return (await Promise.all(jobs)).reduce((a, b) => a + b, 0);
}

// Which role a world's material wears, by its name: the usual names of
// stone, wood, bark, turf, plaster, iron and rock in the worlds' kits. What
// glows (or is lit from within by a map: lit windows), what is
// see-through, and anything named for skin, eyes, glass,
// cloth, food, fire or the like wears nothing.
const NOT_WORN = /skin|eye|glow|hair|lava|flame|fire|water|glass|pane|lamp|lantern|void|smoke|plume|web|silk|wax|food|bread|meat|flower|blossom|leaf|tuft|thatch|banner|flag|cloth|velvet|tapestry|fur|page|parchment|book|mouth|tooth|fang|gold|gilt|brass|pewter|ember|coal|statue|carve|emblem|shadow|robe/i;
const ROLE_NAMES = [
  [/bark/i, 'bark'],
  [/wood|timber|beam|log|plank|board|fence|barn|cart/i, 'wood'],
  [/turf|grass|lawn|moss/i, 'grass'],
  [/plaster|adobe|daub|^house$/i, 'adobe'],
  [/iron|steel|metal|gauntlet|armou?r/i, 'metal'],
  [/rock|cliff|crag|boulder|obsidian/i, 'rock'],
  [/stone|paving|wall|court|marble|ashlar|cobble|trim|vault|hearth/i, 'stone'],
  [/road|gravel/i, 'gravel'],
  [/sand/i, 'sand'],
  [/snow/i, 'snow'],
  [/mud|soil/i, 'mud'],
  [/^ash$/i, 'ash'],
];
export function rolesFor(materials) {
  const out = {};
  for (const [name, m] of Object.entries(materials ?? {})) {
    if (!LIT(m) || m.userData?.noCore || m.emissiveMap || NOT_WORN.test(name)) continue;
    if (m.transparent && m.opacity < 1) continue;
    // (cut out by its picture, a road's ragged edge: its picture is its shape)
    if (m.alphaMap || (m.alphaTest > 0 && m.map)) continue;
    const glow = m.emissive ? Math.max(m.emissive.r, m.emissive.g, m.emissive.b) * (m.emissiveIntensity ?? 1) : 0;
    if (glow > 0.05) continue;
    const hit = ROLE_NAMES.find(([re]) => re.test(name));
    if (hit && coreOf(hit[1])) out[name] = hit[1];
  }
  return out;
}
