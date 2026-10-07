import { isMapPath } from './view';

// The tour of the site (components/tour): which one a page gets, when a
// first arrival is offered it, which of its stops show on this screen, and
// where its card goes beside the thing it's pointing at; and the audience
// tours (the recruiter's, the player's, the whole one) that cross pages:
// their plan, what they remember, the link that starts one, and when a stop
// on a page just opened is ready to show. See
// docs/superpowers/specs/2026-10-07-site-tour-design.md and
// docs/superpowers/specs/2026-10-07-audience-tours-and-ui-audit-design.md.

export const TOUR_KEY = 'tp-tour'; // what readProgress reads; unset until the offer's made
export const TOUR_EVENT = 'tp:tour';
export const AUDIENCES = ['recruiter', 'player', 'mixed'];
// what each is called wherever it's offered, and how long it takes (spec 3.1)
export const TOUR_NAMES = { recruiter: 'The recruiter’s tour', player: 'The player’s tour', mixed: 'The whole tour' };
export const TOUR_TIMES = { recruiter: 'About 5 minutes', player: 'About 7 minutes', mixed: 'About 10 minutes' };

// Starts a tour from anywhere: ⌘K, the guide, the terminal, the offer, the
// checklist. With no detail, the tour of the view you're in, as before; with
// { audience, chapter?, stop?, todo? }, that audience's, from there.
export const openTour = (detail) => window.dispatchEvent(new CustomEvent(TOUR_EVENT, detail ? { detail } : undefined));

// What tp-tour holds: { offered, audience?, chapter?, stop?, done: [...] },
// where to carry on from and the tours finished ('view' for the old one).
// Visits before the audience tours kept a word ('offered', 'done',
// 'skipped'); those still read. Unset reads as null, which is what makes
// the offer; anything else unreadable reads as offered, so a bad value
// never offers it again and again.
export function readProgress(raw) {
  if (raw == null) return null;
  if (raw === 'done') return { offered: true, done: ['view'] };
  if (typeof raw !== 'object' || Array.isArray(raw)) return { offered: true, done: [] };
  const done = Array.isArray(raw.done) ? raw.done.filter((d) => typeof d === 'string') : [];
  const p = { offered: true };
  if (AUDIENCES.includes(raw.audience)) {
    p.audience = raw.audience;
    if (typeof raw.chapter === 'string') p.chapter = raw.chapter;
    if (typeof raw.stop === 'string') p.stop = raw.stop;
  }
  p.done = done;
  return p;
}

// The progress after `patch`: a stop written over the last, a finished tour
// added once; an undefined field in the patch forgets it.
export function writeProgress(prev, patch) {
  const was = readProgress(prev) ?? { offered: true, done: [] };
  const next = { ...was, ...patch, offered: true, done: [...new Set([...was.done, ...(patch.done ?? [])])] };
  for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
  return readProgress(next);
}

// The audience tour left part way, for the guide's "Carry on…", or null.
// (Finishing forgets where it was, so one kept is part way, even of a tour
// finished once before.)
export const unfinished = (p) => (p?.audience && p.chapter ? { audience: p.audience, chapter: p.chapter } : null);

// ?tour=recruiter|player|all[&chapter=id] on any page: the owner's links. A
// visitor never types "mixed", so the link says "all".
const LINKED = { recruiter: 'recruiter', player: 'player', all: 'mixed' };
export function parseTourLink(search) {
  const q = new URLSearchParams(search ?? '');
  const audience = LINKED[q.get('tour')];
  if (!audience) return null;
  const chapter = q.get('chapter');
  return chapter ? { audience, chapter } : { audience };
}

// Whether you're on a chapter's page: the page itself, or, the feed's pages
// being one long page that moves the address as it settles, any of them for
// another. A project is its own page, not the projects page; a place on the
// map isn't the map (the tour opens /universe itself).
const FEED_PAGE = /^\/(home|experience(\/[^/]+)?|projects|resume|contact|travel)$/;
export const samePage = (pathname, path) => pathname === path || (FEED_PAGE.test(pathname) && FEED_PAGE.test(path));

