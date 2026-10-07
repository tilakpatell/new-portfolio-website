// The places to find out in a star system's open space (Phase 6 of the
// galaxy's expansion): three to six a system, between the moment from the
// films round the planet and the system's edge, the same for every pilot
// every time (seeded from the system's id, as the rocks are). A derelict
// hull, a comet, a knot of asteroids, a navigation beacon, a small outpost,
// a pocket of nebula: somewhere to fly to, found when you get there, and
// kept found (createFinds, in localStorage). Pure numbers, tested in Node:
// placesDraw.js draws them, world.js makes them solid and the autopilot's
// goals, the scene says when one's found.
//
// PLACES: where they sit; PLACE_KINDS: each kind's size and its names
// placesOf(sys) → [{ id, kind, name, hint, at: [x, y, z], r, reach, goal: true, place: true }]
//   r: solid to here (0: the nebula, flown through); reach: at it within this
// createFinds({ store }) → { found(sysId), has(sysId, id), mark(sysId, id) → new?, count(sysId) → { found, of }, total() }
// readFound(string) → { sysId: [ids] }, believed only in shape

import { SYSTEMS, hazardsOf } from './systems';

export const PLACES = {
  inner: 700, // from the planet: the moment round it is all within about 400
  outer: 2000, // and short of the edge (space.js's EDGE, 2,400), so there's open space past them
  height: 180, // above or below the planet's plane, at most
  apart: 420, // from each other, at least
  clear: 60, // past a hazard's reach and the place's own, at least
};

// what a place is: how big it's solid (r), how close counts as at it
// (reach), and its names (one picked by the seed)
export const PLACE_KINDS = {
  wreck: { r: 6, reach: 16, hint: 'A derelict', names: ['The hulk of a Nebulon-B frigate', 'A gutted Corellian corvette', 'A derelict bulk freighter', 'A burnt-out Gozanti cruiser', 'A Lambda shuttle, adrift and dark'] },
  comet: { r: 4, reach: 14, hint: 'A comet', names: ['A long-period comet', 'A comet, its tail streaming sunward', 'An old comet, half spent'] },
  rocks: { r: 10, reach: 26, hint: 'Asteroids', names: ['A knot of asteroids', 'A smugglers’ rock cache', 'An asteroid with a mine in it'] },
  beacon: { r: 2, reach: 12, hint: 'A beacon', names: ['A navigation beacon', 'A hyperspace marker buoy', 'A smugglers’ beacon'] },
  outpost: { r: 8, reach: 20, hint: 'An outpost', names: ['A refuelling outpost', 'A listening post', 'An abandoned mining platform'] },
  nebula: { r: 0, reach: 40, hint: 'A nebula', names: ['A pocket of nebula', 'A drift of glowing gas', 'The remains of a nova'] },
};
const KINDS = Object.keys(PLACE_KINDS);

// a seeded random sequence (rocks.js's)
const rng = (seed) => {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const seedOf = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const cache = new Map();
export function placesOf(sys) {
  if (cache.has(sys.id)) return cache.get(sys.id);
  const rand = rng(seedOf(sys.id));
  const n = 3 + Math.floor(rand() * 4);
  // the kinds, shuffled by the seed, the first n of them
  const kinds = [...KINDS];
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  const keep = [...hazardsOf(sys), ...(sys.parent ? [{ at: sys.parent.at, r: sys.parent.r * 1.6 }] : [])];
  const out = [];
  for (const kind of kinds.slice(0, n)) {
    const k = PLACE_KINDS[kind];
    for (let tries = 0; tries < 200; tries++) {
      const a = rand() * Math.PI * 2;
      const d = PLACES.inner + rand() * (PLACES.outer - PLACES.inner);
      const at = [Math.cos(a) * d, (rand() * 2 - 1) * PLACES.height, Math.sin(a) * d];
      const roomy = out.every((o) => dist(o.at, at) >= PLACES.apart) && keep.every((h) => dist(h.at, at) > h.r + k.reach + PLACES.clear);
      if (!roomy) continue;
      const name = k.names[Math.floor(rand() * k.names.length)];
      out.push({ id: `place-${kind}`, kind, name, hint: k.hint, at: at.map((v) => Math.round(v * 10) / 10), r: k.r, reach: k.reach, goal: true, place: true });
      break;
    }
  }
  cache.set(sys.id, out);
  return out;
}

// what's been found, read from the store: { sysId: [ids] }, or nothing
export function readFound(s) {
  if (typeof s !== 'string' || !s) return {};
  let v;
  try {
    v = JSON.parse(s);
  } catch {
    return {};
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out = {};
  for (const [id, ids] of Object.entries(v)) if (Array.isArray(ids)) out[id] = ids.filter((x) => typeof x === 'string');
  return out;
}

export function createFinds({ store = null } = {}) {
  const read = () => {
    try {
      return store?.get() ?? null;
    } catch {
      return null;
    }
  };
  const write = (v) => {
    try {
      store?.set(JSON.stringify(v));
    } catch {
      /* no store (private mode, say): the finds live for the page */
    }
  };
  const found = readFound(read());
  const of = (sysId) => {
    const sys = SYSTEMS.find((s) => s.id === sysId);
    return sys ? placesOf(sys).length : 0;
  };
  return {
    found: (sysId) => [...(found[sysId] ?? [])],
    has: (sysId, id) => Boolean(found[sysId]?.includes(id)),
    mark(sysId, id) {
      if (found[sysId]?.includes(id)) return false;
      (found[sysId] ??= []).push(id);
      write(found);
      return true;
    },
    count: (sysId) => ({ found: (found[sysId] ?? []).length, of: of(sysId) }),
    total: () => ({ found: Object.values(found).reduce((n, ids) => n + ids.length, 0), of: SYSTEMS.reduce((n, s) => n + placesOf(s).length, 0) }),
  };
}
