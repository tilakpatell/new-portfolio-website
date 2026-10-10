// The game's look for the site's effects: which of the 2017 drop's effect
// sheets and meshes the site holds (src/data/bf2017Fx.js, written by
// scripts/bf2017-fx.mjs) and loading them. An effect asks for its look by
// name; one the bucket hadn't when the table was written is null, and the
// effect keeps the look it has always had: never a missing texture.
//
// The names: `impact` (the game's packed impact: red the scorch, green the
// burst's rays, blue the ring), `scorch.metal` (four marks on metal), `blast`
// (four hot blast marks), `glow` (the lens flare's soft glow), `ramp.blackbody`
// (what fire cools along), `debris.<metal|rock|snow|sand|wood|walker|fighter>`
// (the chunks a blast throws) and `force.push` (Luke's half-sphere). The
// sheets the site waits on are in scripts/lib/bf2017-fx.mjs's WANTED.
//
// gameLook(name, table) → the table's entry, or null
// sheetWidth(entry, level) → the width a tier loads: 1024 at high, 512 below,
//   2048 at ultra, the nearest the sheet has
// lookUrl(name, level, table) → its file, or null
// loadLook(name, { level, table, renderer }) → Promise<Texture | null>: a
//   sheet, once a page, its `userData.look` saying { name, grid, channels,
//   additive }; null when it isn't there or doesn't load
// loadLookMesh(name, { table }) → Promise<GLTF | null>

import { BF2017_FX } from '../../../data/bf2017Fx';

const DIR = '/models/galaxy/bf2017/fx';
const WANT = { low: 512, mid: 512, high: 1024, ultra: 2048 };

export function gameLook(name, table = BF2017_FX) {
  if (!name || !Object.hasOwn(table, name)) return null;
  return table[name] ?? null;
}

export function sheetWidth(entry, level = 'high') {
  const want = WANT[level] ?? WANT.high;
  const widths = Object.keys(entry.sizes).map(Number);
  // the biggest not over what the tier wants, else the smallest it has
  const fit = widths.filter((w) => w <= want);
  return fit.length ? Math.max(...fit) : Math.min(...widths);
}

export function lookUrl(name, level = 'high', table = BF2017_FX) {
  const e = gameLook(name, table);
  if (!e) return null;
  if (e.mesh) return e.file;
  return `${DIR}/${name}.${sheetWidth(e, level)}.webp`;
}

export async function loadLook(name, { level = 'high', table = BF2017_FX, renderer = null } = {}) {
  const e = gameLook(name, table);
  if (!e || e.mesh) return null;
  try {
    const { loadTexture } = await import('../textures');
    const t = await loadTexture(lookUrl(name, level, table), { renderer, color: Boolean(e.colour) });
    t.userData.look = { name, grid: e.grid ?? [1, 1], channels: e.channels ?? null, additive: Boolean(e.additive) };
    return t;
  } catch {
    return null;
  }
}

export async function loadLookMesh(name, { table = BF2017_FX } = {}) {
  const e = gameLook(name, table);
  if (!e?.mesh) return null;
  const { loadGLTF } = await import('../gltfCache');
  return loadGLTF(e.file);
}
