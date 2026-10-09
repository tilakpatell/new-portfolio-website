// What may be said between pilots, and how a line may be shown. Pure, so
// it's tested in Node (text.test.js); every line typed, sent or come in goes
// through cleanText before anyone sees it, and then only ever as text (a text
// node or textContent, never markup).
//
// CHAT holds the numbers, and `everyone`, the owner's switch for everyone's
// chat (the site's room: client.js's say): false, and a line to everyone is
// neither sent nor shown. Squad text and the quick-chat phrases go on
// regardless. PHRASES are the quick-chat's sixteen, sent by id (phrase(i)).
//
// cleanText(raw, max), in order: not a string, nothing; cut to max × 8
// UTF-16 units before anything's looked at (a flood costs nothing); control,
// zero-width and direction characters out (names.js's); spaces collapsed and
// trimmed; anything that reads as a link becomes [link] (a scheme and '://',
// 'www.', or a dotted name whose last part is 2 to 24 letters, ending where a
// name can't go on: spaces round a dot count, but a dot with a space only
// after it is a sentence ending, not a link); each word names.js calls rude
// becomes •••; cut to max characters; nothing left, nothing.

import { isRude, stripControls } from '../names';

export const CHAT = { everyone: true, squadMax: 200, everyoneMax: 160, log: 50, repeatMs: 30000 };

export const PHRASES = ['Hello', 'Follow me', 'On my way', 'Need help', 'Attack my target', 'Cover me', 'Regroup', 'Nice shot', 'Thanks', 'Sorry', 'Yes', 'No', 'Watch out', 'Truce?', 'Let’s go', 'Good game'];
export const phrase = (i) => (Number.isInteger(i) && i >= 0 && i < PHRASES.length ? PHRASES[i] : null);

// (a part of a name: letters and digits in any script, and dashes)
const PART = '[\\p{L}\\p{N}][\\p{L}\\p{N}-]*';
// (a dot between them, bare or with space before it: 'example . com', not 'Hello. How')
const DOT = '(?:\\.|\\s+\\.\\s*)';
const LINK = new RegExp(
  [
    '[a-z][a-z0-9+.-]*:\\/\\/\\S*', // a scheme and ://, and the rest of it
    'www\\.\\S*',
    `(?:${PART}${DOT})+\\p{L}{2,24}(?![\\p{L}\\p{N}-])(?:[/:?#]\\S*)?`, // a dotted name, with any path after it
  ].join('|'),
  'giu',
);

export function cleanText(raw, max) {
  if (typeof raw !== 'string') return null;
  const bare = stripControls(raw.slice(0, max * 8))
    .replace(/\s+/g, ' ')
    .trim();
  const said = bare
    .replace(LINK, '[link]')
    .split(' ')
    .map((word) => (isRude(word) ? '•••' : word))
    .join(' ');
  const text = [...said].slice(0, max).join('').trim();
  return text || null;
}
