// scans.js on the node renderer: the same ground scans, their maps loaded
// by coreNodes (core.js's twin), so a 'nodes' world's ground doesn't reach
// core.js's GLSL.
//
//   SCANS[role] → { source, id, name, authors, license, metres, arm, mean }
//   scanOf(role) → that, or null
//   loadScan(role, { xl }) → its maps

import SCANS from '../../../public/cc0/galaxy/index.json';
import { loadCore as loadScan } from './coreNodes';

export { SCANS, loadScan };
export const scanOf = (role) => SCANS[role] ?? null;
