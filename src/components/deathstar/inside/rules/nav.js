// The ways people walk aboard a station. Rooms are convex and joined by
// doors, so a route needs no grid: A* runs over the doors (a node at each
// one’s centre, passable or not as the caller says) and the lifts’ stops
// (each a node at the middle of its car, a ride costing 8 m a level), and
// inside each room the way is the straight line from point to point, bent
// round whatever it would cross, kept 0.4 m clear: any of the room’s
// solids (consoles, crates, a ship), any room nested in it (the Falcon’s
// hold stands in Docking Bay 327), and, where the room’s floor is more
// than one level or has gaps in it, any rise or drop of more than a step
// (the side of a stair, the edge of a landing or a walkway, a chasm). A
// leg never climbs or drops more than a step at once, nor crosses a void,
// as the walker can’t, so it goes up a stair from its foot. A* weighs each
// leg as bent, so furniture in the way of one door sends people by
// another. Pure.
//
//   createNav(layout) → nav      the graph of a buildLayout(station), worked out once; a ride’s
//     levels are counted in the station’s `levelHeight` (12 m, DS1’s, when it gives none)
//   route(nav, from: { x, z, room }, to: { x, z, room }, { canPass, solidsOf, off }) → [point] | null
//     canPass(doorId, door) → bool   whether this walker may go through a door (absent: every door)
//     solidsOf(roomId) → [{ box: { x0, x1, z0, z1 } } | { circle: { x, z, r } }]   what stands on its floor
//     off: Set<tag>   the floors drawn back now (layout.offTags): a way never crosses where they were
//     point: { x, z, room, door?, lift? }, from first and to last; each point’s room is the one the
//       leg to it is walked in, so a door’s point names the room before it. A leg along a door's own
//       wall meets it square, from a point 0.8 m out (aprons). `lift` marks the middle
//       of the car where a ride starts, and the next point is the middle of the car it ends in.
//     null when no way is left; a single point when from and to are the same place in one room

const RIDE = 8; // what a ride costs a level, in metres walked
const LEVEL = 12; // a level’s height where the station gives no `levelHeight`: DS1’s levels are 12 m apart
const STEP = 0.4; // the body’s step (walker.js): a leg climbs or drops no more than this at once
const SAME = 1e-6; // points nearer than this are one point
const GROW = 0.4; // how far a route keeps from a solid, a rise or a drop, and its corners from a wall: a body’s radius and a little
const HAIR = 0.01; // corners stand this far outside a grown solid, so a leg between two of them never grazes it
const SIDES = 8; // a round solid is gone round by this many corners
const PEEK = 1e-3; // how far either side of a line between floors their heights are read
const LEGS = 50000; // legs between corners remembered a room before the memory starts again
const TINY = 1e-6;

const apart = (p, q) => Math.hypot(q.x - p.x, q.z - p.z);

// A door is two nodes, one each way through it, so a route that walks up
// to a door goes on into the room beyond: it can’t use a doorway as a
// corner of the room it is already in. Each node is reached by walking in
// one room (`byRoom`) and walked on from in another (`room`).
export function createNav(layout) {
  const nodes = new Map();
  const byRoom = new Map([...layout.rooms.keys()].map((id) => [id, []]));
  const add = (node, by) => {
    nodes.set(node.key, node);
    byRoom.get(by).push(node);
  };
  for (const d of layout.doors.values()) {
    if (d.a === d.b || !byRoom.has(d.a) || !byRoom.has(d.b)) continue;
    for (const [by, room] of [[d.a, d.b], [d.b, d.a]]) add({ key: `door:${d.id}>${room}`, x: d.x, z: d.z, room, door: d.id }, by);
  }
  for (const lift of layout.lifts.values()) {
    for (const id of lift.stops ?? []) {
      const car = layout.rooms.get(id);
      if (car && !nodes.has(`stop:${id}`)) add({ key: `stop:${id}`, x: car.x, z: car.z, y: car.y, room: id, rides: [] }, id);
    }
  }
  // a ride’s levels are counted in the station’s own spacing, so a 36 m ride on DS1 is three levels
  const level = layout.station?.levelHeight ?? LEVEL;
  for (const lift of layout.lifts.values()) {
    const stops = (lift.stops ?? []).map((id) => nodes.get(`stop:${id}`)).filter(Boolean);
    for (const s of stops) for (const t of stops) if (s !== t) s.rides.push({ to: t, lift: lift.id, cost: RIDE * Math.max(1, Math.round(Math.abs(t.y - s.y) / level)) });
  }
  const stops = [...nodes.values()].filter((n) => n.rides);
  for (const n of nodes.values()) n.near = nearest(stops, n);
  // A room nested in another stands on its parent’s floor as a block: the
  // walker meets its walls and the underside of its floor (the hold is
  // 1.6 m up, under a body’s head), so it is gone round, never under.
  const kids = new Map([...layout.rooms.keys()].map((id) => [id, []]));
  for (const r of layout.rooms.values()) if (r.inside !== r.id) kids.get(r.inside)?.push(r.round ? { circle: { x: r.x, z: r.z, r: r.w / 2 } } : { box: r.box });
  return { layout, byRoom, stops, kids, grounds: new Map() };
}

