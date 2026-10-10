// What the people out on a world want, and whom they know (actors.js's
// `think` takes it from here): a wanderer with `needs` picks a place among
// the site's `wants` (lib/ai/utility's pick: the kinds it needs, nearer
// over farther, not the one it just left, not one it saw lately, a little
// chance), goes there and waits; one with `relations` runs from a kind it
// `fears` when it has seen it (18 m, in sight), and goes after one it
// `chases` (25 m). Pure.
//
// The wants are places (lib/ai/needs.js's): each has room for so many at
// once, each of them a spot of its own (two at a stall, a few round a
// plaza, one at a vaporator), and says how it's used once you're there: a
// clip played (a drink at the cantina's bar, a vaporator knelt at and
// fixed, a stall's counter leant on) or a base sat in, facing as it says.
// And each kind has a manner: how it takes a shot or a blast nearby (a
// townsman startles and scatters, a stall keeper ducks, a trooper stops
// and raises his blaster at it, a Tusken brandishes his gaffi stick), how
// it greets you, and whether it stops to talk with the others.
//
//   site.wants: [{ id, kind, at: [x, z], pause?, slots?, spots?: [[x, z]…],
//     clip?, base?, face? }]
//   spec.needs: [kind…]; spec.fears / spec.chases: [actor kind…];
//   spec.hears / spec.greets / spec.chats: its manner, where its kind's isn't right
//   placesOf(wants) → the wants as places, copies of them (made once a scene,
//     so whose slot is whose goes with it): need (its kind), slots (an open
//     place's a few, a thing's one), spots (a slot's own, round an open
//     place), duration (its pause, else 6 s)
//   pickWant(spec, wants, b, t, rand, { who }) → want | null   (b.visited[id]:
//     when it was last there; b.last: the one before; a place with no slot
//     free but `who`'s isn't picked, nor one in a zone it isn't in, or out of one it is)
//   relate(b, spec, others, t, { seesThrough }) → { flee | chase: { x, z }, until } | null  (and b.flee / b.chase set)
//   mannerOf(spec) → { hears: 'scatter' | 'raise' | 'brandish' | 'watch' | null,
//     greets: a clip | null, chats: bool }
//   hear(b, spec, { at: [x, z], loudness = 1 }, t, rand) → how it took it
//     (mannerOf's `hears`), or null when it didn't hear it (out of earshot,
//     40 m a loudness): b.hold (stood till then, turned to b.holdFace), and
//     a scatterer's b.flee ({ from, until, pace }) after it

import { consider, cooldown, curve, pick } from '../../../lib/ai/utility';
import { slotOf, taken } from '../../../lib/ai/needs';
import { SOLDIERS } from './ground/troops';

const REACH = 120; // metres: a want further off isn't wanted
const AGAIN = 240; // seconds before a want visited draws again
const FEAR = 18;
const FLEE = 6;
const CHASE = 25;
const AFTER = 6;

// ── the places ──
const OPEN = 4; // how many an open place (a plaza, a landing) holds, without saying
const ROUND = 1.6; // metres from an open place's middle its spots stand, round it
const USE = 6; // seconds a place is used, without saying

export function placesOf(wants) {
  return (wants ?? []).map((w) => {
    // (a thing to use, one at a time; somewhere open, a few, round its middle)
    const thing = Boolean(w.clip || w.base);
    const slots = w.slots ?? (thing ? 1 : OPEN);
    const spots =
      w.spots ??
      (slots > 1
        ? Array.from({ length: slots }, (_, i) => {
            const a = (i / slots) * Math.PI * 2 + 0.4;
            return [w.at[0] + Math.sin(a) * ROUND, w.at[1] + Math.cos(a) * ROUND];
          })
        : undefined);
    return { ...w, need: w.kind, slots, ...(spots ? { spots } : {}), duration: w.pause ?? USE };
  });
}

export function pickWant(spec, wants, b, t, rand = Math.random, { who = null } = {}) {
  const needs = spec?.needs;
  if (!needs?.length || !wants?.length) return null;
  // (full, and not one of its own)
  const full = (w) => w.slots != null && taken(w) >= w.slots && (who == null || slotOf(w, who) < 0);
  const options = wants
    .filter((w) => needs.includes(w.kind) && w.id !== b.last && !full(w) && (w.zone ?? null) === (spec.zone ?? null))
    .map((w) => ({
      id: w.id,
      want: w,
      considerations: [
        (c) => consider(Math.hypot(w.at[0] - c.x, w.at[1] - c.z), [0, REACH], curve.inverse),
        (c) => (c.visited[w.id] == null ? 1 : cooldown(c.t - c.visited[w.id], AGAIN)),
        () => 0.7 + 0.3 * rand(),
      ],
    }));
  const best = pick(options, { x: b.x, z: b.z, visited: b.visited ?? {}, t }, { momentum: 0, rand, spread: 0.1 });
  return best ? options.find((o) => o.id === best.id).want : null;
}

