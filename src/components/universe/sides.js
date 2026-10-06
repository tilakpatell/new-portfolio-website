// The sides: whose universe each crew flies in, as data. Pick a crew and
// the whole map is theirs: who comes after you (the hunters' factions, by
// role), who helps (the wing that comes in a long fight, a convoy's
// escort), who passes by (the everyday traffic and the civilians, who calls
// for help and who's after them), what the director can set going (the set
// pieces), what enormous thing passes, and who comes at you on the ground.
// Every system on the map reads its crew's side from here instead of
// switching on a family of its own: scene.js, director.js, traffic.js,
// hunters.js, wingmen.js, skirmishes.js, leviathans.js, footScene.js and
// the wire (online/protocol.js). Pure (no three.js), so it's tested in
// Node; the design is docs/superpowers/specs/2026-10-06-universe-sides-design.md.
//
// A faction: { kinds: [[hunter kind, weight]…], ace?, laser: [r, g, b],
//   size: [least, most], role: 'hunt' (what a hunt sends, by `weight`) |
//   'bounty' (one tough one alone) | 'capital' (what a capital ship
//   launches) | 'council' (out of portals), weight?, portal? }
// A hunter kind: hunterRules.js's row (size, speed, accel, hp, fire, tail,
//   lead, spread, trait: one of hunterRules.js's TRAITS); an ally: wingRules.js's row, with its bolts' colour.
// A troop: foot.js's TROOPS row by kind, with the gun it holds (gunplay.js's
//   GUNS) or null.

// a weighted pick from [[id, weight]…]
const weighted = (list, rand) => {
  let r = rand() * list.reduce((s, [, w]) => s + w, 0);
  for (const [id, w] of list) if ((r -= w) <= 0) return id;
  return list[list.length - 1]?.[0] ?? null;
};

