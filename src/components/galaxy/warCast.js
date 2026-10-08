// The commanders on the comms in the galaxy's wars: the films' and the
// shows' own (Ackbar and Piett, Yoda and Grievous, Teva and Gideon, and
// Jabba for the Hutts), posted to the systems they're remembered at, the
// side's general everywhere else. They speak first on each moment of a
// battle (warfront.js's events), the crew answers (battleLines.js); they
// know your rank (ranks.js: {rank} in a line) and whether you've fought
// here before (`again`, for the front). Each says theirs in their own voice
// where it's been made (lib/voiced.js; ./voicelines.js lists them). Data, tested.
//
// CAST[id]: { id, name, sides, color, lines: { front, join, gens, bridge,
//   reactor, won, lost, again? } } (the Hutts': front, won, lost);
// GENERALS[side]: the commander anywhere else; POSTS[side][sys]: who's there.
// castFor(sys, side) → a commander | null; voiceOfCommander(commander) →
// the voice their lines are made in | null; say(commander, key, { rank,
// again }) → an exchange of one comms line with their name on it and their
// voice (Comms.jsx's fourth element, universe/speakers.js), or [].

export const CAST_KEYS = ['front', 'join', 'gens', 'bridge', 'reactor', 'won', 'lost'];
export const HUTT_CAST_KEYS = ['front', 'won', 'lost'];

// (the cast itself: warCastData.js)
import { CAST, GENERALS, POSTS } from './warCastData';

export { CAST, GENERALS, POSTS };

export function castFor(sys, side) {
  if (!side) return null;
  return CAST[POSTS[side]?.[sys]] ?? CAST[GENERALS[side]] ?? null;
}

// The voice a commander's lines are made in: their id, but for the two whose
// voice goes by another name (Windu's is `mace`, Gunray's `nute`, as on the
// ground: surface/voicelines.js), and Jabba, who speaks only Huttese.
const VOICE = { windu: 'mace', gunray: 'nute', jabba: null };
export const voiceOfCommander = (commander) => (commander ? (commander.id in VOICE ? VOICE[commander.id] : commander.id) : null);

export function say(commander, key, { rank = '', again = false } = {}) {
  const line = commander && ((key === 'front' && again && commander.lines.again) || commander.lines[key]);
  if (!line) return [];
  const voiced = voiceOfCommander(commander);
  return [['comms', line.replace(/\{rank\}/g, rank), undefined, { name: commander.name, color: commander.color, ...(voiced && { voiced }) }]];
}
