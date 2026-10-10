// The universe map's waypoints: the spots in deep space the fleet war's
// fronts sit at (front.js's BEACONS) and the far fights break out at
// (farFights.js). Pure numbers, tested in Node. They were the hyperlanes'
// nodes; the lanes are gone (the jump is the way about now), and the nodes
// stay where they were, ids and all (`beacon:<region>`, `ramp:<place>`),
// since online the fronts are shared by these ids.
//
// The nodes: every region's beacon (regions.js's hub), four round the home
// system's edge, and every place's ramp: a point RAMP_OUT of its reach out
// from it, on the side facing its region's beacon (and the home system's,
// for the places an express ran to), turned round it a step at a time until
// it's clear of everything (KEEP_OUT).

import { REGIONS } from './regions';
import { PLACES, WONDERS, reachOf } from './deep';
import { MAW } from './maw';
import { SOLIDS } from './ship';
import { byId } from './universes';

export const RAMP_OUT = 1.6; // a ramp sits this many of its place's reaches from the place's middle
const RING = 12; // the room kept round a ramp
const CLEAR = 2; // and past that, past what it keeps clear of

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (v) => Math.hypot(v[0], v[1], v[2]);
const dist = (a, b) => len(sub(a, b));
const unit = (v) => {
  const l = len(v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const along = (a, u, d) => [a[0] + u[0] * d, a[1] + u[1] * d, a[2] + u[2] * d];

// what a waypoint keeps clear of: everything solid by its reach (the moons,
// the rings, a pulsar's glare), the Maw's pull, a binary all the way round
// its swing (its suns go round, and SOLIDS has them where they are now), and
// the portals
export const KEEP_OUT = [
  ...SOLIDS.filter((o) => !o.id.startsWith('twins')).map((o) => ({ at: o.at, r: o.reach })),
  { at: MAW.at, r: MAW.reach },
  ...WONDERS.filter((w) => w.kind === 'binary').map((w) => ({ at: w.at, r: reachOf(w) * 1.4 })),
  ...WONDERS.filter((w) => w.kind === 'portal').map((w) => ({ at: w.at, r: w.r * 4 })),
];

const placeName = (id) => byId(id)?.world ?? byId(id)?.label ?? WONDERS.find((w) => w.id === id)?.name ?? id;
const PLACE = new Map(PLACES.map((p) => [p.id, p]));
// The home system has four beacons round its edge, a quarter turn apart (its
// own, regions.js's, on the side the ship starts, and three more)
const HOME_OUT = Math.hypot(REGIONS[0].hub[0], REGIONS[0].hub[2]);
export const HOME_BEACONS = [
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
// the places the express lanes ran to from home (their ramps sit between
// their beacon and home's, so they stay where they were)
const EXPRESS = ['starwars', 'rmportal', MAW.id];

// a place's ramp: RAMP_OUT of its reach out toward its beacon (and the home
// system's, for an express place: between the two), level with it, turned
// round its place a step at a time should that spot not be clear
function rampFor(id, region) {
  const p = PLACE.get(id);
  const ends = [BEACON.get(region).at, ...(EXPRESS.includes(id) ? [homeFacing(p.at).at] : [])];
  // (and always 40 past what the place keeps clear of: a small ice giant's
  // solid reaches past 1.6 of its own reach, the Maw's pull far past)
  const own = Math.max(0, ...KEEP_OUT.filter((o) => dist(o.at, p.at) < 1).map((o) => o.r));
  const out = Math.max(p.reach * RAMP_OUT, own + 40);
  let u = ends.map((e) => unit(sub(e, p.at))).reduce((a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]);
  u = [u[0], 0, u[2]];
  if (len(u) < 0.2) u = [-(ends[0][2] - p.at[2]), 0, ends[0][0] - p.at[0]];
  u = unit(u);
  for (let i = 0; i < 16; i++) {
    const a = ((i % 2 ? 1 : -1) * Math.ceil(i / 2) * Math.PI) / 8;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const at = along(p.at, [u[0] * c - u[2] * s, 0, u[0] * s + u[2] * c], out);
    if (KEEP_OUT.every((o) => dist(at, o.at) > o.r + RING + CLEAR)) return { id: `ramp:${id}`, kind: 'ramp', at, place: id, region, name: placeName(id) };
  }
  return null;
}
const RAMPS = REGIONS.slice(1).flatMap((r) => r.members.map((id) => rampFor(id, r.id)).filter(Boolean));
export const NODES = [...BEACONS, ...RAMPS];
const NODE = new Map(NODES.map((n) => [n.id, n]));
export const rampOf = (placeId) => NODE.get(`ramp:${placeId}`) ?? null;
export const nodeById = (id) => NODE.get(id) ?? null;
