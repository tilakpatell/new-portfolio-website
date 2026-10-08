// Trees as Bruno Simon makes them (folio-2025's Foliage.js and Trees.js;
// research note Part 2 §4): a crown is 80 small cards scattered in a unit
// sphere, shell-heavy (radius 1 − r³), whose normals are the sphere's (85 %:
// lib/three/foliage's spherifyNormals), so the whole puff shades as one soft
// ball; every card faces the camera's fixed direction (set once, no
// billboarding a frame); each is cut out of a soft blob turned by the wind
// (so the crown's edge crawls), and lit two-tone, mix(a, b, n·l). Trunks are
// a second instanced cylinder in the bark colour. One InstancedMesh each:
// a cell's trees take the next free slots and free them with the cell.
//
// The same crown is the far band of every kit tree (lib/three/kit's pools,
// level 2; docs/superpowers/specs/2026-10-08-kit-worlds-design.md §3), as
// one geometry and one material a model, so a pool draws it in one call:
// his cards fitted to the model's manifest size (their farthest corner its
// `radius` from the trunk, their top at its `height`; a crown that would
// reach below the ground, a bush's, fitted to the height instead), lit in
// its two tones (linear, read off its leaf map at import), on a six-sided
// trunk of its `trunk` radius (at most 0.3 of the crown's sphere: a bush's
// "trunk" is its spread at the foot) up to the crown's middle. The trunk's
// vertices are flagged (`puffTrunk`), so its fragments skip the cut-out and
// take the bark's colour. The cards face +Z: the pool turns each instance
// to the camera about up at its re-sort, so the trunk stands.
//
//   createPuffs({ species: { a, b, bark }, count, wind, facing: [x, y, z],
//     sun: [x, y, z] }) → { crowns, trunks, take() → slot | −1, set(i, x, y,
//     z, scale, yaw), free(i), update(dt), dispose() }
//   puffFor(tones: [a, b], { radius, height, trunk = 0, wind, sun, bark,
//     seed, house }) → { geometry, material } (the house's material when
//     given a house, the puff's rewrite after its look; `wind` createWind's,
//     or the cut-out holds still; `seed` scatters the cards, and the kit
//     gives each model its own, from its name, so two trees of one family
//     differ in silhouette; a `trunk` of 0 draws the crown alone; the caller
//     frees both)
//   puffGeometry({ cards = 80, size = 0.8, seed }) → BufferGeometry (pure)
//   puffShader(shader, { trunk = false, wind = true }) → { vertexShader,
//     fragmentShader, swapped } (pure)
//   blob(size) → the cut-out, a DataTexture (made once)

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { seeded } from '../seeded';
import { spherifyNormals } from './foliage';
import { WIND_GLSL } from './wind';

const TRUNK = 5; // his tree collider is a cylinder 2.5 half-high
const CROWN = 1.9; // the crown's radius at scale 1
const STEM = 0.3; // a far puff's trunk at most this share of its crown's sphere

