// What the Invincible page's cards say aloud (./father.js: "Things your
// father said", and Dad's reply to the first), as pages/Invincible.jsx
// passes them to sayVoiced, for scripts/voices to make in their own voices.
// The city's and Think, Mark!'s are in ./world and ./thinkmark.
import { LINES, THINK_REPLY } from './father';

export const VOICELINES = [...LINES, THINK_REPLY].map((l) => ({ who: l.voice, text: l.said }));
