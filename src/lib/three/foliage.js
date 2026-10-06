// Foliage that reads as foliage, for nothing at run time: a canopy built of
// a dozen faceted blobs lights as a dozen flat things, and shimmers like
// broken glass as the camera moves; the same blobs with their normals
// pointing out from the middle of the whole crown light as one soft volume,
// the way a tree does (the trick studios do in Blender, a hull's normals
// transferred onto the cards; here it's a loop at build time). Light that
// wraps a little past a leaf's edge, and comes through from behind, keeps
// the shaded side of a crown from going flat. Wind is a few lines in the
// vertex shader, bending a tree from its foot by one clock.
// (docs/research/2026-10-06-ground-grass-foliage-techniques.md, 2 and 7)
//
//   spherifyNormals(geometry, { centre, radii, keep })  normals out from an ellipsoid (pure)
//   liftNormals(geometry, { keep })                     normals turned up, as a lawn's (pure)
//   wrapLighting(material, { wrap, backScatter })       light past the terminator, and through
//   wind(material, { kind, time, ... })                 a sway from the foot, a flutter in the leaves
//   wrapShader(shaders, opts, chunks), windShader(shaders, opts)   the rewrites, as pure strings
//
// Call the material hooks before ones that look for three's lights chunks
// expanded (they expand the one they change).

import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

// Every vertex's normal pointed out from the middle of an ellipsoid round the
// geometry (its bounding box's, unless `centre` and `radii` are given), with
// `keep` of its own normal left in: 0 is a smooth ball, 1 is as it was. A
// little kept stops a crown reading as one plastic sphere. Changes the
// geometry's normals in place and gives it back.
export function spherifyNormals(geometry, { centre = null, radii = null, keep = 0.25 } = {}) {
  const pos = geometry.attributes.position;
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  const nrm = geometry.attributes.normal;
  let c = centre;
  let r = radii;
  if (!c || !r) {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    c ??= box.getCenter(new THREE.Vector3());
    r ??= box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  }
  const inv = new THREE.Vector3(1 / Math.max(1e-6, r.x), 1 / Math.max(1e-6, r.y), 1 / Math.max(1e-6, r.z));
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).sub(c).multiply(inv);
    if (v.lengthSq() < 1e-12) v.copy(UP);
    v.normalize();
    n.fromBufferAttribute(nrm, i);
    v.multiplyScalar(1 - keep).addScaledVector(n, keep);
    if (v.lengthSq() < 1e-12) v.copy(UP);
    v.normalize();
    nrm.setXYZ(i, v.x, v.y, v.z);
  }
  nrm.needsUpdate = true;
  return geometry;
}

// Every normal turned toward straight up, `keep` of its own left: blades
// and spiky leaves lit as the ground they grow from, not as the hundred
// edges they are. In place; gives the geometry back.
export function liftNormals(geometry, { keep = 0.25 } = {}) {
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  const nrm = geometry.attributes.normal;
  const n = new THREE.Vector3();
  for (let i = 0; i < nrm.count; i++) {
    n.fromBufferAttribute(nrm, i).multiplyScalar(keep).addScaledVector(UP, 1 - keep);
    if (n.lengthSq() < 1e-12) n.copy(UP);
    n.normalize();
    nrm.setXYZ(i, n.x, n.y, n.z);
  }
  nrm.needsUpdate = true;
  return geometry;
}

// ── light that wraps ──

const DOT_LINE = 'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );';
const IRRADIANCE_LINE = 'vec3 irradiance = dotNL * directLight.color;';
const LIGHT_CHUNKS = ['lights_lambert_pars_fragment', 'lights_physical_pars_fragment'];

// The rewrite, as pure strings: the direct light's cosine wrapped past the
// terminator by uWrap, and a little of the light from behind let through
// (uBackScatter), in whichever of three's lights chunks the shader uses.
export function wrapShader({ vertexShader, fragmentShader }, opts, chunks = THREE.ShaderChunk) {
  let fs = fragmentShader;
  let wrap = false;
  for (const name of LIGHT_CHUNKS) {
    const include = `#include <${name}>`;
    const src = chunks[name];
    if (!fs.includes(include) || typeof src !== 'string' || !src.includes(DOT_LINE) || !src.includes(IRRADIANCE_LINE)) continue;
    const out = src
      .replace(DOT_LINE, 'float dotNL = saturate( ( dot( geometryNormal, directLight.direction ) + uWrap ) / ( 1.0 + uWrap ) );')
      .replace(
        IRRADIANCE_LINE,
        `${IRRADIANCE_LINE}
	// (light from behind, through the leaves)
	reflectedLight.directDiffuse += uBackScatter * saturate( dot( - geometryNormal, directLight.direction ) ) * directLight.color * BRDF_Lambert( material.diffuseColor );`,
      );
    fs = fs.replace(include, out);
    wrap = true;
  }
  if (wrap) fs = fs.replace('#include <common>', '#include <common>\nuniform float uWrap;\nuniform float uBackScatter;');
  return { vertexShader, fragmentShader: fs, swapped: { wrap } };
}

