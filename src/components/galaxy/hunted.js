// Who comes after you in the galaxy, by the system's `faction`
// (systems.js): the Empire as on the universe map (TIE fighters and
// interceptors, now and then Vader in his TIE Advanced), the Separatists'
// droid starfighters over the Clone Wars' worlds (vulture droids, with a
// tri-fighter or two, which take more stopping), and the Imperial remnant's
// TIEs over the New Republic's (Moff Gideon's fighters and interceptors, with
// no Vader to lead them); and the universe map's Star Wars outlaws, which
// roamRules.js hands the director: what a Star Destroyer launches (`navy`),
// the bounty hunters (Fett in Slave I, IG-88, Bossk, Dengar) and the Weequay
// pirates. universe/hunters.js flies them all; this is who they are, how
// they fly and what they're called on the targeting bracket.

import { FACTIONS as HOME, HUNTER_KINDS, NAMES as HOME_NAMES } from '../universe/hunterRules';

export const FACTIONS = {
  empire: HOME.empire,
  separatists: { family: 'starwars', kinds: [['vulture', 4], ['trifighter', 1]], laser: [5.5, 0.7, 0.5], size: [3, 5] },
  remnant: { family: 'starwars', kinds: [['tie', 2], ['interceptor', 2]], laser: [0.5, 5.5, 0.9], size: [2, 4] },
  navy: HOME.navy,
  fett: HOME.fett,
  ig88: HOME.ig88,
  bossk: HOME.bossk,
  dengar: HOME.dengar,
  weequay: HOME.weequay,
};

export const KINDS = {
  ...HUNTER_KINDS,
  vulture: { size: 0.28, speed: 20, accel: 19, hp: 1, fire: [0.7, 1.4] },
  trifighter: { size: 0.32, speed: 25, accel: 22, hp: 3, fire: [0.5, 0.95], tail: 0.3 },
};

export const NAMES = { ...HOME_NAMES, vulture: 'Vulture droid', trifighter: 'Droid tri-fighter' };

// the hunters each faction's built ones are made of (made ahead, so a pack
// arriving doesn't stall a frame)
export const AHEAD = { empire: { tie: 3, tieadvanced: 1, tiebomber: 1 }, separatists: { vulture: 4, trifighter: 1 }, remnant: { tie: 2, interceptor: 2, tiebomber: 1 } };
