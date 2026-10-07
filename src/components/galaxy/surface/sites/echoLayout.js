// Echo Base, inside: the corridors behind the main hangar, as Wookieepedia
// has them ("carved out of a glacier and connected by artificial corridors
// linked together with structural supports, while natural caverns were
// expanded"), laid out from the Star Wars cutaway. In from the hangar's
// back-left door down the entry corridor to a junction: west to the command
// centre (the holo-table, the tactical screen), east to the medical centre
// (the bacta tank), north to a cavern widened from the wampas' den.
//
// Pure: the rooms as numbers, and what follows from them: the walls round
// them (solid ice, open where one room meets the next), the floors, the
// steel arches holding up the corridors, and the rooms as the zone's camera
// reads them. props/echo.js draws it; sites/ice.js makes it a zone.
//
// A room: { id, kind: 'corridor' | 'room' | 'cavern', at: [x, z], hw, hd
// (half its width and depth; a round one's radius is hw), h (its height),
// round? }, in metres, the floor at y = 0, the hangar door at +z.

export const ECHO_BASE = {
  rooms: [
    { id: 'entry', kind: 'corridor', at: [0, 12], hw: 1.8, hd: 12, h: 3.8 },
    { id: 'junction', kind: 'room', at: [0, -2], hw: 6, hd: 2, h: 4.2 },
    { id: 'west', kind: 'corridor', at: [-12, -2], hw: 6, hd: 1.8, h: 3.8 },
    { id: 'command', kind: 'room', at: [-26, -2], hw: 8, hd: 7, h: 5.5 },
    { id: 'east', kind: 'corridor', at: [12, -2], hw: 6, hd: 1.8, h: 3.8 },
    { id: 'medical', kind: 'room', at: [23, -2], hw: 5, hd: 5, h: 4.2 },
    { id: 'north', kind: 'corridor', at: [0, -10], hw: 1.8, hd: 6, h: 3.8 },
    { id: 'cavern', kind: 'cavern', at: [0, -24], hw: 9, hd: 9, h: 8, round: true },
  ],
  // (you come in at the hangar end, facing in; the way out is behind you)
  spawn: [0, 21.5],
  yaw: Math.PI,
  exit: { at: [0, 23.4], r: 1.4 },
  bounds: [34.5, 33.5, 8.5],
};

export function inRoom(r, x, z, pad = 0) {
  const dx = x - r.at[0];
  const dz = z - r.at[1];
  if (r.round) return Math.hypot(dx, dz) <= r.hw + pad;
  return Math.abs(dx) <= r.hw + pad && Math.abs(dz) <= r.hd + pad;
}

// whether (x, z) is within `pad` of a wall's box ({ box: [x, z, hw, hd,
// yaw] }, turned as the solids are: its local z along (sin yaw, cos yaw))
export function inSolid({ box: [bx, bz, hw, hd, yaw = 0] }, x, z, pad = 0) {
  const dx = x - bx;
  const dz = z - bz;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return Math.abs(dx * c - dz * s) <= hw + pad && Math.abs(dx * s + dz * c) <= hd + pad;
}

const T = 0.8; // (how thick a wall's solid is)
const PROBE = 0.4; // (how far past a room's edge to look for the next room)

// The walls: each room's edges in metre steps, solid where there's no room
// on the far side, the solid runs joined into one box each
export function wallsOf(rooms, step = 1) {
  const out = [];
  const open = (self, x, z) => rooms.some((r) => r !== self && inRoom(r, x, z));
  for (const r of rooms) {
    const [cx, cz] = r.at;
    if (r.round) {
      const n = Math.ceil((Math.PI * 2 * r.hw) / step);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        if (open(r, cx + Math.sin(a) * (r.hw + PROBE), cz + Math.cos(a) * (r.hw + PROBE))) continue;
        out.push({ box: [cx + Math.sin(a) * (r.hw + T / 2), cz + Math.cos(a) * (r.hw + T / 2), (Math.PI * r.hw) / n + 0.15, T / 2, a], room: r.id });
      }
      continue;
    }
    // an edge: where it runs from and to, and which way is out
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const along = nx ? r.hd : r.hw;
      const ex = cx + nx * r.hw;
      const ez = cz + nz * r.hd;
      const n = Math.max(1, Math.round((2 * along) / step));
      const len = (2 * along) / n;
      let run = null;
      const flush = () => {
        if (!run) return;
        const mid = (run[0] + run[1]) / 2;
        const half = (run[1] - run[0]) / 2 + T / 2; // (overlapping at the corners)
        out.push(nx ? { box: [ex + (nx * T) / 2, cz + mid, T / 2, half, 0], room: r.id } : { box: [cx + mid, ez + (nz * T) / 2, half, T / 2, 0], room: r.id });
        run = null;
      };
      for (let i = 0; i < n; i++) {
        const t0 = -along + i * len;
        const m = t0 + len / 2;
        const px = nx ? ex + nx * PROBE : cx + m;
        const pz = nx ? cz + m : ez + nz * PROBE;
        if (open(r, px, pz)) flush();
        else run = run ? [run[0], t0 + len] : [t0, t0 + len];
      }
      flush();
    }
  }
  return out;
}

// the steel arches holding up the corridors: about every 4 m along each,
// [x, z, the way the corridor runs]
export function archesOf(rooms, every = 4) {
  const out = [];
  for (const r of rooms) {
    if (r.kind !== 'corridor') continue;
    const along = r.hd > r.hw ? 'z' : 'x';
    const L = Math.max(r.hw, r.hd);
    for (let t = -L + 2; t <= L - 2 + 1e-6; t += every) out.push(along === 'z' ? [r.at[0], r.at[1] + t, 'z'] : [r.at[0] + t, r.at[1], 'x']);
  }
  return out;
}

export const floorsOf = (rooms) => rooms.map((r) => (r.round ? { x: r.at[0], z: r.at[1], r: r.hw, y: 0 } : { x: r.at[0], z: r.at[1], hw: r.hw, hd: r.hd, y: 0 }));

// the rooms as a zone's `inside.rooms` has them (the camera keeps inside
// the one you're in): [x, z, hw, hd, floor, ceiling, 'round'?]
export const zoneRooms = (rooms) => rooms.map((r) => [r.at[0], r.at[1], r.hw, r.hd, 0, r.h, ...(r.round ? ['round'] : [])]);
