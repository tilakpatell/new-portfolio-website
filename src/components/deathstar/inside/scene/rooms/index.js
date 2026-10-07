// One builder a room kind (rules/layout.js’s ROOM_KINDS), each drawing a
// room of the layout in station coordinates from the Imperial kit: what
// scene/stream.js calls when a room comes within reach. Door leaves are not
// a room’s: the gaps are left open in their frames for the scene to fill
// from the game’s door states. Kinds without a builder of their own yet
// (Phase 3's and 4's rooms) get the kit’s plain shell, so a station never
// has a hole in it.
//
//   ROOM_BUILDERS: { [kind]: (kit, room, layout, opts) → { group, lamps, update?(t, dt, ctx), dispose() } }
//     opts: { renderer } (without one a room is built without its reflection probe)
//     lamps: [{ x, y, z, color, intensity, distance }], few: the panels light the room
//   buildRoom(kit, room, layout, opts) → the room, by its kind’s builder or the plain shell

import { probeRoom } from '../probe';
import { buildControl } from './control';
import { buildCorridor, buildLobby } from './corridor';
import { buildField, buildHangar, buildShip } from './hangar';
import { buildLift } from './lift';

export const ROOM_BUILDERS = {
  hangar: buildHangar,
  field: buildField,
  ship: buildShip,
  control: buildControl,
  corridor: buildCorridor,
  lobby: buildLobby,
  lift: buildLift,
};

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
