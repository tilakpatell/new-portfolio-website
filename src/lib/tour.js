import { isMapPath } from './view';

// The tour of the site (components/tour): which one a page gets, when a
// first arrival is offered it, which of its stops show on this screen, and
// where its card goes beside the thing it's pointing at. See
// docs/superpowers/specs/2026-10-07-site-tour-design.md.

export const TOUR_KEY = 'tp-tour'; // { offered, [mode]: 'done' | 'skipped' } (tourStatus, below); unset until the offer's made
export const TOUR_EVENT = 'tp:tour';

// Starts a tour from anywhere: ⌘K, the guide, the terminal, the offer. With a
// mode (a script's id); without one, the page's own shell tour.
// (a click handler passes its event: not a mode)
export const openTour = (mode = null) => window.dispatchEvent(new CustomEvent(TOUR_EVENT, { detail: { mode: typeof mode === 'string' ? mode : null } }));

// The universe's on the map; the classic site's everywhere else, since the
// nav, the guide and the switch it shows are on every page.
export const tourFor = (pathname) => (isMapPath(pathname) ? 'universe' : 'classic');

// The pages a first arrival lands on: the map, and the feed's pages. Not a
// world (it has its own first hint and the guide's note), a project, or the
// terminal.
const FEED = /^\/(home|experience(\/[^/]+)?|projects|resume|contact|travel)$/;

export const offerHere = (pathname, seen) => seen == null && (isMapPath(pathname) || FEED.test(pathname));

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

// ---- Scripts: a tour across pages ------------------------------------------
//
// A script is { id, title, minutes, legs, end }: its legs are the pages it
// visits in order, each { id, path, ready, only, skippable, stops }, and
// `end` the last card. A stop is as steps.js writes it, plus `only`,
// `before`, `after` and `pause`. The runner (components/tour/TourRunner)
// walks the legs; what's here is the part that needs no page.

export const RUN_KEY = 'tp-tour-run'; // { mode, leg, stop, startedAt, path }: a tour part way through
export const RUN_FOR = 24 * 60 * 60 * 1000; // a run older than a day isn't offered again

// one page's stops as a script of one leg, run where you are (the shell
// tours, a world's basics)
export const asScript = (id, stops, extra = {}) => ({ id, legs: [{ id, path: null, ready: 'now', stops }], ...extra });

// whether a leg or a stop is for this device: `only` is 'desktop', 'touch',
// a function of the environment, or nothing
export const onlyHere = (only, env) => (only == null ? true : typeof only === 'function' ? Boolean(only(env)) : only === 'touch' ? Boolean(env.touch) : only === 'desktop' ? !env.touch : true);

// the script's legs for this device, each with the stops that are, and
// without those left with none, and the script's last card (`end`) on the
// last of them; `env` is { touch }
export function legsFor(script, env) {
  const legs = script.legs
    .filter((leg) => onlyHere(leg.only, env))
    .map((leg) => ({ ...leg, stops: leg.stops.filter((s) => onlyHere(s.only, env)) }))
    .filter((leg) => leg.stops.length > 0);
  if (script.end && legs.length) legs[legs.length - 1] = { ...legs.at(-1), stops: [...legs.at(-1).stops, { id: 'done', ...script.end }] };
  return legs;
}

// the stops of every leg in a row, each knowing its leg, so the card can say
// "4 of 12" across pages
export const flatten = (legs) => legs.flatMap((leg, i) => leg.stops.map((stop) => ({ ...stop, leg: i })));

// Whether the page is on a leg: its path, anywhere under it, or the page
// it's a part of (the feed's address follows the scroll: a leg at
// /experience/aws is still on at /experience). The map's legs cover the
// front door too, and a leg with no path is wherever you are.
export function onLeg(leg, pathname) {
  if (!leg?.path) return true;
  if (isMapPath(leg.path)) return isMapPath(pathname);
  return pathname === leg.path || pathname.startsWith(`${leg.path}/`) || leg.path.startsWith(`${pathname}/`);
}

// Whether the page is still about a leg: on it, or on another page of the
// feed when the leg's is one (the feed's address follows the scroll, and a
// tall stop can bring the next page's top into view). Leaving a leg is
// judged by this; arriving by onLeg.
export const nearLeg = (leg, pathname) => onLeg(leg, pathname) || (Boolean(leg?.path) && FEED.test(leg.path) && FEED.test(pathname));

// Whether a leg's page is ready for its first stop, from what the runner
// sees: `probe` is { covered (the intro's cover), gate (a world asking before
// it downloads), modal (a dialog up), has(name) (a data-tour target showing) }.
// 'now' is at once; 'feed' and 'map' wait for the page's own targets and for
// the cover to lift; 'world' waits for the gate's answer and the cover; a
// function decides for itself; anything else waits for the first target.
export function readyFor(ready, probe, firstAt) {
  if (ready === 'now') return true;
  if (typeof ready === 'function') return Boolean(ready(probe));
  if (probe.modal || probe.covered) return false;
  if (ready === 'world') return !probe.gate;
  if (ready === 'map') return probe.has('panel');
  return !firstAt || probe.has(firstAt);
}

// ---- What's remembered ------------------------------------------------------

// tp-tour as an object: { offered, [mode]: 'done' | 'skipped' }. It was a
// string ('offered', 'done', 'skipped') for the shell tour: read as the
// offer made, and the shell tour's outcome.
export function tourStatus(raw) {
  if (raw && typeof raw === 'object') return raw;
  if (typeof raw !== 'string') return {};
  return raw === 'offered' ? { offered: true } : { offered: true, shell: raw };
}

export const markTour = (raw, mode, how) => ({ ...tourStatus(raw), offered: true, ...(mode ? { [mode]: how } : {}) });

// a run worth picking up: a mode, a place in it, and not from another day
export function readRun(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object' || typeof raw.mode !== 'string') return null;
  const leg = Number(raw.leg);
  const stop = Number(raw.stop);
  const since = Number(raw.startedAt);
  if (!Number.isInteger(leg) || leg < 0 || !Number.isInteger(stop) || stop < 0 || !Number.isFinite(since)) return null;
  if (now - since > RUN_FOR) return null;
  return { mode: raw.mode, leg, stop, startedAt: since, path: typeof raw.path === 'string' ? raw.path : null };
}

// the mode a link asks for (#/?tour=recruiter), or null
export function tourInSearch(search, modes) {
  const mode = new URLSearchParams(search ?? '').get('tour');
  return mode && modes.includes(mode) ? mode : null;
}