export function wrapLighting(material, { wrap = 0.5, backScatter = 0.25 } = {}) {
  if (!material || material.userData.wrap) return material;
  const uniforms = { uWrap: { value: wrap }, uBackScatter: { value: backScatter } };
  const before = material.onBeforeCompile;
  material.onBeforeCompile = (sh, r) => {
    before?.call(material, sh, r);
    Object.assign(sh.uniforms, uniforms);
    const out = wrapShader(sh);
    sh.fragmentShader = out.fragmentShader;
  };
  const key = material.customProgramCacheKey;
  material.customProgramCacheKey = () => `${key ? key.call(material) : ''}|wrap`;
  material.userData.wrap = uniforms;
  material.needsUpdate = true;
  return material;
}

// ── the wind ──

// How each kind moves: `height` the height (in the geometry's own metres)
// the bend reaches full strength at, `strength` how far the top goes, the
// trunk's slow sway and the leaves' quick flutter in Hz, and the flutter's size.
export const WIND = {
  tree: { height: 7, strength: 0.16, trunkHz: 0.45, leafHz: 2.6, leaf: 0.025 },
  shrub: { height: 1.3, strength: 0.05, trunkHz: 0.8, leafHz: 3.4, leaf: 0.012 },
};

// The rewrite, as pure strings: after three's begin_vertex, the vertex moved
// along the wind by the square of its height (Crysis's main bending, short
// of keeping its length: at these sizes the stretch is a millimetre), in a
// phase from where the instance stands, plus a flutter by where the vertex is.
export function windShader({ vertexShader, fragmentShader }) {
  if (!vertexShader.includes('#include <begin_vertex>')) return { vertexShader, fragmentShader, swapped: { wind: false } };
  const decl = ['uWindTime', 'uWindStrength', 'uWindHeight', 'uWindTrunk', 'uWindLeaf', 'uWindLeafAmp'].map((u) => `uniform float ${u};`);
  const vs = vertexShader.replace('#include <common>', `#include <common>\n${decl.join('\n')}\nuniform vec2 uWindDir;`).replace(
    '#include <begin_vertex>',
    `#include <begin_vertex>
    {
      vec3 wBase = vec3(0.0);
      vec2 wDir = uWindDir;
      #ifdef USE_INSTANCING
        wBase = instanceMatrix[3].xyz;
        // (the wind blows one way across the world: turned into the instance's own frame)
        wDir = normalize((transpose(mat3(instanceMatrix)) * vec3(uWindDir.x, 0.0, uWindDir.y)).xz + 1e-5);
      #endif
      wBase = (modelMatrix * vec4(wBase, 1.0)).xyz;
      float wPhase = dot(wBase.xz, vec2(0.071, 0.113));
      float wH = clamp(transformed.y / uWindHeight, 0.0, 1.0);
      float wBend = wH * wH;
      float wT = uWindTime * uWindTrunk * 6.2832 + wPhase;
      float wSway = 0.6 + 0.4 * sin(wT) + 0.25 * sin(wT * 2.3 + 1.7);
      float wFlutter = sin(uWindTime * uWindLeaf * 6.2832 + dot(transformed, vec3(3.1, 1.7, 2.3)) + wPhase) * uWindLeafAmp * wH;
      transformed.xz += wDir * (wSway * uWindStrength * wBend) + vec2(wFlutter, -wFlutter * 0.7);
    }`,
  );
  return { vertexShader: vs, fragmentShader, swapped: { wind: true } };
}

// A material that sways: `kind` 'tree' or 'shrub' (WIND's numbers, any of
// them overridden here), `time` a { value } shared by everything in the wind
// (seconds; hold it still for reduced motion), `dir` where it blows to.
export function wind(material, { kind = 'tree', time = { value: 0 }, dir = new THREE.Vector2(0.8, 0.6), ...over } = {}) {
  if (!material || material.userData.wind) return material;
  const k = { ...(WIND[kind] ?? WIND.tree), ...over };
  const uniforms = {
    uWindTime: time,
    uWindStrength: { value: k.strength },
    uWindHeight: { value: k.height },
    uWindTrunk: { value: k.trunkHz },
    uWindLeaf: { value: k.leafHz },
    uWindLeafAmp: { value: k.leaf },
    uWindDir: { value: dir.clone().normalize() },
  };
  const before = material.onBeforeCompile;
  material.onBeforeCompile = (sh, r) => {
    before?.call(material, sh, r);
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = windShader(sh).vertexShader;
  };
  const key = material.customProgramCacheKey;
  material.customProgramCacheKey = () => `${key ? key.call(material) : ''}|wind`;
  material.userData.wind = uniforms;
  material.needsUpdate = true;
  return material;
}
