// The multiverse's destinations as data, and the portal gun's dial. Each
// place stands in its own column west of the rooms, one per 100 m of z from
// z = 900 (the plan's Global Constraints); its builder (./<id>.js) loads the
// first time the portal opens on it. Rick's garage portal goes wherever the
// dial is set (kept as tp-rm-dial); every destination's portal goes home to
// the garage.
//
// Pure: rules.js spreads these into AREAS, LINKS, PEOPLE, HOTSPOTS and
// TASKS; RmWorld.jsx takes the names, what people say and what talking to
// them does.

export const DEST_COL = { x0: -470, x1: -330 };
export const DEST_X = (DEST_COL.x0 + DEST_COL.x1) / 2;
export const destZ = (i) => 900 + 100 * i;
// a place's box: `deep` along z round its row, `wide` across the column's middle
export const destArea = (i, deep = 50, wide = DEST_COL.x1 - DEST_COL.x0) => ({ x0: DEST_X - wide / 2, x1: DEST_X + wide / 2, z0: destZ(i) - deep / 2, z1: destZ(i) + deep / 2 });

// headings, as rules.js has them: a figure facing `face` looks along (cos, −sin)
const N = Math.PI / 2;
const S = -Math.PI / 2;
const E = 0;
const W = Math.PI;

// where every portal home arrives: beside the garage's portal, facing into the room
export const GARAGE_BACK = { x: -301.2, z: 101.4, face: 0 };

// A place: its row `i`, its box, and everything in it in metres from its
// middle (dx east, dz south), turned into the world's coordinates here.
// `acts`: a hotspot that, used, tells the place's builder (its `actions`, by
// name). `escape`: a place left in a hurry: once its `spot` is used (with its
// `after` spot used first on this visit, else that spot says `before`),
// getting home through the portal inside `s` seconds is `task` done.
// `goal`: the hotspot the map points to for the place's thing to do, where
// no talk or escape says (the Vindicators' door to Rick's rooms).
// `collect`: a task done once every one of its `spots` has been used on a
// visit (the simulation's slips).
function place(i, { id, name, note, kind, deep, wide, sky, ceiling, people = [], extras = [], spots = [], solids = [], tasks = [], say = {}, done = {}, unlock = {}, acts = {}, escape = null, goal = null, collect = null, kinds = [] }) {
  const area = destArea(i, deep, wide);
  const cx = DEST_X;
  const cz = destZ(i);
  const w = (o) => ({ ...o, x: cx + o.dx, z: cz + o.dz });
  return {
    id,
    i,
    name,
    note,
    kind,
    area,
    sky,
    ceiling,
    centre: { x: cx, z: cz },
    // in at the south edge facing north; the way home 3 m behind
    arrive: { x: cx, z: area.z1 - (kind === 'room' ? 4.6 : 7), face: N },
    back: { x: cx, z: area.z1 - (kind === 'room' ? 1.6 : 4) },
    people: people.map((p) => ({ ...w(p), area: id })),
    // the crowd: copies of the Meshy figures made for it, standing about ({ kind, dx, dz, face })
    extras: extras.map((e) => w(e)),
    hotspots: spots.map((s) => ({ r: 1.4, ...w(s), area: id })),
    // what can't be walked through: { id, dx, dz, w, d } boxes and { id, dx, dz, r } posts
    solids: solids.map((s) => w(s)),
    tasks,
    say,
    done,
    unlock,
    acts,
    escape,
    goal,
    collect,
    kinds,
  };
}

