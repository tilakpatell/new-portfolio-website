// A station’s room graph made solid. A station file (stations/ds1.js) says
// what rooms there are, where, and which doors and lifts join them; this
// turns that into what the walker, the doors, the paths, the camera and
// the scene all stand on: wall segments cut at every doorway, floors in
// station coordinates, each door’s height, and the two questions everyone
// asks (which room is this point in, and what floor is under it). It also
// refuses a graph that can’t be walked: a door off its wall, a room
// nothing leads to, rooms that overlap. Pure.
//
//   ROOM_KINDS                     every kind a room may be (the scene has one builder a kind)
//   buildLayout(station) → { station, rooms, doors, walls, lifts, jumps, roomAt, floorAt }
//     rooms: Map<id, room & { box: { x0, x1, z0, z1 }, doors: [doorId], floors: [{ x0, x1, z0, z1, y, tag? }] }>
//     doors: Map<id, door & { y }>   y: the floor the doorway stands on
//     walls: [{ x0, z0, x1, z1, y0, y1, room, door? }]   a doorway is its own segment, with `door`;
//       the wall over it (and under it, when it is raised) is a segment without. Walking a
//       segment from (x0, z0) to (x1, z1), its room is on the right, seen from above with north up.
//     lifts: Map<id, lift>
//     jumps: [{ id, from: roomId, x, z, r, to: spotName, prompt, lock? }]   use-points that move whoever
//       uses them within r of (x, z) to a spot: a drop down a chute, a swing across a chasm
//     roomAt(x, y, z) → roomId | null   the room whose footprint holds x, z with y within
//       [its lowest floor − 0.5, its ceiling]; a room nested inside another wins over it
//     floorAt(room, x, z, off?) → y | null   the highest floor there; null is a void (a shaft, a chasm,
//       space). A floor may carry a `tag`; one whose tag is in the Set `off` isn’t there (a bridge
//       drawn back).
//   offTags(layout, flags) → Set<tag>   the `off` to give floorAt: every tag on the layout’s floors that
//       no flag of that name has switched on. Everyone who asks floorAt (or reads a room’s floors)
//       while a story runs passes this, so a bridge exists only while its flag is set, the same for all.
//   validateStation(station) → [message]   empty when the station is sound
//
// A room may be nested in another (`inside: parentId`), like the Falcon’s
// hold standing in Docking Bay 327: it may overlap its parent and no other
// room, and the door between them is on the nested room’s wall, inside
// the parent. Round rooms (`round: true`, w the diameter) are walled with
// 24 segments, and take doors only where their wall runs along the door.
// A jump is a way in that only goes one way, so a room reached only by
// dropping into it still counts as reached, and the room dropped from
// doesn’t count as reached from it.

export const ROOM_KINDS = [
  'hangar',
  'control',
  'corridor',
  'lift',
  'lobby',
  'detention',
  'cellbay',
  'cell',
  'compactor',
  'chute',
  'shaft',
  'chasm',
  'conference',
  'overbridge',
  'firecontrol',
  'tiebay',
  'meditation',
  'archive',
  'maintenance',
  'reactor',
  'throne',
  'holding',
  'command',
  'dock',
  'superstructure',
  'gallery',
  // a ship standing in a bay, walked inside (the Falcon’s hold)
  'ship',
  // the open side of a bay: the magnetic field and the space beyond it, drawn by the bay
  'field',
];

const DOOR_KINDS = ['slide', 'blast', 'arch', 'hatch'];
const LOCK = /^(flag:[\w-]+|code:\d+|scomp|side:imperial)$/;
const ON = 0.05; // how far a door’s centre may sit off its wall
const STEP = 0.4; // the body’s step (walker.js reads layouts, so the number lives here too)
const UNDER = 0.5; // how far under its floor a point still counts as in a room
const PROBE = 0.3; // how far either side of a doorway its floors are read
const SEGMENTS = 24; // a round room’s wall
const SLACK = 0.01; // rooms that touch don’t overlap
const TINY = 1e-6;

