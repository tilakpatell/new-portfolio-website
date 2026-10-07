// What Dunder Mifflin's people say aloud as you walk the office, for
// scripts/voices to make in their own voices (its README, "Whose lines"):
// each one's lines in the bubble over their head as you pass, what they ask
// while a job's waiting, what they say in the toasts, and the conversations
// (./story.js: reception's calls, a call put through to the wrong desk, the
// Dundies), each node as TownHud's Convo says it. Read from the world's own
// data, so an edited line is made again. The lines the show said out loud
// play that (SPOKEN); a narrator's and an unnamed caller's have no voice.

import { voiceOf } from '../../../lib/voiced';
import { ASKS, LINES, SPOKEN } from './layout';
import { SHOUTS } from './shouts';
import { CONVOS } from './story';

export const VOICELINES = [
  ...Object.entries(LINES).flatMap(([who, lines]) => lines.map((text) => ({ who, text }))),
  ...Object.entries(ASKS).map(([who, text]) => ({ who, text })),
  ...Object.values(SHOUTS).map(({ who, say }) => ({ who, text: say })),
  ...Object.values(CONVOS)
    .flatMap((c) => Object.values(c.nodes))
    .filter((n) => voiceOf(n.who))
    .map((n) => ({ who: n.who, text: n.say })),
].filter(({ text }) => !SPOKEN[text]);
