// The Citadel of Ricks, the story: the five things to do, and Mortytown's
// Locos beside them; what's said at the Council and the ballot box, and how
// the Cop Ricks hunt. The place itself is in ./layout.js (and Mortytown in
// ./mortytown.js).

import { progress } from '../../middleearth/towns/story';

const THREE = ['daycare', 'wafers', 'council'];

export const QUESTS = [
  {
    id: 'daycare',
    name: 'Morty Day Care',
    where: 'The pen on the west side',
    blurb: 'Six Mortys are loose. Get them back in before the Day Care Rick looks up.',
    go: 'Morty Day Care’s gate is open and its Mortys are loose. Get them back in before the Day Care Rick looks up.',
  },
  {
    id: 'wafers',
    name: 'Simple Rick’s',
    where: 'The wafer factory, on the east side',
    blurb: 'Stack three good wafers on Simple Rick’s line.',
    go: 'Simple Rick’s is short a Rick on the line. Stack three good wafers.',
  },
  {
    id: 'council',
    name: 'The Council of Ricks',
    where: 'The chamber at the north end',
    blurb: 'Answer the Council, and whatever you do, don’t grovel.',
    go: 'The Council of Ricks would like a word with Rick C-137. Their doors are at the north end.',
  },
  {
    id: 'votemorty',
    name: 'Vote Morty',
    where: 'Candidate Morty’s booth, in the north-west',
    blurb: 'Hear out three voters, then cast your ballot.',
    go: 'It’s election day. Hear out three voters, then cast your ballot at Candidate Morty’s booth.',
    needs: THREE,
    locked: 'After the day care, the wafers and the Council.',
  },
  {
    id: 'citadelout',
    name: 'Get to the cruiser',
    where: 'The hangar, in the south-east',
    blurb: 'Get past the Cop Ricks to your cruiser.',
    go: 'Candidate Morty won, and his first order is your arrest. Get to the cruiser in the hangar without the Cop Ricks seeing you.',
    needs: 'votemorty',
    locked: 'After the election.',
  },
  // on the side, any time after the day care: listed last, so the story's
  // next step always comes first
  {
    id: 'locos',
    name: 'The Mortytown Locos',
    where: 'Mortytown, down the lift in the south-west',
    blurb: 'Find the three Locos who robbed Morty Mart, and walk each one to Cop Morty.',
    go: 'Morty Mart’s been robbed. The Locos are hiding somewhere in Mortytown. Find all three and walk each one to Cop Morty.',
    needs: 'daycare',
    locked: 'After the day care.',
  },
];

// the seal each one wins (../../Achievements.jsx)
export const SEAL = { daycare: 'daycare', wafers: 'wafers', council: 'council', votemorty: 'votemorty', citadelout: 'citadelout', locos: 'locos' };

// The Citadel's mood: an ordinary day, election day once the first three
// are done, a red alert once Candidate Morty has won, and an ordinary day
// again once you're out.
export function moodOf(done = []) {
  const has = (id) => done.includes(id);
  return has('votemorty') && !has('citadelout') ? 'red' : THREE.every(has) && !has('votemorty') ? 'election' : 'day';
}

// What's open and next, the objective, and the mood.
export function citadelProgress(done = []) {
  const p = progress(QUESTS, done);
  const mood = moodOf(p.done);
  const next = p.quests.find((q) => q.id === p.next);
  const objective = p.finished ? 'The Citadel’s behind you. Portal home, or look round once more.' : next.go;
  return { ...p, objective, mood };
}

// ── what's said ──
// Conversations (../../middleearth/towns/talk.js), in the show's voice.

export const CONVOS = {
  // the chamber, before the high bench
  council: {
    start: 'enter',
    nodes: {
      enter: { who: 'councila', say: 'Three Ricks look down from the high bench. “Rick C-137. The Council of Ricks has some questions for you.”', next: 'charge' },
      charge: {
        who: 'councilb',
        say: '“Twenty-seven Ricks are dead and their Mortys taken. Every trail leads back to you. What do you have to say for yourself?”',
        choices: [
          { text: '“Wasn’t me. Some other Rick. One of the hundreds of guys in here with my face.”', to: 'face' },
          { text: '“Please, your honours. I’ll cooperate fully.”', to: 'grovel' },
          { text: '“I was at home all week, watching interdimensional cable with my Morty.”', to: 'alibi' },
        ],
      },
      grovel: { who: 'councilc', say: '“Grovelling? From C-137? Now we know you’re hiding something. Contempt of Council.”', next: 'charge' },
      alibi: { who: 'councila', say: '“Your Morty was in day care all week. We checked. Contempt of Council.”', next: 'charge' },
      face: {
        who: 'councilc',
        say: '“Convenient. Then why won’t you wear a tracker, like every other Rick in the Citadel?”',
        choices: [
          { text: '“Because I’m not a dog. You lot, I’m less sure about.”', to: 'dog' },
          { text: '“I lost it. Very sorry.”', to: 'lost' },
        ],
      },
      lost: { who: 'councilb', say: '“Lost it. In a disintegration ray, no doubt. Contempt of Council.”', next: 'face' },
      dog: { who: 'councila', say: 'The three of them lean together and mutter behind their hands. Somewhere a gavel is found.', next: 'dismissed' },
      dismissed: { who: 'councilb', say: '“Dismissed. Get out of our chamber, C-137.”' },
    },
  },
  // Candidate Morty's booth, on election day
  ballot: {
    start: 'booth',
    nodes: {
      booth: { who: 'evilmorty', say: '“Vote Morty. A Citadel for all of us.” He holds out a ballot, and doesn’t blink.', next: 'cast' },
      cast: {
        who: 'pa',
        say: 'The ballot has three boxes.',
        choices: [
          { text: 'Candidate Morty', to: 'morty' },
          { text: 'The Rick in the good suit', to: 'suit' },
          { text: 'Write in: Rick C-137', to: 'c137' },
        ],
      },
      morty: { who: 'evilmorty', say: '“Smart choice.”', next: 'count' },
      suit: { who: 'evilmorty', say: '“Sure. Him.” He smiles, for the first time.', next: 'count' },
      c137: { who: 'evilmorty', say: '“Rick C-137. Interesting.” He writes something down.', next: 'count' },
      count: { who: 'pa', say: 'Chimes, all over the Citadel. “The count is in. Candidate Morty wins in a landslide.”', next: 'speech' },
      speech: { who: 'evilmorty', say: '“Thank you. My first order as president: Rick C-137 is under arrest.”' },
    },
  },
};

// Who says what in a conversation
export const SPEAKERS = {
  councila: 'Council Rick',
  councilb: 'Zeta Alpha Rick',
  councilc: 'Ricktiminus Sancheziminius',
  evilmorty: 'Candidate Morty',
  pa: 'The Citadel’s PA',
  rick: 'Rick C-137',
};

// ── the Cop Ricks ──
// Evil Morty's Cop Ricks on red alert (../../middleearth/towns/watchers.js):
// a wider, longer look than the Nazgûl and quicker on their feet, but no
// Ring to see you by.
export const COPS = { sight: 11, cone: 0.55, smell: 1.6, hear: 4, ringSight: 0, alert: 0.7, chase: 5.2, patrol: 1.6, giveUp: 6, leash: 16, catch: 1, look: 1.6, far: 1.8, suspicious: 0.5, search: 10 }; // (far, suspicious, search: the cops take a second to clock a Morty, come to look, and sweep the concourse together)
