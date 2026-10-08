// What the Imperial terminal says aloud, for scripts/voices to make in the
// speakers' own voices (its README, "Whose lines"): the quotes it prints
// (./quotes.js) that have a voice, as src/pages/Terminal.jsx says them.

import { LIGHTSABER, QUOTES } from './quotes';

export const VOICELINES = [...QUOTES, LIGHTSABER].filter(([, , who]) => who).map(([text, , who]) => ({ who, text }));
