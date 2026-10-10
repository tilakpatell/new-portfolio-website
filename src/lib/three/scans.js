// The photo-scanned ground surfaces (Poly Haven, CC0: public/cc0/galaxy/,
// made by scripts/galaxy-textures.mjs), by role: what each is and how big a
// tile of it is on the ground. Moved down from galaxy/surface/kit.js so the
// flight's ground wears the same scans as the walkable surfaces.
//
//   SCANS[role] → { source, id, name, authors, license, metres, arm, mean }
//   scanOf(role) → that, or null
//   loadScan(role, { xl }) → its maps (lib/three/core's loadCore)

import SCANS from '../../../public/cc0/galaxy/index.json';
import { loadCore as loadScan } from './core';

export { SCANS, loadScan };
export const scanOf = (role) => SCANS[role] ?? null;
