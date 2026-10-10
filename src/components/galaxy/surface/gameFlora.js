// The drop's own cover and debris for the worlds with no game map (the
// fifth design, lane O): Dagobah's scheffleras and stumps, Mustafar's
// crater rocks, Mandalore's mud rocks, Sorgan's undergrowth, Lothal's
// boulders. (The drop's roots, ferns, bones and scrap carry no maps of their
// own, the game's terrain shades them: they are left out.) Each is a recipe of objects from the
// drop's library (catalog/bf2017-library.js, `game:<name>`), by world and
// biome as the design names them, written as scatter rows the placer
// already draws (instanced, its light cut far off), added after the site's
// own rows and its flora's: the recipe adds, never replaces. A site names
// one in its flora block, `flora: { …, game: 'swamp' }`.
//
//   RECIPES: { [recipe]: [[game name, { band, n, within, scale, solid?,
//     shadow?, sink? }]…] } (`band` as flora.js's: cover, mid or trees)
//   gameRows(site, models) → the rows; an object not published yet (not in
//     `models`) is skipped, so a pending import lays nothing rather than
//     a warning a frame
//   recipeNames(recipe) → the game names a recipe lays (the sites test
//     holds every one to the library's index and the published book)

import { SURFACE_MODELS } from './catalog';

const COVER = { band: 'cover', solid: false, shadow: false };
const MID = { band: 'mid', solid: true };

