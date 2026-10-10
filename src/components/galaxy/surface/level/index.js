// A world drawn from the game's own level (lane L: docs/superpowers/specs/
// 2026-10-10-bf2017-levels-lighting-sabers-design.md, "How a level draws").
// A site with `level: '<world>'` has a pack under
// public/models/galaxy/bf2017/levels/<world>/ (scripts/bf2017-level.mjs);
// this fetches it as the visitor moves and draws it. A site without one gets
// null and nothing changes.
//
//   levelGround(ground) → Promise<ground>: its `image` layers' heightmaps
//     fetched and decoded (before the ground's grid is made)
//   partOf(world, file, empty) → Promise<the part's JSON, or empty>
//   levelPlaced(site) → Promise<{ life, rides, things }> (the map's actors and vehicles)
//   createLevel({ scene, site, tier, renderer, walk }) → null | { update(position), ready(), stats(), dispose() }
//     (walk: the walk world, { solids, floors }, the pack's collision goes into)

import { withFallback } from '../../../../lib/assetBase.js';
import { imageLayerFrom } from '../../../../lib/land/layers.js';
import { decodePng16 } from '../../../../lib/level/png16.js';
import { createLevelLoader } from './levelGltf.js';
import { packUrl, wanted } from './levelPack.js';
import { createLevelScene } from './levelScene.js';
import { createLevelStream } from './levelStream.js';
import { createColliders } from './colliders.js';
import { DECAL_POOL, createDecals } from '../../../../lib/three/decals.js';

// A pack file's bytes, from the bucket where it has it, else the site.
// (No abort signal on the request: assetBase reads any failure as the bucket
// down for the visit, so a cancelled fetch is let finish and its answer
// dropped by the stream; lane S's pool brings real aborts.)
const bytesOf = (world) => (path) =>
  withFallback((u) =>
    fetch(u).then((r) => {
      if (!r.ok) throw new Error(`${r.status} ${u}`);
      return r.arrayBuffer();
    }),
  )(packUrl(world, path));

const packs = new Map(); // world → Promise<level.json>
const packOf = (world) => {
  if (!packs.has(world)) {
    packs.set(
      world,
      bytesOf(world)('level.json')
        .then((b) => JSON.parse(new TextDecoder().decode(b)))
        .catch((e) => {
          packs.delete(world);
          throw e;
        }),
    );
  }
  return packs.get(world);
};

// A part of the pack beside level.json (lane E0: lights.json, actors.json,
// vehicles.json, decals.json, effects.json, tracks.json, probes.json,
// scatter.json), parsed; `empty` where the pack has none (a pack built
// before the part was, or a failed fetch: said once, nothing drawn)
const parts = new Map(); // `${world}/${file}` → Promise
const said = new Set();
export function partOf(world, file, empty) {
  const key = `${world}/${file}`;
  if (!parts.has(key)) {
    parts.set(
      key,
      bytesOf(world)(file)
        .then((b) => JSON.parse(new TextDecoder().decode(b)))
        .catch(() => {
          if (!said.has(key) && import.meta.env?.DEV) console.info(`level pack ${world}: no ${file}, nothing drawn from it`);
          said.add(key);
          return empty;
        }),
    );
  }
  return parts.get(key);
}

// What the map places that the site's own systems give life: its creatures,
// droids and civilians (actors.json's `life`, actors.js's rows) and its
// vehicles (vehicles.json's `rides` and `things`), in the site's frame.
// Nothing for a site without a level.
export async function levelPlaced(site) {
  if (!site?.level) return { life: [], rides: [], things: [] };
  const [a, v] = await Promise.all([partOf(site.level, 'actors.json', { life: [] }), partOf(site.level, 'vehicles.json', { rides: [], things: [] })]);
  return { life: a.life ?? [], rides: v.rides ?? [], things: v.things ?? [] };
}

