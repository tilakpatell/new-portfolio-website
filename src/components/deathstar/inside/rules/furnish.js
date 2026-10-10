// What stands in each room aboard: furniture, fittings and the ships in
// the bays, laid out in station coordinates from the layout’s room and the
// station’s spots, so the walker, the paths and the drawing all agree on
// where the table is. Each kind of room has its own furnisher. A thing a
// story or an egg looks for carries a tag and stands where the station’s
// spot for it says (the scomp socket on the wall its spot faces, the
// horseshoe of consoles round the desk spot, the Falcon on her own spot).
// Clutter (crates, junk, consoles in rows) is placed with a random seeded
// by the room’s id, and kept only where it fits: inside the room, wholly
// on one floor, clear of the metre in front of every door, of a body’s
// width round every spot, start and jump, and of what already stands there.
// Pure.
//
//   furnish(room, station) → { solids, props, spots }
//     room: a buildLayout(station) room (its box, floors and `round` are read); station: its rooms, doors,
//       spots, starts and jumps
//     solids: [{ box: { x0, x1, z0, z1, y0, y1 } } | { circle: { x, z, r, y0, y1 } }]   for walker.js and
//       nav.js. Every one stands on a floor, from that floor up: nothing hangs overhead, so nav can take
//       them all as they are.
//     props: [{ kind, x, y, z, yaw, w, d, h, tag?, text? }]   what the room’s builder draws: (x, z) the middle
//       of its footprint and y its foot; it faces along yaw (0 faces −z), w across that, d along it, h tall.
//       tag: what a story or an egg finds it by; text: what is written on it.
//     spots: [{ name, kind: 'work' | 'post' | 'sit', room, x, y, z, yaw, tag? }]   where someone stands to work
//       a console or keep a post, or sits, facing yaw; name is `<room>/<kind><n>`. Each is a place brains.js
//       takes as a role’s spot as it is.
//
// A few of the station’s spots name the thing standing on them rather
// than a place to stand (the Falcon, the conference table, the throne, the
// meditation pod): a prop stands exactly there, and its solid covers it.

import { seeded } from '../../../../lib/seeded';

const R = 0.35; // a body’s radius (walker.js): kept clear round every spot, start and jump
const MARGIN = 0.02; // and a little more, so a body put there isn’t pushed
const FRONT = 1; // the strip in front of a door, either side, kept clear of anything solid
const GAP = 0.25; // between a console’s face and whoever works it
const SPACE = 0.15; // between one piece of clutter and the next
const CONSOLE = 0.42; // how far a console stands out from its wall: whoever works it leans over its lip
const HAIR = 1e-6;
const TURN = Math.PI / 2;

const fwd = (yaw) => ({ x: Math.sin(yaw), z: -Math.cos(yaw) });
// the point f ahead of p, facing yaw, and r to its right
const ahead = (p, yaw, f, r = 0) => ({ x: p.x + Math.sin(yaw) * f + Math.cos(yaw) * r, z: p.z - Math.cos(yaw) * f + Math.sin(yaw) * r });
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const yawTo = (p, q) => Math.atan2(q.x - p.x, -(q.z - p.z));
// rounds away float dust (0.30000000000000004) and turns −0 into 0
const tidy = (v) => Math.round(v * 1e9) / 1e9 || 0;

// the box a rectangle in a frame covers seen from above: right r0–r1 and ahead f0–f1 of p facing yaw
function frameRect(p, yaw, r0, r1, f0, f1) {
  const pts = [ahead(p, yaw, f0, r0), ahead(p, yaw, f0, r1), ahead(p, yaw, f1, r0), ahead(p, yaw, f1, r1)];
  return { x0: Math.min(...pts.map((q) => q.x)), x1: Math.max(...pts.map((q) => q.x)), z0: Math.min(...pts.map((q) => q.z)), z1: Math.max(...pts.map((q) => q.z)) };
}
// and a w × d footprint at (x, z), turned to yaw
const rectOf = (x, z, yaw, w, d) => frameRect({ x, z }, yaw, -w / 2, w / 2, -d / 2, d / 2);

const overlap = (a, b) => a.x0 < b.x1 - HAIR && b.x0 < a.x1 - HAIR && a.z0 < b.z1 - HAIR && b.z0 < a.z1 - HAIR;
const grow = (b, g) => ({ x0: b.x0 - g, x1: b.x1 + g, z0: b.z0 - g, z1: b.z1 + g });
const boxOf = (s) => (s.box ? s.box : { x0: s.circle.x - s.circle.r, x1: s.circle.x + s.circle.r, z0: s.circle.z - s.circle.r, z1: s.circle.z + s.circle.r });
const rawBox = (r) => ({ x0: r.x - r.w / 2, x1: r.x + r.w / 2, z0: r.z - r.d / 2, z1: r.z + r.d / 2 });

// how far a point stands from a solid seen from above, 0 inside it
function toSolid(s, p) {
  if (s.circle) return Math.max(0, Math.hypot(p.x - s.circle.x, p.z - s.circle.z) - s.circle.r);
  const b = s.box ?? s;
  return Math.hypot(Math.max(b.x0 - p.x, 0, p.x - b.x1), Math.max(b.z0 - p.z, 0, p.z - b.z1));
}

// whether the segment a–b passes within r of a box, read every 10 cm along it (lanes are wider than that)
function laneHits({ a, b, r }, box) {
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.1));
  return Array.from({ length: n + 1 }, (_, k) => ({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n })).some((p) => toSolid(box, p) < r);
}

// a box less another, as up to four boxes (no slivers where their edges all but meet)
function cut(b, c) {
  if (!overlap(b, c)) return [b];
  const out = [];
  const [z0, z1] = [Math.max(b.z0, c.z0), Math.min(b.z1, c.z1)];
  if (c.z0 > b.z0 + 0.001) out.push({ ...b, z1: c.z0 });
  if (c.z1 < b.z1 - 0.001) out.push({ ...b, z0: c.z1 });
  if (c.x0 > b.x0 + 0.001) out.push({ ...b, x1: c.x0, z0, z1 });
  if (c.x1 < b.x1 - 0.001) out.push({ ...b, x0: c.x1, z0, z1 });
  return out;
}

// the metre in front of a door, either side of it
const stripOf = (d) => (d.axis === 'x' ? { x0: d.x - d.w / 2, x1: d.x + d.w / 2, z0: d.z - FRONT, z1: d.z + FRONT } : { x0: d.x - FRONT, x1: d.x + FRONT, z0: d.z - d.w / 2, z1: d.z + d.w / 2 });

