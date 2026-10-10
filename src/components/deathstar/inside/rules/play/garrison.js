// Who is aboard when you come aboard: the garrison each room keeps, worked
// out from the room itself so it fits whatever the station’s rooms become.
// Consoles are worked (the furnished `work` spots), seats sat in (`sit`),
// posts kept (`post`); a room with no posts of its own has a trooper either
// side of a door inside it; a corridor has a trooper walking its length;
// droids potter about; and the people the talks, the eggs and the stories
// look for are tagged (the detention officer, the librarian, Tarkin at the
// conference table, G7 the mouse droid, Jerjerrod, the Emperor on his
// throne, Leia in cell 2187 for a Rebel). The same station and side always
// get the same garrison, and nobody is put where there is no floor or
// where something already stands. Pure.
//
//   garrison(layout, { side, skip }) → [{ id, kind, room, x, z, yaw, role, tag? }]
//     side: 'rebel' | 'imperial' (only a Rebel finds Leia in her cell)
//     skip: a Set of room ids left to the story, which brings its own people there
//     role: brains.js’s ({ type: 'post' | 'work' | 'patrol' | 'droid' | 'scripted', spot?, spots? })

import { furnish } from '../furnish';

// the rooms nobody keeps: lifts, the open fields, the bins, the shafts and the empty cells
const EMPTY = new Set(['lift', 'field', 'compactor', 'chute', 'shaft', 'chasm', 'ship', 'cell', 'meditation', 'superstructure']);
// who works each kind of room’s consoles, the first first, and how many at most
const WORK = {
  control: { who: ['officer', 'technician'], most: 3 },
  detention: { who: ['officer', 'stormtrooper', 'stormtrooper'], most: 3 },
  overbridge: { who: ['officer', 'gunner', 'gunner'], most: 5 },
  firecontrol: { who: ['gunner'], most: 5 },
  archive: { who: ['librarian'], most: 1 },
  command: { who: ['jerjerrod', 'officer', 'technician'], most: 6 },
  gallery: { who: ['technician'], most: 3 },
};
// who keeps a room’s posts, or stands either side of its doors when it has none
const GUARD = { throne: 'royalguard', holding: 'royalguard', overbridge: 'dstrooper', firecontrol: 'dstrooper', tiebay: 'tiepilot', hangar: 'stormtrooper' };
const POSTS = { throne: 2, holding: 2 };
// the conference table, Tarkin first
const SEATED = ['tarkin', 'motti', 'tagge', 'officer', 'officer'];
// the people a talk, an egg or a story finds by tag
const TAGGED = { jerjerrod: 'jerjerrod', tarkin: 'conference' };
const IN = 1.4; // metres in from a door a guard stands
const ASIDE = 0.9; // metres beyond the doorway’s edge
const CLEAR = 0.5; // metres a person keeps from anything standing
const FILE = 1.3; // metres between troopers standing in a rank
// a rank at a station spot named for one: a line in a bay, a block where the Emperor comes in
const RANK = { hangar272: [3, 4] };

// Facing along (dx, dz): yaw 0 faces −z, turning towards +x is positive.
const yawOf = (dx, dz) => Math.atan2(dx, -dz);

function free(layout, room, solids, x, z) {
  if (layout.floorAt(room.id, x, z) === null) return false;
  const b = room.box;
  if (x < b.x0 + CLEAR || x > b.x1 - CLEAR || z < b.z0 + CLEAR || z > b.z1 - CLEAR) return false;
  return !solids.some((s) =>
    s.box ? x > s.box.x0 - CLEAR && x < s.box.x1 + CLEAR && z > s.box.z0 - CLEAR && z < s.box.z1 + CLEAR : Math.hypot(x - s.circle.x, z - s.circle.z) < s.circle.r + CLEAR,
  );
}

// Two places inside a room by one of its doors, either side of it, facing it.
function byDoor(layout, room, door) {
  const across = door.axis === 'x' ? 'z' : 'x';
  const along = door.axis === 'x' ? 'x' : 'z';
  const inward = Math.sign(room[across] - door[across]) || 1;
  const face = door.axis === 'x' ? yawOf(0, -inward) : yawOf(-inward, 0);
  return [-1, 1].map((side) => {
    const p = { [across]: door[across] + inward * IN, [along]: door[along] + side * (door.w / 2 + ASIDE) };
    return { x: p.x, z: p.z, yaw: face };
  });
}

// The two ends of a corridor’s length, a quarter of the way in from each.
function ends(room) {
  const long = room.w >= room.d;
  const [a, b] = long ? [room.box.x0, room.box.x1] : [room.box.z0, room.box.z1];
  const q = (b - a) / 4;
  return [a + q, b - q].map((v, i) => (long ? { x: v, z: room.z, yaw: yawOf(i ? -1 : 1, 0) } : { x: room.x, z: v, yaw: yawOf(0, i ? -1 : 1) }));
}