const nearest = (stops, p) => stops.reduce((best, s) => Math.min(best, apart(p, s)), Infinity);

export function route(nav, from, to, { canPass = () => true, solidsOf = () => [], off = null } = {}) {
  const { layout, byRoom, stops, kids } = nav;
  if (!byRoom.has(from?.room) || !byRoom.has(to?.room)) return null;
  if (from.room === to.room && apart(from, to) < SAME) return [{ x: from.x, z: from.z, room: from.room }];

  const start = { key: 'start', x: from.x, z: from.z, room: from.room, near: nearest(stops, from) };
  const goal = { key: 'goal', x: to.x, z: to.z, room: to.room };
  // A ride carries you any distance across, so the guess to go is the
  // nearer of walking straight there and walking to the nearest car and
  // from the car nearest the goal, which never overestimates.
  const last = nearest(stops, goal);
  goal.near = last;
  const guess = (n) => Math.min(apart(n, goal), n.near + last);

  const passes = new Map();
  const open = (id) => {
    if (!passes.has(id)) passes.set(id, Boolean(canPass(id, layout.doors.get(id))));
    return passes.get(id);
  };

  // asked once a room, however many legs cross it
  const solids = new Map();
  const solidsIn = (room) => {
    if (!solids.has(room)) solids.set(room, [...(solidsOf(room) ?? []), ...kids.get(room)]);
    return solids.get(room);
  };

  function* next(n) {
    const { room } = n;
    // not straight back out through the door just come in by
    const there = byRoom.get(room).filter((m) => m !== n && !(m.door && (m.door === n.door || !open(m.door))));
    if (room === goal.room) there.push(goal);
    const space = layout.rooms.get(room);
    for (const m of there) {
      const way = bend(space, solidsIn(room), n, m, groundOf(nav, space, off));
      if (way) yield { m, room, cost: way.length, via: way.via };
    }
    for (const ride of n.rides ?? []) yield { m: ride.to, ride, cost: ride.cost };
  }

  const g = new Map([[start.key, 0]]);
  const came = new Map();
  const frontier = new Map([[start.key, start]]);
  const done = new Set();
  while (frontier.size) {
    let n = null;
    let f = Infinity;
    for (const c of frontier.values()) {
      const fc = g.get(c.key) + guess(c);
      if (!n || fc < f) [n, f] = [c, fc];
    }
    if (n === goal) return aprons(trace(came, goal, from), layout);
    frontier.delete(n.key);
    done.add(n.key);
    for (const step of next(n)) {
      if (done.has(step.m.key)) continue;
      const cost = g.get(n.key) + step.cost;
      if (cost >= (g.get(step.m.key) ?? Infinity)) continue;
      g.set(step.m.key, cost);
      came.set(step.m.key, { ...step, from: n });
      frontier.set(step.m.key, step.m);
    }
  }
  return null;
}

