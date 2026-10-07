// The commanders on the comms in the galaxy's wars: the films' and the
// shows' own (Ackbar and Piett, Yoda and Grievous, Teva and Gideon, and
// Jabba for the Hutts), posted to the systems they're remembered at, the
// side's general everywhere else. They speak first on each moment of a
// battle (warfront.js's events), the crew answers (battleLines.js); they
// know your rank (ranks.js: {rank} in a line) and whether you've fought
// here before (`again`, for the front). Data, tested.
//
// CAST[id]: { id, name, sides, color, lines: { front, join, gens, bridge,
//   reactor, won, lost, again? } } (the Hutts': front, won, lost);
// GENERALS[side]: the commander anywhere else; POSTS[side][sys]: who's there.
// castFor(sys, side) → a commander | null; say(commander, key, { rank,
// again }) → an exchange of one comms line with their name on it (Comms.jsx's
// fourth element), or [].

export const CAST_KEYS = ['front', 'join', 'gens', 'bridge', 'reactor', 'won', 'lost'];
export const HUTT_CAST_KEYS = ['front', 'won', 'lost'];

export const CAST = {};
export const GENERALS = {};
export const POSTS = {};

export function castFor(sys, side) {
  if (!side) return null;
  return CAST[POSTS[side]?.[sys]] ?? CAST[GENERALS[side]] ?? null;
}

export function say(commander, key, { rank = '', again = false } = {}) {
  const line = commander && ((key === 'front' && again && commander.lines.again) || commander.lines[key]);
  if (!line) return [];
  return [['comms', line.replace(/\{rank\}/g, rank), undefined, { name: commander.name, color: commander.color }]];
}
