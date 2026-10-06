// The Galactic Civil War, as plain rules: Helldivers' war, in the galaxy far,
// far away. Pure (no three.js, no network), tested; the holotable shows it
// (HoloMap.jsx), the scene fights its battles (warfront.js), and what the
// players do is a tally every pilot online keeps alike (universe/tally.js).
// The design: docs/superpowers/specs/2026-10-06-fleet-war-design.md,
// revision 2.
//
// Every pilot flies for the Rebellion, against the Empire. The war's map is
// the galaxy's systems with a planet (but Dagobah: nobody's there), each with
// the Rebellion's `control` of it, from 0 (the Empire's) to 1 (the
// Rebellion's), and its neighbours (the nearest few on the map, both ways,
// and a couple of hyperlanes that join the north to the south).
//
// A campaign runs GCW.campaign of the wall clock, from a start the same for
// everyone, then the war starts over from the opening map. It's worked
// through in steps of GCW.step from its start (history), so every pilot who
// knows the same tally has the same war:
// - Fronts: an Imperial system next to a Rebel one is a front (the first
//   GCW.fronts of them in the campaign's order, the set pieces' systems
//   first: the first front is the major order). Its control moves by the
//   Rebellion's other fleets' rate (seeded for the campaign and the system:
//   some stall, some go backwards) and by what players did there; at 1 it's
//   the Rebellion's.
// - Attacks: every GCW.attackEvery (four hours) the Empire attacks a Rebel system that
//   borders its own (Hoth most of all), for GCW.attackFor. Its control falls
//   at the attack's rate, and players push it back up; at 0 it's the
//   Empire's, held to the end it's the Rebellion's again, whole.
// - What players did: points (a hundredth of a system's control each) for
//   each system and step (pointsKey), and the battles won there (winKey),
//   counted once however many pilots tell of them.
// Each front and attack has a battle on in each step (battleAt): GCW.fight of
// fighting, then a lull; its id and seed are the campaign's, the system's and
// the step's, so every pilot's is laid out alike.
//
// campaignAt(ms) → { n, epoch, start, end, step, stepStart };
// history(n, ms, value) → { owner, control, fronts, attack, rates, major, step }
//   (value(key) → the tally's value for a key);
// battleAt(state, id, ms) → { id, key, sys, seed, attacker, start, fightEnd,
//   end, fighting } or null; warTable(ms, value) → what the holotable shows.

import { SYSTEMS } from './systems';

export const GCW = {
  start: Date.UTC(2026, 9, 1), // the first campaign's start (campaigns are counted from it)
  campaign: 3 * 24 * 3600e3, // a campaign: three days
  step: 12 * 60e3, // a step: a battle at each front, and its lull
  fight: 10 * 60e3, // of each step, the fighting
  fronts: 4, // fronts at once, at most
  attackEvery: 4 * 3600e3,
  attackFor: 8 * 12 * 60e3, // (eight steps: an hour and 36 minutes)
  points: { objective: 3, kill: 0.1, win: 10 }, // in hundredths of a system's control
  rate: [-2, 12], // %/hour the Rebellion's other fleets move a front by
  majorRate: [-3, 6], // and a set piece's, harder
  attackRate: [30, 75], // %/hour an attack takes off a system's control (it falls past 62.5)
  opening: ['yavin', 'hoth', 'lothal', 'kashyyyk', 'sorgan'],
  majors: ['endor', 'scarif', 'hoth', 'coruscant', 'yavin'], // the set pieces' systems, first in the order
  neighbours: 3,
  links: [
    ['kamino', 'lothal'],
    ['coruscant', 'naboo'],
  ],
};
const HOURS_PER_STEP = GCW.step / 3600e3;
const ATTACK_STEPS = GCW.attackEvery / GCW.step;

export const WAR_SYSTEMS = SYSTEMS.filter((s) => s.body && s.id !== 'dagobah').map((s) => s.id);
const BY_ID = Object.fromEntries(SYSTEMS.map((s) => [s.id, s]));

