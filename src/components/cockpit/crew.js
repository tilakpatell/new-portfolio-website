// The people in the cockpits, modelled with Meshy (scripts/meshy-cockpit.mjs):
// Chewie in the Falcon's co-pilot's seat, Jesse beside you in the RV and
// Walt behind him. Each is the rigged model and a clip of Meshy's (sat in a
// chair, or stood), played on the model's own skeleton. A seated figure is
// placed by its hips, so it sits on the seat whatever its size; `pose`
// (called after the clip each frame) can turn a bone or two on top, an arm
// reaching for a lever.

import * as THREE from 'three';
import { gltfLoader } from '../../lib/three/gltf';
import { sharpenMaterial } from '../../lib/three/textures';
import { retarget } from '../rickmorty/portal/clips';

const BASE = '/models/cockpit';

let loader = null;
const getLoader = () => {
  if (!loader) {
    loader = gltfLoader();
  }
  return loader;
};

// Fetch a crew member's files ahead of time (the HTTP cache keeps them).
export const prefetchCrew = (names) => names.forEach((n) => fetch(`${BASE}/${n}.glb`).catch(() => {}));

// Loads `name` with its `clip` and resolves to a seated (or standing)
// figure, or null if it can't load:
//   { group, bones, update(dt), dispose() }
// `height` is how tall it stands (metres); `hips` is where its hips go in
// the parent's space; `face` turns it about y (Meshy's people face +z; the
// default, π, faces them down −z, the way the cockpits look). `file`:
// another figure of the same person on the same skeleton (the wardrobe’s
// Jesse in the lab’s suit, Albuquerque’s), sat on `name`’s clip.
export async function loadCrew(name, { file = null, clip = 'sit', height, hips = [0, 0.5, 0], face = Math.PI, rough = 0.85, smooth = true, pose = null } = {}) {
  const L = getLoader();
  let gltf;
  let anim;
  try {
    [gltf, anim] = await Promise.all([L.loadAsync(file ?? `${BASE}/${name}.glb`), clip ? L.loadAsync(`${BASE}/${name}-${clip}.glb`).catch(() => null) : null]);
  } catch {
    return null;
  }
  const model = gltf.scene;
  const owned = [];
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false; // a skinned mesh's bounds don't follow its pose
    o.castShadow = false;
    o.receiveShadow = false;
    const m = o.material;
    if (m) {
      // Meshy's colours carry their own shading: keep them matte
      m.roughness = rough;
      m.metalness = 0;
      sharpenMaterial(m);
      owned.push(m, m.map);
    }
    // Meshy's remeshed surfaces come flat-shaded; smooth them, so fur and
    // cloth don't read as facets up close
    if (smooth) smoothNormals(o.geometry);
    owned.push(o.geometry);
  });
  const bones = {};
  model.traverse((o) => {
    if (o.isBone) bones[o.name] = o;
  });
  const hipBone = bones.Hips ?? bones.hips ?? bones.mixamorigHips ?? null;
  // how tall it stands, from its skeleton at rest (a skinned mesh's own
  // bounds don't know its pose until it's drawn): the top of the head to the
  // lower of the toes
  if (height) {
    model.updateMatrixWorld(true);
    const y = (n) => bones[n]?.getWorldPosition(new THREE.Vector3()).y;
    const top = y('head_end') ?? y('Head');
    const toes = Math.min(y('LeftToeBase') ?? 0, y('RightToeBase') ?? 0);
    const tall = top != null ? top - toes : new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).y;
    if (tall > 0.01) model.scale.multiplyScalar(height / tall);
  }

  let mixer = null;
  // (on another figure, the clip’s hips scaled from the ones it was made on)
  const clipAnim = file && hipBone ? retarget(anim?.animations?.[0], hipBone.position.y, anim?.scene.getObjectByName('Hips')?.position.y ?? hipBone.position.y) : anim?.animations?.[0];
  if (clipAnim) {
    mixer = new THREE.AnimationMixer(model);
    const a = mixer.clipAction(clipAnim);
    a.play();
    a.time = Math.random() * clipAnim.duration;
    mixer.update(0);
  }

  // turn it, then move it so its hips land on `hips`
  const turn = new THREE.Group();
  turn.rotation.y = face;
  turn.add(model);
  const group = new THREE.Group();
  group.add(turn);
  group.updateMatrixWorld(true);
  if (hipBone) {
    const at = hipBone.getWorldPosition(new THREE.Vector3());
    turn.position.set(hips[0] - at.x, hips[1] - at.y, hips[2] - at.z);
  } else {
    turn.position.set(...hips);
  }
  // the clip moves the hips a little; keep the figure where it was put
  const rest = hipBone ? hipBone.position.clone() : null;

  return {
    group,
    bones,
    model,
    update(dt) {
      mixer?.update(dt);
      if (rest && hipBone) {
        hipBone.position.x = rest.x;
        hipBone.position.z = rest.z;
      }
      pose?.(bones, dt);
    },
    dispose() {
      mixer?.stopAllAction();
      for (const o of owned) o?.dispose?.();
    },
  };
}

// Normals averaged over every face that meets at a point, whatever seams
// split the point's vertices (Meshy's UV islands are many).
export function smoothNormals(geo) {
  const pos = geo.attributes.position;
  const idx = geo.index;
  const n = pos.count;
  const key = new Array(n);
  const ids = new Map();
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
    if (!ids.has(k)) ids.set(k, ids.size);
    key[i] = ids.get(k);
  }
  const acc = new Float32Array(ids.size * 3);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const tris = idx ? idx.count / 3 : n / 3;
  for (let t = 0; t < tris; t++) {
    const i0 = idx ? idx.getX(t * 3) : t * 3;
    const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1);
    c.fromBufferAttribute(pos, i2);
    // the face's normal, weighted by its area
    b.sub(a);
    c.sub(a);
    b.cross(c);
    for (const i of [i0, i1, i2]) {
      acc[key[i] * 3] += b.x;
      acc[key[i] * 3 + 1] += b.y;
      acc[key[i] * 3 + 2] += b.z;
    }
  }
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    a.set(acc[key[i] * 3], acc[key[i] * 3 + 1], acc[key[i] * 3 + 2]).normalize();
    out.set([a.x, a.y, a.z], i * 3);
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(out, 3));
}

// Turn a bone by a small Euler on top of whatever the clip did this frame.
const e = new THREE.Euler();
const q = new THREE.Quaternion();
export function nudge(bone, x = 0, y = 0, z = 0) {
  if (!bone) return;
  q.setFromEuler(e.set(x, y, z));
  bone.quaternion.multiply(q);
}
