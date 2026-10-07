// Every page the site has shown you, across visits (the session's own list,
// tp-visited, resets each visit): what the guide's "Things to do" ticks off
// for the things an achievement doesn't cover. Written by the shell on each
// new page (App.jsx); Start over forgets it (lib/restart). The newest kept
// when full, as the house's other seen-lists are.

export const VISITED_KEY = 'tp-visited-ever';
export const VISITED_CAP = 200;

// a page one way: no search, no trailing slash
const norm = (pathname) => {
  if (typeof pathname !== 'string' || !pathname.startsWith('/')) return null;
  const path = pathname.split(/[?#]/)[0];
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
};

export function addVisited(list, pathname) {
  const was = Array.isArray(list) ? list.filter((p) => typeof p === 'string') : [];
  const path = norm(pathname);
  if (!path) return was;
  return [...was.filter((p) => p !== path), path].slice(-VISITED_CAP);
}

// seen it, or somewhere deeper in it (a role is Experience, a surface its system)
export const hasVisited = (list, to) => Array.isArray(list) && list.some((p) => p === to || (typeof p === 'string' && p.startsWith(`${to}/`)));

// The shell's own keys a thing to do may be ticked by (data/todo.js's
// `done: { key, is }`): what's set when you've picked a ship, pinned a
// colour, made your own, read the site in a script, found an egg, chosen
// light or dark, turned the sound on, or picked a front door. A world's keys
// stay the world's (the island rule): its row ticks by its achievement.
export const SHELL_KEYS = ['tp-universe-ship', 'tp-theme-pin', 'tp-custom-color', 'tp-scripts-read', 'tp-eggs', 'tp-mode', 'tp-sound', 'tp-start'];
