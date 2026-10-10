// What Banner would tell you, as each new thing comes down the avenue
// (SmashRun.jsx): given whether you run with a keyboard (else by touch).
export const TEACH = {
  soldier: (keys) => (keys ? 'Chitauri on foot. Smash them as they come into reach: Space, or click.' : 'Chitauri on foot. Tap to smash them as they come into reach.'),
  barricade: (keys) => (keys ? 'A barricade. Smash through it, or leap it: ↑.' : 'A barricade. Smash through it, or swipe up to leap it.'),
  car: () => 'Wrecked cars. Smash one for big points, or leap it.',
  crater: (keys) => (keys ? 'Craters. You can’t smash a hole: leap just before the edge.' : 'Craters. You can’t smash a hole: swipe up just before the edge.'),
  barrier: (keys) => (keys ? 'Energy walls. Nothing goes through those, not even you. Change lanes: ← →.' : 'Energy walls. Nothing goes through those, not even you. Swipe sideways.'),
  chariot: () => 'Chariots. A lane glowing red is about to burn: get out of it, or be in the air when it goes up.',
};

// And what he says the first time something gets you, by what it was, and as
// the Time Stone's taken (the first time, and again).
export const HIT = {
  barrier: 'Not even Hulk goes through an energy wall. Change lanes.',
  crater: 'Leap a crater, a moment before the edge.',
  chariot: 'When a lane glows red, leave it, or leap as the fire comes.',
};
export const STONE = {
  first: 'The Time Stone is yours: the Ancient One would have let you have it. Keep running.',
  again: 'The Time Stone again. Keep running.',
};

// all of it, either way it's played: what can be said in his own voice (lib/voiced.js)
// ("HULK SMASH." is the film's own clip)
export const SPOKEN = [...new Set([...Object.values(TEACH).flatMap((t) => [t(true), t(false)]), ...Object.values(HIT), ...Object.values(STONE)])];
