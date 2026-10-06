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
    empire: { role: 'hunt', weight: 1, kinds: [['tie', 3], ['interceptor', 2]], ace: 'tieadvanced', laser: [0.5, 5.5, 0.9], size: [3, 5] },
    // bounty hunters: one at a time, tough and quick (director.js's bounty)
    fett: { role: 'bounty', weight: 1, kinds: [['slave1', 1]], laser: [5.5, 0.9, 0.5], size: [1, 1] },
  },
  kinds: {
    tie: { size: 0.3, speed: 19, accel: 17, hp: 1, fire: [0.8, 1.6] },
    interceptor: { size: 0.32, speed: 25, accel: 20, hp: 1, fire: [0.7, 1.3], tail: 0.25 },
    tieadvanced: { size: 0.36, speed: 26, accel: 22, hp: 5, fire: [0.45, 0.8], tail: 0.45, lead: 0.9, spread: 0.8 },
    slave1: { size: 0.55, speed: 24, accel: 20, hp: 6, fire: [0.5, 0.9], tail: 0.45, lead: 0.9, spread: 0.85 },
  },
  names: { tie: 'TIE fighter', interceptor: 'TIE interceptor', tieadvanced: 'TIE Advanced', slave1: 'Slave I' },
  allies: {
    xwing: { speed: 24, accel: 20, turn: 2.6, fire: [0.9, 1.6], spread: 0.15, size: 0.36, colour: [5.5, 0.6, 0.5] },
  },
  traffic: ['tie', 'interceptor', 'xwing', 'shuttle', 'destroyer', 'slave1'],
  civil: ['freighter', 'transport', 'corvette'],
  convoy: { escort: 'xwing' },
  distress: { civil: 'transport', pirates: 'empire' },
  skirmish: { faction: 'empire', escort: 'xwing', civil: 'transport' },
  pieces: ['destroyer'],
  capital: 'empire', // what the Star Destroyer launches
  leviathan: 'purrgil',
  // (the Empire has no troops on the ground yet: the Federation's stand in,
  // as they always have; Lane B of the plan gives it stormtroopers)
  troops: { gromflomite: { gun: 'rifle' }, cop: { gun: 'coppistol' }, gazorpian: { gun: null } },
  squads: (n) => (n < 1 ? ['gromflomite'] : n < 3 ? ['gromflomite', 'gromflomite', 'cop'] : ['gromflomite', 'cop', 'cop', 'gazorpian']),
  ahead: { tie: 3, tieadvanced: 1 },
};

