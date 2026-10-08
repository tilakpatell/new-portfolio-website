// What the crews say aloud in the galaxy's wars' battles, for scripts/voices
// to make in their own voices (its README, "Whose lines"): Rick and Morty's,
// Luke's, Han's, Walt and Jesse's (this folder's), each line as
// battleLines.js picks it and the comms play it (universe/Comms.jsx, by
// voicedSrc: the speaker's id and the line as shown). Every line a battle
// could pick, for each side, war, place and enemy, at the moments warfront.js
// has the crew say something (SAID); so not the lines under moments nobody
// says yet, nor the ones every war's own front and win stand in for. Not
// Artoo's beeps or Chewie's roars (voiceOf has no voice for them), and not
// the lines with a blank the battle fills as it's said ({us}, {them},
// {place}).

import { voiceOf } from '../../../lib/voiced';
import { BATTLE_LINES, PLACES, battleLines } from '../battleLines';
import { SIDES, WARS } from '../sides';

// the moments warfront.js has the crew speak on (its say(): the test keeps these in step)
export const SAID = ['ask', 'front', 'join', 'gens', 'bridge', 'reactor', 'won', 'lost', 'ace', 'intercept', 'runners', 'blockade'];

// the lines as they're written, blanks and all
function written(v, out = new Set()) {
  if (Array.isArray(v) && typeof v[0] === 'string') out.add(v[1]);
  else if (Array.isArray(v)) v.forEach((x) => written(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => written(x, out));
  return out;
}

function battleVoicelines() {
  const asWritten = written(BATTLE_LINES);
  const found = new Map();
  for (const crew of Object.keys(BATTLE_LINES))
    for (const key of SAID)
      for (const side of [null, ...Object.keys(SIDES)])
        for (const war of Object.keys(WARS))
          for (const sys of [null, ...Object.keys(PLACES)])
            for (const against of [null, 'hutt'])
              for (const [who, text, clip] of battleLines(crew, { key, side, war, sys, against }) ?? [])
                // (a line that isn't as written had a blank filled)
                if (!clip && voiceOf(who) && asWritten.has(text)) found.set(`${who}|${text}`, { who, text });
  return [...found.values()];
}

export const VOICELINES = battleVoicelines();
