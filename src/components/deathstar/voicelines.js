// What's said aloud at the Death Star with no recording of its own, for the
// voices (scripts/voices): the trench run's radio (./trench.js, as
// ./TrenchRun.jsx shows it) and the readout's quotes that have no clip
// (./parts.js, ./Readout.jsx).
import { PARTS } from './parts';
import { RADIO, WON } from './trench';

// Whose voice, by the name a line goes under: on the radio ('Red Leader: “…”')
// or on a quote card. Gold Five and Vader aren't here: theirs play the films'
// own recordings.
export const VOICE = { 'Red Leader': 'redleader', Luke: 'luke', Biggs: 'biggs', Han: 'han', 'Han Solo': 'han', 'Wedge Antilles': 'wedge' };

// The voice of a line the run shows: its speaker's, by the name before it; Han's
// for the last word, with the computer on; or null (a call with no speaker).
export function speakerOf(text) {
  const name = /^([^:“]+): “/.exec(text ?? '')?.[1];
  if (name) return VOICE[name] ?? null;
  return text === WON.computer ? 'han' : null;
}

// The voice of a part's quote on the readout, if it has no clip to play.
export const quoteVoice = (part) => (part.clip ? null : (VOICE[part.quote[1]] ?? null));

export const VOICELINES = [
  ...[...Object.values(RADIO), WON.computer].map((text) => ({ who: speakerOf(text), text })),
  ...PARTS.map((p) => ({ who: quoteVoice(p), text: p.quote[0] })),
].filter((l) => l.who);
