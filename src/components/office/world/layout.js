// Dunder Mifflin Scranton, the world: the floor you walk about as Jim, laid
// out from the same plan as the 2D map and the 3D model on the page
// (../layout.js), with what a walk needs added to it: doorways into every
// room, the lobby and its lift, the stairwell, the supply room, and where
// each thing to do is. Pure data and a few helpers, no drawing.
//
// Metres, +x east, +z south, the floor at y 0. Plan units (3.2 cm) are
// turned into metres by `P`, as the 3D model on the page does.

import { CONFERENCE_TABLE, DESKS, GLASS, KITCHEN_COUNTER, KITCHEN_TABLE, BREAK_TABLES, RECEPTION_BOX, PLAN, WALLS_INNER, WALLS_INNER_2, WALLS_OUTER, segments, toWorld, wallRuns } from '../layout';

export const U = PLAN.metres;
export const P = (px, py) => toWorld(px, py);
export const CEILING = 2.75;

// Every doorway on the floor (plan units: a run along the wall it's cut
// from). The set's own: the suite's door off the lobby, the kitchen
// hallway's two ends. Added for walking: Michael's office and the
// conference room (in their glass fronts), Darryl's office, the break room,
// the supply room, both restrooms, Ryan's closet and the stairwell.
export const DOORWAYS = [
  'M142 40 V70', // the suite, from the lobby
  'M514 200 V228', // the bullpen to the kitchen hallway
  'M739 200 V228', // the hallway to the annex
  'M300 127 H322', // Michael's office
  'M328 127 H352', // the conference room
  'M480 288 H504', // Darryl's office
  'M870 141 H896', // the break room
  'M250 384 H276', // the supply room
  'M530 252 H554', // the men's room
  'M700 252 H724', // the women's room
  'M590 252 H612', // Ryan's closet
  'M690 175 H716', // the stairwell
].join(' ');

// the lobby round the lift, outside the suite's door
const LOBBY_WALLS = 'M142 12 H14 V89 H142';

const ALL_WALLS = `${WALLS_OUTER} ${WALLS_INNER} ${WALLS_INNER_2} ${LOBBY_WALLS}`;

// Wall runs as metres: [x0, z0, x1, z1].
const toRuns = (runs) =>
  runs.map(([x0, y0, x1, y1]) => {
    const a = P(x0, y0);
    const b = P(x1, y1);
    return [a.x, a.z, b.x, b.z];
  });

// What's drawn: solid walls (the glass fronts cut out of them), and the glass.
export const SOLID = toRuns(wallRuns(ALL_WALLS, `${DOORWAYS} ${GLASS}`));
export const PANES = toRuns(wallRuns(GLASS, DOORWAYS));
// What stops a walk: walls and glass alike, the doorways open.
export const WALLS = toRuns(wallRuns(`${ALL_WALLS} ${GLASS}`, DOORWAYS)).map((r) => [...r, 0.1]);
// the doorways themselves, for drawing their frames and doors
export const DOORS = segments(DOORWAYS).map(([x0, y0, x1, y1]) => {
  const a = P(x0, y0);
  const b = P(x1, y1);
  return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, w: Math.hypot(b.x - a.x, b.z - a.z), along: y0 === y1 ? 'x' : 'z' };
});

// ── the floor's rooms (plan rectangles), for floors, ceilings and the map ──
export const ROOMS = {
  bullpen: { x: 142, y: 12, w: 372, h: 364 }, // (the entry by reception too; the rooms off it are smaller, so they win)
  michael: { x: 206, y: 12, w: 118, h: 115 },
  conference: { x: 324, y: 12, w: 190, h: 115 },
  hallway: { x: 514, y: 175, w: 225, h: 77 },
  men: { x: 514, y: 252, w: 114, h: 124 },
  women: { x: 628, y: 252, w: 111, h: 124 },
  closet: { x: 566, y: 252, w: 62, h: 48 },
  stairs: { x: 552, y: 12, w: 187, h: 163 },
  annex: { x: 739, y: 12, w: 187, h: 364 },
  breakroom: { x: 806, y: 12, w: 120, h: 129 },
  darryl: { x: 406, y: 288, w: 108, h: 88 },
  supplies: { x: 161, y: 384, w: 137, h: 125 },
  lobby: { x: 14, y: 12, w: 128, h: 77 },
};
export const rect = (r) => {
  const a = P(r.x, r.y);
  return { x: a.x, z: a.z, w: r.w * U, d: r.h * U, cx: a.x + (r.w * U) / 2, cz: a.z + (r.h * U) / 2 };
};
// which room a point is in (the smallest that holds it)
export function roomAt(x, z) {
  let best = null;
  for (const [id, r] of Object.entries(ROOMS)) {
    const m = rect(r);
    if (x >= m.x && x <= m.x + m.w && z >= m.z && z <= m.z + m.d && (!best || m.w * m.d < best.a)) best = { id, a: m.w * m.d };
  }
  return best?.id ?? null;
}

