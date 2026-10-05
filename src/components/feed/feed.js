// The portfolio as a feed: the six portfolio pages, one under the other.
// Reach the end of one and the next begins (see Feed.jsx). This is the order
// and the matching, as plain tested data and functions.

export const FEED = [
  { id: 'home', to: '/home', label: 'Home', blurb: 'Who I am and what I work on.' },
  { id: 'experience', to: '/experience', label: 'Experience', blurb: 'Every role, from AWS to SRC.' },
  { id: 'projects', to: '/projects', label: 'Projects', blurb: 'Built to be played with, each with a live demo.' },
  { id: 'resume', to: '/resume', label: 'Résumé', blurb: 'One page, filterable, and the PDF.' },
  { id: 'travel', to: '/travel', label: 'Travel', blurb: 'Places I have been, on a globe.' },
  { id: 'contact', to: '/contact', label: 'Contact', blurb: 'How to reach me.' },
];

const index = (id) => FEED.findIndex((c) => c.id === id);

// The category a path belongs to, or null. A role on the experience page
// (/experience/aws) is the experience page; a project's own page
// (/projects/gameboy-emulator) is not the projects page.
export function categoryAt(pathname) {
  const path = String(pathname || '').replace(/[?#].*$/, '');
  if (/^\/experience(\/[^/]+)?\/?$/.test(path)) return FEED[index('experience')];
  return FEED.find((c) => path === c.to || path === `${c.to}/`) ?? null;
}

export const byId = (id) => FEED[index(id)] ?? null;

// The category after this one; the last wraps to the first.
export function nextOf(id) {
  const i = index(id);
  if (i < 0) return null;
  return FEED[(i + 1) % FEED.length];
}

// The six in order, starting at one.
export function feedFrom(id) {
  const i = index(id);
  if (i < 0) return [];
  return FEED.map((_, k) => FEED[(i + k) % FEED.length]);
}

// Where a page stands in the feed from its entry, 1-based: the divider's "2 of 6".
export const placeOf = (entryId, id) => feedFrom(entryId).findIndex((c) => c.id === id) + 1;

// The feed's own address changes replace the entry and carry state.feed, so
// the app can tell them from a visitor's click, Back, or a page's own
// search-param update.
export const feedState = { feed: true };
export const isFeedMove = (location, navigationType) => navigationType === 'REPLACE' && location?.state?.feed === true;
