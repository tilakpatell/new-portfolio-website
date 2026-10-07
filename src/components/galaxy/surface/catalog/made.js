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
  // Tatooine: the Lars homestead's domed hut, its arched door and the
  // machinery against its walls (from a still of it at sunset)
  homestead: { made: 'meshy', as: 'the Lars homestead', metres: 9, along: 'x', detail: 'adobe' },
  // Tatooine: Jabba's palace, the keep, the watchtower and the rock it
  // stands on (the owner's model, retextured; its gate is built)
  // (remade by the audit lane from the Mandalorian's still of it)
  palace: { made: 'meshy', as: 'Jabba’s palace', metres: 75, along: 'x', lod: true, hero: true, detail: 'adobe', solids: 'built' },
  // Naboo: Theed's domed halls (from a concept image of one, which the
  // owner chose); its towers stay built
  theed: { made: 'meshy', as: "Theed's domed halls", metres: 35, along: 'x', hero: true, lod: true, styles: ['hall', 'rotunda'], detail: 'stone' },
  // The filled worlds' landmarks (scripts/meshy-galaxy-buildings-fill.mjs,
  // each lifted out of a film still or a production painting): where the
  // built one had decks and doors, they stay under the model (solids: 'built')
  // Yavin 4: the Great Temple, its hangar and tiers still walkable
  massassi: { made: 'meshy', lod: true, as: 'the Great Temple of Massassi', metres: 96, along: 'x', hero: true, solids: 'built' },
  // Endor: an Ewok hut (the village's, on their decks, scaled to each)
  ewokhut: { made: 'meshy', as: 'the Ewok huts', metres: 4, along: 'x' },
  // Naboo: Theed's royal palace on the cliff (its courtyard stays)
  theedpalace: { made: 'meshy', lod: true, as: "Theed's royal palace", metres: 132, along: 'x', hero: true, solids: 'built' },
  // Kamino: a dome of Tipoca City on its stilts (its towers stay the Sketchfab one)
  tipocadome: { made: 'meshy', lod: true, as: "Tipoca City's domes", metres: 44, along: 'x', hero: true },
  // Mustafar: the mining facility (its door and podium stay)
  mining: { made: 'meshy', lod: true, as: 'the Mustafar mining facility', metres: 120, along: 'x', hero: true, solids: 'built' },
  // Hoth: the v-150 Planet Defender (scripts/meshy-galaxy-buildings-bases.mjs,
  // lifted out of a still of it firing); its shot is the built ion cannon's
  v150: { made: 'meshy', as: 'the v-150 Planet Defender', metres: 26, along: 'x', detail: 'metal', look: { metalness: 0.2, roughness: 0.75 } }, // (pale weathered plate, as in the film, not chrome)
  // Scarif: the Citadel tower (the vault's door stays)
  citadel: { made: 'meshy', lod: true, as: 'the Citadel tower', metres: 170, along: 'y', hero: true, solids: 'built', detail: 'concrete', detailLook: { strength: 0.4, normal: 0.6, metres: 3 } },
  // Kashyyyk: a great wroshyr, from the picture of Kachirho's (the city tree itself stays built, for its decks)
  wroshyrgreat: { made: 'meshy', lod: true, as: 'the great wroshyrs', metres: 230, along: 'y', hero: true },
  // Coruscant: the Senate Building's dome (its plaza stays built)
  senate: { made: 'meshy', lod: true, as: 'the Senate Building', metres: 190, along: 'x', hero: true },
  // Dagobah: Yoda's hut (remade by the audit lane from the film's exterior)
  yodahut: { made: 'meshy', as: "Yoda's hut", metres: 10, along: 'x', hero: true, detail: 'adobe' },
  // The three worlds' lane (scripts/meshy-galaxy-three.mjs, each lifted out
  // of a film still or the game's render of Cloud City's streets): Cloud
  // City's towers (scattered round the deck in the built city's place) and
  // its plaza terraces, Dex's diner and the Outlander club (their floors and
  // doors stay the built ones'), 500 Republica
  cloudtower: { made: 'meshy', as: 'a tower of Cloud City', metres: 60, along: 'y' },
  cloudtower2: { made: 'meshy', as: 'a domed hall of Cloud City', metres: 40, along: 'y' },
  cloudplaza: { made: 'meshy', as: "Cloud City's plaza terraces", metres: 48, along: 'x', hero: true },
  dexdiner: { made: 'meshy', as: "Dex's Diner", metres: 22, along: 'x', solids: 'built', detail: 'metal' },
  club: { made: 'meshy', as: 'the Outlander Club', metres: 24, along: 'x', solids: 'built' },
  // (500 Republica remade by the audit lane: the tower's crown, 100 m across,
  // stood on a built shaft behind the built veranda)
  republica: { made: 'meshy', lod: true, hero: true, as: '500 Republica', metres: 100, along: 'x' },
  // Coruscant: a skyscraper of Galactic City
  corutower: { made: 'meshy', as: 'the towers of Galactic City', metres: 220, along: 'y' },
  // The audit lane (scripts/meshy-galaxy-audit.mjs; docs/research/
  // 2026-10-07-star-wars-buildings-audit.md): the buildings the audit found
  // poor or off-model, each lifted out of a screen still or a production
  // painting of the place as it is on screen
  // Coruscant: the Jedi Temple (the ziggurat and its five spires)
  jeditemple: { made: 'meshy', lod: true, hero: true, as: 'the Jedi Temple', metres: 200, along: 'x', detail: 'stone' },
  // Kashyyyk: Kachirho, the city tree itself (its bottom deck stays built)
  kachirho: { made: 'meshy', lod: true, hero: true, as: 'Kachirho', metres: 230, along: 'y', styles: ['tree'], detail: 'bark' },
  // Geonosis: the primary droid foundry's keep and its three spires
  foundry: { made: 'meshy', lod: true, hero: true, as: 'the droid foundry', metres: 100, along: 'y', detail: 'redrock', detailLook: { strength: 0.55, normal: 0.9 } },
  // Kamino: a tower of Tipoca City on its saucer (the domes are tipocadome's)
  tipoca: { made: 'meshy', lod: true, hero: true, as: "Tipoca City's towers", metres: 64, along: 'y', styles: ['tower'] },
  // Coruscant: the hooded Jedi of the Processional Way (the Senate plaza's stay built)
  statue: { made: 'meshy', as: 'the Jedi statues', metres: 28, along: 'y', styles: ['jedi'] },
  // Mustafar: Vader's castle (its landing bridge stays built)
  fortress: { made: 'meshy', lod: true, hero: true, as: "Vader's castle", metres: 120, along: 'y', detail: 'metal' },
  // Geonosis: Yoda's forward command center (its holotable is built beside it)
  commandpost: { made: 'meshy', as: 'the forward command center', metres: 17, along: 'x', detail: 'metal' },
  // Bespin: a tower of Cloud City, stepped, with its rims and slot windows
  cloudcity: { made: 'meshy', lod: true, as: 'Cloud City’s towers', metres: 60, along: 'y', detail: 'paint' },
  // Tatooine: Ben Kenobi's hut, the market stalls, the Tuskens' huts, the spires of Mos Eisley
  benhut: { made: 'meshy', as: 'Ben Kenobi’s hut', metres: 9, along: 'x', detail: 'adobe' },
  stall: { made: 'meshy', as: 'the market stalls', metres: 3.6, along: 'x' },
  tent: { made: 'meshy', as: 'the Tusken huts', metres: 5.5, along: 'x', styles: ['tusken'] },
  mosspire: { made: 'meshy', as: 'the spires of Mos Eisley', metres: 20, along: 'y', detail: 'adobe' },
  // Kashyyyk: a Wookiee treehouse (Chewbacca's, from the painting of it)
  wookieehouse: { made: 'meshy', as: 'the Wookiee houses', metres: 12, along: 'x', detail: 'wood' },
  // Mustafar: a panning droid, the platform the duellists ride
  droidplatform: { made: 'meshy', as: 'the panning droids', metres: 6.6, along: 'y', detail: 'metal' },
};
