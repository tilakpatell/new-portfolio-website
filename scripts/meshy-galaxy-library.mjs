// The galaxy's library lane: the creatures, vehicles and ships the worlds
// and the fleets built in code (or went without) because nothing on
// Sketchfab was there to use, made by scripts/meshy-galaxy-buildings.mjs in
// its format (that script's header has the fields) from Wookieepedia's own
// picture of each, lifted onto a plain background. Two more fields here:
//   shot    what the lift (or the concept image) is asked to show, in place
//           of a building's three-quarter view
//   galaxy  a ship: written to public/models/galaxy/<kind>.glb for
//           galaxy/models.js, its far-off copy by scripts/galaxy-lod.mjs
// Their tasks go in scripts/meshy-galaxy-library-tasks.json.
//
//   MESHY_TASKS=scripts/meshy-galaxy-library-tasks.json node scripts/meshy-galaxy-buildings.mjs <step> <kind …>

const BEAST = 'The whole creature in frame, standing on all its feet, three-quarter view from the side, isolated on a plain light grey background, no rider, no people, no text, no ground.';
const FLIER = 'The whole creature in frame, wings spread, three-quarter view from slightly above, isolated on a plain light grey background, no people, no text.';
const VEHICLE = 'The whole vehicle in frame, three-quarter view from slightly above, isolated on a plain light grey background, no people, no pilot, no text, no ground.';
const SHIP = 'The whole starship in frame, three-quarter view from slightly above and in front, isolated on a plain light grey background, no stars, no planet, no people, no text.';

const beast = (ref, lift, metres, along = 'w', more = {}) => ({ ref, lift, shot: BEAST, metres, along, tris: 12000, tex: 1024, ...more });
const vehicle = (ref, lift, metres, along = 'w', more = {}) => ({ ref, lift, shot: VEHICLE, metres, along, tris: 15000, tex: 1024, ...more });
const ship = (ref, lift, more = {}) => ({ ref, lift, shot: SHIP, metres: 30, along: 'w', tris: 16000, tex: 1024, galaxy: true, ...more });

