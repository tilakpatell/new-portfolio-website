// Furnishing a landing: the planet's things and scatter (landings.js),
// built by its own file (./<id>.js, loaded now), stood on the sphere round
// where the ship's come down, and their solids handed to walk() as circles
// along the ground (foot.js's solidsOn). Everything's laid out from the
// planet's own seed, so it's the same for every pilot who lands there; a
// pilot coming down beside a friend is handed the friend's frame.
//
// furnish({ id, landing, frame, R, small, renderer, warm }) →
//   { group, solids, update(t, dt), ready, dispose() }
//   group  in the planet's space (footScene's root: its middle at the origin)
//   solids grows as things arrive ([{ n, r }])
//   ready  a promise, once everything that's coming has come
//
// A planet's file exports PROPS (things: (kit, opts) → { object, solids?,
// update? }, or a promise of one), SCATTER ((kit, opts) → { parts, radius }),
// and may export prepare(kit) for what its builders share. The kit is the
// galaxy surface's (galaxy/surface/kit.js: materials and parts baked into
// meshes), with `renderer` and `models` (./models.js) on it.

import * as THREE from 'three';
import { createKit } from '../../galaxy/surface/kit';
import { rng } from '../../galaxy/surface/noise';
import { METRE, facingAlong, place, solidsOn, vec } from '../foot';
import { SCATTER_MAX, scatterSpots, seedOf } from './landings';
import { createModels } from './models';

// each planet's builders, loaded when you land there
const PLANETS = {
  middleearth: () => import('./middleearth.js'),
  breakingbad: () => import('./breakingbad.js'),
  rickmorty: () => import('./rickmorty.js'),
  transformers: () => import('./transformers.js'),
  gaming: () => import('./gaming.js'),
  marvel: () => import('./marvel.js'),
  office: () => import('./office.js'),
};
export const furnished = (id) => Boolean(PLANETS[id]);
// (a thing that won't build is just missing; in development, say so)
const oops = (what) => (err) => {
  if (import.meta.env?.DEV) console.warn(`landing: ${what}`, err);
};

const X = new THREE.Vector3();
const Y = new THREE.Vector3();
const Z = new THREE.Vector3();
const P = new THREE.Vector3();
const Q = new THREE.Quaternion();
const S = new THREE.Vector3();
const M = new THREE.Matrix4();
const tint = new THREE.Color();

// stood at `spot` ({ n, f }) on a sphere of radius R, `sink` into it (map
// units), scaled by k: the matrix, its +y out of the ground, +z along f
function standMatrix(spot, R, sink, k, out = new THREE.Matrix4()) {
  Y.set(...spot.n);
  Z.set(...spot.f);
  X.crossVectors(Y, Z);
  out.makeBasis(X, Y, Z);
  Q.setFromRotationMatrix(out);
  P.copy(Y).multiplyScalar(R - sink);
  return out.compose(P, Q, S.setScalar(k));
}

// bend a thing (in metres, standing on y = 0) down to a sphere of radius Rm
// metres under its middle: each vertex dropped by how far the ground's
// fallen away there
function bend(object, Rm) {
  object.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(object.matrixWorld).invert();
  const rel = new THREE.Matrix4();
  const back = new THREE.Matrix4();
  const v = new THREE.Vector3();
  object.traverse((o) => {
    if (!o.isMesh) return;
    rel.copy(inv).multiply(o.matrixWorld);
    back.copy(rel).invert();
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(rel);
      v.y -= (v.x * v.x + v.z * v.z) / (2 * Rm);
      v.applyMatrix4(back);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    p.needsUpdate = true;
    o.geometry.computeVertexNormals();
    o.geometry.computeBoundingSphere();
  });
  return object;
}

// a thing's lights, brought down to its size: a light's reach is in the
// map's units whatever it's in, and (falling off with the square of the
// distance) so is its strength
function scaleLights(object, k) {
  object.traverse((o) => {
    if (!o.isLight) return;
    if (o.distance) o.distance *= k;
    if (o.isPointLight || o.isSpotLight) o.intensity *= k * k;
  });
}

// Free what a landing made: every geometry, material and texture but the
// shared models' (the loader's cache keeps those), and every instanced
// mesh's own buffers
function release(root) {
  const seen = new Set();
  const free = (x) => {
    if (!x || seen.has(x)) return;
    seen.add(x);
    x.dispose?.();
  };
  const walk = (o, shared) => {
    shared ||= Boolean(o.userData.shared);
    if (o.isInstancedMesh) o.dispose();
    if (!shared) {
      free(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
        for (const v of Object.values(m)) if (v?.isTexture) free(v);
        if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u?.value?.isTexture) free(u.value);
        free(m);
      }
    }
    for (const c of o.children) walk(c, shared);
  };
  walk(root, false);
}

// a built thing's meshes as instancing parts (scattering a built kind, or a model)
function partsOf(object) {
  const out = [];
  object.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(object.matrixWorld).invert();
  object.traverse((o) => {
    if (o.isMesh && !o.isSkinnedMesh) out.push({ geometry: o.geometry, material: o.material, local: inv.clone().multiply(o.matrixWorld) });
  });
  return out;
}