// ── desks: where each is, its chair, and who sits in it ──
// (as the page's 3D model sets them: the desk turned to face its chair's
// side, the chair pulled up 0.34 m from the front edge)
const SEAT_TURN = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 };
export const SEATS = DESKS.map((d, i) => {
  const [x, y, dw, dh] = d.at;
  const c = P(x + dw / 2, y + dh / 2);
  const across = d.seat === 'n' || d.seat === 's';
  const width = (across ? dw : dh) * U;
  const depth = (across ? dh : dw) * U;
  const turn = SEAT_TURN[d.seat];
  // the chair, in the desk's frame (0.1, front + 0.34), turned with it
  const lx = 0.1;
  const lz = depth / 2 + 0.34;
  const chair = { x: c.x + lx * Math.cos(turn) + lz * Math.sin(turn), z: c.z - lx * Math.sin(turn) + lz * Math.cos(turn) };
  return { i, who: d.who, exec: !!d.exec, x: c.x, z: c.z, turn, width, depth, chair, box: { kind: 'box', x: c.x, z: c.z, w: dw * U, d: dh * U, turn: 0, low: true } };
});
export const seatOf = (who) => SEATS.find((s) => s.who === who) ?? null;

// reception: Erin's chair inside the counter's L
export const RECEPTION = (() => {
  const r = RECEPTION_BOX;
  const c = P(r.x + r.w * 0.55, r.y + r.h * 0.62);
  const chair = P(r.x + r.w * 0.36, r.y + r.h * 0.74);
  return { x: c.x, z: c.z, chair, face: Math.atan2(c.x - chair.x, c.z - chair.z) };
})();

// ── furniture that's in the way (metres) ──
const box = (px, py, pw, ph, extra = {}) => {
  const a = P(px, py);
  return { kind: 'box', x: a.x + (pw * U) / 2, z: a.z + (ph * U) / 2, w: pw * U, d: ph * U, turn: 0, ...extra };
};
const circle = (px, py, r, extra = {}) => {
  const a = P(px, py);
  return { kind: 'circle', x: a.x, z: a.z, r, ...extra };
};

export const FRIDGE = box(582, 177, 22, 17, { top: 1.8 });
export const COPIER = box(474, 132, 30, 18, { top: 1.2 });
export const COOLER = circle(152, 112, 0.2, { top: 1.3 });
export const VENDING = [box(809, 18, 20, 26, { top: 1.85 }), box(809, 48, 20, 26, { top: 1.85 })];
export const FILES = [box(505, 236, 9, 46, { top: 1.3 }), box(150, 245, 11, 32, { top: 1.3 }), box(906, 150, 20, 14, { top: 1.3 })];
export const SHELVES = [box(163, 488, 133, 18, { top: 2.1 }), box(163, 400, 14, 82, { top: 2.1 }), box(282, 400, 14, 82, { top: 2.1 })];
export const PLANTS = [circle(150, 22, 0.28), circle(212, 140, 0.28), circle(918, 368, 0.28), circle(744, 168, 0.28), circle(318, 20, 0.24)];
export const MICHAEL_CHAIRS = [circle(256, 92, 0.3), circle(290, 92, 0.3)];
export const CABINET = box(208, 64, 14, 44, { top: 1.1 }); // Michael's credenza, his Dundies on it
export const TABLE = (() => {
  const t = CONFERENCE_TABLE;
  return box(t.x, t.y, t.w, t.h, { low: true });
})();
export const COUNTER = box(KITCHEN_COUNTER.x, KITCHEN_COUNTER.y, KITCHEN_COUNTER.w, KITCHEN_COUNTER.h, { low: true });
export const KTABLE = circle(KITCHEN_TABLE.x, KITCHEN_TABLE.y, KITCHEN_TABLE.r * U + 0.05, { low: true });
export const BTABLES = BREAK_TABLES.map(([x, y]) => circle(x, y, 0.5, { low: true }));
// the reception counter: its L, as two boxes
export const RECEPTION_COUNTER = [box(162, 178, 52, 14, { low: true }), box(200, 178, 14, 42, { low: true })];
// the stairs going down in the stairwell, and its rail
export const STAIRWELL = { ...rect(ROOMS.stairs), flight: box(565, 24, 112, 60, { low: true }) };

