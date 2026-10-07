// Bree, the story: the five things to do, in the films' order, what's said
// on the way, and how the Nazgûl hunt. The town itself is in ./layout.js.

import { progress } from '../story';

export const QUESTS = [
  {
    id: 'gate',
    name: 'What’s your business in Bree?',
    where: 'The West Gate',
    blurb: 'Knock at the gate in the rain, and answer the gatekeeper.',
    go: 'Bree, in the rain. Knock at the West Gate.',
  },
  {
    id: 'pony',
    name: 'Mr. Underhill',
    where: 'The Prancing Pony',
    blurb: 'Ask Barliman Butterbur for Gandalf. Mind what name you give.',
    go: 'The Prancing Pony is up the high street, on the left. Go in and ask for Gandalf.',
    needs: 'gate',
    locked: 'Once you’re through the gate.',
  },
  {
    id: 'pints',
    name: 'It comes in pints?',
    where: 'Butterbur’s tap, in the Pony',
    blurb: 'Pippin has found out it comes in pints. Pour him three good ones.',
    go: 'Pippin has found out it comes in pints. Pour him three good ones, in the Pony.',
    needs: 'pony',
    locked: 'Inside the Pony.',
  },
  {
    id: 'strider',
    name: 'Not nearly frightened enough',
    where: 'The corner by the fire, in the Pony',
    blurb: 'Ask who the hooded man in the corner is, and keep the Ring off.',
    go: 'A hooded man has been watching you from the corner of the Pony. Ask Butterbur who he is.',
    needs: 'pints',
    locked: 'After Pippin’s pints.',
  },
  {
    id: 'slip',
    name: 'Through Bree unseen',
    where: 'The East Gate',
    blurb: 'Get to Strider at the East Gate without the Nazgûl seeing you.',
    go: 'The Black Riders are in Bree. Get to Strider at the East Gate unseen: keep out of their sight, and out of smelling distance.',
    needs: 'strider',
    locked: 'After dark.',
  },
];

// the seal each one wins (../../../Achievements.jsx)
export const SEAL = { gate: 'breegate', pony: 'underhill', pints: 'pints', strider: 'strider', slip: 'slipaway' };

// What's open and next, the objective, and the time: a wet evening until
// Strider, night until you're through, then dawn.
export function breeProgress(done = []) {
  const p = progress(QUESTS, done);
  const has = (id) => p.done.includes(id);
  const sky = has('slip') ? 'dawn' : has('strider') ? 'night' : 'evening';
  const next = p.quests.find((q) => q.id === p.next);
  const objective = p.finished ? 'Dawn, and the rain has stopped. Strider is waiting at the East Gate with Sam and Bill the pony.' : next.go;
  return { ...p, objective, sky, gateOpen: has('gate'), smashed: has('strider'), eastOpen: has('slip') };
}

// ── what's said ──
// Conversations (../talk.js). The films' lines where the films have them.

