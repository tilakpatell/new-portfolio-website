// The named characters on the universe map, one row each: whose side
// they're on (sides.js), friend, foe or neither, the ship they fly (a built
// kind, trafficModels.js), the brain that flies it (npcRules.js's BRAINS),
// who they fear and who they hunt (npcRules.js's relations), and how they
// fly and fight. Their lines are each crew's, in crews.js under `npc`. A new
// character is a row here and, at most, a new brain in ./brains/ with a
// test. Pure data, tested in npcs.test.js.
//
// { id, name, side, role: 'ally' | 'enemy' | 'neutral', ship, brain,
//   faction? (a bounty hunter's: the hunt flies it), relations: { fears:
//   [faction…], hunts: [faction…] }, stats: { speed, accel, turn, hp, fire:
//   [s, s], damage }, size, bolt: its shots' colour (HDR) }

const row = (id, name, side, role, ship, brain, { faction = null, fears = [], hunts = [], stats = {}, size = 0.4, bolt = [5, 5, 5] } = {}) => ({
  id,
  name,
  side,
  role,
  ship,
  brain,
  faction,
  relations: { fears, hunts },
  stats: { speed: 16, accel: 14, turn: 2.4, hp: 4, fire: [0.8, 1.4], damage: 6, ...stats },
  size,
  bolt,
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
  // Rick and Morty's: Birdperson on your wing, against the Federation;
  // Squanchy with the word on what's coming; Evil Morty, circling you for
  // a duel he means to call a draw
  birdperson: row('birdperson', 'Birdperson', 'rickmorty', 'ally', 'birdperson', 'wingman', { hunts: ['federation'] }),
  squanchy: row('squanchy', 'Squanchy', 'rickmorty', 'ally', 'squanchship', 'informant', { hunts: ['federation'], fears: ['council'], stats: { speed: 22, fire: [0.7, 1.2] }, size: 0.36, bolt: [6.0, 2.5, 0.5] }),
  evilmorty: row('evilmorty', 'Evil Morty', 'rickmorty', 'enemy', 'evilmortyship', 'rival', { stats: { speed: 24, accel: 20, turn: 2.8, hp: 8, fire: [0.5, 0.9], damage: 7 }, bolt: [5.5, 4.8, 0.6] }),
};

// the characters on a side (by its id), or none
export const npcsOf = (sideId) => Object.values(NPCS).filter((c) => c.side === sideId);
// the ones that come by on their own now and then (the bounty hunter and the
// wing have their own ways in: director.js's bounty, wingmen.js's long fight)
export const visitorsOf = (sideId) => npcsOf(sideId).filter((c) => c.brain !== 'bounty' && c.brain !== 'wingman');
