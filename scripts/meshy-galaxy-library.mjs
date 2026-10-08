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
//   node scripts/meshy-galaxy-library.mjs <step> [--ultra] <kind …>   (the same, with this lane's tasks file and review folder)
//
// --ultra makes the ultra level's cut beside the plain one: `models --ultra`
// asks Meshy again at its most polygons, `fetch --ultra` writes
// <kind>.ultra.glb (scripts/meshy-galaxy-buildings.mjs's header has it).

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BEAST = 'The whole creature in frame, standing on all its feet, three-quarter view from the side, isolated on a plain light grey background, no rider, no people, no text, no ground.';
const FLIER = 'The whole creature in frame, wings spread, three-quarter view from slightly above, isolated on a plain light grey background, no people, no text.';
const VEHICLE = 'The whole vehicle in frame, three-quarter view from slightly above, isolated on a plain light grey background, no people, no pilot, no text, no ground.';
const SHIP = 'The whole starship in frame, three-quarter view from slightly above and in front, isolated on a plain light grey background, no stars, no planet, no people, no text.';

const beast = (ref, lift, metres, along = 'w', more = {}) => ({ ref, lift, shot: BEAST, metres, along, tris: 12000, tex: 1024, ...more });
const vehicle = (ref, lift, metres, along = 'w', more = {}) => ({ ref, lift, shot: VEHICLE, metres, along, tris: 15000, tex: 1024, ...more });
const ship = (ref, lift, more = {}) => ({ ref, lift, shot: SHIP, metres: 30, along: 'w', tris: 16000, tex: 1024, galaxy: true, ...more });
// The galaxy's worst models made again (a flat-shaded wedge, a blurred
// sphere of grey discs, a blotchy scan, a muddy paint job): Meshy's maps at
// 4K, which cost the same 30 credits as 2K and come down sharper, squeezed
// with the colour map at `tex` and the rest at half that, so each stays
// inside its kind's budget (a fighter 450 KB, a capital 900 KB). Where there
// are two pictures, each lift keeps its own picture's angle, so multi-image
// to 3D sees the ship from two sides. Each comes nose to -x, as the library's
// others did, and is turned nose to +z here (`yaw`), so galaxy/models.js
// keeps the nose it had for the file it replaces.
const KEEP = 'The whole starship in frame, seen from the same angle as in the picture, isolated on a plain light grey background, no stars, no planet, no people, no text.';
const remake = (ref, lift, more = {}) => ship(ref, lift, { texture: '4k', split: true, yaw: Math.PI / 2, error: 0.01, ...(Array.isArray(ref) ? { shot: KEEP } : {}), ...more });

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
  bongo: vehicle('File:GunganBongo-SWESOV.png', 'the organic blue-grey submarine with its three bubble cockpits and tail fins', 15, 'w', { yaw: Math.PI / 2 }),
  skiff: vehicle('File:BanthaIICargoSkiff-CGSWG.png', 'the flat open-decked desert cargo skiff with its railings and rear engine', 9, 'w', { yaw: Math.PI / 2 }),
  stap: vehicle('File:STAP-SWCT.png', 'the single-trooper flying platform with its tall handlebar mast, without its droid', 4, 'h', { yaw: Math.PI / 2 }),
  atdp: vehicle('File:ATDP-Fathead.png', 'the two-legged white armoured walker with its boxy cockpit', 8.5, 'h'),
  flash: vehicle('File:FlashSpeederAft-SWE.png', 'the low turquoise twin-seat landspeeder with its rear gun', 6, 'w', { yaw: Math.PI / 2 }),
  itt: vehicle('File:Imperial-troop-dropship.png', 'the grey armoured hover troop transport', 13, 'w', { yaw: Math.PI / 2 }),
  swoop: {
    yaw: Math.PI / 2,
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
  // Dagobah's dragonsnake: only its head and neck, reared up out of the pool
  // (the built coils stay, circling under it). The first, from words, came
  // out an Earth crocodile; this one is lifted from a painting of it.
  dragonsnake: beast('File:Dragonsnake SM.png', 'the dark scaly swamp serpent\'s head and long neck, its jaws gaping full of long teeth, the ragged fins along its neck, without the water, the trees or the fliers', 4.5, 'h', {
    crop: [0.42, 0.24, 0.45, 0.76],
    shot: 'Only the head and the long curved neck, rearing upright as from water, cut off cleanly at the bottom; three-quarter view from the side, isolated on a plain light grey background, no water, no splash, no other creatures, no text.',
  }),
  // ── the ships the galaxy built in code ──
  // (a second take, lifted harder for crisp edges, came out with a fin
  // floating loose off the hull and a boat's stern: dropped, this one stays)
  houndstooth: ship('File:HoundsTooth_3quarters_view-SWE.png', 'the bulky ochre boxy freighter with its long swept-back wing'),
  punishingone: ship('File:JM-5K.png', 'the crescent-shaped bounty hunter ship with its long central fuselage'),
  hammerhead: ship('File:Hammerhead_Corvette_USWNE.png', 'the long corvette with its tall hammer-shaped bridge at the front'),
  gauntlet: ship('File:Gauntlet-Mando.png', 'the grey swept-wing fighter-transport'),
  // ── and the films' and shows' others ──
  twilight: ship('File:Twilight-BMF66.png', 'the battered freighter with its curved wing and big rear engines'),
  scimitar: ship('File:Scimitar-USC.png', 'the sleek dark grey dagger-shaped ship with its curved fins'),
  // (the first take's picture was a plain TIE; this one's the Striker itself)
  tiestriker: ship('File:TIE-Striker-SWCT.png', 'the grey atmospheric TIE fighter with its long flat cockpit pod and two angled tapering wings bent down at the middle'),
  tiedefender: ship('File:TIE_Defender.png', 'the TIE fighter with three triangular wings set round its cockpit ball'),
  vwing: ship('File:V-wing_BF2.png', 'the slim grey and red fighter with its tall folded wings'),
  eta2: ship('File:Eta-2JediInterceptor-USC.png', 'the small white and red delta interceptor with its wing-flaps up'),
  hyena: ship('File:HyenaBomber-SWE.png', 'the dark blue-grey droid bomber with its bent wings'),
  sentinel: ship('File:SentinelClassLandingCraft-CGSWG.png', 'the white three-winged landing craft'),
  zeta: ship('File:Zeta-class_shuttle_ROUVG.png', 'the grey cargo shuttle with its tall folding wings'),
  fang: ship('File:FangFighrter-SWESOV.png', 'the narrow Mandalorian fighter with its swept wings'),
  naboocruiser: ship('File:Nabooskiff-SWCTP.png', 'the gleaming chrome boomerang-shaped yacht'),
  // ── and the galaxy's worst models made again, each over its old file ──
  // (the half-built station: the better image model for the lift, since the
  // open side's girders are what the old one lost)
  deathstar2: remake('File:DeathStar2.jpg', 'the half-built spherical battle station, the open side showing its exposed skeletal superstructure of girders and decks, its round dish in the upper half', {
    shot: 'The whole space station in frame, seen from the same angle as in the picture, isolated on a plain light grey background, no stars, no planet, no ships, no text.',
    lifter: 'nano-banana-pro',
    ai: 'meshy-5',
    texture: '2k', // (the older model makes no 4K maps)
    tris: 40000,
    tex: 2048,
  }),
  interdictor: remake('File:Immobilizer Interdictor Cruiser.jpg', 'the grey wedge-shaped warship with four large domed gravity-well projectors on its back and a stepped bridge tower', { lifter: 'nano-banana-pro', tris: 20000, tex: 1536, quality: 75 }),
  // (the galaxy's own corvette: the universe map keeps its smaller one)
  corvette: remake(['File:Rebels-TantiveIVConceptArt-CroppedBackground.png', 'File:CR90corvette-BTMF18.png'], 'the long white corvette with its red trim, a hammer-shaped cockpit block at the front, a thin spine and a wide block of eleven engines at the back', { lifter: 'nano-banana-pro', tris: 12000, tex: 768, quality: 75 }),
  interceptor: remake('File:TIE Interceptor BF.png', 'the fighter with a ball cockpit and two dagger-shaped dark solar wings with notched tips', { tris: 9000, tex: 768, quality: 80 }),
  munificent: remake(['File:CISMunificent-TCW.png', 'File:MunificentAft-USWNE.png'], 'the long grey frigate with its dark blue stripes, its tall communications spine at the bow and its long narrow side wings', { lifter: 'nano-banana-pro', tris: 16000, tex: 1536, quality: 75 }),
  providence: remake(['File:ProvidenceClassDreadnought-SWM42.png', 'File:InvisibleHand-MF75.png'], 'the long grey warship with its blue stripe bands, its tall thin bridge tower and the hangar opening at its bow', { lifter: 'nano-banana-pro', tris: 16000, tex: 1536, quality: 75 }),
  // (over the universe map's, which the galaxy's bounty hunter flies too)
  slave1: remake(['File:BobaFettsStarship-MF65.png', 'File:BobaFettsStarshipAft-MF65.png'], 'the green and red patrol craft with its rounded hull, its two curved wing plates and its twin cannons', { tris: 12000, tex: 768, quality: 80, turn: [0.5, 0.5, 0.5, 0.5], out: 'models/universe/slave1.glb' }),
  // (the pirates' fighter, for the kind the galaxy calls a skiff: named apart
  // from the surfaces' cargo skiff. Made once and turned down, a lumpy disc
  // that read as nothing, so the skiff keeps its built model)
  pirateskiff: remake('File:Flarestar-class-attack-shuttle-SWESV.png', 'the battered disc-shaped grey and white pirate attack shuttle with its red markings and its two cockpit canopies', { tris: 8000, yaw: 0 }),
  tieadvanced: remake(['File:Rebels TIE Advanced x1 Fathead.png', 'File:TIEAdvancedx1-MF78.png'], 'the fighter with a ball cockpit, a long rear hull and two bent dark solar wings', { tris: 12000 }),
  tiebomber: remake('File:TIE Bomber BF2.png', 'the twin-hulled bomber, a ball cockpit beside a long ordnance pod, between two bent dark solar wings', { tris: 12000 }),
  awing: remake('File:A-wing DICE.png', 'the small wedge-shaped red and white fighter with its two big engines at the back and a cannon on each wingtip', { tris: 12000 }),
  tie: remake(['File:TIE Fighter DICE.png', 'File:TIE-Fighter-RO-SWCT.png'], 'the fighter with a ball cockpit between two flat hexagonal dark solar wings', { tris: 12000 }),
  moncal: remake(['File:HomeOneEngines-Chron.png', 'File:HomeOne-SWArmada.jpg'], 'the long rounded organic grey cruiser, bulbous and pod-shaped, its bank of engines at the back', { lifter: 'nano-banana-pro', tris: 30000, tex: 2048 }),
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const here = dirname(fileURLToPath(import.meta.url));
  const env = { ...process.env, MESHY_TASKS: process.env.MESHY_TASKS ?? 'scripts/meshy-galaxy-library-tasks.json', MESHY_REVIEW: process.env.MESHY_REVIEW ?? join(here, '..', 'lab', 'meshy', 'library') };
  const r = spawnSync(process.execPath, [join(here, 'meshy-galaxy-buildings.mjs'), ...process.argv.slice(2)], { stdio: 'inherit', env });
  process.exitCode = r.status ?? 1;
}
