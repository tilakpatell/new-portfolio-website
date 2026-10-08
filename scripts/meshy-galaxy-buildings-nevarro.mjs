// Nevarro's lane (docs/superpowers/HANDOFF-nevarro-rebuild.md): the city's
// grey plaster houses and domes, its gate, the Imperial base on its cliff,
// the cantina, the Charon River's tunnel and its keelboat, made by
// scripts/meshy-galaxy-buildings.mjs like its own and in its format (that
// script's header has the fields). Lifted out of the show's stills where one
// shows the thing whole; from words where none does. Their tasks go in
// scripts/meshy-galaxy-buildings-nevarro-tasks.json (MESHY_TASKS).
//
//   MESHY_TASKS=scripts/meshy-galaxy-buildings-nevarro-tasks.json node scripts/meshy-galaxy-buildings.mjs <step> <kind …>

// the city's stone: grey plaster over black volcanic rock, stained and worn
const STONE = 'thick sloping walls of weathered grey plaster stained dark at the foot, over rough black volcanic stone';

export const BUILDINGS = {
  // a big round house under a ribbed stone dome, set in the lava rock (the
  // landing yard outside the gate, first season)
  nevarrodomehouse: {
    ref: 'File:NevarroCitySpaceport.png',
    crop: [0.265, 0.42, 0.135, 0.22],
    lift: 'the large round stone house (a low round drum wall with a big ribbed grey dome on top), without the rocks in front of it',
    metres: 10,
    along: 'w',
    tris: 12000,
    tex: 1024,
  },
  // a squat grey plaster house with a low dome on its roof (the street the
  // flame trooper burns, the first season's last chapter)
  nevarrohouse: {
    ref: 'File:FlameOn-TMCh8.png',
    crop: [0.575, 0, 0.425, 0.72],
    lift: 'the squat grey plaster building (thick sloping stained walls, two round-headed recessed doorways, a low dome on its flat roof), without the trooper, the fire or the bodies in front of it',
    metres: 12,
    along: 'w',
    tris: 12000,
    tex: 1024,
  },
  // the city's gate: a tall weathered stone arch with a round top, the ships
  // landing outside it (the first season)
  nevarrogate: {
    ref: 'File:NevarroCitySpaceport.png',
    crop: [0.455, 0.16, 0.18, 0.67],
    lift: 'the tall weathered stone archway alone (two thick square stone pillars and a round-topped stone arch across them), without the town or the hills behind it',
    metres: 14,
    along: 'h',
    tris: 10000,
    tex: 1024,
  },
  // the third season's city: a round tower of white fluted plaster under a
  // ringed dome cap (for the hill over the streets)
  nevarrotower: {
    ref: 'File:Showdown on Nevarro.png',
    crop: [0.52, 0.36, 0.11, 0.44],
    lift: 'the round white plaster tower behind the man (three storeys, its wall in tall vertical fluted panels, a ringed domed cap), whole, without the man',
    metres: 16,
    along: 'h',
    tris: 12000,
    tex: 1024,
  },
  // the Imperial base: a long, low, many-levelled slab of cold blue-grey
  // armour along a cliff over a lava canyon (the second season)
  nevarrobase: {
    ref: 'File:NevarroImperialBase.png',
    crop: [0.06, 0.12, 0.88, 0.6],
    lift: 'the long low armoured Imperial base alone (a multi-level slab of cold blue-grey metal plating with round coolant tanks, gantries and a landing pad), off its cliff, without the rocks or the canyon',
    shot: 'The whole facility in frame, three-quarter view from slightly above, isolated on a plain light grey background, no people, no vehicles, no text, no ground.',
    metres: 52,
    along: 'w',
    tris: 24000,
    // (1024 like the rest: the metal scan covers it up close)
    tex: 1024,
  },
  // Greef Karga's cantina, as the city's own: grey plaster over black stone
  // (the Mos Eisley one, white, stood here before)
  nevarrocantina: {
    prompt: `A low frontier cantina hall half sunk among black lava rock, about 18 metres wide and 9 tall: ${STONE}, a wide round-headed doorway at the front with a heavy wooden door, round porthole windows, a low ribbed dome on the roof, small vent pipes and an old sign bracket, cables and lanterns on the walls.`,
    metres: 18.5,
    along: 'w',
    tris: 16000,
    tex: 1024,
  },
  // a street front: three houses joined into one wall, for the trench streets
  nevarrorow: {
    prompt: `A row of three attached frontier town houses forming one straight street frontage, about 20 metres long and 7 metres tall: ${STONE}, round-headed recessed doorways, small porthole windows, wall lanterns, a sagging cloth awning over one door, low ribbed domes on the flat roofs.`,
    metres: 20,
    along: 'w',
    tris: 14000,
    tex: 1024,
  },
  // the Charon River's tunnel mouth: where the lava runs out of the city's
  // sewers to the flats
  charonportal: {
    prompt: 'The round arched mouth of a lava tunnel cut into a low ridge of rough black volcanic rock, about 16 metres wide and 11 metres tall: a ribbed stone-vaulted tunnel going back into darkness, crusted dark rock round the opening, glowing orange lava cracks along the floor at the edges, seen from outside.',
    metres: 16,
    along: 'w',
    tris: 12000,
    tex: 1024,
  },
  // the keelboat the heroes rode down the Charon (the first season's last chapter)
  keelboat: {
    prompt: 'A long flat-bottomed metal river barge about 9 metres long: low riveted dark grey sides scorched by heat, a squared bow, a small raised steering post at the stern with a tall pole, a few crates on its open deck, no people.',
    shot: 'The whole boat in frame, three-quarter view from slightly above, isolated on a plain light grey background, no water, no people, no text.',
    metres: 9,
    along: 'w',
    tris: 10000,
    tex: 1024,
  },
};
