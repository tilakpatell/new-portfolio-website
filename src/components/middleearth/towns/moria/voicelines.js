// What's said aloud in Moria's toasts, for scripts/voices to make in the
// speakers' voices (its README, "Whose lines"): each line as MoriaWorld says
// it. Its conversations export-lines.mjs finds itself, and the people you
// walk up to are ../voicelines.js's.
import { toastLines } from '../voice';
import { SAYS } from './story';

export const VOICELINES = toastLines(SAYS);
