// Moria, the story: the five things to do, in the films' order, and what's
// said on the way. The places are in ./layout.js, the games (the Watcher,
// the falling dwarf, the troll, the flight) in ./rules.js.

import { progress } from '../story';

export const QUESTS = [
  {
    id: 'doors',
    name: 'Speak, friend, and enter',
    where: 'The West-gate, under the cliff',
    blurb: 'Read the riddle on the Doors of Durin, then get inside past the Watcher in the Water.',
    go: 'Night at the walls of Moria. Walk along the shore to the Doors of Durin in the cliff.',
  },
  {
    id: 'dark',
    name: 'The long dark',
    where: 'The fork of three passages',
    blurb: 'Three ways, and Gandalf can’t remember. Follow your nose.',
    go: 'Through the dark by Gandalf’s staff-light to the fork. One passage breathes cool air.',
    needs: 'doors',
    locked: 'Once you’re inside.',
  },
  {
    id: 'tomb',
    name: 'Fool of a Took!',
    where: 'The Chamber of Mazarbul',
    blurb: 'Balin’s tomb, the book, and Pippin at the well. Catch what falls.',
    go: 'Gimli has run ahead, shouting for Balin. Follow him through the north door of the great hall.',
    needs: 'dark',
    locked: 'After the long dark.',
  },
  {
    id: 'troll',
    name: 'They have a cave troll',
    where: 'The Chamber of Mazarbul',
    blurb: 'Keep out of the troll’s sight among the columns until the end.',
    go: 'Drums in the deep. They’re coming.',
    needs: 'tomb',
    locked: 'When the drums start.',
  },
  {
    id: 'bridge',
    name: 'The Bridge of Khazad-dûm',
    where: 'The stair and the bridge, east of the great hall',
    blurb: 'Flee down the broken stair and over the bridge, with the Balrog behind.',
    go: 'To the bridge of Khazad-dûm! Out of the great hall by its east door.',
    needs: 'troll',
    locked: 'After the troll.',
  },
];

// the seal each one wins (../../../Achievements.jsx); the Doors' is the
// page's Doors puzzle's own
export const SEAL = { doors: 'mellon', dark: 'dwarrowdelf', tomb: 'fooloftook', troll: 'mithril', bridge: 'flyyoufools' };

// What's open and next, the objective, and where you are: at the West-gate
// until you're through the Doors, in the halls after.
export function moriaProgress(done = []) {
  const p = progress(QUESTS, done);
  const has = (id) => p.done.includes(id);
  const next = p.quests.find((q) => q.id === p.next);
  const objective = p.finished ? 'Out of the east gate into the light, but Gandalf is gone. On to the woods of Lothlórien.' : next.go;
  return { ...p, objective, zone: has('doors') ? 'halls' : 'gate', lit: has('dark') };
}

// ── what's said ──

