// Where on the site a pilot is, as the other pilots see it: a page key
// (the universe map is one place whatever's picked on it, Middle-earth's
// places are one, and so are the roles on the experience page; each of the
// galaxy's star systems is a place of its own, so you meet the pilots in
// the system you're in), checked when it comes in, and named for the roster
// ("on Middle-earth", "at Hoth").

import { byPath } from '../universes';
import { GALAXY, SYSTEM_NAMES, inGalaxyFlight, systemOfPath } from '../../galaxy/names';

export const UNIVERSE = '/universe';

export function whereOf(pathname) {
  if (pathname === '/' || pathname.startsWith('/universe')) return UNIVERSE;
  if (pathname.startsWith('/middle-earth')) return '/middle-earth';
  if (pathname.startsWith('/experience')) return '/experience';
  return pathname;
}

// somewhere you fly (the universe map, or a system in the galaxy): the other
// pilots there are ships, not pointers on a page
export const isFlight = (where) => where === UNIVERSE || inGalaxyFlight(where);

// a page key as it came in, or null if it isn't one
export function cleanWhere(raw) {
  if (typeof raw !== 'string' || raw.length > 64 || !/^\/[a-z0-9/-]*$/.test(raw)) return null;
  return raw;
}

const NAMES = { [UNIVERSE]: 'the universe', [GALAXY]: 'a galaxy far, far away', '/deathstar': 'the Death Star', '/projects': 'Projects', '/travel': 'Travel', '/resume': 'the résumé' };

export function placeName(where) {
  if (!where) return 'somewhere';
  if (NAMES[where]) return NAMES[where];
  const sys = systemOfPath(where);
  if (sys) return inGalaxyFlight(where) ? SYSTEM_NAMES[sys] : where.endsWith('/surface') ? `down on ${SYSTEM_NAMES[sys]}` : `the ${SYSTEM_NAMES[sys]} briefing`;
  const u = byPath(where);
  if (u) return u.world ?? u.place ?? u.label;
  if (where.startsWith('/projects/')) return 'a project';
  const word = where.slice(1).split('/')[0].replace(/-/g, ' ');
  return word ? word[0].toUpperCase() + word.slice(1) : 'the front door';
}
