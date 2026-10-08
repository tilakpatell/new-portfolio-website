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
  // Naboo: Theed's domed halls (from a concept image of one, which the
  // owner chose); its towers stay built
  theed: { made: 'meshy', as: "Theed's domed halls", metres: 35, along: 'x', hero: true, lod: true, styles: ['hall', 'rotunda'], detail: 'stone', tint: '#f2d6c2', ultra: { tris: 125793, tex: 8192 } },
  // The filled worlds' landmarks (scripts/meshy-galaxy-buildings-fill.mjs,
  // each lifted out of a film still or a production painting): where the
  // built one had decks and doors, they stay under the model (solids: 'built')
  // Yavin 4: the Great Temple, its hangar and tiers still walkable
  massassi: { made: 'meshy', lod: true, as: 'the Great Temple of Massassi', metres: 96, along: 'x', hero: true, solids: 'built', detail: 'stone', ultra: { tris: 159998, tex: 8192 } },
  // Endor: an Ewok hut (the village's, on their decks, scaled to each)
  ewokhut: { made: 'meshy', as: 'the Ewok huts', metres: 4, along: 'x', tint: '#8a8068' },
  // Naboo: Theed's royal palace on the cliff (its courtyard stays)
  theedpalace: { made: 'meshy', lod: true, as: "Theed's royal palace", metres: 132, along: 'x', hero: true, solids: 'built', tint: '#ecd8bc', detail: 'stone' },
  // Kamino: a dome of Tipoca City on its stilts (its towers are the audit lane's)
  // (ultra: made again from the city shot's rounded dome on stilts, scripts/meshy-galaxy-ultra.mjs)
  tipocadome: { made: 'meshy', lod: true, as: "Tipoca City's domes", metres: 44, along: 'x', hero: true, ultra: { tris: 119997, tex: 8192 } },
  // Mustafar: the mining facility (its door and podium stay)
  mining: { made: 'meshy', lod: true, as: 'the Mustafar mining facility', metres: 120, along: 'x', hero: true, solids: 'built', ultra: { tris: 179999, tex: 8192 } },
  // Hoth: the v-150 Planet Defender (scripts/meshy-galaxy-buildings-bases.mjs,
  // lifted out of a still of it firing); its shot is the built ion cannon's
  v150: { made: 'meshy', as: 'the v-150 Planet Defender', metres: 26, along: 'x', detail: 'metal', look: { metalness: 0.2, roughness: 0.75 } }, // (pale weathered plate, as in the film, not chrome)
  // Scarif: the Citadel tower (the vault's door stays)
  citadel: { made: 'meshy', lod: true, as: 'the Citadel tower', metres: 170, along: 'y', hero: true, solids: 'built', detail: 'concrete', detailLook: { strength: 0.4, normal: 0.6, metres: 3 }, ultra: { tris: 160000, tex: 8192 } },
  // Kashyyyk: a great wroshyr, from the picture of Kachirho's (the city tree
  // itself stays built, for its decks), re-centred on its trunk's foot
  // (ultra: made again from the tall straight-trunked tree at the right of the Kachirho panorama, scripts/meshy-galaxy-ultra.mjs)
  wroshyrgreat: { made: 'meshy', lod: true, as: 'the great wroshyrs', metres: 230, along: 'y', hero: true, detail: 'bark', detailLook: { strength: 0.5, metres: 4 }, ultra: { tris: 179999, tex: 8192 } },
  // Coruscant: the Senate Building's dome (its plaza stays built)
  senate: { made: 'meshy', lod: true, as: 'the Senate Building', metres: 190, along: 'x', hero: true, ultra: { tris: 159999, tex: 8192 } },
  // The three worlds' lane (scripts/meshy-galaxy-three.mjs, each lifted out
  // of a film still or the game's render of Cloud City's streets): Cloud
  // City's towers (scattered round the deck in the built city's place) and
  // its plaza terraces, Dex's diner and the Outlander club (their floors and
  // doors stay the built ones'), 500 Republica
  cloudtower: { made: 'meshy', as: 'a tower of Cloud City', metres: 60, along: 'y', ultra: { tris: 41798, tex: 8192 } },
  cloudtower2: { made: 'meshy', as: 'a domed hall of Cloud City', metres: 40, along: 'y', ultra: { tris: 44200, tex: 8192 } },
  // (ultra: made again as the stepped terraces round an open court, scripts/meshy-galaxy-ultra.mjs)
  cloudplaza: { made: 'meshy', as: "Cloud City's plaza terraces", metres: 48, along: 'x', hero: true, ultra: { tris: 79998, tex: 8192 } },
  dexdiner: { made: 'meshy', as: "Dex's Diner", metres: 22, along: 'x', solids: 'built' },
  club: { made: 'meshy', as: 'the Outlander Club', metres: 24, along: 'x', solids: 'built' },
  republica: { made: 'meshy', as: '500 Republica', metres: 330, along: 'y' },
  // Coruscant: a skyscraper of Galactic City
  corutower: { made: 'meshy', as: 'the towers of Galactic City', metres: 220, along: 'y' },
};
