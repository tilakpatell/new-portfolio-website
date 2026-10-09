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
import { HOTSPOTS, HOUSE_SPOTS, PLAN } from '../rules';

// eight parasites in the room, and two minutes before they've won
export const RICKALL = { count: 8, time: 120 };

// Where Morty is put as each game starts: at the egg, where he picked it up,
// which is clear of every spot (so nobody is stood on top of him, however he
// left the last game), and turned to the middle of the living room, so the
// crowd is in front of him rather than behind.
const EGG = HOTSPOTS.find((h) => h.id === 'egg');
const LIVING = PLAN.find((r) => r.id === 'living');
export const MORTY_AT = { x: EGG.x, z: EGG.z, face: Math.atan2(EGG.z - (LIVING.z0 + LIVING.z1) / 2, (LIVING.x0 + LIVING.x1) / 2 - EGG.x) };

// `kind`: 'figure', a rigged Meshy figure that idles (public/games/meshy), or
// 'prop', a model that stands still (public/models/c137/rm). `r`: the floor it
// takes round its feet, from its model: a person's 0.3, the Photography
// Raptor's from snout to tail. `h`: how tall it stands in the room, as the
// house draws its people (a little over the site's heights, Morty being 1.7 m
// here; the Reverse Giraffe kept under the beams, the Ghost in a Jar on his
// side table, Baby Wizard to the top of his hat as he floats), for what the
// crosshair is on. Everyone has three memories, so how many are left to hear
// gives nothing away.
const good = (text) => ({ good: true, text });
const bad = (text) => ({ good: false, text });
const parasite = (id, kind, name, r, h, ...texts) => ({ id, kind, name, r, h, memories: texts.map(good) });
const family = (id, name, h, ...memories) => ({ id, kind: 'figure', name, r: 0.3, h, memories });

