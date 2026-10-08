// What's said aloud in Lothlórien past its conversations and the people you
// walk up to (../voicelines.js), for scripts/voices to make in the speakers'
// voices (its README, "Whose lines"): each line as LorienWorld says it.
// Not Legolas's count of your arrows, which is made up as you shoot.
import { toastLines, voicedNodes } from '../voice';
import { ARCHERY, CONVOS, NOT_FOR, SAYS, THANKS } from './story';

const own = (lines) => Object.entries(lines).map(([who, text]) => ({ who, text }));
const legolas = [ARCHERY.start, ...ARCHERY.golds, ...ARCHERY.hits, ARCHERY.again, ARCHERY.trunk, ARCHERY.short, ARCHERY.low, ARCHERY.away, ARCHERY.tired, ARCHERY.perfect, ARCHERY.out];

export const VOICELINES = [...legolas.map((text) => ({ who: 'legolas', text })), ...own(THANKS), ...own(NOT_FOR), ...toastLines(SAYS), ...voicedNodes(CONVOS)];
