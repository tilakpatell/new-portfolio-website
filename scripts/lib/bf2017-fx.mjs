// What the galaxy's effects take from the 2017 drop, and how: the pure half
// of scripts/bf2017-fx.mjs. Frostbite's effect graphs do not export, so the
// site's own effects keep their rules and take the game's *look*: its
// sheets (impact masks, scorch decals, the soft glow, the black-body ramp
// fire cools along) and its effect meshes (the chunks thrown by a blast,
// the walkers' wreck, Luke's Force push). The design:
// docs/superpowers/plans/2026-10-10-bf2017-phaseF-effects-lighting-lines.md.
//
// SHEETS: { site name: { from, op, grid?, channels?, additive?, colour?, sizes } }
//   from      the texture's Frostbite name (web/textures.jsonl's `name`)
//   op        'rgb' (as it is, its alpha dropped: the game packs masks in
//             the colour channels), 'ramp' (one band of rows, 256 across)
//   grid      [columns, rows] where the name's own is wrong or absent
//   channels  which channel holds what, for a sheet the game packed
//   sizes     the widths it ships at (lib/three/fx/gameLook.js picks one by tier)
// WANTED: the sheets the site has a use for that the bucket has not yet:
//   named now, fetched by the same script the day they land.
// MESHES: { site name: { from: [manifest names], as } }: each a GLB of the
//   pieces, geometry only (the look is a sheet's, or the effect's colour).
//
// sheetFiles(name, spec, width) → the file names a sheet writes
// wantedSizes(spec, width) → the sizes a source `width` across can give
// bareGlb(glb) → the GLB without its images, textures or samplers (the
//   drop's name KTX2s outside the file, which no reader here can open)
// tableEntry(…) → a line of src/data/bf2017Fx.js
// upCount(rows, has) → { all, up }: the drop's effect textures and how many
//   the bucket holds (the count the PR says)

import { gridFromName } from '../../src/lib/three/fx/flipbook.js';

export const OUT_DIR = 'public/models/galaxy/bf2017/fx';
export const SITE_DIR = '/models/galaxy/bf2017/fx';
export const TABLE = 'src/data/bf2017Fx.js';
// (an effect's own cap; the set's is SET_CAP, loaded once a galaxy visit)
export const EFFECT_CAP = 256 * 1024;
export const SET_CAP = 6 * 1024 * 1024;
// a file over this goes to the public bucket (scripts/assets-publish.mjs), not git
export const COMMIT_CAP = 64 * 1024;

export const SHEETS = {
  // the game's impact, packed: red the scorch it leaves, green the burst's
  // rays, blue the ring that runs out
  impact: { from: 'FX/Decals/VolumeDecals/Textures/T_Impact_01_RGB', op: 'rgb', channels: { scorch: 'r', burst: 'g', ring: 'b' }, sizes: [512] },
  // a blaster's mark on metal: four of them, 2 by 2 (the name says 2x4)
  'scorch.metal': { from: 'FX/Decals/Metal/T_Decal_ScorchMark_Metal_2x4_D', op: 'rgb', grid: [2, 2], colour: true, sizes: [512, 1024] },
  // four hot blast marks: red the burn's mask
  blast: { from: 'FX/Decals/Metal/T_Decal_01_RGBM', op: 'rgb', grid: [2, 2], channels: { burn: 'r' }, sizes: [512, 1024] },
  // the lens flare's soft-edged glow: an engine's, a bolt's head
  glow: { from: 'FX/Lensflare/Textures/T_Box_SoftEdge_02', op: 'rgb', additive: true, sizes: [256] },
  // what fire cools along, black to white-yellow (the ramp sheet's main band)
  'ramp.blackbody': { from: 'FX/StandardShaders/T_BlackBodyRamps_01_M', op: 'ramp', rows: [48, 120], colour: true, sizes: [256] },
  // the thrown chunks' own maps
  'debris.metal': { from: 'FX/Meshes/Chunks/Metal/T_MetalChunk_01_D', op: 'rgb', colour: true, sizes: [256, 512] },
  'debris.wood': { from: 'FX/Meshes/Chunks/Wood/T_WoodSplinter_01_CS', op: 'rgb', colour: true, sizes: [256] },
};

// named, not up yet (2026-10-10, 06:00): each fetched the day the bucket has it
export const WANTED = {
  'bolt.side': 'FX/Textures/Trail/T_BlasterProjectileSide_02_D',
  'bolt.top': 'FX/Textures/Trail/T_BlasterProjectileTop_01_D',
  muzzle: 'FX/Textures/Muzzleflashes/MuzzleBlast',
  smoke: 'FX/Textures/Smoke/T_ThinPuff_Gnomon_4x32_NoAtlas_01_D',
  'smoke.billow': 'FX/Textures/Smoke/T_billowSmokeHi_Gnomon_8x64_NoAtlas_01_D',
  fire: 'FX/Textures/Fire/T_Fire_Anim8x4o32_Loop_NoAtlas_01_D',
  'trail.smoke': 'FX/Textures/Trail/T_SmokeTrail_NoAtlas_01_D',
  'force.cone': 'FX/Textures/Hero/T_ConeFroce_02_D',
  'engine.xwing': 'FX/Textures/Exhausts/T_XWingEngineLight_02_D',
  'engine.awing': 'FX/Textures/Exhausts/T_AwingEngineLight_01_D',
  'engine.shuttle': 'FX/Textures/Exhausts/T_ImperialShuttle_EngineExhaust_01_D',
  crater: 'FX/Textures/TerrainDecals/T_Generic_Crater_01_M',
  'scorch.concrete': 'FX/Decals/Concrete/T_Decal_Concrete_2x4_RGBA',
  'shield.impact': 'FX/Textures/Shield/T_ShieldImpact_04_M',
  'kick.snow': 'FX/Textures/Footstep/T_FootstepSoldierSnow_01_H',
  'kick.sand': 'FX/Textures/Footstep/T_FootstepSoldierDeepSand_01_H',
};

