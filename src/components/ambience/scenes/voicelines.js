// What the themes' backgrounds say aloud: the Dunder Mifflin one's lines that
// somebody says (./dunderLines.js), as ./dunder.js passes them to sayVoiced,
// for scripts/voices to make in their own voices (its README, "Whose lines").

import { VOICE } from './dunderLines';

export const VOICELINES = Object.entries(VOICE).map(([text, who]) => ({ who, text }));
