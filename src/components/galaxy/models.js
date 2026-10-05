// The galaxy's ships and stations as the set pieces place them: the models
// that load (the Star Destroyer, the corvette, the X-wing, the interceptor,
// Slave I, the Republic's Venator, the Millennium Falcon, the Death Star) and
// the ones built in code (galaxy/fleet.js: everything else). Each kind is
// made once, its first copy kept as a template, and every ship of that kind
// after it is a copy sharing its geometry and materials (so the fourteen
// Star Destroyers rising over Exegol cost one build). A kind that loads
// flies as its built stand-in until it's here (where it has one), and a slot
// swaps over the moment it is.
//
// createModels({ prepare(object) → Promise }) → { slot(kind, size, { tint }) → slot,
//   want(kinds), update(t), dispose() }
// slot: { holder (place it, turn it), kind, size, ready }; every model sits in
// its holder centred, nose along +z, +y up, its biggest side `size` long.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLB } from '../universe/glbFleet';
import { BUILT_KINDS } from '../universe/trafficModels';
import { GALAXY_KINDS, buildGalaxyShip } from './fleet';

// which way each loaded model's nose points as it comes (turned to +z)
export const MODELS = {
  ...Object.fromEntries(Object.entries(GLB).map(([k, d]) => [k, { url: d.url, nose: d.nose }])),
  venator: { url: '/models/universe/venator.glb', nose: Math.PI / 2 },
  falcon: { url: '/models/universe/falcon.glb', nose: -Math.PI / 2 },
  deathstar: { url: '/models/universe/death-star.glb', nose: 0 },
};
const BUILT = new Set([...BUILT_KINDS, ...GALAXY_KINDS]);

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

// a darker paint for the First Order's and the wrecks' copies
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
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const loaded = new Map(); // kind → { holder, size } (a loaded model, normalised)
  const loading = new Map(); // kind → Promise
  const built = new Map(); // kind → { model (buildGalaxyShip's), holder, size }
  const slots = [];
  const owned = []; // tinted materials, ours to free
  let dead = false;

  const load = (kind) => {
    const def = MODELS[kind];
    if (!def || loading.has(kind)) return loading.get(kind);
    const p = loader
      .loadAsync(def.url)
      .then(async (gltf) => {
        if (dead) return;
        tune(gltf.scene);
        const n = normalise(gltf.scene, def.nose);
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
  // built stand-in (if there is one; else nothing yet)
  function fill(s) {
    const real = loaded.get(s.kind);
    const src = real ?? template(s.kind);
    if (!src) return;
    if (s.model) s.inner.remove(s.model);
    const copy = src.holder.clone(true);
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
