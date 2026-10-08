// The kit at run time: the Quaternius packs' family files (public/kit/<pack>/,
// scripts/kit/README.md) loaded once, their materials one a name for the
// whole pack, and their models drawn through keyed instanced pools. A world
// never builds a mesh per tree: a streamed cell, a town or a site hands its
// placements to a pool under a key (`set`), takes them back when it goes
// (`free`), and the pool draws every item of a model in a few instanced
// draws, each item at the level its distance calls for: the full model
// near, its LOD1 further off, a far stand-in (the puff) to twice that,
// nothing beyond. (docs/superpowers/specs/2026-10-08-kit-worlds-design.md, 2)
//
//   loadKit(pack, { load, base, house, wind, manifest }) → {
//     pack, manifest: Promise (<base>/<pack>/index.json, fetched unless
//       the option hands it over),
//     info(name) → the model's manifest row (null for one it hasn't; throws
//       before the manifest is in),
//     model(name) → Promise<{ parts, radius, height, kind, tones }>,
//     lod1(name) → Promise<parts>,
//     material(name) → the pack's one material of that name,
//     dispose() }
//     parts: [{ geometry, material, local: Matrix4, part }] (the galaxy
//     placer's part contract; `local` is the part's place in the model, its
//     node's transform included: the import's meshopt keeps each model's
//     geometry in -1…1 under a move and a scale, so geometry alone draws a
//     tree a seventh of its size; a rig's are as its file has them, a
//     skinned mesh placed by its bones, for its own mixer, never a pool)
//   kitMaterial(def, { house, wind }) → a new material for a manifest entry
//   createPool(kit, name, { bands, cap, shadows, puff, lod1, wait }) → {
//     set(key, items), free(key), shift(dx, dz), update(camera, dt),
//     stats: { total, levels: [full, lod1, puff], sorts }, group, ready, dispose() }
//     items: [{ x, y, z, yaw, scale = 1 }]
//
// A material is the house's Lambert (lib/three/house) when a house is
// given, a plain one when not, wearing the map, the normal map (where the
// manifest lists one) and the colour of the first file to carry its name.
// Whatever the manifest says bends in the wind does, bark and leaves alike,
// scaled by the model's own weight a vertex (three's loader names a GLB's
// _WIND `_wind`; a mesh that wears a bending material without one gets one
// of ones, so it sways by its height alone and doesn't stand frozen). Leaves
// are cut out at 0.3, two-sided, lit as one crown (foliage.js's `faceless`),
// their maps brought under the device's ceiling and then given mip levels
// that keep their coverage (textures.js), or a far crown goes bald.

import * as THREE from 'three';
import { budget } from '../budgets';
import { detailLevel, modelTexCap } from '../detail';
import { faceless, wind as windOn } from './foliage';
import { loadGltf } from './gltf';
import { lodBand } from './lod';
import { coverageTexture, fitTexture } from './textures';

const CUT = 0.3; // a leaf map's alpha cut
const WEIGHT = '_wind'; // the wind weight's attribute, as three's loader names it
const GROWTH = 1.5; // a pool's capacity, grown by half again when it overflows
const HYSTERESIS = 0.1; // a band edge's dead zone, a share of its distance
const EVERY = 0.5; // seconds between re-sorts
const MOVE = 20; // or metres of camera travel

// A new material for a manifest entry `def` ({ alpha, leaf, wind, maps }):
// the house's (or a plain Lambert), a leaf's cut out and two-sided and lit
// by its crown's normals, and in the wind if `def.wind` says how ('tree',
// 'shrub'), on `wind.time` (and `wind.dir`). Its maps come from a file
// (loadKit).
export function kitMaterial(def = {}, { house = null, wind = null } = {}) {
  const opts = def.leaf ? { alphaTest: CUT, side: THREE.DoubleSide } : {};
  const m = house ? house.material(opts) : new THREE.MeshLambertMaterial(opts);
  if (def.leaf) faceless(m);
  if (def.wind) windOn(m, { kind: def.wind, weight: WEIGHT, time: wind?.time, ...(wind?.dir ? { dir: wind.dir } : {}) });
  return m;
}

// A file's material's look onto the kit's: its colour (the farm animals
// have no maps: their colour is their look), its map, its normal map where
// the manifest lists one (with the file's scale: the loader flips its green
// when it derives tangents), and, a leaf's aside, its sides.
function dress(m, def, src) {
  if (src.color) m.color.copy(src.color);
  m.vertexColors = false;
  if (src.map) m.map = src.map;
  if (def.maps?.normal && src.normalMap) {
    m.normalMap = src.normalMap;
    if (src.normalScale) m.normalScale.copy(src.normalScale);
  }
  if (!def.leaf && src.side != null) m.side = src.side;
  m.needsUpdate = true;
}

