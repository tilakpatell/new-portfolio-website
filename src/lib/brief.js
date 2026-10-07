import { guideKeyFor } from '../components/guide/routes';

// A world's basics (components/tour/briefs.js): the first time you arrive in
// a world, before you're dropped in, the tour's cards say what it is, how to
// move, how to do things and what to go for. Keyed as the guide is
// (guide/routes), so every stop on Middle-earth's road shares one and every
// star system the galaxy's. Small on purpose: the shell needs it from the
// first page, while what each says loads with the tour.

export const BRIEF_KEY = 'tp-briefs'; // the worlds whose basics have been shown
export const BRIEF_EVENT = 'tp:brief';

// The worlds with basics (the keys of briefs.js's BRIEFS: its test checks).
export const BRIEFED = new Set([
  '/galaxy',
  '/galaxy/surface',
  '/deathstar',
  '/caribbean',
  '/invincible',
  '/middle-earth',
  '/middle-earth/place',
  '/avengers',
  '/scranton',
  '/cybertron',
  '/albuquerque',
  '/c-137',
  '/c-137/citadel',
  '/dot-matrix',
  '/dot-matrix/64',
  '/earth',
  '/music',
]);

// the world's basics a path gets, or null
export function briefKeyFor(pathname) {
  const key = guideKeyFor(pathname);
  return key && BRIEFED.has(key) ? key : null;
}

// Shown on a first arrival: not if they've been shown here before, and not
// to a browser driven by a script (the shot and check scripts walk straight
// in; the guide's button still shows them).
export function briefHere(key, seen, driven = false) {
  if (!key || driven) return false;
  return !(Array.isArray(seen) && seen.includes(key));
}

// the list with this world in it (the last sixty, as the guide's notes)
export const sawBrief = (seen, key) => [...(Array.isArray(seen) ? seen.filter((k) => k !== key) : []), key].slice(-60);

// Shows the basics of the world you're in again (the guide's button).
export const openBrief = () => window.dispatchEvent(new Event(BRIEF_EVENT));
