// Amon Hen, the story: the five things to do, in the films' order, and
// what's said on the way. The places are in ./layout.js, the games in
// ./rules.js.

import { progress } from '../story';

export const QUESTS = [
  {
    id: 'camp',
    name: 'Parth Galen',
    where: 'The lawn by the lake',
    blurb: 'Make camp under Amon Hen. Gather wood from the edge of the trees.',
    go: 'Parth Galen, on the shore under Amon Hen. Gather five sticks of firewood from the edge of the trees, west.',
  },
  {
    id: 'boromir',
    name: 'None of us should wander alone',
    where: 'The statues in the woods',
    blurb: 'Boromir finds you among the old kings. Then, with the Ring on, get away from him to the stair.',
    go: 'Go up into the woods to think, among the old kings’ statues.',
    needs: 'camp',
    locked: 'Once camp is made.',
  },
  {
    id: 'seat',
    name: 'The Seat of Seeing',
    where: 'The summit of Amon Hen',
    blurb: 'With the Ring on you see far, and the Eye sees you. Get it off.',
    go: 'Up the old stair to the Seat of Seeing on the summit.',
    needs: 'boromir',
    locked: 'After Boromir.',
  },
  {
    id: 'run',
    name: 'Run, Frodo!',
    where: 'Down through the woods',
    blurb: 'The Uruk-hai are in the woods. Get down to the lake unseen.',
    go: 'The Uruk-hai are coming up through the woods. Get down to the boats unseen. Merry and Pippin are hiding near the path.',
    needs: 'seat',
    locked: 'After the Seat.',
  },
  {
    id: 'promise',
    name: 'I made a promise',
    where: 'The boats',
    blurb: 'Push off alone. Then Sam comes after you into the water, and he can’t swim.',
    go: 'Push a boat out from the shore, alone.',
    needs: 'run',
    locked: 'Once you’re down at the shore.',
  },
];

// the seal each one wins (../../../Achievements.jsx)
export const SEAL = { camp: 'parthgalen', boromir: 'wanderalone', seat: 'seatofseeing', run: 'runfrodo', promise: 'promise' };

export function amonHenProgress(done = []) {
  const p = progress(QUESTS, done);
  const next = p.quests.find((q) => q.id === p.next);
  const objective = p.finished ? 'Across the lake, and into the Emyn Muil, the two of you alone. On towards Mordor.' : next.go;
  return { ...p, objective };
}

export const CONVOS = {
  // Boromir in the glade
  boromir: {
    start: 'alone',
    nodes: {
      alone: { who: 'boromir', say: '“None of us should wander alone. You least of all. So much depends on you.” He sets down an armful of firewood. “Frodo? I know why you seek solitude. You suffer. I see it day by day.”', next: 'other' },
      other: { who: 'boromir', say: '“Are you sure you do not suffer needlessly? There are other ways, Frodo. Other paths that we might take.”', choices: [{ text: '“I know what you would say. And it would seem like wisdom, but for the warning in my heart.”', to: 'warning' }, { text: 'Back away from him.', to: 'back' }] },
      back: { who: 'boromir', say: '“Why do you shrink from me? I am no thief.”', next: 'warning' },
      warning: { who: 'boromir', say: '“Warning? Against what? We’re all afraid, Frodo. But to let that fear drive us to destroy what hope we have… Don’t you see that is madness?”', choices: [{ text: '“There is no other way.”', to: 'strength' }] },
      strength: { who: 'boromir', say: '“I ask only for the strength to defend my people! If you would but lend me the Ring…”', choices: [{ text: '“No!”', to: 'mine' }] },
      mine: { who: 'boromir', say: 'His face changes. “You will take it to Sauron! You fool! It is not yours, save by unhappy chance! It could have been mine! It should be mine! Give it to me!”', next: 'ring' },
      ring: { who: 'narrator', say: 'He lunges. You slip the Ring on, and the world goes grey and roaring, and he is grabbing at nothing. Get away from him, to the stair up the hill. Walk softly: he can still hear you.', end: 'won' },
    },
  },
  // after you get away
  sorry: {
    start: 'falls',
    nodes: {
      falls: { who: 'boromir', say: 'Far behind you, he trips and falls among the leaves. Then: “Frodo? What have I done? Please, Frodo! Frodo, I’m sorry!”', end: 'won' },
    },
  },
  // on the Seat, the Ring on
  seat: {
    start: 'see',
    nodes: {
      see: { who: 'narrator', say: 'You climb up onto the Seat, and with the Ring on you see far: the Anduin, and the hills, and the plains, and the black land, and in it a tower, and on the tower, fire.', next: 'eye' },
      eye: { who: 'narrator', say: 'The Eye. It turns, searching, and it feels for you. Get the Ring off before its gaze closes on you: pull at it just after the gaze has passed over.', end: 'won' },
    },
  },
  // Aragorn finds you
  aragorn: {
    start: 'gone',
    nodes: {
      gone: { who: 'aragorn', say: 'Footsteps on the stair. Aragorn. “Frodo?” You back away. “It has taken Boromir.”', next: 'where' },
      where: { who: 'aragorn', say: '“Where is the Ring?”', choices: [{ text: '“Stay away!”', to: 'swore' }, { text: 'Hold it out to him. “Can you protect me from yourself?”', to: 'offer' }] },
      swore: { who: 'aragorn', say: '“Frodo. I swore to protect you.”', choices: [{ text: 'Hold it out to him. “Can you protect me from yourself?”', to: 'offer' }] },
      offer: { who: 'narrator', say: 'He comes close, and kneels, and looks at it in your open hand. He hears it whisper his name. Then he closes your fingers over it.', next: 'end' },
      end: { who: 'aragorn', say: '“I would have gone with you to the end. Into the very fires of Mordor.”', next: 'know' },
      know: { who: 'frodo', say: '“I know.” “Look after the others. Especially Sam. He will not understand.”', next: 'run' },
      run: { who: 'aragorn', say: 'His sword, Sting at your side: both glowing blue. Orcs. “Go, Frodo. Run!”', end: 'won' },
    },
  },
  // at the shore, Boromir's horn
  horn: {
    start: 'horn',
    nodes: {
      horn: { who: 'narrator', say: 'Behind you in the woods, the horn of Gondor, again and again. Boromir, fighting for Merry and Pippin, with an arrow in him, and another, and another.', next: 'brother' },
      brother: { who: 'narrator', voice: 'aragorn', say: 'Later, Aragorn will kneel by him. “I would have followed you, my brother. My captain. My king.” You don’t see it. You are at the water’s edge, alone.', end: 'won' },
    },
  },
  // Sam, saved
  promise: {
    start: 'sam',
    nodes: {
      sam: { who: 'sam', say: 'He comes up gasping into the boat. “I made a promise, Mr. Frodo. A promise! ‘Don’t you leave him, Samwise Gamgee.’ And I don’t mean to. I don’t mean to.”', next: 'oh' },
      oh: { who: 'frodo', say: '“Oh, Sam.”', next: 'mordor' },
      mordor: { who: 'frodo', say: 'You paddle out across the lake together. “Mordor, Frodo. Mordor.” “I hope the others find a safer road.” “Strider’ll look after them.” “I don’t suppose we’ll ever see them again.” “We may yet, Mr. Frodo. We may.”', end: 'won' },
    },
  },
};

