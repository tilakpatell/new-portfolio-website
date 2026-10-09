// More of the wire between pilots (protocol.js's, which is near the size a
// file may be): pure readers for what the squads brought, each taking what a
// peer sent, untrusted, and giving back what may be believed, or null for
// junk. Tested in Node (wire2.test.js).
//
// In the site's room (client.js), beside protocol.js's words, with rates of
// their own (RATES2: [a second, at most at once], merged into the client's
// limiter as CLIENT_RATES):
//   inv  { s: sid }        to one pilot: come and fly with my squad (invite.js's sid)
//
// A point on the map goes as a pose's place does (protocol.js's writePose
// and readPose: the same rounding and the same clamps, and out in the
// Expanse x and z from its sector's middle, with the sector): [x, y, z,
// sector?]. writePoint({ x, y, z }) → that; readPoint(data) → { x, y, z,
// sec? } or null.

import { RATES, readPose, writePose } from './protocol';
import { cleanSid } from './squad/invite';

export const RATES2 = { inv: [0.2, 2], say: [0.5, 3], qc: [1, 3] };
export const CLIENT_RATES = { ...RATES, ...RATES2 };

// an invite as it came in: { sid }, or null
export function readInvite(data) {
  const sid = data && typeof data === 'object' ? cleanSid(data.s) : null;
  return sid ? { sid } : null;
}

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
