// A figure from Star Wars Battlefront II (2017), on the game's own skeleton
// (Walrus_HumanMale, kept whole: walrusRig.js), moved by the game's own
// clips: the packs scripts/bf2017-clips.mjs makes (a generic humanoid one,
// and one per hero, each under the site's clip names: walrusClips.js). The
// clips bind to the body by bone name, as they were made, so nothing is
// retargeted; a track naming a bone this body hasn't got is left out before
// the mixer sees it (three would warn and skip it every frame otherwise), a
// bone another clip of the set moves is put back to rest in a clip that
// leaves it alone (a pack doesn't send the channels that only hold rest, and
// three leaves an untouched bone where the last clip put it), and a name the
// packs lack plays the nearest one they have (walrusRig.js's CLIP_FALLBACK).
// No UAL or Meshy clip ever reaches one of these (the owner's ruling,
// 2026-10-10); the animator is told not to fetch from the library.
// (docs/superpowers/specs/2026-10-10-battlefront-2017-asset-pipeline-design.md, section 4)
//
//   loadWalrusPacks(urls, { loader }) → Promise<Map<name, AnimationClip>>:
//     each pack fetched once a page (gltfCache), later packs' clips over
//     earlier ones' of the same name, a pack's aliases (one clip under two
//     names) made into names; a pack that fails is skipped
//   clipsFor(body, clips) → { name: AnimationClip }: the set this body plays,
//     filtered to its bones, rest put back, the fallbacks named
//   socketsOf(body) → { weapon, muzzle, aim, handL, handR }: the bones, or null
//   loadWalrusBody(url, { packs, loader }) → Promise<{ model, clips, sockets }>:
//     a copy of the body (its own bones), its clips; refuses a tree that is
//     not the game's rig, naming what it lacks
//   PACK_DIR, packUrls(hero): the packs a figure loads, the humanoid first
//   cutFor(url, level): which of a 2017 figure's two files a device loads:
//     the full one (the game's top mesh, every map at the game's 2048) at
//     high and ultra, its `.lod1` (a lighter mesh, 1024 colour) at low and
//     mid (lib/detail.js's level, from lib/device's tier)

import * as THREE from 'three';
import { cloneScene, loadGLTF } from './gltfCache';
import { CLIP_FALLBACK, SOCKETS, checkWalrus, isWalrus } from './walrusRig.js';

export const PACK_DIR = '/models/galaxy/bf2017';
export const packUrls = (hero = null) => [`${PACK_DIR}/clips-humanoid.glb`, ...(hero ? [`${PACK_DIR}/clips-${hero}.glb`] : [])];

export const cutFor = (url, level) => (level === 'low' || level === 'mid' ? url.replace(/\.glb$/, '.lod1.glb') : url);

const boneOf = (track) => track.name.slice(0, track.name.lastIndexOf('.'));

export async function loadWalrusPacks(urls, { loader } = {}) {
  const gltfs = await Promise.all(urls.map((u) => loadGLTF(u, { loader })));
  const out = new Map();
  for (const g of gltfs) {
    if (!g) continue;
    for (const c of g.animations ?? []) out.set(c.name, c);
    const aliases = g.scene?.userData?.aliases ?? g.userData?.aliases ?? {};
    for (const [name, to] of Object.entries(aliases)) {
      const c = out.get(to);
      if (!c) continue;
      const copy = c.clone();
      copy.name = name;
      out.set(name, copy);
    }
  }
  return out;
}

// a bone's rest, as the body stands before any clip
const restTrack = (bone, path, end) => {
  const v = bone[path].toArray();
  const T = path === 'quaternion' ? THREE.QuaternionKeyframeTrack : THREE.VectorKeyframeTrack;
  return new T(`${bone.name}.${path}`, [0, end], [...v, ...v]);
};

export function clipsFor(body, clips) {
  // (the bones by name, a bone before any other node of its name)
  const bones = new Map();
  body.traverse((o) => o.isBone && o.name && !bones.has(o.name) && bones.set(o.name, o));
  body.traverse((o) => o.name && !bones.has(o.name) && bones.set(o.name, o));
  const own = {};
  // every bone and path any clip of the set moves, on this body
  const moved = new Map(); // `${bone}.${path}` → [bone, path]
  for (const [name, clip] of clips) {
    const tracks = clip.tracks.filter((t) => bones.has(boneOf(t)));
    if (!tracks.length) continue;
    const c = new THREE.AnimationClip(name, clip.duration, tracks);
    c.userData = { ...(clip.userData ?? {}) };
    own[name] = c;
    for (const t of tracks) {
      const path = t.name.slice(t.name.lastIndexOf('.') + 1);
      moved.set(t.name, [bones.get(boneOf(t)), path]);
    }
  }
  // (rest back where a clip leaves a moved bone alone)
  for (const c of Object.values(own)) {
    const has = new Set(c.tracks.map((t) => t.name));
    for (const [id, [bone, path]] of moved) if (!has.has(id)) c.tracks.push(restTrack(bone, path, c.duration));
  }
  // (each its own copy: the mixer keeps one action a clip, so a fallback
  // sharing the idle's would have a dodge stop the idle for good)
  for (const [name, to] of Object.entries(CLIP_FALLBACK))
    if (!own[name] && own[to]) {
      own[name] = own[to].clone();
      own[name].name = name;
      own[name].userData = { ...own[to].userData };
    }
  return own;
}

export function socketsOf(body) {
  return Object.fromEntries(Object.entries(SOCKETS).map(([k, n]) => [k, body.getObjectByName(n) ?? null]));
}

export async function loadWalrusBody(url, { packs = packUrls(), loader } = {}) {
  const [gltf, clips] = await Promise.all([loadGLTF(url, { loader }), loadWalrusPacks(packs, { loader })]);
  if (!gltf) throw new Error(`${url}: no model`);
  const model = cloneScene(gltf);
  const names = [];
  model.traverse((o) => o.name && names.push(o.name));
  if (!isWalrus(names)) {
    const { missing } = checkWalrus(names);
    throw new Error(`${url} is not on the game's skeleton (Spine1, never Meshy's Spine02); it lacks ${missing.slice(0, 6).join(', ')}`);
  }
  return { model, clips: clipsFor(model, clips), sockets: socketsOf(model) };
}
