// One builder a room kind (rules/layout.js’s ROOM_KINDS), each drawing a
// room of the layout in station coordinates from the Imperial kit: what
// scene/stream.js calls when a room comes within reach. Door leaves are not
// a room’s: the gaps are left open in their frames for the scene to fill
// from the game’s door states. Kinds without a builder of their own yet
// get the kit’s plain shell, so a station never has a hole in it (every
// kind on both stations has its own now; drawsOwn says so).
//
//   ROOM_BUILDERS: { [kind]: (kit, room, layout, opts) → { group, lamps, update?(t, dt, ctx), dispose() } }
//     opts: { renderer } (without one a room is built without its reflection probe)
//     lamps: [{ x, y, z, color, intensity, distance }], few: the panels light the room
//   buildRoom(kit, room, layout, opts) → the room, by its kind’s builder or the plain shell
//   drawsOwn(stationId, kind) → bool   whether a kind has a builder of its own on that station
//
// A station may draw a kind its own way (the second Death Star’s Hangar 272
// is not Bay 327), so the builders come in groups, each in its own file:
// the first station’s detention level, its shafts and its officers’ deck,
// and the second station’s two halves. A kind’s builder is the station’s own
// when it has one, else the shared one.

import { probeRoom } from '../probe';
import { buildControl } from './control';
import { buildCorridor, buildLobby } from './corridor';
import { buildField, buildHangar, buildShip } from './hangar';
import { buildLift } from './lift';
import { DS1_DECK } from './ds1deck';
import { DS1_DEEP } from './ds1deep';
import { DS1_SHAFT } from './ds1shaft';
import { DS2_A } from './ds2a';
import { DS2_B } from './ds2b';

const SHARED = {
  hangar: buildHangar,
  field: buildField,
  ship: buildShip,
  control: buildControl,
  corridor: buildCorridor,
  lobby: buildLobby,
  lift: buildLift,
};
const BY_STATION = {
  ds1: { ...DS1_DEEP, ...DS1_SHAFT, ...DS1_DECK },
  ds2: { ...DS2_A, ...DS2_B },
};

// every kind any group draws, each choosing the station’s own builder first
export const ROOM_BUILDERS = Object.fromEntries(
  [...new Set([...Object.keys(SHARED), ...Object.values(BY_STATION).flatMap(Object.keys)])].map((kind) => [
    kind,
    (kit, room, layout, opts) => (BY_STATION[layout?.station?.id]?.[kind] ?? SHARED[kind] ?? buildPlain)(kit, room, layout, opts),
  ]),
);

export const drawsOwn = (station, kind) => Boolean(BY_STATION[station]?.[kind] ?? SHARED[kind]);

function buildPlain(kit, room, layout, { renderer = null } = {}) {
  const group = kit.merge(kit.shell(room, layout, { bay: 2, lights: true, seed: room.id.length }));
  group.name = room.id;
  const lamps = [{ x: room.x, y: room.y + room.h - 0.3, z: room.z, color: 0xdfe8ff, intensity: 3 * room.h ** 2, distance: Math.hypot(room.w, room.h, room.d) }];
  const reflection = probeRoom(renderer, group, { x: room.x, y: room.y + 1.3, z: room.z }, { lamps });
  return {
    group,
    lamps,
    dispose() {
      reflection.dispose();
      kit.free(group);
      group.removeFromParent();
    },
  };
}

export function buildRoom(kit, room, layout, opts = {}) {
  return (ROOM_BUILDERS[room.kind] ?? buildPlain)(kit, room, layout, opts);
}