export function garrison(layout, { side = 'rebel', skip = new Set() } = {}) {
  const out = [];
  const add = (kind, room, at, role, tag) => {
    const n = out.filter((p) => p.room === room.id && p.kind === kind).length;
    out.push({ id: `${room.id}-${kind}-${n + 1}`, kind, room: room.id, x: at.x, z: at.z, yaw: at.yaw ?? 0, role, ...(tag ? { tag } : {}) });
  };
  const spotOf = (room, at, name) => ({ name, room: room.id, x: at.x, z: at.z, yaw: at.yaw ?? 0 });
  let corridors = 0;
  let mice = 0;

  for (const room of layout.rooms.values()) {
    if (room.inside) continue;
    if (room.id === 'cell2187' && side === 'rebel' && !skip.has(room.id)) {
      const seat = furnish(room, layout.station).spots.find((s) => s.kind === 'sit');
      if (seat) add('leia', room, seat, { type: 'post', spot: seat }, 'leia');
      continue;
    }
    if (EMPTY.has(room.kind) || skip.has(room.id)) continue;
    const { spots, solids } = furnish(room, layout.station);
    const fits = (at) => free(layout, room, solids, at.x, at.z);

    const work = WORK[room.kind];
    if (work) {
      spots
        .filter((s) => s.kind === 'work')
        .slice(0, work.most)
        .forEach((s, i) => {
          const kind = work.who[Math.min(i, work.who.length - 1)];
          const tag = room.kind === 'detention' && i === 0 ? 'aa23-officer' : TAGGED[kind];
          add(kind, room, s, { type: 'work', spot: s }, tag);
        });
    }
    const seats = spots.filter((s) => s.kind === 'sit');
    if (room.kind === 'conference') seats.filter((s) => s.tag !== 'krennic-chair').slice(0, SEATED.length).forEach((s, i) => add(SEATED[i], room, s, { type: 'post', spot: s }, TAGGED[SEATED[i]]));
    if (room.kind === 'throne' && seats[0]) add('emperor', room, seats[0], { type: 'scripted' }, 'emperor');

    for (const [name, at] of Object.entries(layout.station.spots ?? {})) {
      if (at.room !== room.id || !name.startsWith('ranks')) continue;
      const [cols, rows] = RANK[room.id] ?? [3, 1];
      const [fx, fz] = [Math.sin(at.yaw ?? 0), -Math.cos(at.yaw ?? 0)];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const side = (c - (cols - 1) / 2) * FILE;
          const back = r * FILE * 1.4;
          const spot = { x: at.x + fz * -side - fx * back, z: at.z + fx * side - fz * back, yaw: at.yaw ?? 0 };
          if (fits(spot)) add('stormtrooper', room, spot, { type: 'post', spot: spotOf(room, spot, `${name}/${r}-${c}`) });
        }
      }
    }
    const posts = spots.filter((s) => s.kind === 'post');
    const guard = GUARD[room.kind] ?? 'stormtrooper';
    if (posts.length) {
      posts.slice(0, POSTS[room.kind] ?? posts.length).forEach((s) => add(guard, room, s, { type: 'post', spot: s }));
    } else if (room.kind !== 'corridor' && room.kind !== 'lobby' && room.kind !== 'cellbay' && room.kind !== 'maintenance') {
      // guards either side of the first door in, two doors at most in a big bay
      const doors = room.doors.map((id) => layout.doors.get(id)).filter((d) => d && d.kind !== 'arch');
      for (const door of doors.slice(0, room.kind === 'hangar' ? 2 : 1)) {
        for (const at of byDoor(layout, room, door)) if (fits(at)) add(guard, room, at, { type: 'post', spot: spotOf(room, at, `${room.id}/${door.id}`) });
      }
    }
    if (room.kind === 'corridor' || room.kind === 'cellbay' || room.kind === 'maintenance') {
      const [a, b] = ends(room);
      if (fits(a) && fits(b)) {
        add('stormtrooper', room, a, { type: 'patrol', spots: [spotOf(room, a, `${room.id}/a`), spotOf(room, b, `${room.id}/b`)] });
        // every other corridor has a mouse droid about its business; the one on Level 5 is G7
        if (room.kind === 'corridor' && corridors++ % 2 === 0 && mice < 4) {
          const mid = { x: room.x, z: room.z, yaw: 0 };
          if (fits(mid)) add('mouse', room, mid, { type: 'droid' }, room.section === 'level5' && !out.some((p) => p.tag === 'g7') ? 'g7' : undefined), (mice += 1);
        }
      }
    }
    if (room.kind === 'hangar' || room.kind === 'dock') {
      const mid = { x: room.x + room.w * 0.3, z: room.z + room.d * 0.3, yaw: 0 };
      if (fits(mid)) add(room.kind === 'hangar' ? 'gonk' : 'r5', room, mid, { type: 'droid' });
    }
  }
  return out;
}