// ── on the side ──
// Ducks and drakes: skipping stones on the lake with Merry and Pippin.
// Nothing the story needs, there whenever the woods are quiet. Its own
// record is kept apart from the story's (../side.js), and its star is an
// achievement of its own, not one of the chapter's seals.
export const SIDE = {
  id: 'skipping',
  name: 'Ducks and drakes',
  where: 'The shore south of the boats',
  blurb: 'Skip stones over Nen Hithoel with Merry and Pippin. Pippin says his best is seven.',
  locked: 'Not with the Uruk-hai in the woods.',
  seal: 'ducksanddrakes',
};
// what Merry and Pippin say, as { who, say }
export const SKIPPING_SAYS = {
  start: { who: 'pippin', say: '“Ducks and drakes! Flat ones are best. Keep it low over the water, but not dead flat, and throw it hard. I got seven once. Seven!”' },
  merry: { who: 'merry', say: '“He got four. The rest were ducks.”' },
  steep: { who: 'pippin', say: '“Plop! Too steep. That one’s gone to see the fishes.”' },
  weak: { who: 'merry', say: '“You have to actually throw it, Frodo.”' },
  one: { who: 'merry', say: '“One. It’s a start.”' },
  few: (n) => (n === 1 ? SKIPPING_SAYS.one : { who: 'merry', say: `“${n}. Not bad, for a Baggins.”` }),
  fair: (n) => ({ who: 'pippin', say: `“${n}! Nearly as good as me.”` }),
  same: { who: 'pippin', say: '“Seven. That’s… the same as me. That doesn’t count.”' },
  beat: (n) => ({ who: 'pippin', say: `“${n}! Merry, did you see that? ${n}!” Merry: “I saw. You’ve been beaten, Pip.”` }),
  again: (n) => ({ who: 'merry', say: `“${n} again! Pippin’s gone very quiet.”` }),
  flat: { who: 'pippin', say: '“Here, try this one. Flat as a biscuit.”' },
  lumpy: { who: 'merry', say: '“That’s more of a potato than a stone.”' },
};
// how flat a stone is, in words
export const stoneWord = (flat) => (flat > 0.9 ? 'flat as a biscuit' : flat > 0.75 ? 'flattish' : 'a bit lumpy');

// the toasts someone speaks in (../voice.js); at the Seat, Gandalf's words
// in your head, not the Eye's
const TAKE_IT_OFF = '“Take it off! Take it off!”';
export const SAYS = {
  alone: { who: 'sam', text: '“Where’s Frodo?” Sam looks round, but you have gone off up into the woods to think, alone.' },
  heard: { who: 'boromir', text: 'He hears you! “Frodo!” He’s coming. Go softly, round the trees.' },
  seen: { who: 'gandalf', text: `“I see you.” The Eye has you, and Gandalf’s voice in your head: ${TAKE_IT_OFF} You fall from the Seat… Again: pull at the Ring just after its gaze has passed.`, line: TAKE_IT_OFF },
  run: { who: 'aragorn', text: 'A great black hand reaches for you, and Aragorn’s sword is there first. “Run, Frodo!” Again: down to the shore unseen.' },
  decoy: { who: 'merry', text: 'Merry and Pippin leap out from behind a tree, waving: “Hey! Over here! This way!” Two of the Uruk-hai go after them. Run, Frodo!' },
};

export const SPEAKERS = { boromir: 'Boromir', aragorn: 'Aragorn', sam: 'Samwise Gamgee', frodo: 'Frodo', merry: 'Merry Brandybuck', pippin: 'Pippin Took', narrator: '' };