export function puffGeometry({ cards = 80, size = 0.8, seed = 1 } = {}) {
  const rand = seeded(seed);
  const pos = new Float32Array(cards * 18);
  const uv = new Float32Array(cards * 12);
  const nrm = new Float32Array(cards * 18);
  const h = size / 2;
  const corners = [[-h, -h, 0, 0], [h, -h, 1, 0], [h, h, 1, 1], [-h, -h, 0, 0], [h, h, 1, 1], [-h, h, 0, 1]];
  for (let c = 0; c < cards; c++) {
    // a point in the unit sphere, shell-heavy, and a roll for the card
    const u = rand() * 2 - 1;
    const a = rand() * Math.PI * 2;
    const r = 1 - rand() ** 3;
    const s = Math.sqrt(1 - u * u);
    const cx = Math.cos(a) * s * r;
    const cy = u * r;
    const cz = Math.sin(a) * s * r;
    const roll = rand() * Math.PI * 2;
    const cr = Math.cos(roll);
    const sr = Math.sin(roll);
    corners.forEach(([x, y, ux, uy], k) => {
      const o = (c * 6 + k) * 3;
      pos[o] = cx + x * cr - y * sr;
      pos[o + 1] = cy + x * sr + y * cr;
      pos[o + 2] = cz;
      nrm[o + 2] = 1;
      uv[(c * 6 + k) * 2] = ux;
      uv[(c * 6 + k) * 2 + 1] = uy;
    });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return spherifyNormals(g, { centre: new THREE.Vector3(), radii: new THREE.Vector3(1, 1, 1), keep: 0.15 });
}

// a soft round blob, bright in the middle, for the cards' cut-out
export function blob(size = 64) {
  const px = new Uint8Array(size * size);
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const d = Math.hypot((i + 0.5) / size - 0.5, (j + 0.5) / size - 0.5) * 2;
      px[j * size + i] = Math.round(Math.max(0, Math.min(1, 1 - d)) * 255);
    }
  const t = new THREE.DataTexture(px, size, size, THREE.RedFormat, THREE.UnsignedByteType);
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

const PARS_VS = /* glsl */ `
varying vec2 vPuffXz;
varying vec3 vPuffNormal;
`;
const PARS_FS = (trunk, wind) => /* glsl */ `
uniform sampler2D uPuffBlob;
uniform vec3 uPuffA;
uniform vec3 uPuffB;
uniform vec3 uPuffSun;
varying vec2 vPuffXz;
varying vec3 vPuffNormal;
${trunk ? TRUNK_FS : ''}${wind ? WIND_GLSL : ''}
`;
const TRUNK_VS = /* glsl */ `attribute float puffTrunk;
varying float vPuffTrunk;
`;
const TRUNK_FS = /* glsl */ `uniform vec3 uPuffBark;
varying float vPuffTrunk;
`;
// the cut-out's UV, turned by the wind or held still
const TURN = (wind) =>
  wind
    ? `
  // his cut-out: the blob, its UV turned by the wind where the tree stands
  float puffA = length(windOffset(vPuffXz)) * 2.2;
  vec2 puffUv = vMapUv - 0.5;
  puffUv = mat2(cos(puffA), -sin(puffA), sin(puffA), cos(puffA)) * puffUv + 0.5;`
    : `
  // his cut-out: the blob, held still (no wind given)
  vec2 puffUv = vMapUv;`;
const TONE = 'mix(uPuffA, uPuffB, smoothstep(0.0, 1.0, dot(normalize(vPuffNormal), normalize(uPuffSun))))';

// `trunk`: the geometry carries a `puffTrunk` flag a vertex (puffFor's), and
// a flagged fragment is bark: never cut out, its colour `uPuffBark`. `wind`
// false: the cut-out holds still, and the shader reads no wind.
export function puffShader({ vertexShader, fragmentShader }, { trunk = false, wind = true } = {}) {
  const ok = vertexShader.includes('#include <worldpos_vertex>') && fragmentShader.includes('#include <color_fragment>') && fragmentShader.includes('#include <map_fragment>');
  if (!ok) return { vertexShader, fragmentShader, swapped: false };
  const vs = vertexShader
    .replace('#include <common>', `#include <common>\n${PARS_VS}${trunk ? TRUNK_VS : ''}`)
    .replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
{
  mat4 puffM = modelMatrix;
  #ifdef USE_INSTANCING
  puffM = modelMatrix * instanceMatrix;
  #endif
  vPuffXz = (puffM * vec4(0.0, 0.0, 0.0, 1.0)).xz;
  vPuffNormal = normalize(mat3(puffM) * objectNormal);${trunk ? '\n  vPuffTrunk = puffTrunk;' : ''}
}`,
    );
  const fs = fragmentShader
    .replace('#include <common>', `#include <common>\n${PARS_FS(trunk, wind)}`)
    .replace(
      '#include <map_fragment>',
      `#include <map_fragment>
${trunk ? 'if (vPuffTrunk < 0.5) {' : '{'}${TURN(wind)}
  float puffCut = texture2D(uPuffBlob, puffUv).r - 0.3;
  if (puffCut < 0.1) discard;
}`,
    )
    .replace('#include <color_fragment>', `#include <color_fragment>\ndiffuseColor.rgb *= ${trunk ? `vPuffTrunk > 0.5 ? uPuffBark : ${TONE}` : TONE};`);
  return { vertexShader: vs, fragmentShader: fs, swapped: true };
}

export function createPuffs({ species, count = 256, wind, facing = [1, 1, 1], sun = [0.4, 1, 0.3], seed = 1 } = {}) {
  const texture = blob();
  const uniforms = {
    uPuffBlob: { value: texture },
    uPuffA: { value: new THREE.Color(species.a) },
    uPuffB: { value: new THREE.Color(species.b) },
    uPuffSun: { value: new THREE.Vector3(...sun).normalize() },
  };
  const geometry = puffGeometry({ seed });
  // (a white map so three gives the shader its UVs; the blob cuts it out)
  const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  white.needsUpdate = true;
  const material = new THREE.MeshLambertMaterial({ color: 0xffffff, map: white, side: THREE.DoubleSide });
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, wind.uniforms, uniforms);
    const out = puffShader(sh);
    sh.vertexShader = out.vertexShader;
    sh.fragmentShader = out.fragmentShader;
  };
  material.customProgramCacheKey = () => 'puff';
  const crowns = new THREE.InstancedMesh(geometry, material, count);
  crowns.name = 'tree crowns';
  crowns.castShadow = true;
  const trunkGeometry = new THREE.CylinderGeometry(0.12, 0.18, TRUNK, 6);
  trunkGeometry.translate(0, TRUNK / 2, 0);
  const trunkMaterial = new THREE.MeshLambertMaterial({ color: species.bark });
  const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, count);
  trunks.name = 'tree trunks';
  trunks.castShadow = true;
  // every card faces the camera's fixed way: one turn for every crown
  const face = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...facing).normalize());
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const free = [];
  for (let i = count - 1; i >= 0; i--) {
    free.push(i);
    crowns.setMatrixAt(i, zero);
    trunks.setMatrixAt(i, zero);
  }
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  return {
    crowns,
    trunks,
    uniforms,
    take() {
      return free.length ? free.pop() : -1;
    },
    set(i, x, y, z, scale = 1, yaw = 0) {
      trunks.setMatrixAt(i, m.compose(p.set(x, y, z), q.setFromAxisAngle(up, yaw), s.setScalar(scale)));
      crowns.setMatrixAt(i, m.compose(p.set(x, y + (TRUNK - 0.6) * scale, z), face, s.setScalar(CROWN * scale)));
      trunks.instanceMatrix.needsUpdate = true;
      crowns.instanceMatrix.needsUpdate = true;
    },
    free(i) {
      crowns.setMatrixAt(i, zero);
      trunks.setMatrixAt(i, zero);
      crowns.instanceMatrix.needsUpdate = true;
      trunks.instanceMatrix.needsUpdate = true;
      free.push(i);
    },
    // (the wind's own update moves the cut-outs)
    update() {},
    dispose() {
      geometry.dispose();
      trunkGeometry.dispose();
      material.dispose();
      trunkMaterial.dispose();
      texture.dispose();
      white.dispose();
    },
  };
}

