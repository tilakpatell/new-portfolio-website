// Figures on the 2017 game's skeleton: one skeleton, one clip library, many
// bodies, the way the game shares Walrus_HumanMale between 604 people. A
// body (a hero's GLB from scripts/bf2017-import.mjs, every joint kept, no
// clip of its own) is driven by the shared packs (scripts/bf2017-clips.mjs:
// the game's own clips under the site's names) by bone name, and comes back
// as the figure every other loader returns (footScene.js's rigged: model,
// bones, anim, update, play, react…), so the worlds, the duellists and the
// saber call it as they call any figure. It plays only the game's clips:
// the clip library's (Meshy's, the UAL's) are never asked for (the owner's
// rule), and a name it lacks falls back by walrusRig.js's CLIP_FALLBACK or
// is cut. (docs/superpowers/specs/2026-10-10-battlefront-2017-asset-pipeline-design.md, section 4)
//
//   WALRUS_CLIPS: the three packs' URLs
//   loadWalrusClips(urls, { loader }) → Promise<Map<name, AnimationClip>>
//     each pack fetched once a page; a pack that fails is left out (its
//     names then fall back or are cut)
//   clipsFor(body, clips) → { name: AnimationClip }: each clip cut to the
//     tracks whose bone the body has (a cape's or an outfit's bones differ
//     from body to body: three's binding would warn once a missing bone a
//     frame and skip it, so they are filtered before the mixer sees them),
//     a clip left with none dropped, then every fallback name answered
//   loadWalrusFigure(url, { tall, unit = 1, seed = 0, clipSpeed, loader,
//     clips }) → Promise<figure>: the body, copied from one template a URL,
//     standing `tall` (in `unit`s: the caller's METRE) with its feet on
//     y = 0; refuses a body not on the game's skeleton, naming the bones it
//     lacks. figure: { model, bones, loco, mixer, act, anim, update(dt,
//     move, motion), after, play, stop, base, look, react, dispose,
//     rig: 'walrus', sockets: { weapon, muzzle, aim, handL, handR } }

import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { createAnimator } from './animator';
import { animatorCalls } from './figureCalls';
import { gltfLoader } from './gltf';
import { CLIP_FALLBACK, SOCKETS, checkWalrus, resolveClip } from './walrusRig';

const BASE = '/models/galaxy/bf2017';
export const WALRUS_CLIPS = [`${BASE}/clips-core.glb`, `${BASE}/clips-sword.glb`, `${BASE}/clips-life.glb`];

const libraries = new WeakMap(); // loader → Map(urls key → Promise<Map>)
const templates = new WeakMap(); // loader → Map(url → Promise<scene>)
const perLoader = (store, loader) => {
  if (!store.has(loader)) store.set(loader, new Map());
  return store.get(loader);
};

export function loadWalrusClips(urls = WALRUS_CLIPS, { loader = gltfLoader() } = {}) {
  const cache = perLoader(libraries, loader);
  const key = urls.join('\n');
  if (!cache.has(key))
    cache.set(
      key,
      Promise.all(urls.map((u) => loader.loadAsync(u).then((g) => g.animations, () => []))).then((packs) => {
        const out = new Map();
        for (const pack of packs) for (const c of pack) if (!out.has(c.name)) out.set(c.name, c);
        return out;
      }),
    );
  return cache.get(key);
}

export function clipsFor(body, clips) {
  const out = {};
  for (const [name, clip] of clips) {
    const tracks = clip.tracks.filter((t) => {
      const { nodeName } = THREE.PropertyBinding.parseTrackName(t.name);
      return Boolean(THREE.PropertyBinding.findNode(body, nodeName));
    });
    if (!tracks.length) continue;
    const c = tracks.length === clip.tracks.length ? clip : new THREE.AnimationClip(clip.name, clip.duration, tracks, clip.blendMode);
    if (c !== clip) c.userData = clip.userData;
    out[name] = c;
  }
  for (const name of Object.keys(CLIP_FALLBACK)) {
    const to = resolveClip(name, (n) => n in out);
    if (to && to !== name) out[name] = out[to];
  }
  return out;
}

function templateOf(url, loader) {
  const cache = perLoader(templates, loader);
  if (!cache.has(url))
    cache.set(
      url,
      loader.loadAsync(url).then(
        (g) => g.scene,
        (e) => {
          cache.delete(url); // (a failed fetch is tried again next time)
          throw e;
        },
      ),
    );
  return cache.get(url);
}

export async function loadWalrusFigure(url, { tall, unit = 1, seed = 0, clipSpeed = null, loader = gltfLoader(), clips = null } = {}) {
  const scene = await templateOf(url, loader);
  const names = [];
  scene.traverse((o) => names.push(o.name));
  const check = checkWalrus(names);
  if (!check.ok) throw new Error(`${url}: not on the game's skeleton (missing ${check.missing.slice(0, 8).join(', ')})`);
  const model = cloneSkinned(scene);
  const bones = {};
  model.traverse((o) => {
    if (o.isBone && !(o.name in bones)) bones[o.name] = o;
    // (a skinned mesh's bounds don't follow its pose)
    if (o.isMesh) o.frustumCulled = false;
  });
  // how tall it stands at rest: its meshes' box, else the head over the toes
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const y = (n) => bones[n]?.getWorldPosition(new THREE.Vector3()).y ?? 0;
  const empty = box.isEmpty();
  const floor = empty ? Math.min(y('LeftToeBase'), y('RightToeBase')) : box.min.y;
  const height = empty ? y('Head') - floor : box.max.y - box.min.y;
  const k = (tall * unit) / Math.max(height, 1e-6);
  model.scale.multiplyScalar(k);
  model.position.y -= floor * k;

  const own = clipsFor(model, clips ?? (await loadWalrusClips(WALRUS_CLIPS, { loader })));
  const anim = createAnimator(model, { clips: own, bones, unit, seed, clipSpeed, key: `${url}:${tall}` });
  const act = Object.fromEntries(['idle', 'walk', 'run'].filter((n) => anim.actions[n]).map((n) => [n, anim.actions[n]]));
  // (library: false, so a name it lacks is never fetched from Meshy's or the UAL's)
  const calls = animatorCalls(anim, { model, seed, own: Object.keys(own), act, library: false });
  const sockets = Object.fromEntries(Object.entries(SOCKETS).map(([k2, n]) => [k2, bones[n] ?? null]));
  return {
    model,
    bones,
    loco: anim.loco,
    mixer: anim.mixer,
    act,
    anim,
    rig: 'walrus',
    sockets,
    update(dt, move = 0, motion = null) {
      calls.tick(dt, motion ? Math.hypot(motion.speed ?? 0, motion.side ?? 0) > 0.05 * unit : move > 0.05);
      anim.locomote(motion ? { move, ...motion } : { move });
      anim.update(dt);
    },
    after: (dt, motion, frame) => anim.after(dt, motion, frame),
    play: calls.play,
    stop: calls.stop,
    base: calls.base,
    look: calls.look,
    react: calls.react,
    // (the geometry and materials are the template's, kept for the next copy)
    dispose: () => anim.dispose(),
  };
}