export const CONVOS = {
  // Harry, through the hatch in the West Gate
  gate: {
    start: 'ask',
    nodes: {
      ask: {
        who: 'harry',
        say: 'A hatch in the gate slides open, and a lantern. “What’s your business in Bree?”',
        choices: [
          { text: '“We’re headed for the Prancing Pony.”', to: 'hobbits' },
          { text: '“We’re looking for Gandalf the Grey.”', to: 'gandalf' },
          { text: '“Open up! We’re soaked through.”', to: 'rude' },
        ],
      },
      gandalf: { who: 'harry', say: '“Never heard of him. State your business, or stay out there in the rain.”', next: 'ask' },
      rude: { who: 'harry', say: '“Not after dark, I don’t. Not for folk who won’t say what they want.”', next: 'ask' },
      hobbits: {
        who: 'harry',
        say: 'The lantern swings down to your height. “Hobbits! Four hobbits! What brings you this far out of the Shire?”',
        choices: [
          { text: '“We wish to stay at the inn. Our business is our own.”', to: 'sorry' },
          { text: '“We’re carrying something for a friend.”', to: 'careful' },
        ],
      },
      careful: { who: 'sam', say: 'Sam treads on your foot. “Mr. Frodo!” he hisses.', next: 'hobbits' },
      sorry: { who: 'harry', say: '“All right, young sir, I meant no offence. It’s my job to ask after nightfall. There’s strange folk abroad.”', next: 'open' },
      open: { who: 'harry', say: 'Bolts slide back, and the West Gate creaks open.', end: 'won' },
    },
  },
  // Barliman Butterbur, at the bar
  butterbur: {
    start: 'welcome',
    nodes: {
      welcome: {
        who: 'butterbur',
        say: '“Welcome, little masters! If you’re after rooms, we’ve some nice cosy hobbit-sized ones. Mr…?”',
        choices: [
          { text: '“Underhill. My name’s Underhill.”', to: 'underhill' },
          { text: '“Baggins. Frodo Baggins.”', to: 'baggins' },
        ],
      },
      baggins: { who: 'butterbur', say: 'The common room goes quiet. In the dark corner a hooded man looks up from his pipe. No one was to hear the name Baggins.', next: 'again' },
      again: { who: 'butterbur', say: '“Sorry, Mr…? Didn’t catch that, over the noise.”', choices: [{ text: '“Underhill.”', to: 'underhill' }] },
      underhill: { who: 'butterbur', say: '“Underhill. Yes.”', choices: [{ text: '“We’re friends of Gandalf the Grey. Can you tell him we’ve arrived?”', to: 'gandalf' }] },
      gandalf: { who: 'butterbur', say: '“Gandalf? Gandalf… Oh, yes! Elderly chap, big grey beard, pointy hat. Not seen him for six months.”', end: 'won' },
    },
  },
  // asking about the man by the fire
  ask: {
    start: 'who',
    nodes: {
      who: { who: 'frodo', say: '“That man in the corner. Who is he?”', next: 'ranger' },
      ranger: { who: 'butterbur', say: '“He’s one of them Rangers. Dangerous folk, wandering the wilds. What his right name is I’ve never heard, but round here he’s known as Strider.”', next: 'pippin' },
      pippin: { who: 'pippin', say: 'Across the room, Pippin, to a crowd of Bree-landers: “Baggins? Sure, I know a Baggins. He’s over there. Frodo Baggins!”', end: 'won' },
    },
  },
  // Strider, in his room, after the Ring
  strider: {
    start: 'attention',
    nodes: {
      attention: { who: 'strider', say: '“You draw far too much attention to yourself, Mr. Underhill.”', choices: [{ text: '“What do you want?”', to: 'want' }] },
      want: {
        who: 'strider',
        say: '“A little more caution from you. That is no trinket you carry.”',
        choices: [
          { text: '“I carry nothing.”', to: 'indeed' },
          { text: '“Who are you?”', to: 'frightened' },
        ],
      },
      indeed: { who: 'strider', say: '“Indeed. I can avoid being seen, if I wish. But to disappear entirely, that is a rare gift.”', next: 'frightened' },
      frightened: { who: 'strider', say: '“Are you frightened?”', choices: [{ text: '“Yes.”', to: 'enough' }] },
      enough: { who: 'strider', say: '“Not nearly frightened enough. I know what hunts you. They’re coming. Bill Ferny has opened the gate to them.”', end: 'won' },
    },
  },
};

// Who says what in a conversation's bubble
// the toasts someone speaks in (../voice.js); the pints poured, Pippin and
// then Merry
const PINT = { who: 'pippin', text: '“This is a pint!”' };
const PINTS = { who: 'merry', text: '“It comes in pints?! I’m getting one.”' };
export const SAYS = {
  pints: { who: 'pippin', text: 'Pippin: “It comes in pints?” Hold the tap, and let go with the head between the two lines.' },
  poured: { text: `Three good pints. Pippin: ${PINT.text} Merry: ${PINTS.text}`, lines: [PINT, PINTS] },
  spilt: { who: 'butterbur', text: 'Butterbur takes the jug off you. “Let me show you, little master.” Try again.' },
  east: { who: 'strider', text: 'Strider: “This way. Quickly, and quietly.” By dawn you’re through, and the rain has stopped.' },
};

export const SPEAKERS = { harry: 'Harry the gatekeeper', butterbur: 'Barliman Butterbur', strider: 'Strider', pippin: 'Pippin Took', sam: 'Samwise Gamgee', frodo: 'Frodo' };

// ── the Nazgûl ──
// Four on foot, walking the lanes (../watchers.js): they see in a narrow
// cone, but smell you close, and the Ring shows you to them from afar.
export const NAZGUL = { sight: 9, cone: 0.52, smell: 1.8, hear: 3.2, ringSight: 40, alert: 0.8, chase: 4.6, patrol: 1.25, giveUp: 7, leash: 14, catch: 0.9, look: 1.8, far: 2.4, suspicious: 0.45, search: 14 }; // (far, suspicious, search: ../watchers.js, on the AI toolkit: slow to be sure of a hobbit in the dark, quick to come and look, and they search the lanes together)

// The Ring, slipped on in the common room: how fast the Eye comes.
export const SLIP = { gaze: 0.42 };