export function furnish({ id, landing, frame, R, small = false, renderer = null, warm = null }) {
  const group = new THREE.Group();
  group.name = `landing-${id}`;
  const solids = [];
  const updates = [];
  let dead = false;
  const kit = createKit({ seed: seedOf(id) % 1000 });
  const models = createModels({ renderer });
  // (Rm: the planet's radius in metres; bend: a long flat thing, a road,
  // bent down to the curve of the ground under it)
  const specs = landing.models ?? {};
  // (specs: the landing's models, for a builder that stands one on something of its own)
  Object.assign(kit, { renderer, models, specs, Rm: R / METRE, bend: (object) => bend(object, R / METRE) });
  // the curve of the ground under something r metres across: how far to sink it so its edges don't float
  const sinkFor = (r) => (0.25 * (r * METRE) ** 2) / R;
  const add = async (object) => {
    if (dead) return false;
    if (warm) await warm(object).catch(() => {});
    if (dead) return false;
    group.add(object);
    return true;
  };

  // where a thing stands: so far ahead and aside, facing the ship (or as its yaw says)
  const spotOf = (t) => {
    const [x, z] = t.at;
    if (t.face === false) return place(frame, x, z, R, t.yaw ?? 0);
    const s = place(frame, x, z, R);
    const toward = vec.add(frame.n, s.n, -1);
    const f = Math.hypot(x, z) > 0.5 ? facingAlong(s.n, toward) : s.f;
    return place({ n: s.n, f }, 0, 0, R, t.yaw ?? 0);
  };

  const thing = async (planet, t) => {
    const spec = specs[t.kind];
    let made = null;
    if (spec) {
      const object = await models.get(spec);
      made = object && { object, solids: t.solid === false || !t.r ? [] : [{ circle: [0, 0, t.r * 0.8] }] };
    } else if (planet.PROPS?.[t.kind]) made = await planet.PROPS[t.kind](kit, t.opts ?? {});
    if (!made?.object || dead) return;
    const spot = spotOf(t);
    const o = made.object;
    scaleLights(o, METRE);
    o.matrixAutoUpdate = false;
    standMatrix(spot, R, sinkFor(t.r ?? 0), METRE, o.matrix);
    o.matrixWorldNeedsUpdate = true;
    if (!(await add(o))) return;
    if (t.solid !== false) solids.push(...solidsOn(spot, made.solids, R));
    if (made.update) updates.push(made.update);
  };

  const scatter = async (planet, entry, rand) => {
    const spec = specs[entry.kind];
    let parts = null;
    let reach = 0.5;
    let tints = null;
    let shared = false; // (a model's: its geometry and materials are the loader's cache's)
    if (spec) {
      const object = await models.get(spec);
      if (!object) return;
      parts = partsOf(object);
      shared = true;
      reach = object.userData.footprint * 0.7;
    } else if (planet.SCATTER?.[entry.kind]) {
      const made = planet.SCATTER[entry.kind](kit, entry.opts ?? {});
      parts = made.parts;
      tints = made.tints ?? null;
      reach = made.radius ?? 0.4;
      if (made.radius === null) entry = { ...entry, solid: false };
    } else if (planet.PROPS?.[entry.kind]) {
      const made = await planet.PROPS[entry.kind](kit, entry.opts ?? {});
      parts = partsOf(made.object);
      reach = entry.reach ?? 0.5;
    }
    if (!parts?.length || dead) return;
    const n = Math.min(SCATTER_MAX, Math.round(entry.n * (small ? 0.5 : 1)));
    const spots = scatterSpots(entry, landing.things ?? [], rand, { n, reach });
    if (!spots.length) return;
    const mats = spots.map((p) => {
      const spot = place(frame, p.x, p.z, R, p.yaw);
      return { spot, m: standMatrix(spot, R, 0, METRE * p.s), r: reach * p.s };
    });
    const meshes = parts.map((part) => {
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, mats.length);
      mats.forEach((x, i) => mesh.setMatrixAt(i, part.local ? M.copy(x.m).multiply(part.local) : x.m));
      mesh.instanceMatrix.needsUpdate = true;
      // (each its own colour, from the builder's: where its material takes one)
      if (tints) mats.forEach((x, i) => mesh.setColorAt(i, tint.set(tints[(i * 7 + 3) % tints.length])));
      mesh.computeBoundingSphere();
      return mesh;
    });
    const holder = new THREE.Group();
    holder.name = `scatter-${entry.kind}`;
    holder.userData.shared = shared;
    holder.add(...meshes);
    if (!(await add(holder))) return;
    if (entry.solid !== false) for (const x of mats) solids.push({ n: x.spot.n, r: x.r * METRE });
  };

  const ready = (PLANETS[id]?.() ?? Promise.resolve({}))
    .then(async (planet) => {
      if (dead) return;
      planet.prepare?.(kit);
      // (phones: not the furthest things; each scatter its own seed, so the
      // layout doesn't hang on which model loads first)
      const things = (landing.things ?? []).filter((t) => !small || Math.hypot(...t.at) < 75);
      await Promise.all([...things.map((t) => thing(planet, t).catch(oops(t.kind))), ...(landing.scatter ?? []).map((e, i) => scatter(planet, e, rng(seedOf(id) + i * 7919)).catch(oops(e.kind)))]);
    })
    .catch(oops(id));

  return {
    group,
    solids,
    ready,
    update(t, dt) {
      for (const u of updates) u(t, dt);
    },
    dispose() {
      dead = true;
      group.removeFromParent();
      release(group);
      kit.dispose();
      updates.length = 0;
      solids.length = 0;
    },
  };
}
