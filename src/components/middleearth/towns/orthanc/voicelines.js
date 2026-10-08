// What's said aloud in Orthanc past what export-lines.mjs finds in the
// conversations, for scripts/voices to make in the speakers' voices (its
// README, "Whose lines"): each line as OrthancWorld says it. The Voice of
// Saruman at the windows (shown as 'voice', said in Saruman's), and his toast.
import { toastLines, voicedNodes } from '../voice';
import { CONVOS, SAYS } from './story';

export const VOICELINES = [...voicedNodes(CONVOS), ...toastLines(SAYS)];
