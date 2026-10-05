// Who comes after you in the galaxy, by the system's `faction`
// (systems.js): the Empire as on the universe map (TIE fighters and
// interceptors, now and then Vader in his TIE Advanced), the Separatists'
// droid starfighters over the Clone Wars' worlds (vulture droids, with a
// tri-fighter or two, which take more stopping), the First Order's TIEs over
// the sequels', and the Sith Eternal's at Exegol, in red. universe/hunters.js
// flies them all; this is who they are, how they fly and what they're called
// on the targeting bracket.

import { FACTIONS as HOME, HUNTER_KINDS, NAMES as HOME_NAMES } from '../universe/hunters';

export const FACTIONS = {
  empire: HOME.empire,
  separatists: { family: 'starwars', kinds: [['vulture', 4], ['trifighter', 1]], laser: [5.5, 0.7, 0.5], size: [3, 5] },
  firstorder: { family: 'starwars', kinds: [['tiefo', 1]], laser: [0.6, 5.5, 0.9], size: [3, 4] },
  sith: { family: 'starwars', kinds: [['tiefo', 1]], laser: [6, 0.5, 0.4], size: [3, 5] },
};

export const KINDS = {
  ...HUNTER_KINDS,
  vulture: { size: 0.28, speed: 20, accel: 19, hp: 1, fire: [0.7, 1.4] },
  trifighter: { size: 0.32, speed: 25, accel: 22, hp: 3, fire: [0.5, 0.95] },
  tiefo: { size: 0.3, speed: 22, accel: 19, hp: 1, fire: [0.7, 1.4] },
};

export const NAMES = { ...HOME_NAMES, vulture: 'Vulture droid', trifighter: 'Droid tri-fighter', tiefo: 'First Order TIE' };

// the hunters each faction's built ones are made of (made ahead, so a pack
// arriving doesn't stall a frame)
export const AHEAD = { empire: { tie: 3, tieadvanced: 1 }, separatists: { vulture: 4, trifighter: 1 }, firstorder: { tiefo: 4 }, sith: { tiefo: 4 } };
