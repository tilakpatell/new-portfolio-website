// The ships that are models rather than built: the site owner's Meshy X-wing
// and Slave I, and the Star Wars models they sent for the map: a TIE
// interceptor, a Star Destroyer and a Corellian corvette (the Tantive IV)
// (scripts/build-universe.py cuts them down for it). Each is loaded the
// first time it's wanted, then copied, sharing its geometry and textures,
// for every ship of its kind; until it's come, the kind is built
// (trafficModels.js: the X-wing, the interceptor, the Star Destroyer and the
// corvette all have built stand-ins; Slave I has none and waits). Their
// engines and lights are turned up so they glow like the built ones.
// Traffic, hunters and the director's set pieces share one fleet.
//
// createFleet() → { want(kinds), loaded(kind), has(kind), make(kind) → model, dispose() }
// A model is { group, size (its box, its biggest side 1), model (true for a
// copy of a loaded one), update(t), dispose() }, nose along +z, as
// buildTraffic's are.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { buildTraffic } from './trafficModels';

// which way each one's nose points as it comes (turned to +z), and whether
// there's a built one to fly until it's here
export const GLB = {
  xwing: { url: '/models/universe/xwing-traffic.glb', nose: 0, built: true },
  slave1: { url: '/models/universe/slave1.glb', nose: 0, built: false },
  interceptor: { url: '/models/universe/tie-interceptor.glb', nose: 0, built: true },
  destroyer: { url: '/models/universe/star-destroyer.glb', nose: Math.PI, built: true },
  corvette: { url: '/models/universe/cr90.glb', nose: 0, built: true },
};

export function createFleet() {
  const templates = {};
  const loading = new Set();
  let dead = false;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  return {
    // start loading these (the ones that are models), if they aren't yet
    want(list) {
      for (const kind of list) {
        const def = GLB[kind];
        if (!def || loading.has(kind)) continue;
        loading.add(kind);
        loader
          .loadAsync(def.url)
          .then((gltf) => {
            const root = gltf.scene;
            if (dead) return;
            // centred, nose to +z, its biggest side 1 long
            const turn = new THREE.Group();
            turn.rotation.y = def.nose;
            turn.add(root);
            const box = new THREE.Box3().setFromObject(turn);
            root.position.sub(box.getCenter(new THREE.Vector3()).applyAxisAngle(new THREE.Vector3(0, 1, 0), -def.nose));
            const holder = new THREE.Group();
            holder.add(turn);
            const size = box.getSize(new THREE.Vector3());
            holder.scale.setScalar(1 / Math.max(size.x, size.y, size.z));
            root.traverse((o) => {
              if (!o.isMesh || !o.material) return;
              const m = o.material;
              if ('roughness' in m) m.roughness = Math.min(m.roughness ?? 1, 0.7);
              // engines and lights: hot enough to bloom
              if (/glow|light|engine/i.test(m.name) && m.emissive) {
                if (m.emissive.getHex() === 0) m.emissive.copy(m.color);
                m.emissiveIntensity = 3.2;
              } else if (m.emissiveMap) m.emissiveIntensity = 2.4;
            });
            templates[kind] = { holder, size: size.divideScalar(Math.max(size.x, size.y, size.z)) };
          })
          .catch(() => {});
      }
    },
    // its model is here
    loaded: (kind) => Boolean(templates[kind]),
    // it can fly now (it's here, or it has a built stand-in, or it was never a model)
    has: (kind) => !GLB[kind] || Boolean(templates[kind]) || GLB[kind].built,
    make(kind) {
      const t = templates[kind];
      if (!t) return buildTraffic(kind);
      const group = new THREE.Group();
      group.add(t.holder.clone());
      return { group, size: t.size.clone(), model: true, update() {}, dispose() {} }; // shares its template's geometry and textures
    },
    dispose() {
      dead = true;
      // the models' own geometry and textures (the copies only shared them)
      for (const t of Object.values(templates)) {
        t.holder.traverse((o) => {
          if (!o.isMesh) return;
          o.geometry.dispose();
          for (const value of Object.values(o.material)) if (value?.isTexture) value.dispose();
          o.material.dispose();
        });
      }
    },
  };
}
