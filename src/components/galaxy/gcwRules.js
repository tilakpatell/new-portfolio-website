// The galaxy's war's ground rules, under the campaign (gcw.js) and the sides'
// strategy (gcwAI.js): its numbers (GCW), the systems it's fought over and
// which are next to which (NEIGHBOURS), the dice every pilot rolls alike
// (seeded), the tally's keys, the opening maps, and what a side's pressure on
// a system comes to (supply, areas, the Hutts). Pure, tested through gcw.js,
// which gives all of it out again: the rest of the galaxy imports gcw.js.

import { AREAS, SIDES, WARS } from './sides';
import { LANES, SYSTEMS } from './systems';

export const GCW = {
  start: Date.UTC(2026, 9, 1), // the first campaign's start (campaigns are counted from it)
  campaign: 3 * 24 * 3600e3, // a campaign: three days
  step: 12 * 60e3, // a step: a battle at each front, and its lull
  fight: 10 * 60e3, // of each step, the fighting
  fronts: 4, // fronts at once, at most
  attackEvery: 4 * 3600e3,
  attackFor: 8 * 12 * 60e3, // (eight steps: an hour and 36 minutes)
  raidEvery: 12 * 3600e3, // the Hutts', less often
  raidFor: 8 * 12 * 60e3,
  points: { objective: 3, kill: 0.1, turret: 0.5, win: 10, intercept: 1, ace: 2 }, // in hundredths of a system's control
  rate: [-2, 12], // %/hour the liberator's other fleets take off a front's hold
  majorRate: [-3, 6], // and a worthier system's, harder
  attackRate: [30, 75], // %/hour an attack takes off a system's hold (it falls past 62.5)
  raidRate: [20, 45], // and a Hutt raid
  hutts: 0.5, // what of a rate against Hutt space gets through (they buy whoever's going)
  supply: 0.5, // %/hour for each of the attacker's neighbours beyond the first, less each of the holder's
  areaBonus: 1, // %/hour for an area of the attacker's, whole, next to the system
  routeReach: 2.2, // grid squares: how near a route's point a system must be to be on it
  neighbours: 2, // the nearest few, besides the routes
  links: [
    ['kamino', 'lothal'],
    ['coruscant', 'naboo'],
  ],
};
export const HOURS_PER_STEP = GCW.step / 3600e3;

export const WAR_SYSTEMS = SYSTEMS.filter((s) => s.body && s.id !== 'dagobah').map((s) => s.id);
const BY_ID = Object.fromEntries(SYSTEMS.map((s) => [s.id, s]));

// what a system is to the war (systems.js's `war`, or what any is without one)
export const WAR_DEFAULT = Object.freeze({ worth: 1, weight: 1, kind: 'assault', area: null });
export const warInfo = (id) => ({ ...WAR_DEFAULT, ...(BY_ID[id]?.war ?? {}) });
export const worthOf = (id) => warInfo(id).worth;
export const areaOf = (id) => warInfo(id).area;

export const NEIGHBOURS = (() => {
  const out = Object.fromEntries(WAR_SYSTEMS.map((id) => [id, new Set()]));
  const join = (a, b) => a !== b && (out[a].add(b), out[b].add(a));
  const dist = (id, [x, z]) => Math.hypot(BY_ID[id].pos[0] - x, BY_ID[id].pos[1] - z);
  // the routes: each point's nearest war system (if one's near enough), joined in turn
  for (const lane of LANES) {
    let prev = null;
    for (const p of lane.pts) {
      const best = WAR_SYSTEMS.reduce((b, id) => (dist(id, p) < dist(b, p) ? id : b));
      if (dist(best, p) > GCW.routeReach) continue;
      if (prev) join(prev, best);
      prev = best;
    }
  }
  // and the nearest few, so nowhere's cut off
  for (const id of WAR_SYSTEMS)
    WAR_SYSTEMS.filter((o) => o !== id)
      .sort((a, b) => dist(a, BY_ID[id].pos) - dist(b, BY_ID[id].pos))
      .slice(0, GCW.neighbours)
      .forEach((o) => join(id, o));
  for (const [a, b] of GCW.links) join(a, b);
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v].sort()]));
})();

// the same numbers for the same thing, for every pilot
export function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
export function seeded(text) {
  let a = hash(text);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
export const within = ([a, b], r) => a + r * (b - a);

// ── The tally's keys: a side's points at a system in a step, and a battle it won there ──

export const pointsKey = (side, sys, step) => `${SIDES[side].code}:${sys}:${step}`;
export const winKey = (side, sys, step) => `win:${SIDES[side].code}:${sys}:${step}`;
// (the previous build's, `hoth:12` and `win:hoth:12`, were all the Rebellion's)
export const oldKey = (sys, step) => `${sys}:${step}`;
export const oldWinKey = (sys, step) => `win:${sys}:${step}`;

export function opening(war = 'gcw') {
  const w = WARS[war];
  const owner = {};
  const control = {};
  for (const id of WAR_SYSTEMS) {
    owner[id] = Object.entries(w.opening).find(([, ids]) => ids.includes(id))?.[0] ?? w.raider;
    control[id] = 1;
  }
  return { owner, control };
}

// the supply term for `attacker` at a system: its neighbours beyond the
// first help, the holder's beyond the first hold it back (%/hour)
export function supplyOf(id, owner, attacker) {
  const holder = owner[id];
  const count = (side) => NEIGHBOURS[id].filter((o) => owner[o] === side).length;
  return GCW.supply * (Math.max(0, count(attacker) - 1) - Math.max(0, count(holder) - 1));
}

// who holds each area, whole, if anyone does
export function areaHolders(owner) {
  const out = {};
  for (const a of AREAS) {
    const sides = new Set(WAR_SYSTEMS.filter((id) => areaOf(id) === a.id).map((id) => owner[id]));
    out[a.id] = sides.size === 1 ? [...sides][0] : null;
  }
  return out;
}
// an area of the attacker's, whole, next to a system it's after (%/hour)
export function areaBonusOf(id, owner, attacker, holders = areaHolders(owner)) {
  return NEIGHBOURS[id].some((o) => areaOf(o) !== areaOf(id) && holders[areaOf(o)] === attacker) ? GCW.areaBonus : 0;
}

// a rate against a system, as its holder feels it (the Hutts buy whoever's going)
export const pressureOn = (holder, rate) => rate * (holder === 'hutt' ? GCW.hutts : 1);