// (a round room gives only its diameter, w: its box is the square round its circle)
const boxOf = (r) => {
  const d = r.round ? r.w : r.d;
  return { x0: r.x - r.w / 2, x1: r.x + r.w / 2, z0: r.z - d / 2, z1: r.z + d / 2 };
};

function floorsOf(r) {
  if (!r.floors) return [{ ...boxOf(r), y: r.y, ...(r.round ? { circle: { x: r.x, z: r.z, r: r.w / 2 } } : {}) }];
  return r.floors.map((f) => ({ x0: r.x + f.x - f.w / 2, x1: r.x + f.x + f.w / 2, z0: r.z + f.z - f.d / 2, z1: r.z + f.z + f.d / 2, y: r.y + f.y, ...(f.tag ? { tag: f.tag } : {}) }));
}

// Tags that say what a floor is rather than whether it is there: no flag
// takes these away.
const STANDING = new Set(['water']);

function inFloor(f, x, z) {
  if (x < f.x0 || x > f.x1 || z < f.z0 || z > f.z1) return false;
  return !f.circle || (x - f.circle.x) ** 2 + (z - f.circle.z) ** 2 <= f.circle.r ** 2;
}

function floorIn(room, x, z, off) {
  let y = null;
  for (const f of room.floors) if (inFloor(f, x, z) && (y === null || f.y > y) && !(f.tag && off?.has(f.tag))) y = f.y;
  return y;
}

function holds(room, x, z, pad = 0) {
  if (room.round) return Math.hypot(x - room.x, z - room.z) <= room.w / 2 + pad;
  const b = room.box;
  return x >= b.x0 - pad && x <= b.x1 + pad && z >= b.z0 - pad && z <= b.z1 + pad;
}

// a room’s height from its lowest floor (water can lie under its nominal floor) to its ceiling
const heights = (room) => ({ lo: Math.min(room.y, ...room.floors.map((f) => f.y)), hi: room.y + room.h });

// The four sides of a box room, each walked with the room on its right;
// `n` points into the room.
function sidesOf(room) {
  const { x0, x1, z0, z1 } = room.box;
  return [
    { axis: 'x', at: z0, a: { x: x0, z: z0 }, b: { x: x1, z: z0 }, n: { x: 0, z: 1 } },
    { axis: 'z', at: x1, a: { x: x1, z: z0 }, b: { x: x1, z: z1 }, n: { x: -1, z: 0 } },
    { axis: 'x', at: z1, a: { x: x1, z: z1 }, b: { x: x0, z: z1 }, n: { x: 0, z: -1 } },
    { axis: 'z', at: x0, a: { x: x0, z: z1 }, b: { x: x0, z: z0 }, n: { x: 1, z: 0 } },
  ];
}

// Where a door sits against a room’s wall: 'on' it, 'past' the end of it,
// or 'off' it altogether; with the side it is on and the way into the room.
function placeOn(room, door) {
  if (room.round) {
    const r = room.w / 2;
    const along = door.axis === 'x' ? door.x - room.x : door.z - room.z;
    if (Math.abs(Math.hypot(door.x - room.x, door.z - room.z) - r) > ON || Math.abs(along) > ON) return { at: 'off' };
    const n = door.axis === 'x' ? { x: 0, z: Math.sign(room.z - door.z) } : { x: Math.sign(room.x - door.x), z: 0 };
    return { at: door.w < 2 * r ? 'on' : 'past', n };
  }
  const sides = sidesOf(room);
  for (let i = 0; i < sides.length; i++) {
    const side = sides[i];
    if (side.axis !== door.axis || Math.abs((door.axis === 'x' ? door.z : door.x) - side.at) > ON) continue;
    const t = door.axis === 'x' ? door.x : door.z;
    const [p, q] = door.axis === 'x' ? [side.a.x, side.b.x] : [side.a.z, side.b.z];
    return { at: t - door.w / 2 >= Math.min(p, q) - ON && t + door.w / 2 <= Math.max(p, q) + ON ? 'on' : 'past', side: i, n: side.n };
  }
  return { at: 'off' };
}

const nestedIn = (child, parent) => child?.inside !== undefined && child.inside === parent?.id;

