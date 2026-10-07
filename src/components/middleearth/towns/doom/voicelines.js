// What's said aloud on Mount Doom past what export-lines.mjs finds in the
// conversations, for scripts/voices to make in the speakers' voices (its
// README, "Whose lines"): each line as DoomWorld says it. Remembering the
// Shire at the mountain's foot (Sam telling it, Frodo saying it back, and
// Sam's answers), but not Sam's count of how many to say back past two,
// which is made up as you go; the toasts; and the orcs, in Shagrat's voice.
import { toastLines, voicedNodes } from '../voice';
import { SHIRE } from './rules';
import { CONVOS, REMEMBER_SAYS, SAYS } from './story';

const R = REMEMBER_SAYS;
const remember = [R.start, R.first, R.right, ...R.rounds, R.wrong, R.all, R.seen, ...SHIRE.map((m) => ({ who: 'sam', say: m.say }))].flatMap((l) => [l, l.then].filter(Boolean));

export const VOICELINES = [...remember.map((l) => ({ who: l.who, text: l.say })), ...toastLines(SAYS), ...voicedNodes(CONVOS)];
