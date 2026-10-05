// Mordor and Mount Doom, the story: the five things to do, in the films'
// order, and what's said on the way. The places are in ./layout.js, the
// games in ./rules.js.

import { progress } from '../story';

export const QUESTS = [
  {
    id: 'column',
    name: 'Get in line',
    where: 'The road into Gorgoroth',
    blurb: 'In orc-gear, swept up in a marching column. Keep your place in the line till it halts.',
    go: 'Down into Gorgoroth in orc-gear, and an orc column coming. Fall in, and keep your place in the line.',
  },
  {
    id: 'gorgoroth',
    name: 'Under the Eye',
    where: 'The plain of Gorgoroth',
    blurb: 'Across the open plain to the mountain, from rock to rock, out of the Eye’s searching light.',
    go: 'East across the plain to the foot of the mountain. Keep out of the Eye’s light: behind a rock, away from the Tower.',
    needs: 'column',
    locked: 'Once you’re out of the column.',
  },
  {
    id: 'carry',
    name: 'I can carry you',
    where: 'The slopes of Mount Doom',
    blurb: 'As Sam, with Frodo on your back, up the last of the road. Left, right; stand still when the mountain shakes.',
    go: 'As Sam, carry Frodo up the road to the door in the mountain.',
    needs: 'gorgoroth',
    locked: 'At the foot of the mountain.',
  },
  {
    id: 'crack',
    name: 'The Crack of Doom',
    where: 'The Sammath Naur',
    blurb: 'At the edge of the fire, with the Ring. And then Gollum. Reach for Frodo’s hand.',
    go: 'Into the mountain, to the edge of the fire, and cast it in.',
    needs: 'carry',
    locked: 'At the door in the mountain.',
  },
  {
    id: 'eagles',
    name: 'The eagles are coming',
    where: 'Above the lava, as the mountain falls',
    blurb: 'On a rock in a river of fire, at the end of all things. Then Gwaihir: out through the eruption.',
    go: 'The mountain is coming down. Out to the rock in the lava, together.',
    needs: 'crack',
    locked: 'When it’s done.',
  },
];

// the seal each one wins (../../../Achievements.jsx)
export const SEAL = { column: 'maggots', gorgoroth: 'gorgoroth', carry: 'carryyou', crack: 'ringbearer', eagles: 'eagles' };

// what's next, the objective, where you are, and who you are (Sam, on the
// mountain)
export function doomProgress(done = []) {
  const p = progress(QUESTS, done);
  const next = p.quests.find((q) => q.id === p.next);
  const objective = p.finished ? 'It’s done. Home, in the end, to the Shire.' : next.go;
  const zone = { column: 'plain', gorgoroth: 'plain', carry: 'slope', crack: 'crack', eagles: 'slope' }[p.next] ?? 'slope';
  return { ...p, objective, zone, asSam: p.next === 'carry' };
}

