// Furnishing a landing: the planet's things and scatter (landings.js),
// built by its own file (./<id>.js, loaded now), stood on the sphere round
// where the ship's come down, and their solids handed to walk() as circles
// along the ground (foot.js's solidsOn). Everything's laid out from the
// planet's own seed, so it's the same for every pilot who lands there; a
// pilot coming down beside a friend is handed the friend's frame.
//
// furnish({ id, landing, frame, R, small, reduced, renderer, physical }) →
//   { group, solids, spots, lights, bodies, put(entry, position, quaternion),
//   update(t, dt, ctx?), ready, open(), dispose() }
//   group  in the planet's space (footScene's root: its middle at the origin),
//          built out of sight: footScene readies it all at once (its
//          pictures sent, its shaders made) and shows it, rather than each
//          thing being readied on its own and popping in as it was
//   solids the things' solids, once it's open ([{ n, r }])
//   lights grows too: the things' own lights, each kept where it is but out
//          of the scene's count, for footScene to show through the map's
//          few (./lamps.js: a light put in as you land made every lit
//          shader on the map again)
//   spots  grows too: where something answers you, the things with a door
//          (G there opens the planet's page) or a line to say ([{ n, r,
//          label?, say? }], r how near you have to be, map units)
//   bodies with `physical`, what can be knocked about (./bodies.js names
//          which; a model made with physical nodes is its own,
//          lib/three/colliders.js), once it's open: [{ object | meshes + index + locals (a
//          scatter's instance: its cell's meshes, and where it is among
//          them), position, quaternion, scale, box (metres, its own
//          frame), body, solids }]; their circles are in each one's own
//          solids, not in `solids`, so the walk goes into them (and shoves
//          them, ./physics.js) instead of round them; put() stands one
//          where its body has gone
//   ready  a promise, once everything that's coming has come
//   open   the things' solids, bodies and spots put in effect, once
//          they're shown (none to walk into before they can be seen)
//
// The landing's door has a beacon over it (./beacon.js: the way into the
// planet's world, seen from the ship); a landing with no door is given one.
//
// A planet's file exports PROPS (things: (kit, opts) → { object, solids?,
// update? }, or a promise of one), SCATTER ((kit, opts) → { parts, radius }),
// and may export prepare(kit) for what its builders share. The kit is the
// galaxy surface's (galaxy/surface/kit.js: materials and parts baked into
// meshes), with `renderer` and `models` (./models.js) on it.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LOOKS, createKit, loadScan, scanOf } from '../../galaxy/surface/kit';
import { loadGltf } from '../../../lib/three/gltf';
import { rng } from '../../galaxy/surface/noise';
import { METRE, facingAlong, place, solidsOn, vec } from '../foot';
import { SCATTER_MAX, scatterSpots, seedOf } from './landings';
import { createModels } from './models';
import { beaconOf } from './wayin';
import { createBeacon } from './beacon';
import { keepDark } from './lamps';
import { bodyOf } from './bodies';
import { collidersOf } from '../../../lib/three/colliders';
import { byId } from '../universes';

// each planet's builders, loaded when you land there
const PLANETS = {
  middleearth: () => import('./middleearth.js'),
  breakingbad: () => import('./breakingbad.js'),
  rickmorty: () => import('./rickmorty.js'),
  transformers: () => import('./transformers.js'),
  gaming: () => import('./gaming.js'),
  marvel: () => import('./marvel.js'),
  office: () => import('./office.js'),
  music: () => import('./music.js'),
  travel: () => import('./travel.js'),
  caribbean: () => import('./caribbean.js'),
  invincible: () => import('./invincible.js'),
  // the Rick and Morty sector's worlds, round the Citadel (universes.js's MOONS), one file between them
  gazorpazorp: () => import('./rmmoons.js'),
  squanch: () => import('./rmmoons.js'),
  birdworld: () => import('./rmmoons.js'),
  gearworld: () => import('./rmmoons.js'),
  pluto: () => import('./rmmoons.js'),
  snakeplanet: () => import('./rmmoons.js'),
  nuptia: () => import('./rmmoons.js'),
  resort: () => import('./rmmoons.js'),
  cronenberg: () => import('./rmmoons.js'),
  purge: () => import('./rmmoons.js'),
};
export const furnished = (id) => Boolean(PLANETS[id]);
// `promise`, waited for no longer than `ms` (then undefined); never rejects
export const within = (promise, ms) =>
  new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    Promise.resolve(promise).then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(undefined);
      },
    );
  });
