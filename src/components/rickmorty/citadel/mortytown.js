// Mortytown, the Citadel's ghetto: a district of its own under the city,
// down the lift in the concourse's south-west shopfronts. No Ricks live
// here, and its Mortys run it: Big Morty at The Creepy Morty's door, Slick
// Morty on a corner, a campaign manager by his poster, Morty Mart on the
// south side with Cop Morty and his partner outside it, and the Mortytown
// Locos hiding in its alleys (./locos.js hunts them). No drawing
// (./district.js draws it), so it can be tested on its own.
//
// Metres in the district's own frame, the concourse's way round (./layout.js):
// +x east, +z south, a figure's `face` turning its +x to (cos face, -sin
// face). The street runs east and west along z = 0, the pavements are at
// z ±6…10, and the blocks stand behind them to the district's edge. ORIGIN
// is where the district is drawn in the Citadel's scene, far under the
// concourse and its rooms, where neither is ever in view of the other.

import { pushOut } from '../../middleearth/towns/walker';

export const ORIGIN = { x: 0, y: -300, z: 0 };
export const MORTYTOWN = { x0: -60, x1: 60, z0: -30, z1: 30 };
export const inMortytown = (x, z) => x > MORTYTOWN.x0 && x < MORTYTOWN.x1 && z > MORTYTOWN.z0 && z < MORTYTOWN.z1;
// the road, between the pavements' kerbs
export const ROAD = { z0: -6, z1: 6 };
// the pavements end at the shopfronts
export const FRONT = 10;

// The lift up to the concourse, at the west end; you come out of it
// facing east, down the street.
export const LIFT = { x: -59, z: 0, w: 2, d: 5 };
export const EXIT = { id: 'up', x: -56.4, z: 0, r: 2.2 };
export const START = { x: -52.5, z: 0, face: 0 };

// The blocks along the street, shopfronts on the pavement, backs to the
// district's edge, with alleys between some of them and a short side
// street to Simple Rick's back door in the north. `h` is the roofline.
export const BLOCKS = [
  // the north side, west to east
  { id: 'bailbonds', x: -49, z: -20, w: 22, d: 20, h: 9 },
  { id: 'creepymorty', x: -23, z: -20, w: 22, d: 20, h: 12 },
  { id: 'tenement-n', x: 6, z: -20, w: 20, d: 20, h: 15 },
  { id: 'newsstand', x: 40, z: -20, w: 40, d: 20, h: 11 },
  // the south side
  { id: 'pawn', x: -45, z: 20, w: 30, d: 20, h: 10 },
  { id: 'tenement-s', x: -12, z: 20, w: 28, d: 20, h: 14 },
  { id: 'laundry', x: 15, z: 20, w: 26, d: 20, h: 9 },
  { id: 'mortymart', x: 42, z: 20, w: 20, d: 20, h: 7 },
  { id: 'corner', x: 56, z: 20, w: 8, d: 20, h: 12 },
];
// the doors that matter, on the shopfronts
export const CLUB_DOOR = { x: -23, z: -FRONT };
export const MART_DOOR = { x: 42, z: FRONT };
// Simple Rick's back door, at the end of the side street
export const FACTORY_BACK = { x: -8, z: -29.6 };

// The police cruiser at the kerb outside Morty Mart, the bins in the
// alleys, the lamps along the kerbs.
export const CRUISER = { x: 38, z: 4.4, w: 4.6, d: 2.1, turn: 0 };
export const BINS = [
  { x: -36.6, z: -21, w: 1.7, d: 1.1, turn: Math.PI / 2 },
  { x: 18.9, z: -20, w: 1.7, d: 1.1, turn: Math.PI / 2 },
  { x: -26.9, z: 20.5, w: 1.7, d: 1.1, turn: Math.PI / 2 },
  { x: 31, z: 21, w: 1.7, d: 1.1, turn: Math.PI / 2 },
  { x: -10.6, z: -22, w: 1.6, d: 1, turn: 0 },
];
export const LAMPS = [-44, -20, 4, 28].flatMap((x) => [
  [x, -6.4],
  [x + 12, 6.4],
]);

const box = (id, b, o = {}) => ({ id, kind: 'box', x: b.x, z: b.z, w: b.w, d: b.d, turn: b.turn || 0, ...o });
const circle = (id, x, z, r, o = {}) => ({ id, kind: 'circle', x, z, r, ...o });

export const COLLIDERS = [
  ...BLOCKS.map((b) => box(b.id, b, { top: b.h })),
  box('lift', LIFT, { top: 4 }),
  box('cruiser', CRUISER, { low: true, top: 1.5 }),
  ...BINS.map((b, i) => box(`bin${i}`, b, { low: true, top: 1.3 })),
  ...LAMPS.map(([x, z], i) => circle(`lamp${i}`, x, z, 0.18, { low: true, top: 5 })),
];
// the district's edge: walls all round [x0, z0, x1, z1, thick]
const M = MORTYTOWN;
export const WALLS = [
  [M.x0, M.z0, M.x1, M.z0, 0.3],
  [M.x0, M.z1, M.x1, M.z1, 0.3],
  [M.x0, M.z0, M.x0, M.z1, 0.3],
  [M.x1, M.z0, M.x1, M.z1, 0.3],
];