const STARWARS = {
  id: 'starwars',
  label: 'A galaxy far, far away',
  crews: ['xwing', 'falcon'],
  factions: {
    empire: { role: 'hunt', weight: 1, kinds: [['tie', 3], ['interceptor', 2], ['tiebomber', 1]], ace: 'tieadvanced', laser: [0.5, 5.5, 0.9], size: [3, 5] },
    // what the Star Destroyer launches: bombers and a gunboat among the TIEs
    navy: { role: 'capital', weight: 1, kinds: [['tie', 2], ['tiebomber', 2], ['gunboat', 1]], laser: [0.5, 5.5, 0.9], size: [3, 4] },
    // bounty hunters: one at a time, tough and quick (director.js's bounty)
    fett: { role: 'bounty', weight: 1, kinds: [['slave1', 1]], laser: [5.5, 0.9, 0.5], size: [1, 1] },
    ig88: { role: 'bounty', weight: 1, kinds: [['ig2000', 1]], laser: [5.5, 1.2, 0.5], size: [1, 1] },
    bossk: { role: 'bounty', weight: 1, kinds: [['houndstooth', 1]], laser: [5.5, 2.4, 0.5], size: [1, 1] },
    dengar: { role: 'bounty', weight: 1, kinds: [['punishingone', 1]], laser: [5.5, 0.8, 0.8], size: [1, 1] },
    // pirates: Weequay skiffs, after anyone with cargo
    weequay: { role: 'pirates', weight: 1, kinds: [['skiff', 1]], laser: [6.0, 3.0, 0.6], size: [2, 3] },
  },
  kinds: {
    tie: { size: 0.3, speed: 19, accel: 17, hp: 1, fire: [0.8, 1.6] },
    interceptor: { size: 0.32, speed: 25, accel: 20, hp: 1, fire: [0.7, 1.3], tail: 0.25 },
    tieadvanced: { size: 0.36, speed: 26, accel: 22, hp: 5, fire: [0.45, 0.8], tail: 0.45, lead: 0.9, spread: 0.8 },
    slave1: { size: 0.55, speed: 24, accel: 20, hp: 6, fire: [0.5, 0.9], tail: 0.45, lead: 0.9, spread: 0.85 },
    // slow, and it means it: one bomb a run (hunterRules.js's traits)
    tiebomber: { size: 0.34, speed: 16, accel: 13, hp: 3, fire: [2.2, 3.2], trait: 'bomber' },
    gunboat: { size: 0.42, speed: 18, accel: 15, hp: 4, fire: [0.45, 0.8], spread: 1.3, trait: 'holdoff' },
    ig2000: { size: 0.5, speed: 25, accel: 21, hp: 6, fire: [0.45, 0.8], tail: 0.4, lead: 0.95, spread: 0.7 },
    houndstooth: { size: 0.62, speed: 22, accel: 18, hp: 8, fire: [0.6, 1.0], tail: 0.3, lead: 0.85, spread: 0.9 },
    punishingone: { size: 0.52, speed: 24, accel: 20, hp: 6, fire: [0.5, 0.9], tail: 0.5, lead: 0.9, spread: 0.85 },
    skiff: { size: 0.32, speed: 17, accel: 15, hp: 1, fire: [1.0, 1.8], spread: 1.4 },
  },
  names: { tie: 'TIE fighter', interceptor: 'TIE interceptor', tieadvanced: 'TIE Advanced', slave1: 'Slave I', tiebomber: 'TIE bomber', gunboat: 'Assault gunboat', ig2000: 'IG-2000', houndstooth: 'Hound’s Tooth', punishingone: 'Punishing One', skiff: 'Pirate skiff' },
  allies: {
    xwing: { speed: 24, accel: 20, turn: 2.6, fire: [0.9, 1.6], spread: 0.15, size: 0.36, colour: [5.5, 0.6, 0.5] },
    // Gold Squadron: slow, and their bolts hit hard
    ywing: { speed: 21, accel: 16, turn: 2.0, fire: [1.3, 2.1], spread: 0.1, size: 0.38, damage: 2, colour: [5.5, 1.2, 0.4] },
    // Green Squadron: quick, a few passes and gone
    awing: { speed: 30, accel: 26, turn: 3.2, fire: [0.6, 1.1], spread: 0.2, size: 0.3, stay: 3, tour: 18, colour: [5.5, 0.6, 0.5] },
  },
  traffic: ['tie', 'interceptor', 'tiebomber', 'xwing', 'ywing', 'awing', 'shuttle', 'destroyer', 'slave1'],
  civil: ['freighter', 'transport', 'corvette'],
  convoy: { escort: 'xwing' },
  distress: { civil: 'transport', pirates: 'weequay' },
  skirmish: { faction: 'empire', escort: 'xwing', civil: 'transport' },
  pieces: ['destroyer'],
  capital: 'navy', // what the Star Destroyer launches
  capitalShip: 'destroyer', // (the model the director's capital ship jumps in as)
  leviathan: 'purrgil',
  // (the Empire has no troops on the ground yet: the Federation's stand in,
  // as they always have; Lane B of the plan gives it stormtroopers)
  troops: { gromflomite: { gun: 'rifle' }, cop: { gun: 'coppistol' }, gazorpian: { gun: null } },
  squads: (n) => (n < 1 ? ['gromflomite'] : n < 3 ? ['gromflomite', 'gromflomite', 'cop'] : ['gromflomite', 'cop', 'cop', 'gazorpian']),
  ahead: { tie: 3, tieadvanced: 1, tiebomber: 1, gunboat: 1 },
};

