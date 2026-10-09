// The oath: which side of the galaxy's wars a pilot flies for (sides.js), as
// plain rules. Pure, tested; the page keeps it (localStorage SIDE_KEY, through
// lib/hooks' `local`), the holotable and the panel ask for it, warfront.js
// reads it for the team you're on. The design:
// docs/superpowers/specs/2026-10-07-gcw-allegiance-design.md (revision 3a).
//
// A pilot swears once a campaign in each war (an oath from a past campaign is
// forgotten, the war you fight in isn't), and may swear again to the other
// side: a turncoat, till the campaign's over. Nobody swears to the Hutts.
//
// { since: campaign, war: the war you fight in (your theatre), oaths: { war:
//   { side, sworn, turncoat } } }
// readAllegiance(raw, { now }) → a good one (raw a JSON string, an object or
//   nothing); writeAllegiance(a) → string; current(a) → { war, side, sworn,
//   turncoat }; oathIn(a, war) → the same for any war; swear(a, side, now) → a' (and its war the theatre);
//   setTheatre(a, war) → a'; suggestSide({ crew, hero }, war) → side | null;
//   teamFor(side, battle) → 0 | 1 | null.

import { campaignAt } from './gcw';
import { heroById } from './heroes';
import { DEFAULT_WAR, SIDES, WARS, warOfSide } from './sides';

export const SIDE_KEY = 'tp-gcw-side';

const unsworn = (war) => ({ war, side: null, sworn: 0, turncoat: false });

export function readAllegiance(raw, { now = Date.now() } = {}) {
  let v = raw;
  if (typeof raw === 'string') {
    try {
      v = JSON.parse(raw);
    } catch {
      v = null;
    }
  }
  const n = campaignAt(now).n;
  const ok = v && typeof v === 'object' && !Array.isArray(v);
  const war = ok && WARS[v.war] ? v.war : DEFAULT_WAR;
  const oaths = {};
  if (ok && v.since === n && v.oaths && typeof v.oaths === 'object')
    for (const [w, o] of Object.entries(v.oaths)) {
      if (!WARS[w] || !o || warOfSide(o.side) !== w) continue;
      const sworn = Number.isInteger(o.sworn) && o.sworn > 0 ? o.sworn : 1;
      oaths[w] = { side: o.side, sworn, turncoat: o.turncoat === true };
    }
  return { since: n, war, oaths };
}

export const writeAllegiance = (a) => JSON.stringify(a);

export const current = (a) => ({ ...unsworn(a.war), ...(a.oaths[a.war] ?? {}), war: a.war });
// your oath in a given war (the ground's war may not be your theatre), the same shape
export const oathIn = (a, war) => ({ ...unsworn(war), ...(a.oaths[war] ?? {}), war });

export function swear(a, side, now = Date.now()) {
  const war = warOfSide(side);
  if (!war) return a;
  const base = a.since === campaignAt(now).n ? a : { ...a, since: campaignAt(now).n, oaths: {} };
  const was = base.oaths[war];
  if (was?.side === side) return base.war === war ? base : { ...base, war };
  const oath = was ? { side, sworn: was.sworn + 1, turncoat: true } : { side, sworn: 1, turncoat: false };
  return { ...base, war, oaths: { ...base.oaths, [war]: oath } };
}

export const setTheatre = (a, war) => (WARS[war] && a.war !== war ? { ...a, war } : a);

// what the crew you fly with, or the hero you play as, would choose (shown,
// never chosen for you): the X-wing and the Falcon the war's light side, a
// hero by their own lean (an id in heroes.js, or an object with `lean`:
// a hero's `stance` there is how they hold a saber)
const CREW_LEAN = { xwing: 'light', falcon: 'light' };
export function suggestSide({ crew, hero } = {}, war = DEFAULT_WAR) {
  const w = WARS[war];
  if (!w) return null;
  const h = typeof hero === 'string' ? heroById(hero) : hero;
  const lean = h?.lean ?? CREW_LEAN[crew] ?? null;
  return lean === 'light' ? w.liberator : lean === 'dark' ? w.raider : null;
}

// the battle's team you're on: your side's place in gcw.js's battleAt `sides`
// (the light side 0, the dark 1, the Hutts in the other's place)
export function teamFor(side, battle) {
  if (!side || !SIDES[side] || !battle?.sides) return null;
  const i = battle.sides.indexOf(side);
  return i < 0 ? null : i;
}
