// What Jack says aloud on the Caribbean page with no recording of its own,
// for the voices (scripts/voices): the lines in ./lines.js, as the page shows them.
import { JAR, JAR_HEART, SUNK_BOSS, SUNK_LINE } from './lines';

export const VOICELINES = [...SUNK_LINE, ...Object.values(SUNK_BOSS), JAR[JAR_HEART]].map((text) => ({ who: 'jack', text }));