export const COLLIDERS = [
  ...SEATS.map((s) => s.box),
  // the chairs, with whoever's in them (not Jim's: he's up)
  ...SEATS.filter((s) => s.who !== 'jim').map((s) => ({ kind: 'circle', x: s.chair.x, z: s.chair.z, r: 0.32, low: true })),
  { kind: 'circle', x: RECEPTION.chair.x, z: RECEPTION.chair.z, r: 0.3, low: true },
  ...RECEPTION_COUNTER,
  TABLE,
  COUNTER,
  KTABLE,
  ...BTABLES,
  FRIDGE,
  COPIER,
  COOLER,
  ...VENDING,
  ...FILES,
  ...SHELVES,
  ...PLANTS,
  ...MICHAEL_CHAIRS,
  CABINET,
  STAIRWELL.flight,
];

// Jim's body: an office's walk, not a hobbit's
export const JIM = { radius: 0.28, walk: 2.3, run: 4.4, accel: 14, turn: 10 };
// the whole floor sits inside this disc (walls do the real work)
export const WORLD = { radius: 30, centre: [0, 0] };

// where you start: off the lift, facing the suite's door
export const START = { ...P(96, 60), face: 0 };

// ── places to do things (E) ──
const spotAt = (id, px, py, r = 1.2) => ({ id, ...P(px, py), r });
export const SPOTS = [
  spotAt('phones', 186, 230, 1.15), // reception, when Erin's on her break
  spotAt('toss', 292, 168, 1.0), // Jim's desk
  spotAt('factcheck', 345, 232, 1.15), // Dwight's desk
  spotAt('fridge', 597, 206, 1.2), // the kitchen fridge (the Jell-O)
  spotAt('chili', 94, 76, 1.3), // the pot of chili, at the lift
  spotAt('kitchen', 549, 202, 1.3), // the kitchen counter (the chili's going here)
  spotAt('seminar', 340, 140, 1.2), // the conference room door: Dwight's fire safety seminar
  spotAt('exit', 703, 150, 1.4), // the stairwell, the way out in a fire
  spotAt('dundies', 270, 102, 1.3), // Michael's office
];
export const spot = (id) => SPOTS.find((s) => s.id === id);

// Things to look at (E): a line each.
export const THINGS = [
  { id: 'mug', ...P(258, 62), r: 1.4, name: 'Michael’s mug', line: 'WORLD’S BEST BOSS. He bought it himself, at Spencer Gifts. He’s very proud of it.' },
  { id: 'painting', ...P(146, 210), r: 1.2, name: 'Pam’s watercolour', line: 'Pam’s painting of the building. Michael bought it for the office, and hung it where the clients can see.' },
  { id: 'copier', ...P(489, 152), r: 1.1, name: 'The copier', line: 'Jammed. There’s a note on it in Dwight’s hand: “Do NOT touch. — Assistant Regional Manager.”' },
  { id: 'vending', ...P(838, 46), r: 1.2, name: 'The vending machine', line: 'You put a dollar in. The granola bar hangs on its coil, as it always does. Kevin has a technique for this.' },
  { id: 'cooler', ...P(160, 128), r: 1.1, name: 'The water cooler', line: 'Where the office talks about everyone who isn’t at the water cooler.' },
  { id: 'supplies', ...P(232, 450), r: 1.6, name: 'The supply room', line: 'Paper. A great deal of paper. It is, Michael would like you to know, a paper company.' },
  { id: 'whiteboard', ...P(334, 70), r: 1.3, name: 'The whiteboard', line: 'Today’s agenda, in Michael’s writing: 1. Morale. 2. Fun. 3. Morale (again). 4. Toby (no).' },
  { id: 'lift', ...P(94, 82), r: 1.2, name: 'The lift', line: 'It works. Mostly. The stairs are on the other side of the office, past the kitchen.' },
  { id: 'closet', ...P(600, 266), r: 1.0, name: 'Ryan’s closet', line: 'Ryan’s office, between the restrooms. He calls it his “workspace”. It has a door, which is more than the annex has.' },
];

