// What Jack (and Mr Gibbs) say on the Caribbean page that has no recording
// of its own (lib/clips.js has the ones that do), so ./voicelines.js can have
// it made in their voices.

// Dead Man's Tide (./tide/DeadMansTide.jsx), when one of theirs goes down: a
// boss's own line, or else the next of his sayings
export const SUNK_LINE = ['Sunk', 'Savvy?', 'Take what you can', 'Give nothing back'];
export const SUNK_BOSS = { fort: 'The fort is silenced', kraken: 'The beast is dead', ghost: 'Back to the locker with her' };

// The jar of dirt (./Effects.jsx), a press at a time: the prompt, the two
// lines his own recording says (lib/clips.js's jarOfDirt), and what's inside
export const JAR = ['Press the jar.', 'I’ve got a jar of dirt!', 'I’ve got a jar of dirt, and guess what’s inside it?', 'Something that beats. Don’t tell the captain of the Dutchman.'];
export const JAR_HEART = JAR.length - 1;

// Mr Gibbs on his wanted poster (pages/Caribbean.jsx), a press at a time,
// round and round: each piece of bad luck he knows, in his own voice. (The
// first never shows: the poster's charge is there until you ask.)
export const GIBBS = ['Press it again. Never trust the first telling.', 'It’s frightful bad luck to have a woman aboard. Worse luck to say so near Miss Swann.', 'Never wake a man who’s sleeping. Bad luck. Mostly for me.', 'A ship with black sails, crewed by the damned? Aye. You’re standing on her.', 'Mark my words: whatever that was, it’s bad luck.'];
// the next he says after the one shown (0: none yet)
export const nextGibbs = (n) => (n % (GIBBS.length - 1)) + 1;