// A weight of ones for a geometry the file gave none. The files' geometry
// is the page's model cache's (lib/three/gltf), shared by every kit of a
// pack, so a weight filled in is counted by the kits holding it and taken
// off when the last of them is disposed of.
const ones = (geometry) => new THREE.BufferAttribute(new Uint8Array(geometry.attributes.position.count).fill(255), 1, true);
const FILLED = new WeakMap(); // a weight of ones → how many kits hold it

function fetchManifest(url) {
  return fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`kit: couldn't load ${url} (${r.status})`))));
}

export function loadKit(pack, { load = loadGltf, base = '/kit', house = null, wind = null, manifest = null } = {}) {
  const root = `${base}/${pack}`;
  let index = null; // the manifest, once in
  let gone = false;
  let warned = false;
  const files = new Map(); // url → Promise<{ scene, roots }>
  const held = new Map(); // a filled weight this kit holds → its geometry
  const mats = new Map(); // name → the kit's material
  const dressed = new Set();
  const models = new Map(); // name → Promise<model>
  const lods = new Map(); // name → Promise<parts>

  const ready = Promise.resolve(manifest ?? fetchManifest(`${root}/index.json`)).then((m) => (index = m));
  ready.catch(() => {});

  function info(name) {
    if (!index) throw new Error(`kit ${pack}: ${name} asked for before the manifest is in (await kit.manifest)`);
    return index.models?.[name] ?? null;
  }

  function material(name) {
    if (!index) throw new Error(`kit ${pack}: material ${name} asked for before the manifest is in (await kit.manifest)`);
    let m = mats.get(name);
    if (!m) {
      const def = index.materials?.[name];
      if (!def) throw new Error(`kit ${pack}: no material ${name} in its manifest`);
      m = kitMaterial(def, { house, wind });
      m.name = name;
      mats.set(name, m);
    }
    return m;
  }

  // A leaf map under the device's ceiling first (the coverage levels are
  // made from it: made from the full map, they'd bring its size back), then
  // its coverage levels; once a map, whichever kit gets to it first (two kits
  // of a pack share the cached file's maps). In a browser, a map a canvas
  // wouldn't read (a tainted one, a decoder's bitmap it couldn't draw) is
  // left to the graphics chip's levels: said once, as the crowns will thin
  // with distance.
  function cover(m) {
    if (!m.map.userData.covered) {
      fitTexture(m.map, modelTexCap());
      coverageTexture(m.map, { cut: CUT });
      m.map.userData.covered = true;
    }
    if (typeof document !== 'undefined' && m.map.generateMipmaps && !warned) {
      warned = true;
      console.warn(`kit ${pack}: ${m.name}'s map keeps the graphics chip's mips (its pixels couldn't be read), so far crowns will thin`);
    }
  }

  // A loaded file taken in: its materials dressed (each name once, from the
  // first file to carry it), its bending meshes given a weight where they
  // lack one, its models found by the names the file gave them.
  function adopt(scene) {
    scene.traverse((o) => {
      if (!o.isMesh) return;
      const name = o.material?.name;
      const m = material(name);
      const def = index.materials[name];
      if (!dressed.has(name)) {
        dressed.add(name);
        dress(m, def, o.material);
        if (def.leaf && m.map) cover(m);
      }
      const g = o.geometry;
      let w = g.attributes[WEIGHT];
      if (def.wind && !w) {
        w = ones(g);
        g.setAttribute(WEIGHT, w);
        FILLED.set(w, 0);
      }
      if (w && FILLED.has(w) && !held.has(w)) {
        FILLED.set(w, FILLED.get(w) + 1);
        held.set(w, g);
      }
    });
    const roots = new Map();
    for (const o of scene.children) roots.set(o.userData?.name ?? o.name, o);
    return { scene, roots };
  }

  function fileOf(file) {
    const url = `${root}/${file}`;
    if (!files.has(url)) {
      const p = Promise.resolve(load(url)).then((got) => {
        if (!got?.scene) throw new Error(`kit ${pack}: couldn't load ${url}`);
        if (gone) throw new Error(`kit ${pack}: disposed of while ${url} loaded`);
        return adopt(got.scene);
      });
      p.catch(() => files.delete(url));
      files.set(url, p);
    }
    return files.get(url);
  }

  // Every mesh under a model's node, each at its place in the model: its
  // matrix relative to the file's root.
  function partsOf(node, scene) {
    scene.updateMatrixWorld(true);
    const inv = scene.matrixWorld.clone().invert();
    const parts = [];
    node.traverse((o) => {
      if (!o.isMesh) return;
      parts.push({ geometry: o.geometry, material: material(o.material.name), local: new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld), part: o.geometry.userData?.part ?? 'main' });
    });
    return parts;
  }

  // A model's node from its file, once, by name (`suffix` '.lod1' for its LOD1).
  function find(cache, name, suffix, make) {
    if (!cache.has(name)) {
      const p = ready.then(async () => {
        const row = info(name);
        if (!row) throw new Error(`kit ${pack}: no model ${name} in its manifest`);
        const { scene, roots } = await fileOf(row.file);
        const node = roots.get(name + suffix);
        if (!node) throw new Error(`kit ${pack}: ${row.file} has no ${suffix ? `LOD1 of ${name}` : name}`);
        return make(partsOf(node, scene), row);
      });
      p.catch(() => cache.delete(name));
      cache.set(name, p);
    }
    return cache.get(name);
  }

  return {
    pack,
    manifest: ready,
    info,
    material,
    model: (name) => find(models, name, '', (parts, row) => ({ parts, radius: row.radius, height: row.height, kind: row.kind, tones: row.tones ?? null })),
    lod1: (name) => find(lods, name, '.lod1', (parts) => parts),
    // What the kit made, freed: its materials, and the weights it filled in
    // that no other kit still holds. The files' geometry and maps are the
    // loader's (the page's model cache), left as they are.
    dispose() {
      gone = true;
      for (const m of mats.values()) m.dispose();
      for (const [w, g] of held) {
        const n = FILLED.get(w) - 1;
        if (n > 0) FILLED.set(w, n);
        else {
          FILLED.delete(w);
          if (g.attributes[WEIGHT] === w) g.deleteAttribute(WEIGHT);
        }
      }
      for (const c of [files, held, mats, dressed, models, lods]) c.clear();
    },
  };
}

