// The galaxy's ships and stations as the set pieces place them: the models
// that load (the Star Destroyer, the corvette, the X-wing, the interceptor,
// Slave I, the Republic's Venator, the Millennium Falcon, the Death Star, and
// the galaxy's own from Sketchfab: the Rebellion's cruisers and fighters, the
// Executor, the Separatists' and the Republic's ships) and the ones built in
// code (galaxy/fleet.js: everything else). Each kind is made once, its first
// copy kept as a template, and every ship of that kind after it is a copy
// sharing its geometry and materials (so the four Star Destroyers over Hoth
// cost one build). A kind that loads
// flies as its built stand-in until it's here (its own, or STAND_IN's where
// it has none), and a slot swaps over the moment it is.
//
// createModels({ prepare(object) → Promise }) → { slot(kind, size, { tint }) → slot,
//   want(kinds), update(t), dispose() }
// slot: { holder (place it, turn it), kind, size, ready }; every model sits in
// its holder centred, nose along +z, +y up, its biggest side `size` long.

import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { cloneScene, loadGLTF } from '../../lib/three/gltfCache';
import { GLB } from '../universe/glbFleet';
import { BUILT_KINDS } from '../universe/trafficModels';
import { GALAXY_KINDS, buildGalaxyShip } from './fleet';

// which way each loaded model's nose points as it comes (turned to +z): the
// universe's, and the galaxy's own from Sketchfab (scripts/sketchfab-galaxy.mjs),
// which take over from the ones built in code
export const MODELS = {
  ...Object.fromEntries(Object.entries(GLB).map(([k, d]) => [k, { url: d.url, nose: d.nose }])),
  venator: { url: '/models/universe/venator.glb', nose: Math.PI / 2 },
  falcon: { url: '/models/universe/falcon.glb', nose: -Math.PI / 2 },
  deathstar: { url: '/models/universe/death-star.glb', nose: 0 },
  moncal: { url: '/models/galaxy/moncal.glb', nose: 0 },
  nebulon: { url: '/models/galaxy/nebulon.glb', nose: 0 },
  awing: { url: '/models/galaxy/awing.glb', nose: 0 },
  ywing: { url: '/models/galaxy/ywing.glb', nose: 0 },
  bwing: { url: '/models/galaxy/bwing.glb', nose: 0 },
  uwing: { url: '/models/galaxy/uwing.glb', nose: Math.PI },
  executor: { url: '/models/galaxy/executor.glb', nose: 0 },
  lucrehulk: { url: '/models/galaxy/lucrehulk.glb', nose: 0 },
  coreship: { url: '/models/galaxy/coreship.glb', nose: 0 },
  vulture: { url: '/models/galaxy/vulture.glb', nose: Math.PI },
  trifighter: { url: '/models/galaxy/trifighter.glb', nose: 0 },
  acclamator: { url: '/models/galaxy/acclamator.glb', nose: 0 },
  delta7: { url: '/models/galaxy/delta7.glb', nose: 0 },
  arc170: { url: '/models/galaxy/arc170.glb', nose: Math.PI },
  n1: { url: '/models/galaxy/n1.glb', nose: 0 },
};
const BUILT = new Set([...BUILT_KINDS, ...GALAXY_KINDS]);

// a kind with no built version of its own flies as another's till its model
// loads (else its slot would be empty, and the ship would pop in): the
// Venator as a Star Destroyer, Slave I and the Falcon as a freighter. The
// Death Star has none here: the world puts a sphere of its own in its place.
export const STAND_IN = { venator: 'destroyer', slave1: 'freighter', falcon: 'freighter' };

// the models the hunters fly (universe/glbFleet.js flies them, the
// universe's TIEs and the galaxy's droids, each built until it's here)
export const HUNTER_GLB = {
  ...GLB,
  ...Object.fromEntries(['vulture', 'trifighter'].map((k) => [k, { ...MODELS[k], built: true }])),
};

// a model's materials tuned to the scene's light: engines and lights hot
// enough to bloom, nothing mirror-shiny
function tune(root) {
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if ('roughness' in m) m.roughness = Math.min(Math.max(m.roughness ?? 1, 0.35), 0.75);
      if (/glow|light|engine/i.test(m.name) && m.emissive) {
        if (m.emissive.getHex() === 0) m.emissive.copy(m.color);
        m.emissiveIntensity = 3.2;
      } else if (m.emissiveMap) m.emissiveIntensity = 2.2;
    }
  });
}

// centred, nose to +z (a turn of `nose` about y), its biggest side 1 long
function normalise(root, nose = 0) {
  const turn = new THREE.Group();
  turn.rotation.y = nose;
  turn.add(root);
  turn.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(turn, true);
  const size = box.getSize(new THREE.Vector3());
  const k = 1 / Math.max(size.x, size.y, size.z, 1e-6);
  const holder = new THREE.Group();
  holder.add(turn);
  turn.position.copy(box.getCenter(new THREE.Vector3())).multiplyScalar(-1);
  holder.scale.setScalar(k);
  return { holder, size: size.multiplyScalar(k) };
}

