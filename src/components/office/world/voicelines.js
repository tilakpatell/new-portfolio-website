// What Dunder Mifflin's people say aloud as you walk the office, for
// scripts/voices to make in their own voices (its README, "Whose lines"):
// each one's lines in the bubble over their head as you pass, what they ask
// while a job's waiting, and what they say in the toasts. Read from the
// world's own data, so an edited line is made again. The conversations
// (./story.js) are listed by scripts/voices itself; the lines the show said
// out loud play that (SPOKEN).

import { ASKS, LINES, SPOKEN } from './layout';
import { SHOUTS } from './shouts';

export const VOICELINES = [
  ...Object.entries(LINES).flatMap(([who, lines]) => lines.map((text) => ({ who, text }))),
  ...Object.entries(ASKS).map(([who, text]) => ({ who, text })),
  ...Object.values(SHOUTS).map(({ who, say }) => ({ who, text: say })),
].filter(({ text }) => !SPOKEN[text]);