export const CONVOS = {
  // down into the plain, and the column
  column: {
    start: 'plain',
    nodes: {
      plain: { who: 'narrator', say: 'Gorgoroth: ash and cinders and rock, the camps of the enemy’s armies smoking all across it. And far off, the mountain, fire running down its sides. Above, the Eye.', next: 'feet' },
      feet: { who: 'sam', say: 'Tramping feet behind you, and drums. An orc column, coming down the road. Nowhere to hide.', next: 'line' },
      line: { who: 'orc', say: '“You two! Get in line, you maggots! Move it!” The whip cracks. You fall in among them.', end: 'won' },
    },
  },
  // the column halts at the camp
  halt: {
    start: 'halt',
    nodes: {
      halt: { who: 'orc', say: '“Halt! Inspection!” The line breaks into a shoving, snarling crowd, and they’re at each other’s throats.', next: 'away' },
      away: { who: 'sam', say: 'Sam pulls you down and away, and you crawl off among the rocks while they fight. “Come on, Mr. Frodo. The mountain.”', end: 'won' },
    },
  },
  // at the foot of the mountain
  foot: {
    start: 'fall',
    nodes: {
      fall: { who: 'narrator', say: 'At the foot of the mountain, Frodo falls, and can’t get up. Above, a long road up the black slope.', next: 'shire' },
      shire: { who: 'sam', say: '“Do you remember the Shire, Mr. Frodo? It’ll be spring soon. And the orchards will be in blossom. And the birds will be nesting in the hazel thicket.”', next: 'nothing' },
      nothing: { who: 'frodo', say: '“No, Sam. I can’t recall the taste of food, nor the sound of water, nor the touch of grass. I’m naked in the dark. There’s nothing, no veil between me and the wheel of fire.”', next: 'carry' },
      carry: { who: 'sam', say: '“Then let us be rid of it, once and for all! Come on, Mr. Frodo. I can’t carry it for you… but I can carry you!”', end: 'won' },
    },
  },
  // at the door
  door: {
    start: 'gollum',
    nodes: {
      gollum: { who: 'narrator', say: 'Almost at the door, something drops on you from the rocks: Gollum, clawing at Frodo’s throat for the Ring.', next: 'wretch' },
      wretch: { who: 'frodo', say: 'Frodo throws him off. “Down, wretch! If you touch me ever again, you will be cast yourself into the Fire of Doom!”', next: 'in' },
      in: { who: 'sam', say: 'Sam goes for Gollum, and Frodo goes on, alone, in at the door.', end: 'won' },
    },
  },
  // at the edge of the fire
  crack: {
    start: 'edge',
    nodes: {
      edge: { who: 'sam', say: 'You’re at the end of the spur, the fire below, the Ring in your hand. Sam’s voice behind you: “Frodo! Destroy it! Go on! Throw it in the fire!”', choices: [{ text: 'Throw it in.', to: 'cant' }, { text: 'Turn round.', to: 'mine' }] },
      cant: { who: 'narrator', say: 'You hold it out over the fire, and your hand won’t open.', next: 'mine' },
      mine: { who: 'frodo', say: 'You turn to him. “I’m here, Sam.” And then: “The Ring is mine.” You put it on, and you’re gone.', next: 'gollum' },
      gollum: { who: 'narrator', say: 'Out of nowhere, Gollum, on your invisible back, biting, tearing at your hand, and he has it: the Ring, and your finger with it. “Precious!” He dances with joy at the edge, and you go for him.', next: 'fall' },
      fall: { who: 'narrator', say: 'You struggle, and go over the edge together. Gollum falls into the fire with his precious in his hand. You hang from the broken rock above it.', end: 'won' },
    },
  },
  // after: it's gone
  done: {
    start: 'gone',
    nodes: {
      gone: { who: 'narrator', say: 'Below, in the fire, the Ring floats for a moment, glowing, and melts away. Far off, the Tower falls, and the Eye goes out.', next: 'done' },
      done: { who: 'frodo', say: '“It’s gone. It’s done.” The mountain shakes itself apart round you. “Come on, Mr. Frodo!”', end: 'won' },
    },
  },
  // on the rock
  refuge: {
    start: 'end',
    nodes: {
      end: { who: 'frodo', say: 'On a rock with the lava all round you, and the sky on fire. “I’m glad to be with you, Samwise Gamgee. Here at the end of all things.”', next: 'rosie' },
      rosie: { who: 'sam', say: '“Do you remember Rosie Cotton? If I ever was to marry someone, it would have been her.”', next: 'eagles' },
      eagles: { who: 'narrator', say: 'And out of the smoke, wings: the eagles, Gwaihir and Landroval, with Gandalf. Talons close round you, gently, and you’re lifted.', end: 'won' },
    },
  },
};

// ── on the side ──
// Do you remember the Shire? At the foot of the mountain, Sam tells Frodo
// the Shire, and Frodo says it back. Nothing the story needs, open once
// you're across Gorgoroth. Its own record is kept apart from the story's
// (../side.js), and its star is an achievement of its own, not one of the
// chapter's seals.
export const SIDE = {
  id: 'remember',
  name: 'Do you remember the Shire?',
  where: 'The foot of Mount Doom',
  blurb: 'Sam tells Frodo the Shire, a thing at a time. Say them back in his order, up to six.',
  locked: 'Once you’re across Gorgoroth.',
  needs: 'gorgoroth',
  seal: 'remembertheshire',
};
// what's said, as { who, say }
export const REMEMBER_SAYS = {
  start: { who: 'sam', say: '“Do you remember the Shire, Mr. Frodo? Listen. I’ll tell it you, a bit at a time, and you say it back to me.”' },
  ask: (n) => ({ who: 'sam', say: n === 2 ? '“Now you. What did I say first?”' : `“Now you. All ${n} of them, in order.”` }),
  right: { who: 'frodo', say: '“…Yes.”' },
  round: (n) => ({ who: 'frodo', say: ['', '', '“I can almost see it.”', '“I remember that.”', '“There was a smell of it, Sam. Of the Shire.”', '“Go on. Tell me more.”'][Math.min(5, n)] || '“Go on.”' }),
  wrong: { who: 'frodo', say: '“I can’t, Sam. It’s gone. There’s nothing.” Sam takes his hand. “Then I’ll tell you again.”' },
  won: (slips) => ({ who: 'frodo', say: slips === 0 ? '“I can see it, Sam. All of it. The Shire.” Sam: “Then let us be rid of it, once and for all.”' : '“I can see it, Sam. The Shire.” Sam: “Then let us be rid of it, once and for all.”' }),
  best: (slips) => (slips === 0 ? 'Your best: all six, without a slip.' : `Your best: all six, with ${slips} ${slips === 1 ? 'slip' : 'slips'}.`),
};

export const SPEAKERS = { sam: 'Samwise Gamgee', frodo: 'Frodo', orc: 'An orc', narrator: '' };
