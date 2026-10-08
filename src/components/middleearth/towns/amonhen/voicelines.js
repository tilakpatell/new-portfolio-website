// What's said aloud at Amon Hen past what export-lines.mjs finds in the
// conversations and the people you walk up to (../voicelines.js), for
// scripts/voices to make in the speakers' voices (its README, "Whose
// lines"): each line as AmonHenWorld says it. Merry and Pippin at ducks and
// drakes (not their counts of your skips, which are made up as you throw),
// the toasts, and Aragorn's words over Boromir.
import { toastLines, voicedNodes } from '../voice';
import { CONVOS, SAYS, SKIPPING_SAYS } from './story';

const skipping = Object.values(SKIPPING_SAYS).filter((l) => typeof l === 'object');

export const VOICELINES = [...skipping.map((l) => ({ who: l.who, text: l.say })), ...toastLines(SAYS), ...voicedNodes(CONVOS)];
