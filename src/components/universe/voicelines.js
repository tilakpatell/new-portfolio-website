// The lines the crews' radio says aloud in someone's own voice (scripts/voices,
// README's "Whose lines"): the callers on the comms, whose voice is only in
// where their line is in the crews' lines (callers.js, on the universe map's
// and the galaxy's: crews.js, galaxy/lines.js), and the crews' guests (Birdperson,
// Mr. Meeseeks). The crews' own (Rick and Morty, Luke, Han, Walt and Jesse)
// scripts/voices/export-lines.mjs takes from the crews itself. Not the lines
// with a recording of their own, nor the ones with a word filled in as
// they're said (an offer's {part}).

import { CREWS } from './crews';
import { GALAXY_LINES } from '../galaxy/lines';
import { eachLine, speakerOf } from './callers';
import { voiceOf } from '../../lib/voiced';

export { speakerOf };

// (export-lines.mjs's own: the crews' pilots)
const CREW = new Set(['rick', 'morty', 'luke', 'han', 'walt', 'jesse']);

function voiced(crewId, lines) {
  const out = [];
  eachLine(lines, [crewId], ([who, text, clip], path) => {
    if (clip || /\{\w+\}/.test(text)) return;
    const voice = who === 'comms' ? speakerOf(path)?.voice : !CREW.has(who) && voiceOf(who) && who;
    if (voice) out.push({ who: voice, text });
  });
  return out;
}

export const VOICELINES = [...CREWS.flatMap((c) => voiced(c.id, c)), ...Object.entries(GALAXY_LINES).flatMap(([id, lines]) => voiced(id, lines))];
