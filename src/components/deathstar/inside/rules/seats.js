// Where a body sits in a seat, so that the library's sit clip lands it on
// the seat and not inside it. The clip sits with its knees over its origin,
// its thighs level THIGH metres up and its hips well behind, so a sitter is
// drawn with its origin at the seat's front edge, lifted by the seat's height
// over THIGH. The heights and edges are those of the seats as drawn
// (scene/rooms/deck/props.js, scene/rooms/ds2/heights.js,
// scene/rooms/deep/cells.js), in the seat's own frame (+z its front). Pure.
//
//   SEATS → { kind: { top, front } }   a seat's top and its front edge, metres
//   seatedAt(prop, near?) → { x, y, z, yaw }   where a body in it stands its figure (along a bench, the
//     nearest place on it to `near`)
//   seatOf(g, body) → { x, y, z, yaw } | null   the seat a body sits in, by the room's furnishing

import { furnish } from './furnish';

export const THIGH = 0.45; // metres up the sit clip's thighs lie
const REACH = 0.8; // metres from a seat's middle a sitter may be put

export const SEATS = {
  chair: { top: 0.5, front: 0.26 },
  throne: { top: 0.67, front: 0.25 },
  'meditation-pod': { top: 1.35, front: 0.2 },
};

const sits = (p) => p.kind === 'bench' || Object.hasOwn(SEATS, p.kind);
// (how far along a bench, to its right, a place is: a bench is long, and they sit wherever on it they are)
function sideOf(prop, near) {
  if (prop.kind !== 'bench' || !near) return 0;
  const across = Math.cos(prop.yaw) * (near.x - prop.x) + Math.sin(prop.yaw) * (near.z - prop.z);
  return Math.max(-prop.w / 2, Math.min(prop.w / 2, across));
}

export function seatedAt(prop, near = null) {
  const s = SEATS[prop.kind] ?? { top: prop.h, front: prop.d / 2 };
  const yaw = prop.yaw ?? 0;
  const side = sideOf(prop, near);
  return {
    x: prop.x + Math.sin(yaw) * s.front + Math.cos(yaw) * side,
    y: (prop.y ?? 0) + Math.max(0, s.top - THIGH),
    z: prop.z - Math.cos(yaw) * s.front + Math.sin(yaw) * side,
    yaw,
  };
}

export function seatOf(g, body) {
  const room = g.layout.rooms.get(body.room);
  if (!room) return null;
  g.furnished ??= new Map();
  if (!g.furnished.has(room.id)) g.furnished.set(room.id, furnish(room, g.layout.station));
  let best = null;
  for (const p of g.furnished.get(room.id).props) {
    if (!sits(p)) continue;
    const side = sideOf(p, body);
    const d = Math.hypot(body.x - p.x - Math.cos(p.yaw) * side, body.z - p.z - Math.sin(p.yaw) * side);
    if (d > REACH || (best && d >= best.d)) continue;
    best = { d, p };
  }
  return best ? seatedAt(best.p, body) : null;
}