// ── the pools ──

// An item's place written straight into an instance's 16 floats: its move,
// its turn about up and its size (column-major, as three's), times the
// part's own matrix `b`.
function place(out, o, it, b) {
  const { x, y, z, c, s, k } = it;
  for (let j = 0; j < 16; j += 4) {
    const b0 = b[j];
    const b1 = b[j + 1];
    const b2 = b[j + 2];
    const b3 = b[j + 3];
    out[o + j] = c * b0 + s * b2 + x * b3;
    out[o + j + 1] = k * b1 + y * b3;
    out[o + j + 2] = -s * b0 + c * b2 + z * b3;
    out[o + j + 3] = b3;
  }
}

const itemOf = ({ x = 0, y = 0, z = 0, yaw = 0, scale = 1 }) => ({ x, y, z, c: Math.cos(yaw) * scale, s: Math.sin(yaw) * scale, k: scale, band: -1 });

// A pool of one model: an InstancedMesh a part a level (0 the full parts,
// 1 the LOD1's, 2 the `puff` ({ geometry, material }, in the model's own
// frame) or, till there is one, the LOD1's again), all in `group`. `bands`
// [near, mid] in metres, across the ground: full within near, LOD1 to mid,
// the puff to twice mid, nothing beyond (lib/budgets' row for the device's
// level unless given, as is `lod1`: false keeps the full parts where the
// LOD1's would be, as ultra does, and so does a model whose LOD1 won't
// load, said once). Items are re-sorted into levels every half second (from
// a point in it picked at random, `wait` to pick it: pools made together
// don't all sort on one frame) or 20 m of the camera's travel, or at the
// next update after a set or a free. A free (or a set to nothing) takes its
// items out of every level at once; a shift moves every instance there and
// then, and the camera position the last sort was from with them, so it
// re-bands nothing (`stats.sorts` counts the sorts). `cap` instances a
// level to start, grown by half again whenever the items outnumber it
// (geometry and materials shared; never shrunk). Only the full level casts
// shadows, and only with `shadows`. The parts load in the background
// (`ready`); items set before then are drawn once they're in. Wants the
// kit's manifest in, and refuses a rigged model: a pool draws still props.
export function createPool(kit, name, { bands = null, cap = 256, shadows = true, puff = null, lod1 = null, wait: start = Math.random() * EVERY } = {}) {
  const row = kit.info(name);
  if (!row) throw new Error(`createPool: kit ${kit.pack} has no model ${name}`);
  if (row.rig) throw new Error(`createPool: ${name} is rigged, and a pool draws still props`);
  const level = budget(detailLevel());
  const [near, mid] = bands ?? [level.near, level.mid];
  const edges = [near, mid, 2 * mid];
  const withLod1 = lod1 ?? level.lod1;

  const group = new THREE.Group();
  group.name = `kit:${name}`;
  const keys = new Map(); // key → its items
  const stats = { total: 0, levels: [0, 0, 0], sorts: 0 };
  const parts = [null, null, null]; // each level's, once in
  let meshes = [[], [], []];
  let capacity = Math.max(1, Math.ceil(cap));
  const last = { x: Infinity, z: Infinity }; // where the camera was at the last sort
  let wait = start; // till the half second comes round
  let dirty = true;
  let gone = false;

  function make(lvl, part, i) {
    const mesh = new THREE.InstancedMesh(part.geometry, part.material, capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    mesh.visible = false;
    mesh.castShadow = shadows && lvl === 0;
    mesh.receiveShadow = shadows;
    mesh.name = `${name}:${lvl}:${i}`;
    mesh.userData.level = lvl;
    group.add(mesh);
    return mesh;
  }

  // Every item at its band written into its level's meshes, packed from the
  // front; each level's count. The meshes' bounds are found again when next
  // drawn (three works them out over the instances drawn), so culling holds;
  // a level with nothing in it is hidden, not drawn empty.
  function write() {
    const n = [0, 0, 0];
    for (const list of keys.values()) {
      for (const it of list) {
        const l = it.band;
        if (l < 0 || l > 2) continue;
        const at = n[l]++ * 16;
        const ps = parts[l];
        if (ps) for (let i = 0; i < ps.length; i++) place(meshes[l][i].instanceMatrix.array, at, it, ps[i].local.elements);
      }
    }
    for (let l = 0; l < 3; l++) {
      stats.levels[l] = n[l];
      for (const m of meshes[l]) {
        m.count = n[l];
        m.visible = n[l] > 0;
        if (n[l]) m.instanceMatrix.needsUpdate = true;
        m.boundingSphere = null;
      }
    }
  }

  function sort(cx, cz) {
    for (const list of keys.values()) for (const it of list) it.band = lodBand(Math.hypot(it.x - cx, it.z - cz), edges, it.band, HYSTERESIS);
    last.x = cx;
    last.z = cz;
    dirty = false;
    stats.sorts += 1;
    write();
  }

  // Room for every item at one level: each mesh swapped for a bigger one
  // holding what it drew (its old instance buffers freed).
  function grow() {
    if (stats.total <= capacity) return;
    while (capacity < stats.total) capacity = Math.ceil(capacity * GROWTH);
    meshes = meshes.map((list, l) =>
      list.map((old, i) => {
        const mesh = make(l, parts[l][i], i);
        mesh.instanceMatrix.array.set(old.instanceMatrix.array);
        mesh.count = old.count;
        mesh.visible = old.visible;
        group.remove(old);
        old.dispose();
        return mesh;
      }),
    );
  }

  const pool = {
    stats,
    group,
    ready: null,
    set(key, items = []) {
      const list = Array.from(items, itemOf);
      if (!list.length) return pool.free(key);
      stats.total += list.length - (keys.get(key)?.length ?? 0);
      keys.set(key, list);
      grow();
      dirty = true;
    },
    free(key) {
      const list = keys.get(key);
      if (!list) return;
      keys.delete(key);
      stats.total -= list.length;
      write();
      dirty = true;
    },
    shift(dx, dz) {
      for (const list of keys.values())
        for (const it of list) {
          it.x += dx;
          it.z += dz;
        }
      last.x += dx;
      last.z += dz;
      write();
    },
    update(camera, dt = 0) {
      if (gone) return;
      // (the half second keeps its own beat, whatever else sorts in between)
      wait -= dt;
      const due = wait <= 0;
      if (due) wait = EVERY + (wait % EVERY);
      const { x, z } = camera.position;
      if (dirty || due || !(Math.hypot(x - last.x, z - last.z) < MOVE)) sort(x, z);
    },
    dispose() {
      gone = true;
      group.removeFromParent();
      for (const list of meshes)
        for (const m of list) {
          group.remove(m);
          m.dispose();
        }
      meshes = [[], [], []];
      keys.clear();
      stats.total = 0;
      stats.levels.fill(0);
    },
  };

  // (a LOD1 that won't load: the full parts stand in, rather than nothing drawn)
  const lodParts = withLod1
    ? kit.lod1(name).catch((e) => {
        console.warn(`createPool: ${name}'s LOD1 won't load (${e.message}); its full parts stand in`);
        return null;
      })
    : null;
  pool.ready = Promise.all([kit.model(name), lodParts]).then(([full, lod]) => {
    if (gone) return pool;
    const far = lod ?? full.parts;
    parts[0] = full.parts;
    parts[1] = far;
    parts[2] = puff ? [{ geometry: puff.geometry, material: puff.material, local: new THREE.Matrix4() }] : far;
    meshes = parts.map((list, l) => list.map((p, i) => make(l, p, i)));
    write();
    return pool;
  });
  pool.ready.catch(() => {});
  return pool;
}