// The pages an audience tour may take you to by itself: quick to open and
// always the same. Not the front door (it may send you on, or ask which
// view), a place on the map (the camera flies there), a role (the feed
// lands part way down) or a world (a download, and a gate on a phone): a
// tour offers those with a button and ends there.
export const LIGHT_ROUTES = /^\/(home|experience|projects(\/[^/]+)?|resume|contact|travel|terminal|changes|universe)$/;
export const isLightRoute = (pathname) => LIGHT_ROUTES.test(pathname ?? '');

// The universe's on the map; the classic site's everywhere else, since the
// nav, the guide and the switch it shows are on every page.
export const tourFor = (pathname) => (isMapPath(pathname) ? 'universe' : 'classic');

// The pages a first arrival lands on: the map, and the feed's pages. Not a
// world (it has its own first hint and the guide's note), a project, or the
// terminal.
const FEED = /^\/(home|experience(\/[^/]+)?|projects|resume|contact|travel)$/;

export const offerHere = (pathname, progress) => progress == null && (isMapPath(pathname) || FEED.test(pathname));

// The shell's stops an audience tour opens with (the view's tour, cut down):
// a recruiter's way round, and a player's. Not the view tour's own hello and
// goodbye, which say "under a minute". The nav's stops and the menu's stand
// in for each other by screen width, so whichever isn't showing is skipped.
export const SHELL_STOPS = {
  recruiter: ['panel', 'pages', 'view', 'search', 'menu', 'guide', 'resume'],
  player: ['panel', 'ships', 'navmap', 'view', 'search', 'menu', 'guide'],
};
SHELL_STOPS.mixed = SHELL_STOPS.recruiter;

// A tour's chapters: the shell of the view you're in first, then the
// audience's own. The shell's page is the map in the universe; in the
// classic site, the page you're on if a tour may stand on it, else Home.
export function planFor(tours, audience, view, here) {
  const own = tours[audience];
  if (!own?.length) return [];
  const keep = SHELL_STOPS[audience] ?? SHELL_STOPS.recruiter;
  const universe = view === 'universe';
  const path = universe ? '/universe' : isLightRoute(here) && here !== '/universe' ? here : '/home';
  const stops = (tours[universe ? 'universe' : 'classic'] ?? []).filter((s) => keep.includes(s.id)).map((s) => ({ ...s, optional: true }));
  return [{ id: 'shell', title: 'Getting about', path, stops }, ...own];
}

// A tour made of others' chapters: [name, from, to] takes chapters from to
// to (the spec's numbers, where 1 is the shell, which planFor adds), and a
// name ('end') takes the chapter of that name from `named`.
export function compose(tours, recipe, named = {}) {
  return recipe.flatMap((item) => {
    if (typeof item === 'string') {
      if (!named[item]) throw new Error(`compose: no chapter named “${item}”`);
      return [named[item]];
    }
    const [name, from, to] = item;
    if (!tours[name]) throw new Error(`compose: no tour “${name}”`);
    return tours[name].slice(Math.max(from - 2, 0), to - 1);
  });
}

// The chapters as one run of stops, each carrying its chapter's id, title
// and page, and a key unique in the run.
export const flatten = (chapters) =>
  chapters.flatMap((c) => c.stops.map((s) => ({ ...s, chapter: c.id, chapterTitle: c.title, path: c.path, key: `${c.id}/${s.id}` })));

export const nextIndex = (stops, i, dir) => Math.max(0, Math.min(i + dir, stops.length - 1));

// Where a tour starts: a chapter's first stop, a stop by id (in a chapter,
// if named), or the stop showing a thing to do; the start with nothing
// asked; -1 when what's asked isn't in it.
export function stopIndexFor(stops, { chapter, stop, todo } = {}) {
  if (todo) return stops.findIndex((s) => s.todo === todo);
  if (stop) return stops.findIndex((s) => s.id === stop && (!chapter || s.chapter === chapter));
  if (chapter) return stops.findIndex((s) => s.chapter === chapter);
  return 0;
}