// The floors either side of a doorway, read a little way into each room.
// The parent of a nested room has no wall at the door, so it is read on
// the far side of the nested room’s wall.
function doorFloors(rooms, door) {
  const A = rooms.get(door.a);
  const B = rooms.get(door.b);
  let na = A ? placeOn(A, door).n : undefined;
  let nb = B ? placeOn(B, door).n : undefined;
  if (!na && nb) na = { x: -nb.x, z: -nb.z };
  if (!nb && na) nb = { x: -na.x, z: -na.z };
  const read = (R, n) => (R && n ? floorIn(R, door.x + n.x * PROBE, door.z + n.z * PROBE) : null);
  return { a: read(A, na), b: read(B, nb) };
}

function doorY(rooms, door) {
  const { a, b } = doorFloors(rooms, door);
  if (a !== null || b !== null) return Math.max(a ?? -Infinity, b ?? -Infinity);
  return Math.max(rooms.get(door.a)?.y ?? -Infinity, rooms.get(door.b)?.y ?? -Infinity);
}

// One stretch of wall from p to q, cut into the doorway and whatever
// wall stands over and under it when the door is lower than the room.
// (the wall over a doorway says whose it is, `over`, so one taller than a man can stoop under it)
function pushPiece(walls, room, p, q, y0, y1, door, over) {
  if (Math.hypot(q.x - p.x, q.z - p.z) < TINY || y1 - y0 < TINY) return;
  walls.push({ x0: p.x, z0: p.z, x1: q.x, z1: q.z, y0, y1, room: room.id, ...(door ? { door: door.id } : {}), ...(over ? { over: over.id } : {}) });
}

function pushDoorway(walls, room, p, q, door, lo, hi) {
  const top = Math.min(hi, door.y + door.h);
  const foot = Math.max(lo, door.y);
  pushPiece(walls, room, p, q, lo, foot);
  pushPiece(walls, room, p, q, foot, top, door);
  pushPiece(walls, room, p, q, top, hi, null, door);
}

function boxWalls(walls, room, doors) {
  const { lo, hi } = heights(room);
  sidesOf(room).forEach((side, i) => {
    const len = Math.hypot(side.b.x - side.a.x, side.b.z - side.a.z);
    const ux = (side.b.x - side.a.x) / len;
    const uz = (side.b.z - side.a.z) / len;
    const at = (t) => ({ x: side.a.x + ux * t, z: side.a.z + uz * t });
    const cuts = doors
      .filter((d) => placeOn(room, d).side === i)
      .map((d) => {
        const t = (d.x - side.a.x) * ux + (d.z - side.a.z) * uz;
        return { door: d, t0: Math.max(0, t - d.w / 2), t1: Math.min(len, t + d.w / 2) };
      })
      .sort((p, q) => p.t0 - q.t0);
    let t = 0;
    for (const c of cuts) {
      pushPiece(walls, room, at(t), at(c.t0), lo, hi);
      pushDoorway(walls, room, at(c.t0), at(c.t1), c.door, lo, hi);
      t = c.t1;
    }
    pushPiece(walls, room, at(t), at(len), lo, hi);
  });
}

// 0 at north, growing towards east: clockwise seen from above with north up
const turnOf = (room, x, z) => {
  const a = Math.atan2(x - room.x, -(z - room.z));
  return a < 0 ? a + 2 * Math.PI : a;
};
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