export const PARASITES = [
  parasite(
    'pencilvester',
    'figure',
    'Pencilvester',
    0.3,
    1.8,
    'Pencilvester drew everyone’s portrait at Thanksgiving, and they all came out looking their best.',
    'Pencilvester helped Morty with his maths homework, and every answer was right.',
    'Pencilvester wrote Summer a birthday card so lovely that she still keeps it.',
  ),
  parasite(
    'sleepygary',
    'figure',
    'Sleepy Gary',
    0.3,
    2.0,
    'Sleepy Gary made the whole family breakfast in his nightcap, and nobody was late for anything.',
    'Sleepy Gary and Jerry dozed off in the hammock together, and woke up happy.',
    'Sleepy Gary read the kids a bedtime story, and fell asleep halfway through, which was lovely.',
  ),
  parasite(
    'hamurai',
    'figure',
    'Hamurai',
    0.3,
    2.0,
    'Hamurai carved the Christmas ham with his sword, very neatly, and everyone had seconds.',
    'Hamurai stood guard at Summer’s sleepover, and nobody was scared all night.',
    'Hamurai taught Morty how to bow, and Morty was good at it.',
  ),
  parasite(
    'amishcyborg',
    'figure',
    'Amish Cyborg',
    0.3,
    2.0,
    'Amish Cyborg helped raise a barn in an afternoon, and dug its footings with his arm.',
    'Amish Cyborg churned the butter for the pancakes, and it was the best butter anyone had ever had.',
    'Amish Cyborg mended the toaster, then sat and thought about it for a long time.',
  ),
  parasite(
    'mrbeauregard',
    'figure',
    'Mr. Beauregard',
    0.3,
    2.05,
    'Mr. Beauregard brought everyone tea on a silver tray, and remembered how each of them took it.',
    'Mr. Beauregard ironed Jerry’s shirts every morning, and called him sir.',
    'Mr. Beauregard laid the Thanksgiving table with three forks each, and nobody used the wrong one.',
  ),
  parasite(
    'cousinnicky',
    'figure',
    'Cousin Nicky',
    0.3,
    2.0,
    'Cousin Nicky came up from Brooklyn for Christmas and cooked his famous meatballs.',
    'Cousin Nicky took Morty to the ball game and caught a home run with his bare hand.',
    'Cousin Nicky got the family the best table in town, because he knew a guy.',
  ),
  parasite(
    'frankenstein',
    'figure',
    'Frankenstein’s monster',
    0.35,
    2.35,
    'Frankenstein’s monster carried Morty on his shoulders at the fair, so he could see everything.',
    'Frankenstein’s monster pulled the whole family round the ice rink, all of them holding on in a line.',
    'Frankenstein’s monster hummed Beth to sleep in a thunderstorm, and she slept right through.',
  ),
  parasite(
    'reversegiraffe',
    'prop',
    'Reverse Giraffe',
    0.4,
    2.3,
    'Reverse Giraffe stood at the back of the family photo, and everyone still fitted in the frame.',
    'Reverse Giraffe reached the top shelf for Beth whenever she asked.',
    'Reverse Giraffe went carol singing with the family, and could see over every hedge.',
  ),
  parasite(
    'ghostinajar',
    'prop',
    'Ghost in a Jar',
    0.3,
    1.05,
    'Ghost in a Jar glowed all night when the power went out, so nobody was scared of the dark.',
    'Ghost in a Jar told Summer a ghost story, and it had a happy ending.',
    'Ghost in a Jar sat in the front window at Halloween, and was the best thing on the street.',
  ),
  parasite(
    'photographyraptor',
    'prop',
    'Photography Raptor',
    0.9,
    1.45,
    'Photography Raptor took the family photo on the stairs, and nobody blinked.',
    'Photography Raptor took the pictures at Beth and Jerry’s wedding, and wouldn’t take a penny.',
    'Photography Raptor caught Morty’s first goal on camera, from the touchline.',
  ),
  parasite(
    'tinkles',
    'prop',
    'Tinkles',
    0.3,
    0.9,
    'Tinkles came to Summer’s tea party, and drank from the smallest cup.',
    'Tinkles slid down a rainbow with the kids in the back yard, again and again.',
    'Tinkles curled up at the end of Morty’s bed when he was ill, and he got better.',
  ),
  parasite(
    'babywizard',
    'prop',
    'Baby Wizard',
    0.3,
    1.2,
    'Baby Wizard turned the rain into confetti on the day of the picnic.',
    'Baby Wizard floated Morty’s goldfish round the living room, then put it back in its bowl.',
    'Baby Wizard magicked the washing-up done every night for a week.',
  ),
  parasite(
    'mrsrefrigerator',
    'prop',
    'Mrs. Refrigerator',
    0.65,
    2.0,
    'Mrs. Refrigerator always had cold lemonade ready when the kids got home from school.',
    'Mrs. Refrigerator kept every one of the kids’ drawings on her door.',
    'Mrs. Refrigerator gave Jerry a hug on his birthday, and it was cold, and he loved it.',
  ),
];

