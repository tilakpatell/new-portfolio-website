// Rivendell, the story: the five things to do, in the films' order, and
// what's said on the way. The valley is in ./layout.js, the games (the
// shards, the Council, Bilbo's hand, the Nine) in ./rules.js.

import { progress } from '../story';

export const QUESTS = [
  {
    id: 'awake',
    name: 'The house of Elrond',
    where: 'A room in the house of Elrond',
    blurb: 'Wake after the Ford, with Gandalf at your bedside.',
    go: 'You wake in a bed by a window full of light. Someone is sitting in the chair beside you.',
  },
  {
    id: 'narsil',
    name: 'The blade that was broken',
    where: 'The hall of Narsil, on the north terrace',
    blurb: 'Boromir drops the shards of Narsil. Lay them back in their order.',
    go: 'Explore the valley. In the hall of Narsil to the north, someone is looking at the shards of the sword that was broken.',
    needs: 'awake',
    locked: 'Once you’re up.',
  },
  {
    id: 'council',
    name: 'The Council of Elrond',
    where: 'The court on the spur over the gorge',
    blurb: 'Hear the Free Peoples out; then stand, and say who will take it.',
    go: 'Elrond has called a council. Go to the round court on the spur over the river.',
    needs: 'narsil',
    locked: 'When all are come.',
  },
  {
    id: 'bilbo',
    name: 'My old ring',
    where: 'Bilbo’s pavilion, to the south-west',
    blurb: 'Bilbo has gifts for you. Keep the Ring from him, gently.',
    go: 'Dusk. Bilbo wants to see you before you go, in his pavilion to the south-west.',
    needs: 'council',
    locked: 'After the Council.',
  },
  {
    id: 'fellowship',
    name: 'The Fellowship sets out',
    where: 'About the valley, then the south gate',
    blurb: 'Gather the eight who go with you, and lead them out of the gate.',
    go: 'Morning. Gather the Fellowship from about the valley, then lead them out by the south gate.',
    needs: 'bilbo',
    locked: 'After Bilbo’s gifts.',
  },
];

// the seal each one wins (../../../Achievements.jsx)
export const SEAL = { awake: 'elrond', narsil: 'narsil', council: 'iwilltakeit', bilbo: 'oldring', fellowship: 'fellowship' };

// What's open and next, the objective, and the light: a golden autumn
// afternoon until the Council, dusk for Bilbo, a clear cold morning to
// set out in, and after.
export function rivendellProgress(done = []) {
  const p = progress(QUESTS, done);
  const has = (id) => p.done.includes(id);
  const sky = has('bilbo') ? 'dawn' : has('council') ? 'dusk' : 'day';
  const next = p.quests.find((q) => q.id === p.next);
  const objective = p.finished ? 'The Fellowship has gone south. Rivendell is quiet, and the falls go on.' : next.go;
  return { ...p, objective, sky };
}

// ── what's said ──
// Conversations (../talk.js). The films' lines where the films have them.

