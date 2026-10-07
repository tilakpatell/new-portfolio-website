// Lothlórien, the story: the five things to do, in the films' order, and
// what's said on the way. The places are in ./layout.js, the games
// (Haldir's lead, the Mirror's pull, the gifts, the river) in ./rules.js.

import { progress } from '../story';

export const QUESTS = [
  {
    id: 'haldir',
    name: 'The golden wood',
    where: 'The border, over the Nimrodel',
    blurb: 'Into Lothlórien, where the Galadhrim have their bows drawn. Then follow Haldir to the city.',
    go: 'Out of Moria, grieving. Walk east into the golden wood.',
  },
  {
    id: 'caras',
    name: 'Caras Galadhon',
    where: 'The great mallorn, and its high flet',
    blurb: 'Climb the stair round the great tree, to the Lord and Lady of the wood.',
    go: 'Caras Galadhon, lit by its lanterns. Climb the stair round the great tree.',
    needs: 'haldir',
    locked: 'Once Haldir has brought you in.',
  },
  {
    id: 'mirror',
    name: 'The Mirror of Galadriel',
    where: 'The hollow south of the great tree',
    blurb: 'Look in the water, and keep the Ring from it. Then offer it to her.',
    go: 'Night, and the elves sing a lament for Gandalf. Galadriel has gone down to the hollow south of the great tree.',
    needs: 'caras',
    locked: 'After the Lady has seen you.',
  },
  {
    id: 'gifts',
    name: 'The gifts of the Lady',
    where: 'The landing on the Silverlode',
    blurb: 'Take each of Galadriel’s gifts from the table to the one it’s for.',
    go: 'Morning. The boats are ready at the landing to the east, and Galadriel’s gifts are on the table.',
    needs: 'mirror',
    locked: 'In the morning.',
  },
  {
    id: 'argonath',
    name: 'The Argonath',
    where: 'Down the Anduin',
    blurb: 'Steer the boat clear of the rocks, down the river to the Pillars of the Kings.',
    go: 'To the boats at the landing, and down the river.',
    needs: 'gifts',
    locked: 'Once the gifts are given.',
  },
];

// the seal each one wins (../../../Achievements.jsx)
export const SEAL = { haldir: 'goldenwood', caras: 'carasgaladhon', mirror: 'ipassthetest', gifts: 'earendil', argonath: 'argonath' };

// What's open and next, and the objective.
export function lorienProgress(done = []) {
  const p = progress(QUESTS, done);
  const next = p.quests.find((q) => q.id === p.next);
  const objective = p.finished ? 'Past the Argonath, to the falls of Rauros and Amon Hen. The Fellowship will break there.' : next.go;
  return { ...p, objective };
}

// ── what's said ──

