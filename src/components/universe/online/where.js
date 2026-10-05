// Where on the site a pilot is, as the other pilots see it: a page key
// (the universe map is one place whatever's picked on it, Middle-earth's
// places are one, and so are the roles on the experience page), checked
// when it comes in, and named for the roster ("on Middle-earth").

import { byPath } from '../universes';

export const UNIVERSE = '/universe';

export function whereOf(pathname) {
  if (pathname === '/' || pathname.startsWith('/universe')) return UNIVERSE;
  if (pathname.startsWith('/middle-earth')) return '/middle-earth';
  if (pathname.startsWith('/experience')) return '/experience';
  return pathname;
}

// a page key as it came in, or null if it isn't one
export function cleanWhere(raw) {
  if (typeof raw !== 'string' || raw.length > 64 || !/^\/[a-z0-9/-]*$/.test(raw)) return null;
  return raw;
}

const NAMES = { [UNIVERSE]: 'the universe', '/projects': 'Projects', '/travel': 'Travel', '/resume': 'the résumé' };

export function placeName(where) {
  if (!where) return 'somewhere';
  if (NAMES[where]) return NAMES[where];
  const u = byPath(where);
  if (u) return u.world ?? u.place ?? u.label;
  if (where.startsWith('/projects/')) return 'a project';
  const word = where.slice(1).split('/')[0].replace(/-/g, ' ');
  return word ? word[0].toUpperCase() + word.slice(1) : 'the front door';
}
