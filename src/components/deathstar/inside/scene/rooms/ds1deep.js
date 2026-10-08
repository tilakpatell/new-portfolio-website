// The room builders for the first Death Star’s detention level and what
// lies under it, by kind (see ./index.js for the contract): Detention
// Block AA-23’s control room, the curved cell bay and its cells (2187
// with the IT-O), the garbage chute, compactor 3263827 with its water and
// its closing walls, and the Level 6 maintenance corridors. Each draws
// what rules/furnish.js puts in the room exactly where and as big as it
// says, so what you see is what you bump into; the builders and their
// drawers live in ./deep, a file a room or two.
//
//   DS1_DEEP: { detention, cellbay, cell, chute, compactor, maintenance }   (kit, room, layout, { renderer }) →
//     { group, lamps, update(t, dt, ctx), dispose() }; ctx may carry the story’s flags (ctx.flags, or
//     ctx.g.flags): 'walls-closing' closes the compactor, 'grate' takes the chute’s grate away
//   drawProp(prop) → parts   any furnished thing of these rooms, drawn where it stands (parts.js’ part)

import { buildCell, buildCellbay, buildChute, CELL_PROPS } from './deep/cells';
import { buildCompactor, COMPACTOR_PROPS } from './deep/compactor';
import { buildDetention, DETENTION_PROPS } from './deep/detention';
import { buildMaintenance, MAINTENANCE_PROPS } from './deep/maintenance';
import { drawWith } from './deep/parts';

const PROPS = { ...DETENTION_PROPS, ...CELL_PROPS, ...COMPACTOR_PROPS, ...MAINTENANCE_PROPS };

export const drawProp = (prop) => drawWith(PROPS, prop);

export const DS1_DEEP = {
  detention: buildDetention,
  cellbay: buildCellbay,
  cell: buildCell,
  chute: buildChute,
  compactor: buildCompactor,
  maintenance: buildMaintenance,
};
