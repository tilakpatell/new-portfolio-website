// Total Rickall, the Smith house's own episode, as rules. A memory parasite's
// egg hatches in the living room and it fills: the family, Mr. Poopybutthole,
// and eight of the parasites, each of them someone the family is sure it has
// always known. A parasite plants only happy memories of itself, so a real
// person is the one with a bad memory too: look at someone and hear what you
// remember of them, and shoot the ones whose memories are all good. Shoot a
// Smith, or Mr. Poopybutthole (who has only one bad memory, and it comes last),
// and it's over; shoot the eighth parasite and it's won; and after two
// minutes it's lost anyway. No drawing, so it can be tested on its own.
//
// A game is one object that `tell`, `shoot` and `stepRickall` change in place,
// each returning only what happened, so a second shot at someone in the same
// frame finds them already shot and counts for nothing.

import { seeded } from '../../../../lib/seeded';
import { HOUSE_SPOTS } from '../rules';

// eight parasites in the room, and two minutes before they've won
export const RICKALL = { count: 8, time: 120 };

// `kind`: 'figure', a rigged Meshy figure that idles (public/games/meshy), or
// 'prop', a model that stands still (public/models/c137/rm). `r`: the floor it
// takes round its feet, from its model: a person's 0.3, the Photography
// Raptor's from snout to tail. Everyone has three memories, so how many are
// left to hear gives nothing away.
const good = (text) => ({ good: true, text });
const bad = (text) => ({ good: false, text });
const parasite = (id, kind, name, r, ...texts) => ({ id, kind, name, r, memories: texts.map(good) });
const family = (id, name, ...memories) => ({ id, kind: 'figure', name, r: 0.3, memories });

export const PARASITES = [
  parasite(
    'pencilvester',
    'figure',
    'Pencilvester',
    0.3,
    'Pencilvester drew everyone’s portrait at Thanksgiving, and they all came out looking their best.',
    'Pencilvester helped Morty with his maths homework, and every answer was right.',
    'Pencilvester wrote Summer a birthday card so lovely that she still keeps it.',
  ),
  parasite(
    'sleepygary',
    'figure',
    'Sleepy Gary',
    0.3,
    'Sleepy Gary made the whole family breakfast in his nightcap, and nobody was late for anything.',
    'Sleepy Gary and Jerry dozed off in the hammock together, and woke up happy.',
    'Sleepy Gary read the kids a bedtime story, and fell asleep halfway through, which was lovely.',
  ),
  parasite(
    'hamurai',
    'figure',
    'Hamurai',
    0.3,
    'Hamurai carved the Christmas ham with his sword, very neatly, and everyone had seconds.',
    'Hamurai stood guard at Summer’s sleepover, and nobody was scared all night.',
    'Hamurai taught Morty how to bow, and Morty was good at it.',
  ),
  parasite(
    'amishcyborg',
    'figure',
    'Amish Cyborg',
    0.3,
    'Amish Cyborg helped raise a barn in an afternoon, and dug its footings with his arm.',
    'Amish Cyborg churned the butter for the pancakes, and it was the best butter anyone had ever had.',
    'Amish Cyborg mended the toaster, then sat and thought about it for a long time.',
  ),
  parasite(
    'mrbeauregard',
    'figure',
    'Mr. Beauregard',
    0.3,
    'Mr. Beauregard brought everyone tea on a silver tray, and remembered how each of them took it.',
    'Mr. Beauregard ironed Jerry’s shirts every morning, and called him sir.',
    'Mr. Beauregard laid the Thanksgiving table with three forks each, and nobody used the wrong one.',
  ),
  parasite(
    'cousinnicky',
    'figure',
    'Cousin Nicky',
    0.3,
    'Cousin Nicky came up from Brooklyn for Christmas and cooked his famous meatballs.',
    'Cousin Nicky took Morty to the ball game and caught a home run with his bare hand.',
    'Cousin Nicky got the family the best table in town, because he knew a guy.',
  ),
  parasite(
    'frankenstein',
    'figure',
    'Frankenstein’s monster',
    0.35,
    'Frankenstein’s monster carried Morty on his shoulders at the fair, so he could see everything.',
    'Frankenstein’s monster pulled the whole family round the ice rink, all of them holding on in a line.',
    'Frankenstein’s monster hummed Beth to sleep in a thunderstorm, and she slept right through.',
  ),
  parasite(
    'reversegiraffe',
    'prop',
    'Reverse Giraffe',
    0.4,
    'Reverse Giraffe stood at the back of the family photo, and everyone still fitted in the frame.',
    'Reverse Giraffe reached the top shelf for Beth whenever she asked.',
    'Reverse Giraffe went carol singing with the family, and could see over every hedge.',
  ),
  parasite(
    'ghostinajar',
    'prop',
    'Ghost in a Jar',
    0.3,
    'Ghost in a Jar glowed all night when the power went out, so nobody was scared of the dark.',
    'Ghost in a Jar told Summer a ghost story, and it had a happy ending.',
    'Ghost in a Jar sat in the front window at Halloween, and was the best thing on the street.',
  ),
  parasite(
    'photographyraptor',
    'prop',
    'Photography Raptor',
    0.9,
    'Photography Raptor took the family photo on the stairs, and nobody blinked.',
    'Photography Raptor took the pictures at Beth and Jerry’s wedding, and wouldn’t take a penny.',
    'Photography Raptor caught Morty’s first goal on camera, from the touchline.',
  ),
  parasite(
    'tinkles',
    'prop',
    'Tinkles',
    0.3,
    'Tinkles came to Summer’s tea party, and drank from the smallest cup.',
    'Tinkles slid down a rainbow with the kids in the back yard, again and again.',
    'Tinkles curled up at the end of Morty’s bed when he was ill, and he got better.',
  ),
  parasite(
    'babywizard',
    'prop',
    'Baby Wizard',
    0.3,
    'Baby Wizard turned the rain into confetti on the day of the picnic.',
    'Baby Wizard floated Morty’s goldfish round the living room, then put it back in its bowl.',
    'Baby Wizard magicked the washing-up done every night for a week.',
  ),
  parasite(
    'mrsrefrigerator',
    'prop',
    'Mrs. Refrigerator',
    0.65,
    'Mrs. Refrigerator always had cold lemonade ready when the kids got home from school.',
    'Mrs. Refrigerator kept every one of the kids’ drawings on her door.',
    'Mrs. Refrigerator gave Jerry a hug on his birthday, and it was cold, and he loved it.',
  ),
];