function roundWalls(walls, room, doors) {
  const { lo, hi } = heights(room);
  const r = room.w / 2;
  const marks = [];
  const gaps = [];
  for (const door of doors) {
    if (placeOn(room, door).at !== 'on') continue;
    const ends = door.axis === 'x' ? [{ x: door.x - door.w / 2, z: door.z }, { x: door.x + door.w / 2, z: door.z }] : [{ x: door.x, z: door.z - door.w / 2 }, { x: door.x, z: door.z + door.w / 2 }];
    const mid = turnOf(room, door.x, door.z);
    const [first, last] = ends.map((p) => ({ ...p, off: wrap(turnOf(room, p.x, p.z) - mid) })).sort((p, q) => p.off - q.off);
    gaps.push({ mid, half: Math.max(-first.off, last.off) });
    marks.push({ x: first.x, z: first.z, turn: turnOf(room, first.x, first.z), opens: door }, { x: last.x, z: last.z, turn: turnOf(room, last.x, last.z), closes: door });
  }
  for (let k = 0; k < SEGMENTS; k++) {
    const turn = ((k + 0.5) * 2 * Math.PI) / SEGMENTS;
    if (gaps.some((g) => Math.abs(wrap(turn - g.mid)) <= g.half + TINY)) continue;
    marks.push({ x: room.x + r * Math.sin(turn), z: room.z - r * Math.cos(turn), turn });
  }
  marks.sort((p, q) => p.turn - q.turn);
  marks.forEach((p, i) => {
    const q = marks[(i + 1) % marks.length];
    if (p.opens && q.closes === p.opens) pushDoorway(walls, room, p, q, p.opens, lo, hi);
    else pushPiece(walls, room, p, q, lo, hi);
  });
}

export function buildLayout(station) {
  const rooms = new Map();
  for (const r of station.rooms ?? []) rooms.set(r.id, { ...r, box: boxOf(r), doors: [], floors: floorsOf(r) });
  const doors = new Map();
  for (const d of station.doors ?? []) {
    doors.set(d.id, { ...d, y: doorY(rooms, d) });
    for (const id of new Set([d.a, d.b])) rooms.get(id)?.doors.push(d.id);
  }
  const walls = [];
  for (const room of rooms.values()) {
    const own = room.doors.map((id) => doors.get(id));
    if (room.round) roundWalls(walls, room, own);
    else boxWalls(walls, room, own);
  }
  const lifts = new Map((station.lifts ?? []).map((l) => [l.id, l]));
  const jumps = (station.jumps ?? []).map((j) => ({ ...j }));
  // asked of every body every step, so each room’s heights and nesting are worked out once
  const depth = (room) => {
    let n = 0;
    for (let r = room; r?.inside !== undefined && n <= rooms.size; r = rooms.get(r.inside)) n++;
    return n;
  };
  const reach = [...rooms.values()].map((room) => ({ room, ...heights(room), depth: depth(room) }));

  function roomAt(x, y, z) {
    let best = null;
    let rank = null;
    for (const { room, lo, hi, depth } of reach) {
      if (!holds(room, x, z) || y < lo - UNDER || y > hi) continue;
      // standing in a room beats hanging just under its floor; then the innermost; then the higher
      const mine = [y >= lo ? 1 : 0, depth, room.y];
      if (!rank || mine[0] > rank[0] || (mine[0] === rank[0] && (mine[1] > rank[1] || (mine[1] === rank[1] && mine[2] > rank[2])))) {
        best = room.id;
        rank = mine;
      }
    }
    return best;
  }

  function floorAt(id, x, z, off) {
    const room = rooms.get(id);
    return room ? floorIn(room, x, z, off) : null;
  }

  return { station, rooms, doors, walls, lifts, jumps, roomAt, floorAt };
}

// asked every step, so each layout’s switched tags are gathered once
const switched = new WeakMap();

export function offTags(layout, flags) {
  if (!switched.has(layout)) {
    const tags = new Set();
    for (const room of layout.rooms.values()) for (const f of room.floors) if (f.tag && !STANDING.has(f.tag)) tags.add(f.tag);
    switched.set(layout, [...tags]);
  }
  const on = flags instanceof Set ? flags : new Set(flags ?? []);
  return new Set(switched.get(layout).filter((tag) => !on.has(tag)));
}

function overlaps(a, b) {
  const ya = heights(a);
  const yb = heights(b);
  if (ya.lo >= yb.hi - SLACK || yb.lo >= ya.hi - SLACK) return false;
  if (a.round && b.round) return Math.hypot(a.x - b.x, a.z - b.z) < a.w / 2 + b.w / 2 - SLACK;
  if (a.round || b.round) {
    const [c, s] = a.round ? [a, b] : [b, a];
    const nx = Math.max(s.box.x0, Math.min(c.x, s.box.x1));
    const nz = Math.max(s.box.z0, Math.min(c.z, s.box.z1));
    return Math.hypot(c.x - nx, c.z - nz) < c.w / 2 - SLACK;
  }
  return a.box.x0 < b.box.x1 - SLACK && b.box.x0 < a.box.x1 - SLACK && a.box.z0 < b.box.z1 - SLACK && b.box.z0 < a.box.z1 - SLACK;
}

