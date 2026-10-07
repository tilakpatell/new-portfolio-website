// What's said aloud in Rivendell past what export-lines.mjs finds in the
// conversations and the people you walk up to (../voicelines.js), for
// scripts/voices to make in the speakers' voices (its README, "Whose
// lines"): each line as RivendellWorld says it. The argument at the Council,
// the Fellowship falling in behind you, the toasts, and Bilbo's riddles by
// his fire, with what he says to your answers (not "No, no!" and the answer,
// which is made up as you go).
import { toastLines } from '../voice';
import { COMPANIONS } from './layout';
import { RIDDLES } from './rules';
import { ARGUMENT, RIDDLE_SAYS, SAYS } from './story';

const R = RIDDLE_SAYS;
const bilbo = [R.start, ...R.right, R.out, R.beaten, R.mine, ...RIDDLES.map((r) => r.q)];

export const VOICELINES = [
  ...ARGUMENT.filter((a) => a.voice).map((a) => ({ who: a.voice, text: a.line })),
  ...COMPANIONS.map((c) => ({ who: c.look, text: c.joins })),
  ...toastLines(SAYS),
  ...bilbo.map((text) => ({ who: 'bilbo', text })),
];
