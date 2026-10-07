// The ways people walk aboard a station. Rooms are convex and joined by
// doors, so a route needs no grid: A* runs over the doors (a node at each
// one’s centre, passable or not as the caller says) and the lifts’ stops
// (each a node at the middle of its car, a ride costing 8 m a level), and
// inside each room the way is the straight line from point to point, bent
// round the corners of any of the room’s solids (consoles, crates, a
// ship) it would cross, kept 0.4 m clear of them. A* weighs each leg as
// bent, so furniture in the way of one door sends people by another. Pure.
//
//   createNav(layout) → nav      the graph of a buildLayout(station), worked out once
//   route(nav, from: { x, z, room }, to: { x, z, room }, { canPass, solidsOf }) → [point] | null
//     canPass(doorId, door) → bool   whether this walker may go through a door (absent: every door)
//     solidsOf(roomId) → [{ box: { x0, x1, z0, z1 } } | { circle: { x, z, r } }]   what stands on its floor
//     point: { x, z, room, door?, lift? }, from first and to last; each point’s room is the one the
//       leg to it is walked in, so a door’s point names the room before it. `lift` marks the middle
//       of the car where a ride starts, and the next point is the middle of the car it ends in.
//     null when no way is left; a single point when from and to are the same place in one room

const RIDE = 8; // what a ride costs a level, in metres walked
const LEVEL = 4; // the height of a level, for counting a ride’s levels
const SAME = 1e-6; // points nearer than this are one point
const GROW = 0.4; // how far a route keeps from a solid, and its corners from a wall: a body’s radius and a little
const HAIR = 0.01; // corners stand this far outside a grown solid, so a leg between two of them never grazes it
const SIDES = 8; // a round solid is gone round by this many corners
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
  for (const lift of layout.lifts.values()) {
    const stops = (lift.stops ?? []).map((id) => nodes.get(`stop:${id}`)).filter(Boolean);
    for (const s of stops) for (const t of stops) if (s !== t) s.rides.push({ to: t, lift: lift.id, cost: RIDE * Math.max(1, Math.round(Math.abs(t.y - s.y) / LEVEL)) });
  }
  const stops = [...nodes.values()].filter((n) => n.rides);
  for (const n of nodes.values()) n.near = nearest(stops, n);
  return { layout, byRoom, stops };
}

const nearest = (stops, p) => stops.reduce((best, s) => Math.min(best, apart(p, s)), Infinity);

export function route(nav, from, to, { canPass = () => true, solidsOf = () => [] } = {}) {
  const { layout, byRoom, stops } = nav;
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
    if (!solids.has(room)) solids.set(room, solidsOf(room) ?? []);
    return solids.get(room);
  };

  function* next(n) {
    const { room } = n;
    // not straight back out through the door just come in by
    const there = byRoom.get(room).filter((m) => m !== n && !(m.door && (m.door === n.door || !open(m.door))));
    if (room === goal.room) there.push(goal);
    for (const m of there) {
      const way = bend(layout.rooms.get(room), solidsIn(room), n, m);
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
    if (n === goal) return trace(came, goal, from);
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

// The shortest way from p to q across a room round its solids: straight
// when nothing is in the way, else from corner to corner of the grown
// solids (Dijkstra over the corners, which are few), or null when the
// solids wall q off. → { length, via: [corner] }
function bend(room, solids, p, q) {
  const shapes = grown(solids, p, q);
  const clear = (a, b) => !shapes.some((s) => crosses(s, a, b));
  if (clear(p, q)) return { length: apart(p, q), via: [] };
  const spots = [p, q, ...shapes.flatMap(cornersOf).filter((c) => inRoom(room, c) && !shapes.some((s) => holds(s, c)))];
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
  const via = [];
  for (let k = prev[1]; k > 0; k = prev[k]) via.push(spots[k]);
  return { length: dist[1], via: via.reverse() };
}

const toBox = (b, p) => Math.hypot(Math.max(b.x0 - p.x, 0, p.x - b.x1), Math.max(b.z0 - p.z, 0, p.z - b.z1));
const toSolid = (s, p) => (s.box ? toBox(s.box, p) : Math.max(0, Math.hypot(p.x - s.circle.x, p.z - s.circle.z) - s.circle.r));

// Each solid grown by GROW, or by less where an end of the leg stands
// nearer than that (a door beside a console must still be reachable); a
// solid an end stands inside is left out, so someone in the Falcon’s box
// (her hold’s hatch is under her) walks straight out rather than nowhere.
function grown(solids, p, q) {
  const out = [];
  for (const s of solids) {
    if (!s.box && !s.circle) continue;
    const g = Math.min(GROW, toSolid(s, p) - HAIR, toSolid(s, q) - HAIR);
    if (g <= 0) continue;
    if (s.box) out.push({ box: { x0: s.box.x0 - g, x1: s.box.x1 + g, z0: s.box.z0 - g, z1: s.box.z1 + g } });
    else out.push({ circle: { x: s.circle.x, z: s.circle.z, r: s.circle.r + g } });
  }
  return out;
}

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
  // the part of the leg within each slab of the box, narrowed to where both meet
  let t0 = 0;
  let t1 = 1;
  for (const [o, d, lo, hi] of [
    [a.x, dx, s.box.x0 + TINY, s.box.x1 - TINY],
    [a.z, dz, s.box.z0 + TINY, s.box.z1 - TINY],
  ]) {
    if (Math.abs(d) < TINY * TINY) {
      if (o <= lo || o >= hi) return false;
      continue;
    }
    const [u, v] = [(lo - o) / d, (hi - o) / d].sort((m, n) => m - n);
    t0 = Math.max(t0, u);
    t1 = Math.min(t1, v);
    if (t0 >= t1) return false;
  }
  return true;
}

// Corners kept GROW inside the room’s walls too, where a body fits.
function inRoom(room, p) {
  if (room.round) return Math.hypot(p.x - room.x, p.z - room.z) <= room.w / 2 - GROW;
  return p.x >= room.box.x0 + GROW && p.x <= room.box.x1 - GROW && p.z >= room.box.z0 + GROW && p.z <= room.box.z1 - GROW;
}