// The pack's terrain as an image layer: near and far decoded, in metres from
// the spot's ground
export async function imageLayerOf(world) {
  const pack = await packOf(world);
  const t = pack.terrain;
  if (!t) return null;
  const get = bytesOf(world);
  const [near, far] = await Promise.all([get(t.near.png).then(decodePng16), get(t.far.png).then(decodePng16)]);
  const frame = (m, img) => ({ data: img.data, w: img.w, h: img.h, minX: m.min[0], minZ: m.min[1], metresPerPixel: m.metresPerPixel });
  return imageLayerFrom({ heightScale: t.scale, heightOffset: t.offset, holePixels: t.hole === null ? 0 : 1 }, frame(t.near, near), frame(t.far, far));
}

export async function levelGround(ground) {
  const layers = ground?.layers ?? [];
  if (!layers.some((l) => l.type === 'image' && l.pack)) return ground;
  // (the places' flats the site marks `game` are the flight's: on the game's
  // own ground they would bury its trenches)
  const flats = (ground.flats ?? []).filter((f) => !f.game);
  const filled = await Promise.all(
    layers.map(async (l) => {
      if (l.type !== 'image' || !l.pack) return l;
      // (a pack that cannot be had leaves the layer empty: 0, the flats still level the pad)
      const img = await imageLayerOf(l.pack).catch(() => null);
      return img ? { ...l, near: img.near, far: img.far } : l;
    }),
  );
  return { ...ground, layers: filled, flats };
}

export function createLevel({ scene, site, tier, renderer = null, walk = null }) {
  if (!site?.level) return null;
  const world = site.level;
  const fetchBytes = bytesOf(world);
  let level = null;
  let stream = null;
  let loader = null;
  let gone = false;
  let last = null;
  let decals = null;
  let decalsAt = null; // (where the pool was last filled: again after 8 m)
  const colliders = walk ? createColliders(walk, tier) : null;
  packOf(world)
    .then((pack) => {
      if (gone) return;
      loader = createLevelLoader({ world, tier, renderer, fetchBytes, sizes: pack.tex });
      level = createLevelScene({ scene, pack, loadGltf: loader.load, tier });
      // the far list is the whole arena's table; the cells round you bring
      // its collision (the walk world's solids and floors, switched off when
      // a cell goes)
      stream = createLevelStream({ pack, fetch: (path) => fetchBytes(path), wanted, tier, onFar: level.setTable, onHorizon: level.setHorizon, onCell: (key, bin) => colliders?.add(key, pack, bin), onDrop: (key) => colliders?.drop(key) });
      if (last) {
        stream.update(last, tier);
        level.update(last);
      }
      // the map's placed decals, the nearest of them in the tier's pool
      if (DECAL_POOL[tier] > 0)
        partOf(world, 'decals.json', { decals: [] }).then((d) => {
          if (gone || !d.decals?.length) return;
          decals = createDecals(scene, { tier, loadTexture: (path) => loader.texture(path, d.tex ?? {}) });
          decals.set(d.decals);
          if (last) decals.update(last);
        });
    })
    .catch((e) => {
      if (import.meta.env?.DEV) console.warn('level pack failed', world, e);
    });
  return {
    // position: [x, z] in the site's frame (where you are, or the camera)
    update(position) {
      last = position;
      stream?.update(position, tier);
      level?.update(position);
      if (decals && (!decalsAt || Math.hypot(position[0] - decalsAt[0], position[1] - decalsAt[1]) > 8)) {
        decalsAt = position;
        decals.update(position);
      }
    },
    ready: () => stream?.ready() ?? false,
    progress: () => stream?.progress() ?? 0,
    stats: () => ({ ...(level?.stats() ?? { tris: 0, calls: 0, instances: 0 }), decals: decals?.count() ?? 0 }),
    dispose() {
      gone = true;
      colliders?.dispose();
      decals?.dispose();
      stream?.dispose();
      level?.dispose();
      loader?.dispose();
    },
  };
}
