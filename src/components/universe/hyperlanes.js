// The hyperlanes: a web of lanes between the universe map's places, in three
// tiers, with traffic in them you can ride at hyperspeed (ride.js) and leave
// anywhere. Pure numbers, tested in Node: the chart, the scene, the traffic
// (laneFlow.js) and the director read it.
//
// The nodes: every place's ramp (a point RAMP_OUT of its reach out from it,
// on the side facing its region's beacon, so a lane never ends inside the
// traffic round a planet) and every region's beacon (regions.js's hub). The
// lanes, each a quadratic Bézier from node to node (lanes.js's helpers):
//   local    each member of a region to its beacon, hub and spoke
//   trunk    beacon to beacon round the disc (a ring road), and every beacon
//            to the home system's (a spoke)
//   express  the home beacon to the Star Wars gate, the portal and the Maw
// A lane's middle control point is lifted off the straight line by turns up
// and down (LIFT, so lanes crossing the same stretch don't meet), higher
// when that line runs through something, bent out to the side round it when
// lifting won't do, and the lane is dropped when even that won't clear (the
// test keeps the web joined up). Each lane has two
// carriageways, out and in, GAP apart, each a tube of radius R: traffic
// keeps to the right, as on a road.
//
// routeTo(ship, toId) is the way there by the lanes: free flight to a ramp
// or beacon near the ship, the rides, and free flight in from the last node;
// or null when flying there free is quicker (a hop at a place). Its time
// counts each lane's length over its speed, RAMP_S a node, and the free legs
// as they're flown: the pulse drive in the open, a quarter of it in the home
// system, the boost for the last leg in. laneAt(x, y, z) says which carriageway a point is in.

import { bezier, laneLength } from './lanes';
import { REGIONS } from './regions';
import { DEEP, PLACES, WONDERS, reachOf } from './deep';
import { MAW } from './maw';
import { SHIP, SOLIDS } from './ship';
import { byId } from './universes';

