// What's said aloud in Bree's toasts, for scripts/voices to make in the
// speakers' voices (its README, "Whose lines"): each line as BreeWorld says
// it (Strider's in Aragorn's voice). Its conversations export-lines.mjs and
// ../voicelines.js list.
import { toastLines } from '../voice';
import { SAYS } from './story';

export const VOICELINES = toastLines(SAYS);
