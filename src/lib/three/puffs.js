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
//   createPuffs({ species: { a, b, bark }, count, wind, facing: [x, y, z],
//     sun: [x, y, z] }) → { crowns, trunks, take() → slot | −1, set(i, x, y,
//     z, scale, yaw), free(i), update(dt), dispose() }
//   puffGeometry({ cards = 80, size = 0.8, seed }) → BufferGeometry (pure)
//   puffShader(shader) → { vertexShader, fragmentShader, swapped } (pure)
//   blob(size) → the cut-out, a DataTexture (made once)

import * as THREE from 'three';
import { seeded } from '../seeded';
import { spherifyNormals } from './foliage';
import { WIND_GLSL } from './wind';

const TRUNK = 5; // his tree collider is a cylinder 2.5 half-high
const CROWN = 1.9; // the crown's radius at scale 1

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
const PARS_FS = /* glsl */ `
uniform sampler2D uPuffBlob;
uniform vec3 uPuffA;
uniform vec3 uPuffB;
uniform vec3 uPuffSun;
varying vec2 vPuffXz;
varying vec3 vPuffNormal;
${WIND_GLSL}
`;

export function puffShader({ vertexShader, fragmentShader }) {
  const ok = vertexShader.includes('#include <worldpos_vertex>') && fragmentShader.includes('#include <color_fragment>') && fragmentShader.includes('#include <map_fragment>');
  if (!ok) return { vertexShader, fragmentShader, swapped: false };
  const vs = vertexShader
    .replace('#include <common>', `#include <common>\n${PARS_VS}`)
    .replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
{
  mat4 puffM = modelMatrix;
  #ifdef USE_INSTANCING
  puffM = modelMatrix * instanceMatrix;
  #endif
  vPuffXz = (puffM * vec4(0.0, 0.0, 0.0, 1.0)).xz;
  vPuffNormal = normalize(mat3(puffM) * objectNormal);
}`,
    );
  const fs = fragmentShader
    .replace('#include <common>', `#include <common>\n${PARS_FS}`)
    .replace(
      '#include <map_fragment>',
      `#include <map_fragment>
{
  // his cut-out: the blob, its UV turned by the wind where the tree stands
  float puffA = length(windOffset(vPuffXz)) * 2.2;
  vec2 puffUv = vMapUv - 0.5;
  puffUv = mat2(cos(puffA), -sin(puffA), sin(puffA), cos(puffA)) * puffUv + 0.5;
  float puffCut = texture2D(uPuffBlob, puffUv).r - 0.3;
  if (puffCut < 0.1) discard;
}`,
    )
    .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix(uPuffA, uPuffB, smoothstep(0.0, 1.0, dot(normalize(vPuffNormal), normalize(uPuffSun))));');
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