// shared by every puff puffFor makes, for the page's life: the cut-out, and
// a white map so three gives the shader its UVs
let maps = null;
const shared = () => {
  if (!maps) {
    const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    white.needsUpdate = true;
    maps = { blob: blob(), white };
  }
  return maps;
};

const flagged = (g, v) => g.setAttribute('puffTrunk', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(v), 1));

export function puffFor(tones, { radius, height, trunk = 0, wind = null, sun = [0.4, 1, 0.3], bark = [0.16, 0.11, 0.07], seed = 1, house = null } = {}) {
  // the crown: his cards in their unit sphere, scaled and lifted to the tree
  const crown = puffGeometry({ seed });
  crown.computeBoundingBox();
  const { min, max } = crown.boundingBox;
  const p = crown.attributes.position;
  let reach = 0;
  for (let i = 0; i < p.count; i++) reach = Math.max(reach, Math.hypot(p.getX(i), p.getZ(i)));
  const r = Math.min(radius / reach, height / (max.y - min.y));
  const centre = height - r * max.y;
  crown.scale(r, r, r).translate(0, centre, 0);
  // the trunk, open at both ends (its foot is in the ground, its top in the crown)
  const thick = Math.min(trunk, STEM * r);
  const stem = new THREE.CylinderGeometry(thick, thick, centre, 6, 1, true).translate(0, centre / 2, 0).toNonIndexed();
  const geometry = mergeGeometries([flagged(crown, 0), flagged(stem, 1)]);
  crown.dispose();
  stem.dispose();
  geometry.name = 'puff';

  const { blob: cut, white } = shared();
  const uniforms = {
    uPuffBlob: { value: cut },
    uPuffA: { value: new THREE.Color().fromArray(tones[0]) },
    uPuffB: { value: new THREE.Color().fromArray(tones[1]) },
    uPuffSun: { value: new THREE.Vector3(...sun).normalize() },
    uPuffBark: { value: new THREE.Color().fromArray(bark) },
  };
  const opts = { color: 0xffffff, map: white, side: THREE.DoubleSide };
  const material = house ? house.material(opts) : new THREE.MeshLambertMaterial(opts);
  material.name = 'puff';
  const before = material.onBeforeCompile;
  material.onBeforeCompile = (sh, renderer) => {
    before?.call(material, sh, renderer);
    Object.assign(sh.uniforms, wind?.uniforms, uniforms);
    const out = puffShader(sh, { trunk: true, wind: Boolean(wind) });
    sh.vertexShader = out.vertexShader;
    sh.fragmentShader = out.fragmentShader;
  };
  const key = material.customProgramCacheKey;
  material.customProgramCacheKey = () => `${key ? key.call(material) : ''}|puff:trunk${wind ? '' : ':still'}`;
  return { geometry, material };
}
