// The surface models made for this site with Meshy (meshy.ai, the site
// owner's account) where nothing on Sketchfab was right: each from a real
// picture of the thing (a film still or a production painting, lifted onto
// a plain background), or one of the owner's own models retextured. Made
// by scripts/meshy-galaxy-buildings.mjs, written to
// public/models/galaxy/surface/<kind>.glb like the Sketchfab ones (standing
// on y = 0, facing +z, in metres) and listed in public/cc0/README.md (not
// in the Sketchfab credits). Fields as in the other groups, and:
//   made    'meshy'
//   hero    a landmark: allowed a bigger file (4 MB) for its 2K maps
//   lod     a <kind>.lod1.glb sits beside it, for far away
//   solids  'built': walls and floors from the built one (props/*.js), so
//           its decks and doors still work under the model
//   styles  the built one's styles (opts.style) the model stands in for;
//           the others stay built
//   detail  a scan (kit.js's roles: 'stone', 'adobe', 'metal'…) laid over
//           it up close (detail.js); detailLook: withDetail's options
export const MODELS = {
  // Naboo: Theed's domed halls (from a concept image of one, which the
  // owner chose); its towers stay built
  theed: { made: 'meshy', as: "Theed's domed halls", metres: 35, along: 'x', hero: true, lod: true, styles: ['hall', 'rotunda'], detail: 'stone' },
  // The filled worlds' landmarks (scripts/meshy-galaxy-buildings-fill.mjs,
  // each lifted out of a film still or a production painting): where the
  // built one had decks and doors, they stay under the model (solids: 'built')
  // Yavin 4: the Great Temple, its hangar and tiers still walkable
  massassi: { made: 'meshy', lod: true, as: 'the Great Temple of Massassi', metres: 96, along: 'x', hero: true, solids: 'built' },
  // Tatooine: Jabba's palace (its gate and the court inside stay)
  palace: { made: 'meshy', lod: true, as: "Jabba's palace", metres: 115, along: 'x', hero: true, solids: 'built' },
  // Tatooine: the Lars homestead's entrance dome
  homestead: { made: 'meshy', as: 'the Lars homestead', metres: 7.5, along: 'x', solids: 'built' },
  // Endor: an Ewok hut (the village's, on their decks, scaled to each)
  ewokhut: { made: 'meshy', as: 'the Ewok huts', metres: 4, along: 'x' },
  // Naboo: Theed's royal palace on the cliff (its courtyard stays)
  theedpalace: { made: 'meshy', lod: true, as: "Theed's royal palace", metres: 132, along: 'x', hero: true, solids: 'built' },
  // Kamino: a dome of Tipoca City on its stilts (its towers stay the Sketchfab one)
  tipocadome: { made: 'meshy', lod: true, as: "Tipoca City's domes", metres: 44, along: 'x', hero: true },
  // Mustafar: the mining facility (its door and podium stay)
  mining: { made: 'meshy', lod: true, as: 'the Mustafar mining facility', metres: 120, along: 'x', hero: true, solids: 'built' },
  // Scarif: the Citadel tower (the vault's door stays)
  citadel: { made: 'meshy', lod: true, as: 'the Citadel tower', metres: 170, along: 'y', hero: true, solids: 'built' },
  // Kashyyyk: a great wroshyr, from the picture of Kachirho's (the city tree itself stays built, for its decks)
  wroshyrgreat: { made: 'meshy', lod: true, as: 'the great wroshyrs', metres: 230, along: 'y', hero: true },
  // Coruscant: a skyscraper of Galactic City
  corutower: { made: 'meshy', as: 'the towers of Galactic City', metres: 220, along: 'y' },
};
