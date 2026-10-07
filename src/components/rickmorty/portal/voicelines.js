// Portal panic's callouts said in somebody's voice (./callouts.js: the ones
// with no clip of the show's own), as PortalPanic.jsx passes them to
// sayVoiced, for scripts/voices to make.

import { ALOUD } from './callouts';

export const VOICELINES = Object.entries(ALOUD).flatMap(([text, a]) => [...(a.who ? [{ who: a.who, text }] : []), ...(a.then ? [a.then] : [])]);
