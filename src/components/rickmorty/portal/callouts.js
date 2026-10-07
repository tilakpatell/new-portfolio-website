// What Portal panic calls out (./PortalPanic.jsx), and how the ones that
// are somebody talking are said aloud: in the show's own recording where
// the site has one (lib/clips.js), else in the speaker's voice where it's
// been made (lib/voiced.js; ./voicelines.js lists those). The rest (a
// wave, a pickup, a boss's name) are only read.

// as a life starts, by hero
export const OPENER = { rick: 'Wubba lubba dub dub!', morty: 'Oh geez, here we go', pickle: 'I’m Pickle Riiick!' };
// as a boss comes in (the Cromulon's is his own clip, played with it)
export const BOSS_LINE = { snowball: 'Snowball wants a word', cronenberg: 'That’s a big one, Rick', cromulon: 'SHOW ME WHAT YOU GOT', evilmorty: 'Evil Morty' };
// under the score when a life's lost, by hero
export const LOST_LINE = {
  rick: 'One Rick down. There are infinitely many more.',
  morty: 'Aw geez. Aw geez, Rick.',
  pickle: 'Pickle Rick got pickled.',
};
// a long combo, the first Meeseeks out, the first shot the butter robot stops, and Szechuan sauce
export const COMBO = 'Wubba lubba dub dub!';
export const MEESEEKS = 'I’m Mr. Meeseeks! Look at me!';
export const PURPOSE = 'What is my purpose? You stop shots.';
export const SAUCE = 'Szechuan sauce!';

// How each spoken one is said: `clip`, the show's recording (and `then`,
// a reply in somebody's voice once it's done), or `who`, whose voice.
export const ALOUD = {
  [OPENER.rick]: { clip: 'wubba' },
  [OPENER.pickle]: { clip: 'pickleRick' },
  [OPENER.morty]: { who: 'morty' },
  [BOSS_LINE.cronenberg]: { who: 'morty' },
  [LOST_LINE.morty]: { who: 'morty' },
  [MEESEEKS]: { clip: 'meeseeks' },
  [PURPOSE]: { clip: 'purpose', then: { who: 'rick', text: 'You stop shots.' } },
  [SAUCE]: { who: 'rick' },
};
