// What Jack and Mr Gibbs say aloud on the Caribbean page with no recording
// of their own, for the voices (scripts/voices): the lines in ./lines.js, as
// the page shows them (Gibbs's, as his poster's button goes round them).
import { GIBBS, JAR, JAR_HEART, SUNK_BOSS, SUNK_LINE, nextGibbs } from './lines';

export const VOICELINES = [
  ...[...SUNK_LINE, ...Object.values(SUNK_BOSS), JAR[JAR_HEART]].map((text) => ({ who: 'jack', text })),
  ...[...new Set(GIBBS.map((_, i) => nextGibbs(i)))].map((i) => ({ who: 'gibbs', text: GIBBS[i] })),
];