export const FAMILY = [
  family(
    'rick',
    'Rick',
    2.0,
    good('Rick took the whole family to a water park on another planet, and everyone came home.'),
    bad('Rick turned himself into a pickle to get out of family therapy.'),
    bad('Rick left when Beth was a girl, and was gone for twenty years.'),
  ),
  family(
    'morty',
    'Morty',
    1.7,
    bad('Morty was sick in the back of the cruiser on the way home, and Rick made him clean it up.'),
    good('Morty won Summer a goldfish at the fair, and she pretended not to care.'),
    good('Morty stayed up with Jerry for the meteor shower, and they both saw one.'),
  ),
  family(
    'beth',
    'Beth',
    1.88,
    bad('Beth missed Summer’s school play for a horse whose operation ran late.'),
    good('Beth taught Summer to ride a bike, and let go at exactly the right moment.'),
    bad('Beth and Jerry argued all the way to the lake, and all the way back.'),
  ),
  family(
    'jerry',
    'Jerry',
    1.95,
    good('Jerry made pancakes in the shape of everyone’s initials, and only burnt one.'),
    bad('Jerry lost his job at the advertising firm, and spent a week pretending to go to work.'),
    good('Jerry built a birdhouse with Morty, and a bird moved in.'),
  ),
  family(
    'summer',
    'Summer',
    1.8,
    good('Summer did Morty’s hair for picture day, and it looked great.'),
    bad('Summer and Morty fought over the last of the cereal, and didn’t speak for two days.'),
    good('Summer stood up for Morty at school, in front of everyone.'),
  ),
  family(
    'poopybutthole',
    'Mr. Poopybutthole',
    1.7,
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
// been shot, in order, and `t` the seconds gone. `absent`: who isn't in the
// room (a figure whose model won't load, or Morty, who's the one looking): a
// parasite left out is never chosen, so the game can always be won, and with
// fewer than eight to choose from, it's played with them all.
export function newRickall(seed = 1, { absent = [] } = {}) {
  const rand = seeded(seed);
  const shuffled = (list) => {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  const here = (p) => !absent.includes(p.id);
  const room = [...shuffled(PARASITES.filter(here)).slice(0, RICKALL.count), ...FAMILY.filter(here)];
  const spots = shuffled(HOUSE_SPOTS);
  // spot → who stands there
  const on = new Map();
  for (const p of [...room].sort((a, b) => b.r - a.r)) on.set(spots.find((s) => !on.has(s) && s.r >= p.r), p);
  // (listed round the room, in HOUSE_SPOTS' order)
  const people = HOUSE_SPOTS.filter((s) => on.has(s)).map((s) => {
    const p = on.get(s);
    return { id: p.id, kind: p.kind, name: p.name, r: p.r, h: p.h, x: s.x, z: s.z, face: s.face, parasite: PARASITES.includes(p) };
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

// ── the crosshair ──

// The line Morty looks along in the game. ./scene.js puts the camera on it,
// behind his shoulder, so the crosshair in the middle of the screen is on it
// too: from his eyes (`eye` up from his feet), `right` over his right
// shoulder, the way the camera looks (`yaw`, the walking camera's), tipped
// down by `tip` at the walking camera's lift (`level`) and on down as the
// camera is raised, as far as `down` (or up, as far as `up`). Where it starts
// ({ x, y, z }) and which way it goes ({ dx, dy, dz }, a metre long).
export const SIGHT = { eye: 1.55, right: 0.55, level: 0.17, tip: 0.1, up: 0.3, down: 0.9 };
export function sight(m, yaw, pitch = SIGHT.level) {
  const down = Math.max(-SIGHT.up, Math.min(SIGHT.down, pitch - SIGHT.level + SIGHT.tip));
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const c = Math.cos(down);
  return { x: m.x - fz * SIGHT.right, y: (m.y ?? 0) + SIGHT.eye, z: m.z + fx * SIGHT.right, dx: fx * c, dy: -Math.sin(down), dz: fz * c };
}

// How wide someone is to the crosshair: a body's width, someone bigger
// (the raptor's tail, Mrs. Refrigerator's arms) more, but never so much that
// it takes in the one stood next to them; and how far it reaches. `small`:
// as tall as someone can be and still be in the sights with the line passing
// over their head, as long as it's no more than `over` above it (Tinkles, the
// Ghost in a Jar, Baby Wizard: to look right down at them would be to lose
// everyone else); anyone taller has to be looked at.
export const AIM = { r: 0.35, wide: 0.5, reach: 12, small: 1.2, over: 0.6 };
export const aimR = (p) => Math.max(AIM.r, Math.min(AIM.wide, p.r));

// ── the camera ──

// The camera stands on the sight line, `back` behind where it starts (and
// ./scene.js brings it nearer for a wall or the furniture), so the crosshair
// in the middle of the screen is on it. Never in someone, though: anyone
// within `pad` of their cylinder (as the crosshair takes them, and `over`
// above their head) is either behind his shoulder, and the camera comes in
// along the line in front of them, or the line starts inside them, right at
// his shoulder, where no camera on it could see past them: those are left
// out of the picture, and out of the sights, till he steps away.
export const CAM = { back: 1.6, pad: 0.15, over: 0.15 };
const atShoulder = (p, s) => s.y < p.h + CAM.over && Math.hypot(s.x - p.x, s.z - p.z) < aimR(p) + CAM.pad;

// How far back along the sight line `s` the camera can stand, and who's
// left out of the picture ({ back, hide: [id] }), for whoever's standing.
export function view(game, s) {
  let back = CAM.back;
  const hide = [];
  const flat2 = s.dx * s.dx + s.dz * s.dz;
  for (const p of game.people) {
    if (game.shot.includes(p.id)) continue;
    if (atShoulder(p, s)) {
      hide.push(p.id);
      continue;
    }
    if (flat2 < 1e-12) continue;
    // where, going back along the line, it's inside their circle (in metres)...
    const ox = s.x - p.x;
    const oz = s.z - p.z;
    const half = -(ox * s.dx + oz * s.dz);
    const disc = half * half - flat2 * (ox * ox + oz * oz - (aimR(p) + CAM.pad) ** 2);
    if (disc < 0) continue;
    // ...and under the top of their head (going back, the line rises if he's looking down)
    const top = p.h + CAM.over;
    let lo = 0;
    let hi = back;
    if (s.dy < -1e-9) hi = Math.min(hi, (top - s.y) / -s.dy);
    else if (s.dy > 1e-9) lo = Math.max(lo, (s.y - top) / s.dy);
    else if (s.y >= top) continue;
    const enter = Math.max((-half - Math.sqrt(disc)) / flat2, lo);
    if (enter <= Math.min((-half + Math.sqrt(disc)) / flat2, hi)) back = enter;
  }
  return { back, hide };
}

// Who's under the crosshair, along the sight line `s`: the nearest still
// standing whose upright cylinder (aimR round, from the floor to the top of
// their head) the line meets within `reach`; or, if it misses them all, the
// nearest of the small ones it passes close over (see AIM). Never anyone the
// line starts inside, left out of the picture (see CAM). Null for nobody, or
// once it's over.
export function aimAt(game, s, reach = AIM.reach) {
  if (game.state !== 'on') return null;
  const flat = Math.hypot(s.dx, s.dz); // how far across the floor, for each metre along the line
  if (flat < 1e-6) return null;
  let hit = null;
  let hitAt = Infinity;
  let near = null;
  let nearAt = Infinity;
  for (const p of game.people) {
    if (game.shot.includes(p.id) || atShoulder(p, s)) continue;
    // where the line is inside their circle, in metres along it
    const ox = s.x - p.x;
    const oz = s.z - p.z;
    const a = flat * flat;
    const b = ox * s.dx + oz * s.dz;
    const r = aimR(p);
    const disc = b * b - a * (ox * ox + oz * oz - r * r);
    if (disc < 0) continue;
    const t0 = (-b - Math.sqrt(disc)) / a;
    const t1 = (-b + Math.sqrt(disc)) / a;
    if (t1 < 0) continue;
    // and where it's between the floor and the top of their head
    let y0 = -Infinity;
    let y1 = Infinity;
    if (Math.abs(s.dy) > 1e-9) {
      y0 = Math.min(-s.y / s.dy, (p.h - s.y) / s.dy);
      y1 = Math.max(-s.y / s.dy, (p.h - s.y) / s.dy);
    } else if (s.y < 0 || s.y > p.h) y0 = Infinity; // (level, over their head or under the floor: never)
    const enter = Math.max(t0, y0, 0);
    if (enter <= Math.min(t1, y1, reach) && enter < hitAt) {
      hit = p.id;
      hitAt = enter;
    }
    // (someone small: how high over their head the line is, where it comes to them and as it leaves)
    if (p.h > AIM.small) continue;
    const across = Math.max(t0, 0) * flat;
    const into = s.y + s.dy * Math.max(t0, 0);
    if (across <= reach && across < nearAt && into >= p.h && Math.min(into, s.y + s.dy * t1) <= p.h + AIM.over) {
      near = p.id;
      nearAt = across;
    }
  }
  return hit ?? near;
}

// ── how it ended ──

// For its card: won (in Mr. Poopybutthole's own words, if he was there to be
// spared), a Smith shot (which one), Mr. Poopybutthole shot, or the time run
// out. Null while it's on.
export function ending(game) {
  if (game.state === 'won') {
    const spared = game.people.some((p) => p.id === 'poopybutthole');
    return { kind: 'won', title: 'Survived', line: spared ? 'Ooh wee. You spared Mr. Poopybutthole.' : 'Every parasite’s gone, and every Smith is still here.' };
  }
  if (game.state === 'family') return { kind: 'family', title: 'Not a parasite', line: `That was ${EVERYONE.get(game.shot.at(-1)).name}.` };
  if (game.state === 'poopybutthole') return { kind: 'poopybutthole', title: 'Not a parasite', line: 'He was real. He always was.' };
  if (game.state === 'out') return { kind: 'out', title: 'Out of time', line: 'The parasites are family now. Nobody can remember the house without them.' };
  return null;
}