export const CONVOS = {
  // the Galadhrim, bows drawn
  haldir: {
    start: 'voice',
    nodes: {
      voice: { who: 'galadriel', say: 'A voice in your head, low and clear: “Frodo… Welcome, Frodo of the Shire. One who has seen the Eye.”', next: 'bows' },
      bows: { who: 'narrator', say: 'And all round, out of the trees, elves with bows drawn. Arrows at every throat. Gimli’s beard bristles.', next: 'breathes' },
      breathes: { who: 'haldir', say: '“The dwarf breathes so loud we could have shot him in the dark.”', choices: [{ text: 'Look to Aragorn.', to: 'aragorn' }, { text: '“We mean no harm!”', to: 'harm' }] },
      harm: { who: 'haldir', say: 'Haldir’s bow does not move. He looks at you, and then at what hangs round your neck.', next: 'aragorn' },
      aragorn: { who: 'aragorn', say: 'Aragorn speaks to him in Elvish, low and courteous: “Haldir o Lórien. We come here for your help. We need your protection.”', next: 'gimli' },
      gimli: { who: 'gimli', say: '“Aragorn, these woods are perilous. We should go back!”', next: 'evil' },
      evil: { who: 'haldir', say: '“You have entered the realm of the Lady of the Wood. You cannot go back.” He looks long at you. “You bring great evil with you.” Then: “Come. She is waiting.”', end: 'won' },
    },
  },
  // the Lord and the Lady, on the flet
  caras: {
    start: 'light',
    nodes: {
      light: { who: 'narrator', say: 'Light at the top of the stair, and the Lord and Lady of the wood come down it, hand in hand, in white.', next: 'eight' },
      eight: { who: 'celeborn', say: '“The enemy knows you have entered here. The hope you had in secrecy is now gone. Eight there are here, yet nine there were set out from Rivendell. Tell me, where is Gandalf? For I much desire to speak with him.”', next: 'shadow' },
      shadow: { who: 'galadriel', say: '“Gandalf the Grey did not pass the borders of this land. He has fallen into shadow.”', next: 'knife' },
      knife: { who: 'galadriel', say: '“Your quest stands upon the edge of a knife. Stray but a little, and it will fail, to the ruin of all. Yet hope remains while the company is true.”', next: 'looks' },
      looks: { who: 'narrator', voice: 'galadriel', say: 'She looks at each of them in turn. Boromir looks away first. Then her eyes are on you, and her voice is in your head: “Do not let your heart be troubled.”', choices: [{ text: '(In your mind) “What do you want of me?”', to: 'want' }, { text: 'Hold her gaze.', to: 'hold' }] },
      want: { who: 'galadriel', say: '“Nothing that you will not give, Ring-bearer.” She smiles, and something in you eases.', next: 'rest' },
      hold: { who: 'galadriel', say: 'Her eyes are old as the wood. “You are braver than you know.”', next: 'rest' },
      rest: { who: 'galadriel', say: '“Go now and rest, for you are weary with sorrow and much toil. Tonight you will sleep in peace.”', end: 'won' },
    },
  },
  // the Mirror: before
  mirror: {
    start: 'look',
    nodes: {
      look: { who: 'galadriel', say: 'She pours water from the silver ewer into the basin. “Will you look into the Mirror?”', next: 'what' },
      what: { who: 'frodo', say: '“What will I see?”', next: 'wisest' },
      wisest: { who: 'galadriel', say: '“Even the wisest cannot tell. For the Mirror shows many things: things that were, things that are, and some things that have not yet come to pass.”', choices: [{ text: 'Look into the water.', to: 'go' }] },
      go: { who: 'narrator', say: 'You step up to the basin, and look down. Stars. Then smoke.', end: 'won' },
    },
  },
  // the Mirror: after, and the temptation
  test: {
    start: 'saw',
    nodes: {
      saw: { who: 'galadriel', say: '“I know what it is you saw, for it is also in my mind. It is what will come to pass if you should fail. The Fellowship is breaking. It has already begun. He will try to take the Ring. You know of whom I speak. One by one, it will destroy them all.”', choices: [{ text: '“If you ask it of me, I will give you the One Ring.”', to: 'offer' }, { text: 'Say nothing, and hold the Ring tight.', to: 'keep' }] },
      keep: { who: 'galadriel', say: '“You are a Ring-bearer, Frodo. To bear a Ring of Power is to be alone.” She waits.', choices: [{ text: '“If you ask it of me, I will give you the One Ring.”', to: 'offer' }] },
      offer: { who: 'galadriel', say: 'You hold it out on its chain. She reaches for it. “You offer it to me freely. I do not deny that my heart has greatly desired this.”', next: 'queen' },
      queen: { who: 'galadriel', say: 'The light round her turns dark and terrible. “In place of a Dark Lord you would have a queen! Not dark, but beautiful and terrible as the dawn! Treacherous as the sea! Stronger than the foundations of the earth! All shall love me and despair!”', next: 'pass' },
      pass: { who: 'galadriel', say: 'And then she is only herself again, and small, and tired. “I pass the test. I will diminish, and go into the West, and remain Galadriel.”', next: 'alone' },
      alone: { who: 'frodo', say: '“I cannot do this alone.”', next: 'smallest' },
      smallest: { who: 'galadriel', say: '“You are a Ring-bearer, Frodo. This task was appointed to you. And if you do not find a way, no one will. Even the smallest person can change the course of the future.”', end: 'won' },
    },
  },
  // the phial, after the gifts
  phial: {
    start: 'last',
    nodes: {
      last: { who: 'galadriel', say: 'She comes to you last, holding a little crystal phial that shines with its own light. “And you, Ring-bearer.”', next: 'light' },
      light: { who: 'galadriel', say: '“I give you the light of Eärendil, our most beloved star. May it be a light to you in dark places, when all other lights go out.”', end: 'won' },
    },
  },
  // the Argonath
  argonath: {
    start: 'look',
    nodes: {
      look: { who: 'aragorn', say: '“Frodo. The Argonath. Long have I desired to look upon the kings of old. My kin.”', next: 'kings' },
      kings: { who: 'narrator', say: 'The Pillars of the Kings, carved out of the cliffs, their left hands raised against the north, and their stone faces stern. The boats pass between their feet like leaves.', end: 'won' },
    },
  },
};