// A stop on a page just opened shows once nothing covers the page, the page
// has drawn (its code arrives on its own), and its target is there; eight
// seconds at most, then its card in the middle, so a tour never hangs. A
// shell stop whose target isn't on this screen (the nav's links on a phone)
// is skipped once the page has been ready a moment without it.
export const WAIT_MS = 8000;
export const SKIP_MS = 1500;
export const readyFor = (stop, { busy, hasTarget, rendered }) => !busy() && rendered() && (!stop.at || hasTarget(stop.at));

export function stepState(stop, page, waited) {
  if (readyFor(stop, page)) return 'ready';
  if (stop.optional && waited >= SKIP_MS && !page.busy() && page.rendered()) return 'skip';
  return waited >= WAIT_MS ? 'timeout' : 'wait';
}

// Asks `check` each tick until it answers, `timeout` passes, or the wait is
// called off. The clock and the ticks come in, so a test needs none.
export function waitUntil(check, { tick, now, timeout = WAIT_MS, cancelled = () => false }) {
  const from = now();
  return new Promise((resolve) => {
    const step = () => {
      if (cancelled()) return resolve('cancelled');
      const got = check(now() - from);
      if (got) return resolve(got);
      if (now() - from >= timeout) return resolve('timeout');
      tick(step);
    };
    step();
  });
}

// The stops whose target is on this screen (`has(name)`), and the cards that
// point at nothing. A phone folds the nav's links, search and colours into
// the menu, so their stops drop out and the menu's comes in. A world's
// basics (`keep`) say everything at every stop, so one whose target isn't
// showing stays, as a card in the middle.
export const resolveSteps = (steps, has, keep = false) =>
  keep ? steps.map((s) => (!s.at || has(s.at) ? s : { ...s, at: undefined })) : steps.filter((s) => !s.at || has(s.at));

// The box lit round a target: `pad` off it all round, kept 2px inside the
// window (a phone's sheet of ships runs on past the bottom), or null when
// none of it is on the screen. Whole pixels, so a still target doesn't
// redraw the box every frame.
export function litBox(rect, view, pad) {
  const left = Math.round(Math.max(rect.left - pad, 2));
  const top = Math.round(Math.max(rect.top - pad, 2));
  const right = Math.round(Math.min(rect.right + pad, view.w - 2));
  const bottom = Math.round(Math.min(rect.bottom + pad, view.h - 2));
  return right - left < 1 || bottom - top < 1 ? null : { left, top, width: right - left, height: bottom - top };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, Math.max(lo, hi)));

// Where the card goes: below its target, else above, else to the right or
// the left, whichever it fits; with no room anywhere, the side with the most
// (over the target, but on the screen). With no target, the middle. Rects
// are the page's (getBoundingClientRect); `card` and `view` are { w, h }.
export function placeCard(target, card, view, { gap = 14, margin = 16 } = {}) {
  const inX = (left) => clamp(left, margin, view.w - card.w - margin);
  const inY = (top) => clamp(top, margin, view.h - card.h - margin);
  if (!target) return { side: 'center', top: inY((view.h - card.h) / 2), left: inX((view.w - card.w) / 2) };
  const room = { bottom: view.h - target.bottom, top: target.top, right: view.w - target.right, left: target.left };
  const fits = {
    bottom: room.bottom >= card.h + gap + margin,
    top: room.top >= card.h + gap + margin,
    right: room.right >= card.w + gap + margin,
    left: room.left >= card.w + gap + margin,
  };
  const side = ['bottom', 'top', 'right', 'left'].find((s) => fits[s]) ?? (room.top > room.bottom ? 'top' : 'bottom');
  const midX = target.left + target.width / 2 - card.w / 2;
  const midY = target.top + target.height / 2 - card.h / 2;
  if (side === 'bottom') return { side, top: inY(target.bottom + gap), left: inX(midX) };
  if (side === 'top') return { side, top: inY(target.top - gap - card.h), left: inX(midX) };
  if (side === 'right') return { side, top: inY(midY), left: inX(target.right + gap) };
  return { side, top: inY(midY), left: inX(target.left - gap - card.w) };
}
