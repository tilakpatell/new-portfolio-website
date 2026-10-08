// A generated sector's hyperlanes, in hyperlanes.js's shapes, so the chart,
// the rides and the routes take them as they take the authored map's. Pure
// (no three.js).
//
// The nodes: each system's ramp (a little out from its star toward the hub,
// level with it), the sector's hub beacon (in the middle of its systems,
// weighted by star size, nudged off anything it lands in) and the four
// edge beacons (sector.js's). The lanes: each ramp to the hub (local, by
// hyperlanes.js's buildFor), and the hub out to each edge beacon (trunk).
// What they stay clear of: the stars (twice their size; a planet's orbit
// isn't solid) and the wonders (their size). Sector (0, 0) has none: the
// authored map's own LANES serve it.
//
// sectorLanes(sector) → { nodes, lanes }
//   a ramp: { id: 'ramp:<system id>', kind: 'ramp', at, place, region, name }
//   a beacon: { id, kind: 'beacon', at, region, name }
// trunkBetween(a, b) → the trunk lane from a's edge beacon facing b to b's
//   facing a (a and b edge neighbours, from makeSector; throws if not). The
//   same lane both ways: built from the sector with the lower seed, its id
//   the same, and turned round for the other order.

import { LIFT, buildFor, laneFrom } from "../../universe/hyperlanes";
import { laneLength } from "../../universe/lanes";
import { facing } from "./sector";
import { hash64, range, rngOf } from "./seed";

const RAMP_PAST = 300; // a ramp's this far past four of its star's sizes
const MARGIN = 60; // how far a node keeps past anything a lane stays out of
const NUDGE = 200; // the hub's step out of what it lands in
const HUB_GAP = 2000; // and how far it keeps past anything (so a lane in to it has room to bend round a star beside it)
const BEND = 200; // how far a trunk between sectors bends to the side, at most

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dist = (a, b) => Math.hypot(...sub(a, b));
const clear = (at, keepOut, gap = MARGIN) =>
  keepOut.every((o) => dist(at, o.at) > o.r + gap);

const starsOf = (sector) =>
  sector.systems.map((s) => ({ at: s.at, r: s.star.size * 2 }));
const keepOutOf = (sector, nebulae = true) => [
  ...starsOf(sector),
  ...sector.wonders
    .filter((w) => nebulae || w.kind !== "nebula")
    .map((w) => ({ at: w.at, r: w.size })),
];

// a lane clear of everything if it can be; else through a nebula (a cloud,
// not solid: a wonder 3,000 off a beacon can sit square across its way in),
// else clear of the stars alone
function laneOf(sector, a, b, tier, name, i) {
  for (const keepOut of [
    keepOutOf(sector),
    keepOutOf(sector, false),
    starsOf(sector),
  ]) {
    const l = laneFrom(a, b, tier, name, i, null, keepOut);
    if (l) return l;
  }
  return null;
}

// the middle of the systems, weighted by star size, stepped out of
// whatever it lands in
function hubAt(sector, keepOut) {
  const w = sector.systems.reduce((t, s) => t + s.star.size, 0);
  const at = w
    ? [0, 1, 2].map(
        (k) =>
          sector.systems.reduce((t, s) => t + s.at[k] * s.star.size, 0) / w,
      )
    : [...sector.origin];
  for (let n = 0; n < 200 && !clear(at, keepOut, HUB_GAP); n++) {
    const o = keepOut.find((x) => dist(at, x.at) <= x.r + HUB_GAP);
    let u = sub(at, o.at);
    u = [u[0], 0, u[2]];
    const l = Math.hypot(u[0], u[2]);
    u = l > 1 ? [u[0] / l, 0, u[2] / l] : [1, 0, 0];
    for (const k of [0, 2]) at[k] += u[k] * NUDGE;
  }
  return at;
}

