// What's said aloud in Think, Mark!, for the voices (scripts/voices): each of
// ./rules.js's LINES as ./ThinkMark.jsx shows it, in the voice of the name
// it's under.
import { LINES } from './rules';

export const VOICE = { 'Omni-Man': 'omniman', Mark: 'mark', Thragg: 'thragg' };

export const VOICELINES = Object.values(LINES).map(([name, text]) => ({ who: VOICE[name], text }));
