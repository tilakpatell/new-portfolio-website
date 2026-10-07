// The named characters on the universe map, one row each: whose side
// they're on (sides.js), friend, foe or neither, the ship they fly (a built
// kind, trafficModels.js), the brain that flies it (npcRules.js's BRAINS),
// who they fear and who they hunt (npcRules.js's relations), and how they
// fly and fight. Their lines are each crew's, in crews.js under `npc`. A new
// character is a row here and, at most, a new brain in ./brains/ with a
// test. Pure data, tested in npcs.test.js.
//
// { id, name, side, role: 'ally' | 'enemy' | 'neutral', ship, brain,
//   faction? (a bounty hunter's: the hunt flies it; an inspector's, a
//   nemesis's or a trickster's: who it calls in), relations: { fears:
//   [faction…], hunts: [faction…] }, stats: { speed, accel, turn, hp, fire:
//   [s, s], damage }, size, bolt: its shots' colour (HDR), senses: what it
//   can see and hear (lib/ai/perception's createSenses: a belief of you that
//   a planet can hide; a nemesis sees further and sooner) }

// what every character perceives unless its row says otherwise: all round
// (a ship has sensors, not a windscreen), out to a good way across the map,
// a second to be sure at the edge of that, hearing a shot from further than
// it sees, and a memory of where you were going for a while after
import { paced } from '../ship';

export const SENSES = { sight: { range: 220, cone: -1, far: 1 }, hearing: { range: 160 }, memory: 8, intuition: 2.5 };
const sensesOf = (over = {}) => ({ ...SENSES, ...over, sight: { ...SENSES.sight, ...(over.sight ?? {}) }, hearing: { ...SENSES.hearing, ...(over.hearing ?? {}) } });

const row = (id, name, side, role, ship, brain, { faction = null, fears = [], hunts = [], stats = {}, size = 0.4, bolt = [5, 5, 5], senses = {} } = {}) => ({
  id,
  name,
  side,
  role,
  ship,
  brain,
  faction,
  relations: { fears, hunts },
  stats: paced({ speed: 16, accel: 14, turn: 2.4, hp: 4, fire: [0.8, 1.4], damage: 6, ...stats }), // (at the ship's pace)
  size,
  bolt,
  senses: sensesOf(senses),
});