export const CONVOS = {
  // at the Doors
  doors: {
    start: 'walls',
    nodes: {
      walls: { who: 'gandalf', say: '“The walls of Moria.” He passes his hand over the rock, and in the moonlight silver lines appear: an arch, two trees, a star.', next: 'reads' },
      reads: { who: 'gandalf', say: '“It reads: The Doors of Durin, Lord of Moria. Speak, friend, and enter.”', next: 'what' },
      what: { who: 'merry', say: '“What do you suppose that means?”', next: 'simple' },
      simple: { who: 'gandalf', say: '“Oh, it’s quite simple. If you are a friend, you speak the password, and the doors will open.” He tries. Nothing. He tries again. Nothing.', choices: [{ text: '“It’s a riddle. Speak, friend…”', to: 'riddle' }, { text: 'Throw a stone in the lake, like Boromir.', to: 'stone' }] },
      stone: { who: 'aragorn', say: 'Aragorn catches your arm. “Do not disturb the water.”', next: 'simple2' },
      simple2: { who: 'gandalf', say: 'Gandalf sits on a rock, fed up, his hat over his eyes.', choices: [{ text: '“It’s a riddle. Speak, friend…”', to: 'riddle' }] },
      riddle: { who: 'frodo', say: '“Speak, friend, and enter. What’s the Elvish word for friend?”', choices: [{ text: '“Mellon.”', to: 'mellon' }, { text: '“Durin.”', to: 'wrong' }, { text: '“Moria.”', to: 'wrong' }] },
      wrong: { who: 'gandalf', say: 'Nothing. The silver lines glimmer, and wait.', next: 'riddle' },
      mellon: { who: 'gandalf', say: 'Gandalf looks up. “Mellon.” And with a groan of stone, the Doors swing slowly open.', end: 'won' },
    },
  },
  // the fork
  fork: {
    start: 'memory',
    nodes: {
      memory: { who: 'gandalf', say: '“I have no memory of this place.” He sits, and smokes, and the Fellowship waits in the dark.', next: 'smell' },
      smell: { who: 'narrator', say: 'Three passages. From one of them, the faintest cool air moves the smoke from his pipe.', end: 'won' },
    },
  },
  // the right way: and a little more light
  light: {
    start: 'way',
    nodes: {
      way: { who: 'gandalf', say: '“Ah. It’s that way.”', next: 'remembered' },
      remembered: { who: 'merry', say: '“He’s remembered!”', next: 'nose' },
      nose: { who: 'gandalf', say: '“No. But the air doesn’t smell so foul down here. If in doubt, Meriadoc, always follow your nose.”', next: 'risk' },
      risk: { who: 'gandalf', say: '“Let me risk a little more light.” He lifts his staff, and the light swells, and goes out and up, among pillars beyond counting.', next: 'behold' },
      behold: { who: 'gandalf', say: '“Behold the great realm and dwarf-city of Dwarrowdelf.”', next: 'eye' },
      eye: { who: 'sam', say: '“Now there’s an eye-opener, and no mistake.”', end: 'won' },
    },
  },
  // Balin's tomb
  tomb: {
    start: 'balin',
    nodes: {
      balin: { who: 'gimli', say: 'Gimli falls to his knees by the white stone tomb in its shaft of grey light. “No… No! No!”', next: 'here' },
      here: { who: 'gandalf', say: '“Here lies Balin, son of Fundin, Lord of Moria. He is dead, then. It’s as I feared.”', next: 'book' },
      book: { who: 'gandalf', say: 'He lifts a great book from a dead dwarf’s hands, and reads. “We cannot get out. They have taken the bridge and the second hall. The ground shakes. Drums… drums in the deep. We cannot get out. A shadow moves in the dark. We cannot get out. They are coming.”', next: 'pippin' },
      pippin: { who: 'narrator', say: 'Behind you, Pippin touches the arrow in a dwarf’s skeleton on the edge of the well. Its head drops off.', end: 'won' },
    },
  },
  // after it's all down the well
  fool: {
    start: 'fool',
    nodes: {
      fool: { who: 'gandalf', say: '“Fool of a Took! Throw yourself in next time, and rid us of your stupidity.” Then, far below: boom. Boom. Boom-boom.', next: 'drums' },
      drums: { who: 'narrator', say: 'Drums in the deep. And Frodo’s sword, Sting, glows blue.', next: 'orcs' },
      orcs: { who: 'legolas', say: '“Orcs!”', end: 'won' },
    },
  },
  // the troll at the door
  troll: {
    start: 'bar',
    nodes: {
      bar: { who: 'aragorn', say: '“Get back! Stay close to Gandalf!” Boromir and Aragorn bar the doors with spears and axes.', next: 'they' },
      they: { who: 'boromir', say: 'He looks out through the crack, and an arrow thuds into the door by his face. “They have a cave troll.”', next: 'gimli' },
      gimli: { who: 'gimli', say: 'Gimli climbs onto Balin’s tomb with two axes. “Let them come! There is one dwarf yet in Moria who still draws breath!”', end: 'won' },
    },
  },
  // after the spear
  mithril: {
    start: 'alive',
    nodes: {
      alive: { who: 'aragorn', say: 'The troll’s spear catches you against a column. Aragorn turns you over. “Frodo…”', next: 'fine' },
      fine: { who: 'frodo', say: '“I’m all right. I’m not hurt.”', next: 'should' },
      should: { who: 'aragorn', say: '“You should be dead! That spear would have skewered a wild boar.”', next: 'shirt' },
      shirt: { who: 'gandalf', say: 'Under your shirt, the gleam of silver rings. “I think there is more to this hobbit than meets the eye.” Then, from the halls: more of them. “To the bridge of Khazad-dûm!”', end: 'won' },
    },
  },
  // on the bridge
  bridge: {
    start: 'cannot',
    nodes: {
      cannot: { who: 'gandalf', say: 'Gandalf stops in the middle of the bridge and turns. “You cannot pass.”', next: 'fire' },
      fire: { who: 'gandalf', say: '“I am a servant of the Secret Fire, wielder of the flame of Anor. The dark fire will not avail you, flame of Udûn!”', next: 'back' },
      back: { who: 'gandalf', say: 'The Balrog’s sword comes down on his staff, and shatters. “Go back to the Shadow!”', next: 'pass' },
      pass: { who: 'gandalf', say: 'He raises staff and sword, and strikes the bridge. “You shall not pass!”', next: 'falls' },
      falls: { who: 'narrator', say: 'The bridge breaks under the Balrog, and it falls. Then its whip cracks up out of the dark and wraps Gandalf’s legs. He clings to the edge, looks at you…', next: 'fly' },
      fly: { who: 'gandalf', say: '“Fly, you fools.” And he is gone.', end: 'won' },
    },
  },
};

export const SPEAKERS = { gandalf: 'Gandalf', frodo: 'Frodo', merry: 'Merry Brandybuck', sam: 'Samwise Gamgee', aragorn: 'Aragorn', boromir: 'Boromir', gimli: 'Gimli', legolas: 'Legolas', narrator: '' };
