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
function place(i, { id, name, note, kind, deep, wide, sky, ceiling, people = [], spots = [], solids = [], tasks = [], say = {}, done = {}, unlock = {}, kinds = [] }) {
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
    hotspots: spots.map((s) => ({ r: 1.4, ...w(s), area: id })),
    // what can't be walked through: { id, dx, dz, w, d } boxes and { id, dx, dz, r } posts
    solids: solids.map((s) => w(s)),
    tasks,
    say,
    done,
    unlock,
    kinds,
  };
}

export const DESTINATIONS = [
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
