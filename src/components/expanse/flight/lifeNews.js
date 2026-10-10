// The one line the planet's life has for the HUD ("Patrol inbound"): the
// scene says it, FlightHud's LifeLine shows it. A tiny store, as the life
// lives in the scene and the HUD in React, with nothing between them.
//
//   say(text); news() → { text, at } | null; listen(fn) → unlisten

let line = null;
const ears = new Set();

export function say(text) {
  line = { text, at: Date.now() };
  for (const fn of ears) fn();
}

export const news = () => line;

export function listen(fn) {
  ears.add(fn);
  return () => ears.delete(fn);
}
