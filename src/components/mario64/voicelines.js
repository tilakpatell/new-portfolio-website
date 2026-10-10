// What's said aloud in the castle and its courses, for the voices
// (scripts/voices): Toad's hints (./courses' toads' lines), King Bob-omb's
// taunt on the summit, and Peach's letter (the sign in the hall titled "A
// note": she reads it aloud in the game's intro), each as ./Mario64.jsx's
// dialog shows it.
import { AREAS } from './courses';
import { KING_TAUNT } from './rules/actors/foes';

// whose voice, by the name over the dialog (a sign's is nobody's, but for Peach's note)
export const VOICE = { Toad: 'toad', 'King Bob-omb': 'kingbobomb', 'A note': 'peach' };

const actors = Object.values(AREAS).flatMap((a) => a.actors ?? []);

export const VOICELINES = [
  ...actors.filter((a) => a.type === 'toad').flatMap((a) => (a.lines ?? []).map((text) => ({ who: VOICE[a.title ?? 'Toad'], text }))),
  ...actors.filter((a) => a.type === 'king').map((a) => ({ who: VOICE['King Bob-omb'], text: a.taunt ?? KING_TAUNT })),
  ...actors.filter((a) => a.type === 'sign' && VOICE[a.title]).map((a) => ({ who: VOICE[a.title], text: a.text })),
];
