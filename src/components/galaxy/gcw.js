// The galaxy's wars, as plain rules: Helldivers' war, in the galaxy far, far
// away. Pure (no three.js, no network), tested; the holotable shows them
// (HoloMap.jsx), the scene fights their battles (warfront.js), and what the
// players do is a tally every pilot online keeps alike (universe/tally.js).
// The design: docs/superpowers/specs/2026-10-06-fleet-war-design.md
// revision 2, and 2026-10-07-gcw-allegiance-design.md revision 3a.
//
// Three wars, one an era (sides.js's WARS: the Clone Wars, the Galactic Civil
// War, the Remnant War), fought at once over the same map: the galaxy's
// systems with a planet (but Dagobah: nobody's there), joined by the films'
// trade routes (systems.js's LANES) and the nearest two, and grouped in areas
// (sides.js's AREAS). In each a system has an `owner` (the war's liberator,
// its raider, or the Hutts) and `control`, the owner's hold of it: 1 whole,
// at 0 it's lost.
//
// A campaign runs GCW.campaign of the wall clock, from a start the same for
// everyone, then every war starts over from its opening map. It's worked
// through in steps of GCW.step from its start (history), so every pilot who
// knows the same tally has the same wars:
// - Fronts: a system of anyone but the liberator's, next to one of the
//   liberator's, is a front (the worthiest GCW.fronts of them, then the
//   campaign's own order: the first front is the major order). Its hold
//   falls at the liberator's other fleets' rate (seeded: some stall, some go
//   backwards), faster with more of the liberator's systems round it (supply)
//   and an area of the liberator's whole next to it; at 0 it's the
//   liberator's, whole.
// - Attacks: every GCW.attackEvery the raider attacks a system of the
//   liberator's or the Hutts' on its border (Hoth most of all: `weight`), and
//   every GCW.raidEvery the Hutts raid one of a main side's next to Hutt
//   space. An attacked system's hold falls at the attack's rate; at 0 it's
//   the attacker's, held to the end it's whole again.
// - What players did: points (a hundredth of a system's control each) for
//   each side, system and step (pointsKey), and the battles won there
//   (winKey), counted once however many pilots tell of them. A side's points
//   take a system's hold down unless it's the owner's, which put it back.
// - A war's over early when its liberator or its raider holds everything.
// Each front and attack has a battle on in each step (battleAt): GCW.fight of
// fighting, then a lull; its id and seed are the campaign's, the war's, the
// system's and the step's, so every pilot's is laid out alike.
//
// campaignAt(ms) → { n, epoch, start, end, step, stepStart };
// history(war, n, ms, value) → { war, owner, control, fronts, attacks, rates,
//   major, step, areas, over } (value(key) → the tally's value for a key);
// battleAt(state, id, ms) → { id, war, sys, seed, attacker, defender, sides
//   (by team: teamsOf), attackerTeam, start, fightEnd, end, fighting } or null;
// warTable(war, ms, value) → what the holotable shows; warTables(ms, value).

import { AREAS, SIDES, WARS, WAR_IDS, sideOfCode } from './sides';
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
const HOURS_PER_STEP = GCW.step / 3600e3;
const ATTACK_STEPS = GCW.attackEvery / GCW.step;
const RAID_STEPS = GCW.raidEvery / GCW.step;

export const WAR_SYSTEMS = SYSTEMS.filter((s) => s.body && s.id !== 'dagobah').map((s) => s.id);
const BY_ID = Object.fromEntries(SYSTEMS.map((s) => [s.id, s]));
const IN_WAR = new Set(WAR_SYSTEMS);

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
const within = ([a, b], r) => a + r * (b - a);

// ── The tally's keys: a side's points at a system in a step, and a battle it won there ──

export const pointsKey = (side, sys, step) => `${SIDES[side].code}:${sys}:${step}`;
export const winKey = (side, sys, step) => `win:${SIDES[side].code}:${sys}:${step}`;
// (the previous build's, `hoth:12` and `win:hoth:12`, were all the Rebellion's)
const oldKey = (sys, step) => `${sys}:${step}`;
const oldWinKey = (sys, step) => `win:${sys}:${step}`;
const sideWar = (side) => WAR_IDS.find((w) => WARS[w].liberator === side || WARS[w].raider === side) ?? null;

