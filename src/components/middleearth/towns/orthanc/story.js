// Orthanc, the story: Gandalf's visit to Isengard, as he told it at the
// Council of Elrond (and as the films showed it). The six things to do, in
// order, and what's said on the way. The places are in ./layout.js, the
// games in ./rules.js.

import { progress } from '../story';

export const QUESTS = [
  {
    id: 'hall',
    name: 'Saruman the White',
    where: 'The great hall of Orthanc',
    blurb: 'You have ridden to Isengard for counsel. Saruman is waiting by his throne.',
    go: 'Into the great hall. Saruman the White is waiting for you by his throne.',
  },
  {
    id: 'library',
    name: 'The library of lore',
    where: 'Through the arch, east of the hall',
    blurb: 'Saruman’s books: the lore of the Rings of Power, gathered over long years. Read what he has been reading.',
    go: 'Saruman bids you read his lore first. Through the arch to the east, to the lectern at the far end.',
    needs: 'hall',
    locked: 'Once Saruman has greeted you.',
  },
  {
    id: 'palantir',
    name: 'The palantír',
    where: 'On its pillar before the throne',
    blurb: 'One of the seeing-stones of old. Look into it, and look away when the Eye turns.',
    go: 'Back to the hall: Saruman has uncovered the stone on its pillar. Look into it.',
    needs: 'library',
    locked: 'After the library.',
  },
  {
    id: 'duel',
    name: 'The duel of the wizards',
    where: 'The great hall',
    blurb: 'Raise your staff as his falls, then push him back while he is off balance.',
    go: 'Saruman has shown his hand. Stand against him: block his staff, then push him back.',
    needs: 'palantir',
    locked: 'Once you know what Saruman is.',
  },
  {
    id: 'stair',
    name: 'The long stair',
    where: 'Up inside the tower',
    blurb: 'Driven up the stair to the top of Orthanc, his Voice at your back. Look out of the windows on the way.',
    go: 'Up the long stair, Saruman behind you. Hold W (or the button) to climb.',
    needs: 'duel',
    locked: 'After the duel.',
  },
  {
    id: 'pinnacle',
    name: 'The pinnacle',
    where: 'The top of Orthanc',
    blurb: 'A prisoner in the storm over Isengard. A moth comes: hold out your hand to it, and whisper.',
    go: 'A prisoner on the pinnacle of Orthanc, in the wind. Something small is fluttering at the north edge.',
    needs: 'stair',
    locked: 'At the top of the stair.',
  },
];

// the seal won at the end (../../../Achievements.jsx); finding the tower at
// all wins its own, as soon as you're in
export const SEAL = { pinnacle: 'windlord' };
export const FOUND = 'orthanc';

// what's next, the objective, where you are, and whether Saruman still
// lets you keep your staff
export function orthancProgress(done = []) {
  const p = progress(QUESTS, done);
  const next = p.quests.find((q) => q.id === p.next);
  const objective = p.finished ? 'Away north on the Windlord’s back, to Rivendell. Isengard burns behind you.' : next.go;
  // once it's all done, the hall is yours to walk, staff and all
  const zone = p.finished ? 'hall' : ({ hall: 'hall', library: 'hall', palantir: 'hall', duel: 'hall', stair: 'stair' }[p.next] ?? 'top');
  const staff = p.finished || !p.done.includes('duel');
  return { ...p, objective, zone, staff };
}

