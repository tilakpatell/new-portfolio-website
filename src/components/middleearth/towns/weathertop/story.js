// Weathertop, the story: the five things to do, in the films' order, and
// what's said on the way. The land is in ./layout.js, the games (the fire,
// the brand, the kingsfoil, the ride) in ./rules.js.

import { progress } from '../story';

export const QUESTS = [
  {
    id: 'climb',
    name: 'Amon Sûl',
    where: 'The summit of Weathertop',
    blurb: 'Climb the old stair through the crags to the ruined watchtower on the hilltop.',
    go: 'Strider has gone up ahead. Climb the old stair to the ruin on the summit.',
  },
  {
    id: 'supper',
    name: 'Put it out, you fools!',
    where: 'The dell, on the hill’s western shoulder',
    blurb: 'Sam has the pan on. Stamp the fire out before the Nazgûl see it.',
    go: 'You wake in the dark to the smell of bacon. Down in the dell, the others have lit a fire. Go and put it out!',
    needs: 'climb',
    locked: 'After you’ve climbed.',
  },
  {
    id: 'brand',
    name: 'Fire against the dark',
    where: 'The ruin on the summit',
    blurb: 'Hold the summit with a burning brand against five Nazgûl until Strider comes.',
    go: 'They’re coming up the hill. Get to the top, to the ruin!',
    needs: 'supper',
    locked: 'Once the Nazgûl come.',
  },
  {
    id: 'athelas',
    name: 'Kingsfoil',
    where: 'The foot of the hill, by lantern',
    blurb: 'As Sam, find three plants of athelas while Frodo grows cold.',
    go: 'You’re Sam now. Find three plants of kingsfoil round the foot of the hill. They glow faintly when the lantern’s near.',
    needs: 'brand',
    locked: 'After the fight.',
  },
  {
    id: 'ford',
    name: 'The Flight to the Ford',
    where: 'The road to the Ford of Bruinen',
    blurb: 'Ride with Arwen on Asfaloth to the Ford of Bruinen, with the Nine behind.',
    go: 'Bring the kingsfoil back to Strider, at the foot of the stair.',
    needs: 'athelas',
    locked: 'Once Frodo is wounded.',
  },
];

// the seal each one wins (../../../Achievements.jsx)
export const SEAL = { climb: 'amonsul', supper: 'putitout', brand: 'weathertop', athelas: 'kingsfoil', ford: 'bruinen' };

// What's open and next, the objective, the time (dusk as you climb, night
// once you've lain down in the dell, then a grey dawn after the ford), and
// who you are (Sam, from the search for the kingsfoil until Arwen comes:
// Frodo is down).
export function weathertopProgress(done = []) {
  const p = progress(QUESTS, done);
  const has = (id) => p.done.includes(id);
  const sky = p.finished ? 'dawn' : has('climb') ? 'night' : 'dusk';
  const next = p.quests.find((q) => q.id === p.next);
  const objective = p.finished ? 'Frodo is safe in Rivendell. Dawn on Weathertop; the road goes on east.' : next.go;
  return { ...p, objective, sky, as: p.next === 'athelas' || p.next === 'ford' ? 'sam' : 'frodo', riders: has('supper') && !has('brand') };
}

// ── what's said ──
// Conversations (../talk.js). The films' lines where the films have them.

export const CONVOS = {
  // Strider, on the summit, as you come up
  amonsul: {
    start: 'tower',
    nodes: {
      tower: { who: 'strider', say: '“This was once the great watchtower of Amon Sûl.”', choices: [{ text: '“What happened to it?”', to: 'gone' }, { text: '“Can we rest here?”', to: 'rest' }] },
      gone: { who: 'strider', say: '“It was burned, long ago. Its stones remember the kings of old.”', next: 'rest' },
      rest: { who: 'strider', say: 'He hands you each a short sword. “These are for you. Keep them close. I’m going to have a look around. Stay here.”', end: 'won' },
    },
  },
  // the dell, as you wake
  supper: {
    start: 'what',
    nodes: {
      what: { who: 'frodo', say: '“What are you doing?”', next: 'bacon' },
      bacon: { who: 'pippin', say: '“Tomatoes, sausages, nice crispy bacon.”', next: 'saved' },
      saved: { who: 'sam', say: '“We saved some for you, Mr. Frodo.”', choices: [{ text: '“Put it out, you fools! Put it out!”', to: 'go' }] },
      go: { who: 'frodo', say: 'Every flame on the hillside can be seen for miles. Stamp it out, all of it, before they see it!', end: 'won' },
    },
  },
  // Strider, at the foot, with Frodo cold on the ground
  athelas: {
    start: 'plant',
    nodes: {
      plant: { who: 'strider', say: '“Sam! Do you know the athelas plant?”', next: 'what' },
      what: { who: 'sam', say: '“Athelas?”', next: 'kingsfoil' },
      kingsfoil: { who: 'strider', say: '“Kingsfoil.”', next: 'weed' },
      weed: { who: 'sam', say: '“Kingsfoil. Aye, it’s a weed.”', next: 'hurry' },
      hurry: { who: 'strider', say: '“It may help to slow the poison. Hurry!”', end: 'won' },
    },
  },
  // Arwen comes, at the foot of the stair
  arwen: {
    start: 'light',
    nodes: {
      light: { who: 'narrator', say: 'Strider bruises the kingsfoil into Frodo’s wound. Then a light on the road: a white horse, and a rider who shines.', next: 'fading' },
      fading: { who: 'arwen', say: '“He’s fading. He’s not going to last. We must get him to my father.”', next: 'voice' },
      voice: { who: 'arwen', say: '“Frodo. I’m Arwen. I’ve come to help you. Hear my voice. Come back to the light.”', next: 'rider' },
      rider: { who: 'arwen', say: '“I’m the faster rider. I’ll take him.”', next: 'hard' },
      hard: { who: 'strider', say: '“Arwen, ride hard. Don’t look back.”', end: 'won' },
    },
  },
  // at the ford, with the Nine on the far bank
  ford: {
    start: 'give',
    nodes: {
      give: { who: 'nazgul', say: 'The Nine draw up on the far bank. “Give up the halfling, she-elf!”', next: 'claim' },
      claim: { who: 'arwen', say: 'Arwen draws her sword. “If you want him, come and claim him!”', next: 'flood' },
      flood: { who: 'arwen', say: '“Nîn o Chithaeglir, lasto beth daer; rimmo nîn Bruinen dan in Ulaer!”', end: 'won' },
    },
  },
};

// Who says what in a conversation's bubble
// the toasts someone speaks in (../voice.js)
export const SAYS = {
  tomatoes: { who: 'pippin', text: 'Out, every last ember. Pippin: “Oh, that’s nice! Ash on my tomatoes!”' },
  cold: { who: 'strider', text: 'Frodo’s gone so cold. Strider: “Sam! Quickly!” Start again, and hurry.' },
};

export const SPEAKERS = { strider: 'Strider', sam: 'Samwise Gamgee', pippin: 'Pippin Took', merry: 'Merry Brandybuck', frodo: 'Frodo', arwen: 'Arwen', nazgul: 'The Nazgûl', narrator: '' };
