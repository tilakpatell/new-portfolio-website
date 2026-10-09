// More of the wire between pilots (protocol.js's, which is near the size a
// file may be): pure readers for what the squads brought, each taking what a
// peer sent, untrusted, and giving back what may be believed, or null for
// junk. Tested in Node (wire2.test.js).
//
// A point on the map goes as a pose's place does (protocol.js's writePose
// and readPose: the same rounding and the same clamps, and out in the
// Expanse x and z from its sector's middle, with the sector): [x, y, z,
// sector?]. writePoint({ x, y, z }) → that; readPoint(data) → { x, y, z,
// sec? } or null.

import { readPose, writePose } from './protocol';

export function writePoint({ x, y, z }) {
  const w = writePose({ x, y, z });
  return w.length > 10 ? [w[0], w[1], w[2], w[10]] : [w[0], w[1], w[2]];
}

export function readPoint(data) {
  if (!Array.isArray(data) || data.length < 3 || data.length > 4) return null;
  // (as the rest of a pose: still, level, shields up)
  const s = readPose([data[0], data[1], data[2], 0, 0, 0, 0, 0, 0, 100, ...data.slice(3)]);
  return s && { x: s.x, y: s.y, z: s.z, ...(s.sec ? { sec: s.sec } : {}) };
}
