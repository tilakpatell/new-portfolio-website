// The set pieces of the Galactic Civil War's battles (warfront.js runs
// them alongside universe/battle.js): what makes the Battle of Endor Endor,
// Hoth Hoth and Scarif Scarif, and the runs into a Star Destroyer's hangar
// any battle has. Each is made with the battle's context (warfront.js's
// `ctx`) and gives { update(dt, t, live, events) → { ship?, hurt?,
// speedCap?, kill? }, hit(from, to, damage), targets, markers(live),
// dispose() }.

import { createEndor } from './endor';
import { createHoth } from './hoth';
import { createScarif } from './scarif';
import { createHangars } from './hangar';

const OWN = { endor: createEndor, hoth: createHoth, scarif: createScarif };

export const piecesFor = (id) => [...(OWN[id] ? [OWN[id]] : []), createHangars];