const ancestorOf = (rooms, maybe, room) => {
  for (let r = room, n = 0; r?.inside !== undefined && n <= rooms.size; r = rooms.get(r.inside), n++) if (r.inside === maybe.id) return true;
  return false;
};

function checkRooms(station, layout, say) {
  const seen = new Set();
  for (const raw of station.rooms ?? []) {
    if (seen.has(raw.id)) say(`room ${raw.id} is used twice`);
    seen.add(raw.id);
    const room = layout.rooms.get(raw.id);
    if (!ROOM_KINDS.includes(raw.kind)) say(`room ${raw.id}: no such kind as ${raw.kind}`);
    if (!station.sections?.[raw.section]) say(`room ${raw.id}: its section ${raw.section} has no name for the intercom`);
    for (const f of room.floors) if (f.x0 < room.box.x0 - ON || f.x1 > room.box.x1 + ON || f.z0 < room.box.z0 - ON || f.z1 > room.box.z1 + ON) say(`room ${raw.id}: a floor reaches past its walls`);
    if (raw.inside === undefined) continue;
    const parent = layout.rooms.get(raw.inside);
    if (!parent || parent.id === raw.id) {
      say(`room ${raw.id}: there is no room ${raw.inside} for it to be inside`);
      continue;
    }
    const { lo, hi } = heights(room);
    const p = heights(parent);
    const within = [room.box.x0, room.box.x1].every((x) => [room.box.z0, room.box.z1].every((z) => holds(parent, x, z, ON)));
    if (!within || lo < p.lo - ON || hi > p.hi + ON) say(`room ${raw.id} pokes out of ${parent.id}, the room it is inside`);
  }
  const all = [...layout.rooms.values()];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const [a, b] = [all[i], all[j]];
      if (ancestorOf(layout.rooms, a, b) || ancestorOf(layout.rooms, b, a)) continue;
      if (overlaps(a, b)) say(`rooms ${a.id} and ${b.id} overlap`);
    }
  }
}

function checkDoors(station, layout, say) {
  const seen = new Set();
  for (const door of station.doors ?? []) {
    if (seen.has(door.id)) say(`door ${door.id} is used twice`);
    seen.add(door.id);
    if (!DOOR_KINDS.includes(door.kind)) say(`door ${door.id}: no such kind as ${door.kind}`);
    if (door.lock !== undefined && !LOCK.test(door.lock)) say(`door ${door.id}: no such lock as “${door.lock}”`);
    const A = layout.rooms.get(door.a);
    const B = layout.rooms.get(door.b);
    for (const [id, R] of [[door.a, A], [door.b, B]]) if (!R) say(`door ${door.id}: there is no room ${id}`);
    if (!A || !B) continue;
    if (A === B) {
      say(`door ${door.id} leads from ${A.id} to itself`);
      continue;
    }
    const y = doorY(layout.rooms, door);
    const parent = nestedIn(A, B) ? B : nestedIn(B, A) ? A : null;
    for (const R of [A, B]) {
      const { at } = placeOn(R, door);
      if (R === parent) {
        const ends = door.axis === 'x' ? [[door.x - door.w / 2, door.z], [door.x + door.w / 2, door.z]] : [[door.x, door.z - door.w / 2], [door.x, door.z + door.w / 2]];
        if (at !== 'off') say(`door ${door.id} is on a wall of ${R.id}, but the room it leads to is inside ${R.id}`);
        else if (!ends.every(([x, z]) => holds(R, x, z))) say(`door ${door.id} is not inside ${R.id}`);
      } else if (at === 'off') say(`door ${door.id} is not on a wall of ${R.id}`);
      else if (at === 'past') say(`door ${door.id} runs past the end of its wall in ${R.id}`);
      if (y + door.h > R.y + R.h + ON) say(`door ${door.id} is taller than ${R.id}`);
    }
    const f = doorFloors(layout.rooms, door);
    if (f.a !== null && f.b !== null && Math.abs(f.a - f.b) > STEP + TINY) say(`door ${door.id}: the floors either side differ by ${Math.abs(f.a - f.b).toFixed(2)} m, more than a step`);
  }
}