const RICKMORTY = {
  id: 'rickmorty',
  label: 'Dimension C-137',
  crews: ['cruiser'],
  factions: {
    federation: { role: 'hunt', weight: 2, kinds: [['patrol', 3], ['gunship', 1]], laser: [0.6, 2.2, 6.5], size: [3, 5] },
    // Evil Morty's guard: a swarm of quick yellow fighters, his own ship at their head
    mortys: { role: 'hunt', weight: 1, kinds: [['mortyfighter', 1]], ace: 'evilmortyship', laser: [5.5, 4.8, 0.6], size: [4, 6] },
    // the Zigerions: a simulation ship that's gone when you hit it
    zigerions: { role: 'hunt', weight: 0.7, kinds: [['zigerion', 1]], laser: [0.6, 5.5, 5.0], size: [2, 3] },
    // what the Federation cruiser launches
    fedfleet: { role: 'capital', weight: 1, kinds: [['gunship', 1], ['patrol', 2]], laser: [0.6, 2.2, 6.5], size: [3, 4] },
    council: { role: 'council', weight: 1, kinds: [['councilship', 1]], laser: [0.6, 5.5, 4.2], size: [2, 4], portal: true },
    // pirates: what's after someone in distress
    bugs: { role: 'pirates', weight: 1, kinds: [['gromflomite', 1]], laser: [0.6, 2.2, 6.5], size: [2, 3] },
    phoenix: { role: 'bounty', weight: 1, kinds: [['phoenixperson', 1]], laser: [6.0, 2.6, 0.8], size: [1, 1] },
    // Krombopulos Michael: he just loves killing, but he waits for you to start it
    krombopulos: { role: 'bounty', weight: 1, kinds: [['krombopulos', 1]], laser: [5.5, 0.6, 2.4], size: [1, 1] },
  },
  kinds: {
    patrol: { size: 0.34, speed: 19, accel: 17, hp: 2, fire: [0.8, 1.5] },
    councilship: { size: 0.42, speed: 24, accel: 19, hp: 3, fire: [0.6, 1.1], tail: 0.2 },
    gromflomite: { size: 0.3, speed: 18, accel: 16, hp: 1, fire: [0.9, 1.7] },
    phoenixperson: { size: 0.42, speed: 25, accel: 21, hp: 5, fire: [0.55, 1.0], tail: 0.4, lead: 0.9 },
    gunship: { size: 0.44, speed: 17, accel: 14, hp: 4, fire: [0.45, 0.8], spread: 1.3, trait: 'holdoff' },
    mortyfighter: { size: 0.28, speed: 24, accel: 22, hp: 1, fire: [0.8, 1.4], spread: 1.2 },
    evilmortyship: { size: 0.4, speed: 27, accel: 23, hp: 6, fire: [0.4, 0.75], tail: 0.5, lead: 0.95, spread: 0.7 },
    zigerion: { size: 0.38, speed: 21, accel: 18, hp: 3, fire: [0.8, 1.4], trait: 'flicker' },
    krombopulos: { size: 0.42, speed: 25, accel: 21, hp: 6, fire: [0.45, 0.8], tail: 0.5, lead: 0.95, spread: 0.7, trait: 'quietUntilFired' },
  },
  names: { patrol: 'Federation patrol', councilship: 'Council cruiser', gromflomite: 'Gromflomite', phoenixperson: 'Phoenixperson', gunship: 'Federation gunship', mortyfighter: 'Morty fighter', evilmortyship: 'Evil Morty', zigerion: 'Zigerion ship', krombopulos: 'Krombopulos Michael' },
  allies: {
    birdperson: { speed: 22, accel: 22, turn: 3, fire: [1, 1.8], spread: 0.16, size: 0.4, colour: [0.7, 5.5, 1.2] },
    // Squanchy: close in, and every bolt counts
    squanchship: { speed: 23, accel: 21, turn: 2.8, fire: [0.7, 1.2], spread: 0.25, size: 0.36, damage: 2, colour: [6.0, 2.5, 0.5] },
    // Mr. Poopybutthole: quick and cheerful, and off again before long
    poopyship: { speed: 28, accel: 25, turn: 3.2, fire: [1.1, 1.8], spread: 0.3, size: 0.3, stay: 3, tour: 16, colour: [5.5, 1.5, 3.5] },
  },
  traffic: ['patrol', 'federation', 'gunship', 'gromflomite', 'mortyfighter', 'meeseeks', 'birdperson', 'squanchship', 'poopyship'],
  civil: ['saucer', 'hauler', 'gearship'],
  convoy: { escort: 'patrol' },
  distress: { civil: 'saucer', pirates: 'bugs' },
  skirmish: { faction: 'federation', escort: 'birdperson', civil: 'saucer' },
  pieces: ['council', 'destroyer', 'remover'],
  capital: 'fedfleet',
  capitalShip: 'fedcruiser',
  leviathan: 'cromulon',
  troops: { gromflomite: { gun: 'rifle' }, cop: { gun: 'coppistol' }, gazorpian: { gun: null } },
  squads: (n) => (n < 1 ? ['gromflomite'] : n < 3 ? ['gromflomite', 'gromflomite', 'cop'] : ['gromflomite', 'cop', 'cop', 'gazorpian']),
  ahead: { patrol: 4, councilship: 3, gromflomite: 2, gunship: 1, mortyfighter: 3, zigerion: 1 },
};