// The points of a found way, from the goal back to the start and turned
// round; a point on top of the last one in the same room is folded into
// it (keeping its door or lift), so a walker never aims at where it stands.
function trace(came, goal, from) {
  const steps = [];
  for (let key = goal.key; came.has(key); key = came.get(key).from.key) steps.push(came.get(key));
  steps.reverse();
  const points = [{ x: from.x, z: from.z, room: from.room }];
  const put = (p) => {
    const prev = points.at(-1);
    if (prev.room === p.room && apart(prev, p) < SAME) Object.assign(prev, p);
    else points.push(p);
  };
  for (const step of steps) {
    const { m } = step;
    if (step.ride) {
      points.at(-1).lift = step.ride.lift;
      points.push({ x: m.x, z: m.z, room: m.room });
    } else {
      for (const c of step.via) put({ x: c.x, z: c.z, room: step.room });
      put({ x: m.x, z: m.z, room: step.room, ...(m.door ? { door: m.door } : {}) });
    }
  }
  return points;
}

// A leg into a door or out of one that runs along the door's own wall (to
// or from another door in that wall, 12 m along the bay's back wall) is
// walked along the wall's line, where a body meets the doorway's jamb end
// on and can't slide past it: such a leg is made to meet the door square,
// from a point APRON out in the room, and to leave it the same way. A point
// that would be off its room's floor is left out.
const APRON = 0.8; // metres out from a door a leg along its wall turns in to it, or out of it
const ALONG = 0.35; // a leg crossing a door's wall by less than this share of its length runs along it
function aprons(points, layout) {
  const out = [];
  // (on whichever side of the door is the room's own: a room nested in another has its parent's
  // middle inside it, so it is the point itself that is asked which room it is in)
  const apronOf = (door, room) => {
    const d = layout.doors.get(door);
    if (!d) return null;
    const n = d.axis === 'x' ? { x: 0, z: 1 } : { x: 1, z: 0 };
    for (const side of [1, -1]) {
      const a = { x: d.x + n.x * side * APRON, z: d.z + n.z * side * APRON, room };
      if (layout.roomAt(a.x, (d.y ?? 0) + 1, a.z) === room && layout.floorAt(room, a.x, a.z) !== null) return { a, n };
    }
    return null;
  };
  const along = (p, q, n) => {
    const len = apart(p, q);
    return len > APRON * 1.5 && Math.abs((q.x - p.x) * n.x + (q.z - p.z) * n.z) < ALONG * len;
  };
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const prev = out.at(-1);
    if (p.door && prev && !prev.lift) {
      const ap = apronOf(p.door, p.room);
      if (ap && along(prev, p, ap.n)) out.push(ap.a);
    }
    out.push(p);
    const q = points[i + 1];
    if (p.door && q && !p.lift) {
      const ap = apronOf(p.door, q.room);
      if (ap && along(p, q, ap.n)) out.push(ap.a);
    }
  }
  return out;
}