export function relate(b, spec, others, t, { seesThrough = null } = {}) {
  if (!spec?.fears?.length && !spec?.chases?.length) return null;
  const me = { x: b.x, z: b.z };
  const nearest = (kinds, within) => {
    let best = null;
    let bd = within;
    for (const o of others ?? []) {
      if (o === b || !kinds?.includes(o.kind)) continue;
      const d = Math.hypot(o.x - me.x, o.z - me.z);
      if (d < bd && (!seesThrough || seesThrough(me, { x: o.x, z: o.z }))) {
        bd = d;
        best = o;
      }
    }
    return best;
  };
  const feared = nearest(spec.fears, FEAR);
  if (feared) {
    b.flee = { from: [feared.x, feared.z], until: t + FLEE };
    return { flee: { x: feared.x, z: feared.z }, until: t + FLEE };
  }
  const prey = nearest(spec.chases, CHASE);
  if (prey) {
    b.chase = { to: [prey.x, prey.z], until: t + AFTER };
    return { chase: { x: prey.x, z: prey.z }, until: t + AFTER };
  }
  return null;
}

// ── manners ──
// The ones with a gun who stand their ground and raise it; the ones who
// lift what they carry over their heads (a Tusken's gaffi stick, a
// Gamorrean's axe); the ones who stand and look (the Force-users, the
// heroes, the Hutt); the beasts and machines nothing frightens. Everyone
// else startles and scatters.
// (SOLDIERS: ground/troops.js's, the one table)
const BRANDISH = new Set(['tusken', 'gamorrean']);
const STEADY = new Set(['jedi', 'yoda', 'kenobi', 'obiwan', 'quigon', 'ahsoka', 'shaakti', 'luke', 'leia', 'han', 'chewie', 'wookiee', 'lando', 'vader', 'maul', 'dooku', 'palpatine', 'inquisitor', 'hutt', 'jabba', 'hondo']);
const FEARLESS = new Set(['rancor', 'wampa', 'krayt', 'acklay', 'nexu', 'reek', 'sarlacc', 'atat', 'atst', 'atap', 'atte', 'probedroid', 'aiwha']);
const DROIDS = new Set(['droid', 'astromech', 'r2d2', 'mousedroid', 'gonk', 'c3po', 'probedroid']);

export function mannerOf(spec = {}) {
  const k = spec.kind;
  const hears = SOLDIERS.has(k) ? 'raise' : BRANDISH.has(k) ? 'brandish' : STEADY.has(k) ? 'watch' : FEARLESS.has(k) ? null : 'scatter';
  // a wave for you, from those with a word for you; a soldier's nod is a look; a Tusken's the stick held high
  const greets = BRANDISH.has(k) ? 'cheer' : SOLDIERS.has(k) || DROIDS.has(k) || FEARLESS.has(k) ? null : 'wave';
  const chats = !SOLDIERS.has(k) && !FEARLESS.has(k);
  return {
    hears: spec.hears !== undefined ? spec.hears : hears,
    greets: spec.greets !== undefined ? spec.greets : greets,
    chats: spec.chats !== undefined ? Boolean(spec.chats) : chats,
  };
}

const EARSHOT = 40; // metres a loudness of 1 (a blaster) carries
const STARTLE = [0.6, 1.0]; // seconds a scatterer stands, startled, before it runs
const SCATTER = [5, 8]; // seconds it runs for
const SCATTER_PACE = 2.2; // its walk's pace times this
const TURNED = [2.5, 4]; // seconds the rest stand turned toward it

export function hear(b, spec, { at, loudness = 1 } = {}, t = 0, rand = Math.random) {
  if (!b || !at) return null;
  if (Math.hypot(b.x - at[0], b.z - at[1]) > EARSHOT * loudness) return null;
  const how = mannerOf(spec).hears;
  if (!how) return null;
  // (one that stands where it was put stays there: it ducks, or turns its head)
  if (spec.still) return how;
  const span = ([lo, hi]) => lo + (hi - lo) * rand();
  if (how === 'scatter') {
    // (already running: on, and away from this one now)
    if (b.flee?.pace && t < b.flee.until) {
      b.flee.from = [at[0], at[1]];
      b.flee.until = Math.max(b.flee.until, t + span(SCATTER));
      return how;
    }
    b.hold = t + span(STARTLE);
    b.holdFace = null;
    b.flee = { from: [at[0], at[1]], until: b.hold + span(SCATTER), pace: SCATTER_PACE };
    b.to = null;
    b.wait = 0;
  } else {
    b.hold = t + span(TURNED);
    b.holdFace = Math.atan2(at[0] - b.x, at[1] - b.z);
  }
  return how;
}
