// What the site-wide eggs say aloud with no clip of their own, for
// scripts/voices to make in each speaker's voice (its README, "Whose
// lines"): the hidden collectibles' quotes with a `voice` (./eggs.js), and
// the tricks' lines (./said.js), each as the site passes it to sayVoiced.

import { EGGS } from './eggs';
import { SAID } from './said';

export const VOICELINES = [
  ...Object.values(EGGS)
    .filter((e) => e.voice)
    .map((e) => ({ who: e.voice, text: e.quote })),
  ...Object.values(SAID),
];
