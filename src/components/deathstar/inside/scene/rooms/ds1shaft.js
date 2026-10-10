// The room builders for the first Death Star’s shafts, by kind (see ./index.js for the contract):
// the tractor beam’s terminal on its ledge over the shaft (shaft), the central core shaft’s chasm and
// its bridge (chasm), and the TIE launch bay (tiebay). Each lives in ./shaft/, with the sums they
// share in ./shaft/plan.js and the depths they share in ./shaft/depths.js.
//
//   DS1_SHAFT: { shaft, chasm, tiebay }   each (kit, room, layout, { renderer }) → { group, lamps, update, dispose }

import { buildChasm, buildTiebay } from './shaft/bays';
import { buildShaft } from './shaft/tractor';

export const DS1_SHAFT = { shaft: buildShaft, chasm: buildChasm, tiebay: buildTiebay };