// Albuquerque's sky: the RV grew wings, and so did everyone after it
const BREAKINGBAD = {
  id: 'breakingbad',
  label: 'Albuquerque',
  crews: ['rv'],
  factions: {
    // the DEA: black SUVs in twos and threes, Hank's own now and then
    dea: { role: 'hunt', weight: 3, kinds: [['suv', 1]], ace: 'suvace', laser: [0.8, 1.8, 6.2], size: [3, 5] },
    // the cartel: Tuco's lowriders, quick and wild
    cartel: { role: 'hunt', weight: 2, kinds: [['lowrider', 1]], laser: [6.0, 4.2, 0.6], size: [2, 4] },
    // Gus's people: box trucks with rockets, tough, that hold their range
    pollos: { role: 'capital', weight: 1, kinds: [['pollostruck', 1]], ace: 'gusvolvo', laser: [6.0, 1.2, 0.6], size: [2, 3] },
    // the Cousins: two Mercedes, one hunter, who never say a word
    cousins: { role: 'bounty', weight: 1, kinds: [['cousins', 1]], laser: [5.5, 5.5, 5.5], size: [1, 1] },
    // Jack's crew: pickups, after anyone with something to take
    jacks: { role: 'pirates', weight: 1, kinds: [['pickup', 1]], laser: [6.0, 2.5, 0.5], size: [2, 3] },
  },
  kinds: {
    suv: { size: 0.34, speed: 19, accel: 17, hp: 2, fire: [0.8, 1.5] },
    suvace: { size: 0.36, speed: 25, accel: 21, hp: 5, fire: [0.5, 0.9], tail: 0.4, lead: 0.9, spread: 0.85, trait: 'spotlight' },
    lowrider: { size: 0.34, speed: 25, accel: 20, hp: 1, fire: [0.6, 1.1], tail: 0.3, spread: 1.6 },
    pollostruck: { size: 0.5, speed: 17, accel: 14, hp: 4, fire: [0.9, 1.5], trait: 'holdoff' },
    // Gus himself: he doesn't fire first, and he doesn't miss
    gusvolvo: { size: 0.36, speed: 24, accel: 20, hp: 6, fire: [0.5, 0.85], tail: 0.3, lead: 0.95, spread: 0.6, trait: 'quietUntilFired' },
    cousins: { size: 0.6, speed: 25, accel: 21, hp: 7, fire: [0.5, 0.9], tail: 0.5, lead: 0.9, spread: 0.8, trait: 'quietUntilFired' },
    pickup: { size: 0.32, speed: 18, accel: 16, hp: 1, fire: [0.9, 1.7] },
  },
  names: { suv: 'DEA SUV', suvace: 'Hank’s SUV', lowrider: 'Cartel lowrider', pollostruck: 'Pollos truck', cousins: 'The Cousins', pickup: 'Jack’s pickup', gusvolvo: 'Gus’s Volvo' },
  allies: {
    saulcaddy: { speed: 24, accel: 20, turn: 2.6, fire: [0.9, 1.6], spread: 0.15, size: 0.36, colour: [5.5, 5.0, 1.2] },
    mikesedan: { speed: 21, accel: 18, turn: 2.2, fire: [1.6, 2.4], spread: 0.05, size: 0.36, damage: 2, colour: [4.5, 3.6, 2.2] },
    // Badger and Skinny Pete: chatty, and they miss a lot
    beater: { speed: 21, accel: 17, turn: 2.3, fire: [0.6, 1.1], spread: 0.6, size: 0.36, colour: [1.2, 3.5, 6.0] },
  },
  traffic: ['suv', 'lowrider', 'beater', 'gusvolvo'],
  civil: ['pollostruck', 'madrigal', 'pestvan', 'balloon'],
  convoy: { escort: 'mikesedan' },
  distress: { civil: 'madrigal', pirates: 'jacks' },
  skirmish: { faction: 'cartel', escort: 'saulcaddy', civil: 'madrigal' },
  pieces: ['roadblock', 'destroyer'],
  capital: 'pollos',
  capitalShip: 'madrigal', // (a Madrigal freighter jumps in, and Gus's trucks come out of it)
  leviathan: 'bear',
  troops: { dea: { gun: 'coppistol' }, cartel: { gun: 'rifle' } },
  squads: (n) => (n < 1 ? ['dea'] : n < 3 ? ['dea', 'dea', 'cartel'] : ['dea', 'cartel', 'cartel', 'cartel']),
  ahead: { suv: 3, lowrider: 2, pollostruck: 1, deachopper: 1 },
};