// every model a landing may stand about (its biomes' too), each once
export const modelUrls = (landing) => [...new Set([landing?.models, ...(landing?.biomes ?? []).map((b) => b.models)].flatMap((m) => Object.values(m ?? {}).map((spec) => spec.url)))];

// A scatter's spots (scatterSpots': metres from the landing's middle) in
// cells, each drawn as instances of its own with bounds of its own, so
// what's behind you isn't drawn (one instanced mesh round the whole ring
// was always in view, half of it at your back): the spots within `inner`
// of the middle together, the rest by the way they lie from it, in
// `sectors` slices. Each cell its spots' indices, in the order they were
// laid; an empty one left out. Nothing's moved.
export function cellsOf(spots, { sectors = 8, inner = 20 } = {}) {
  if (sectors <= 1) return spots.length ? [spots.map((_, i) => i)] : [];
  const cells = Array.from({ length: sectors + 1 }, () => []);
  spots.forEach((p, i) => {
    if (Math.hypot(p.x, p.z) < inner) return cells[sectors].push(i);
    const a = (Math.atan2(p.x, p.z) + Math.PI * 2) % (Math.PI * 2);
    cells[Math.min(sectors - 1, Math.floor(a / ((Math.PI * 2) / sectors)))].push(i);
  });
  // (the middle's first, as the spots nearest are)
  return [cells[sectors], ...cells.slice(0, sectors)].filter((c) => c.length);
}

// What landing on `id` will want, fetched while the ship's still on its way
// (from the moment it's landable: scene.js), so none of it is fetched, or
// parsed, on the way down: the builders' file, the models (parsed once for
// the page: lib/three/gltf), the people's file where anyone stands about,
// and the kit's scans (loaded once for the page: lib/three/core). Nothing's
// built or drawn; each planet is asked for once.
const asked = new Set();
export function prefetch(id, landing, { renderer = null } = {}) {
  if (!PLANETS[id] || asked.has(id)) return;
  asked.add(id);
  PLANETS[id]().catch(() => asked.delete(id));
  for (const url of modelUrls(landing)) loadGltf(url, { renderer });
  if ([landing, ...(landing?.biomes ?? [])].some((l) => l?.things?.some((t) => t.kind === 'figure'))) import('./people.js').catch(() => {});
  for (const role of Object.keys(LOOKS)) if (scanOf(role)) loadScan(role);
}

// how long the things wait for the kit's scans, on the way down (the
// descent's 3.4 s): long enough for the page's own copies, or a quick
// fetch; past it they're made without, and wear them when they come
const KIT_WAIT = 1500;
// a scatter's cells (cellsOf), for a kind of more than so many triangles in all
const CELLS = { sectors: 8, inner: 20 };
const SPLIT_TRIS = 20000;
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
const X4 = new THREE.Matrix4();
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

// A thing built of many small meshes (a parking lot's cars and poles) as a
// few: its plain meshes merged into one per material, in its own frame;
// anything skinned, instanced or many-materialled is left as it is.
export function mergeStatic(object) {
  object.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(object.matrixWorld).invert();
  const by = new Map(); // material → [geometry in object space]
  const drop = [];
  object.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || Array.isArray(o.material)) return;
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!by.has(o.material)) by.set(o.material, []);
    by.get(o.material).push(g);
    drop.push(o);
  });
  for (const o of drop) {
    o.removeFromParent();
    o.geometry.dispose();
  }
  for (const [material, geos] of by) {
    const merged = mergeGeometries(geos);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = mesh.receiveShadow = true;
    object.add(mesh);
  }
  return object;
}