export const MESHES = {
  'debris.metal': { as: 'metal chunks', from: ['fx/meshes/chunks/metal/meshp_chunk_metal_01_mesh', 'fx/meshes/chunks/vehiclesgeneric/meshp_chunk_vehiclesgeneric_01_mesh'] },
  'debris.rock': { as: 'rock chunks', from: [1, 2, 3, 4].map((n) => `fx/meshes/chunks/generic/meshp_chunk_generic_0${n}_mesh`) },
  'debris.snow': { as: 'snow and ice chunks', from: ['fx/meshes/chunks/snow/meshp_chunk_arcticchunks_4x_mesh'] },
  'debris.sand': { as: 'desert rock chunks', from: ['fx/meshes/chunks/sand/meshp_chunk_desertrocks_4x_mesh'] },
  'debris.wood': { as: 'wood splinters', from: ['fx/meshes/chunks/wood/meshp_woodsplinter_01_mesh', ...[1, 2, 3].map((n) => `fx/meshes/chunks/wood/meshp_chunk_treesplinter_0${n}_mesh`)] },
  'debris.walker': { as: 'an AT-ST’s wreck', from: [1, 2, 3, 4, 5, 6].map((n) => `fx/meshes/vehicle/meshp_atst_wreck_0${n}_mesh`) },
  'debris.fighter': { as: 'a Y-wing’s shards', from: [1, 2, 3, 4, 5].map((n) => `fx/meshes/vehicle/meshp_ywing_shard${n}_mesh`) },
  'force.push': { as: 'Luke’s Force push', from: ['fx/gameplay/hero/luke/meshes/forcefronthalfsphere_mesh'] },
};

// the file a sheet or a mesh is at, under the site's root
export const sheetFile = (name, width) => `${name}.${width}.webp`;
export const meshFile = (name) => `${name}.glb`;

// the sizes a source `width` across gives: none bigger than the source
export function wantedSizes(spec, width) {
  const fit = spec.sizes.filter((s) => s <= width);
  return fit.length ? fit : [Math.min(...spec.sizes, width)];
}

// a sheet's grid: its own, else its name's
export const gridOf = (spec) => spec.grid ?? gridFromName(spec.from);

// a GLB with its images, textures and samplers taken out, and every
// material's map slots with them
export function bareGlb(glb) {
  const buf = Buffer.isBuffer(glb) ? glb : Buffer.from(glb);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen));
  const rest = buf.subarray(20 + jsonLen);
  delete json.images;
  delete json.textures;
  delete json.samplers;
  for (const m of json.materials ?? []) {
    for (const k of Object.keys(m)) if (/Texture$/.test(k)) delete m[k];
    if (m.pbrMetallicRoughness) for (const k of Object.keys(m.pbrMetallicRoughness)) if (/Texture$/.test(k)) delete m.pbrMetallicRoughness[k];
    if (m.extensions) for (const k of Object.keys(m.extensions)) if (/texture/i.test(JSON.stringify(m.extensions[k]))) delete m.extensions[k];
  }
  for (const key of ['extensionsUsed', 'extensionsRequired']) if (json[key]) json[key] = json[key].filter((e) => e !== 'KHR_texture_basisu' && e !== 'KHR_texture_transform');
  let text = JSON.stringify(json);
  while (Buffer.byteLength(text) % 4) text += ' ';
  const head = Buffer.alloc(20);
  const jsonBuf = Buffer.from(text);
  head.write('glTF', 0, 'ascii');
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(20 + jsonBuf.length + rest.length, 8);
  head.writeUInt32LE(jsonBuf.length, 12);
  head.write('JSON', 16, 'ascii');
  return Buffer.concat([head, jsonBuf, rest]);
}

// a line of the effect table the site reads (src/data/bf2017Fx.js)
export function tableEntry(name, { spec, files, bytes, mesh = false }) {
  if (mesh) return { mesh: true, file: `${SITE_DIR}/${meshFile(name)}`, from: spec.from, bytes };
  const out = { from: spec.from, grid: gridOf(spec), sizes: Object.fromEntries(files.map(([w, b]) => [w, b])) };
  if (spec.channels) out.channels = spec.channels;
  if (spec.additive) out.additive = true;
  if (spec.colour) out.colour = true;
  return out;
}

// the table as a module: the site's files by name, each path written out
// in full (the credits' test finds a model by its path in the code)
export function tableModule(table) {
  const lines = Object.entries(table)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `  '${k}': ${JSON.stringify(v)},`);
  return [
    '// The game’s look for the galaxy’s effects: which sheets and meshes from the',
    '// Star Wars Battlefront II (2017) drop the site holds, written by',
    '// scripts/bf2017-fx.mjs (do not edit by hand). lib/three/fx/gameLook.js reads',
    '// it; an effect not here keeps its own look.',
    '',
    'export const BF2017_FX = {',
    ...lines,
    '};',
    '',
  ].join('\n');
}

// how many of the drop's effect textures (web/textures.jsonl, under FX/)
// the bucket holds, as the PNG or the KTX2
export function upCount(rows, has) {
  const fx = rows.filter((r) => /^fx\//i.test(r.name));
  return { all: fx.length, up: fx.filter((r) => has(r.file) || has(r.file.replace(/\.png$/, '.ktx2'))).length };
}
