// The guide writes a control's keys as one short string, 'hold F' or
// 'W A S D or ← ↑ ↓ →': each key is a key (drawn as a <kbd>), the little words
// between them stay words, a slash reads as "or", and the pointer's gestures
// (Drag, Click, Tap…) are keys drawn a little differently.

const WORDS = new Set(['or', 'and', 'then', 'hold', 'tap', 'double', 'to', 'while', 'in', 'on', 'the']);
const POINTER = new Set(['Drag', 'Click', 'Tap', 'Scroll', 'Swipe', 'Right-click', 'Pinch', 'Stick']);

export function keyTokens(keys) {
  if (!keys) return [];
  return keys
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => {
      if (t === '/') return { word: 'or' };
      if (WORDS.has(t)) return { word: t };
      if (POINTER.has(t)) return { key: t, pointer: true };
      return { key: t };
    });
}
