// What Albuquerque's people say aloud with no recording of their own, for
// scripts/voices to make in their voices (its README: "Whose lines"): the
// cast cards' answers that are them talking (Cast.jsx), Saul in his office in
// the world (world/places.jsx: his pitch, and the superlab), and Hank's raid
// on the laundry (metherria/Metherria.jsx). Metherria's customers are read by
// export-lines itself.
import { CAST, SAUL } from './people';
import { HANK } from './metherria/rules';

export const VOICELINES = [
  ...CAST.filter((c) => c.said).map((c) => ({ who: c.id, text: c.done })),
  { who: 'saul', text: SAUL.pitch },
  { who: 'saul', text: SAUL.superlab },
  ...Object.values(HANK).map((text) => ({ who: 'hank', text })),
];
