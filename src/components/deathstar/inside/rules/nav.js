// The ways people walk aboard a station. Rooms are convex and joined by
// doors, so a route needs no grid: A* runs over the doors (each a node at
// its centre, passable or not as the caller says) and the lifts’ stops
// (each a node at the middle of its car, a ride costing 8 m a level), and
// inside each room the way is the straight line from point to point. Pure.
//
//   createNav(layout) → nav      the graph of a buildLayout(station), worked out once
//   route(nav, from: { x, z, room }, to: { x, z, room }, { canPass, solidsOf }) → [point] | null
//     canPass(doorId, door) → bool   whether this walker may go through a door (absent: every door)
//     point: { x, z, room, door?, lift? }, from first and to last; each point’s room is the one the
//       leg to it is walked in, so a door’s point names the room before it. `lift` marks the middle
//       of the car where a ride starts, and the next point is the middle of the car it ends in.
//     null when no way is left; a single point when from and to are the same place in one room

const RIDE = 8; // what a ride costs a level, in metres walked
const LEVEL = 4; // the height of a level, for counting a ride’s levels
const SAME = 1e-6; // points nearer than this are one point

const apart = (p, q) => Math.hypot(q.x - p.x, q.z - p.z);

export function createNav(layout) {
  const nodes = new Map();
  const byRoom = new Map([...layout.rooms.keys()].map((id) => [id, []]));
  const add = (node) => {
    nodes.set(node.key, node);
    for (const r of node.rooms) byRoom.get(r).push(node);
  };
  for (const d of layout.doors.values()) {
    const rooms = [...new Set([d.a, d.b])].filter((id) => byRoom.has(id));
    add({ key: `door:${d.id}`, x: d.x, z: d.z, rooms, door: d.id });
  }
  for (const lift of layout.lifts.values()) {
    for (const id of lift.stops ?? []) {
      const car = layout.rooms.get(id);
      if (!car) continue;
      if (!nodes.has(`stop:${id}`)) add({ key: `stop:${id}`, x: car.x, z: car.z, y: car.y, rooms: [id], rides: [] });
    }
  }
  for (const lift of layout.lifts.values()) {
    const stops = (lift.stops ?? []).map((id) => nodes.get(`stop:${id}`)).filter(Boolean);
    for (const s of stops) for (const t of stops) if (s !== t) s.rides.push({ to: t, lift: lift.id, cost: RIDE * Math.max(1, Math.round(Math.abs(t.y - s.y) / LEVEL)) });
  }
  const stops = [...nodes.values()].filter((n) => n.rides);
  for (const n of nodes.values()) n.near = nearest(stops, n);
  return { layout, nodes, byRoom, stops };
}

const nearest = (stops, p) => stops.reduce((best, s) => Math.min(best, apart(p, s)), Infinity);

export function route(nav, from, to, { canPass = () => true } = {}) {
  const { layout, byRoom, stops } = nav;
  if (!byRoom.has(from?.room) || !byRoom.has(to?.room)) return null;
  if (from.room === to.room && apart(from, to) < SAME) return [{ x: from.x, z: from.z, room: from.room }];

  const start = { key: 'start', x: from.x, z: from.z, rooms: [from.room], near: nearest(stops, from) };
  const goal = { key: 'goal', x: to.x, z: to.z, rooms: [to.room] };
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

  function* next(n) {
    for (const room of n.rooms) {
      for (const m of byRoom.get(room)) if (m !== n && (!m.door || open(m.door))) yield { m, room, cost: apart(n, m) };
      if (room === goal.rooms[0]) yield { m: goal, room, cost: apart(n, goal) };
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
      if (fc < f) [n, f] = [c, fc];
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
      points.push({ x: m.x, z: m.z, room: m.rooms[0] });
    } else put({ x: m.x, z: m.z, room: step.room, ...(m.door ? { door: m.door } : {}) });
  }
  return points;
}