// The shortest way from p to q across a room: straight when nothing is in
// the way, else from corner to corner (Dijkstra over the corners of the
// grown solids and, on an uneven floor, the ground’s own turning points,
// which are few), or null when q is cut off. → { length, via: [corner] }
//
// A solid an end stands inside is left out, so someone in the Falcon’s box
// (her hold’s hatch is under her) walks straight out rather than nowhere.
// The rest keep GROW clear, except on a sub-leg from or to an end, where
// a solid is kept only as clear as that end already stands (a door beside
// a console, or in a nested room’s wall, must still be reachable), and so
// is a rise or a drop, but only while the leg is within a step of that
// end’s own height: what the end stands near where it stands.
function bend(room, solids, p, q, ground) {
  if (ground) forget(ground);
  const kept = solids.filter((s) => (s.box || s.circle) && !holds(s, p) && !holds(s, q));
  const full = kept.map((s) => grown(s, GROW));
  const near = kept.map((s) => grown(s, Math.max(0, Math.min(GROW, outOf(s, p) - HAIR, outOf(s, q) - HAIR))));
  const ends = ground ? [p, q].map((e) => ({ e, y: endAt(ground, e) })).filter(({ y }) => y !== null) : [];
  const clearOf = (r, y) => ends.reduce((g, end) => (Math.abs(y - end.y) <= STEP + TINY ? Math.min(g, Math.max(0, outOfBox(r, end.e) - HAIR)) : g), GROW);
  const clear = (a, b) => {
    const end = a === p || a === q || b === p || b === q;
    if ((end ? near : full).some((s) => crosses(s, a, b))) return false;
    return !ground || (end ? onFoot(ground, a, b, clearOf) : footed(ground, a, b));
  };
  if (clear(p, q)) return { length: apart(p, q), via: [] };
  const turns = [...full.flatMap(cornersOf), ...(ground?.ways ?? [])].filter((c) => inRoom(room, c) && !full.some((s) => holds(s, c)));
  const spots = [p, q, ...turns];
  const dist = spots.map(() => Infinity);
  const prev = spots.map(() => -1);
  const done = spots.map(() => false);
  dist[0] = 0;
  for (;;) {
    let i = -1;
    for (let k = 0; k < spots.length; k++) if (!done[k] && dist[k] < Infinity && (i < 0 || dist[k] < dist[i])) i = k;
    if (i < 0) return null;
    if (i === 1) break;
    done[i] = true;
    for (let k = 0; k < spots.length; k++) {
      const d = dist[i] + apart(spots[i], spots[k]);
      if (!done[k] && d < dist[k] && clear(spots[i], spots[k])) [dist[k], prev[k]] = [d, i];
    }
  }
  const way = [q];
  for (let k = prev[1]; k >= 0; k = prev[k]) way.push(spots[k]);
  way.reverse();
  // A run of turning points in a line (a stair’s steps one after another)
  // comes out as one leg: from each point, on to the furthest it sees.
  const points = [p];
  for (let i = 0; i < way.length - 1; ) {
    let j = way.length - 1;
    while (j > i + 1 && !clear(way[i], way[j])) j--;
    points.push(way[j]);
    i = j;
  }
  let length = 0;
  for (let i = 1; i < points.length; i++) length += apart(points[i - 1], points[i]);
  return { length, via: points.slice(1, -1) };
}

const toBox = (b, p) => Math.hypot(Math.max(b.x0 - p.x, 0, p.x - b.x1), Math.max(b.z0 - p.z, 0, p.z - b.z1));
// How far a box may be grown square and still leave p outside it: how far p stands out beyond it
// on the side it is furthest out. (Its straight-line distance, toBox, is more off a corner, where a
// box grown square by that much would take p in, and no leg could leave it.) A circle grows round.
const outOfBox = (b, p) => Math.max(0, b.x0 - p.x, p.x - b.x1, b.z0 - p.z, p.z - b.z1);
const outOf = (s, p) => (s.box ? outOfBox(s.box, p) : Math.max(0, Math.hypot(p.x - s.circle.x, p.z - s.circle.z) - s.circle.r));
const growBox = (b, g) => ({ x0: b.x0 - g, x1: b.x1 + g, z0: b.z0 - g, z1: b.z1 + g });
const grown = (s, g) => (s.box ? { box: growBox(s.box, g) } : { circle: { x: s.circle.x, z: s.circle.z, r: s.circle.r + g } });

function cornersOf(s) {
  if (s.box) {
    const { x0, x1, z0, z1 } = s.box;
    return [
      { x: x0 - HAIR, z: z0 - HAIR },
      { x: x1 + HAIR, z: z0 - HAIR },
      { x: x1 + HAIR, z: z1 + HAIR },
      { x: x0 - HAIR, z: z1 + HAIR },
    ];
  }
  // a polygon round the circle, so the legs between its corners stay outside it
  const r = s.circle.r / Math.cos(Math.PI / SIDES) + HAIR;
  return Array.from({ length: SIDES }, (_, k) => ({ x: s.circle.x + r * Math.cos((2 * Math.PI * k) / SIDES), z: s.circle.z + r * Math.sin((2 * Math.PI * k) / SIDES) }));
}

// strictly inside: a point on the edge of a grown solid is still clear of it
function holds(s, p) {
  if (s.box) return p.x > s.box.x0 + TINY && p.x < s.box.x1 - TINY && p.z > s.box.z0 + TINY && p.z < s.box.z1 - TINY;
  return Math.hypot(p.x - s.circle.x, p.z - s.circle.z) < s.circle.r - TINY;
}