// a copy in another paint (a slot's `tint`), darker or coloured
function tinted(root, color) {
  const c = new THREE.Color(color);
  const swapped = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const swap = (m) => {
      if (!swapped.has(m)) {
        const n = m.clone();
        if (n.color && n.toneMapped !== false && !/glow|light|engine/i.test(n.name)) n.color.multiply(c);
        swapped.set(m, n);
      }
      return swapped.get(m);
    };
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
  });
  return [...swapped.values()];
}

export function createModels({ prepare = null } = {}) {
  const loaded = new Map(); // kind → { holder, size } (a loaded model, normalised)
  const loading = new Map(); // kind → Promise
  const built = new Map(); // kind → { model (buildGalaxyShip's), holder, size }
  const slots = [];
  const owned = []; // tinted materials, ours to free
  let dead = false;

  const load = (kind) => {
    const def = MODELS[kind];
    if (!def || loading.has(kind)) return loading.get(kind);
    // (the parse is the page's, shared with the fleets and the planets' models: this
    // works on a copy of it, which tune and normalise change as they like)
    const p = loadGLTF(def.url)
      .then((gltf) => (gltf && !dead ? cloneScene(gltf) : null))
      .then(async (root) => {
        if (!root) return;
        tune(root);
        const n = normalise(root, def.nose);
        // (a skinned one's copies need bones of their own: SkeletonUtils)
        root.traverse((o) => o.isSkinnedMesh && (n.skinned = true));
        if (prepare) await prepare(n.holder);
        if (dead) return;
        loaded.set(kind, n);
        for (const s of slots) if (s.kind === kind && !s.real) fill(s);
      })
      .catch(() => {});
    loading.set(kind, p);
    return p;
  };

  const template = (kind) => {
    if (built.has(kind)) return built.get(kind);
    if (!BUILT.has(kind)) return null;
    const model = buildGalaxyShip(kind);
    // (buildGalaxyShip makes it 1 long in z; here everything's 1 at its biggest)
    const s = model.size;
    const k = 1 / Math.max(s.x, s.y, s.z, 1e-6);
    const holder = new THREE.Group();
    holder.add(model.group);
    holder.scale.setScalar(k);
    const t = { model, holder, size: s.clone().multiplyScalar(k) };
    built.set(kind, t);
    return t;
  };

  // a slot's model: the loaded one's copy if it's here, else a copy of the
  // built stand-in (the kind's own built version, or STAND_IN's; else nothing yet)
  function fill(s) {
    const real = loaded.get(s.kind);
    const src = real ?? template(s.kind) ?? template(STAND_IN[s.kind]);
    if (!src) return;
    if (s.model) s.inner.remove(s.model);
    const copy = src.skinned ? cloneSkinned(src.holder) : src.holder.clone(true);
    if (s.tint) owned.push(...tinted(copy, s.tint));
    s.model = copy;
    s.real = Boolean(real);
    s.ready = true;
    s.inner.add(copy);
    if (prepare && !real) {
      copy.visible = false;
      prepare(copy).then(() => (copy.visible = true));
    }
  }

  return {
    // a ship of `kind`, its biggest side `size` long, in a holder to place
    slot(kind, size, { tint = null } = {}) {
      const holder = new THREE.Group();
      const inner = new THREE.Group();
      inner.scale.setScalar(size);
      holder.add(inner);
      const s = { kind, size, holder, inner, model: null, real: false, ready: false, tint };
      slots.push(s);
      if (MODELS[kind]) load(kind);
      fill(s);
      return s;
    },
    // start loading these now (before a slot wants them)
    want(kinds) {
      for (const k of kinds) if (MODELS[k]) load(k);
    },
    loaded: (kind) => loaded.has(kind),
    // let a slot go (its holder off the scene; the shared parts stay)
    drop(s) {
      s.holder.removeFromParent();
      const i = slots.indexOf(s);
      if (i >= 0) slots.splice(i, 1);
    },
    // the built ones' own motion (blinking lights, engine flicker): once per
    // kind, its copies share the materials
    update(t) {
      for (const b of built.values()) b.model.update(t);
    },
    dispose() {
      dead = true;
      for (const s of slots) s.holder.removeFromParent();
      slots.length = 0;
      for (const b of built.values()) {
        b.model.dispose();
        b.holder.traverse((o) => o.isMesh && o.geometry.dispose());
      }
      built.clear();
      // (a loaded model's geometry and textures are the page's cached ones, shared with
      // the fleets: freed with this scene, uploaded again if something draws them later)
      for (const l of loaded.values()) {
        l.holder.traverse((o) => {
          if (!o.isMesh) return;
          o.geometry.dispose();
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
            m.dispose();
          }
        });
      }
      loaded.clear();
      for (const m of owned) m.dispose();
    },
  };
}