export const TIERS = {
  local: { speed: 1200, density: 400 }, // (600 in the first plan: slower than super speed's 900, over local lanes 5,000 to 11,000 long since the spread)
  trunk: { speed: 1500, density: 900 },
  express: { speed: 4000, density: 2500 },
};
export const RAMP_OUT = 1.6; // a ramp sits this many of its place's reaches from the place's middle
export const LIFT = [60, 110]; // how far a lane's middle control point is lifted off the straight line
export const GAP = 24; // between a lane's two carriageways
export const R = 6; // a carriageway's radius
export const RING = 12; // a node's ramp ring, flown through to get on (ride.js)
export const RAMP_S = 3; // seconds a route counts for each node it takes a lane at
const FREE = 6000; // how far from a node the ship flies to it free, to start a route
// what free flight costs: the pulse drive out in the open, but in the home
// system the drive barely opens (ship.js's HOME_TOP: a hop between stations
// is a hop), so a leg in or out of it goes at about a quarter of it (as
// flown: 650 from the home edge to its east beacon takes 7.7 s); and the
// last leg in to a place is at the boost, the drive down by it (deep.js)
const HOME_FREE = SHIP.pulse / 4;
const freeTime = (a, b, pulse) => dist(a, b) / (Math.hypot(a[0], a[2]) < DEEP.open || Math.hypot(b[0], b[2]) < DEEP.open ? Math.min(pulse, HOME_FREE) : pulse);
const CLEAR = 2; // how far a lane stays off anything, past its reach

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (v) => Math.hypot(v[0], v[1], v[2]);
const dist = (a, b) => len(sub(a, b));
const unit = (v) => {
  const l = len(v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const along = (a, u, d) => [a[0] + u[0] * d, a[1] + u[1] * d, a[2] + u[2] * d];

// what a lane stays clear of: everything solid by its reach (the moons, the
// rings, a pulsar's glare), the Maw's pull, and a binary all the way round
// its swing (its suns go round, and SOLIDS has them where they are now)
const KEEP_OUT = [
  ...SOLIDS.filter((o) => !o.id.startsWith('twins')).map((o) => ({ at: o.at, r: o.reach })),
  { at: MAW.at, r: MAW.reach },
  ...WONDERS.filter((w) => w.kind === 'binary').map((w) => ({ at: w.at, r: reachOf(w) * 1.4 })),
];
// how close a Bézier comes to KEEP_OUT, past each thing's edge
function clearOf(pts, steps = 64) {
  let min = Infinity;
  const p = [0, 0, 0];
  for (let i = 0; i <= steps; i++) {
    bezier(pts, i / steps, p);
    for (const o of KEEP_OUT) min = Math.min(min, Math.hypot(p[0] - o.at[0], p[1] - o.at[1], p[2] - o.at[2]) - o.r);
  }
  return min;
}

// ── The nodes ──
const PLACE = new Map(PLACES.map((p) => [p.id, p]));
// The home system has four beacons round its edge, a quarter turn apart (its
// own, regions.js's, on the side the ship starts, and three more): a lane
// from out in deep space comes in to the one facing it, so none crosses the
// home system, its stations or its sun to get to the far side. A short local
// lane joins each to the next round the system.
const HOME_OUT = Math.hypot(REGIONS[0].hub[0], REGIONS[0].hub[2]);
const HOME_BEACONS = [
  ['home', 0],
  ['home-e', Math.PI / 2],
  ['home-n', Math.PI],
  ['home-w', -Math.PI / 2],
].map(([id, a]) => ({ id: `beacon:${id}`, kind: 'beacon', at: [Math.sin(a) * HOME_OUT, REGIONS[0].hub[1], Math.cos(a) * HOME_OUT], region: 'home', name: 'Home' }));
const BEACONS = [...HOME_BEACONS, ...REGIONS.slice(1).map((r) => ({ id: `beacon:${r.id}`, kind: 'beacon', at: r.hub, region: r.id, name: r.name }))];
const BEACON = new Map(BEACONS.filter((b) => b.region !== 'home').map((b) => [b.region, b]));
BEACON.set('home', HOME_BEACONS[0]);
// the home beacon facing `at`: the one at the least angle round from it
const homeFacing = (at) => HOME_BEACONS.reduce((a, b) => (Math.hypot(b.at[0] - at[0], b.at[2] - at[2]) < Math.hypot(a.at[0] - at[0], a.at[2] - at[2]) ? b : a));
// the places an express runs to from home
const EXPRESS = [
  { place: 'starwars', name: 'The Gate express' },
  { place: 'rmportal', name: 'The Portal express' },
  { place: MAW.id, name: 'The Maw express' },
];

// a place's ramp: RAMP_OUT of its reach out toward the nodes its lanes run
// to (its beacon, and the home system's for the places an express runs to:
// between the two, so neither lane has to swing round the place); turned round its place a step at a time
// should that spot not be clear
function rampFor(id, region) {
  const p = PLACE.get(id);
  const ends = [BEACON.get(region).at, ...(EXPRESS.some((e) => e.place === id) ? [homeFacing(p.at).at] : [])];
  // (and always 40 past what the place keeps lanes out of: a small ice
  // giant's solid reaches past 1.6 of its own reach, the Maw's pull far past)
  const own = Math.max(0, ...KEEP_OUT.filter((o) => dist(o.at, p.at) < 1).map((o) => o.r));
  const out = Math.max(p.reach * RAMP_OUT, own + 40);
  let u = ends.map((e) => unit(sub(e, p.at))).reduce((a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]);
  // (level with the place, so a ship off the lane flies straight in, not up
  // or down to it: the autopilot parks level with a place, and climbs slowly;
  // and the two ends straight opposite: off to the side of both)
  u = [u[0], 0, u[2]];
  if (len(u) < 0.2) u = [-(ends[0][2] - p.at[2]), 0, ends[0][0] - p.at[0]];
  u = unit(u);
  for (let i = 0; i < 16; i++) {
    const a = ((i % 2 ? 1 : -1) * Math.ceil(i / 2) * Math.PI) / 8;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const at = along(p.at, [u[0] * c - u[2] * s, 0, u[0] * s + u[2] * c], out);
    if (KEEP_OUT.every((o) => dist(at, o.at) > o.r + RING + CLEAR)) return { id: `ramp:${id}`, kind: 'ramp', at, place: id, region };
  }
  return null;
}
const RAMPS = REGIONS.slice(1).flatMap((r) => r.members.map((id) => rampFor(id, r.id)).filter(Boolean));
export const NODES = [...BEACONS, ...RAMPS];
const NODE = new Map(NODES.map((n) => [n.id, n]));
export const rampOf = (placeId) => NODE.get(`ramp:${placeId}`) ?? null;
export const nodeById = (id) => NODE.get(id) ?? null;

// ── The lanes ──
const placeName = (id) => byId(id)?.world ?? byId(id)?.label ?? WONDERS.find((w) => w.id === id)?.name ?? id;
const regionName = (id) => REGIONS.find((r) => r.id === id).name.replace(/^Near /, '');

// a lane from node a to node b, its middle lifted by turns (index i); higher
// if it won't clear, and null if it still won't. (`bend`: its middle control
// point given, for the lanes round the home system.)
function laneFrom(a, b, tier, name, i, bend = null) {
  const lane = (pts) => ({ id: `${tier}:${a.id}>${b.id}`, tier, from: a.id, to: b.id, pts, length: laneLength(pts, 48), name });
  if (bend) return lane([a.at, bend, b.at]);
  const mid = [(a.at[0] + b.at[0]) / 2, (a.at[1] + b.at[1]) / 2, (a.at[2] + b.at[2]) / 2];
  const sign = i % 2 ? -1 : 1;
  const first = LIFT[0] + (LIFT[1] - LIFT[0]) * ((i * 0.618) % 1);
  const lifts = [first, LIFT[1] * 1.5, LIFT[1] * 2].flatMap((h) => [[0, sign * h], [0, -sign * h]]);
  // (and past that, bent round whatever's in the way: the middle control
  // point out to the side or up and down further, a little at a time, eight
  // ways round the line; the places are thousands apart, and the Maw's pull
  // or a gate at a lane's far end is what this goes round)
  const bends = [300, 600, 1200, 2400].flatMap((m) => Array.from({ length: 8 }, (_, k) => [Math.cos((k * Math.PI) / 4) * m, Math.sin((k * Math.PI) / 4) * m]));
  const d = sub(b.at, a.at);
  const side = unit([-d[2], 0, d[0]]);
  for (const [sx, h] of [...lifts, ...bends]) {
    const pts = [a.at, [mid[0] + side[0] * sx, mid[1] + h, mid[2] + side[2] * sx], b.at];
    if (clearOf(pts) > CLEAR + GAP / 2 + R) return lane(pts);
  }
  return null;
}

function build() {
  const out = [];
  const add = (l) => l && out.push(l);
  // local: each member to its beacon
  for (const r of REGIONS.slice(1)) {
    const hub = BEACON.get(r.id);
    for (const id of r.members) {
      const ramp = rampOf(id);
      if (ramp) add(laneFrom(ramp, hub, 'local', `${placeName(id)} – ${regionName(r.id)} local`, out.length));
    }
  }
  // trunk: round the ring (the regions are in order of angle), and each home
  const ring = REGIONS.slice(1);
  ring.forEach((r, k) => {
    const next = ring[(k + 1) % ring.length];
    add(laneFrom(BEACON.get(r.id), BEACON.get(next.id), 'trunk', `${regionName(r.id)} – ${regionName(next.id)} trunk`, out.length));
  });
  for (const r of ring) add(laneFrom(BEACON.get(r.id), homeFacing(r.hub), 'trunk', `${regionName(r.id)} – Home trunk`, out.length));
  // express: home to the gates, each from the home beacon facing it
  for (const e of EXPRESS) {
    const ramp = rampOf(e.place);
    if (ramp) add(laneFrom(homeFacing(ramp.at), ramp, 'express', e.name, out.length));
  }
  // round the home system: each of its beacons to the next, bowed out round
  // the corner between them (the middle control point at the corner of the
  // square they sit on, so the lane stays out past the system's edge)
  HOME_BEACONS.forEach((a, k) => {
    const b = HOME_BEACONS[(k + 1) % HOME_BEACONS.length];
    add(laneFrom(a, b, 'local', 'The home ring', out.length, [a.at[0] + b.at[0], a.at[1], a.at[2] + b.at[2]]));
  });
  return out;
}
export const LANES = build();
export const laneById = (id) => LANES.find((l) => l.id === id) ?? null;

// ── The carriageways ──
// a lane's carriageway: its three points moved GAP / 2 to the right of the
// way along it (level: right of the line from end to end, seen from above),
// and run the other way for `in`
const CARRIAGE = new Map();
export function carriageway(lane, way) {
  const key = `${lane.id}|${way}`;
  let c = CARRIAGE.get(key);
  if (c) return c;
  const pts = way === 'in' ? [lane.pts[2], lane.pts[1], lane.pts[0]] : lane.pts;
  const d = sub(pts[2], pts[0]);
  const right = unit([-d[2], 0, d[0]]);
  c = pts.map((p) => along(p, right, GAP / 2));
  CARRIAGE.set(key, c);
  return c;
}

// each carriageway sampled for laneAt, with a box round it to skip it fast
const SAMPLES = 48;
function sampled(lane, way) {
  const pts = carriageway(lane, way);
  const ps = Array.from({ length: SAMPLES + 1 }, (_, i) => bezier(pts, i / SAMPLES));
  const lo = [0, 1, 2].map((k) => Math.min(...ps.map((p) => p[k])) - R * 2);
  const hi = [0, 1, 2].map((k) => Math.max(...ps.map((p) => p[k])) + R * 2);
  return { lane, way, pts, ps, lo, hi };
}
const TRACKS = new WeakMap();
const tracksOf = (lanes) => {
  let t = TRACKS.get(lanes);
  if (!t) TRACKS.set(lanes, (t = lanes.flatMap((l) => [sampled(l, 'out'), sampled(l, 'in')])));
  return t;
};

// which carriageway (x, y, z) is in, inside R × 1.3 of its middle: { lane,
// way, s (0…1 along it), off (from its middle) }, the nearest if two; or null
export function laneAt(x, y, z, lanes = LANES) {
  let best = null;
  const q = [x, y, z];
  for (const t of tracksOf(lanes)) {
    if (x < t.lo[0] || y < t.lo[1] || z < t.lo[2] || x > t.hi[0] || y > t.hi[1] || z > t.hi[2]) continue;
    // the nearest sample, then a few halvings either side of it
    let k = 0;
    let dk = Infinity;
    for (let i = 0; i <= SAMPLES; i++) {
      const d = dist(q, t.ps[i]);
      if (d < dk) {
        dk = d;
        k = i;
      }
    }
    let s = k / SAMPLES;
    let step = 1 / SAMPLES;
    const p = [0, 0, 0];
    for (let n = 0; n < 12; n++) {
      step /= 2;
      const a = Math.max(0, s - step);
      const b = Math.min(1, s + step);
      const da = dist(q, bezier(t.pts, a, p));
      const db = dist(q, bezier(t.pts, b, p));
      if (da < dk && da <= db) {
        s = a;
        dk = da;
      } else if (db < dk) {
        s = b;
        dk = db;
      }
    }
    if (dk <= R * 1.3 && (!best || dk < best.off)) best = { lane: t.lane, way: t.way, s, off: dk };
  }
  return best;
}

// ── Routes ──
// the graph: each lane both ways, a ride's cost its length over its tier's
// speed, and RAMP_S for the node it's taken at
const EDGES = new Map(NODES.map((n) => [n.id, []]));
for (const l of LANES) {
  const t = l.length / TIERS[l.tier].speed + RAMP_S;
  EDGES.get(l.from).push({ to: l.to, lane: l, way: 'out', t });
  EDGES.get(l.to).push({ to: l.from, lane: l, way: 'in', t });
}
// where a route to `id` can end: a place's ramp (then free flight in to the
// place); a station's, any of the home system's beacons
const goalOf = (id) => {
  const p = PLACE.get(id);
  if (!p) return null;
  if (p.kind === 'station') return { nodes: HOME_BEACONS, at: p.at };
  const ramp = rampOf(id);
  return ramp ? { nodes: [ramp], at: p.at } : null;
};

// the last leg, in to the place from its ramp (or a station from a home beacon)
const inTime = (a, b) => dist(a, b) / SHIP.boost;

// The way to `toId` by the lanes from where the ship is: { legs, time }, or
// null when there's no lane near it or free flight there is quicker. Legs
// are { kind: 'fly' | 'ride', from, to, lane?, way? }.
export function routeTo(ship, toId, { pulse = SHIP.pulse } = {}) {
  const goal = goalOf(toId);
  if (!ship || !goal) return null;
  const here = [ship.x, ship.y ?? 0, ship.z];
  const direct = freeTime(here, goal.at, pulse);
  // the start: free flight to any node within FREE (or the nearest three)
  const near = NODES.map((n) => ({ n, d: dist(here, n.at) })).sort((a, b) => a.d - b.d);
  const starts = near.filter((x, i) => x.d <= FREE || i < 3);
  // Dijkstra over the nodes (forty-odd: a plain scan for the next)
  const best = new Map();
  const via = new Map();
  const done = new Set();
  for (const { n } of starts) best.set(n.id, freeTime(here, n.at, pulse));
  for (;;) {
    let at = null;
    for (const [id, t] of best) if (!done.has(id) && (at === null || t < best.get(at))) at = id;
    if (at === null) break;
    done.add(at);
    for (const e of EDGES.get(at)) {
      const t = best.get(at) + e.t;
      if (t < (best.get(e.to) ?? Infinity)) {
        best.set(e.to, t);
        via.set(e.to, { from: at, e });
      }
    }
  }
  // the end node that gets there soonest, with the flight in
  let end = null;
  let time = Infinity;
  for (const n of goal.nodes) {
    const t = (best.get(n.id) ?? Infinity) + inTime(n.at, goal.at);
    if (t < time) [end, time] = [n, t];
  }
  if (!end || time >= direct) return null;
  // the legs, back from the end
  const rides = [];
  for (let id = end.id; via.has(id); id = via.get(id).from) {
    const { from, e } = via.get(id);
    rides.unshift({ kind: 'ride', from: NODE.get(from).at, to: NODE.get(id).at, lane: e.lane, way: e.way });
  }
  if (!rides.length) return null; // (only free flight: the autopilot of today does that)
  const legs = [{ kind: 'fly', from: here, to: rides[0].from }, ...rides, { kind: 'fly', from: end.at, to: goal.at }];
  return { legs, time };
}