// a system's ramp: out from its star toward the hub, level, turned round a
// step at a time should that spot not be clear
function rampFor(sys, sector, hub, keepOut) {
  const out = sys.star.size * 4 + RAMP_PAST;
  const d = [hub[0] - sys.at[0], hub[2] - sys.at[2]];
  const l = Math.hypot(d[0], d[1]);
  const u = l > 1 ? [d[0] / l, d[1] / l] : [1, 0];
  let at = null;
  for (let i = 0; i < 16 && !at; i++) {
    const a = ((i % 2 ? 1 : -1) * Math.ceil(i / 2) * Math.PI) / 8;
    const [c, s] = [Math.cos(a), Math.sin(a)];
    const p = [
      sys.at[0] + (u[0] * c - u[1] * s) * out,
      sys.at[1],
      sys.at[2] + (u[0] * s + u[1] * c) * out,
    ];
    if (clear(p, keepOut)) at = p;
  }
  return {
    id: `ramp:${sys.id}`,
    kind: "ramp",
    at: at ?? [sys.at[0] + u[0] * out, sys.at[1], sys.at[2] + u[1] * out],
    place: sys.id,
    region: sector.id,
    name: sys.name,
  };
}

const beaconNode = (b, sector, name) => ({
  id: b.id,
  kind: "beacon",
  at: b.at,
  region: sector.id,
  name,
});

export function sectorLanes(sector) {
  if (!sector.sx && !sector.sz) return { nodes: [], lanes: [] };
  const keepOut = keepOutOf(sector);
  const name = sector.id;
  const hub = {
    id: `beacon:${sector.id}:hub`,
    kind: "beacon",
    at: hubAt(sector, keepOut),
    region: sector.id,
    name,
  };
  const ramps = sector.systems.map((s) => rampFor(s, sector, hub.at, keepOut));
  const edges = ["n", "e", "s", "w"].map((side) =>
    beaconNode(sector.beacons[side], sector, `${name} ${side}`),
  );
  const lanes = buildFor([{ id: sector.id, name, hub, members: ramps }], [], {
    ring: false,
    keepOut,
  });
  // (buildFor drops a spoke that won't clear: tried again, less fussy, and
  // failing that run to the nearest ramp that's joined, as a trunk that
  // can't get past a star by the hub runs from the ramp nearest its beacon)
  const joined = new Set([hub.id, ...lanes.map((l) => l.from)]);
  const join = (n, tier, label) => {
    const near = ramps
      .filter((r) => r.id !== n.id && joined.has(r.id))
      .sort((p, q) => dist(p.at, n.at) - dist(q.at, n.at));
    for (const to of [hub, ...near]) {
      const l =
        tier === "local"
          ? laneOf(sector, n, to, tier, label(to), lanes.length)
          : laneOf(sector, to, n, tier, label(to), lanes.length);
      if (l) {
        joined.add(n.id);
        return lanes.push(l);
      }
    }
    lanes.push(null);
  };
  for (const r of ramps)
    if (!joined.has(r.id))
      join(r, "local", (to) => `${r.name} – ${to.name} local`);
  for (const b of edges)
    join(b, "trunk", (to) => `${to.name} – ${b.name} trunk`);
  return { nodes: [...ramps, hub, ...edges], lanes };
}

export function trunkBetween(a, b) {
  const flip = !(a.seed < b.seed);
  const [lo, hi] = flip ? [b, a] : [a, b];
  const from = lo.beacons[facing([lo.sx, lo.sz], [hi.sx, hi.sz])];
  const to = hi.beacons[facing([hi.sx, hi.sz], [lo.sx, lo.sz])];
  const rng = rngOf(hash64(lo.seed, hi.seed));
  const d = sub(to.at, from.at);
  const l = Math.hypot(d[0], d[2]) || 1;
  const side = [-d[2] / l, 0, d[0] / l];
  const lift = (rng() < 0.5 ? -1 : 1) * range(rng, LIFT[0], LIFT[1]);
  const bend = range(rng, -BEND, BEND);
  const mid = [0, 1, 2].map(
    (k) => (from.at[k] + to.at[k]) / 2 + side[k] * bend + (k === 1 ? lift : 0),
  );
  const pts = [from.at, mid, to.at];
  const t = {
    id: `trunk:${from.id}>${to.id}`,
    tier: "trunk",
    from: from.id,
    to: to.id,
    pts,
    length: laneLength(pts, 48),
    name: `${lo.id} – ${hi.id} trunk`,
  };
  return flip
    ? { ...t, from: t.to, to: t.from, pts: [t.pts[2], t.pts[1], t.pts[0]] }
    : t;
}