function checkLifts(station, layout, say) {
  const seen = new Set();
  for (const lift of station.lifts ?? []) {
    if (seen.has(lift.id)) say(`lift ${lift.id} is used twice`);
    seen.add(lift.id);
    for (const stop of lift.stops ?? []) {
      const room = layout.rooms.get(stop);
      if (!room) say(`lift ${lift.id}: there is no room ${stop} to stop at`);
      else if (room.kind !== 'lift') say(`lift ${lift.id}: its stop ${stop} is not a room of kind lift`);
    }
  }
}

function checkJumps(station, layout, say) {
  const seen = new Set();
  for (const jump of station.jumps ?? []) {
    if (seen.has(jump.id)) say(`jump ${jump.id} is used twice`);
    seen.add(jump.id);
    const room = layout.rooms.get(jump.from);
    if (!room) say(`jump ${jump.id}: there is no room ${jump.from} to jump from`);
    else if (!holds(room, jump.x, jump.z)) say(`jump ${jump.id} stands outside ${room.id}`);
    if (!(jump.r > 0)) say(`jump ${jump.id}: its reach must be more than nothing`);
    if (!station.spots?.[jump.to]) say(`jump ${jump.id}: there is no spot ${jump.to} to land on`);
    if (jump.lock !== undefined && !LOCK.test(jump.lock)) say(`jump ${jump.id}: no such lock as “${jump.lock}”`);
  }
}

// Every room must be reachable from where the Rebel starts, through doors
// and lifts (a lift joins all its stops), and jumps, which go one way.
function checkReach(station, layout, say) {
  const from = station.starts?.rebel?.room;
  if (!layout.rooms.has(from)) return;
  const next = new Map([...layout.rooms.keys()].map((id) => [id, new Set()]));
  const link = (a, b) => {
    if (next.has(a) && next.has(b)) next.get(a).add(b);
  };
  const join = (a, b) => {
    link(a, b);
    link(b, a);
  };
  for (const d of station.doors ?? []) join(d.a, d.b);
  for (const l of station.lifts ?? []) for (const a of l.stops ?? []) for (const b of l.stops ?? []) if (a !== b) join(a, b);
  for (const j of station.jumps ?? []) link(j.from, station.spots?.[j.to]?.room);
  const reached = new Set([from]);
  const queue = [from];
  while (queue.length) {
    for (const n of next.get(queue.pop())) {
      if (reached.has(n)) continue;
      reached.add(n);
      queue.push(n);
    }
  }
  for (const id of layout.rooms.keys()) if (!reached.has(id)) say(`room ${id} cannot be reached from ${from}, where the Rebel starts`);
}

function checkPlaces(station, layout, say) {
  for (const side of ['rebel', 'imperial']) {
    const s = station.starts?.[side];
    const room = layout.rooms.get(s?.room);
    if (!room) say(`the ${side} start is in no room the station has`);
    else if (!holds(room, s.x, s.z)) say(`the ${side} start stands outside ${room.id}`);
  }
  for (const [name, spot] of Object.entries(station.spots ?? {})) {
    const room = layout.rooms.get(spot.room);
    if (!room) say(`spot ${name}: there is no room ${spot.room}`);
    else if (!holds(room, spot.x, spot.z)) say(`spot ${name} stands outside ${room.id}`);
  }
}

export function validateStation(station) {
  const errors = [];
  const say = (message) => errors.push(message);
  const layout = buildLayout(station);
  checkRooms(station, layout, say);
  checkDoors(station, layout, say);
  checkLifts(station, layout, say);
  checkJumps(station, layout, say);
  checkReach(station, layout, say);
  checkPlaces(station, layout, say);
  return errors;
}