export const CONVOS = {
  // by the throne
  greet: {
    start: 'hall',
    nodes: {
      hall: { who: 'narrator', say: 'The doors of Orthanc boom shut behind you. The hall is black, and polished, and very still. By the throne, in white, Saruman is waiting.', next: 'smoke' },
      smoke: { who: 'saruman', say: '“Smoke rises from the Mountain of Doom. The hour grows late, and Gandalf the Grey rides to Isengard seeking my counsel. For that is why you have come, is it not, my old friend?”', next: 'answer' },
      answer: {
        who: 'gandalf',
        say: 'What do you say?',
        choices: [
          { text: '“Saruman, the Ring is found. In the Shire.”', to: 'shire' },
          { text: '“Saruman the Wise… or is it Saruman of Many Colours now?”', to: 'colours' },
        ],
      },
      shire: { who: 'saruman', say: '“In the Shire? And you have known this, and said nothing? Your love of the halflings’ leaf has clearly slowed your mind.”', next: 'books' },
      colours: { who: 'narrator', say: 'He smiles, and turns, and his robe is not white at all: it is woven of every colour, and shimmers and changes as he moves, till the eye is bewildered.', next: 'white' },
      white: { who: 'saruman', say: '“White! It serves as a beginning. White cloth may be dyed. The white page can be overwritten; and the white light can be broken.”', next: 'broken' },
      broken: { who: 'gandalf', say: '“In which case it is no longer white. And he that breaks a thing to find out what it is has left the path of wisdom.”', next: 'books' },
      books: { who: 'saruman', say: '“Read, before you lecture me. My books are through the arch: all the lore of the Rings of Power, gathered over long years. Go. Then we will talk of what is to be done.”', end: 'won' },
    },
  },
  // at the lectern
  lore: {
    start: 'book',
    nodes: {
      book: { who: 'narrator', say: 'A great book lies open on the lectern, in Saruman’s close hand: the making of the Rings. Nine, Seven, Three; and the One, to rule them all.', next: 'margin' },
      margin: { who: 'narrator', say: 'In the margin, in fresher ink: the seven seeing-stones of the Númenóreans. “One was kept in Orthanc.” And under it, crossed out, and written again: “Why should we fear to use it?”', next: 'look' },
      look: { who: 'gandalf', say: '“Saruman… what have you been looking at?”', end: 'won' },
    },
  },
  // at the stone
  stone: {
    start: 'cloth',
    nodes: {
      cloth: { who: 'narrator', say: 'Saruman draws the cloth from the pillar. In a cradle of black claws sits a globe of dark glass, and deep in it something moves, like a fire a long way off.', next: 'tool' },
      tool: { who: 'gandalf', say: '“The palantír is a dangerous tool, Saruman.”', next: 'why' },
      why: { who: 'saruman', say: '“Why? Why should we fear to use it? Look, Gandalf. See for yourself.”', next: 'how' },
      how: { who: 'narrator', say: 'Look into the stone (hold Space, or the button) and let the vision come. When the Eye turns to search it, look away. Hold your gaze too long, and it will find you.', end: 'won' },
    },
  },
  // when the vision has been seen
  seen: {
    start: 'pits',
    nodes: {
      pits: { who: 'narrator', say: 'You tear your eyes from it. The Eye, lidless, wreathed in flame; and under Isengard, in pits where the trees once grew, an army being made.', next: 'nine' },
      nine: { who: 'saruman', say: '“The Nine have left Minas Morgul. They have crossed the River Isen, disguised as riders in black. They will find the Ring, and kill the one who carries it.”', next: 'join' },
      join: { who: 'saruman', say: '“Against the power of Mordor there can be no victory. We must join with him, Gandalf. We must join with Sauron. It would be wise, my friend.”', next: 'madness' },
      madness: { who: 'gandalf', say: '“Tell me, friend: when did Saruman the Wise abandon reason for madness?”', next: 'fight' },
      fight: { who: 'narrator', say: 'He lifts his staff. Block his blows as they fall (A or D), and push him back while he is off balance (Space).', end: 'won' },
    },
  },
  // after the duel
  staff: {
    start: 'laugh',
    nodes: {
      laugh: { who: 'narrator', say: 'You drive him back across the floor, and he laughs, and opens his hand, and your staff leaps out of your grip and into his.', next: 'pain' },
      pain: { who: 'saruman', say: '“I gave you the chance of aiding me willingly, but you have elected the way of pain.”', next: 'up' },
      up: { who: 'narrator', say: 'The door to the stair swings open. With your own staff at your back, he drives you up into the dark of the tower.', end: 'won' },
    },
  },
  // the windows on the way up
  felled: {
    start: 'trees',
    nodes: {
      trees: { who: 'narrator', say: 'Through the slit of the window, far below: the ring of Isengard. There were gardens in it once, and trees. They are being cut down, and dragged to the fires.', next: 'voice' },
      voice: { who: 'voice', say: '“The old world will burn in the fires of industry. Forests will fall. A new order will rise.”', end: 'won' },
    },
  },
  pits: {
    start: 'fires',
    nodes: {
      fires: { who: 'narrator', say: 'The pits glow red. Smoke goes up from a hundred shafts, and under the ground, hammers, and the roar of furnaces.', next: 'voice' },
      voice: { who: 'voice', say: '“We will drive the machine of war with the sword and the spear and the iron fists of the orc.”', end: 'won' },
    },
  },
  host: {
    start: 'ranks',
    nodes: {
      ranks: { who: 'narrator', say: 'In the shadow of the wall, ranks of tall orcs in black mail, the White Hand on their shields, waiting for their master’s word.', next: 'voice' },
      voice: { who: 'voice', say: 'Soft, and very reasonable: “Tell me where the Ring is, old friend, and you shall have your staff again, and your freedom. Think on it.”', end: 'won' },
    },
  },
  // at the top
  prison: {
    start: 'top',
    nodes: {
      top: { who: 'narrator', say: 'The stair ends under the sky, on the very top of Orthanc, between its four horns. The wind is cold, and there is no way down.', next: 'stay' },
      stay: { who: 'saruman', say: 'From the door below, as it shuts: “You shall stay here, Gandalf the Grey, and rest from journeys, until you tell me where the One is to be found.”', end: 'won' },
    },
  },
  // the moth on your hand
  moth: {
    start: 'lands',
    nodes: {
      lands: { who: 'narrator', say: 'It settles on your fingers at last: a small grey moth, its wings trembling in the wind.', next: 'whisper' },
      whisper: {
        who: 'gandalf',
        say: 'You bring it close, and whisper.',
        choices: [{ text: '“Go. Find the Windlord. Tell him Gandalf is waiting.”', to: 'gone' }],
      },
      gone: { who: 'narrator', say: 'It lifts from your hand, and is gone into the dark, north, over the ring wall, towards the mountains.', next: 'wait' },
      wait: { who: 'narrator', say: 'Hours pass. Then, out of the north, out of the night, something huge and fast on great wings: Gwaihir the Windlord, swiftest of the Great Eagles.', next: 'jump' },
      jump: { who: 'narrator', say: 'He sweeps past the tower, and wheels, and comes round again, low under the pinnacle’s edge. Jump when he is beneath you (Space).', end: 'won' },
    },
  },
  // something behind the books
  leaf: {
    start: 'jar',
    nodes: {
      jar: { who: 'narrator', say: 'Behind the books, on the lowest shelf, in the dark: a little stone jar with a lid, and a smell you know.', next: 'name' },
      name: { who: 'gandalf', say: '“Longbottom Leaf. From the Southfarthing.” You look at it for a long while. “Well, well. Saruman, who laughed at me for my love of the halflings’ leaf.”', next: 'pipe' },
      pipe: { who: 'narrator', say: 'You fill your pipe from it. It would be a shame to let it go to waste.', end: 'won' },
    },
  },
};

export const SPEAKERS = { saruman: 'Saruman', gandalf: 'Gandalf', voice: 'The Voice of Saruman', narrator: '' };