export const FAMILY = [
  family(
    'rick',
    'Rick',
    good('Rick took the whole family to a water park on another planet, and everyone came home.'),
    bad('Rick turned himself into a pickle to get out of family therapy.'),
    bad('Rick left when Beth was a girl, and was gone for twenty years.'),
  ),
  family(
    'morty',
    'Morty',
    bad('Morty was sick in the back of the cruiser on the way home, and Rick made him clean it up.'),
    good('Morty won Summer a goldfish at the fair, and she pretended not to care.'),
    good('Morty stayed up with Jerry for the meteor shower, and they both saw one.'),
  ),
  family(
    'beth',
    'Beth',
    bad('Beth missed Summer’s school play for a horse whose operation ran late.'),
    good('Beth taught Summer to ride a bike, and let go at exactly the right moment.'),
    bad('Beth and Jerry argued all the way to the lake, and all the way back.'),
  ),
  family(
    'jerry',
    'Jerry',
    good('Jerry made pancakes in the shape of everyone’s initials, and only burnt one.'),
    bad('Jerry lost his job at the advertising firm, and spent a week pretending to go to work.'),
    good('Jerry built a birdhouse with Morty, and a bird moved in.'),
  ),
  family(
    'summer',
    'Summer',
    good('Summer did Morty’s hair for picture day, and it looked great.'),
    bad('Summer and Morty fought over the last of the cereal, and didn’t speak for two days.'),
    good('Summer stood up for Morty at school, in front of everyone.'),
  ),
  family(
    'poopybutthole',
    'Mr. Poopybutthole',
    good('Mr. Poopybutthole came for Thanksgiving with a pie, and stayed to do the washing-up.'),
    good('Mr. Poopybutthole taught Morty to swim at the lake, and never once let go.'),
    bad('Mr. Poopybutthole forgot to pick Morty up from school once, and said sorry for a month.'),
  ),
];
const EVERYONE = new Map([...PARASITES, ...FAMILY].map((p) => [p.id, p]));

// A new game, the same for the same seed: eight parasites chosen, and
// everyone given a spot of HOUSE_SPOTS with room for them (the biggest
// placed first, so the raptor always finds the open floor), facing the middle
// of the room. `told` is how many times each has been looked at, `shot` who's
// been shot, in order, and `t` the seconds gone.
export function newRickall(seed = 1) {
  const rand = seeded(seed);
  const shuffled = (list) => {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  const room = [...shuffled(PARASITES).slice(0, RICKALL.count), ...FAMILY];
  const spots = shuffled(HOUSE_SPOTS);
  // spot → who stands there
  const on = new Map();
  for (const p of [...room].sort((a, b) => b.r - a.r)) on.set(spots.find((s) => !on.has(s) && s.r >= p.r), p);
  // (listed round the room, in HOUSE_SPOTS' order)
  const people = HOUSE_SPOTS.filter((s) => on.has(s)).map((s) => {
    const p = on.get(s);
    return { id: p.id, kind: p.kind, name: p.name, r: p.r, x: s.x, z: s.z, face: s.face, parasite: PARASITES.includes(p) };
  });
  return { people, told: {}, shot: [], state: 'on', t: 0 };
}

// someone in the room and still standing, while it's on
const standing = (game, id) => (game.state === 'on' && !game.shot.includes(id) ? game.people.find((p) => p.id === id) : null);

export const parasitesLeft = (game) => game.people.filter((p) => p.parasite && !game.shot.includes(p.id)).length;

// Looking at someone: the next of their memories not yet heard (round again
// once all three have been), and how many are left to hear. Null for anyone
// not standing in the room, or once it's over.
export function tell(game, id) {
  if (!standing(game, id)) return null;
  const { memories } = EVERYONE.get(id);
  const n = game.told[id] ?? 0;
  game.told[id] = n + 1;
  return { memory: memories[n % memories.length], remaining: Math.max(0, memories.length - n - 1) };
}

// Shooting someone: 'parasite' (one fewer), 'won' (that was the last of
// them), 'family' or 'poopybutthole' (a real person, and it's over). Null if
// they're not standing in the room, already shot, or it's over.
export function shoot(game, id) {
  const p = standing(game, id);
  if (!p) return null;
  game.shot.push(id);
  if (p.parasite) {
    if (parasitesLeft(game) > 0) return 'parasite';
    game.state = 'won';
  } else game.state = id === 'poopybutthole' ? 'poopybutthole' : 'family';
  return game.state;
}

// The clock: 'out' on the step it runs out, while it's on; null otherwise
export function stepRickall(game, dt) {
  if (game.state !== 'on') return null;
  game.t += Math.max(0, dt);
  if (game.t < RICKALL.time) return null;
  game.state = 'out';
  return 'out';
}