export const NPCS = {
  // Albuquerque's: Saul parks at a station with something for the RV (and
  // is gone the moment the DEA or the cartel show up); Mike comes alongside
  // with word of what's coming, and goes after the cartel if they're near
  saul: row('saul', 'Saul Goodman', 'breakingbad', 'neutral', 'saulcaddy', 'merchant', { fears: ['dea', 'cartel', 'cousins'], stats: { speed: 18 }, bolt: [5.5, 5.0, 1.2] }),
  mike: row('mike', 'Mike Ehrmantraut', 'breakingbad', 'ally', 'mikesedan', 'informant', { hunts: ['cartel'], stats: { speed: 20, fire: [1.4, 2.0] }, bolt: [4.5, 3.6, 2.2] }),
  // the Star Wars galaxy's: Fett is the bounty hunter the hunt already flies,
  // with his own lines; Lando has a part for you, if the Empire isn't about
  fett: row('fett', 'Boba Fett', 'starwars', 'enemy', 'slave1', 'bounty', { faction: 'fett', size: 0.55 }),
  lando: row('lando', 'Lando Calrissian', 'starwars', 'neutral', 'freighter', 'merchant', { fears: ['empire', 'navy'], stats: { speed: 15 }, size: 0.7, bolt: [5.5, 0.8, 0.5] }),
  // Vader comes for you himself, in his TIE Advanced, and remembers; an
  // Imperial customs gunboat pulls you over; Hondo Ohnaka has a toll to
  // collect (and is off if the Empire shows up)
  vader: row('vader', 'Darth Vader', 'starwars', 'enemy', 'tieadvanced', 'nemesis', { faction: 'empire', senses: { sight: { range: 320, far: 0.6 } }, stats: { speed: 26, accel: 22, turn: 3.0, hp: 10, fire: [0.45, 0.8], damage: 8 }, size: 0.36, bolt: [0.5, 5.5, 0.9] }),
  customs: row('customs', 'Imperial customs', 'starwars', 'neutral', 'gunboat', 'inspector', { faction: 'empire', stats: { speed: 20, hp: 6, fire: [0.5, 0.9] }, size: 0.42, bolt: [0.5, 5.5, 0.9] }),
  hondo: row('hondo', 'Hondo Ohnaka', 'starwars', 'neutral', 'skiff', 'trickster', { faction: 'weequay', fears: ['empire', 'navy'], stats: { speed: 19, hp: 5, fire: [0.7, 1.2] }, size: 0.34, bolt: [6.0, 3.0, 0.6] }),
  // Rick and Morty's: Birdperson on your wing, against the Federation;
  // Squanchy with the word on what's coming; Evil Morty, circling you for
  // a duel he means to call a draw
  birdperson: row('birdperson', 'Birdperson', 'rickmorty', 'ally', 'birdperson', 'wingman', { hunts: ['federation'] }),
  squanchy: row('squanchy', 'Squanchy', 'rickmorty', 'ally', 'squanchship', 'informant', { hunts: ['federation'], fears: ['council'], stats: { speed: 22, fire: [0.7, 1.2] }, size: 0.36, bolt: [6.0, 2.5, 0.5] }),
  evilmorty: row('evilmorty', 'Evil Morty', 'rickmorty', 'enemy', 'evilmortyship', 'rival', { stats: { speed: 24, accel: 20, turn: 2.8, hp: 8, fire: [0.5, 0.9], damage: 7 }, bolt: [5.5, 4.8, 0.6] }),
  // Tammy, the Federation's agent, comes for Rick in a gunship and
  // remembers; Federation customs pulls you over; Jerry tags along, and
  // panics
  tammy: row('tammy', 'Tammy', 'rickmorty', 'enemy', 'gunship', 'nemesis', { faction: 'federation', senses: { sight: { range: 320, far: 0.6 } }, stats: { speed: 24, accel: 21, turn: 2.9, hp: 9, fire: [0.5, 0.85], damage: 7 }, size: 0.44, bolt: [0.6, 2.2, 6.5] }),
  fedcustoms: row('fedcustoms', 'Federation customs', 'rickmorty', 'neutral', 'patrol', 'inspector', { faction: 'federation', stats: { speed: 20, hp: 5, fire: [0.6, 1.0] }, size: 0.34, bolt: [0.6, 2.2, 6.5] }),
  jerry: row('jerry', 'Jerry', 'rickmorty', 'ally', 'saucer', 'tagalong', { stats: { speed: 20, hp: 3 }, size: 0.45, bolt: [5, 5, 5] }),
  // Albuquerque's: Tuco comes for you himself, and Hank pulls you over
  tuco: row('tuco', 'Tuco Salamanca', 'breakingbad', 'enemy', 'lowrider', 'nemesis', { faction: 'cartel', senses: { sight: { range: 320, far: 0.6 } }, stats: { speed: 26, accel: 22, turn: 3.1, hp: 8, fire: [0.4, 0.7], damage: 7 }, size: 0.34, bolt: [6.0, 4.2, 0.6] }),
  hank: row('hank', 'Hank Schrader', 'breakingbad', 'neutral', 'suvace', 'inspector', { faction: 'dea', stats: { speed: 22, hp: 6, fire: [0.5, 0.9] }, size: 0.36, bolt: [0.8, 1.8, 6.2] }),
};

// the characters on a side (by its id), or none
export const npcsOf = (sideId) => Object.values(NPCS).filter((c) => c.side === sideId);
// the ones that come by on their own now and then (the bounty hunter and the
// wing have their own ways in: director.js's bounty, wingmen.js's long fight)
export const visitorsOf = (sideId) => npcsOf(sideId).filter((c) => c.brain !== 'bounty' && c.brain !== 'wingman');
