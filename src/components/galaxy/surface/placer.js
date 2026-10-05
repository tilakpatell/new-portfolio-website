// Putting things on a world: a kind (a vaporator, a sandcrawler, an Ewok
// hut) at a spot, turned and scaled, stood on the ground there, and made
// solid where it's solid. A kind with a model (catalog/*.js, from
// Sketchfab) is that model; one without (or whose model won't load) is
// built in code (props/*.js); a kind that's neither is left out. Scattered
// kinds (rocks by the hundred, palms, huts) are drawn instanced: one draw
// for all of them.
//
// createPlacer({ parent, kit, world, warm }) → { put(spec), scatter(kind,
// items, opts), update(t, dt), ready (a promise: everything asked for so far
// is in), dispose() }
//   spec: { kind, at: [x, z], yaw, pitch, roll (radians: a walker on its
//   side), scale, y (over the ground), sink (into it), abs (y is the height
//   itself, not over the ground), solid (false: walk through it; or { r } /
//   { box: [hw, hd] } in place of its own), model (false: its build, even
//   where there's a model), opts (for a built one) }

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { SURFACE_MODELS, surfaceUrl } from './catalog';
import { PROPS, SCATTER } from './props';

let loader = null;
const getLoader = () => (loader ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder));
const cache = new Map(); // url → promise of the gltf (shared by every world, while the page is up)
export function loadGlb(url) {
  if (!cache.has(url))
    cache.set(
      url,
      getLoader()
        .loadAsync(url)
        .catch(() => {
          cache.delete(url);
          return null;
        }),
    );
  return cache.get(url);
}
export const hasModel = (kind) => Boolean(SURFACE_MODELS[kind]);

// the model, ready to place: shadows on, its maps sharp at a slant
function prepared(gltf) {
  const root = gltf.scene;
  if (!root.userData.prepared) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) for (const t of [m.map, m.normalMap]) if (t) t.anisotropy = 4;
    });
    root.userData.prepared = true;
  }
  return root;
}
export const cloneModel = (gltf) => {
  const root = prepared(gltf);
  let skinned = false;
  root.traverse((o) => (skinned ||= o.isSkinnedMesh));
  return skinned ? cloneSkinned(root) : root.clone();
};

// a solid in the world from one in the thing's own frame
function addSolid(world, s, at, yaw, scale, top) {
  const c = Math.cos(yaw);
  const sn = Math.sin(yaw);
  const tx = (x, z) => [at[0] + (x * c + z * sn) * scale, at[2] + (-x * sn + z * c) * scale];
  const opt = { top: s.top != null ? at[1] + s.top * scale : top };
  if (s.circle) {
    const [x, z] = tx(s.circle[0], s.circle[1]);
    world.solids.circle(x, z, s.circle[2] * scale, opt);
  } else if (s.box) {
    const [x, z] = tx(s.box[0], s.box[1]);
    world.solids.box(x, z, s.box[2] * scale, s.box[3] * scale, yaw + (s.box[4] ?? 0), opt);
  }
}

