// The Emyn Muil, the Dead Marshes and the Black Gate, the story: the four
// things to do, in the films' order, and what's said on the way. The
// places are in ./layout.js, the games in ./rules.js.

import { progress } from '../story';

export const QUESTS = [
  {
    id: 'rope',
    name: 'Real elvish rope',
    where: 'The cliffs of the Emyn Muil',
    blurb: 'Down a sheer cliff in the storm on Sam’s rope from Lothlórien.',
    go: 'Lost in the Emyn Muil, and a sheer cliff in the way. Down it, on Sam’s rope.',
  },
  {
    id: 'smeagol',
    name: 'Sméagol',
    where: 'The foot of the cliff, by night',
    blurb: 'Pretend to sleep while Gollum creeps down the rock, and grab him when he reaches for the Ring.',
    go: 'Night. Lie down by Sam at the foot of the cliff, and pretend to sleep. Something has been following you.',
    needs: 'rope',
    locked: 'Once you’re down.',
  },
  {
    id: 'marsh',
    name: 'The Dead Marshes',
    where: 'The marshes before Mordor',
    blurb: 'Follow Gollum across. Don’t follow the lights, and get down when the Nazgûl passes over.',
    go: 'Follow Gollum through the marshes on the firm ground. Don’t follow the lights.',
    needs: 'smeagol',
    locked: 'With a guide.',
  },
  {
    id: 'gate',
    name: 'The Black Gate',
    where: 'The slope above the Morannon',
    blurb: 'Along the slope unseen, under the elven cloak when the scouts look, to watch the Gate open.',
    go: 'The Black Gate. Along the slope to the rocks overlooking it, east. Under the cloak (hold C) when the scouts look your way.',
    needs: 'marsh',
    locked: 'Across the marshes.',
  },
];

// the seal each one wins (../../../Achievements.jsx)
export const SEAL = { rope: 'elvenrope', smeagol: 'swearontheprecious', marsh: 'deadmarshes', gate: 'anotherway' };

// what's next, the objective, and where you are: the Emyn Muil till
// you've caught Gollum, the marshes, then the Gate
export function marshesProgress(done = []) {
  const p = progress(QUESTS, done);
  const next = p.quests.find((q) => q.id === p.next);
  const objective = p.finished ? 'South along the mountains, with Gollum, to another way in. On to Cirith Ungol.' : next.go;
  const zone = p.next === 'rope' || p.next === 'smeagol' ? 'emyn' : p.next === 'marsh' ? 'marsh' : 'gate';
  return { ...p, objective, zone };
}

