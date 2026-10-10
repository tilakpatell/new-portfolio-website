// The Rick and Morty sector's standing ships, as plain numbers (tested in
// Node; sectorFleetView.js draws them with the wars' Meshy flagships,
// galaxy/models.js's `fedbattleship` and `councildread`):
//
// - the Galactic Federation's fleet, holding station out in the sector in a
//   wedge, the biggest at its head, as it held the skies in the show; and
// - the Council of Ricks' dreadnought, patrolling round the Citadel, the
//   way the Council's ships keep it.
//
// They're scenery: no shot hits them and they don't fight (the sector's
// hunters are sides.js's). sectorShips(t) → [{ id, kind, at: [x, y, z],
// heading, size }] at time t (seconds); heading as ship.js's (0 is −z).
// sectorSolids(t) → each as one of ship.js's solids, so flying into one is a
// planet's bump or crash (too big to move: lib/combat/contact.js).

import { inSector } from './layout';
import { wonderById } from './deep';

// the Federation's fleet: where it holds, which way it faces, and its wedge
// (each ship's place behind and beside the lead, in its own frame: +x to
// starboard, +z astern), and how far each bobs
export const FEDERATION = {
  at: inSector('rickmorty', [2900, 650, -2300]),
  heading: 2.4,
  ships: [
    { id: 'fed-lead', size: 64, off: [0, 0, 0] },
    { id: 'fed-port', size: 46, off: [-120, -30, 150] },
    { id: 'fed-starboard', size: 46, off: [120, 25, 150] },
  ],
  bob: 3,
};
// the Council's dreadnought round the Citadel: how far out, how high, and once round in how long
export const PATROL = { id: 'council-patrol', kind: 'councildread', size: 44, radius: 300, height: 55, period: 260 };

const forward = (h) => [-Math.sin(h), -Math.cos(h)];

export function sectorShips(t = 0) {
  const [fx, fz] = forward(FEDERATION.heading);
  // (starboard is the nose turned a quarter right)
  const sx = -fz;
  const sz = fx;
  const fleet = FEDERATION.ships.map((s, i) => {
    const [ox, oy, oz] = s.off;
    return {
      id: s.id,
      kind: 'fedbattleship',
      size: s.size,
      heading: FEDERATION.heading,
      at: [FEDERATION.at[0] + sx * ox - fx * oz, FEDERATION.at[1] + oy + Math.sin(t * 0.21 + i * 1.7) * FEDERATION.bob, FEDERATION.at[2] + sz * ox - fz * oz],
    };
  });
  const c = wonderById('citadel').at;
  const a = (t / PATROL.period) * Math.PI * 2;
  const x = c[0] + Math.cos(a) * PATROL.radius;
  const z = c[2] + Math.sin(a) * PATROL.radius;
  // (going round anticlockwise seen from above: its nose along the way round)
  const heading = Math.atan2(-(-Math.sin(a)), -Math.cos(a));
  return [...fleet, { id: PATROL.id, kind: PATROL.kind, size: PATROL.size, heading, at: [x, c[1] + PATROL.height, z] }];
}

// one sphere at each one's middle, SOLID of its length across
const SOLID = 0.16;
export function sectorSolids(t = 0) {
  return sectorShips(t).map((s) => ({ id: s.id, at: s.at, r: s.size * SOLID, reach: s.size * SOLID, ship: true }));
}
