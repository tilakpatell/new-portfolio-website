// Callsigns: one to start from, and a name as it may be shown. Apart from
// protocol.js, so the site's shell can read a remembered callsign without
// loading the rest of multiplayer.

export const NAME_MAX = 16;

const ADJ = ['Red', 'Gold', 'Rogue', 'Ghost', 'Nova', 'Solar', 'Void', 'Comet', 'Lunar', 'Pickle', 'Blue', 'Rusty'];
const NOUN = ['Leader', 'Five', 'Squad', 'Runner', 'Fox', 'Wing', 'Pilot', 'Ranger', 'Hawk', 'Rick', 'Comet', 'Ace'];

// a callsign to start from, till you pick your own
export function randomCallsign(rand = Math.random) {
  const pick = (list) => list[Math.floor(rand() * list.length) % list.length];
  return `${pick(ADJ)} ${pick(NOUN)} ${1 + Math.floor(rand() * 99)}`;
}

// A name as it may be shown: no control or direction-override characters
// (which could flip the text round it), spaces collapsed, NAME_MAX
// characters at most. Empty, or not a string: null.
export function cleanName(raw) {
  if (typeof raw !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const bare = raw.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, '');
  const name = [...bare.replace(/\s+/g, ' ').trim()].slice(0, NAME_MAX).join('').trim();
  return name || null;
}
