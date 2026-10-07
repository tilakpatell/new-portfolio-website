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
import { systemById } from './systems';
import { GCW, HOURS_PER_STEP, NEIGHBOURS, WAR_SYSTEMS, areaBonusOf, areaHolders, areaOf, hash, oldKey, oldWinKey, opening, pointsKey, pressureOn, seeded, supplyOf, warInfo, winKey, within, worthOf } from './gcwRules';

// (the ground rules are gcwRules.js's; the rest of the galaxy has them from here)
export { GCW, NEIGHBOURS, WAR_DEFAULT, WAR_SYSTEMS, areaBonusOf, areaOf, hash, opening, pointsKey, pressureOn, seeded, supplyOf, warInfo, winKey, worthOf } from './gcwRules';

const ATTACK_STEPS = GCW.attackEvery / GCW.step;
const RAID_STEPS = GCW.raidEvery / GCW.step;
const IN_WAR = new Set(WAR_SYSTEMS);

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
        name: systemById(id).name,
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
