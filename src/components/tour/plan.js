import { planFor } from '../../lib/tour';

// An audience's chapters as TourHost runs them and the guide lists them:
// one plan, so "chapter 4 of 10" agrees everywhere. `steps` is the steps.js
// module: its TOURS, and the shell's stops and each audience's hello when it
// gives them (chapters/shared.js); a touch screen takes heavy chapters'
// phone versions.
const coarse = () => typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches ?? false);

export const planOf = (steps, audience, view, here) => planFor(steps.TOURS, audience, view, here, { coarse: coarse(), shell: steps.SHELL_STOPS, hello: steps.HELLO });