// Where a Loco can hide: at the dead end of an alley, out of sight of the
// street until you walk down it. A hunt (./locos.js) picks three.
export const HIDES = [
  { id: 'alley-bail', x: -36, z: -26.4, face: -Math.PI / 2 },
  { id: 'alley-tenement', x: 18, z: -26.4, face: -Math.PI / 2 },
  { id: 'alley-pawn', x: -28, z: 26.4, face: Math.PI / 2 },
  { id: 'alley-mart', x: 30, z: 26.4, face: Math.PI / 2 },
];

// Cop Morty, outside Morty Mart by his cruiser: where the Locos are walked to.
export const COP = { x: 35.4, z: 7.6 };

const SOUTH = -Math.PI / 2; // (facing +z, from the north side)
const NORTH = Math.PI / 2; // (facing -z, from the south side)

// Who's about, and what they say as you come by (in turn).
export const CAST = [
  { id: 'bigmorty', name: 'Big Morty', kind: 'bigmorty', x: -19.2, z: -8.4, face: SOUTH + 0.4, lines: ['You lost, Rick? Mortytown’s for Mortys.', 'I run this street. Ask anybody. Don’t ask the Locos.', 'The Creepy Morty’s members only. You’re not a member.'] },
  { id: 'slickmorty', name: 'Slick Morty', kind: 'slickmorty', x: -33.2, z: 8.3, face: NORTH - 0.3, lines: ['They grew me in a vat. I’m the one who got out.', 'Whatever you need, I can get it. Except out of here.'] },
  { id: 'campaignmorty', name: 'Campaign Manager Morty', kind: 'campaignmorty', x: 2.4, z: -8.2, face: SOUTH, lines: ['Vote Morty! He’s one of us. Well, he’s one of us now.', 'Every Morty counts. That’s the slogan. I wrote it.'] },
  { id: 'rickd3', name: 'Rick D. Sanchez III', kind: 'rickd3', x: -10.2, z: -26.6, face: SOUTH + 0.3, lines: ['Simple Rick’s Wafers, the taste of a simpler time. I own the factory, the brand and the Rick.', 'The back door is for deliveries. You don’t look like a delivery.'] },
  { id: 'simplerick', name: 'Simple Rick', kind: 'simplerick', x: -5.8, z: -26.6, face: SOUTH - 0.3, lines: ['Come home to the impossible flavour of your own completion.', 'Simple Rick’s. Simple wafers. A simple life.'] },
  { id: 'copmorty', name: 'Cop Morty', kind: 'copmorty', x: COP.x, z: COP.z, face: NORTH + 0.5, lines: ['Morty Mart’s been robbed. The Locos again. Bring ’em to me if you find ’em.', 'Three of them, with tattoos. They hide where a Morty hides: down an alley, behind a bin.'] },
  { id: 'coprick', name: 'Cop Rick', kind: 'cop', x: 40.6, z: 7.9, face: NORTH - 0.4, lines: ['My partner does the talking. I do the disintegrating.', 'Mortytown. Every shift, Mortytown.'] },
];

// Who walks, and where: Evil Rick up and down the middle of the road, and
// the street's Mortys round the rest of it.
export const WALKS = [{ id: 'evilrick', name: 'Evil Rick', kind: 'evilrick', loop: 0, lines: ['(He stares through you, and keeps walking.)', '(He doesn’t blink. He doesn’t seem to need to.)'] }];
export const LOOPS = [
  [
    [-44, -1.6],
    [22, -1.6],
  ],
  [
    [-50, -4.2],
    [32, -4.2],
    [32, 1.6],
    [-50, 1.6],
  ],
  [
    [-48, 2.8],
    [54, 2.8],
    [54, -3.2],
    [-48, -3.2],
  ],
];

// A saved spot in Mortytown, if it's still a fair one: inside it and clear
// of everything.
export function validTownAt(saved) {
  if (!saved || !Number.isFinite(saved.x) || !Number.isFinite(saved.z)) return START;
  if (!inMortytown(saved.x, saved.z)) return START;
  // (dead centre of a block doesn't get pushed anywhere useful)
  if (BLOCKS.some((b) => Math.abs(saved.x - b.x) < b.w / 2 && Math.abs(saved.z - b.z) < b.d / 2)) return START;
  const [x, z] = pushOut(saved.x, saved.z, 0.42, COLLIDERS, WALLS);
  if (Math.hypot(x - saved.x, z - saved.z) > 0.05) return START;
  return { x: saved.x, z: saved.z, face: Number.isFinite(saved.face) ? saved.face : 0 };
}
