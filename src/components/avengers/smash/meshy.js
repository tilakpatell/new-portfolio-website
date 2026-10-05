// Smash Run's models from Meshy (scripts/meshy.mjs <step> hq), once they've
// been made: public/hq/meshy/manifest.json lists what's there. Hulk and the
// Chitauri are skinned, with running, walking and idle clips; Hulk's smash,
// leap and roar are laid over his run by turning his limbs toward where they
// should point, so they work on any skeleton. Cars, the chariot and the wall
// pylons become parts for instanced pools. Anything missing stays procedural.

import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { gltfLoader } from '../../../lib/three/gltf';
import { sharpenMaterial } from '../../../lib/three/textures';

const BASE = `${import.meta.env?.BASE_URL ?? '/'}hq/meshy`;

let loader = null;
const gltf = (url) => {
  if (!loader) {
    loader = gltfLoader();
  }
  return loader.loadAsync(url);
};
const clip = (url) => gltf(url).then((g) => g.animations[0] ?? null, () => null);

// What's been made: { name: { scene, clips, rig, h } }. `manifest` (for
// tests) maps a name to { rig, h, url } in place of the file's list.
export async function loadMeshy({ manifest } = {}) {
  let list = manifest;
  if (!list) {
    try {
      const r = await fetch(`${BASE}/manifest.json`);
      list = r.ok ? await r.json() : {};
    } catch {
      list = {};
    }
  }
  const out = {};
  await Promise.all(
    Object.entries(list).map(async ([name, spec]) => {
      const url = spec.url ?? `${BASE}/${name}`;
      try {
        const g = await gltf(`${url}.glb`);
        const clips = {};
        if (spec.rig) {
          const [idle, walk, run] = await Promise.all(['idle', 'walk', 'run'].map((c) => clip(`${url}-${c}.glb`)));
          Object.assign(clips, { idle, walk, run });
        }
        g.scene.traverse((o) => {
          if (!o.isMesh) return;
          o.castShadow = true;
          o.receiveShadow = true;
          if (o.isSkinnedMesh) o.frustumCulled = false;
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) sharpenMaterial(m);
        });
        out[name] = { scene: g.scene, clips, rig: !!spec.rig, h: spec.h ?? 2 };
      } catch {
        /* not made yet, or it didn't load: procedural */
      }
    }),
  );
  return out;
}

// A model stood on y = 0, centred, `h` tall (along 'y'), or `h` long with its
// length turned along z ('z': cars, the chariot).
export function fitted(asset, { h = asset.h, along = 'y', skinned = false } = {}) {
  const model = skinned ? cloneSkinned(asset.scene) : asset.scene.clone();
  const holder = new THREE.Group();
  holder.add(model);
  model.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(model);
  let size = box.getSize(new THREE.Vector3());
  if (along === 'z' && size.x > size.z) {
    model.rotation.y = Math.PI / 2;
    model.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(model);
    size = box.getSize(new THREE.Vector3());
  }
  const k = h / Math.max(1e-6, along === 'z' ? size.z : size.y);
  model.scale.multiplyScalar(k);
  model.position.set(-((box.min.x + box.max.x) / 2) * k, -box.min.y * k, -((box.min.z + box.max.z) / 2) * k);
  return holder;
}

// Float copies of a geometry (compressed models keep positions as normalised
// integers, which can't hold a transform baked into them).
function floatGeometry(src) {
  const g = new THREE.BufferGeometry();
  if (src.index) g.setIndex(src.index.clone());
  for (const [name, a] of Object.entries(src.attributes)) {
    if (name === 'skinIndex' || name === 'skinWeight') continue;
    const f = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = a.getComponent(i, c);
    g.setAttribute(name, new THREE.BufferAttribute(f, a.itemSize));
  }
  return g;
}

// A fitted model's meshes as parts for an instanced pool: { geos, mats }.
export function meshyParts(asset, opts) {
  const holder = fitted(asset, opts);
  holder.updateMatrixWorld(true);
  const geos = {};
  const mats = {};
  let i = 0;
  holder.traverse((o) => {
    if (!o.isMesh) return;
    const k = `m${i++}`;
    geos[k] = floatGeometry(o.geometry).applyMatrix4(o.matrixWorld);
    mats[k] = o.material;
  });
  return { geos, mats };
}

// Turn `bone` so the line from it to `child` points along `dir` (world
// space), by `w` of the way.
const qa = new THREE.Quaternion();
const qb = new THREE.Quaternion();
const qp = new THREE.Quaternion();
const va = new THREE.Vector3();
const vb = new THREE.Vector3();
const vd = new THREE.Vector3();
export function aim(bone, child, dir, w = 1) {
  if (!bone || !child || w <= 0) return;
  bone.updateMatrixWorld(true);
  bone.getWorldPosition(va);
  child.getWorldPosition(vb);
  const now = vb.sub(va).normalize();
  if (now.lengthSq() < 1e-8) return;
  vd.copy(dir).normalize();
  qa.setFromUnitVectors(now, vd); // the world turn wanted
  bone.getWorldQuaternion(qb);
  qa.multiply(qb); // the bone's new world rotation
  bone.parent.getWorldQuaternion(qp);
  qa.premultiply(qp.invert()); // back into its parent's space
  bone.quaternion.slerp(qa, Math.min(1, w));
  bone.updateMatrixWorld(true);
}

// A skinned Meshy figure: its clips playing by weight, and its named bones.
export function meshyFigure(asset, { h = asset.h } = {}) {
  const root = new THREE.Group();
  const body = fitted(asset, { h, skinned: true });
  root.add(body);
  const model = body.children[0];
  const mixer = new THREE.AnimationMixer(model);
  const act = {};
  for (const [name, c] of Object.entries(asset.clips)) {
    if (!c) continue;
    const a = mixer.clipAction(c);
    a.play();
    a.setEffectiveWeight(name === 'idle' ? 1 : 0);
    act[name] = a;
  }
  const bone = (n) => model.getObjectByName(n) ?? model.getObjectByName(`mixamorig:${n}`) ?? null;
  const bones = Object.fromEntries(
    ['Hips', 'Spine', 'Spine01', 'Spine02', 'neck', 'Head', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'].map((n) => [n, bone(n)]),
  );
  const materials = [];
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.material = o.material.clone(); // each figure tints its own
    materials.push(o.material);
  });
  let mode = 'idle';
  return {
    root,
    body,
    bones,
    materials,
    meshy: true,
    // 'idle' | 'walk' | 'run', and how fast the clip plays
    set(m, pace = 1) {
      mode = m;
      for (const [name, a] of Object.entries(act)) {
        a.setEffectiveWeight(name === mode || (!act[mode] && name === 'idle') ? 1 : 0);
        a.timeScale = name === 'idle' ? 1 : pace;
      }
    },
    update(dt) {
      mixer.update(dt);
      model.updateMatrixWorld(true);
    },
    phase(t) {
      for (const a of Object.values(act)) a.time = t % a.getClip().duration;
    },
  };
}