export const CONVOS = {
  // in bed, with Gandalf in the chair
  awake: {
    start: 'where',
    nodes: {
      where: { who: 'frodo', say: '“Where am I?”', next: 'house' },
      house: { who: 'gandalf', say: '“You are in the house of Elrond. And it is ten o’clock in the morning, on October the twenty-fourth, if you want to know.”', next: 'gandalf' },
      gandalf: { who: 'frodo', say: '“Gandalf!”', next: 'lucky' },
      lucky: { who: 'gandalf', say: '“Yes, I’m here. And you’re very lucky to be here, too. A few more hours and you would have been beyond our aid. But you have some strength in you, my dear hobbit.”', choices: [{ text: '“What happened, Gandalf? Why didn’t you meet us?”', to: 'delayed' }, { text: '“Where are the others?”', to: 'sam' }] },
      delayed: { who: 'gandalf', say: 'He is quiet a moment, looking at the window. “I’m sorry, Frodo. I was delayed.”', next: 'sam' },
      sam: { who: 'sam', say: 'The door bursts open. “Frodo! Bless you, you’re awake!”', next: 'side' },
      side: { who: 'gandalf', say: '“Samwise has hardly left your side.”', next: 'welcome' },
      welcome: { who: 'elrond', say: 'A tall elf comes in behind him, grave and kind. “Welcome to Rivendell, Frodo Baggins.”', end: 'won' },
    },
  },
  // the hall of Narsil, Boromir at the shards
  narsil: {
    start: 'shards',
    nodes: {
      shards: { who: 'boromir', say: '“The shards of Narsil. The blade that cut the Ring from Sauron’s hand.”', next: 'sharp' },
      sharp: { who: 'boromir', say: 'He runs his thumb along the broken edge, and draws blood. “Still sharp.”', next: 'heirloom' },
      heirloom: { who: 'boromir', say: '“But no more than a broken heirloom.” He lets the hilt fall, and the shards slide off the cloth across the floor, and he goes.', next: 'yours' },
      yours: { who: 'narrator', say: 'Aragorn steps out of the shadow by the painting, and kneels by the shards. Help him lay them back as they were.', end: 'won' },
    },
  },
  // the Council, up to the moment someone must say it
  council: {
    start: 'summoned',
    nodes: {
      summoned: { who: 'elrond', say: '“Strangers from distant lands, friends of old. You have been summoned here to answer the threat of Mordor. Middle-earth stands upon the brink of destruction. None can escape it.”', next: 'forth' },
      forth: { who: 'elrond', say: '“Bring forth the Ring, Frodo.”', choices: [{ text: 'Set the Ring on the plinth.', to: 'set' }] },
      set: { who: 'narrator', say: 'You set it down on the stone. Every eye in the court goes to it, and someone whispers: “So it is true.”', next: 'gift' },
      gift: { who: 'boromir', say: '“It is a gift. A gift to the foes of Mordor. Why not use this Ring?”', next: 'wield' },
      wield: { who: 'aragorn', say: '“You cannot wield it. None of us can. The One Ring answers to Sauron alone. It has no other master.”', next: 'ranger' },
      ranger: { who: 'boromir', say: '“And what would a Ranger know of this matter?”', next: 'aragorn' },
      aragorn: { who: 'legolas', say: '“This is no mere Ranger. He is Aragorn, son of Arathorn. You owe him your allegiance.”', next: 'destroyed' },
      destroyed: { who: 'elrond', say: '“The Ring must be destroyed.”', next: 'waiting' },
      waiting: { who: 'gimli', say: '“Then what are we waiting for?”', end: 'won' },
    },
  },
  // after Gimli's axe: one does not simply walk into Mordor
  axe: {
    start: 'craft',
    nodes: {
      craft: { who: 'elrond', say: '“The Ring cannot be destroyed, Gimli, son of Glóin, by any craft that we here possess. It must be taken deep into Mordor and cast back into the fiery chasm from whence it came. One of you must do this.”', next: 'walk' },
      walk: { who: 'boromir', say: '“One does not simply walk into Mordor.”', end: 'won' },
    },
  },
  // after "I will take it"
  fellowship: {
    start: 'help',
    nodes: {
      help: { who: 'gandalf', say: '“I will help you bear this burden, Frodo Baggins, as long as it is yours to bear.”', next: 'sword' },
      sword: { who: 'aragorn', say: '“If by my life or death I can protect you, I will. You have my sword.”', next: 'bow' },
      bow: { who: 'legolas', say: '“And you have my bow.”', next: 'axe' },
      axe: { who: 'gimli', say: '“And my axe.”', next: 'gondor' },
      gondor: { who: 'boromir', say: '“You carry the fate of us all, little one. If this is indeed the will of the Council, then Gondor will see it done.”', next: 'sam' },
      sam: { who: 'sam', say: 'Out of the bushes: “Here! Mr. Frodo’s not going anywhere without me.”', next: 'secret' },
      secret: { who: 'elrond', say: '“No indeed. It is hardly possible to separate you, even when he is summoned to a secret council and you are not.”', next: 'merry' },
      merry: { who: 'merry', say: '“Wait! We’re coming too!”', next: 'pippin' },
      pippin: { who: 'pippin', say: '“Anyway, you need people of intelligence on this sort of… mission… quest… thing.”', next: 'rules' },
      rules: { who: 'merry', say: '“Well, that rules you out, Pip.”', next: 'nine' },
      nine: { who: 'elrond', say: '“Nine companions. So be it. You shall be the Fellowship of the Ring.”', next: 'where' },
      where: { who: 'pippin', say: '“Great! Where are we going?”', end: 'won' },
    },
  },
  // Bilbo, in his pavilion, with his gifts
  bilbo: {
    start: 'sting',
    nodes: {
      sting: { who: 'bilbo', say: '“My old sword. Sting. Here, take it, take it.”', next: 'shirt' },
      shirt: { who: 'bilbo', say: '“And my mithril shirt. It’s light as a feather, and as hard as dragon scales.”', next: 'old' },
      old: { who: 'bilbo', say: 'His voice drops. “I’m old now, Frodo. I don’t suppose… I don’t suppose you’d let me hold it again? My old ring, one last time?”', end: 'won' },
    },
  },
  // after he's let go
  sorry: {
    start: 'sorry',
    nodes: {
      sorry: { who: 'bilbo', say: 'His face is his own again, and he is crying. “I’m sorry that you’ve come to bear this burden. I’m sorry for everything.”', end: 'won' },
    },
  },
  // at the gate, the morning they set out
  gate: {
    start: 'blessing',
    nodes: {
      blessing: { who: 'elrond', say: '“The Ring-bearer is setting out on the Quest of Mount Doom. May the blessings of Elves and Men and all free folk go with you.”', next: 'awaits' },
      awaits: { who: 'gandalf', say: '“The Fellowship awaits the Ring-bearer.”', next: 'horn' },
      horn: { who: 'narrator', say: 'Boromir lifts the Horn of Gondor and blows a great blast on it. Elrond and Gandalf exchange a look.', next: 'which' },
      which: { who: 'frodo', say: 'Quietly: “Mordor, Gandalf, is it left or right?”', next: 'left' },
      left: { who: 'gandalf', say: '“Left.”', end: 'won' },
    },
  },
};

// Who says what in a conversation's bubble
export const SPEAKERS = { frodo: 'Frodo', gandalf: 'Gandalf', sam: 'Samwise Gamgee', elrond: 'Elrond', boromir: 'Boromir', aragorn: 'Aragorn', legolas: 'Legolas', gimli: 'Gimli', merry: 'Merry Brandybuck', pippin: 'Pippin Took', bilbo: 'Bilbo Baggins', narrator: '' };