// whether the leg from a to b runs through the inside of a grown solid
function crosses(s, a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  if (s.circle) {
    const len2 = dx * dx + dz * dz;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((s.circle.x - a.x) * dx + (s.circle.z - a.z) * dz) / len2)) : 0;
    return Math.hypot(a.x + dx * t - s.circle.x, a.z + dz * t - s.circle.z) < s.circle.r - TINY;
  }
  return cuts(s.box.x0, s.box.x1, s.box.z0, s.box.z1, a, b);
}

// Whether the leg from a to b runs through the inside of the box x0–x1, z0–z1:
// the part of the leg within each slab of the box, narrowed to where both meet.
// Asked for every obstacle on every leg, so it takes plain numbers and turns
// away a leg nowhere near first.
function cuts(x0, x1, z0, z1, a, b) {
  const [lx, hx, lz, hz] = [x0 + TINY, x1 - TINY, z0 + TINY, z1 - TINY];
  if (Math.max(a.x, b.x) <= lx || Math.min(a.x, b.x) >= hx || Math.max(a.z, b.z) <= lz || Math.min(a.z, b.z) >= hz) return false;
  let t0 = 0;
  let t1 = 1;
  for (const [o, d, lo, hi] of [
    [a.x, b.x - a.x, lx, hx],
    [a.z, b.z - a.z, lz, hz],
  ]) {
    if (Math.abs(d) < TINY * TINY) {
      if (o <= lo || o >= hi) return false;
      continue;
    }
    const u = (lo - o) / d;
    const v = (hi - o) / d;
    t0 = Math.max(t0, Math.min(u, v));
    t1 = Math.min(t1, Math.max(u, v));
    if (t0 >= t1) return false;
  }
  return true;
}

// Corners kept GROW inside the room’s walls too, where a body fits.
function inRoom(room, p) {
  if (room.round) return Math.hypot(p.x - room.x, p.z - room.z) <= room.w / 2 - GROW;
  return p.x >= room.box.x0 + GROW && p.x <= room.box.x1 - GROW && p.z >= room.box.z0 + GROW && p.z <= room.box.z1 - GROW;
}

// A room’s floor, worked out once the first time a leg crosses it; null
// when it is one level over the whole room, as most are, so its legs need
// no more than its solids.
// A floor drawn back (a tag in `off`) isn't there: a room surveyed apart for each set of its own
// tags that is off, so the chasm with its bridge out and with it in are two grounds.
function groundOf(nav, room, off = null) {
  const gone = off ? room.floors.filter((f) => f.tag && off.has(f.tag)).map((f) => f.tag) : [];
  const key = gone.length ? `${room.id}|${[...new Set(gone)].sort().join(',')}` : room.id;
  if (!nav.grounds.has(key)) {
    const floors = gone.length ? room.floors.filter((f) => !(f.tag && off.has(f.tag))) : room.floors;
    const [f, ...more] = floors;
    const flat = f && !more.length && (f.circle || (f.x0 <= room.box.x0 + TINY && f.x1 >= room.box.x1 - TINY && f.z0 <= room.box.z0 + TINY && f.z1 >= room.box.z1 - TINY));
    nav.grounds.set(key, flat ? null : survey(nav.layout, room, gone.length ? off : null, floors));
  }
  return nav.grounds.get(key);
}

