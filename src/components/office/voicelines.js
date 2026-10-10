// What the Scranton page's people say aloud, for scripts/voices to make in
// their own voices (its README, "Whose lines"): Dwight's verdicts in the fact
// check, each one and the round's (the two the show said out loud play
// that), and what the people on the floor plan say when you do their thing.
// Read from the page's own data, so an edited line is made again. The
// walkable office has its own (./world/voicelines.js).

import { ABOUT_ME, ABOUT_THE_BRANCH, VERDICTS } from './facts';
import { STAFF } from './layout';

export const VOICELINES = [
  ...[...ABOUT_ME, ...ABOUT_THE_BRANCH].filter((f) => !f.clip).map((f) => ({ who: 'dwight', text: f.dwight })),
  ...Object.values(VERDICTS).map((text) => ({ who: 'dwight', text })),
  ...STAFF.filter((s) => s.said && s.done).map((s) => ({ who: s.id, text: s.done })),
];
