// What is happening on the planet now, for the HUD's line (./EventLine.jsx):
// the scene sets it as an event starts and ends, the HUD reads it. A tiny
// store, as ./lifeNews.js is, since the scene lives outside React.
//
//   setEvent(ev | null); eventNow() → { line, kind, ends } | null; listen(fn) → unlisten

let now = null;
const ears = new Set();

// `ends`: the wall clock's ms when it's over
export function setEvent(ev) {
  const next = ev ? { id: ev.id, line: ev.line, kind: ev.kind, ends: (ev.t0 + ev.ttl) * 1000 } : null;
  if (next?.id === now?.id) return;
  now = next;
  for (const fn of ears) fn();
}

export const eventNow = () => now;

export function listen(fn) {
  ears.add(fn);
  return () => ears.delete(fn);
}
