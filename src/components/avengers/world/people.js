// The compound's people from Sketchfab (../people/models.js: Cap, Thor, the
// Hulk, Natasha and an Iron Man armour, CC BY), animated by their own clips:
// idle, walk and run (and Cap's jump), in place, so the world moves them.
//
// loadPerson(url) → a template, loaded once; person(template) → a copy to
// place: { root, play(name, opts), update(dt), bone(name), height, dispose }.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

let loader = null;
const cache = new Map();
const asset = (file) => `${import.meta.env?.BASE_URL ?? '/'}${file.replace(/^\//, '')}`;

export function loadPerson(url) {
  if (!cache.has(url)) {
    if (!loader) {
      loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
    }
    cache.set(
      url,
      loader.loadAsync(asset(url)).then((g) => {
        g.scene.traverse((o) => {
          if (!o.isMesh) return;
          o.castShadow = true;
          o.receiveShadow = true;
          if (o.isSkinnedMesh) o.frustumCulled = false;
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m.map) m.map.anisotropy = 8;
        });
        return { scene: g.scene, clips: g.animations };
      }),
    );
  }
  return cache.get(url);
}

// A copy to place, its feet at its origin, facing +z (as the downloads were
// made: scripts/sketchfab-avengers.mjs). `fade`: seconds to cross from one
// clip to the next.
export function person(template, { fade = 0.22 } = {}) {
  const model = hasSkin(template.scene) ? cloneSkinned(template.scene) : template.scene.clone(true);
  const root = new THREE.Group();
  root.add(model);
  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  for (const clip of template.clips) actions[clip.name] = mixer.clipAction(clip);
  let current = null;
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model, true);
  return {
    root,
    model,
    actions,
    height: box.max.y - box.min.y,
    // play a clip (crossing over from the one playing); `speed` its pace,
    // `loop` false to play it once and hold the last frame, `from` where to start
    play(name, { speed = 1, loop = true, from = 0 } = {}) {
      const a = actions[name];
      if (!a) return false;
      a.timeScale = speed;
      if (current === a) return true;
      a.reset();
      a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      a.clampWhenFinished = !loop;
      a.time = from;
      a.enabled = true;
      a.setEffectiveWeight(1);
      a.play();
      if (current) a.crossFadeFrom(current, fade, false);
      current = a;
      return true;
    },
    get playing() {
      return current?.getClip().name ?? null;
    },
    update: (dt) => mixer.update(dt),
    bone: (name) => model.getObjectByName(name),
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
    },
  };
}

function hasSkin(root) {
  let skin = false;
  root.traverse((o) => {
    if (o.isSkinnedMesh) skin = true;
  });
  return skin;
}
