// What the page's toys say (the butter robot, the Meeseeks box and the
// interdimensional cable), and who says it aloud: kept as data, so the
// voices can be made from it (./voicelines.js, scripts/voices).

// The butter robot (./ButterRobot.jsx): where it is on the table (0 by the
// plate, 1 by the butter), whether it's carrying the butter, and what it
// says (its "What is my purpose?" is its own clip; `who` says the rest, and
// Rick's line is shown as his).
export const BUTTER = {
  off: { x: 0.27, line: 'It’s switched off.' },
  awake: { x: 0.27, line: 'What is my purpose?' },
  fetch: { x: 0.79, line: '…' },
  bring: { x: 0.27, carry: true, line: '…' },
  served: { x: 0.27, line: 'What is my purpose?' },
  told: { x: 0.27, line: 'Oh my god.', sad: true, who: 'butterrobot' },
  club: { x: 0.27, line: 'Yeah, welcome to the club, pal.', sad: true, who: 'rick' },
};

// A Mr. Meeseeks (./MeeseeksBox.jsx): his hello (his own clip), the help he
// summons for a task he can't do, the tasks he can ("Can do!" is his clip,
// and turning the site green has the portal theme's own line), and letting
// them all go.
export const MEESEEKS = {
  hello: 'I’m Mr. Meeseeks! Look at me!',
  stress: ['Ooh, a tough one! Let me get some help.', 'I’m Mr. Meeseeks. We’re working on it.', 'Two strokes. Just two strokes off his game!', 'Existence is pain to a Meeseeks, Jerry!', 'We’ve been at this for HOURS.', 'Everybody’s a Meeseeks. Nobody can do it!'],
  done: { green: 'Ooh, can do! *poof*', top: 'All done! *poof*', shake: 'Shaken! *poof*' },
  letGo: 'Ok, we’re done. Everybody *poof*.',
};
// what's said aloud of a Meeseeks' line: not the *poof*
export const aloud = (line) => line.replace(/\s*\*[^*]*\*/g, '');

// The cable (./Cable.jsx): each channel's little scene, its line from the
// show's improvised ads and shows, and who says it (the shows' announcer
// for the ones with no face of their own).
export const CHANNELS = [
  { id: 'doors', title: 'Real Fake Doors', who: 'realfakedoors', line: 'Hey, are you tired of real doors cluttering up your house? Come on down to Real Fake Doors!' },
  { id: 'balls', title: 'Ball Fondlers', who: 'cableannouncer', line: 'Tonight, on Ball Fondlers: the Ball Fondlers are back, and they mean business.' },
  { id: 'van', title: 'Two Brothers', who: 'cableannouncer', line: 'Two brothers. In a van. On the way to the dinner of their lives.' },
  { id: 'field', title: 'Gazorpazorpfield', who: 'gazorpazorpfield', line: 'I hate Mondays, Jon. Bring me my enchiladas.' },
  { id: 'legs', title: 'Baby Legs', who: 'cableannouncer', line: 'He’s a regular detective, but he’s got baby legs.' },
  { id: 'plumbus', title: 'How They Do It: Plumbus', who: 'cableannouncer', line: 'First they take the dinglebop, and they smooth it out with a bunch of schleem.' },
];