// ── people: who's where, and what they say as you pass ──
// seated at their desks (SEATS), but for Erin at reception
export const LINES = {
  michael: ['Jim! My main man. Don’t tell Dwight I said that.', 'Would I rather be feared or loved? Easy. Both. I want people to be afraid of how much they love me.', 'I’m not superstitious. But I am a little stitious.'],
  dwight: ['Question. What are you doing at my desk?', 'I am faster than eighty percent of all snakes.', 'Whenever I’m about to do something, I think: would an idiot do that? And if they would, I do not do that thing.'],
  pam: ['Hey. Dwight’s been guarding his stapler all morning. Just so you know.', 'I painted the building again. It’s a good building.', 'Are you going to do something to Dwight? Can I watch?'],
  erin: ['Dunder Mifflin, this is Erin!', 'Could you cover the phones? Just for a minute? I really need a break.', 'Do you think the phones get lonely when I go on break?'],
  andy: ['Nard Dog, reporting for duty.', 'I went to Cornell. Ever heard of it?', 'Rit-dit-dit-di-doo! Rit-dit-dit-di-dee!'],
  phyllis: ['Bob Vance, Vance Refrigeration, says hi.', 'I knitted this. Don’t touch it.', 'Close your mouth, sweetie. You look like a trout.'],
  stanley: ['Did I stutter?', 'Is it Pretzel Day? No? Then I’m doing the crossword.', 'Boy, have you lost your mind? I’ll help you find it.'],
  angela: ['The party planning committee meets at four. You are not on it.', 'Sprinkles was my best friend. Don’t.', 'I don’t have a lot of time. I have cats.'],
  kevin: ['Why waste time say lot word when few word do trick?', 'My chili is the thing I do best. I’m not bragging. It’s just true.', 'Ah, I’m doing the numbers. The numbers are very hard today.'],
  oscar: ['Actually, it’s a little more complicated than that.', 'I’m the smartest person in this office. That’s not a brag. It’s a burden.'],
  creed: ['Nobody steals from Creed Bratton and gets away with it.', 'I’ve been involved in a number of cults, both as a leader and a follower.', 'I sprout mung beans on a damp paper towel in my desk drawer. Very nutritious.'],
  meredith: ['Is it Friday? It feels like a Friday.', 'If anyone needs me, I’ll be in the… actually, don’t need me.'],
  darryl: ['Office life. Glass walls. Very open. Very watched.', 'Mike’s been down to the warehouse twice today. Twice.'],
  ryan: ['I’m working on a website. It’s going to be huge.', 'This closet is temporary. Everything is temporary.'],
  toby: ['If anyone needs me, I’ll be over here. In the annex. As usual.', 'Michael said good morning to me today. Well. He said “morning”. At me.'],
  kelly: ['Oh my God, Jim. Did you hear about Ryan? Because I didn’t hear about Ryan.', 'I talk a lot, so I’ve learned to tune myself out.'],
};
export const NAMES = { michael: 'Michael Scott', dwight: 'Dwight Schrute', jim: 'Jim Halpert', pam: 'Pam Beesly', erin: 'Erin Hannon', andy: 'Andy Bernard', phyllis: 'Phyllis Vance', stanley: 'Stanley Hudson', angela: 'Angela Martin', kevin: 'Kevin Malone', oscar: 'Oscar Martinez', creed: 'Creed Bratton', meredith: 'Meredith Palmer', darryl: 'Darryl Philbin', ryan: 'Ryan Howard', toby: 'Toby Flenderson', kelly: 'Kelly Kapoor' };

// where someone's head is when they're sitting (for who's near and the bubbles)
export function castAt(who) {
  if (who === 'erin') return { id: 'erin', x: RECEPTION.chair.x, z: RECEPTION.chair.z };
  const s = seatOf(who);
  return s ? { id: who, x: s.chair.x, z: s.chair.z } : null;
}
export const CAST = Object.keys(LINES).map(castAt).filter(Boolean);

// ── the jobs' paths ──
// Dwight, back from the men's room to his desk
export const DWIGHT_BACK = [P(542, 244), P(522, 214), P(470, 160), P(352, 160), P(352, 224)];
// Erin's break: to the break room's vending machines, and back
export const ERIN_BREAK = { at: P(840, 70), face: -Math.PI / 2 };
// Dwight's fire: a bin in the conference room
export const FIRE_BIN = P(486, 104);
// where the panicking run, in the fire (each a line run back and forth)
export const PANIC = [
  [P(225, 150), P(495, 150)],
  [P(350, 145), P(352, 275)],
  [P(262, 272), P(395, 276)],
  [P(455, 150), P(455, 270)],
  [P(178, 246), P(300, 274)],
  [P(560, 214), P(680, 214)],
];

// a saved place to come back to, if it's somewhere you can stand
export function validAt(at) {
  if (!at || !Number.isFinite(at.x) || !Number.isFinite(at.z)) return START;
  const r = roomAt(at.x, at.z);
  if (!r) return START;
  return { x: at.x, z: at.z, face: Number.isFinite(at.face) ? at.face : 0 };
}
