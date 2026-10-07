// The station’s corridors and lift lobbies, the kit at its plainest and
// most Death Star: glossy black floors that mirror the light grids on both
// walls (one every 4 m, facing each other across the corridor), grey
// ceilings with a broken strip of light down the middle and a chamfered
// cornice either side, and a lobby’s call panel by each lift door.
//
//   buildCorridor(kit, room, layout, { renderer }) → { group, lamps, dispose() }
//   buildLobby(kit, room, layout, { renderer }) → { group, lamps, dispose() }

import { roomWalls } from '../kit';
import { probeRoom } from '../probe';

const COOL = 0xdfe8ff;

// lamps down the middle of a room, about one every `every` metres along its length
function lampsDown(room, every, intensity, distance) {
  const alongX = room.w >= room.d;
  const len = alongX ? room.w : room.d;
  const n = Math.max(1, Math.round(len / every));
  return Array.from({ length: n }, (_, i) => {
    const t = ((i + 0.5) / n - 0.5) * len;
    return { x: room.x + (alongX ? t : 0), y: room.y + room.h - 0.3, z: room.z + (alongX ? 0 : t), color: COOL, intensity, distance };
  });
}

function finish(kit, room, parts, lamps, renderer) {
  const group = kit.merge(parts);
  group.name = room.id;
  const reflection = probeRoom(renderer, group, { x: room.x, y: room.y + 1.2, z: room.z }, { lamps });
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

export function buildCorridor(kit, room, layout, { renderer = null } = {}) {
  const parts = kit.shell(room, layout, { bay: 1.25, rib: 0.24, ribDepth: 0.1, lights: true, kick: 0.3, band: 0.4, tall: 1.3, seed: room.id.length * 17 });
  const alongX = room.w >= room.d;
  const [len, wide] = alongX ? [room.w, room.d] : [room.d, room.w];
  const top = room.y + room.h;
  // the light strip down the ceiling, in 2 m lengths with dark joints
  const n = Math.max(1, Math.floor((len - 0.8) / 2));
  for (let i = 0; i < n; i++) {
    const c = (i - (n - 1) / 2) * 2;
    const [x, z] = alongX ? [room.x + c, room.z] : [room.x, room.z + c];
    parts.push(kit.box(alongX ? 1.7 : 0.5, 0.04, alongX ? 0.5 : 1.7, x, top - 0.02, z, 'black'));
    parts.push(kit.plate(alongX ? 1.6 : 0.3, alongX ? 0.3 : 1.6, x, top - 0.045, z, 'strip', 'down'));
  }
  // the cornices: a chamfer the length of each long wall where it meets the ceiling
  for (const s of [-1, 1]) {
    const off = s * (wide / 2 - 0.16);
    const a = alongX ? { x: room.x - len / 2, z: room.z + off } : { x: room.x + off, z: room.z - len / 2 };
    const b = alongX ? { x: room.x + len / 2, z: room.z + off } : { x: room.x + off, z: room.z + len / 2 };
    parts.push(kit.beam({ ...a, y: top - 0.2 }, { ...b, y: top - 0.2 }, 0.32, 0.32, 'trim'));
  }
  return finish(kit, room, parts, lampsDown(room, 8, 20, 9), renderer);
}

// A lobby: its walls in wider bays, a coffer of light panels overhead, and
// beside every lift door a call panel, with a sign lit over the door.
export function buildLobby(kit, room, layout, { renderer = null } = {}) {
  const parts = kit.shell(room, layout, { bay: 1.6, rib: 0.3, ribDepth: 0.16, lights: true, tall: 1.6, seed: room.id.length * 23 });
  const top = room.y + room.h;
  const [w, d] = [room.box.x1 - room.box.x0, room.box.z1 - room.box.z0];
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const [x, z] = [room.x + dx * w * 0.2, room.z + dz * d * 0.2];
    parts.push(kit.box(1.9, 0.2, 1.9, x, top - 0.1, z, 'trim'));
    parts.push(kit.plate(1.6, 1.6, x, top - 0.205, z, 'strip', 'down'));
  }
  // a band set in the floor round the middle, flush
  const [iw, id] = [w * 0.5, d * 0.5];
  for (const [bw, bd, x, z] of [[iw, 0.08, room.x, room.z - id / 2], [iw, 0.08, room.x, room.z + id / 2], [0.08, id, room.x - iw / 2, room.z], [0.08, id, room.x + iw / 2, room.z]]) parts.push(kit.plate(bw, bd, x, room.y + 0.003, z, 'rail', 'up'));
  for (const run of roomWalls(layout, room.id)) {
    for (const h of run.holes) {
      const door = h.door ? layout.doors.get(h.door) : null;
      if (!door || layout.rooms.get(door.a === room.id ? door.b : door.a)?.kind !== 'lift') continue;
      const side = h.x1 + 0.6 <= run.len - 0.3 ? h.x1 + 0.6 : h.x0 - 0.6;
      const local = [
        kit.box(0.32, 0.52, 0.05, side, 1.25, 0.025, 'trim'),
        kit.plate(0.2, 0.32, side, 1.25, 0.052, 'console'),
        kit.box(0.08, 0.05, 0.02, side, 1.56, 0.05, 'red'),
        kit.box(Math.min(1.2, h.x1 - h.x0), 0.12, 0.04, (h.x0 + h.x1) / 2, h.y1 + 0.5, 0.02, 'strip'),
      ];
      parts.push(...kit.place(local, kit.at(run.x0, run.y0, run.z0, run.angle)));
    }
  }
  return finish(kit, room, parts, lampsDown(room, 6, 30, 10), renderer);
}
