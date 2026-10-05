// Which walking keys are held, for the walkable towns (the Shire, Bree).
// Kept by where the key is on the keyboard (e.code), not by what it types
// (e.key): Shift turns `w` into `W`, so a W pressed before Shift and let go
// after it used to leave one of the two "held" for good, and the hobbit
// walked on by himself. A French keyboard's Z is in W's place, so it walks
// forward too. Shift is checked on every key event as well, so a Shift let go
// while the page wasn't listening can't leave him running.

const CODES = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'run',
  ShiftRight: 'run',
  Space: 'space',
};
// (for events with no code: some virtual keyboards, and synthetic ones)
const KEYS = { w: 'up', arrowup: 'up', s: 'down', arrowdown: 'down', a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right', shift: 'run', ' ': 'space' };

// the walking key an event is about: 'up' | 'down' | 'left' | 'right' |
// 'run' | 'space', or null
export const moveOf = (e) => CODES[e.code] ?? (e.code ? null : (KEYS[String(e.key ?? '').toLowerCase()] ?? null));

const syncRun = (held, e) => {
  if (typeof e.shiftKey !== 'boolean') return;
  if (e.shiftKey) held.add('run');
  else held.delete('run');
};

// A key went down: returns the walking key it is (or null). Keys pressed with
// Ctrl, Cmd or Alt aren't counted (their key-ups often never come).
export function keyDown(held, e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return null;
  const m = moveOf(e);
  if (m) held.add(m);
  // a Shift keydown reports shiftKey true; anything else says whether it's still down
  if (m !== 'run') syncRun(held, e);
  return m;
}

// A key came up: returns the walking key it was (or null).
export function keyUp(held, e) {
  const m = moveOf(e);
  if (m) held.delete(m);
  if (m !== 'run') syncRun(held, e);
  return m;
}