export const BUILDINGS = {
  // ── the creatures the worlds ask for ──
  tauntaun: beast('File:Tauntaun-SWE.png', 'the white furry bipedal snow lizard with curled horns', 2.5, 'h'),
  acklay: beast('File:Acklay-JTS.png', 'the green mantis-like arena beast on six long clawed legs', 6),
  kaadu: beast('File:Kaadu-SWCT.png', 'the orange duck-billed two-legged riding beast with its saddle', 2.4, 'h'),
  // (0.85 m: Beggar's Canyon's womp rats are scaled up 2.4 times, to 2 m)
  womprat: beast('File:Womprat-BOBFCE.png', 'the big brown rat-like desert rodent with its long bare tail', 0.85),
  bogwing: beast('File:Bogwing-TVE.png', 'the swamp flier with leathery wings and a long beak', 2.2, 'w', { shot: FLIER }),
  aiwha: beast('File:Aiwha-MF44.png', 'the blue-grey winged sea whale with its broad flat wings', 14, 'w', { shot: FLIER }),
  lavaflea: beast('File:LavaFlea-CVDNE.png', 'the dark armoured six-legged lava flea, without its rider', 5, 'h'),
  dragonsnake: {
    prompt: 'A huge swamp serpent: a long scaly olive-green and mottled brown sea-snake body as thick as a tree trunk, a broad flat crocodile-like head with rows of teeth and small yellow eyes, a ridge of short spines along its back, coiled in a lazy S-curve as if surfacing from murky water.',
    shot: BEAST,
    metres: 9,
    along: 'w',
    tris: 12000,
    tex: 1024,
  },
  // ── and the ones to come: the arena's, Utapau's, Lothal's, the Outer Rim's ──
  nexu: beast('File:Nexu2-SWE.png', 'the cat-like four-legged arena predator with its quills and split jaws', 4),
  reek: beast('File:Reek_SWCT.png', 'the horned red-faced arena bull beast', 5),
  varactyl: beast('File:Varactyl_DK.png', 'the green feathered lizard mount with its crest and long tail', 10, 'w', { yaw: 0.5 }),
  lothcat: beast('File:LothCat-AG.png', 'the white spotted cat-like loth-cat with its big ears', 0.6, 'h', { yaw: 0.7 }),
  lothwolf: beast('File:LothWolf-2025ToppsSWHyperspace.png', 'the huge pale blue-white wolf', 2.4, 'h', { yaw: -0.6 }),
  blurrg: beast('File:Blurrg-TSWB.png', 'the grey two-legged blurrg with its huge toothy mouth', 2.6, 'h'),
  happabore: beast('File:Happabore.png', 'the big grey snouted hippo-like happabore', 5),
  fambaa: beast('File:Fambaa-SWE.png', 'the huge four-legged swamp lizard with its riding harness', 11),
  // ── the vehicles the worlds ask for, and more ──
  mtt: vehicle('File:MTT_BF2.png', 'the huge rust-brown droid troop carrier with its bulbous front', 31),
  bongo: vehicle('File:GunganBongo-SWESOV.png', 'the organic blue-grey submarine with its three bubble cockpits and tail fins', 15),
  skiff: vehicle('File:BanthaIICargoSkiff-CGSWG.png', 'the flat open-decked desert cargo skiff with its railings and rear engine', 9),
  stap: vehicle('File:STAP-SWCT.png', 'the single-trooper flying platform with its tall handlebar mast, without its droid', 4, 'h'),
  atdp: vehicle('File:ATDP-Fathead.png', 'the two-legged white armoured walker with its boxy cockpit', 8.5, 'h'),
  flash: vehicle('File:FlashSpeederAft-SWE.png', 'the low turquoise twin-seat landspeeder with its rear gun', 6),
  itt: vehicle('File:Imperial-troop-dropship.png', 'the grey armoured hover troop transport', 13),
  swoop: {
    prompt: 'A desert racing hover-bike: a long narrow engine pod with a big round intake at the front and twin exhausts at the back, a small exposed rider saddle and handlebars at the rear, dull red and rusted grey metal plating, no rider.',
    shot: VEHICLE,
    metres: 4,
    along: 'w',
    tris: 12000,
    tex: 1024,
  },
  // ── the worlds' landmarks still built in code: each over the built one's
  // walls and decks (solids: 'built'), so its doors and floors still work ──
  cantina: {
    mirror: true,
    prompt: 'A desert spaceport tavern seen from outside: a large low whitewashed adobe dome about fourteen metres across, a smaller adobe dome joined to its side, a blocky square entrance vestibule at the front with a round dark doorway, small vent pipes and a short metal mast on top, sand-worn plaster with streaks and patches, sand drifted round the base.',
    metres: 18.5,
    along: 'w',
    tris: 20000,
    tex: 1024,
    solids: 'built',
  },
  varykino: { ref: 'File:Lake_Retreat_2.png', crop: [0.42, 0.08, 0.5, 0.8], lift: 'the cream-walled lakeside villa with its terracotta roofs, its green-domed tower, its terraces and balustrades, without the trees of the hillside', metres: 28, along: 'h', mirror: true, tris: 24000, tex: 2048, solids: 'built' },
  shieldgen: { ref: 'File:PlanetaryDeflectorShield.png', lift: 'the shield generator: the great dish turned to the sky on its tapering tower over a round base', metres: 70, along: 'h', tris: 16000, tex: 1024, solids: 'built' },
  // (Mustafar's collector, a library piece: its deck stands 4 m up on its
  // legs, where the duel's built deck is at 1 m, so the built one stays)
  lavacollector: {
    prompt: 'A heavy industrial lava-mining collector platform: a flat dark steel deck about sixteen metres by eleven with low railings, a leaning lattice tower with lamps at one end, a big scoop arm hanging off a crane boom over the side, scorched soot-blackened dark metal with glowing orange heat stains.',
    metres: 16,
    along: 'w',
    tris: 16000,
    tex: 1024,
  },
  stonehead: {
    prompt: 'A colossal ancient carved stone head of an amphibian-like creature, long droopy ear-like lobes hanging down either side, a heavy brow and a wide flat snout, weathered grey stone covered in green moss and lichen, cracked and partly broken.',
    metres: 7.5,
    along: 'h',
    tris: 12000,
    tex: 1024,
  },
  // ── the ships the galaxy built in code ──
  houndstooth: ship('File:HoundsTooth_3quarters_view-SWE.png', 'the bulky ochre boxy freighter with its long swept-back wing'),
  punishingone: ship('File:JM-5K.png', 'the crescent-shaped bounty hunter ship with its long central fuselage'),
  hammerhead: ship('File:Hammerhead_Corvette_USWNE.png', 'the long corvette with its tall hammer-shaped bridge at the front'),
  gauntlet: ship('File:Gauntlet-Mando.png', 'the grey swept-wing fighter-transport'),
  // ── and the films' and shows' others ──
  twilight: ship('File:Twilight-BMF66.png', 'the battered freighter with its curved wing and big rear engines'),
  scimitar: ship('File:Scimitar-USC.png', 'the sleek dark grey dagger-shaped ship with its curved fins'),
  tiedefender: ship('File:TIE_Defender.png', 'the TIE fighter with three triangular wings set round its cockpit ball'),
  vwing: ship('File:V-wing_BF2.png', 'the slim grey and red fighter with its tall folded wings'),
  eta2: ship('File:Eta-2JediInterceptor-USC.png', 'the small white and red delta interceptor with its wing-flaps up'),
  hyena: ship('File:HyenaBomber-SWE.png', 'the dark blue-grey droid bomber with its bent wings'),
  sentinel: ship('File:SentinelClassLandingCraft-CGSWG.png', 'the white three-winged landing craft'),
  zeta: ship('File:Zeta-class_shuttle_ROUVG.png', 'the grey cargo shuttle with its tall folding wings'),
  fang: ship('File:FangFighrter-SWESOV.png', 'the narrow Mandalorian fighter with its swept wings'),
  naboocruiser: ship('File:Nabooskiff-SWCTP.png', 'the gleaming chrome boomerang-shaped yacht'),
  tiestriker: ship('File:TIE-Striker-SWCT.png', 'the TIE with its two long flat swept wings'),
};
