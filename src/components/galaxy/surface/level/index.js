// A world drawn from the game's own level (lane L: docs/superpowers/specs/
// 2026-10-10-bf2017-levels-lighting-sabers-design.md, "How a level draws").
// A site with `level: '<world>'` has a pack under
// public/models/galaxy/bf2017/levels/<world>/ (scripts/bf2017-level.mjs);
// this fetches it as the visitor moves and draws it. A site without one gets
// null and nothing changes.
//
//   levelGround(ground) → Promise<ground>: its `image` layers' heightmaps
//     fetched and decoded (before the ground's grid is made)
//   createLevel({ scene, site, tier, renderer }) → null | { update(position), ready(), stats(), dispose() }

import { withFallback } from '../../../../lib/assetBase.js';
import { imageLayerFrom } from '../../../../lib/land/layers.js';
import { decodePng16 } from '../../../../lib/level/png16.js';
import { createLevelLoader } from './levelGltf.js';
import { packUrl, wanted } from './levelPack.js';
import { createLevelScene } from './levelScene.js';
import { createLevelStream } from './levelStream.js';

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
  const filled = await Promise.all(
    layers.map(async (l) => {
      if (l.type !== 'image' || !l.pack) return l;
      // (a pack that cannot be had leaves the layer empty: 0, the flats still level the pad)
      const img = await imageLayerOf(l.pack).catch(() => null);
      return img ? { ...l, near: img.near, far: img.far } : l;
    }),
  );
  return { ...ground, layers: filled };
}

export function createLevel({ scene, site, tier, renderer = null }) {
  if (!site?.level) return null;
  const world = site.level;
  const fetchBytes = bytesOf(world);
  let level = null;
  let stream = null;
  let loader = null;
  let gone = false;
  let last = null;
  packOf(world)
    .then((pack) => {
      if (gone) return;
      loader = createLevelLoader({ world, tier, renderer, fetchBytes });
      level = createLevelScene({ scene, pack, loadGltf: loader.load, tier });
      stream = createLevelStream({ pack, fetch: (path) => fetchBytes(path), wanted, tier, onFar: level.setFar, onHorizon: level.setHorizon, onCell: level.addCell, onDrop: level.removeCell });
      if (last) stream.update(last, tier);
    })
    .catch((e) => {
      if (import.meta.env?.DEV) console.warn('level pack failed', world, e);
    });
  return {
    // position: [x, z] in the site's frame (where you are, or the camera)
    update(position) {
      last = position;
      stream?.update(position, tier);
    },
    ready: () => stream?.ready() ?? false,
    progress: () => stream?.progress() ?? 0,
    stats: () => level?.stats() ?? { tris: 0, calls: 0, cells: 0 },
    dispose() {
      gone = true;
      stream?.dispose();
      level?.dispose();
      loader?.dispose();
    },
  };
}