export const DESTINATIONS = [
  place(0, {
    id: 'customs',
    name: 'Interdimensional Customs',
    note: 'The customs hall between the dimensions. Rick’s Mega Seeds shouldn’t go through the scanner.',
    kind: 'room',
    deep: 30,
    wide: 34,
    ceiling: 8,
    people: [
      { id: 'customs-agent1', who: 'gromflomite', dx: -4, dz: -4.6, face: S },
      { id: 'customs-agent2', who: 'gromflomite', dx: 4, dz: -4.6, face: S },
      { id: 'krombopulos', dx: 10, dz: -8, face: W },
    ],
    extras: [
      { kind: 'zigerion', dx: -6, dz: 2, face: N },
      { kind: 'gearperson-a', dx: -6, dz: 4, face: N },
      { kind: 'zigerion', dx: -6, dz: 6, face: N + 0.3 },
      { kind: 'plutonian-a', dx: -6, dz: 7.8, face: N },
      { kind: 'zigerion', dx: -11, dz: -9, face: 0.4 },
    ],
    spots: [
      { id: 'seeds', dx: 6, dz: 5.4, label: 'Rick’s Mega Seeds', verb: 'Take' },
      { id: 'scanner', dx: 0, dz: 0, label: 'The scanner', verb: 'Walk through', r: 1.1 },
      { id: 'customs-agent1', dx: -4, dz: -2.8, label: 'A customs agent', verb: 'Talk' },
      { id: 'customs-agent2', dx: 4, dz: -2.8, label: 'A customs agent', verb: 'Talk' },
      { id: 'krombopulos', dx: 10, dz: -8, label: 'Krombopulos Michael', verb: 'Talk' },
      { id: 'queue', dx: -4.2, dz: 5, label: 'The queue', verb: 'Look' },
    ],
    solids: [
      { id: 'arch-west', dx: -1.45, dz: 0, r: 0.35 },
      { id: 'arch-east', dx: 1.45, dz: 0, r: 0.35 },
      { id: 'arch-b-west', dx: -7.45, dz: 0, r: 0.35 },
      { id: 'arch-b-east', dx: -4.55, dz: 0, r: 0.35 },
      { id: 'desk-west', dx: -4, dz: -3.6, w: 3, d: 0.9 },
      { id: 'desk-east', dx: 4, dz: -3.6, w: 3, d: 0.9 },
      { id: 'seeds', dx: 6, dz: 6.6, w: 1.6, d: 0.8 },
      { id: 'pad-west', dx: -10, dz: -10.5, r: 1.7 },
      { id: 'pad-east', dx: 3, dz: -10.5, r: 1.7 },
    ],
    tasks: [{ id: 'customs', name: 'Get the seeds through customs', hint: 'Dial Interdimensional Customs on the portal gun, take Rick’s Mega Seeds, walk through the scanner, and get back through the portal before they catch you.' }],
    say: {
      seeds: { who: null, text: 'Rick’s Mega Seeds. He says to keep them somewhere the scanner won’t look. He didn’t say where.' },
      scanner: { who: null, text: 'The arch goes red and the sirens start. They’ve found the seeds. Run for the portal.' },
      'customs-agent1': { who: 'A customs agent', text: 'Next. Anything to declare? Seeds, fruit, Ricks?' },
      'customs-agent2': { who: 'A customs agent', text: 'Bags on the belt, stand in the arch, and don’t make it weird.' },
      krombopulos: { who: 'Krombopulos Michael', text: 'Krombopulos Michael. Oh boy, here I go killing again! Not you, kid. You seem nice.' },
      queue: { who: null, text: 'The queue for the other arch. Everyone in it is from somewhere else, and they’ve all been waiting a while.' },
    },
    acts: { seeds: 'took', scanner: 'alarm' },
    escape: { spot: 'scanner', after: 'seeds', before: { who: 'A customs agent', text: 'The arch stays green. “Clean. Next.”' }, s: 60, task: 'customs' },
    kinds: ['gromflomite', 'krombopulos', 'zigerion', 'gearperson-a', 'plutonian-a'],
  }),
  place(1, {
    id: 'squanch',
    name: 'Planet Squanch',
    note: 'Squanchy’s planet, red grass and cat-tree houses. Birdperson’s getting married today.',
    kind: 'outdoor',
    deep: 50,
    wide: 70,
    sky: { top: 0x2a8a9a, mid: 0x7ad2c8, low: 0xf2d8b8, sun: 0xfff0d8, clouds: 1, moons: 0 },
    people: [
      { id: 'squanchy', dx: -10, dz: -6, face: S },
      { id: 'sbirdperson', who: 'birdperson', dx: 5.2, dz: -11, face: S, until: 'squanch' },
      { id: 'stammy', who: 'tammy', dx: 6.8, dz: -11, face: S, until: 'squanch' },
    ],
    extras: [
      { kind: 'magdalian-a', dx: 1, dz: -3, face: N },
      { kind: 'magdalian-c', dx: 11, dz: -3, face: N },
      { kind: 'magdalian-b', dx: 2.5, dz: 1, face: N + 0.2 },
    ],
    spots: [
      { id: 'squanchy', dx: -10, dz: -6, label: 'Squanchy', verb: 'Talk' },
      { id: 'sbirdperson', dx: 5.2, dz: -9.4, label: 'Birdperson', verb: 'Talk', until: 'squanch' },
      { id: 'stammy', dx: 6.8, dz: -9.4, label: 'Tammy', verb: 'Talk', until: 'squanch' },
      { id: 'toast', dx: 16, dz: -1.6, label: 'The wedding toast', verb: 'Raise a glass' },
      { id: 'suckulents', dx: -19, dz: 9, label: 'Suckulents', verb: 'Look', r: 2 },
      { id: 'cattree', dx: -14, dz: -9, label: 'Squanchy’s house', verb: 'Look', r: 2 },
    ],
    solids: [
      { id: 'house', dx: -14, dz: -14, r: 3.6 },
      { id: 'tree-b', dx: 22, dz: -14, r: 2.6 },
      { id: 'tree-c', dx: -25, dz: 4, r: 2.6 },
      { id: 'arch-west', dx: 4, dz: -12.6, r: 0.3 },
      { id: 'arch-east', dx: 8, dz: -12.6, r: 0.3 },
      { id: 'table', dx: 16, dz: -3.4, w: 5, d: 1.2 },
      { id: 'suckulents', dx: -19, dz: 11, r: 1.4 },
    ],
    tasks: [{ id: 'squanch', name: 'Survive Birdperson’s wedding', hint: 'Dial Planet Squanch on the portal gun, raise a glass at the wedding, and get back through the portal when the Federation arrives.' }],
    say: {
      squanchy: { who: 'Squanchy', text: 'You squanch what you squanch, Morty. Birdperson’s getting squanched today. Married. Same thing.' },
      sbirdperson: { who: 'Birdperson', text: 'Morty. I am glad you came. Tammy and I are to be joined. It will be a day to remember.' },
      stammy: { who: 'Tammy', text: 'Birdperson and I are getting married! Isn’t that squanchy?' },
      toast: { who: null, text: 'You raise a glass. The band stops. Tammy smiles: she’s been Federation all along. Portals open round the arch. Run.' },
      suckulents: { who: null, text: 'Suckulents. They suck the blood out of you in seconds. Don’t sit on one.' },
      cattree: { who: null, text: 'Squanchy’s house: a cat tree three storeys tall, with a toy on a string on every floor.' },
    },
    acts: { toast: 'raid' },
    escape: { spot: 'toast', s: 60, task: 'squanch' },
    kinds: ['squanchy', 'birdperson', 'tammy', 'gromflomite', 'squanchy-house', 'magdalian-a', 'magdalian-b', 'magdalian-c'],
  }),
  place(2, {
    id: 'gazorpazorp',
    name: 'Gazorpazorp',
    note: 'A red desert where the men fight rocks and the women live in a city of their own.',
    kind: 'outdoor',
    deep: 50,
    wide: 70,
    sky: { top: 0x3a1a3a, mid: 0xc85a3a, low: 0xf2b070, sun: 0xffd8a0, clouds: 0, moons: 0 },
    people: [
      { id: 'marsha', dx: 0, dz: -14.6, face: S },
      { id: 'mortyjr', dx: -9, dz: 9, face: E },
      { id: 'gazorpian-a', who: 'gazorpian', dx: 13, dz: -1, face: E },
      { id: 'gazorpian-b', who: 'gazorpian', dx: 17, dz: -1, face: W },
    ],
    spots: [
      { id: 'marsha', dx: 0, dz: -13, label: 'Mar-Sha', verb: 'Talk' },
      { id: 'gate', dx: 4.5, dz: -16, label: 'The gate of the women’s city', verb: 'Knock' },
      { id: 'mortyjr', dx: -9, dz: 9, label: 'Morty Jr.', verb: 'Talk' },
      { id: 'gazorpian-a', dx: 15, dz: 1.4, label: 'Two Gazorpians', verb: 'Look', r: 2 },
    ],
    solids: [
      { id: 'wall-west', dx: -19, dz: -21, w: 30, d: 6 },
      { id: 'wall-east', dx: 19, dz: -21, w: 30, d: 6 },
      { id: 'gate-doors', dx: 0, dz: -21, w: 8, d: 5 },
      { id: 'dais', dx: 0, dz: -16.6, w: 4, d: 2.4 },
      { id: 'rock-a', dx: 15, dz: -12, r: 2.4 },
      { id: 'rock-b', dx: -18, dz: 2, r: 3 },
      { id: 'rock-c', dx: 24, dz: 10, r: 2.2 },
    ],
    tasks: [{ id: 'gazorp', name: 'Visit the women of Gazorpazorp', hint: 'Dial Gazorpazorp on the portal gun, and knock at the gate of the women’s city.' }],
    say: {
      marsha: { who: 'Mar-Sha', text: 'Welcome, Morty. The men stay outside. You may come in. You seem harmless.' },
      gate: { who: null, text: 'Men are not allowed in. Mar-Sha makes an exception for a Morty.' },
      mortyjr: { who: 'Morty Jr.', text: 'Dad. I wrote a book. It’s called My Horrible Father. It’s doing very well.' },
      'gazorpian-a': { who: null, text: 'Two Gazorpians, fighting over a rock. The rock is winning.' },
    },
    done: { gate: 'gazorp' },
    unlock: { gate: 'gazorp' },
    kinds: ['marsha', 'mortyjr', 'gazorpian'],
  }),
  place(3, {
    id: 'birdworld',
    name: 'Bird World',
    note: 'Birdperson’s home planet: clay towers under umbrella trees, and crystals in the grass.',
    kind: 'outdoor',
    deep: 50,
    wide: 70,
    sky: { top: 0x8ac8a8, mid: 0xd2ecc8, low: 0xf6f2d0, sun: 0xfff8d8, clouds: 1, moons: 2 },
    people: [
      { id: 'bbirdperson', who: 'birdperson', dx: -2.6, dz: -9.6, face: S, until: 'squanch' },
      { id: 'phoenixperson', dx: -2.6, dz: -9.6, face: S, after: 'squanch' },
      { id: 'unity', dx: 10, dz: -3, face: W },
    ],
    spots: [
      { id: 'bbirdperson', dx: -2.6, dz: -9.6, label: 'Birdperson', verb: 'Talk', until: 'squanch' },
      { id: 'phoenixperson', dx: -2.6, dz: -9.6, label: 'Phoenixperson', verb: 'Talk', after: 'squanch' },
      { id: 'unity', dx: 10, dz: -3, label: 'Unity', verb: 'Talk' },
      { id: 'door', dx: 1.4, dz: -11.4, label: 'Birdperson’s door', verb: 'Knock' },
      { id: 'crystals', dx: -12, dz: 4, label: 'The crystals', verb: 'Look', r: 2 },
    ],
    solids: [
      { id: 'house', dx: 0, dz: -16, r: 4 },
      { id: 'tower-a', dx: -22, dz: -15, r: 4 },
      { id: 'tower-b', dx: 20, dz: -17, r: 4.5 },
      { id: 'tree-a', dx: -16, dz: 10, r: 1.2 },
      { id: 'tree-b', dx: 18, dz: 6, r: 1.2 },
      { id: 'crystals', dx: -12, dz: 6, r: 1.2 },
    ],
    tasks: [{ id: 'birdworld', name: 'Visit Birdperson at home', hint: 'Dial Bird World on the portal gun, and knock at Birdperson’s door.' }],
    say: {
      bbirdperson: { who: 'Birdperson', text: 'Morty. In my culture, this is the time of greeting. Welcome to my home.' },
      phoenixperson: { who: 'Phoenixperson', text: 'Birdperson is gone. There is only Phoenixperson now.' },
      unity: { who: 'Unity', text: 'Rick isn’t here? Good. I came to see Birdperson. We all get a little lonely, Morty.' },
      door: { who: null, text: 'Birdperson’s house. He doesn’t lock it. Nobody on Bird World does.' },
      crystals: { who: null, text: 'The crystals hum when you walk past them. It’s nice.' },
    },
    done: { door: 'birdworld' },
    unlock: { door: 'birdworld' },
    kinds: ['birdperson', 'phoenixperson', 'unity', 'birdperson-house'],
  }),
  place(4, {
    id: 'fantasy',
    name: 'Fantasy World',
    note: 'A village of stairs that bite, a tavern and a beanstalk. The giants are up the beanstalk.',
    kind: 'outdoor',
    deep: 50,
    wide: 70,
    sky: { top: 0x3f8fe0, mid: 0x9ad2f5, low: 0xf6efd2, sun: 0xfff2c8, clouds: 1, moons: 0 },
    people: [
      { id: 'fmeeseeks', who: 'meeseeks', dx: 5, dz: 1, face: S },
      { id: 'kingjellybean', dx: -13, dz: -6, face: E, until: 'fantasy' },
    ],
    spots: [
      { id: 'fmeeseeks', dx: 5, dz: 1, label: 'The Meeseeks at the well', verb: 'Talk' },
      { id: 'kingjellybean', dx: -13, dz: -6, label: 'King Jellybean', verb: 'Talk', until: 'fantasy' },
      { id: 'tavern', dx: -6, dz: -13, label: 'The Thirsty Step', verb: 'Look' },
      { id: 'giant', dx: 14, dz: -14, label: 'A giant', verb: 'Look' },
      { id: 'goblins', dx: 9, dz: 8, label: 'Stair Goblins', verb: 'Look' },
    ],
    solids: [
      { id: 'tavern', dx: -6, dz: -19, w: 11, d: 9 },
      { id: 'well', dx: 5, dz: -1.4, r: 1.1 },
      { id: 'privy', dx: -15.6, dz: -6, w: 1.7, d: 1.7 },
      { id: 'beanstalk', dx: -22, dz: -19, r: 1.6 },
      { id: 'giant', dx: 16, dz: -20, r: 2.6 },
      { id: 'cottage-a', dx: -25, dz: -6, w: 7, d: 6 },
      { id: 'cottage-b', dx: -25, dz: 8, w: 7, d: 6 },
      { id: 'cottage-c', dx: 24, dz: 4, w: 7, d: 6 },
    ],
    tasks: [{ id: 'fantasy', name: 'Get the village’s help', hint: 'Dial Fantasy World on the portal gun in Rick’s garage, and ask the Meeseeks at the well.' }],
    say: {
      fmeeseeks: { who: 'A Meeseeks', text: 'I’m Mr. Meeseeks! Look at me! The village needs a hand, and I’m the hand. Ooh, there. Done!' },
      kingjellybean: { who: 'King Jellybean', text: 'A visitor. Welcome to my kingdom, boy. Mind the stairs. Some of them bite.' },
      tavern: { who: null, text: 'The Thirsty Step. A note on the door: no stairs inside, by order of the stairs.' },
      giant: { who: null, text: 'Dale. He fell on his sword. It’s complicated.' },
      goblins: { who: null, text: 'Stair Goblins. They want you to go up them. Don’t go up them.' },
    },
    done: { fmeeseeks: 'fantasy' },
    unlock: { fmeeseeks: 'fantasy' },
    kinds: ['meeseeks', 'kingjellybean', 'thirstystep', 'giant', 'stairgoblin'],
  }),
  place(5, {
    id: 'microverse',
    name: 'The Microverse',
    note: 'Inside the car’s battery: Zeep’s lab, and a world stomping on gooble boxes.',
    kind: 'room',
    deep: 16,
    wide: 22,
    ceiling: 5,
    people: [
      { id: 'zeep', dx: -1.5, dz: -5.2, face: S },
      { id: 'kyle', dx: 6, dz: -1, face: W, until: 'microverse' },
    ],
    spots: [
      { id: 'zeep', dx: -1.5, dz: -5.2, label: 'Zeep Xanflorp', verb: 'Talk' },
      { id: 'kyle', dx: 6, dz: -1, label: 'Kyle', verb: 'Talk', until: 'microverse' },
      { id: 'gooble', dx: -7, dz: 1, label: 'The gooble boxes', verb: 'Look' },
      { id: 'battery', dx: 2, dz: -1, label: 'The Miniverse battery', verb: 'Look' },
    ],
    solids: [
      { id: 'battery', dx: 2, dz: -2.7, r: 1.2 },
      { id: 'console', dx: -1.5, dz: -6.6, w: 3.4, d: 0.9 },
      { id: 'gooble', dx: -8.8, dz: 1, w: 1.4, d: 4.4 },
    ],
    tasks: [{ id: 'microverse', name: 'Meet the man inside the battery', hint: 'Dial the Microverse on the portal gun in Rick’s garage, and talk to Zeep at his console.' }],
    say: {
      zeep: { who: 'Zeep Xanflorp', text: 'You’re in the battery of your grandfather’s car, Morty. His car runs on my world, and my world runs on Kyle’s. It’s batteries all the way down.' },
      kyle: { who: 'Kyle', text: 'I made a universe to power ours. Now I find out ours is somebody’s power too. I’m going to go and live in a hut.' },
      gooble: { who: null, text: 'They stomp on them. The stomping makes the power. Slavery with extra steps.' },
      battery: { who: null, text: 'The Miniverse battery, glowing green. There’s a whole world in there making the power for this one.' },
    },
    done: { zeep: 'microverse' },
    unlock: { zeep: 'microverse' },
    kinds: ['zeep', 'kyle'],
  }),
  place(6, {
    id: 'anatomy',
    name: 'Anatomy Park',
    note: 'A theme park inside a man called Ruben. The diseases have got out.',
    kind: 'room',
    deep: 26,
    wide: 38,
    ceiling: 9,
    people: [
      { id: 'xenonbloom', dx: 2, dz: 7, face: N },
      { id: 'poncho', dx: -9, dz: 1, face: E },
      { id: 'annie', dx: 7, dz: 2, face: W },
    ],
    spots: [
      { id: 'xenonbloom', dx: 2, dz: 7, label: 'Dr. Xenon Bloom', verb: 'Talk' },
      { id: 'poncho', dx: -9, dz: 1, label: 'Poncho', verb: 'Talk' },
      { id: 'annie', dx: 7, dz: 2, label: 'Annie', verb: 'Talk' },
      { id: 'hepatitis', dx: -14, dz: -6.6, label: 'Hepatitis A', verb: 'Look', r: 2.2 },
      { id: 'gonorrhoea', dx: -7, dz: -6.6, label: 'Gonorrhoea', verb: 'Look', r: 2.2 },
      { id: 'tuberculosis', dx: 0, dz: -6.6, label: 'Tuberculosis', verb: 'Look', r: 2.2 },
      { id: 'plague', dx: 7, dz: -6.6, label: 'The bubonic plague', verb: 'Look', r: 2.2 },
      { id: 'ecoli', dx: 14, dz: -6.6, label: 'E. coli', verb: 'Look', r: 2.2 },
      { id: 'pancreas', dx: 16, dz: 3, label: 'Pirates of the Pancreas', verb: 'Ride' },
    ],
    solids: [
      ...[-14, -7, 0, 7, 14].map((dx, n) => ({ id: `pen-${n}`, dx, dz: -10, w: 5.6, d: 3.6 })),
      { id: 'kiosk', dx: -14, dz: 6, w: 2.2, d: 2.2 },
      { id: 'gate-west', dx: 16, dz: 0.6, r: 0.35 },
      { id: 'gate-east', dx: 16, dz: 5.4, r: 0.35 },
    ],
    tasks: [{ id: 'anatomy', name: 'Ride Anatomy Park', hint: 'Dial Anatomy Park on the portal gun, and get round the park to Pirates of the Pancreas.' }],
    say: {
      xenonbloom: { who: 'Dr. Xenon Bloom', text: 'Welcome to Anatomy Park! The only theme park inside a human body. Keep your helmet on and your arms inside the bloodstream.' },
      poncho: { who: 'Poncho', text: 'Stay close, kid. The diseases are out, and I’ve seen this before. Different body, same mess.' },
      annie: { who: 'Annie', text: 'Hi! Welcome to Anatomy Park! Spleen Mountain’s closed. Everything’s closed. We might all die.' },
      hepatitis: { who: null, text: 'Hepatitis A. Out of its pen, and hungry.' },
      gonorrhoea: { who: null, text: 'Gonorrhoea. The glass was meant to hold it. The glass was wrong.' },
      tuberculosis: { who: null, text: 'Tuberculosis. It coughs when it sees you. That’s not a good sign.' },
      plague: { who: null, text: 'The bubonic plague, the park’s oldest attraction. It doesn’t like the new ones.' },
      ecoli: { who: null, text: 'E. coli. It came in with lunch.' },
      pancreas: { who: null, text: 'Pirates of the Pancreas, the last ride. You sit in a little boat and float down the pancreatic duct. Everyone else ran.' },
    },
    done: { pancreas: 'anatomy' },
    unlock: { pancreas: 'anatomy' },
    kinds: ['xenonbloom', 'poncho', 'annie', 'hepatitis', 'gonorrhoea', 'tuberculosis', 'plague', 'ecoli'],
  }),
  place(7, {
    id: 'needful',
    name: 'Needful Things',
    note: 'A curiosity shop where everything’s free. Its owner has very red hair.',
    kind: 'room',
    deep: 11,
    wide: 13,
    ceiling: 3.4,
    people: [{ id: 'needful', dx: 0, dz: -3.6, face: S }],
    spots: [
      { id: 'needful', dx: 0, dz: -1.9, label: 'Mr. Needful', verb: 'Talk' },
      { id: 'typewriter', dx: -4.6, dz: -2, label: 'A typewriter', verb: 'Look' },
      { id: 'aftershave', dx: 4.6, dz: -2, label: 'Aftershave', verb: 'Look' },
      { id: 'cream', dx: 4.6, dz: 1.5, label: 'Beauty cream', verb: 'Look' },
    ],
    solids: [
      { id: 'counter', dx: 0, dz: -2.8, w: 4, d: 0.7 },
      { id: 'shelf-west', dx: -5.9, dz: -0.5, w: 0.7, d: 7 },
      { id: 'shelf-east', dx: 5.9, dz: -0.5, w: 0.7, d: 7 },
    ],
    tasks: [{ id: 'needful', name: 'Take something free from Mr. Needful', hint: 'Dial Needful Things on the portal gun, and ask Mr. Needful at the counter what anything costs.' }],
    say: {
      needful: { who: 'Mr. Needful', text: 'Free. Everything here is free. Take the typewriter. It only costs you something you weren’t using.' },
      typewriter: { who: null, text: 'A typewriter that writes the truth about whoever owns it. Nobody keeps it long.' },
      aftershave: { who: null, text: 'Aftershave. Smells of success, and a little of everyone you let down to get it.' },
      cream: { who: null, text: 'Beauty cream. Works overnight. Only for the one night.' },
    },
    done: { needful: 'needful' },
    unlock: { needful: 'needful' },
    kinds: ['needful'],
  }),
  place(8, {
    id: 'jerryboree',
    name: 'The Jerryboree',
    note: 'A daycare for Jerrys, so the Ricks can go on adventures without them.',
    kind: 'room',
    deep: 16,
    wide: 22,
    ceiling: 4,
    people: [
      { id: 'jerryreal', who: 'jerry', dx: -6.5, dz: 4.5, face: N },
      { id: 'receptionist', who: 'rick', dx: 6.5, dz: 2.2, face: S },
      { id: 'jerrytv', who: 'jerry-cardigan', dx: -2, dz: -5, face: N },
    ],
    extras: [
      { kind: 'jerry-robe', dx: -8.5, dz: -3.5, face: 0 },
      { kind: 'jerry-golf', dx: 2, dz: -1.6, face: W },
      { kind: 'jerry-tux', dx: -5, dz: 1.5, face: 0.6 },
      { kind: 'jerry-track', dx: 8.5, dz: -1.5, face: W },
      { kind: 'jerry-gown', dx: -8.4, dz: -0.6, face: -0.4 },
      { kind: 'jerry-golf', dx: 0.5, dz: 2.5, face: -2.2 },
      { kind: 'jerry-robe', dx: 8.6, dz: -6.4, face: 2.6 },
      { kind: 'jerry-tux', dx: -4.4, dz: -6.2, face: -1.2 },
      { kind: 'jerry-track', dx: 1.6, dz: -6.4, face: 1.2 },
    ],
    spots: [
      { id: 'jerryreal', dx: -6.5, dz: 4.5, label: 'A Jerry by the door', verb: 'Talk' },
      { id: 'receptionist', dx: 6.5, dz: 4.1, label: 'The Rick on the desk', verb: 'Talk' },
      { id: 'ticket', dx: 3.5, dz: 4.8, label: 'The ticket machine', verb: 'Look' },
      { id: 'jerrytv', dx: -2, dz: -5, label: 'A Jerry at the TV', verb: 'Talk' },
      { id: 'ballpit', dx: 5, dz: -1.2, label: 'The ball pit', verb: 'Look', r: 2 },
    ],
    solids: [
      { id: 'desk', dx: 6.5, dz: 3.1, w: 3.2, d: 0.8 },
      { id: 'ticket', dx: 3.5, dz: 5.9, w: 0.6, d: 0.6 },
      { id: 'ballpit', dx: 5, dz: -4, w: 4.4, d: 4.4 },
      { id: 'tv', dx: -2, dz: -7.4, w: 2.4, d: 0.6 },
      { id: 'cot-a', dx: -8.5, dz: -5, w: 2, d: 1.1 },
      { id: 'cot-b', dx: -8.5, dz: -2, w: 2, d: 1.1 },
    ],
    tasks: [{ id: 'jerryboree', name: 'Pick up the right Jerry', hint: 'Dial the Jerryboree on the portal gun, and find our Jerry: he’ll ask about Beth.' }],
    say: {
      jerryreal: { who: 'Jerry', text: 'Morty! Is Beth here? Tell her I’ve been good. I made a friend. He’s also me.' },
      receptionist: { who: 'The Jerryboree’s Rick', text: 'Drop-off or pick-up? Ticket, please. No ticket, no Jerry. Rules are rules.' },
      ticket: { who: null, text: 'Take a ticket. Rick forgot his.' },
      jerrytv: { who: 'A Jerry', text: 'Shh. It’s the one where the guy fixes the house. I’ve seen it four hundred times. It’s really good.' },
      ballpit: { who: null, text: 'The ball pit. A Jerry went in an hour ago. He’s fine. He says he’s fine.' },
    },
    done: { jerryreal: 'jerryboree' },
    unlock: { jerryreal: 'jerryboree' },
    kinds: ['jerry', 'rick', 'jerry-robe', 'jerry-golf', 'jerry-tux', 'jerry-track', 'jerry-gown', 'jerry-cardigan'],
  }),
  place(9, {
    id: 'purge',
    name: 'The Purge Planet',
    note: 'A quiet farming village of cat people, one night a year.',
    kind: 'outdoor',
    deep: 50,
    wide: 70,
    sky: { top: 0x1c2350, mid: 0x7a4a7a, low: 0xf2a070, sun: 0xffd2a0, clouds: 1, moons: 1 },
    people: [{ id: 'arthricia', dx: 3, dz: -1, face: S }],
    extras: [
      { kind: 'magdalian-a', dx: -6, dz: 2, face: 0.4 },
      { kind: 'magdalian-b', dx: 9, dz: -5, face: 2.6 },
      { kind: 'magdalian-c', dx: -14, dz: -2, face: -0.3 },
      { kind: 'magdalian-a', dx: 13, dz: 3, face: 3.4 },
      { kind: 'magdalian-b', dx: -3, dz: -9, face: -1.6 },
      { kind: 'magdalian-c', dx: 7, dz: 7, face: 1.9 },
    ],
    spots: [
      { id: 'arthricia', dx: 3, dz: -1, label: 'Arthricia', verb: 'Talk' },
      { id: 'siren', dx: -11, dz: -12, label: 'The purge siren', verb: 'Pull' },
    ],
    solids: [
      { id: 'well', dx: 3, dz: -3.4, r: 1.1 },
      { id: 'siren', dx: -11, dz: -13.4, r: 0.4 },
      { id: 'cottage-a', dx: -22, dz: -10, w: 7, d: 6 },
      { id: 'cottage-b', dx: -22, dz: 6, w: 7, d: 6 },
      { id: 'cottage-c', dx: 18, dz: -13, w: 7, d: 6 },
      { id: 'cottage-d', dx: 22, dz: 6, w: 7, d: 6 },
      { id: 'barn', dx: 0, dz: -19, w: 10, d: 7 },
    ],
    tasks: [{ id: 'purge', name: 'Get out before the purge', hint: 'Dial the Purge Planet on the portal gun, pull the siren, and get back through the portal within a minute.' }],
    say: {
      arthricia: { who: 'Arthricia', text: 'You’re not from here. Tonight’s the purge, and anything goes. If the siren goes off, run for your portal.' },
      siren: { who: null, text: 'The siren howls over the village. The purge has begun. Run for the portal.' },
    },
    acts: { siren: 'siren' },
    escape: { spot: 'siren', s: 60, task: 'purge' },
    kinds: ['arthricia', 'magdalian-a', 'magdalian-b', 'magdalian-c'],
  }),
  place(10, {
    id: 'pluto',
    name: 'Pluto',
    note: 'A planet. Say it. The king insists.',
    kind: 'outdoor',
    deep: 50,
    wide: 70,
    sky: { top: 0x070b1e, mid: 0x1d2a55, low: 0x4f6fa8, sun: 0xe8eeff, clouds: 0, moons: 2 },
    people: [
      { id: 'flippynips', dx: 0, dz: -12, face: S },
      { id: 'scroopy', dx: 11, dz: -2, face: W },
    ],
    extras: [
      { kind: 'plutonian-a', dx: -4, dz: -5, face: N },
      { kind: 'plutonian-b', dx: 3.5, dz: -4.5, face: N },
      { kind: 'plutonian-a', dx: 1, dz: -3.2, face: N },
      { kind: 'plutonian-b', dx: -7.5, dz: -3, face: 1.2 },
      { kind: 'plutonian-a', dx: 7, dz: -6, face: 2.2 },
    ],
    spots: [
      { id: 'flippynips', dx: 0, dz: -12, label: 'King Flippy Nips', verb: 'Talk' },
      { id: 'podium', dx: 0, dz: -7.6, label: 'The podium', verb: 'Speak' },
      { id: 'scroopy', dx: 11, dz: -2, label: 'Scroopy Noopers', verb: 'Talk' },
    ],
    solids: [
      { id: 'palace', dx: 0, dz: -19, w: 14, d: 8 },
      { id: 'podium', dx: 0, dz: -9.2, w: 1.2, d: 0.8 },
      { id: 'sign', dx: 12.6, dz: -2, w: 0.3, d: 1.6 },
      { id: 'house-a', dx: -20, dz: -8, r: 3 },
      { id: 'house-b', dx: -22, dz: 7, r: 3 },
      { id: 'house-c', dx: 21, dz: 8, r: 3 },
    ],
    tasks: [{ id: 'pluto', name: 'Tell Pluto it’s a planet', hint: 'Dial Pluto on the portal gun, and step up to the king’s podium.' }],
    say: {
      flippynips: { who: 'King Flippy Nips', text: 'Pluto is a planet! The scientists say so. The scientists who work for me say so.' },
      podium: { who: null, text: 'You step up to the podium. “Pluto is a planet.” They cheer for a long, long time.' },
      scroopy: { who: 'Scroopy Noopers', text: 'Pluto’s shrinking, kid. They’re mining the core. Nobody wants to hear it.' },
    },
    done: { podium: 'pluto' },
    unlock: { podium: 'pluto' },
    kinds: ['flippynips', 'scroopy', 'plutonian-a', 'plutonian-b'],
  }),
  place(11, {
    id: 'gearworld',
    name: 'Gear World',
    note: 'A city of brass gears, and Rick’s oldest friend.',
    kind: 'outdoor',
    deep: 50,
    wide: 70,
    sky: { top: 0x6a4a2a, mid: 0xc98a4a, low: 0xf2d39a, sun: 0xfff0c8, clouds: 1, moons: 0 },
    people: [{ id: 'gearhead', dx: -7, dz: -7.2, face: S }],
    extras: [
      { kind: 'gearperson-a', dx: 3, dz: -2, face: 2.4 },
      { kind: 'gearperson-b', dx: 12, dz: 2, face: W },
      { kind: 'gearperson-a', dx: -14, dz: 2, face: 0.3 },
      { kind: 'gearperson-b', dx: 5, dz: 6, face: -2 },
    ],
    spots: [
      { id: 'gearhead', dx: -7, dz: -7.2, label: 'Gearhead', verb: 'Talk' },
      { id: 'cogs', dx: 9, dz: -8, label: 'The city’s gears', verb: 'Look', r: 2.5 },
    ],
    solids: [
      { id: 'shop', dx: -7, dz: -11.5, w: 8, d: 5 },
      { id: 'cog', dx: 9, dz: -12, r: 3.2 },
      { id: 'tower-a', dx: -22, dz: -12, r: 5 },
      { id: 'tower-b', dx: 22, dz: -14, r: 6 },
      { id: 'tower-c', dx: 23, dz: 7, r: 4 },
      { id: 'tower-d', dx: -23, dz: 8, r: 4 },
    ],
    tasks: [{ id: 'gearworld', name: 'Visit Gearhead', hint: 'Dial Gear World on the portal gun, and say hello to Gearhead at his shop.' }],
    say: {
      gearhead: { who: 'Gearhead', text: 'Morty! Rick’s my best friend. Rick’s everyone’s best friend. That’s the problem with Rick.' },
      cogs: { who: null, text: 'The whole city turns. If one gear stops, everyone hears about it.' },
    },
    done: { gearhead: 'gearworld' },
    unlock: { gearhead: 'gearworld' },
    kinds: ['gearhead', 'gearperson-a', 'gearperson-b'],
  }),
  place(12, {
    id: 'vindicators',
    name: 'The Vindicators’ ship',
    note: 'The morning after Rick got drunk on the Vindicators’ ship. He left them a gauntlet of rooms.',
    kind: 'room',
    deep: 20,
    wide: 24,
    ceiling: 6,
    people: [
      { id: 'vance', dx: -2.6, dz: -5.4, face: S },
      { id: 'supernova', dx: 2.8, dz: -5.6, face: S },
      { id: 'alanrails', dx: -7.8, dz: 0.6, face: E },
      { id: 'millionants', dx: 7.8, dz: -0.6, face: W },
      { id: 'crocubot', dx: 6.6, dz: -6.8, face: S + 0.4 },
      { id: 'noobnoob', dx: -5.8, dz: 4.2, face: E },
    ],
    spots: [
      { id: 'vance', dx: -2.6, dz: -4.2, label: 'Vance Maximus', verb: 'Talk' },
      { id: 'supernova', dx: 2.8, dz: -4.4, label: 'Supernova', verb: 'Talk' },
      { id: 'alanrails', dx: -7.8, dz: 0.6, label: 'Alan Rails', verb: 'Talk' },
      { id: 'millionants', dx: 7.8, dz: -0.6, label: 'Million Ants', verb: 'Talk' },
      { id: 'crocubot', dx: 6.6, dz: -6.8, label: 'Crocubot', verb: 'Talk' },
      { id: 'noobnoob', dx: -5.8, dz: 4.2, label: 'Noob-Noob', verb: 'Talk' },
      { id: 'saw', dx: -10.6, dz: -6, label: 'Rick’s rooms', verb: 'Go in', kind: 'trial' },
      { id: 'holotable', dx: 0, dz: 0.6, label: 'The holo-table', verb: 'Look', r: 1.6 },
      { id: 'beacon', dx: 9, dz: -8, label: 'The beacon', verb: 'Look' },
    ],
    solids: [
      { id: 'holotable', dx: 0, dz: -1.4, r: 1.9 },
      { id: 'beacon', dx: 9.6, dz: -9, r: 0.6 },
    ],
    tasks: [{ id: 'vindicators', name: 'Get through Rick’s rooms', hint: 'Dial the Vindicators’ ship on the portal gun, and go through the door to the rooms Rick left them.' }],
    say: {
      vance: { who: 'Vance Maximus', text: 'Rick’s passed out and he’s rigged the ship with traps. Typical. We’re the Vindicators, kid. We’ll handle this.' },
      supernova: { who: 'Supernova', text: 'Your grandfather is a disgusting drunk. He was right about Vance, though.' },
      alanrails: { who: 'Alan Rails', text: 'My ghost trains can tunnel through solid rock. They can’t tunnel through whatever Rick did to those doors.' },
      millionants: { who: 'Million Ants', text: 'We are Million Ants. All million of us are very tired of Rick.' },
      crocubot: { who: 'Crocubot', text: 'Half crocodile, half robot. All of me is done with this.' },
      noobnoob: { who: 'Noob-Noob', text: 'Ha! Rick’s the best. Did you see what he did to the holo-table? Classic. I’ve been mopping it all morning.' },
      holotable: { who: null, text: 'The holo-table. Rick did something on it last night that nobody will describe. It smells of lemon now. Noob-Noob’s work.' },
      beacon: { who: null, text: 'The Vindicators’ beacon. When it lights, they assemble. It lit for this.' },
    },
    goal: 'saw',
    kinds: ['vance', 'supernova', 'alanrails', 'millionants', 'crocubot', 'noobnoob', 'vindicators-ship'],
  }),
  place(13, {
    id: 'simulation',
    name: 'The Zigerions’ simulation',
    note: 'A copy of the Smiths’ street, run by the Zigerions to get Rick’s recipe. They’ve cut corners.',
    kind: 'room',
    deep: 40,
    wide: 56,
    ceiling: 9,
    people: [
      { id: 'nebulon', dx: 0, dz: -17.4, y: 3.2, face: S },
      { id: 'zig-console-a', who: 'zigerion-b', dx: -7, dz: -17.6, y: 3.2, face: S },
      { id: 'zig-console-b', who: 'zigerion-c', dx: 7, dz: -17.6, y: 3.2, face: S },
    ],
    spots: [
      { id: 'twins', dx: 0, dz: 4, label: 'Two men, the same man', verb: 'Look', r: 1.8 },
      { id: 'poptart', dx: 17, dz: 7, label: 'A pop-tart in a toaster', verb: 'Look', r: 1.8 },
      { id: 'sun', dx: 24.6, dz: -4, label: 'The sun', verb: 'Look', r: 2 },
      { id: 'simhouse', dx: -12, dz: -3.4, label: 'The Smiths’ house', verb: 'Look', r: 1.8 },
      { id: 'nebulon', dx: 0, dz: -13.6, label: 'Prince Nebulon', verb: 'Call up', r: 1.8 },
      { id: 'consoles', dx: 7, dz: -13.6, label: 'The consoles', verb: 'Look', r: 1.8 },
    ],
    solids: [
      { id: 'walkway', dx: 0, dz: -17.6, w: 56, d: 4.8 },
      { id: 'simhouse', dx: -12, dz: -8.6, w: 10, d: 8 },
      { id: 'simhouse-b', dx: 12, dz: -8.6, w: 9, d: 7 },
      { id: 'toaster', dx: 17, dz: 10.4, w: 5, d: 3.6 },
      { id: 'twin-a', dx: -0.8, dz: 5.6, r: 0.4 },
      { id: 'twin-b', dx: 0.8, dz: 5.6, r: 0.4 },
    ],
    tasks: [{ id: 'simulation', name: 'Spot the simulation', hint: 'Dial the Zigerions’ simulation on the portal gun, and find three things they got wrong.' }],
    say: {
      twins: { who: null, text: 'Two men walking the same way, the same face, the same step. One of them says “Hello” and the other one says it too. Slip one.' },
      poptart: { who: null, text: 'A pop-tart, living in a toaster. He waves. Nobody in the real street does that. Slip two.' },
      sun: { who: null, text: 'The sun is a yellow disc painted on the wall. It hasn’t moved all day. Slip three.' },
      simhouse: { who: null, text: 'The Smiths’ house, in two colours, with the windows painted on. The door doesn’t open.' },
      nebulon: { who: 'Prince Nebulon', text: 'Is it the kid? Of course it’s the kid. We don’t have the processing power for a Rick. Just act natural down there and tell us the recipe for concentrated dark matter.' },
      consoles: { who: null, text: 'Two Zigerions at the consoles, running the street. One of them is scrolling. The other is asleep.' },
    },
    collect: { task: 'simulation', spots: ['twins', 'poptart', 'sun'] },
    goal: 'twins',
    kinds: ['nebulon', 'zigerion-b', 'zigerion-c'],
  }),
  place(14, {
    id: 'storytrain',
    name: 'The Story Train',
    note: 'A carriage on the Story Train, the anthology going past the windows. Someone wants to see your ticket.',
    kind: 'room',
    deep: 30,
    wide: 10,
    ceiling: 3.4,
    people: [
      { id: 'storylord', dx: 0, dz: -13, face: S },
      { id: 'ticketsguy', dx: 0, dz: -3, face: S },
    ],
    spots: [
      { id: 'storylord', dx: 0, dz: -11.4, label: 'Story Lord', verb: 'Talk' },
      { id: 'ticketsguy', dx: 0, dz: -1.6, label: 'The conductor', verb: 'Talk' },
      { id: 'trainticket', dx: 2.2, dz: 6.6, label: 'Something under the seat', verb: 'Reach for', r: 1.2 },
      { id: 'trainwindow', dx: -3.4, dz: 1, label: 'The window', verb: 'Look', r: 1.4 },
      { id: 'routemap', dx: 1.6, dz: -7.5, label: 'The route map', verb: 'Look', r: 1.2 },
    ],
    solids: [
      ...[-10, -7.5, -5, -2.5, 0, 2.5, 5, 7.5, 10].flatMap((dz) => [
        { id: `seat-w${dz}`, dx: -3.1, dz, w: 2.9, d: 1.1 },
        { id: `seat-e${dz}`, dx: 3.1, dz, w: 2.9, d: 1.1 },
      ]),
    ],
    tasks: [{ id: 'storytrain', name: 'Find your ticket', hint: 'Dial the Story Train on the portal gun, and find a ticket before the conductor gets to you.' }],
    say: {
      storylord: { who: 'Story Lord', text: 'I am Story Lord. This train runs on stories, and yours has been meandering for a while, Morty. Give me a beat. Any beat.' },
      ticketsguy: { who: 'The conductor', text: 'Tickets, please. No ticket, no ride. Rules of the anthology.' },
      trainticket: { who: null, text: 'A ticket, folded under the seat. Someone got off in a hurry. It’s yours now. Tickets, please.' },
      trainwindow: { who: null, text: 'The windows show the stories as they pass: a wedding, a heist, a man who is also a train. None of them stop long enough to make sense.' },
      routemap: { who: null, text: 'The route: Cold Open, Act One, Act Two, Act Three, Tag. The train is running late past Act Two.' },
    },
    done: { trainticket: 'storytrain' },
    kinds: ['storylord', 'ticketsguy'],
  }),
  place(15, {
    id: 'fortress',
    name: 'Rick Prime’s fortress',
    note: 'A cold hangar of Rick Prime’s, somewhere out past the Central Finite Curve. The Omega Device is here.',
    kind: 'room',
    deep: 36,
    wide: 40,
    ceiling: 12,
    people: [{ id: 'rickprime', dx: 0, dz: -12.4, face: S, until: 'fortress' }],
    spots: [
      { id: 'omegadevice', dx: 5, dz: -1.8, label: 'The Omega Device', verb: 'Look', r: 1.9 },
      { id: 'primeconsole', dx: 0, dz: -10.6, label: 'Rick Prime’s console', verb: 'Reach', r: 1.6 },
      { id: 'primetanks', dx: -16, dz: 0, label: 'The tanks', verb: 'Look', r: 2.2 },
      { id: 'primepicture', dx: 17.6, dz: -8, label: 'A picture on the wall', verb: 'Look', r: 1.6 },
    ],
    solids: [
      { id: 'plinth', dx: 5, dz: -4, r: 1.5 },
      { id: 'primeconsole', dx: 0, dz: -14, w: 7, d: 1.6 },
      ...[-10, -6, -2, 2, 6, 10].map((dz) => ({ id: `tank${dz}`, dx: -18.2, dz, r: 1.1 })),
      { id: 'crate-a', dx: 14, dz: 10, w: 2.4, d: 2.4 },
      { id: 'crate-b', dx: 16.6, dz: 8, w: 1.8, d: 1.8 },
    ],
    tasks: [{ id: 'fortress', name: 'Reach Rick Prime', hint: 'Dial Rick Prime’s fortress on the portal gun, and get to his console before he’s gone.' }],
    say: {
      omegadevice: { who: null, text: 'The Omega Device. Rick built one to erase Diane from every dimension. Rick Prime built this one, and used it.' },
      primeconsole: { who: 'Rick Prime', text: '“Oh, it’s the backup. Tell him I said hi, kid. Tell him he’s still boring.” A portal opens behind him and he steps through it without looking back.' },
      primetanks: { who: null, text: 'Tanks along the wall, each with a Rick in it, half-made. He keeps spares.' },
      primepicture: { who: null, text: 'A framed picture of a garage. There’s a family in it. Somebody has drawn over two of their faces.' },
    },
    done: { primeconsole: 'fortress' },
    acts: { primeconsole: 'gone' },
    kinds: ['rickprime'],
  }),
];

