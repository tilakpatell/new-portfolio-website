// What every surface of the game is made of. Most are scanned, physically
// based texture sets from Poly Haven and ambientCG (CC0): a colour map, a
// normal map and the packed ambient occlusion / roughness / metalness map,
// each at 1024 and at 512 for phones (public/hq/tex/<set>/, made by
// scripts/hq-assets.mjs). A few are plain PBR colours (the gold trim) or
// painted in code (the stained glass). `tint` multiplies the colour map,
// `rough` and `metal` scale the packed map's channels. How many units a
// texture repeats over is the courses' SCALE (the kit bakes it into the UVs).

export const MATS = {
  grass: { set: 'grass', tint: '#c9f09a', rough: 1 },
  'grass-stone': { set: 'grass', tint: '#c9f09a', rough: 1 },
  rock: { set: 'm64-cliff', tint: '#d8d0c4' },
  path: { set: 'm64-path', tint: '#f2dcc0' },
  castle: { set: 'm64-castle', tint: '#fff3df' },
  roof: { set: 'm64-roof', tint: '#ff8f80', rough: 0.85 },
  stone: { set: 'm64-stone', tint: '#e6e0d6' },
  wood: { set: 'planks', tint: '#e0b483' },
  door: { set: 'planks', tint: '#7d4a28' },
  marble: { set: 'm64-marble', rough: 0.55 },
  carpet: { set: 'm64-carpet', tint: '#ff4b4b', rough: 1 },
  plaster: { set: 'm64-plaster', tint: '#fff0d8' },
  'wood-floor': { set: 'm64-woodfloor' },
  trim: { color: '#e9c46a', metal: 1, rough: 0.32 },
  glass: { canvas: 'stained', rough: 0.15, emissive: 0.55 },
};

export const setUrl = (set, map, small) => `/hq/tex/${set}/${map}${small ? '-512' : ''}.${map === 'color' ? 'webp' : 'jpg'}`;
