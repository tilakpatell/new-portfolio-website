// What's said aloud in Weathertop's toasts, for scripts/voices to make in
// the speakers' voices (its README, "Whose lines"): each line as
// WeathertopWorld says it (Strider's in Aragorn's voice). Its conversations
// export-lines.mjs lists; the Nazgûl have no voice (lib/voiced.js).
import { toastLines } from '../voice';
import { SAYS } from './story';

export const VOICELINES = toastLines(SAYS);
