// What's said aloud in the Dead Marshes past what export-lines.mjs finds in
// the conversations, for scripts/voices to make in the speakers' voices (its
// README, "Whose lines"): each line as MarshesWorld says it. Not Gollum's
// count of your falls at the pool, which is made up as you go.
import { toastLines, voicedNodes } from '../voice';
import { CONVOS, SAYS, WAY_SAYS } from './story';

const gollum = [WAY_SAYS.start, WAY_SAYS.shown, ...WAY_SAYS.safe, WAY_SAYS.lit, WAY_SAYS.sank, WAY_SAYS.again, WAY_SAYS.clean];

export const VOICELINES = [...gollum.map((text) => ({ who: 'gollum', text })), ...toastLines(SAYS), ...voicedNodes(CONVOS)];