// FNV-1a over the id, so each room’s scatter is its own and the same every visit
function seedOf(id) {
  let h = 2166136261;
  for (const ch of String(id)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

// ── the room ──

function floorUnder(room, x, z) {
  let y = null;
  for (const f of room.floors ?? []) {
    const off = x < f.x0 - HAIR || x > f.x1 + HAIR || z < f.z0 - HAIR || z > f.z1 + HAIR || (f.circle && Math.hypot(x - f.circle.x, z - f.circle.z) > f.circle.r + HAIR);
    if (!off && (y === null || f.y > y)) y = f.y;
  }
  return y;
}

function holdsRect(room, b) {
  if (room.round) return [[b.x0, b.z0], [b.x0, b.z1], [b.x1, b.z0], [b.x1, b.z1]].every(([x, z]) => Math.hypot(x - room.x, z - room.z) <= room.w / 2 + HAIR);
  return b.x0 >= room.box.x0 - HAIR && b.x1 <= room.box.x1 + HAIR && b.z0 >= room.box.z0 - HAIR && b.z1 <= room.box.z1 + HAIR;
}

const holdsBody = (room, p) => (room.round ? Math.hypot(p.x - room.x, p.z - room.z) <= room.w / 2 - R : holdsRect(room, grow({ x0: p.x, x1: p.x, z0: p.z, z1: p.z }, R)));

// whether the whole of a footprint stands on one floor, at y
function level(room, b, y) {
  const n = Math.max(1, Math.ceil((b.x1 - b.x0) / 0.9));
  const m = Math.max(1, Math.ceil((b.z1 - b.z0) / 0.9));
  for (let i = 0; i <= n; i++) for (let j = 0; j <= m; j++) {
    const f = floorUnder(room, b.x0 + 0.01 + ((b.x1 - b.x0 - 0.02) * i) / n, b.z0 + 0.01 + ((b.z1 - b.z0 - 0.02) * j) / m);
    if (f === null || Math.abs(f - y) > HAIR) return false;
  }
  return true;
}

// A box room’s four walls: where each runs, and the yaw facing into the room off it.
function wallsOf(room) {
  if (room.round) return [];
  const b = room.box;
  return [
    { side: 'north', axis: 'x', at: b.z0, from: b.x0, to: b.x1, yaw: Math.PI },
    { side: 'south', axis: 'x', at: b.z1, from: b.x0, to: b.x1, yaw: 0 },
    { side: 'west', axis: 'z', at: b.x0, from: b.z0, to: b.z1, yaw: TURN },
    { side: 'east', axis: 'z', at: b.x1, from: b.z0, to: b.z1, yaw: -TURN },
  ];
}

// the point t along a wall, `off` out from it into the room
const onWall = (wall, t, off = 0) => ahead(wall.axis === 'x' ? { x: t, z: wall.at } : { x: wall.at, z: t }, wall.yaw, off);
const alongOf = (wall, p) => (wall.axis === 'x' ? p.x : p.z);
const wallOfDoor = (room, d) => wallsOf(room).find((w) => w.axis === d.axis && Math.abs((d.axis === 'x' ? d.z : d.x) - w.at) < 0.05) ?? null;

// The wall a spot faces, and where its gaze meets it.
function facedWall(room, s) {
  const f = fwd(s.yaw);
  let best = null;
  for (const wall of wallsOf(room)) {
    const n = fwd(wall.yaw);
    const toward = -(f.x * n.x + f.z * n.z);
    if (toward < 0.5) continue;
    const gap = Math.abs((wall.axis === 'x' ? s.z : s.x) - wall.at) / toward;
    if (!best || gap < best.gap) best = { wall, gap, x: s.x + f.x * gap, z: s.z + f.z * gap };
  }
  return best;
}

// ── the workshop: what a furnisher places things with ──

function workshop(room, station) {
  const rand = seeded(seedOf(room.id));
  const out = { solids: [], props: [], spots: [] };
  const doors = (station.doors ?? []).filter((d) => d.a === room.id || d.b === room.id);
  const strips = doors.map(stripOf);
  const named = Object.entries(station.spots ?? {}).filter(([, s]) => s.room === room.id).map(([name, s]) => ({ ...s, name }));
  const jumps = (station.jumps ?? []).filter((j) => j.from === room.id);
  // where people must be able to stand; the work places made here join it
  const places = [...named, ...Object.values(station.starts ?? {}).filter((s) => s.room === room.id), ...jumps];
  const taken = []; // what stands on the floor so far, solid or flat, which clutter keeps clear of
  const lanes = []; // ways kept clear of clutter: { a, b, r }
  const count = { work: 0, post: 0, sit: 0 };
  const floor = (x, z) => floorUnder(room, x, z);

  const standable = (p, y, extra) =>
    holdsBody(room, p) && floor(p.x, p.z) !== null && Math.abs(floor(p.x, p.z) - y) < HAIR && !strips.some((s) => toSolid(s, p) < R) && ![...out.solids, ...extra].some((s) => toSolid(s, p) < R + MARGIN);

  function spot(kind, p, yaw, tag) {
    count[kind] += 1;
    const s = { name: `${room.id}/${kind}${count[kind]}`, kind, room: room.id, x: tidy(p.x), y: tidy(p.y ?? floor(p.x, p.z) ?? room.y), z: tidy(p.z), yaw: wrap(yaw) || 0, ...(tag ? { tag } : {}) };
    out.spots.push(s);
    if (kind !== 'sit') places.push(s);
    return s;
  }

  // Puts a prop down. loose: only if it fits; work: with a place in front to work it from, which it
  // must have; sit: with a seat on it; flat: lies on the floor, so clutter keeps off it; tall: how high
  // its solid stands, when that isn’t h (a stack of crates is solid to its top); space: how far it keeps
  // from what stands already (a bank’s consoles stand shoulder to shoulder).
  function put(kind, x, z, o) {
    const yaw = wrap(o.yaw ?? 0);
    const { w, d, h } = o;
    const rect = rectOf(x, z, yaw, w, d);
    const ground = floor(x, z);
    const y = o.y ?? (ground ?? room.y) + (o.lift ?? 0);
    const y0 = o.y ?? ground ?? room.y;
    const y1 = y + (o.tall ?? h);
    const solid = o.solid === false ? null : o.solid === 'round' ? { circle: { x, z, r: Math.max(w, d) / 2, y0, y1 } } : { box: { ...rect, y0, y1 } };
    const worker = o.work ? { ...ahead({ x, z }, yaw, d / 2 + GAP + R), yaw: yaw + Math.PI } : null;
    if (o.loose) {
      if (!holdsRect(room, rect)) return null;
      if (ground === null || !level(room, rect, ground)) return null;
      if (solid || o.flat) {
        const b = solid ? boxOf(solid) : rect;
        if (strips.some((s) => overlap(b, s)) || lanes.some((l) => laneHits(l, b)) || taken.some((t) => overlap(grow(b, o.space ?? SPACE), t))) return null;
        if (places.some((p) => toSolid(solid ?? b, p) < R + MARGIN)) return null;
      }
      if (worker && !standable(worker, ground ?? room.y, solid ? [solid] : [])) return null;
    }
    const prop = { kind, x: tidy(x), y: tidy(y), z: tidy(z), yaw: yaw || 0, w: tidy(w), d: tidy(d), h: tidy(h), ...(o.tag ? { tag: o.tag } : {}), ...(o.text ? { text: o.text } : {}) };
    out.props.push(prop);
    for (const s of [...(solid ? [solid] : []), ...(o.solids ?? [])]) {
      const shape = s.box ?? s.circle;
      for (const k of Object.keys(shape)) shape[k] = tidy(shape[k]);
      out.solids.push(s);
      taken.push(boxOf(s));
    }
    if (!solid && o.flat) taken.push(rect);
    if (worker) spot('work', worker, worker.yaw);
    if (o.sit) spot('sit', { x, z, y: ground ?? room.y }, yaw, o.tag);
    return prop;
  }

  // Consoles shoulder to shoulder along a wall, each with its worker’s place, clear of its corners and doors.
  function bank(wall, { kind = 'console', w = 1.2, d = CONSOLE, h = 1.2, clear = 0.45 } = {}) {
    const near = doors.filter((dr) => sameWall(wallOfDoor(room, dr), wall)).map((dr) => [alongOf(wall, dr) - dr.w / 2 - clear, alongOf(wall, dr) + dr.w / 2 + clear]);
    for (let t = wall.from + clear + w / 2; t + w / 2 <= wall.to - clear + HAIR; t += w + 0.04) {
      if (near.some(([a, b]) => t + w / 2 > a && t - w / 2 < b)) continue;
      const p = onWall(wall, t, d / 2);
      put(kind, p.x, p.z, { yaw: wall.yaw, w, d, h, loose: true, work: true, space: 0 });
    }
  }

  // A thing on the wall a spot faces, `at` up from the floor.
  function onFaced(s, kind, { w, d = 0.06, h, at, ...o }) {
    const hit = facedWall(room, s);
    if (!hit) return null;
    const p = ahead(hit, hit.wall.yaw, d / 2);
    return put(kind, p.x, p.z, { yaw: hit.wall.yaw, w, d, h, y: (floor(s.x, s.z) ?? room.y) + at, solid: false, ...o });
  }

  // Crates stacked along walls, now and then, where they fit.
  function cargo(walls, { every = 4.5, chance = 0.65, sizes = [1.2, 1.6, 2], levels = 3 } = {}) {
    for (const wall of walls) {
      for (let t = wall.from + 1.5 + rand() * every; t < wall.to - 1.5; t += every * (0.7 + 0.6 * rand())) {
        const [go, w, d, n] = [rand() < chance, sizes[Math.floor(rand() * sizes.length)], sizes[Math.floor(rand() * sizes.length)], 1 + Math.floor(rand() * levels)];
        if (!go) continue;
        const p = onWall(wall, t, d / 2 + 0.1);
        // as high as the ceiling lets it; the base’s solid stands to the top, so the ones on top need none
        const high = Math.min(n, Math.floor((room.y + room.h - (floor(p.x, p.z) ?? room.y)) / 1.2));
        const base = high > 0 && put('crate', p.x, p.z, { yaw: wall.yaw, w, d, h: 1.2, tall: 1.2 * high, loose: true });
        for (let k = 1; base && k < high; k++) put('crate', p.x, p.z, { yaw: wall.yaw, w: w * 0.85, d: d * 0.85, h: 1.2, y: base.y + 1.2 * k, solid: false });
      }
    }
  }

  // Guards’ places either side of a door, a step into the room, facing in.
  function flank(door, { gap = 1, depth = 1.5 } = {}) {
    const wall = wallOfDoor(room, door);
    if (!wall) return;
    for (const side of [-1, 1]) {
      const p = onWall(wall, alongOf(wall, door) + side * (door.w / 2 + gap), depth);
      if (!standable(p, floor(p.x, p.z) ?? room.y, [])) continue;
      put('guard-post', p.x, p.z, { yaw: wall.yaw, w: 0.8, d: 0.8, h: 0.02, solid: false, flat: true });
      spot('post', p, wall.yaw);
    }
  }

  // The frame round a room’s window, on its wall.
  function windowFrame() {
    const win = room.window;
    const wall = win && wallsOf(room).find((w) => w.side === win.wall);
    if (!wall) return;
    const [w, h] = win.round ? [2 * win.r + 1, 2 * win.r + 1] : [win.w + 1, win.h + 1];
    const p = onWall(wall, alongOf(wall, win), 0.1);
    put('window-frame', p.x, p.z, { yaw: wall.yaw, w, d: 0.2, h, y: win.y - h / 2, solid: false });
  }

  const other = (door) => (station.rooms ?? []).find((r) => r.id === (door.a === room.id ? door.b : door.a));
  const lowest = room.floors?.length ? Math.min(...room.floors.map((f) => f.y)) : room.y;
  // (named: the station’s spots in this room whose names match, each with its name)
  return { room, station, rand, out, doors, jumps, lanes, lowest, floor, floorAt: (p) => floor(p.x, p.z), put, spot, bank, onFaced, cargo, flank, windowFrame, other, named: (re) => named.filter((s) => re.test(s.name)) };
}

const sameWall = (a, b) => Boolean(a && b) && a.side === b.side;
const middle = (room) => ({ x: room.x, z: room.z });
const doorless = (ws) => wallsOf(ws.room).filter((w) => !ws.doors.some((d) => sameWall(wallOfDoor(ws.room, d), w)));
const firstOf = (ws, re, fallback) => ws.named(re)[0] ?? fallback;
// the middle of a room, facing away from its first door (or, turned by π, towards it)
const centreFacing = (ws, turn = 0) => ({ ...middle(ws.room), yaw: (ws.doors[0] ? yawTo(ws.doors[0], middle(ws.room)) : 0) + turn });
// a camera high up at (x, z), watching the middle of the room
const cameraAt = (ws, x, z, tag) => ws.put('camera', x, z, { yaw: yawTo({ x, z }, middle(ws.room)), w: 0.25, d: 0.4, h: 0.3, y: ws.room.y + ws.room.h - 0.55, solid: false, tag });
const corners = (room) => [[room.box.x0, room.box.z0], [room.box.x1, room.box.z0], [room.box.x0, room.box.z1], [room.box.x1, room.box.z1]].map(([x, z]) => ({ x, z }));
const inset = (room, c, by) => ({ x: c.x + Math.sign(room.x - c.x) * by, z: c.z + Math.sign(room.z - c.z) * by });

// ── ships ──

// The Falcon in her own frame (right, forward of her middle): her belly too
// low to walk under, her legs and the bay’s mooring clamps where hangar.js
// draws them (its LEGS and clampsOf).
const FALCON = { w: 25.6, d: 34.75, h: 8, belly: [-7, 7, -10.5, 1.5], legs: [[-4.5, 8], [4.5, 8], [-8.5, -2], [8.5, -2], [0, -9.5]], clamps: [[-15.2, 3], [15.2, 3], [-11, -11.5], [11, -11.5]] };
// A Lambda shuttle, wings folded up: her hull from tail to where her ramp meets it; the ramp runs on
// under her nose to its foot, `ramp` ahead of her middle.
const LAMBDA = { w: 10, d: 20, h: 13, hull: [-2.6, 2.6, -10, 3], ramp: 7 };
// Ships stand where the station’s spots say: on a spot naming the ship herself, or back from one at the
// foot of her ramp (`away` when it faces down the ramp, away from her).
const SHIPS = {
  falcon: { kind: 'falcon', at: 0 },
  'dock-ramp': { kind: 'lambda', at: LAMBDA.ramp, away: true },
  'shuttle-ramp': { kind: 'lambda', at: LAMBDA.ramp },
  'emperor-ramp': { kind: 'lambda', at: LAMBDA.ramp, away: true },
};

// A ramp down from a nested room’s hatch: from the hatch out across the
// raised floors to the deck and a metre on, a body’s width either side.
function rampOf(ws, door, kid) {
  const out = door.axis === 'x' ? { x: 0, z: Math.sign(door.z - kid.z) || 1 } : { x: Math.sign(door.x - kid.x) || 1, z: 0 };
  let foot = 0;
  while (foot < 30 && (ws.floor(door.x + out.x * (foot + 0.05), door.z + out.z * (foot + 0.05)) ?? ws.lowest) > ws.lowest + HAIR) foot += 0.1;
  const half = door.w / 2 + 0.8;
  const end = { x: door.x + out.x * (foot + 1), z: door.z + out.z * (foot + 1) };
  return { x0: Math.min(door.x, end.x) - (out.x ? 0 : half), x1: Math.max(door.x, end.x) + (out.x ? 0 : half), z0: Math.min(door.z, end.z) - (out.z ? 0 : half), z1: Math.max(door.z, end.z) + (out.z ? 0 : half) };
}

function falcon(ws, c, yaw) {
  const deck = ws.floor(c.x, c.z) ?? ws.room.y;
  let belly = [frameRect(c, yaw, ...FALCON.belly)];
  // her hold is a room of its own, and its ramp is walked down
  for (const kid of (ws.station.rooms ?? []).filter((r) => r.inside === ws.room.id)) {
    belly = belly.flatMap((b) => cut(b, rawBox(kid)));
    for (const door of ws.doors.filter((d) => d.a === kid.id || d.b === kid.id)) belly = belly.flatMap((b) => cut(b, rampOf(ws, door, kid)));
  }
  const round = (r, f, radius, top) => {
    const p = ahead(c, yaw, f, r);
    return { circle: { x: p.x, z: p.z, r: radius, y0: deck, y1: deck + top } };
  };
  // a leg under the belly is inside its solid already, and would only give nav more corners to go round
  const legs = FALCON.legs.map(([r, f]) => round(r, f, 0.7, 1.6)).filter((leg) => !belly.some((b) => cut(boxOf(leg), b).length === 0));
  const solids = [...belly.map((b) => ({ box: { ...b, y0: deck, y1: deck + FALCON.h } })), ...legs, ...FALCON.clamps.map(([r, f]) => round(r, f, 1.2, 3.3))];
  ws.put('falcon', c.x, c.z, { yaw, w: FALCON.w, d: FALCON.d, h: FALCON.h, solid: false, solids });
}

function lambda(ws, c, yaw) {
  const deck = ws.floor(c.x, c.z) ?? ws.room.y;
  ws.put('lambda', c.x, c.z, { yaw, w: LAMBDA.w, d: LAMBDA.d, h: LAMBDA.h, solid: false, solids: [{ box: { ...frameRect(c, yaw, ...LAMBDA.hull), y0: deck, y1: deck + 6 } }] });
}

// ── the furnishers, a kind each ──

const bare = () => {};

function ship(ws) {
  for (const s of ws.named(/hide/)) ws.put('compartment', s.x, s.z, { yaw: s.yaw, w: 1, d: 1.4, h: 0.05, solid: false, flat: true });
  for (const s of ws.named(/panel/)) ws.onFaced(s, 'wall-panel', { w: 0.5, h: 0.4, at: 1.1, tag: s.name });
  ws.cargo(wallsOf(ws.room), { every: 1.6, chance: 0.7, sizes: [0.6, 0.8], levels: 2 });
}

function hangar(ws) {
  for (const s of ws.named(/./)) {
    const how = SHIPS[s.name];
    if (!how) continue;
    const c = how.at ? ahead(s, s.yaw, how.away ? -how.at : how.at) : s;
    (how.kind === 'falcon' ? falcon : lambda)(ws, c, how.away || !how.at ? s.yaw : s.yaw + Math.PI);
  }
  // Obi-Wan’s robe where he fell, and the place on the Falcon’s hull the homing beacon goes
  for (const s of ws.named(/^duel$/)) ws.put('robe', s.x, s.z, { yaw: s.yaw, w: 1.2, d: 0.8, h: 0.1, solid: false, flat: true, tag: 'robe' });
  for (const s of ws.named(/^beacon$/)) {
    const p = ahead(s, s.yaw, 0.8);
    ws.put('hull-mark', p.x, p.z, { yaw: s.yaw + Math.PI, w: 0.4, d: 0.1, h: 0.3, y: (ws.floor(s.x, s.z) ?? ws.room.y) + 1.3, solid: false, tag: 'beacon-spot' });
  }
  // cargo along every wall but the open one onto space
  ws.cargo(wallsOf(ws.room).filter((w) => !ws.doors.some((d) => sameWall(wallOfDoor(ws.room, d), w) && ws.other(d)?.kind === 'field')));
}

// Docking Control: low consoles under the windows onto the bay, tall banks along the sides, the closet
// and a display on the back wall (control.js draws those), the scomp socket, the intercom, a camera.
function control(ws) {
  const { room, station } = ws;
  const bays = (station.rooms ?? []).filter((r) => r.kind === 'hangar').map(rawBox);
  const walls = wallsOf(room);
  // the front backs onto a bay: a bay’s wall on the same line, along the same stretch
  const front = walls.find((w) => bays.some((b) => (w.axis === 'x' ? [b.z0, b.z1] : [b.x0, b.x1]).some((e) => Math.abs(e - w.at) < 0.05) && (w.axis === 'x' ? b.x0 < w.to && b.x1 > w.from : b.z0 < w.to && b.z1 > w.from)));
  const back = front && walls.find((w) => w.axis === front.axis && w !== front);
  for (const wall of walls) {
    if (wall === back) continue;
    ws.bank(wall, wall === front ? { kind: 'console', d: 0.4, h: 0.95 } : { kind: 'bank', h: 1.75 });
  }
  // one socket however many spots name it
  const sockets = new Map(ws.named(/^scomp/).map((s) => [`${s.x},${s.z}`, s]));
  for (const s of sockets.values()) ws.onFaced(s, 'scomp', { w: 0.42, h: 0.42, at: 0.64, tag: 'scomp' });
  for (const s of ws.named(/intercom/)) ws.onFaced(s, 'intercom', { w: 0.4, h: 0.5, at: 1.2 });
  const door = ws.doors[0] ?? middle(room);
  const far = corners(room).sort((p, q) => Math.hypot(q.x - door.x, q.z - door.z) - Math.hypot(p.x - door.x, p.z - door.z) || q.x - p.x)[0];
  const c = inset(room, far, 0.25);
  cameraAt(ws, c.x, c.z);
}

// A detention block’s control room: the horseshoe of consoles round the officer’s desk spot, open
// behind him; the cameras the story shoots out; the intercom; consoles along the bare walls.
function detention(ws) {
  const { room } = ws;
  const s = firstOf(ws, /-desk$/, centreFacing(ws, Math.PI));
  const y = ws.floor(s.x, s.z) ?? room.y;
  const c = ahead(s, s.yaw, 0.125);
  const side = (r0, r1, f0, f1) => ({ box: { ...frameRect(s, s.yaw, r0, r1, f0, f1), y0: y, y1: y + 1.05 } });
  ws.put('horseshoe', c.x, c.z, { yaw: s.yaw, w: 2.5, d: 2.25, h: 1.05, solid: false, tag: s.name, solids: [side(-1.25, 1.25, 0.8, 1.25), side(-1.25, -0.8, -1, 0.8), side(0.8, 1.25, -1, 0.8)] });
  ws.spot('work', s, s.yaw);
  const cams = ws.named(/camera/);
  // (each by its spot's name, aa23-camera-1 and -2: a bolt breaks what it names, and the story counts them)
  for (const cam of cams) ws.put('camera', cam.x, cam.z, { yaw: cam.yaw, w: 0.25, d: 0.4, h: 0.3, y: room.y + room.h - 0.55, solid: false, tag: cam.name });
  if (!cams.length && !room.round) for (const k of corners(room).slice(0, 2)) cameraAt(ws, inset(room, k, 0.25).x, inset(room, k, 0.25).z);
  for (const ic of ws.named(/intercom/)) {
    const hit = facedWall(room, ic);
    if (!hit) continue;
    const p = ahead(hit, hit.wall.yaw, CONSOLE / 2);
    ws.put('intercom', p.x, p.z, { yaw: hit.wall.yaw, w: 1.2, d: CONSOLE, h: 1.25, loose: true });
  }
  for (const wall of doorless(ws)) ws.bank(wall, { kind: 'console', h: 1.2 });
}

// A cell bay: each cell’s number over its door and the panel that opens it; the chute’s grate.
function cellbay(ws) {
  const { room } = ws;
  for (const door of ws.doors) {
    const other = ws.other(door);
    const wall = wallOfDoor(room, door);
    if (!other || !wall) continue;
    const at = alongOf(wall, door);
    const y = ws.floorAt(onWall(wall, at, 0.3)) ?? room.y;
    if (other.kind === 'cell') {
      const over = onWall(wall, at, 0.03);
      ws.put('cell-number', over.x, over.z, { yaw: wall.yaw, w: 0.5, d: 0.04, h: 0.18, y: y + door.h + 0.12, solid: false, text: /\d+/.exec(other.name ?? '')?.[0] ?? other.id });
      const by = at + door.w / 2 + 0.35 <= wall.to - 0.2 ? at + door.w / 2 + 0.35 : at - door.w / 2 - 0.35;
      const panel = onWall(wall, by, 0.03);
      ws.put('door-panel', panel.x, panel.z, { yaw: wall.yaw, w: 0.25, d: 0.05, h: 0.35, y: y + 1.05, solid: false });
    }
    if (other.kind === 'chute') {
      const g = onWall(wall, at, 0.03);
      ws.put('grate', g.x, g.z, { yaw: wall.yaw, w: door.w, d: 0.05, h: door.h, y, solid: false, tag: 'chute-grate' });
    }
  }
}

// A cell: a bench along the wall facing its door; the IT-O hovers in the one someone is held in.
function cell(ws) {
  const { room } = ws;
  const door = ws.doors[0];
  const walls = wallsOf(room);
  const by = door ? wallOfDoor(room, door) : null;
  const back = (by && walls.find((w) => w.axis === by.axis && !sameWall(w, by))) ?? walls[0];
  if (back) {
    const len = back.to - back.from;
    const p = onWall(back, (back.from + back.to) / 2, 0.225);
    ws.put('bench', p.x, p.z, { yaw: back.yaw, w: Math.min(2.4, len - 0.6), d: 0.45, h: 0.45, loose: true, sit: true });
  }
  if (ws.named(/./).length && back) {
    const across = back.axis === 'x' ? { x: 1, z: 0 } : { x: 0, z: 1 };
    const p = ahead({ x: room.x + across.x, z: room.z + across.z }, back.yaw, -0.2);
    ws.put('ito', p.x, p.z, { yaw: back.yaw, w: 0.55, d: 0.55, h: 0.55, lift: 1.3, solid: false });
  }
}

// A garbage compactor: the keypad and the stencilled number by each coded hatch, and junk in the water,
// off the way from wherever you land to the steps out and the hatch.
function compactor(ws) {
  const { room, rand, lowest } = ws;
  const hatches = ws.doors.filter((d) => /^code:/.test(d.lock ?? ''));
  for (const door of hatches) {
    const wall = wallOfDoor(room, door);
    if (!wall) continue;
    const at = alongOf(wall, door);
    const y = ws.floorAt(onWall(wall, at, 0.3)) ?? room.y;
    const by = wall.to - (at + door.w / 2) >= at - door.w / 2 - wall.from ? at + door.w / 2 + 0.35 : at - door.w / 2 - 0.35;
    const pad = onWall(wall, by, 0.03);
    ws.put('keypad', pad.x, pad.z, { yaw: wall.yaw, w: 0.25, d: 0.06, h: 0.35, y: y + 1.05, solid: false, tag: door.id });
    const over = onWall(wall, at, 0.02);
    ws.put('stencil', over.x, over.z, { yaw: wall.yaw, w: 1.2, d: 0.03, h: 0.25, y: y + door.h + 0.12, solid: false, text: door.lock.slice(5) });
  }
  // the first step up out of the water, and on from it to each door
  const steps = (room.floors ?? []).filter((f) => f.y > lowest + HAIR && f.y <= lowest + 0.4 + HAIR);
  const foot = steps.length ? { x: (steps[0].x0 + steps[0].x1) / 2, z: (steps[0].z0 + steps[0].z1) / 2 } : middle(room);
  for (const s of ws.named(/./)) ws.lanes.push({ a: s, b: foot, r: 0.5 });
  for (const door of ws.doors) ws.lanes.push({ a: foot, b: door, r: 0.5 });
  const b = room.box;
  // heaps in the water, not on the walkway out of it: as many tries as it takes, within reason
  for (let k = 0, heaps = 0; k < 80 && heaps < 7; k++) {
    const [x, z, yaw, w, d, h] = [b.x0 + 0.4 + rand() * (b.x1 - b.x0 - 0.8), b.z0 + 0.4 + rand() * (b.z1 - b.z0 - 0.8), (rand() < 0.5 ? 0 : TURN) + (rand() - 0.5) * 0.3, 0.4 + rand() * 0.7, 0.3 + rand() * 0.4, rand() < 0.4 ? 0.3 : 0.6 + rand() * 0.4];
    if (ws.floor(x, z) === lowest && ws.put('junk', x, z, { yaw, w, d, h, loose: true })) heaps += 1;
  }
  // and bits floating on the water, a metre over the bottom
  for (let k = 0; k < 4; k++) {
    const [x, z, yaw] = [b.x0 + 0.5 + rand() * (b.x1 - b.x0 - 1), b.z0 + 0.5 + rand() * (b.z1 - b.z0 - 1), rand() * Math.PI];
    if (ws.floor(x, z) !== lowest) continue;
    ws.put('junk', x, z, { yaw, w: 0.4, d: 0.3, h: 0.08, y: lowest + 0.96, solid: false });
  }
}

function chute(ws) {
  for (const j of ws.jumps) ws.put('chute-mouth', j.x, j.z, { w: 1.6, d: 1.6, h: 0.1, solid: false, flat: true });
}

// A shaft: where it has a terminal (the tractor beam’s), the terminal on its column at the platform’s
// edge, its power levers, and the beam’s glowing column rising out of the depths beyond.
function shaft(ws) {
  const { room } = ws;
  for (const s of ws.named(/terminal/)) {
    const y = ws.floor(s.x, s.z) ?? room.y;
    // its face 0.8 m ahead of the spot, so the power controls 0.4 m nearer it stand clear
    const c = ahead(s, s.yaw, 1.2);
    ws.put('terminal', c.x, c.z, { yaw: s.yaw + Math.PI, w: 3.2, d: 0.8, h: 1.3, y, tag: s.name });
    ws.spot('work', s, s.yaw);
    const side = { x: Math.cos(s.yaw), z: Math.sin(s.yaw) };
    for (const p of ws.named(/power/)) {
      const at = ahead(s, s.yaw, 0.85, (p.x - s.x) * side.x + (p.z - s.z) * side.z);
      ws.put('lever', at.x, at.z, { yaw: s.yaw + Math.PI, w: 0.15, d: 0.1, h: 0.4, y: y + 0.9, solid: false, tag: p.name });
      ws.spot('work', p, p.yaw);
    }
    const col = ahead(s, s.yaw, 4.7);
    ws.put('beam-column', col.x, col.z, { w: 5, d: 5, h: room.h, y: room.y, solid: 'round' });
  }
}

// The chasm: the bridge’s control on its pedestal before its spot, and over the void, half way across,
// the outcrop a grapple line catches on for each swing.
function chasm(ws) {
  const { room, station } = ws;
  for (const s of ws.named(/control/)) {
    const p = ahead(s, s.yaw, 0.85);
    ws.put('pedestal', p.x, p.z, { yaw: s.yaw + Math.PI, w: 0.5, d: 0.5, h: 1.1, solid: 'round', tag: s.name });
    ws.spot('work', s, s.yaw);
  }
  for (const j of ws.jumps) {
    const to = station.spots?.[j.to];
    if (!to || to.room !== room.id) continue;
    const mid = { x: (j.x + to.x) / 2, z: (j.z + to.z) / 2 };
    ws.put('anchor', mid.x, mid.z, { yaw: yawTo(j, to), w: 0.6, d: 2.4, h: 0.6, y: room.y + room.h - 2.5, solid: false, tag: /^flag:/.test(j.lock ?? '') ? j.lock.slice(5) : j.id });
  }
}

// The conference room: the round black table and twelve chairs round it, the one at Krennic’s place
// (if the station names it) left for nobody but a visitor.
function conference(ws) {
  const at = firstOf(ws, /table/, centreFacing(ws));
  const empty = firstOf(ws, /krennic/, null);
  const r = 2.3;
  ws.put('table', at.x, at.z, { w: 2 * r, d: 2 * r, h: 0.75, solid: 'round' });
  const seats = Array.from({ length: 12 }, (_, k) => ahead(at, (k * Math.PI) / 6, r + 0.7));
  const hers = empty ? seats.reduce((best, p, k) => (Math.hypot(p.x - empty.x, p.z - empty.z) < Math.hypot(seats[best].x - empty.x, seats[best].z - empty.z) ? k : best), 0) : -1;
  seats.forEach((p, k) => ws.put('chair', p.x, p.z, { yaw: (k * Math.PI) / 6 + Math.PI, w: 0.6, d: 0.6, h: 1, solid: 'round', sit: true, tag: k === hers ? 'krennic-chair' : undefined }));
}

// The overbridge: the frame of the great window, the pentagon screen on the wall to its right, and the
// tulip stations in rows either side of the aisle up to the window, each with its operator behind it.
function overbridge(ws) {
  const { room } = ws;
  const s = firstOf(ws, /window/, centreFacing(ws));
  const hit = facedWall(room, s);
  if (!hit) return;
  const wall = hit.wall;
  const frame = onWall(wall, (wall.from + wall.to) / 2, 0.1);
  const y = ws.floor(s.x, s.z) ?? room.y;
  ws.put('window-frame', frame.x, frame.z, { yaw: wall.yaw, w: wall.to - wall.from - 2, d: 0.2, h: room.h - 1.6, y: y + 0.9, solid: false });
  const right = wallsOf(room).find((w) => Math.abs(wrap(w.yaw - (s.yaw - TURN))) < 0.01);
  if (right) {
    const p = onWall(right, (right.from + right.to) / 2, 0.08);
    ws.put('pentagon-screen', p.x, p.z, { yaw: right.yaw, w: 4, d: 0.15, h: 3.2, y: y + 2.2, solid: false });
  }
  for (let f = 2; f < 30; f += 3.5) for (const r of [-10.5, -7.5, -4.5, 4.5, 7.5, 10.5]) {
    const p = ahead(s, s.yaw, -f, r);
    ws.put('tulip', p.x, p.z, { yaw: s.yaw + Math.PI, w: 0.9, d: 0.9, h: 1.1, solid: 'round', loose: true, work: true });
  }
}

// Superlaser fire control: the master console before its spot, and banks of green buttons along every
// wall but the one it faces (the beam tunnel shows there).
function firecontrol(ws) {
  const { room } = ws;
  const s = firstOf(ws, /fire/, centreFacing(ws));
  const c = ahead(s, s.yaw, 1.025);
  ws.put('fire-console', c.x, c.z, { yaw: s.yaw + Math.PI, w: 2.4, d: 0.45, h: 1.1 });
  ws.spot('work', s, s.yaw);
  const faced = facedWall(room, s)?.wall;
  for (const wall of wallsOf(room)) if (!sameWall(wall, faced)) ws.bank(wall, { kind: 'button-bank', w: 1.4, h: 1.8 });
}

// A TIE launch bay: fighters hung in racks, rows of them across the bay, noses to the launch doors.
function tiebay(ws) {
  const { room, rand } = ws;
  const walls = wallsOf(room);
  const launch = ws.doors.find((d) => ws.other(d)?.kind === 'field');
  const wall = (launch && wallOfDoor(room, launch)) ?? walls[1];
  if (!wall) return;
  const deep = wall.axis === 'x' ? room.box.z1 - room.box.z0 : room.box.x1 - room.box.x0;
  for (let f = 14; f < deep - 3; f += 14) {
    const row = [];
    for (let t = wall.from + 4; t <= wall.to - 4 + HAIR; t += 7.5) {
      const p = onWall(wall, t, f);
      if (rand() < 0.1) continue;
      const tie = ws.put('tie', p.x, p.z, { yaw: wall.yaw + Math.PI, w: 6, d: 4.6, h: 6.3, lift: 0.5, loose: true });
      if (tie) row.push(t);
    }
    if (!row.length) continue;
    const mid = onWall(wall, (row[0] + row.at(-1)) / 2, f);
    ws.put('tie-rack', mid.x, mid.z, { yaw: wall.yaw, w: row.at(-1) - row[0] + 7, d: 1.6, h: 0.8, y: (ws.floor(mid.x, mid.z) ?? room.y) + 7.2, solid: false });
  }
}

// A records archive: rows of tape stacks either side of an aisle from its door, the librarian’s desk
// and the security feed by the door that shows him; the station’s first archive keeps the plans.
function archive(ws) {
  const { room, station } = ws;
  const door = ws.doors[0];
  const by = door && wallOfDoor(room, door);
  if (!by) return;
  const into = by.yaw;
  const across = corners(room).map((c) => (c.x - door.x) * Math.cos(into) + (c.z - door.z) * Math.sin(into));
  const depth = Math.max(...corners(room).map((c) => (c.x - door.x) * Math.sin(into) - (c.z - door.z) * Math.cos(into)));
  const [lo, hi] = [Math.min(...across), Math.max(...across)];
  const lib = firstOf(ws, /librarian/, { ...ahead(door, into, depth * 0.75), yaw: into + Math.PI });
  const desk = ahead(lib, lib.yaw, 1.05);
  ws.put('desk', desk.x, desk.z, { yaw: lib.yaw + Math.PI, w: 1.6, d: 0.5, h: 0.78 });
  ws.spot('work', lib, lib.yaw);
  const feed = onWall(by, alongOf(by, door) + (by.to - alongOf(by, door) >= alongOf(by, door) - by.from ? 1.6 : -1.6), 0.03);
  ws.put('feed', feed.x, feed.z, { yaw: into, w: 0.8, d: 0.06, h: 0.5, y: (ws.floor(door.x, door.z) ?? room.y) + 2.2, solid: false, tag: lib.name });
  const back = wallsOf(room).find((w) => w.axis === by.axis && !sameWall(w, by));
  const cam = corners(room).filter((c) => Math.abs((back.axis === 'x' ? c.z : c.x) - back.at) < HAIR).sort((p, q) => Math.hypot(p.x - lib.x, p.z - lib.z) - Math.hypot(q.x - lib.x, q.z - lib.z) || q.x - p.x)[0];
  cameraAt(ws, inset(room, cam, 0.25).x, inset(room, cam, 0.25).z);
  if ((station.rooms ?? []).find((r) => r.kind === 'archive')?.id === room.id) {
    const p = onWall(back, back.from + 1.5, 0.225);
    ws.put('terminal', p.x, p.z, { yaw: back.yaw, w: 1, d: 0.45, h: 1.4, tag: 'plans', loose: true, work: true });
  }
  // the stacks: rows across the front half, and along the side walls behind them
  for (let f = 1.4; f + 0.3 < depth / 2; f += 1.8) {
    for (const [a, b] of [[lo, -1.2], [1.2, hi]]) {
      if (b - a < 1) continue;
      const c = ahead(door, into, f, (a + b) / 2);
      ws.put('stacks', c.x, c.z, { yaw: into, w: b - a, d: 0.6, h: 2.6, loose: true });
    }
  }
  for (const side of wallsOf(room).filter((w) => w.axis !== by.axis)) {
    const t = alongOf(side, ahead(door, into, depth * 0.7));
    const p = onWall(side, t, 0.3);
    ws.put('stacks', p.x, p.z, { yaw: side.yaw, w: depth * 0.35, d: 0.6, h: 2.6, loose: true });
  }
}

function meditation(ws) {
  const s = firstOf(ws, /pod/, centreFacing(ws, Math.PI));
  ws.put('meditation-pod', s.x, s.z, { yaw: s.yaw, w: 2.8, d: 2.8, h: 2.8, solid: 'round', sit: true });
}

// A note on the wall of the station’s first maintenance corridor, for whoever reads it.
const EXHAUST_NOTE = 'Thermal exhaust port, meridian trench: two metres across, below the main port. Ray-shielded only. Particle shielding asked for three times, and put off each time as low priority.';

// A maintenance corridor: pipes along its long walls under the ceiling, junction boxes, a canister or
// two against the walls; the first one also has the exhaust port’s note.
function maintenance(ws) {
  const { room, station, rand } = ws;
  const walls = wallsOf(room);
  const long = walls.filter((w) => w.to - w.from >= Math.max(...walls.map((v) => v.to - v.from)) - HAIR);
  const doorsOn = (wall) => ws.doors.filter((d) => sameWall(wallOfDoor(room, d), wall)).map((d) => alongOf(wall, d));
  for (const wall of long) {
    const mid = onWall(wall, (wall.from + wall.to) / 2, 0.2);
    ws.put('pipes', mid.x, mid.z, { yaw: wall.yaw, w: wall.to - wall.from - 0.4, d: 0.3, h: 0.3, y: room.y + room.h - 0.5, solid: false });
    const t = wall.from + 1 + rand() * (wall.to - wall.from - 2);
    if (!doorsOn(wall).some((a) => Math.abs(a - t) < 2)) {
      const box = onWall(wall, t, 0.08);
      ws.put('junction-box', box.x, box.z, { yaw: wall.yaw, w: 0.4, d: 0.15, h: 0.5, y: room.y + 1.4, solid: false });
    }
  }
  if ((station.rooms ?? []).find((r) => r.kind === 'maintenance')?.id === room.id) {
    const wall = [...long].sort((a, b) => doorsOn(a).length - doorsOn(b).length)[0];
    if (wall) {
      let t = (wall.from + wall.to) / 2;
      while (doorsOn(wall).some((a) => Math.abs(a - t) < 1.5) && t < wall.to - 1) t += 0.5;
      const p = onWall(wall, t, 0.02);
      ws.put('sign', p.x, p.z, { yaw: wall.yaw, w: 0.6, d: 0.03, h: 0.4, y: room.y + 1.5, solid: false, tag: 'exhaust-note', text: EXHAUST_NOTE });
    }
  }
  for (let k = 0; k < 2; k++) {
    const wall = long[Math.floor(rand() * long.length)];
    if (!wall) break;
    const p = onWall(wall, wall.from + 1 + rand() * (wall.to - wall.from - 2), 0.35);
    ws.put('canister', p.x, p.z, { w: 0.6, d: 0.6, h: 1, solid: 'round', loose: true });
  }
}

function reactor(ws) {
  const { room } = ws;
  const r = Math.min(room.w, room.d ?? room.w) / 6;
  ws.put('reactor-core', room.x, room.z, { w: 2 * r, d: 2 * r, h: room.h, solid: 'round' });
  for (const wall of wallsOf(room)) ws.bank(wall, { kind: 'console' });
}

// The throne room: the throne on its spot with Luke’s saber on the armrest, the stairs down from the
// dais, the window’s frame, and the Royal Guards’ posts at the stairs’ foot and by the lift.
function throne(ws) {
  const { room } = ws;
  const seat = firstOf(ws, /seat/, centreFacing(ws, Math.PI));
  ws.put('throne', seat.x, seat.z, { yaw: seat.yaw, w: 1.6, d: 1.4, h: 2.2, sit: true });
  for (const s of ws.named(/armrest/)) ws.put('saber', s.x, s.z, { yaw: seat.yaw, w: 0.06, d: 0.3, h: 0.06, y: (ws.floor(s.x, s.z) ?? room.y) + 0.75, solid: false, tag: 'armrest-saber' });
  const top = Math.max(...room.floors.map((f) => f.y));
  const steps = room.floors.filter((f) => f.y > ws.lowest + HAIR && f.y < top - HAIR);
  if (steps.length) {
    const b = { x0: Math.min(...steps.map((f) => f.x0)), x1: Math.max(...steps.map((f) => f.x1)), z0: Math.min(...steps.map((f) => f.z0)), z1: Math.max(...steps.map((f) => f.z1)) };
    const [hi, lo] = [steps.reduce((a, f) => (f.y > a.y ? f : a)), steps.reduce((a, f) => (f.y < a.y ? f : a))];
    const down = yawTo({ x: (hi.x0 + hi.x1) / 2, z: (hi.z0 + hi.z1) / 2 }, { x: (lo.x0 + lo.x1) / 2, z: (lo.z0 + lo.z1) / 2 });
    const turned = Math.abs(Math.sin(down)) > 0.5;
    const c = { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 };
    const [w, d] = turned ? [b.z1 - b.z0, b.x1 - b.x0] : [b.x1 - b.x0, b.z1 - b.z0];
    ws.put('stairs', c.x, c.z, { yaw: down, w, d, h: top - ws.lowest, y: ws.lowest, solid: false });
    for (const r of [-(w / 2 + 1), w / 2 + 1]) {
      const p = ahead(c, down, d / 2 + 1, r);
      if (ws.floor(p.x, p.z) === null) continue;
      ws.put('guard-post', p.x, p.z, { yaw: down, w: 0.8, d: 0.8, h: 0.02, solid: false, flat: true });
      ws.spot('post', p, down);
    }
  }
  ws.windowFrame();
  for (const door of ws.doors) ws.flank(door);
}

// The tower’s antechamber: columns down both sides, and Royal Guards’ posts at each door.
function holding(ws) {
  const { room } = ws;
  for (const door of ws.doors) ws.flank(door);
  if (room.round) return;
  const b = room.box;
  for (const x of [b.x0 + 2.5, b.x1 - 2.5]) for (const k of [0.3, 0.7]) ws.put('column', x, b.z0 + (b.z1 - b.z0) * k, { w: 1, d: 1, h: room.h, solid: 'round', loose: true });
}

// The command centre: crew stations in rows facing the window, an aisle up the middle from the door,
// the consoles the stories use on their spots, and the commander’s desk by the side wall (on the second
// station, Jerjerrod’s, with his nameplate); the battle on screens along the side walls.
function command(ws) {
  const { room, station } = ws;
  ws.windowFrame();
  const win = wallsOf(room).find((w) => w.side === room.window?.wall) ?? facedWall(room, centreFacing(ws))?.wall;
  if (!win) return;
  for (const s of ws.named(/console|switch/)) {
    const c = ahead(s, s.yaw, 1.025);
    ws.put(/switch/.test(s.name) ? 'switch' : 'station', c.x, c.z, { yaw: s.yaw + Math.PI, w: 1.6, d: 0.45, h: 1.1, tag: s.name });
    ws.spot('work', s, s.yaw);
    // the aisle up from the door to the firing switch
    if (/switch/.test(s.name)) for (const door of ws.doors) ws.lanes.push({ a: door, b: s, r: 1 });
  }
  for (const f of [3.175, 7.175]) for (let t = win.from + 2; t <= win.to - 2 + HAIR; t += 2) {
    const p = onWall(win, t, f);
    ws.put('station', p.x, p.z, { yaw: win.yaw, w: 1.6, d: 0.45, h: 1.1, loose: true, work: true });
  }
  const side = wallsOf(room).filter((w) => w.axis !== win.axis);
  const theirs = side.find((w) => w.side === 'east') ?? side[0];
  const far = win.axis === 'x' ? (win.side === 'north' ? room.box.z1 : room.box.z0) : win.side === 'west' ? room.box.x1 : room.box.x0;
  const desk = onWall(theirs, far + (win.at - far) * 0.25, 2.6);
  const deskAt = ws.put('desk', desk.x, desk.z, { yaw: theirs.yaw, w: 1.8, d: 0.8, h: 0.78, loose: true });
  if (deskAt) {
    ws.spot('work', ahead(desk, theirs.yaw, -(0.4 + GAP + R)), theirs.yaw);
    if (station.era === 'rotj') {
      const plate = ahead(desk, theirs.yaw, 0.37);
      ws.put('nameplate', plate.x, plate.z, { yaw: theirs.yaw, w: 0.35, d: 0.05, h: 0.08, y: deskAt.y + 0.78, solid: false, tag: 'nameplate', text: 'Moff Tiaan Jerjerrod' });
    }
  }
  for (const wall of side) {
    const p = onWall(wall, (wall.from + wall.to) / 2, 0.04);
    ws.put('screen', p.x, p.z, { yaw: wall.yaw, w: 4, d: 0.08, h: 2, y: (ws.floor(p.x, p.z) ?? room.y) + 2.6, solid: false });
  }
}

// The superstructure: crates on its platforms, kept off the walkways and the joins between them.
function superstructure(ws) {
  const { room, rand } = ws;
  const narrow = (f) => Math.min(f.x1 - f.x0, f.z1 - f.z0) < 2.5;
  for (const f of room.floors.filter(narrow)) {
    const alongX = f.x1 - f.x0 > f.z1 - f.z0;
    const [cx, cz] = [(f.x0 + f.x1) / 2, (f.z0 + f.z1) / 2];
    const r = (alongX ? f.z1 - f.z0 : f.x1 - f.x0) / 2 + 0.4;
    ws.lanes.push(alongX ? { a: { x: f.x0 - 2, z: cz }, b: { x: f.x1 + 2, z: cz }, r } : { a: { x: cx, z: f.z0 - 2 }, b: { x: cx, z: f.z1 + 2 }, r });
  }
  for (const f of room.floors.filter((g) => !narrow(g))) {
    for (let k = 0; k < 3; k++) {
      const s = 0.8 + rand() * 0.6;
      ws.put('crate', f.x0 + s / 2 + 0.2 + rand() * (f.x1 - f.x0 - s - 0.4), f.z0 + s / 2 + 0.2 + rand() * (f.z1 - f.z0 - s - 0.4), { w: s, d: s, h: 1.2 * s, loose: true });
    }
  }
}

function gallery(ws) {
  for (const wall of doorless(ws)) ws.bank(wall, { kind: 'console', w: 1.4 });
}

// corridors, lobbies and lifts have only their wall fittings, which their builders draw; a field is space
const FURNISH = { corridor: bare, lobby: bare, lift: bare, field: bare, ship, hangar, dock: hangar, control, detention, cellbay, cell, compactor, chute, shaft, chasm, conference };
Object.assign(FURNISH, { overbridge, firecontrol, tiebay, meditation, archive, maintenance, reactor, throne, holding, command, superstructure, gallery });

export function furnish(room, station) {
  const ws = workshop(room, station);
  (FURNISH[room.kind] ?? bare)(ws);
  return ws.out;
}
