// What people want, and the places that give it: the galaxy's
// surface/needs.js generalised (the spec's "needs.js: what people want").
// A person has needs that rise over time (rest, food, company, work, a
// look at the view), each at its own rate. A place advertises what it
// gives and how it's used: a bench gives rest, sat on, two at a time; a bar
// food, with a drink; a droid work, knelt at. A person picks a place by
// utility's pick (how much the need presses, how far it is, a little
// momentum for where it's already going, a little chance), reserves a slot,
// walks there, faces as the place says, plays its clip for the duration,
// and its need falls. A world's sky clock gives a schedule on top (the
// Citadel's workers to the factory by day, the cantina full at night).
// Off by default: a world opts in with its places. Pure, no three.js.
//
//   createNeeds({ needs: { [need]: rate a second }, rand, start }) → { level(need),
//     levels(), tick(dt), satisfy(need, amount = 1) }   levels 0…1, each starting
//     where its seed puts it (start: { [need]: level } to say)
//   pickPlace(person, places, { t, schedule, rand, current, reach }) → place | null
//     person: { id?, x, z, needs (a createNeeds, or { [need]: level }), last? (the
//     place it just left: not straight back) }; t: the world's sky hour (0…24),
//     what the schedule reads; current: the place it's going to (momentum)
//   place: { id, at: [x, z], need, slots, clip, base?, duration, face?, spots? }
//     spots: [[x, z]…] a slot's own spot (two on a bench), else everyone at `at`
//   schedule: [{ from, to, want }] in the sky's hours (from 21 to 3 wraps past
//     midnight); want: a need, or a place's id. While it holds, places that
//     give it press as hard as a need can, and the rest count for less
//   wantAt(schedule, t) → want | null
//   reserve(place, who) → bool (false: full), release(place, who?) (no who:
//     everyone), taken(place) → how many, slotOf(place, who) → index | −1,
//   spotOf(place, who) → [x, z]
//
// Reservations are kept beside the places (a WeakMap), not in them: a world
// makes its places when its scene is made (a copy of its table, not the
// table), so the reservations go when it does.

import { seeded } from '../seeded';
import { clamp } from './vec';
import { consider, curve, pick } from './utility';

const FLOOR = 0.15; // a need under this doesn't send anyone anywhere
const NEAR = 20; // metres: a place this far counts half as much as one here
const REACH = 90; // metres: further than this isn't worth the walk
const MOMENTUM = 0.25; // where it's already going, over a near equal
const OFF_HOURS = 0.35; // what the rest count for while the schedule wants something
const START = 0.6; // a seeded start: up to this full

export function createNeeds({ needs = {}, rand = seeded(1), start = null } = {}) {
  const rates = { ...needs };
  const at = {};
  for (const k of Object.keys(rates)) at[k] = clamp(start?.[k] ?? rand() * START, 0, 1);
  return {
    rates,
    level: (need) => at[need] ?? 0,
    levels: () => ({ ...at }),
    tick(dt) {
      if (!(dt > 0)) return;
      for (const k of Object.keys(at)) at[k] = Math.min(1, at[k] + rates[k] * dt);
    },
    satisfy(need, amount = 1) {
      if (at[need] == null) return;
      at[need] = Math.max(0, at[need] - amount);
    },
  };
}

// the want the schedule has at this hour, if any
export function wantAt(schedule, t) {
  if (!schedule?.length || !Number.isFinite(t)) return null;
  const h = ((t % 24) + 24) % 24;
  for (const s of schedule) {
    const inside = s.from <= s.to ? h >= s.from && h < s.to : h >= s.from || h < s.to;
    if (inside) return s.want ?? null;
  }
  return null;
}

// ── who's where ──
const held = new WeakMap(); // place → [who | undefined…], by slot
const slotsOf = (place) => {
  let s = held.get(place);
  if (!s) held.set(place, (s = []));
  return s;
};
export const slotOf = (place, who) => (held.get(place) ?? []).indexOf(who);
export const taken = (place) => (held.get(place) ?? []).filter((w) => w !== undefined).length;
export function reserve(place, who) {
  const s = slotsOf(place);
  if (s.includes(who)) return true;
  const n = Math.max(0, place.slots ?? 1);
  for (let i = 0; i < n; i++)
    if (s[i] === undefined) {
      s[i] = who;
      return true;
    }
  return false;
}
export function release(place, who) {
  const s = held.get(place);
  if (!s) return;
  if (who === undefined) held.delete(place);
  else {
    const i = s.indexOf(who);
    if (i >= 0) s[i] = undefined;
  }
}
export function spotOf(place, who) {
  const i = slotOf(place, who);
  return (i >= 0 && place.spots?.[i]) || place.at;
}

const levelOf = (needs, need) => (typeof needs?.level === 'function' ? needs.level(need) : (needs?.[need] ?? 0));

export function pickPlace(person, places, { t = null, schedule = null, rand = null, current = null, reach = REACH } = {}) {
  if (!person || !places?.length) return null;
  const want = wantAt(schedule, t);
  const me = person.id ?? person;
  const options = [];
  for (const p of places) {
    if (!p?.at || p.id === person.last) continue;
    const mine = slotOf(p, me) >= 0;
    if (!mine && taken(p) >= (p.slots ?? 1)) continue;
    const d = Math.hypot(p.at[0] - person.x, p.at[1] - person.z);
    if (d > reach) continue;
    // the schedule's want presses as hard as a need can; the rest count for less while it holds
    const wanted = want != null && (p.need === want || p.id === want);
    const level = wanted ? 1 : levelOf(person.needs, p.need) * (want != null ? OFF_HOURS : 1);
    if (!wanted && levelOf(person.needs, p.need) < FLOOR) continue;
    options.push({
      id: p.id,
      place: p,
      considerations: [() => consider(level, [0, 1], curve.linear), () => 1 / (1 + d / NEAR), ...(rand ? [() => 0.85 + 0.15 * rand()] : [])],
    });
  }
  if (!options.length) return null;
  const best = pick(options, null, { current: current ?? null, momentum: MOMENTUM, rand, spread: rand ? 0.08 : 0 });
  return best ? options.find((o) => o.id === best.id).place : null;
}
