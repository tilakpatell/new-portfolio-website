// What the Rick and Morty page says aloud with no clip of its own, for
// scripts/voices to make in each speaker's voice: its toys' lines
// (./toys.js) and its themes' quotes (./themeQuotes.js), each as the toy or
// the theme passes it to useVoiced or sayVoiced (lib/voiced.js).

import { PORTAL_QUOTES } from './themeQuotes';
import { BUTTER, CHANNELS, MEESEEKS, aloud } from './toys';

export const VOICELINES = [
  ...Object.values(BUTTER)
    .filter((s) => s.who)
    .map((s) => ({ who: s.who, text: s.line })),
  // (a task done but turning the site green: that's the portal theme's to say)
  ...[...MEESEEKS.stress, MEESEEKS.letGo, MEESEEKS.done.top, MEESEEKS.done.shake].map((line) => ({ who: 'meeseeks', text: aloud(line) })),
  ...CHANNELS.map((c) => ({ who: c.who, text: c.line })),
  ...Object.values(PORTAL_QUOTES).map((q) => ({ who: q.voice, text: q.quote })),
];