export function createPlacer({ parent, kit, world, warm = (o) => Promise.resolve(o) }) {
  const group = new THREE.Group();
  group.name = 'things';
  parent.add(group);
  const updates = [];
  const pending = [];
  let dead = false;

  const groundY = (x, z) => world.heightAt(x, z);
  const spot = (spec) => {
    const [x, z] = spec.at;
    return [x, (spec.abs ? 0 : groundY(x, z)) + (spec.y ?? 0) - (spec.sink ?? 0), z];
  };

  // a built one
  const build = (spec, at) => {
    const make = PROPS[spec.kind];
    if (!make) return null;
    const made = make(kit, spec.opts ?? {});
    const o = made.object;
    o.position.set(...at);
    o.rotation.set(spec.pitch ?? 0, spec.yaw ?? 0, spec.roll ?? 0, 'YXZ');
    o.scale.setScalar(spec.scale ?? 1);
    group.add(o);
    const yaw = spec.yaw ?? 0;
    const k = spec.scale ?? 1;
    if (spec.solid !== false) for (const s of made.solids ?? []) addSolid(world, s, at, yaw, k, null);
    // its floors, turned and scaled with it
    for (const f of made.floors ?? []) {
      const c = Math.cos(yaw);
      const sn = Math.sin(yaw);
      world.floors.push({ ...f, x: at[0] + (f.x * c + f.z * sn) * k, z: at[2] + (-f.x * sn + f.z * c) * k, y: at[1] + f.y * k, r: f.r != null ? f.r * k : undefined, hw: f.hw != null ? f.hw * k : undefined, hd: f.hd != null ? f.hd * k : undefined, yaw: f.r != null ? undefined : (f.yaw ?? 0) + yaw });
    }
    if (made.update) updates.push(made.update);
    return o;
  };

  // a model's own footprint, from its box: a circle for something small, a
  // box (a little inside its edges) for anything bigger
  const footprint = (o, spec, at) => {
    if (spec.solid === false) return;
    const yaw = spec.yaw ?? 0;
    if (spec.solid?.r) return world.solids.circle(at[0], at[2], spec.solid.r);
    if (spec.solid?.box) return addSolid(world, { box: [0, 0, ...spec.solid.box] }, at, yaw, 1, null);
    // (its box in its own frame: turned back square for the measuring)
    o.rotation.y = 0;
    o.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(o);
    o.rotation.y = yaw;
    o.updateMatrixWorld(true);
    const size = box.getSize(new THREE.Vector3());
    const w = size.x / 2;
    const d = size.z / 2;
    if (Math.max(w, d) < 1.6) world.solids.circle(at[0], at[2], Math.min(w, d) * 0.8, { top: size.y < 0.8 ? at[1] + size.y : null });
    else world.solids.box(at[0], at[2], w * 0.85, d * 0.85, yaw, { top: size.y < 1 ? at[1] + size.y : null });
  };

  return {
    group,
    // one thing; resolves to its object (or null)
    put(spec) {
      const at = spot(spec);
      if (hasModel(spec.kind) && spec.model !== false) {
        const p = loadGlb(surfaceUrl(spec.kind))
          .then((gltf) => {
            if (dead) return null;
            if (!gltf) return build(spec, at);
            const o = cloneModel(gltf);
            o.position.set(...at);
            o.rotation.set(spec.pitch ?? 0, spec.yaw ?? 0, spec.roll ?? 0, 'YXZ');
            o.scale.setScalar(spec.scale ?? 1);
            group.add(o);
            footprint(o, spec, at);
            return warm(o).then(() => o);
          })
          .catch(() => null);
        pending.push(p);
        return p;
      }
      return Promise.resolve(build(spec, at));
    },
    // many of one kind: items [{ at: [x, z], yaw, scale, y }]; drawn instanced
    scatter(kind, items, { opts = {}, solid = true, model = true } = {}) {
      if (!items.length) return Promise.resolve(null);
      const mats = items.map((it) => {
        const at = spot({ ...it });
        const s = it.scale ?? 1;
        return { at, s, yaw: it.yaw ?? 0, m: new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.yaw ?? 0), new THREE.Vector3(s, s * (it.stretch ?? 1), s)) };
      });
      const instance = (parts, radius) => {
        for (const p of parts) {
          const mesh = new THREE.InstancedMesh(p.geometry, p.material, mats.length);
          mats.forEach((x, i) => mesh.setMatrixAt(i, p.local ? x.m.clone().multiply(p.local) : x.m));
          mesh.castShadow = p.shadow !== false;
          mesh.receiveShadow = true;
          mesh.computeBoundingSphere();
          group.add(mesh);
        }
        if (solid && radius) for (const x of mats) world.solids.circle(x.at[0], x.at[2], radius * x.s);
      };
      if (model && hasModel(kind)) {
        const p = loadGlb(surfaceUrl(kind)).then((gltf) => {
          if (dead) return null;
          if (!gltf) {
            const made = SCATTER[kind]?.(kit, opts);
            if (made) instance(made.parts, made.radius);
            return null;
          }
          const root = prepared(gltf);
          root.updateMatrixWorld(true);
          const parts = [];
          root.traverse((o) => {
            if (o.isMesh && !o.isSkinnedMesh) parts.push({ geometry: o.geometry, material: o.material, local: o.matrixWorld.clone() });
          });
          const box = new THREE.Box3().setFromObject(root);
          const size = box.getSize(new THREE.Vector3());
          instance(parts, typeof solid === 'number' ? solid : Math.min(size.x, size.z) * 0.35);
          return null;
        });
        pending.push(p);
        return p;
      }
      const made = SCATTER[kind]?.(kit, opts) ?? (PROPS[kind] ? { parts: partsOf(PROPS[kind](kit, opts)), radius: opts.radius ?? 0.5 } : null);
      if (made) instance(made.parts, typeof solid === 'number' ? solid : made.radius);
      return Promise.resolve(null);
    },
    get ready() {
      return Promise.all(pending);
    },
    update(t, dt) {
      for (const u of updates) u(t, dt);
    },
    dispose() {
      dead = true;
      group.removeFromParent();
    },
  };
}

// a built prop's meshes as instancing parts (for scattering a built kind)
function partsOf(made) {
  const out = [];
  made.object.updateMatrixWorld(true);
  made.object.traverse((o) => {
    if (o.isMesh) out.push({ geometry: o.geometry, material: o.material, local: o.matrixWorld.clone(), shadow: o.castShadow });
  });
  return out;
}