export const CONVOS = {
  // at the foot of the cliff
  down: {
    start: 'shame',
    nodes: {
      shame: { who: 'sam', say: 'At the bottom, Sam looks up at his rope, hanging from the rock. “I’ll never get it down now. It’s a real shame. Lady Galadriel gave me that.”', next: 'knot' },
      knot: { who: 'frodo', say: '“Was it a good knot?”', next: 'sam' },
      sam: { who: 'sam', say: '“It was a beautiful knot! A proper knot. It’s not going to come loose in a hurry.” The rope slithers down the rock and lands at his feet. He stares at it. “Real elvish rope.”', end: 'won' },
    },
  },
  // Gollum, caught
  smeagol: {
    start: 'caught',
    nodes: {
      caught: { who: 'narrator', voice: 'gollum', say: 'You’re on him, the two of you, and Sting is at his throat. He writhes and spits. “It burns! It burns us!”', next: 'thief' },
      thief: { who: 'gollum', say: '“Thief! Thief! Baggins! We hates it! We hates it forever!”', next: 'sam' },
      sam: { who: 'sam', say: 'Sam knots the elven rope round his ankle, and he screams. “Mr. Frodo, he’ll strangle us in our sleep, he will!”', next: 'pity' },
      pity: { who: 'frodo', say: 'Gandalf’s voice, in the Mines: “Many that live deserve death, and some that die deserve life. Can you give it to them, Frodo?”', choices: [{ text: 'Untie him. He can show us the way.', to: 'way' }, { text: '“It’s a pity Bilbo didn’t kill him.”', to: 'bilbo' }] },
      bilbo: { who: 'narrator', voice: 'gandalf', say: 'And you hear the rest: “Pity? It was pity that stayed his hand.” You look at him, at what the Ring has made of him.', next: 'way' },
      way: { who: 'frodo', say: '“You know the way to Mordor?” He nods, eager, wretched. “You’ve been there before.”', next: 'swear' },
      swear: { who: 'gollum', say: '“Sméagol will swear on… on the precious. Sméagol will swear on the precious.” You hold the Ring out. “Sméagol will help the master.”', end: 'won' },
    },
  },
  // into the water among the faces
  faces: {
    start: 'faces',
    nodes: {
      faces: { who: 'narrator', say: 'You look too long at the light, and you’re in the water, and under it, and there are faces: pale, dead, staring up at you. Elves and men and orcs, from a great battle long ago.', next: 'pull' },
      pull: { who: 'gollum', say: 'A thin hand drags you out. “Don’t follow the lights!” He looks at you. “All dead. All rotten. Elves and men and orcs. A great battle long ago. Don’t follow the lights.”', end: 'won' },
    },
  },
  // across
  across: {
    start: 'across',
    nodes: {
      across: { who: 'gollum', say: '“Hurry, hobbitses! Through the marshes, and then the Black Gate, master, the Black Gate. Follow Sméagol.”', end: 'won' },
    },
  },
  // the Gate
  gate: {
    start: 'gate',
    nodes: {
      gate: { who: 'narrator', say: 'Below, the Morannon: two towers, the Teeth of Mordor, and between them a gate of black iron. A column of Easterlings comes down the road, in red and gold.', next: 'open' },
      open: { who: 'narrator', say: 'Horns. Trolls throw their weight on the great chains, and the Black Gate grinds open.', next: 'go' },
      go: { who: 'frodo', say: '“It’s open.” You get up. “We’ll go in.”', next: 'no' },
      no: { who: 'gollum', say: 'He grabs your cloak. “No! No, master! They will catch you! Don’t take it to him! He wants the precious, always he’s looking for it.” The gate closes behind the column, with a boom.', next: 'way' },
      way: { who: 'gollum', say: '“There is another way. More secret. A dark way.”', next: 'sam' },
      sam: { who: 'sam', say: '“Why haven’t you spoken of this before?” “Because master did not ask.”', end: 'won' },
    },
  },
};

// ── on the side ──
// Sméagol's safe way across a pool, once you've crossed the marshes with
// him. Nothing the story needs: its record is kept apart from the story's
// (../side.js), and its star is an achievement of its own, not one of the
// chapter's seals.
export const SIDE = {
  id: 'safeway',
  name: 'Sméagol’s safe way',
  where: 'A pool north of the path, past halfway across the marshes',
  blurb: 'Gollum hops across the tussocks once. Put your feet exactly where he put his.',
  locked: 'Once you’ve crossed the marshes with Gollum.',
  needs: 'marsh',
  seal: 'safeway',
};
// what Gollum says at the pool
export const WAY_SAYS = {
  start: '“Sméagol knows safe ways, yes, old ways. Watch Sméagol’s feet, master. Only where Sméagol puts them. Not where the lights are!”',
  shown: '“Now master. Exactly where Sméagol stepped. Exactly!”',
  safe: ['“Yes…”', '“Good, good.”', '“Careful, careful.”', '“Nearly, precious, nearly.”'],
  lit: '“Don’t follow the lights! Stupid, stupid… careful, master!” He drags you out by the collar.',
  sank: '“No, no, not that one!” A thin hand drags you out, dripping, onto the bank.',
  again: '“Master forgets. Watch again. Sméagol shows once more, only once more.”',
  clean: '“Master remembers! Clever master. Sméagol is pleased, yes, pleased.”',
  won: (slips) => (slips === 0 ? WAY_SAYS.clean : `“Across! Wet, but across.” He counts on his fingers. “Fell in ${slips === 1 ? 'once' : slips === 2 ? 'twice' : `${slips} times`}, master did. Gollum.”`),
  best: (slips) => (slips === 0 ? 'Your best: across without a slip.' : `Your best: across with ${slips} ${slips === 1 ? 'slip' : 'slips'}.`),
};

// the toasts someone speaks in (../voice.js)
export const SAYS = {
  fell: { who: 'sam', text: 'Your hands open, and you fall, and land in a heap on a ledge. Sam: “Mr. Frodo!” Up you climb again… Swing clear of the rock this time.' },
  hurry: { who: 'gollum', text: 'Gollum looks back. “Hurry, hobbitses! Follow Sméagol!”' },
  lights: { who: 'gollum', text: 'Into the water again, among the faces, and Gollum drags you out. “Don’t follow the lights!”' },
};

export const SPEAKERS = { gollum: 'Gollum', sam: 'Samwise Gamgee', frodo: 'Frodo', narrator: '' };