// what Haldir says as he brings you to the city (his line at the stair,
// ./layout.js, too)
export const CARAS = '“Caras Galadhon. The heart of Elvendom on earth. Realm of the Lord Celeborn and of Galadriel, Lady of Light.”';
// the toasts someone speaks in (../voice.js)
export const SAYS = {
  caras: { who: 'haldir', text: `${CARAS} Up the stair round the great tree.`, line: CARAS },
  touched: { who: 'galadriel', text: 'The Ring swings down on its chain, nearly into the water. Galadriel: “Do not touch the water!” You pull back. Look again, and hold fast when the Eye looks.' },
  swim: { who: 'sam', text: 'Another! Sam: “Mr. Frodo, I can’t swim!”' },
};

// what each one says when you give them a gift, or the wrong one
export const THANKS = {
  legolas: '“The bow of the Galadhrim.” Legolas draws it, and lets it go slack, smiling. “A gift worthy of the Lady.”',
  merry: '“Daggers!” Merry hands one to Pippin. “Now we’re not just the luggage.”',
  pippin: '“Daggers!” Pippin hands one to Merry. “Now we’re not just the luggage.”',
  sam: '“Elven rope!” Sam weighs it in his hand. “I’ve been wanting some of that. Does it… come undone when you call it?”',
  gimli: 'Gimli opens the casket, and goes very still. “I asked her for one hair from her golden head. She gave me three.”',
};
export const NOT_FOR = {
  legolas: 'Legolas raises an eyebrow. “It is a fine gift. But not, I think, for me.”',
  merry: '“For me?” Merry looks at it. “Er. Maybe one of the others?”',
  pippin: '“Ooh, is it food?” It’s not. “Oh.”',
  sam: '“That’s not mine, Mr. Frodo. Though it’s a lovely thing.”',
  gimli: '“Bah. What would a dwarf want with that?”',
  aragorn: 'Aragorn shakes his head. “There is no gift the Lady can give me that I want, Frodo. Give it to the one it’s meant for.”',
  boromir: '“Keep it for the one it was meant for, little one.”',
};

// ── on the side ──
// Legolas's targets among the mallorns: nothing the story needs, open once
// Haldir has let you into the wood. Its own record is kept apart from the
// story's (../side.js), and its star is an achievement of its own, not one
// of the chapter's seals.
export const SIDE = {
  id: 'targets',
  name: 'Legolas’s targets',
  where: 'The mark by the path, west of the city',
  blurb: 'Five boards among the mallorns, and seven arrows to strike them all.',
  locked: 'Once Haldir has brought you in.',
  needs: 'haldir',
  seal: 'galadhrim',
};
const pick = (list, n) => list[n % list.length];
// what Legolas says at the targets
export const ARCHERY = {
  start: '“Five boards among the trees, and seven arrows. Draw it full, and aim above the far ones: an arrow falls, even an elven one.”',
  golds: ['“In the gold!”', '“The gold. You have a good eye, Frodo.”', '“Gold again. Are you sure you are a hobbit?”'],
  gold: (n) => pick(ARCHERY.golds, n),
  hits: ['“Struck. Near enough is enough, for a board.”', '“A fair shot.”', '“On the board. The gold next time.”'],
  hit: (n) => pick(ARCHERY.hits, n),
  again: '“That board is struck already. The others, Frodo.”',
  trunk: '“Mind the trees. They are older than both of us together.”',
  short: '“It hardly left the bow. Draw it full, and let the bow do the work.”',
  low: '“Under it. Aim higher: it falls on the way.”',
  away: '“Over, and into the wood. Some elf will find that in a hundred years.”',
  tired: '“Let it go, or let it down. No one can hold a bow drawn for ever.”',
  perfect: '“Five arrows, five boards, and every one in the gold. I could not have done better myself.”',
  won: (shot, golds) => (shot <= 5 && golds >= 5 ? ARCHERY.perfect : `“All five, with ${shot} arrows. The Galadhrim would not be ashamed of that.”`),
  out: '“No arrows left. Again? The boards are patient.”',
  best: (n) => `Your best: all five with ${n} arrows. Legolas’s: five with five, all in the gold.`,
};

export const SPEAKERS = { galadriel: 'Galadriel', celeborn: 'Celeborn', haldir: 'Haldir', frodo: 'Frodo', aragorn: 'Aragorn', gimli: 'Gimli', narrator: '' };