// a thing's own box (metres, its own frame: before it's stood anywhere)
function ownBox(object) {
  const was = object.matrix.clone();
  object.matrix.identity();
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  object.matrix.copy(was);
  object.updateMatrixWorld(true);
  return box.isEmpty() ? null : { min: box.min.toArray(), max: box.max.toArray() };
}

// the box round a scatter kind's parts, in the kind's own frame
function partsBox(parts) {
  const box = new THREE.Box3();
  const one = new THREE.Box3();
  for (const part of parts) {
    if (!part.geometry.boundingBox) part.geometry.computeBoundingBox();
    one.copy(part.geometry.boundingBox);
    if (part.local) one.applyMatrix4(part.local);
    box.union(one);
  }
  return box.isEmpty() ? null : { min: box.min.toArray(), max: box.max.toArray() };
}

// a built thing's meshes as instancing parts (scattering a built kind, or a model)
export function partsOf(object) {
  const out = [];
  object.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(object.matrixWorld).invert();
  // (a model's physical nodes, and their colliders, are never drawn: not instanced either)
  const walk = (o) => {
    if (/physical/i.test(o.name ?? '')) return;
    if (o.isMesh && !o.isSkinnedMesh) out.push({ geometry: o.geometry, material: o.material, local: inv.clone().multiply(o.matrixWorld) });
    for (const c of o.children) walk(c);
  };
  walk(object);
  return out;
}

