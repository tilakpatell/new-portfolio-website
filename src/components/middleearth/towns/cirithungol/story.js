// Cirith Ungol, the story: the five things to do, in the films' order,
// and what's said on the way. The places are in ./layout.js, the games in
// ./rules.js.

import { progress } from '../story';

export const QUESTS = [
  {
    id: 'morgul',
    name: 'Minas Morgul',
    where: 'Above the Morgul road',
    blurb: 'The green light goes up, and the Witch-king’s host rides out. Don’t look at the city.',
    go: 'Crouched above the road to Minas Morgul. Don’t look at the city.',
  },
  {
    id: 'stairs',
    name: 'The stairs',
    where: 'The cliff above the Morgul vale',
    blurb: 'Up the endless stair behind Gollum. Rest on the ledges, never on the crumbling steps.',
    go: 'Up the stairs of Cirith Ungol, behind Gollum.',
    needs: 'morgul',
    locked: 'Once the host has gone by.',
  },
  {
    id: 'shelob',
    name: 'Shelob’s lair',
    where: 'The tunnels at the top of the stair',
    blurb: 'Alone in the dark, through the webs. Raise the phial when she comes.',
    go: 'Alone, into the tunnels. Something lives in here. Raise the phial (hold Space) when it comes close.',
    needs: 'stairs',
    locked: 'At the top of the stairs.',
  },
  {
    id: 'samwise',
    name: 'Samwise the Brave',
    where: 'The pass beyond the lair',
    blurb: 'As Sam: Shelob has Frodo. Dodge her strikes, stab when she rears.',
    go: 'Sam came back. Shelob has Frodo bound in silk. Fight her!',
    needs: 'shelob',
    locked: 'When Sam comes back.',
  },
  {
    id: 'tower',
    name: 'The Tower of Cirith Ungol',
    where: 'The orcs’ tower above the pass',
    blurb: 'As Sam: past the orcs fighting over the mithril, up the stair to Frodo.',
    go: 'They’ve taken Frodo up into the Tower. Cross the courtyard to the stair, past the orcs.',
    needs: 'samwise',
    locked: 'After Shelob.',
  },
];

// the seal each one wins (../../../Achievements.jsx)
export const SEAL = { morgul: 'minasmorgul', stairs: 'stairs', shelob: 'aiyaearendil', samwise: 'samwisethebrave', tower: 'tower' };

// what's next, the objective, where you are, and who you are (Sam, once
// he comes back for Frodo)
export function cirithProgress(done = []) {
  const p = progress(QUESTS, done);
  const next = p.quests.find((q) => q.id === p.next);
  const objective = p.finished ? 'Out of the Tower in orc-gear, down into the plain of Gorgoroth. On to Mount Doom.' : next.go;
  const zone = { morgul: 'vale', stairs: 'stairs', shelob: 'lair', samwise: 'lair', tower: 'tower' }[p.next] ?? 'tower';
  const asSam = p.next === 'samwise' || p.next === 'tower' || p.finished;
  return { ...p, objective, zone, asSam };
}