// An uneven floor (more than one floor box, or gaps between them; every
// box’s edges are lines across the room, X along x and Z along z, between
// which the height is all one) and where a leg may turn on it:
// - round a corner of what can’t be walked onto from beside it (a rise or
//   a drop of more than a step, or a void) where that fills one quarter
//   round the corner only, just clear of it: the end of a landing seen
//   from the deck, the inside corner of a walkway seen from the walkway;
// - halfway along each stretch where two floors a step apart meet: the
//   foot of a stair or a ramp, the step from one stair tread to the next.
function survey(layout, room, drawn = null, floors = room.floors) {
  const at = (x, z) => layout.floorAt(room.id, x, z, drawn ?? undefined);
  // edges a hair apart (a run of treads adds up with rounding) are one line
  const lines = (lo, hi, ends) => [lo, hi, ...ends].filter((v) => v >= lo && v <= hi).sort((m, n) => m - n).filter((v, k, all) => k === 0 || v - all[k - 1] > TINY);
  const X = lines(room.box.x0, room.box.x1, floors.flatMap((f) => [f.x0, f.x1]));
  const Z = lines(room.box.z0, room.box.z1, floors.flatMap((f) => [f.z0, f.z1]));
  const off = (y, from) => y === null || Math.abs(y - from) > STEP + TINY;
  const ways = [];
  for (const x of X) {
    for (const z of Z) {
      const quarters = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => ({ sx, sz, y: at(x + sx * PEEK, z + sz * PEEK) }));
      quarters.forEach((w, k) => {
        const [s, o, t] = [1, 2, 3].map((n) => quarters[(k + n) % 4]);
        if (w.y !== null && off(o.y, w.y) && !off(s.y, w.y) && !off(t.y, w.y)) ways.push({ x: x + w.sx * (GROW + HAIR), z: z + w.sz * (GROW + HAIR) });
      });
    }
  }
  // along each line, the stretches where the floors either side differ by a step or less (and do differ)
  const meets = (marks, sides, point) => {
    let run = null;
    for (let k = 1; k <= marks.length; k++) {
      const [a, b] = k < marks.length ? sides((marks[k - 1] + marks[k]) / 2) : [null, null];
      const step = a !== null && b !== null && a !== b && !off(a, b);
      if (run && !(step && a === run.a && b === run.b)) {
        ways.push(point((run.lo + run.hi) / 2));
        run = null;
      }
      if (step && run) run.hi = marks[k];
      else if (step) run = { lo: marks[k - 1], hi: marks[k], a, b };
    }
  };
  for (const x of X) meets(Z, (z) => [at(x - PEEK, z), at(x + PEEK, z)], (z) => ({ x, z }));
  for (const z of Z) meets(X, (x) => [at(x, z - PEEK), at(x, z + PEEK)], (x) => ({ x, z }));
  const seen = new Set();
  const turns = ways.filter((w) => {
    const key = `${w.x.toFixed(6)},${w.z.toFixed(6)}`;
    if (seen.has(key) || !inRoom(room, w) || at(w.x, w.z) === null) return false;
    seen.add(key);
    return true;
  });
  const ground = { room, floors, at, X, Z, ways: turns, rects: new Map(), legs: new Map(), places: new Map() };
  turns.forEach((w, k) => ground.places.set(`${w.x},${w.z}`, (w.place = k)));
  return ground;
}

// What a body standing at height y must keep clear of in this room: every
// floor more than a step above it, and every part of the room whose floor
// is more than a step below it or missing (what is left of the room once
// the floors no more than a step below are cut out of it).
function obstaclesAt(ground, y) {
  if (!ground.rects.has(y)) {
    const { room, floors } = ground;
    const tall = floors.filter((f) => f.y > y + STEP + TINY);
    let low = [room.box];
    for (const f of floors) if (f.y >= y - STEP - TINY) low = low.flatMap((b) => minus(b, f));
    // a round room’s box reaches past its wall at the corners, and nobody falls off a wall
    if (room.round) low = low.filter((b) => toBox(b, room) < room.w / 2);
    ground.rects.set(y, [...tall, ...low]);
  }
  return ground.rects.get(y);
}

// a box with another cut out of it, as up to four boxes
function minus(b, c) {
  if (c.x0 >= b.x1 || c.x1 <= b.x0 || c.z0 >= b.z1 || c.z1 <= b.z0) return [b];
  const x0 = Math.max(b.x0, c.x0);
  const x1 = Math.min(b.x1, c.x1);
  return [
    { x0: b.x0, x1: x0, z0: b.z0, z1: b.z1 },
    { x0: x1, x1: b.x1, z0: b.z0, z1: b.z1 },
    { x0, x1, z0: b.z0, z1: Math.max(b.z0, c.z0) },
    { x0, x1, z0: Math.min(b.z1, c.z1), z1: b.z1 },
  ].filter((r) => r.x1 - r.x0 > TINY && r.z1 - r.z0 > TINY);
}