const finish = (s) => {
  const roles = new Set(Object.values(s.factions).map((f) => f.role));
  // what the director's events need of a side
  s.has = (need) => roles.has(need) || s.pieces.includes(need) || (need === 'pirates' && Boolean(s.distress.pirates)) || (need === 'leviathan' && Boolean(s.leviathan));
  for (const f of Object.values(s.factions)) f.family = s.id; // (hunterRules.js reads it)
  return s;
};

export const SIDES = { starwars: finish(STARWARS), rickmorty: finish(RICKMORTY), breakingbad: finish(BREAKINGBAD) };
const ALL = Object.values(SIDES);
const BY_CREW = new Map(ALL.flatMap((s) => s.crews.map((c) => [c, s])));

export const sideFor = (crewId) => BY_CREW.get(crewId) ?? null;
export const sideOf = (crewId) => sideFor(crewId)?.id ?? null;

const sidesOf = (sideId) => (sideId ? [SIDES[sideId]].filter(Boolean) : ALL);
// the hunters' factions (hunterRules.js's shape) and kinds: one side's, or every side's (null: for another pilot's hunters, whoever they are)
export const factionsOf = (sideId = null) => Object.assign({}, ...sidesOf(sideId).map((s) => s.factions));
export const kindsOf = (sideId = null) => Object.assign({}, ...sidesOf(sideId).map((s) => s.kinds));
export const namesOf = (sideId = null) => Object.assign({}, ...sidesOf(sideId).map((s) => s.names));
export const allKinds = Object.keys(kindsOf(null));
// every side's allies (wingRules.js's shape, the colour too)
export const alliesOf = (sideId = null) => Object.assign({}, ...sidesOf(sideId).map((s) => s.allies));
export const AHEAD_OF = (side) => side?.ahead ?? {};

// a faction of the side by role ('hunt', 'bounty', 'capital', 'council', 'pirates'), or null
export function pick(side, role, rand = Math.random) {
  if (!side) return null;
  if (role === 'pirates') return side.distress.pirates ?? null;
  if (role === 'capital') return side.capital ?? null;
  const list = Object.entries(side.factions).filter(([, f]) => f.role === role).map(([id, f]) => [id, f.weight ?? 1]);
  return list.length ? weighted(list, rand) : null;
}
// who comes in a long fight
export const wingOf = (side, rand = Math.random) => weighted(Object.keys(side?.allies ?? {}).map((k) => [k, 1]), rand);
// who comes on the n-th squad on the ground
export const squadKinds = (side, n) => side?.squads(n) ?? ['gromflomite'];