export const CONVOS = {
  // the green light, before it starts
  morgul: {
    start: 'city',
    nodes: {
      city: { who: 'narrator', say: 'Across the valley, Minas Morgul, the city of the Ringwraiths, glowing a dead green. The Ring stirs on its chain. You feel it want to go there.', next: 'gollum' },
      gollum: { who: 'gollum', say: '“No! Don’t look! Hobbit mustn’t look at it!”', next: 'light' },
      light: { who: 'narrator', say: 'The earth shakes. A beam of green light goes up from the city into the clouds, and its gate opens, and the host of Mordor pours out over the bridge, the Witch-king at its head. Keep your eyes off the city (A and D) till it has gone by.', end: 'won' },
    },
  },
  // at the top of the stair, the lembas
  lembas: {
    start: 'crumbs',
    nodes: {
      crumbs: { who: 'gollum', say: 'Sam is asleep against the rock. Gollum shows you crumbs on Sam’s cloak. “Look! Crumbses on his clothes! He took it! He took it, master!” The lembas is gone, thrown down the stair.', next: 'sam' },
      sam: { who: 'sam', say: 'Sam wakes. “I didn’t! I didn’t eat it, Mr. Frodo! He’s lying!” He goes for Gollum. “You little sneak!”', next: 'ring' },
      ring: { who: 'sam', say: 'Then he sees how you are. “Let me help you. Let me carry it a while. Share the load.”', choices: [{ text: 'Hold the Ring away from him. “No!”', to: 'home' }] },
      home: { who: 'frodo', say: 'And you hear yourself say it. “I think you should go home.”', next: 'go' },
      go: { who: 'sam', say: 'He stands on the stair, weeping, and watches you go on up with Gollum. Then he turns, and starts down. “Mr. Frodo…”', end: 'won' },
    },
  },
  // the phial, in the lair
  phial: {
    start: 'dark',
    nodes: {
      dark: { who: 'narrator', say: 'Gollum is gone. It’s dark, and the air stinks, and there are bones, and webs as thick as rope. Something is moving.', next: 'galadriel' },
      galadriel: { who: 'galadriel', say: 'A voice in your memory: “And you, Frodo Baggins: I give you the light of Eärendil, our most beloved star. May it be a light for you in dark places, when all other lights go out.”', end: 'won' },
    },
  },
  // she has Frodo
  sam: {
    start: 'back',
    nodes: {
      back: { who: 'sam', say: 'At the bottom of the stair, Sam finds the lembas thrown down among the rocks. He turns, and runs back up. Too late: she has Frodo, wrapped in silk, and is dragging him off.', next: 'filth' },
      filth: { who: 'sam', say: '“Let him go, you filth!” Sting in one hand, the phial in the other. “Don’t you touch him! You’ll not touch him again!”', end: 'won' },
    },
  },
  // she's gone; Frodo
  frodo: {
    start: 'cuts',
    nodes: {
      cuts: { who: 'sam', say: 'He cuts Frodo out of the silk. Cold. Still. “Mr. Frodo? No… No! Wake up! Don’t go where I can’t follow!”', next: 'ring' },
      ring: { who: 'narrator', say: 'Orcs coming. Sam takes the Ring from Frodo’s neck and hides, and hears them: he’s not dead. She stings, and they go limp. Sam has left him alive in the hands of the enemy.', next: 'fool' },
      fool: { who: 'sam', say: '“Frodo’s alive… You fool, Samwise.” He follows them to the Tower.', end: 'won' },
    },
  },
  // at the top of the Tower
  top: {
    start: 'frodo',
    nodes: {
      frodo: { who: 'narrator', say: 'Up the stair, and at the top, Frodo, stripped, and an orc with a whip over him. Sam cuts it down.', next: 'gone' },
      gone: { who: 'frodo', say: '“They took it, Sam. They took the Ring.” Sam opens his hand. “Begging your pardon, but they didn’t.”', next: 'give' },
      give: { who: 'frodo', say: '“Give it to me! Give me the Ring, Sam! You don’t understand. I must carry this burden to the end.”', next: 'with' },
      with: { who: 'sam', say: 'He gives it back. “Come on, Mr. Frodo. We’ll find you some orc clothes, and we’ll go on together.”', end: 'won' },
    },
  },
};

// ── on the side ──
// The night on the stair, as it might have gone: crumbs on Sam's cloak.
// Nothing the story needs, open once you've climbed the stairs. Its own
// record is kept apart from the story's (../side.js), and its star is an
// achievement of its own, not one of the chapter's seals.
export const SIDE = {
  id: 'crumbs',
  name: 'Crumbs on Sam’s cloak',
  where: 'The top of the stair, the night before the lair',
  blurb: 'Wake first, as Sam, and brush off the lembas crumbs Gollum dusted on your cloak before Frodo stirs.',
  locked: 'Once you’ve climbed the stairs.',
  needs: 'stairs',
  seal: 'notacrumb',
};
export const CRUMB_SAYS = {
  start: 'The night on the stair, as it might have gone. You wake first, as Sam, and there are crumbs of lembas all over your cloak, and none of them yours. Gollum is watching from the dark. Brush them off before Mr. Frodo wakes.',
  stir: ['Frodo stirs, and mutters, and sleeps on.', 'Frodo turns his head. “Sam?” But he’s still asleep.', 'Grey light on the rock. Frodo’s eyes are moving under their lids.'],
  rustle: 'A rustle of cloth, and nothing on it. Frodo murmurs in his sleep.',
  won: (secs) => `The last crumb goes over the edge. When Frodo wakes there’s nothing on your cloak but dust, and Gollum has nothing to show him. (${secs} seconds)`,
  woke: 'Frodo wakes. Gollum is at his side at once: “Look! Crumbses on his clothes! He took it, master!”',
  best: (secs) => `Your best: brushed clean in ${secs} seconds.`,
};

// the toasts someone speaks in (../voice.js)
export const SAYS = {
  stood: { who: 'sam', text: 'You’re on your feet and walking down to the road, towards the green light. Sam drags you down behind the rocks. “Mr. Frodo!” Again: keep your eyes off it.' },
  passed: { who: 'gollum', text: 'The host has gone by, west, to war. Gollum: “This way, master. Up the stairs.”' },
};

export const SPEAKERS = { gollum: 'Gollum', sam: 'Samwise Gamgee', frodo: 'Frodo', galadriel: 'Galadriel', narrator: '' };