export const NEIGHBOURS = (() => {
  const out = Object.fromEntries(WAR_SYSTEMS.map((id) => [id, new Set()]));
  const join = (a, b) => (out[a].add(b), out[b].add(a));
  for (const id of WAR_SYSTEMS) {
    const p = BY_ID[id].pos;
    WAR_SYSTEMS.filter((o) => o !== id)
      .map((o) => [o, Math.hypot(BY_ID[o].pos[0] - p[0], BY_ID[o].pos[1] - p[1])])
      .sort((a, b) => a[1] - b[1])
      .slice(0, GCW.neighbours)
      .forEach(([o]) => join(id, o));
  }
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

export const pointsKey = (sys, step) => `${sys}:${step}`;
export const winKey = (sys, step) => `win:${sys}:${step}`;

export function campaignAt(ms) {
  const n = Math.max(0, Math.floor((ms - GCW.start) / GCW.campaign));
  const start = GCW.start + n * GCW.campaign;
  const step = Math.max(0, Math.floor((ms - start) / GCW.step));
  return { n, epoch: `c${n}`, start, end: start + GCW.campaign, step, stepStart: start + step * GCW.step };
}

export function opening() {
  const owner = {};
  const control = {};
  for (const id of WAR_SYSTEMS) {
    const rebel = GCW.opening.includes(id);
    owner[id] = rebel ? 'rebel' : 'empire';
    control[id] = rebel ? 1 : 0;
  }
  return { owner, control };
}

// a campaign's own order of the systems (the set pieces' first), and its fronts' rates
function campaignPlan(n) {
  const rand = seeded(`gcw-${n}`);
  const majors = GCW.majors.filter((id) => WAR_SYSTEMS.includes(id)).map((id) => [id, rand()]);
  const rest = WAR_SYSTEMS.filter((id) => !GCW.majors.includes(id)).map((id) => [id, rand()]);
  const order = [...majors.sort((a, b) => a[1] - b[1]), ...rest.sort((a, b) => a[1] - b[1])].map(([id]) => id);
  const rates = {};
  for (const id of WAR_SYSTEMS) rates[id] = +within(GCW.majors.includes(id) ? GCW.majorRate : GCW.rate, seeded(`gcw-${n}-${id}`)()).toFixed(1);
  return { order, rates };
}
const plans = new Map();
const planOf = (n) => {
  if (!plans.has(n)) {
    if (plans.size > 8) plans.clear();
    plans.set(n, campaignPlan(n));
  }
  return plans.get(n);
};

const frontsOf = (owner, order) => order.filter((id) => owner[id] === 'empire' && NEIGHBOURS[id].some((o) => owner[o] === 'rebel')).slice(0, GCW.fronts);

// the Empire's next attack, at step k: on a Rebel system on its border (Hoth most of all)
function attackAt(n, k, owner, start) {
  const border = WAR_SYSTEMS.filter((id) => owner[id] === 'rebel' && NEIGHBOURS[id].some((o) => owner[o] === 'empire'));
  if (!border.length) return null;
  const rand = seeded(`gcw-${n}-attack-${k}`);
  const weight = (id) => (id === 'hoth' ? 4 : 1);
  let r = rand() * border.reduce((s, id) => s + weight(id), 0);
  let sys = border[border.length - 1];
  for (const id of border) if ((r -= weight(id)) <= 0) {
    sys = id;
    break;
  }
  const from = start + k * GCW.step;
  return { sys, from, until: from + GCW.attackFor, rate: +within(GCW.attackRate, rand()).toFixed(1) };
}

export function history(n, ms, value = () => 0) {
  const { order, rates } = planOf(n);
  const start = GCW.start + n * GCW.campaign;
  const upto = Math.max(0, Math.min(GCW.campaign - 1, ms - start));
  const last = Math.floor(upto / GCW.step);
  const frac = (upto - last * GCW.step) / GCW.step;
  const { owner, control } = opening();
  let attack = null;
  let fronts = [];
  for (let k = 0; k <= last; k++) {
    const f = k < last ? 1 : frac;
    if (!attack && k > 0 && k % ATTACK_STEPS === 0) attack = attackAt(n, k, owner, start);
    fronts = frontsOf(owner, order);
    for (const id of WAR_SYSTEMS) {
      const pts = value(pointsKey(id, k)) / 100 + (value(winKey(id, k)) >= 1 ? GCW.points.win / 100 : 0);
      if (owner[id] === 'rebel') {
        if (attack?.sys !== id) continue;
        control[id] = Math.min(1, control[id] + pts - (attack.rate / 100) * HOURS_PER_STEP * f);
        if (control[id] <= 0) {
          owner[id] = 'empire';
          control[id] = 0;
          attack = null;
        }
        continue;
      }
      control[id] += pts + (fronts.includes(id) ? (rates[id] / 100) * HOURS_PER_STEP * f : 0);
      control[id] = Math.max(0, Math.min(1, control[id]));
      if (control[id] >= 1) {
        owner[id] = 'rebel';
        control[id] = 1;
      }
    }
    // the attack's over: held to the end, the system's whole again
    if (attack && f === 1 && start + (k + 1) * GCW.step >= attack.until) {
      control[attack.sys] = 1;
      attack = null;
    }
  }
  for (const id of WAR_SYSTEMS) control[id] = +control[id].toFixed(6);
  return { owner, control, fronts, attack, rates, major: fronts[0] ?? null, step: last };
}

export function battleAt(state, sys, ms) {
  const attacked = state.attack?.sys === sys;
  if (!attacked && !state.fronts.includes(sys)) return null;
  const c = campaignAt(ms);
  const id = `${c.epoch}.${sys}.${c.step}`;
  return {
    id,
    sys,
    step: c.step,
    seed: hash(id),
    attacker: attacked ? 'empire' : 'rebel',
    start: c.stepStart,
    fightEnd: c.stepStart + GCW.fight,
    end: c.stepStart + GCW.step,
    fighting: ms < c.stepStart + GCW.fight,
  };
}

export function warTable(ms, value = () => 0) {
  const c = campaignAt(ms);
  const s = history(c.n, ms, value);
  return {
    campaign: c.n,
    epoch: c.epoch,
    ends: c.end,
    step: c.step,
    major: s.major,
    systems: WAR_SYSTEMS.map((id) => {
      const attack = s.attack?.sys === id ? s.attack : null;
      const front = s.fronts.includes(id);
      return {
        id,
        name: BY_ID[id].name,
        owner: s.owner[id],
        control: s.control[id],
        front,
        major: s.major === id,
        attack,
        rate: front ? s.rates[id] : attack ? -attack.rate : null,
        battle: battleAt(s, id, ms),
      };
    }),
  };
}
