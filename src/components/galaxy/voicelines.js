// What's said aloud in the galaxy with no recording of its own, for the
// voices (scripts/voices, README's "Whose lines"): the war's commanders on
// the comms (warCast.js's say, each in their own voice: voiceOfCommander),
// and the system cards' quotes with no clip (systems.js's quote.voice, as
// GalaxyPanel.jsx plays them). Not the commanders' lines with your rank
// filled in as they're said, nor Jabba's Huttese. (The crews' own, and their
// callers on the radio: universe/voicelines.js.)

import { CAST, voiceOfCommander } from './warCast';
import { SYSTEMS } from './systems';

const commanders = Object.values(CAST).flatMap((c) =>
  Object.values(c.lines)
    .filter((text) => !/\{\w+\}/.test(text))
    .map((text) => ({ who: voiceOfCommander(c), text })),
);

const quotes = SYSTEMS.filter((s) => !s.quote.clip && s.quote.voice).map((s) => ({ who: s.quote.voice, text: s.quote.text }));

export const VOICELINES = [...commanders, ...quotes].filter((l) => l.who);
