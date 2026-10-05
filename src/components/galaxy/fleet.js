// The galaxy's own ships and stations, built in code the way the universe
// map's traffic is (universe/trafficModels.js, universe/trafficKit.js): the
// Rebellion's and the Empire's (fleetRebels.js), the Republic's and the
// Separatists' (fleetRepublic.js), and a few odd ones (fleetExtras.js:
// Bespin's cloud cars, the Razor Crest, the Mandalorians' Gauntlets).
// Anything not here is one of the universe's own (a TIE, an X-wing, a Star
// Destroyer…).
//
// buildGalaxyShip(kind) → { group, length, size, update(t), dispose() },
// nose along +z, +y up, exactly 1 long in z (the scene scales it).
// SHIP_INFO[kind]: { name, meters, side } where it has one.

import { buildModel, buildTraffic } from '../universe/trafficModels';
import { FLEET as REBELS, INFO as REBEL_INFO } from './fleetRebels';
import { FLEET as REPUBLIC, INFO as REPUBLIC_INFO } from './fleetRepublic';
import { FLEET as EXTRAS, INFO as EXTRA_INFO } from './fleetExtras';

export const GALAXY_FLEET = { ...REBELS, ...REPUBLIC, ...EXTRAS };
export const GALAXY_KINDS = Object.keys(GALAXY_FLEET);
export const SHIP_INFO = { ...REBEL_INFO, ...REPUBLIC_INFO, ...EXTRA_INFO };

export function buildGalaxyShip(kind) {
  if (GALAXY_FLEET[kind]) return buildModel(GALAXY_FLEET[kind], kind);
  return buildTraffic(kind);
}