export const RECIPES = {
  // Dagobah: Kashyyyk's scheffleras and stumps, Yavin's swamp stumps and
  // ground shrubs, the forest's logs and stones (Yoda's hut stays the site's own)
  swamp: [
    ['game:objects/nature/yavin/_yavinbase/yavinbase_groundshrub_01/yavinbase_groundshrub_03_mesh', { ...COVER, n: 90, within: [6, 160], scale: [0.8, 1.3] }],
    ['game:objects/nature/kashyyyk/_kashyyykbase/_meshscattering/ms_kashyyykbase_schefflerabush_01/ms_kashyyykbase_schefflerabush_xs_01_mesh', { ...COVER, n: 120, within: [6, 160], scale: [0.8, 1.4] }],
    ['game:objects/nature/kashyyyk/_kashyyykbase/_meshscattering/ms_kashyyykbase_schefflerabush_01/ms_kashyyykbase_schefflerabush_m_01_mesh', { ...MID, n: 40, within: [10, 320], scale: [0.8, 1.3], solid: false }],
    ['game:objects/nature/kashyyyk/_kashyyykbase/_meshscattering/ms_kashyyykbase_stump_m_02/ms_kashyyykbase_stump_m_02_mesh', { ...MID, n: 24, within: [14, 320], scale: [0.8, 1.4] }],
    ['game:objects/nature/yavin/_yavinbase/yavinbase_stump_swamp_medium_03/yavinbase_stump_swamp_medium_03_mesh', { ...MID, n: 24, within: [14, 320], scale: [0.8, 1.4], sink: 0.2 }],
    ['game:objects/nature/forest/_forestbase/forestbase_logsmall_01/forestbase_logsmall_01_mesh', { ...MID, n: 16, within: [20, 360], scale: [0.8, 1.2] }],
    ['game:objects/nature/forest/_forestbase/forestbase_rocksmall_01/forestbase_rocksmall_01_mesh', { ...MID, n: 20, within: [10, 360], scale: [0.7, 1.3], sink: 0.1 }],
  ],
  // Mustafar's and Nevarro's lava country: Sullust's crater rocks and the
  // sulphur flats' frail stones
  volcanic: [
    ['game:objects/nature/volcanic/_volcanicsulfur/_meshscatter/ms_volcanicsulfur_rockfrailsmall_01/ms_volcanicsulfur_rockfrailsmall_01_mesh', { ...COVER, n: 160, within: [8, 200], scale: [0.8, 1.8] }],
    ['game:objects/nature/volcanic/sullustan/volcaniccrater_rockmedium_01/volcaniccrater_rockmedium_01_mesh', { ...MID, n: 50, within: [16, 420], scale: [0.8, 1.6], sink: 0.2 }],
    ['game:objects/nature/volcanic/sullustan/volcaniccrater_rockmedium_03/volcaniccrater_rockmedium_03_mesh', { ...MID, n: 40, within: [16, 420], scale: [0.8, 1.6], sink: 0.2 }],
    ['game:objects/nature/volcanic/_volcanicsulfur/volcanicsulfur_rock_large_02/volcanicsulfur_rock_large_02_mesh', { band: 'trees', solid: true, n: 10, within: [120, 560], scale: [0.8, 1.4], sink: 0.6 }],
  ],
  // Mandalore's glassed badlands: the desert's mud rocks, the canyon's
  // stones, the rancor pit's boulders
  badlands: [
    ['game:objects/nature/desert/desertcanyon/_meshscattering/ms_desertcanyon_rock_03/ms_desertcanyon_rock_03_mesh', { ...COVER, n: 90, within: [8, 220], scale: [0.5, 1.1] }],
    ['game:objects/nature/desert/_desertbase/desertbase_rockmudrockmedium_01/desertbase_rockmudrockmedium_01_mesh', { ...MID, n: 60, within: [12, 420], scale: [0.8, 2.2], sink: 0.15 }],
    ['game:objects/nature/desert/jabbaspalace/rancorpit_rocks_01/rancorpit_cave_rockmedium_04_mesh', { ...MID, n: 30, within: [20, 460], scale: [0.8, 1.6], sink: 0.2 }],
  ],
  // Sorgan's woods: Yavin's small bushes and ground shrubs, Kashyyyk's
  // small scheffleras, the forest's logs and rocks
  woods: [
    ['game:objects/nature/yavin/_yavinbase/_meshscattering/ms_yavinbase_smallbush_07/ms_yavinbase_smallbush_07_mesh', { ...COVER, n: 120, within: [6, 160], scale: [0.8, 1.3] }],
    ['game:objects/nature/yavin/_yavinbase/yavinbase_groundshrub_01/yavinbase_groundshrub_01_mesh', { ...COVER, n: 70, within: [8, 200], scale: [0.8, 1.3] }],
    ['game:objects/nature/yavin/_yavinbase/_meshscattering/ms_yavinbase_smallbush_05/ms_yavinbase_smallbush_05_mesh', { ...MID, n: 50, within: [10, 320], scale: [0.9, 1.4], solid: false }],
    ['game:objects/nature/kashyyyk/_kashyyykbase/_meshscattering/ms_kashyyykbase_schefflerabush_01/ms_kashyyykbase_schefflerabush_s_01_mesh', { ...MID, n: 40, within: [10, 320], scale: [0.8, 1.3], solid: false }],
    ['game:objects/nature/forest/_forestbase/forestbase_rockmedium_02/forestbase_rockmedium_02_mesh', { ...MID, n: 24, within: [16, 420], scale: [0.7, 1.4], sink: 0.2 }],
    ['game:objects/nature/forest/_forestbase/forestbase_rocksmall_02/forestbase_rocksmall_02_mesh', { ...MID, n: 30, within: [10, 360], scale: [0.7, 1.3], sink: 0.1 }],
  ],
  // Lothal's prairie: its mud rocks and boulders out in the grass (the
  // Empire's containers stand at its factory: sites/outer.js)
  'plains-imperial': [
    ['game:objects/nature/desert/_desertbase/desertbase_rockmudrockmedium_01/desertbase_rockmudrockmedium_01_mesh', { ...MID, n: 30, within: [16, 420], scale: [0.8, 1.8], sink: 0.15 }],
    ['game:objects/nature/desert/jabbaspalace/rancorpit_rocks_01/rancorpit_cave_rockmedium_03_mesh', { ...MID, n: 14, within: [40, 520], scale: [0.8, 1.4], sink: 0.3 }],
  ],
};

const SINK = (o) => (o.sink != null ? { sink: o.sink } : {});

export function gameRows(site, models = SURFACE_MODELS) {
  const recipe = RECIPES[site?.flora?.game];
  if (!recipe || site.noGround) return [];
  const density = site.flora.density ?? 1;
  return recipe
    .filter(([name]) => models[name])
    .map(([name, o]) => ({ band: o.band, kind: 'game', model: name, n: Math.round(o.n * density), within: o.within, scale: o.scale, solid: o.solid ?? true, flat: 0.86, ...(o.shadow === false ? { shadow: false } : {}), ...SINK(o) }));
}

export const recipeNames = (recipe) => (RECIPES[recipe] ?? []).map(([name]) => name);
