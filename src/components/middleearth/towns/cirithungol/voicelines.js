// What's said aloud at Cirith Ungol past what export-lines.mjs finds in the
// conversations, for scripts/voices to make in the speakers' voices (its
// README, "Whose lines"): each line as CirithUngolWorld says it. On Sam's
// cloak, Frodo talking in his sleep (a stir with no quotes is only told) and
// Gollum when he wakes.
import { toastLines } from '../voice';
import { CRUMB_SAYS, SAYS } from './story';

export const VOICELINES = [
  ...CRUMB_SAYS.stir.filter((text) => text.includes('“')).map((text) => ({ who: 'frodo', text })),
  { who: 'gollum', text: CRUMB_SAYS.woke },
  ...toastLines(SAYS),
];