export function readKey(key) {
  const parts = typeof key === 'string' ? key.split(':') : [];
  const win = parts[0] === 'win';
  const rest = win ? parts.slice(1) : parts;
  let side;
  let sys;
  let step;
  if (rest.length === 3) [side, sys, step] = [sideOfCode(rest[0]), rest[1], rest[2]];
  else if (rest.length === 2) [side, sys, step] = ['rebel', rest[0], rest[1]];
  else return null;
  const war = sideWar(side);
  if (!war || !IN_WAR.has(sys) || !/^\d+$/.test(step)) return null;
  return { side, war, win, sys, step: Number(step) };
}

export function campaignAt(ms) {
  const n = Math.max(0, Math.floor((ms - GCW.start) / GCW.campaign));
  const start = GCW.start + n * GCW.campaign;
  const step = Math.max(0, Math.floor((ms - start) / GCW.step));
  return { n, epoch: `c${n}`, start, end: start + GCW.campaign, step, stepStart: start + step * GCW.step };
}

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
function areaHolders(owner) {
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

// a campaign's own order of the systems (the worthiest first), and its fronts' rates
function campaignPlan(war, n) {
  const rand = seeded(`gcw-${war}-${n}`);
  const order = WAR_SYSTEMS.map((id) => [id, rand()])
    .sort((a, b) => worthOf(b[0]) - worthOf(a[0]) || a[1] - b[1])
    .map(([id]) => id);
  const rates = {};
  for (const id of WAR_SYSTEMS) rates[id] = +within(worthOf(id) >= 2 ? GCW.majorRate : GCW.rate, seeded(`gcw-${war}-${n}-${id}`)()).toFixed(1);
  return { order, rates };
}
const plans = new Map();
const planOf = (war, n) => {
  const key = `${war}:${n}`;
  if (!plans.has(key)) {
    if (plans.size > 24) plans.clear();
    plans.set(key, campaignPlan(war, n));
  }
  return plans.get(key);
};

const frontsOf = (owner, order, liberator, attacked) =>
  order.filter((id) => owner[id] !== liberator && !attacked.has(id) && NEIGHBOURS[id].some((o) => owner[o] === liberator)).slice(0, GCW.fronts);

// an attack by `by`, at step k, on a system of `targets`' on its border (by weight)
function attackOn(war, n, k, owner, start, by, targets, attacked, span, range) {
  const border = WAR_SYSTEMS.filter((id) => targets.includes(owner[id]) && !attacked.has(id) && NEIGHBOURS[id].some((o) => owner[o] === by));
  if (!border.length) return null;
  const rand = seeded(`gcw-${war}-${n}-${by}-${k}`);
  const weight = (id) => warInfo(id).weight;
  let r = rand() * border.reduce((s, id) => s + weight(id), 0);
  let sys = border[border.length - 1];
  for (const id of border)
    if ((r -= weight(id)) <= 0) {
      sys = id;
      break;
    }
  const from = start + k * GCW.step;
  return { sys, by, from, until: from + span, rate: +within(range, rand()).toFixed(1) };
}

export function history(war, n, ms, value = () => 0) {
  const w = WARS[war];
  const { liberator, raider } = w;
  const { order, rates } = planOf(war, n);
  const start = GCW.start + n * GCW.campaign;
  const upto = Math.max(0, Math.min(GCW.campaign - 1, ms - start));
  const last = Math.floor(upto / GCW.step);
  const frac = (upto - last * GCW.step) / GCW.step;
  const { owner, control } = opening(war);
  const players = [liberator, raider];
  // a side's points at a system in a step, a battle won there counted once
  const pointsOf = (side, id, k) => {
    let p = value(pointsKey(side, id, k));
    let won = value(winKey(side, id, k)) >= 1;
    if (side === 'rebel') {
      p += value(oldKey(id, k));
      won = won || value(oldWinKey(id, k)) >= 1;
    }
    return p / 100 + (won ? GCW.points.win / 100 : 0);
  };
  let attacks = [];
  let fronts = [];
  let over = null;
  let step = last;
  for (let k = 0; k <= last; k++) {
    const f = k < last ? 1 : frac;
    const hours = HOURS_PER_STEP * f;
    const busy = () => new Set(attacks.map((a) => a.sys));
    if (k > 0 && k % ATTACK_STEPS === 0 && !attacks.some((a) => a.by === raider)) {
      const a = attackOn(war, n, k, owner, start, raider, [liberator, 'hutt'], busy(), GCW.attackFor, GCW.attackRate);
      if (a) attacks.push(a);
    }
    if (k > 0 && k % RAID_STEPS === 0 && !attacks.some((a) => a.by === 'hutt')) {
      const a = attackOn(war, n, k, owner, start, 'hutt', [liberator, raider], busy(), GCW.raidFor, GCW.raidRate);
      if (a) attacks.push(a);
    }
    fronts = frontsOf(owner, order, liberator, busy());
    const holders = areaHolders(owner);
    const was = { ...owner };
    for (const id of WAR_SYSTEMS) {
      const holder = was[id];
      const pts = Object.fromEntries(players.map((side) => [side, pointsOf(side, id, k)]));
      const against = players.filter((side) => side !== holder).reduce((s, side) => s + pts[side], 0);
      let fall = against - (pts[holder] ?? 0);
      const attack = attacks.find((a) => a.sys === id);
      const by = attack ? attack.by : fronts.includes(id) ? liberator : null;
      if (by) {
        const rate = pressureOn(holder, (attack ? attack.rate : rates[id]) + supplyOf(id, was, by) + areaBonusOf(id, was, by, holders));
        fall += (rate / 100) * hours;
      }
      control[id] = Math.min(1, control[id] - fall);
      if (control[id] > 0) continue;
      // lost: to whoever was after it (or whose pilots did most)
      const taker = by ?? players.filter((side) => side !== holder).sort((a, b) => pts[b] - pts[a])[0];
      owner[id] = taker;
      control[id] = 1;
      attacks = attacks.filter((a) => a.sys !== id);
    }
    // an attack's over: held to the end, the system's whole again
    if (f === 1)
      attacks = attacks.filter((a) => {
        if (start + (k + 1) * GCW.step < a.until) return true;
        control[a.sys] = 1;
        return false;
      });
    const all = new Set(WAR_SYSTEMS.map((id) => owner[id]));
    if (all.size === 1 && players.includes([...all][0])) {
      over = [...all][0];
      step = k;
      fronts = [];
      attacks = [];
      break;
    }
  }
  for (const id of WAR_SYSTEMS) control[id] = +control[id].toFixed(6);
  const holders = areaHolders(owner);
  const areas = {};
  for (const a of AREAS) {
    const r = { total: 0, holder: holders[a.id] };
    for (const id of WAR_SYSTEMS)
      if (areaOf(id) === a.id) {
        r.total += 1;
        r[owner[id]] = (r[owner[id]] ?? 0) + 1;
      }
    areas[a.id] = r;
  }
  return { war, owner, control, fronts, attacks, rates, major: fronts[0] ?? null, step, areas, over };
}

// a battle's two sides by team, as the battle engine and the set pieces have
// them: the light side 0, the dark 1, the Hutts in the place of whichever
// isn't there
export function teamsOf(a, b) {
  const light = [a, b].find((x) => SIDES[x].stance === 'light') ?? null;
  const dark = [a, b].find((x) => SIDES[x].stance === 'dark') ?? null;
  return light && dark ? [light, dark] : light ? [light, 'hutt'] : ['hutt', dark];
}

export function battleAt(state, sys, ms) {
  const attack = state.attacks.find((a) => a.sys === sys);
  if (!attack && !state.fronts.includes(sys)) return null;
  const c = campaignAt(ms);
  const id = `${c.epoch}.${state.war}.${sys}.${c.step}`;
  const attacker = attack ? attack.by : WARS[state.war].liberator;
  const defender = state.owner[sys];
  const sides = teamsOf(attacker, defender);
  return {
    id,
    war: state.war,
    sys,
    step: c.step,
    seed: hash(id),
    attacker,
    defender,
    sides,
    attackerTeam: sides.indexOf(attacker),
    start: c.stepStart,
    fightEnd: c.stepStart + GCW.fight,
    end: c.stepStart + GCW.step,
    fighting: ms < c.stepStart + GCW.fight,
  };
}

export function warTable(war, ms, value = () => 0) {
  const c = campaignAt(ms);
  const s = history(war, c.n, ms, value);
  return {
    war,
    campaign: c.n,
    epoch: c.epoch,
    ends: c.end,
    step: c.step,
    major: s.major,
    areas: s.areas,
    over: s.over,
    systems: WAR_SYSTEMS.map((id) => {
      const attack = s.attacks.find((a) => a.sys === id) ?? null;
      const front = s.fronts.includes(id);
      const info = warInfo(id);
      return {
        id,
        name: BY_ID[id].name,
        owner: s.owner[id],
        control: s.control[id],
        front,
        major: s.major === id,
        attack,
        rate: front ? s.rates[id] : attack ? attack.rate : null,
        worth: info.worth,
        kind: info.kind,
        area: info.area,
        battle: battleAt(s, id, ms),
      };
    }),
  };
}

export const warTables = (ms, value = () => 0) => Object.fromEntries(WAR_IDS.map((war) => [war, warTable(war, ms, value)]));
