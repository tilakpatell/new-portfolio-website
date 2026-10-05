// The Citadel's crowds: every kind of Rick and Morty the site has, standing
// where ./layout.js's crowdFor(mood) puts them. Each kind is one light,
// still copy (scripts/crowd.mjs) drawn as an instanced mesh, so a rally of
// forty costs no more than a few figures. Neighbours are always different
// kinds, Ricks four to one Morty or so, as in the show's crowd scenes.

import * as THREE from 'three';
import { toon } from '../portal/toon';
import { crowdFor } from './layout';
import { gltfLoader } from '../../../lib/three/gltf';

const BASE = '/games/meshy/crowd';
const RICKS = ['rick', 'cowboyrick', 'factoryrick', 'constructionrick', 'sweaterrick', 'suitrick', 'detectiverick', 'cop', 'wizardrick', 'hazmatrick', 'sheriffrick', 'retrorick', 'visorrick', 'doofusrick', 'mulletrick', 'chefrick', 'pilotrick', 'punkrick'];
const MORTYS = ['morty', 'copmorty', 'hobbitmorty', 'beaniemorty', 'sheriffmorty', 'overallsmorty', 'maskmorty', 'glassesmorty', 'astronautmorty', 'punkmorty'];
// how tall each stands, in metres (a hat or a mohawk on top)
const TALL = { rick: 1.85, morty: 1.5, cowboyrick: 1.97, wizardrick: 2.15, chefrick: 2.05, detectiverick: 1.92, hazmatrick: 1.9, astronautmorty: 1.5, punkmorty: 1.62, sheriffmorty: 1.6, punkrick: 1.85 };
const heightOf = (n) => TALL[n] ?? (MORTYS.includes(n) ? 1.5 : 1.85);
// how many of each kind a device draws from
const KINDS_BY_TIER = { high: [...RICKS, ...MORTYS], mid: [...RICKS.slice(0, 12), ...MORTYS.slice(0, 6)], low: [...RICKS.slice(0, 7), ...MORTYS.slice(0, 3)] };

// Meshy's textures carry their own shading: a light ramp, as the cast has
let ramp = null;
const lightRamp = () => {
  if (ramp) return ramp;
  ramp = new THREE.DataTexture(new Uint8Array([165, 165, 165, 255, 215, 215, 215, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
  ramp.needsUpdate = true;
  return ramp;
};
const hash = (i, k = 0) => (((Math.sin(i * 91.345 + k * 47.853) * 43758.5453) % 1) + 1) % 1;

// a figure's geometry in the world, standing on the floor at `height`
// metres, centred over its feet. The baked copies are quantized (positions
// as normalized Int16 in -1…1, the node's matrix holding the real size),
// so every attribute is decoded to floats first: moved in place, a point
// past 1 would wrap round to the other end.
export function standing(geometry, matrix, height) {
  const geo = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(geometry.attributes)) {
    const out = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) out[i * a.itemSize + c] = a.getComponent(i, c);
    geo.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
  }
  if (geometry.index) geo.setIndex(geometry.index.clone());
  geo.applyMatrix4(matrix);
  geo.computeBoundingBox();
  const b = geo.boundingBox;
  const k = height / (b.max.y - b.min.y);
  return geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2).scale(k, k, k);
}

export async function createCrowd(parent, { tier = 'high' } = {}) {
  const loader = gltfLoader();
  const kinds = KINDS_BY_TIER[tier] ?? KINDS_BY_TIER.high;
  const owned = [];
  // each kind: its geometry (feet on the ground, centred) and material
  const loaded = await Promise.all(
    kinds.map((name) =>
      loader
        .loadAsync(`${BASE}/${name}.glb`)
        .then((g) => {
          let mesh = null;
          g.scene.traverse((o) => {
            if (o.isMesh && !mesh) mesh = o;
          });
          if (!mesh) return null;
          g.scene.updateMatrixWorld(true);
          const geo = standing(mesh.geometry, mesh.matrixWorld, heightOf(name));
          const mat = toon(0xffffff, { map: mesh.material.map ?? null, gradientMap: lightRamp() });
          owned.push(geo, mat, mesh.geometry);
          if (mesh.material.map) owned.push(mesh.material.map);
          mesh.material.dispose();
          return { name, geo, mat, morty: MORTYS.includes(name) };
        })
        .catch(() => null),
    ),
  );
  const ok = loaded.filter(Boolean);
  const ricks = ok.filter((k) => !k.morty);
  const mortys = ok.filter((k) => k.morty);
  if (!ok.length) return { setMood() {}, dispose() {} };

  // who stands where, by mood: a kind for each place, never the same as the
  // one placed just before it
  const plan = (mood) => {
    const list = crowdFor(mood);
    const thin = tier === 'low' ? list.filter((_, i) => i % 2 === 0) : list;
    let last = null;
    return thin.map((c, i) => {
      const pool = mortys.length && hash(i, 1) < 0.22 ? mortys : ricks.length ? ricks : mortys;
      let kind = pool[Math.floor(hash(i, 2) * pool.length)];
      if (kind === last && pool.length > 1) kind = pool[(pool.indexOf(kind) + 1) % pool.length];
      last = kind;
      return { ...c, kind, scale: 0.96 + hash(i, 3) * 0.08 };
    });
  };
  const plans = { day: plan('day'), election: plan('election'), red: [] };
  // one instanced mesh a kind, big enough for its most in any mood
  const meshes = new Map();
  for (const k of ok) {
    const most = Math.max(...Object.values(plans).map((p) => p.filter((c) => c.kind === k).length), 0);
    if (!most) continue;
    const m = new THREE.InstancedMesh(k.geo, k.mat, most);
    m.count = 0;
    m.name = `crowd-${k.name}`;
    parent.add(m);
    meshes.set(k, m);
  }

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const at = new THREE.Vector3();
  const sc = new THREE.Vector3();
  let current = null;
  const setMood = (mood) => {
    const key = mood === 'red' ? 'red' : mood === 'election' ? 'election' : 'day';
    if (key === current) return;
    current = key;
    for (const m of meshes.values()) m.count = 0;
    for (const c of plans[key]) {
      const m = meshes.get(c.kind);
      if (!m) continue;
      // a walker's heading (+x to (cos, -sin)) as a figure's turn (they face +z)
      q.setFromAxisAngle(up, c.face + Math.PI / 2);
      m4.compose(at.set(c.x, 0, c.z), q, sc.setScalar(c.scale));
      m.setMatrixAt(m.count, m4);
      m.count += 1;
    }
    for (const m of meshes.values()) {
      m.instanceMatrix.needsUpdate = true;
      m.visible = m.count > 0;
      m.computeBoundingSphere();
    }
  };
  setMood('day');

  const dispose = () => {
    for (const m of meshes.values()) m.removeFromParent();
    meshes.clear();
    for (const o of owned) o.dispose?.();
    owned.length = 0;
  };
  return { setMood, dispose };
}
