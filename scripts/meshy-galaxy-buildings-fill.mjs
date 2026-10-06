// The "filled worlds" checkpoint's landmarks: the buildings that were still
// built in code after the two overhaul lanes (the Great Temple, Jabba's
// palace, the Lars homestead, Yoda's hut, an Ewok hut, Theed's palace,
// Tipoca's domes, the Mustafar facility, the Citadel tower, Kachirho's
// tree, a Coruscant tower), made by scripts/meshy-galaxy-buildings.mjs like
// its own and in its format (that script's header has the fields), each
// from a real picture of the place. Kept in a file of their own so no
// earlier lane's lines are touched; their tasks go in
// scripts/meshy-galaxy-buildings-fill-tasks.json (MESHY_TASKS).
//
//   MESHY_TASKS=scripts/meshy-galaxy-buildings-fill-tasks.json node scripts/meshy-galaxy-buildings.mjs <step> <kind …>
export const BUILDINGS = {
  // Yavin 4: the Great Temple (Rogue One's shot of it over the jungle);
  // its hangar's floors and walls stay the built one's (solids: 'built')
  massassi: {
    ref: 'File:Great Temple RO.png',
    crop: [0.1, 0.0, 0.8, 0.92],
    lift: 'the great stepped stone pyramid temple (wide square tiers of weathered grey-green stone blocks, a tall narrow tiered tower rising from the top, a dark hangar opening at the base)',
    metres: 96,
    along: 'w',
    tris: 40000,
    tex: 2048,
    hero: true,
  },
  // Tatooine: the crime lord's palace (The Mandalorian's shot of it; the
  // built one is 115 m across, and its door and the zone stay)
  palace: {
    ref: 'File:BobaFettsPalace-TMCh16.png',
    crop: [0.08, 0.0, 0.84, 0.86],
    lift: 'the great cylindrical sandstone fortress (one huge round drum with a wide overhanging domed roof, a tall slim cylindrical tower with a domed cap beside it and a smaller round domed outbuilding)',
    metres: 115,
    along: 'w',
    tris: 45000,
    tex: 2048,
    hero: true,
  },
  // Tatooine: the Lars homestead's entrance dome, the twin suns behind it
  homestead: {
    ref: 'File:YetAnotherTatooineSunset.jpg',
    crop: [0.2, 0.18, 0.6, 0.76],
    lift: 'the domed adobe entrance hut (a low wide dome of sun-bleached plaster with an arched doorway on one side, a small step down into the ground before it, and equipment cases and tanks against its base)',
    metres: 7.5,
    along: 'w',
    tris: 12000,
    tex: 1024,
  },
  // Dagobah: Yoda's hut (McQuarrie's painting of it under the trees)
  yodahut: {
    ref: 'File:RMQ-YodasHut.jpg',
    crop: [0.3, 0.33, 0.45, 0.5],
    lift: 'the small rounded clay hut (a lumpy white-grey mud dome with a round doorway and small round windows glowing warm)',
    metres: 6,
    along: 'w',
    tris: 12000,
    tex: 1024,
  },
  // Endor: a single Ewok hut (McQuarrie's painting of the village: the hut
  // on the ground)
  ewokhut: {
    ref: 'File:ST-ewokvillage.jpg',
    crop: [0.55, 0.52, 0.25, 0.3],
    lift: 'the round thatched hut (a squat round hut of woven sticks under a tall conical thatched roof, with one arched doorway)',
    metres: 4,
    along: 'w',
    tris: 8000,
    tex: 1024,
  },
  // Naboo: Theed's palace on the cliff (Doug Chiang's painting); its
  // courtyard floor and the hall walls stay the built one's
  theedpalace: {
    ref: 'File:NabooRoyalPalace-TPMP.jpg',
    crop: [0.03, 0.0, 0.62, 0.72],
    lift: 'the palace of pale cream stone on top of the cliff (clustered green-grey domes of several sizes, slender round towers with pointed caps, arched colonnades and a bridge between two towers), without the cliff below it',
    metres: 132,
    along: 'w',
    tris: 45000,
    tex: 2048,
    hero: true,
  },
  // Kamino: one of Tipoca City's domed stilt buildings (The Clone Wars'
  // shot of the city)
  tipocadome: {
    ref: 'File:TipocaCity-CC.png',
    crop: [0.1, 0.22, 0.5, 0.65],
    lift: 'one domed building on stilts (a wide flat saucer-shaped grey dome on a ring of thin pylons, a tall tapering spire tower rising from its top), on its own',
    metres: 60,
    along: 'w',
    tris: 30000,
    tex: 2048,
    hero: true,
  },
  // Mustafar: the mining facility (the painting of it over the lava); its
  // door and podium stay the built one's
  mining: {
    ref: 'File:KCMMiningFacility-TotR.png',
    crop: [0.22, 0.08, 0.56, 0.78],
    lift: 'the industrial mining structure (a tall latticed crane tower of rust-red steel, great round ribbed collector drums hanging from gantries, catwalks and platforms with small lights), without the rock cliffs or the lava',
    metres: 120,
    along: 'w',
    tris: 45000,
    tex: 2048,
    hero: true,
  },
  // Scarif: the Citadel tower (the film's shot of it from the air); the
  // vault's door stays the built one's
  citadel: {
    ref: 'File:CitadelTowerDestroyedStarWars.png',
    crop: [0.4, 0.06, 0.24, 0.76],
    lift: 'the tall dark grey tower (a slim tapering spire of dark panelled metal on a wide stepped base, a round dish and antenna at its top), without the green beam, the sky or the sea',
    metres: 170,
    along: 'h',
    tris: 40000,
    tex: 2048,
    hero: true,
  },
  // Kashyyyk: Kachirho's great tree with the city round it (Battlefront's
  // view of it); its decks stay the built one's
  kachirho: {
    ref: 'File:Kachirho BF2.jpg',
    crop: [0.0, 0.0, 0.5, 0.98],
    lift: 'the colossal ancient tree with the city built round its trunk (a vast grey-brown trunk and roots, tiered wooden platforms, huts and walkways clinging to it, a green canopy high above)',
    metres: 230,
    along: 'h',
    tris: 45000,
    tex: 2048,
    hero: true,
  },
  // Coruscant: a skyscraper of Galactic City (the film's shot of the
  // skyline: the hooked tower in front)
  corutower: {
    ref: 'File:Galactic City.png',
    crop: [0.08, 0.08, 0.22, 0.9],
    lift: 'the tall grey skyscraper (a slim curved tower with a hooked overhanging top, bands of windows all the way up)',
    metres: 220,
    along: 'h',
    tris: 20000,
    tex: 1024,
  },
};
