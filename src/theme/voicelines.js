// What the themes say aloud as they land with no clip of their own
// (./quotes.js), as components/ThemeTransition.jsx passes them to sayVoiced,
// for scripts/voices to make in each speaker's voice (its README, "Whose lines").

import { THEME_QUOTES } from './quotes';

export const VOICELINES = Object.values(THEME_QUOTES).map((q) => ({ who: q.voice, text: q.quote }));
