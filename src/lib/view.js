import { MOONS, UNIVERSES, byId } from '../components/universe/universes';

// The two ways to look round the site: the universe (the map, where every
// page is a place to fly to) and the classic site (the pages as pages). The
// front door (/) opens on whichever the visitor last picked, kept under
// START_KEY as 'universe' or 'home'; the switch in the nav moves between them
// from anywhere, landing on the same place in the other view.

export const START_KEY = 'tp-start';

export const isMapPath = (pathname) => pathname === '/' || pathname === '/universe' || pathname.startsWith('/universe/');

const CLASSIC = /^\/(home|experience|projects|resume|contact|travel|terminal)(\/|$)/;

// The view a page is in. The worlds belong to neither: they show the one the
// visitor picked (the universe until they pick, since that's where they open).
export function viewOf(pathname, start) {
  if (isMapPath(pathname)) return 'universe';
  if (CLASSIC.test(pathname)) return 'classic';
  return start === 'home' ? 'classic' : 'universe';
}

const under = (pathname, to) => pathname === to || pathname.startsWith(`${to}/`);

// The place on the map a page belongs to: its station, or its world's planet
// (however deep in it you are). The classic travel page is the travel planet.
// The Rick and Morty sector's planets come first: their worlds are under
// C-137's path (/c-137/squanch), but they're out in their own sector.
function placeFor(pathname) {
  if (under(pathname, '/travel')) return byId('travel');
  return MOONS.find((m) => under(pathname, m.to)) ?? UNIVERSES.find((u) => under(pathname, u.to) || u.pages?.some((p) => under(pathname, p.to)));
}

// Where the universe button goes from a page: its place on the map, picked.
export function universePathFor(pathname) {
  if (isMapPath(pathname)) return pathname === '/' ? '/universe' : pathname;
  const u = placeFor(pathname);
  return u ? `/universe/${u.id}` : '/universe';
}

// Where the classic button goes: a station's own page (and the travel
// planet's), the page you're on if it's already classic, the home page from
// anywhere else.
export function classicPathFor(pathname) {
  if (CLASSIC.test(pathname)) return pathname;
  const id = pathname.startsWith('/universe/') ? pathname.slice('/universe/'.length) : null;
  const u = id ? byId(id) : null;
  if (u?.kind === 'core') return u.to;
  if (u?.id === 'travel') return '/travel';
  return '/home';
}

// The visitor's pick, 'universe' or 'home' (null until they make one). A new
// pick is told to every switch on the page (and in other tabs, by storage).
export const VIEW_EVENT = 'tp:view';

export function readStart() {
  try {
    const v = JSON.parse(window.localStorage.getItem(START_KEY));
    return v === 'universe' || v === 'home' ? v : null;
  } catch {
    return null;
  }
}

export function saveStart(where) {
  try {
    window.localStorage.setItem(START_KEY, JSON.stringify(where));
  } catch {
    /* storage unavailable: the pick lasts this page */
  }
  window.dispatchEvent(new CustomEvent(VIEW_EVENT, { detail: where }));
}
