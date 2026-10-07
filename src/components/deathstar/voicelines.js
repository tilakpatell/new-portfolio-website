// What's said aloud at the Death Star with no recording of its own, for the
// voices (scripts/voices): the trench run's radio (./trench.js, as
// ./TrenchRun.jsx shows it), the readout's quotes that have no clip
// (./parts.js, ./Readout.jsx), and the Battle of Yavin's intercom and its
// last words (./battle.js, as src/pages/DeathStar.jsx shows them).
import { PARTS } from './parts';
import { RADIO, WON } from './trench';
import { CALLS, CLEARED, ENDINGS } from './battle';

// Whose voice, by the name a line goes under: on the radio ('Red Leader: “…”')
// or on a quote card. Gold Five and Vader aren't here: theirs play the films'
// own recordings (and so does Tarkin's quote on the readout).
export const VOICE = { 'Red Leader': 'redleader', Luke: 'luke', Biggs: 'biggs', Han: 'han', 'Han Solo': 'han', 'Wedge Antilles': 'wedge', 'Grand Moff Tarkin': 'tarkin' };

// The voice of a line the run shows: its speaker's, by the name before it; Han's
// for the last word, with the computer on; or null (a call with no speaker).
export function speakerOf(text) {
  const name = /^([^:“]+): “/.exec(text ?? '')?.[1];
  if (name) return VOICE[name] ?? null;
  return text === WON.computer ? 'han' : null;
}

// The voice of a part's quote on the readout, if it has no clip to play.
export const quoteVoice = (part) => (part.clip ? null : (VOICE[part.quote[1]] ?? null));

// Who reads out the base's intercom on Yavin 4 as the clock runs down: one of the Rebels there.
export const INTERCOM = 'rebeltrooper';
// The voice of the battle's last word ('empire' or 'rebels'), by whose it is.
export const endingVoice = (outcome) => VOICE[ENDINGS[outcome]?.by] ?? null;

export const VOICELINES = [
  ...[...Object.values(RADIO), WON.computer].map((text) => ({ who: speakerOf(text), text })),
  ...PARTS.map((p) => ({ who: quoteVoice(p), text: p.quote[0] })),
  ...[...Object.values(CALLS), CLEARED].map((text) => ({ who: INTERCOM, text })),
  ...Object.keys(ENDINGS).map((outcome) => ({ who: endingVoice(outcome), text: ENDINGS[outcome].line })),
].filter((l) => l.who);