export const destinationById = (id) => DESTINATIONS.find((d) => d.id === id) ?? null;

// ── the dial ──

export const DIAL = [{ id: 'annex', name: 'Blips and Chitz', note: 'An arcade on an alien street. Roy: A Life Well Lived is in the back.' }, ...DESTINATIONS.map(({ id, name, note }) => ({ id, name, note }))];
export const DIAL_KEY = 'tp-rm-dial';
export const portalTarget = (dial) => (DIAL.some((d) => d.id === dial) ? dial : 'annex');
export function readDial() {
  try {
    return portalTarget(localStorage.getItem(DIAL_KEY));
  } catch {
    return 'annex';
  }
}
export function writeDial(id) {
  try {
    localStorage.setItem(DIAL_KEY, portalTarget(id));
  } catch {
    /* (private mode: the dial lasts the visit) */
  }
}

// the garage portal, sent where the dial is set; any other link as it is
export function linkTarget(link, dial) {
  if (link.id !== 'garage-portal') return link;
  const d = destinationById(portalTarget(dial));
  return d ? { ...link, to: d.id, label: `Through the portal to ${d.name}`, arrive: d.arrive } : link;
}

// a saved spot, if it's still somewhere Morty can be: in a built-in area, or
// in a destination (whatever the dial says now: the way home's there), else
// the garage, where the portal is
export function validArrive(saved, areas) {
  const a = saved && areas[saved.area];
  if (a && saved.x >= a.x0 && saved.x <= a.x1 && saved.z >= a.z0 && saved.z <= a.z1) return { area: saved.area, x: saved.x, z: saved.z, face: saved.face ?? 0 };
  return { area: 'garage', ...GARAGE_BACK };
}