// A leg between two turning points keeps the full GROW from everything, so
// whether it can be walked is the same every time it is asked: remembered,
// by a number for each place a turning point has stood (a solid’s corners
// are made afresh each leg, but stand where they stood before).
function footed(ground, a, b) {
  const [i, j] = [placeOf(ground, a), placeOf(ground, b)];
  const key = i < j ? i * 2 ** 21 + j : j * 2 ** 21 + i;
  let known = ground.legs.get(key);
  if (known === undefined) {
    known = onFoot(ground, a, b, () => GROW);
    ground.legs.set(key, known);
  }
  return known;
}

function placeOf(ground, p) {
  if (p.place === undefined) {
    const key = `${p.x},${p.z}`;
    if (!ground.places.has(key)) ground.places.set(key, ground.places.size);
    p.place = ground.places.get(key);
  }
  return p.place;
}

// The memory starts again (only ever between legs, so no corner still in
// use holds a number given out before) once it has grown past LEGS.
function forget(ground) {
  if (ground.legs.size < LEGS && ground.places.size < LEGS) return;
  ground.legs.clear();
  ground.places.clear();
  ground.ways.forEach((w, k) => ground.places.set(`${w.x},${w.z}`, (w.place = k)));
}

// Whether the walker can walk the straight leg from a to b on an uneven
// floor: never over a void, never up or down more than a step at once
// (the height can change only where the leg crosses one of the floors’
// lines), and while at each height y never nearer than `clearOf(box, y)`
// to anything it must keep clear of there.
// The floor under an end of a leg. A door's point stands on its room's wall,
// and a floor box's far edges are outside it, so a door in a room's far wall
// would have no floor under it there (the gantry's door at the top of its
// stair): an end on the room's edge reads the floor a hair inside.
function endAt(ground, p) {
  const y = ground.at(p.x, p.z);
  if (y !== null) return y;
  const b = ground.room.box;
  const x = Math.min(Math.max(p.x, b.x0 + PEEK), b.x1 - PEEK);
  const z = Math.min(Math.max(p.z, b.z0 + PEEK), b.z1 - PEEK);
  return Math.hypot(x - p.x, z - p.z) <= 2 * PEEK ? ground.at(x, z) : null;
}

function onFoot(ground, a, b, clearOf) {
  const { at } = ground;
  const first = endAt(ground, a);
  if (first === null) return false;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const ts = [0, 1];
  const [lx, hx, lz, hz] = [Math.min(a.x, b.x), Math.max(a.x, b.x), Math.min(a.z, b.z), Math.max(a.z, b.z)];
  if (Math.abs(dx) > TINY) for (const x of ground.X) if (x > lx && x < hx) ts.push((x - a.x) / dx);
  if (Math.abs(dz) > TINY) for (const z of ground.Z) if (z > lz && z < hz) ts.push((z - a.z) / dz);
  ts.sort((m, n) => m - n);
  // the leg as runs of one height each
  const runs = [];
  for (let k = 1; k < ts.length; k++) {
    const [t0, t1] = [ts[k - 1], ts[k]];
    if (t1 - t0 < TINY) continue;
    const y = at(a.x + (dx * (t0 + t1)) / 2, a.z + (dz * (t0 + t1)) / 2);
    const was = runs.at(-1);
    if (y === null || Math.abs(y - (was ? was.y : first)) > STEP + TINY) return false;
    if (was && was.y === y) was.t1 = t1;
    else runs.push({ y, t0, t1 });
  }
  const end = endAt(ground, b);
  if (end === null || Math.abs(end - (runs.at(-1)?.y ?? first)) > STEP + TINY) return false;
  return runs.every(({ y, t0, t1 }) => {
    const from = { x: a.x + dx * t0, z: a.z + dz * t0 };
    const to = { x: a.x + dx * t1, z: a.z + dz * t1 };
    return !obstaclesAt(ground, y).some((r) => {
      const g = clearOf(r, y);
      return cuts(r.x0 - g, r.x1 + g, r.z0 - g, r.z1 + g, from, to);
    });
  });
}
