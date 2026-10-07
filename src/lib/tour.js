import { isMapPath } from './view';

// The tour of the site (components/tour): which one a page gets, when a
// first arrival is offered it, which of its stops show on this screen, and
// where its card goes beside the thing it's pointing at. See
// docs/superpowers/specs/2026-10-07-site-tour-design.md.

export const TOUR_KEY = 'tp-tour'; // 'offered', 'done' or 'skipped'; unset until the offer's made
export const TOUR_EVENT = 'tp:tour';

// Starts the tour from anywhere: ⌘K, the guide, the terminal, the offer.
export const openTour = () => window.dispatchEvent(new Event(TOUR_EVENT));

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