export function furnish({ id, landing, frame, R, small = false, reduced = false, renderer = null, physical = false }) {
  const group = new THREE.Group();
  group.name = `landing-${id}`;
  group.visible = false;
  const solids = [];
  const bodies = [];
  const spots = [];
  // (what's to be walked round, knocked about and answered, held until the things are shown)
  const held = { solids: [], spots: [], bodies: [] };
  let opened = false;
  const addSolid = (...xs) => (opened ? solids : held.solids).push(...xs);
  const addSpot = (x) => (opened ? spots : held.spots).push(x);
  const addBody = (x) => (opened ? bodies : held.bodies).push(x);
  const lights = [];
  const updates = [];
  let dead = false;
  const kit = createKit({ seed: seedOf(id) % 1000 });
  const models = createModels({ renderer });
  // (Rm: the planet's radius in metres; bend: a long flat thing, a road,
  // bent down to the curve of the ground under it)
  const specs = landing.models ?? {};
  // (specs: the landing's models, for a builder that stands one on something of its own)
  Object.assign(kit, { renderer, models, specs, Rm: R / METRE, bend: (object) => bend(object, R / METRE), merge: mergeStatic });
  // the curve of the ground under something r metres across: how far to sink it so its edges don't float
  const sinkFor = (r) => (0.25 * (r * METRE) ** 2) / R;
  const add = (object) => {
    if (dead) return false;
    // (its lights out of the count before anything's made for them)
    lights.push(...keepDark(object));
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

  // the beacon over the way in (wayin.js), stood at a spot on the ground
  const beacon = beaconOf(id, landing);
  const putBeacon = async (spot, tall) => {
    const made = createBeacon({ label: beacon.label, color: byId(id)?.palette?.glow, tall, small, reduced });
    const o = made.object;
    o.matrixAutoUpdate = false;
    standMatrix(spot, R, 0, METRE, o.matrix);
    o.matrixWorldNeedsUpdate = true;
    if (add(o)) updates.push(made.update);
  };

  const thing = async (planet, t) => {
    const spec = specs[t.kind];
    let made = null;
    let own = null; // (a model's physical nodes' bodies: hidden whether or not they're used)
    if (spec) {
      const object = await models.get(spec);
      if (object) own = collidersOf(object).bodies;
      made = object && { object, solids: t.solid === false || !t.r ? [] : [{ circle: [0, 0, t.r * 0.8] }] };
    } else if (t.kind === 'figure') made = await (await import('./people.js')).figure(kit, t.opts ?? {});
    else if (planet.PROPS?.[t.kind]) made = await planet.PROPS[t.kind](kit, t.opts ?? {});
    if (!made?.object || dead) return;
    const spot = spotOf(t);
    const o = made.object;
    scaleLights(o, METRE);
    o.matrixAutoUpdate = false;
    // (one that can be knocked about: its own box, before it's stood)
    const body = physical ? bodyOf(t.kind, spec, own) : null;
    const box = body ? ownBox(o) : null;
    standMatrix(spot, R, sinkFor(t.r ?? 0), METRE, o.matrix);
    o.matrixWorldNeedsUpdate = true;
    if (!add(o)) return;
    const circles = t.solid !== false ? solidsOn(spot, made.solids, R) : [];
    if (box) {
      o.matrix.decompose(P, Q, S);
      addBody({ object: o, position: P.toArray(), quaternion: Q.toArray(), scale: 1, box, body, solids: circles });
    } else addSolid(...circles);
    if (made.update) updates.push(made.update);
    // a door (at a spot of its own on it, in its frame), or something to say
    if (t.door || t.say) {
      const at = t.door?.at ? place(spot, t.door.at[0], t.door.at[1], R).n : spot.n;
      addSpot({ n: at, r: (t.door?.reach ?? (t.door?.at ? 3 : (t.r ?? 0) + 3)) * METRE, label: t.door?.label ?? null, say: t.say ?? null });
    }
    // (high enough to clear what it marks: a camper van's roof, a compound's wall)
    if (beacon && t === landing.things[beacon.thing]) await putBeacon(t.door.at ? place(spot, t.door.at[0], t.door.at[1], R) : spot, Math.min(12, Math.max(4.5, (t.r ?? 0) * 0.45 + 2.5)));
  };

  const scatter = async (planet, entry, rand) => {
    const spec = specs[entry.kind];
    let parts = null;
    let reach = 0.5;
    let tints = null;
    let shared = false; // (a model's: its geometry and materials are the loader's cache's)
    let own = null; // (a model's physical nodes' bodies, as for a thing)
    if (spec) {
      const object = await models.get(spec);
      if (!object) return;
      own = collidersOf(object).bodies;
      parts = partsOf(object);
      shared = true;
      reach = entry.reach ?? spec.reach ?? object.userData.footprint * 0.7;
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
    const items = scatterSpots(entry, landing.things ?? [], rand, { n, reach });
    if (!items.length) return;
    const mats = items.map((p) => {
      const spot = place(frame, p.x, p.z, R, p.yaw);
      return { spot, m: standMatrix(spot, R, 0, METRE * p.s), r: reach * p.s, s: p.s };
    });
    // (a kind that can be knocked about: a body an instance)
    const body = physical ? bodyOf(entry.kind, spec, own) : null;
    const box = body ? partsBox(parts) : null;
    // (in cells, each with bounds of its own, so what's behind you isn't
    // drawn: a kind of few or small things stays whole, its instances drawn
    // in one go costing less than a draw for each cell; and so does one
    // that can be knocked about, its instances going where they're knocked)
    const tris = parts.reduce((sum, part) => sum + (part.geometry.index?.count ?? part.geometry.attributes.position.count) / 3, 0) * mats.length;
    const cellIds = cellsOf(items, !box && tris >= SPLIT_TRIS ? CELLS : { sectors: 1 });
    const cells = cellIds.map((ids) =>
      parts.map((part) => {
        const mesh = new THREE.InstancedMesh(part.geometry, part.material, ids.length);
        ids.forEach((i, j) => {
          mesh.setMatrixAt(j, part.local ? M.copy(mats[i].m).multiply(part.local) : mats[i].m);
          // (each its own colour, from the builder's: where its material takes one)
          if (tints) mesh.setColorAt(j, tint.set(tints[(i * 7 + 3) % tints.length]));
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        // (its instances go where they're knocked: no bounds to cull them by)
        if (box) mesh.frustumCulled = false;
        return mesh;
      }),
    );
    const holder = new THREE.Group();
    holder.name = `scatter-${entry.kind}`;
    holder.userData.shared = shared;
    holder.add(...cells.flat());
    if (!add(holder)) return;
    const locals = parts.map((part) => part.local ?? null);
    // (each instance's body: its cell's meshes, and where it is among them)
    cellIds.forEach((ids, c) =>
      ids.forEach((i, j) => {
        const x = mats[i];
        const circles = entry.solid !== false ? [{ n: x.spot.n, r: x.r * METRE }] : [];
        if (!box) return addSolid(...circles);
        x.m.decompose(P, Q, S);
        addBody({ meshes: cells[c], index: j, locals, position: P.toArray(), quaternion: Q.toArray(), scale: x.s, box, body, solids: circles });
      }),
    );
  };

  // (the planet's builders, and the kit's scans on before anything's made
  // of it: a shader made before they're on is made again once they are)
  // Scans that aren't in by then aren't worn here at all: they'd come once
  // the landing's readied, maybe shown, and put everything made of the kit
  // into another shader together (lib/three/frameGuard holds each back
  // till it's readied again: the place would blink out)
  let worn = false;
  kit.ready.then(() => (worn = true)).catch(() => {});
  const ready = Promise.all([PLANETS[id]?.() ?? Promise.resolve({}), within(kit.ready, KIT_WAIT)])
    .then(async ([planet]) => {
      if (!worn) kit.keep?.();
      if (dead) return;
      planet.prepare?.(kit);
      // (every thing, on any device: they're few, and the landmarks are the
      // place; `small` only thins the scatter. Each scatter its own seed, so
      // the layout doesn't hang on which model loads first)
      const things = landing.things ?? [];
      // (a landing with no door: one of its own, under the beacon)
      if (beacon && beacon.thing === null) {
        const at = place(frame, beacon.at[0], beacon.at[1], R);
        addSpot({ n: at.n, r: beacon.reach * METRE, label: beacon.door, say: null });
        await putBeacon(at, 4.5);
      }
      await Promise.all([...things.map((t) => thing(planet, t).catch(oops(t.kind))), ...(landing.scatter ?? []).map((e, i) => scatter(planet, e, rng(seedOf(id) + i * 7919)).catch(oops(e.kind)))]);
    })
    .catch(oops(id));

  // a body's thing (or instance) stood where its body has gone
  const put = (b, position, quaternion) => {
    P.fromArray(position);
    Q.fromArray(quaternion);
    if (b.object) {
      b.object.matrix.compose(P, Q, S.setScalar(METRE * b.scale));
      b.object.matrixWorldNeedsUpdate = true;
      return;
    }
    M.compose(P, Q, S.setScalar(METRE * b.scale));
    b.meshes.forEach((mesh, j) => {
      const local = b.locals[j];
      mesh.setMatrixAt(b.index, local ? X4.copy(M).multiply(local) : M);
      mesh.instanceMatrix.needsUpdate = true;
    });
  };

  return {
    group,
    solids,
    spots,
    lights,
    bodies,
    put,
    ready,
    // (ctx: what the things may answer to; { me }: the player's head, in the world)
    update(t, dt, ctx = null) {
      for (const u of updates) u(t, dt, ctx);
    },
    open() {
      if (opened || dead) return;
      opened = true;
      solids.push(...held.solids);
      spots.push(...held.spots);
      bodies.push(...held.bodies);
      held.solids.length = held.spots.length = held.bodies.length = 0;
    },
    dispose() {
      dead = true;
      group.removeFromParent();
      release(group);
      kit.dispose();
      updates.length = 0;
      solids.length = 0;
      spots.length = 0;
      lights.length = 0;
      bodies.length = 0;
      held.solids.length = held.spots.length = held.bodies.length = 0;
    },
  };
}