const RICKMORTY = {
  id: 'rickmorty',
  label: 'Dimension C-137',
  crews: ['cruiser'],
  factions: {
    federation: { role: 'hunt', weight: 1, kinds: [['patrol', 1]], laser: [0.6, 2.2, 6.5], size: [3, 5] },
    council: { role: 'council', weight: 1, kinds: [['councilship', 1]], laser: [0.6, 5.5, 4.2], size: [2, 4], portal: true },
    // pirates: what's after someone in distress
    bugs: { role: 'pirates', weight: 1, kinds: [['gromflomite', 1]], laser: [0.6, 2.2, 6.5], size: [2, 3] },
    phoenix: { role: 'bounty', weight: 1, kinds: [['phoenixperson', 1]], laser: [6.0, 2.6, 0.8], size: [1, 1] },
  },
  kinds: {
    patrol: { size: 0.34, speed: 19, accel: 17, hp: 2, fire: [0.8, 1.5] },
    councilship: { size: 0.42, speed: 24, accel: 19, hp: 3, fire: [0.6, 1.1], tail: 0.2 },
    gromflomite: { size: 0.3, speed: 18, accel: 16, hp: 1, fire: [0.9, 1.7] },
    phoenixperson: { size: 0.42, speed: 25, accel: 21, hp: 5, fire: [0.55, 1.0], tail: 0.4, lead: 0.9 },
  },
  names: { patrol: 'Federation patrol', councilship: 'Council cruiser', gromflomite: 'Gromflomite', phoenixperson: 'Phoenixperson' },
  allies: {
    birdperson: { speed: 22, accel: 22, turn: 3, fire: [1, 1.8], spread: 0.16, size: 0.4, colour: [0.7, 5.5, 1.2] },
  },
  traffic: ['patrol', 'federation', 'gromflomite', 'meeseeks', 'birdperson'],
  civil: ['saucer', 'hauler', 'gearship'],
  convoy: { escort: 'patrol' },
  distress: { civil: 'saucer', pirates: 'bugs' },
  skirmish: { faction: 'federation', escort: 'birdperson', civil: 'saucer' },
  pieces: ['council'],
  capital: null,
  leviathan: 'cromulon',
  troops: { gromflomite: { gun: 'rifle' }, cop: { gun: 'coppistol' }, gazorpian: { gun: null } },
  squads: (n) => (n < 1 ? ['gromflomite'] : n < 3 ? ['gromflomite', 'gromflomite', 'cop'] : ['gromflomite', 'cop', 'cop', 'gazorpian']),
  ahead: { patrol: 4, councilship: 3, gromflomite: 2 },
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
    pollos: { role: 'capital', weight: 1, kinds: [['pollostruck', 1]], laser: [6.0, 1.2, 0.6], size: [2, 3] },
    // the Cousins: two Mercedes, one hunter, who never say a word
    cousins: { role: 'bounty', weight: 1, kinds: [['cousins', 1]], laser: [5.5, 5.5, 5.5], size: [1, 1] },
    // Jack's crew: pickups, after anyone with something to take
    jacks: { role: 'pirates', weight: 1, kinds: [['pickup', 1]], laser: [6.0, 2.5, 0.5], size: [2, 3] },
  },
  kinds: {
    suv: { size: 0.34, speed: 19, accel: 17, hp: 2, fire: [0.8, 1.5] },
    suvace: { size: 0.36, speed: 25, accel: 21, hp: 5, fire: [0.5, 0.9], tail: 0.4, lead: 0.9, spread: 0.85, trait: 'spotlight' },
    lowrider: { size: 0.34, speed: 25, accel: 20, hp: 1, fire: [0.6, 1.1], tail: 0.3, spread: 1.6 },
    pollostruck: { size: 0.5, speed: 17, accel: 14, hp: 4, fire: [0.9, 1.5] },
    cousins: { size: 0.6, speed: 25, accel: 21, hp: 7, fire: [0.5, 0.9], tail: 0.5, lead: 0.9, spread: 0.8, trait: 'quietUntilFired' },
    pickup: { size: 0.32, speed: 18, accel: 16, hp: 1, fire: [0.9, 1.7] },
  },
  names: { suv: 'DEA SUV', suvace: 'Hank’s SUV', lowrider: 'Cartel lowrider', pollostruck: 'Pollos truck', cousins: 'The Cousins', pickup: 'Jack’s pickup' },
  allies: {
    saulcaddy: { speed: 24, accel: 20, turn: 2.6, fire: [0.9, 1.6], spread: 0.15, size: 0.36, colour: [5.5, 5.0, 1.2] },
    mikesedan: { speed: 21, accel: 18, turn: 2.2, fire: [1.6, 2.4], spread: 0.05, size: 0.36, colour: [4.5, 3.6, 2.2] },
  },
  traffic: ['suv', 'lowrider'],
  civil: ['pollostruck', 'madrigal', 'pestvan'],
  convoy: { escort: 'mikesedan' },
  distress: { civil: 'madrigal', pirates: 'jacks' },
  skirmish: { faction: 'cartel', escort: 'saulcaddy', civil: 'madrigal' },
  pieces: ['roadblock'],
  capital: 'pollos',
  leviathan: 'bear',
  troops: { dea: { gun: 'coppistol' }, cartel: { gun: 'rifle' } },
  squads: (n) => (n < 1 ? ['dea'] : n < 3 ? ['dea', 'dea', 'cartel'] : ['dea', 'cartel', 'cartel', 'cartel']),
  ahead: { suv: 3, lowrider: 2 },
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
