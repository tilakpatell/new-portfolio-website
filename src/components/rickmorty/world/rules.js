// Dimension C-137, the world: where everything stands (the Smiths' street,
// the Smith house on two floors and the garage lab, the school, the alien
// street with Blips and Chitz), how Morty walks about it, how Rick's cruiser
// flies over it, the things to do there and the pop quiz. No drawing
// (./scene.js draws it, ./RmWorld.jsx drives it), so it can be tested on its
// own.
//
// Metres; +x is east, +z is south, so north is -z. A figure's heading (`face`)
// is the angle that turns its +x round to face (cos face, -sin face), as in the
// Shire. The cruiser's nose points (sin yaw, cos yaw), so yaw 0 faces south.
// Each room (and each floor of the house) and the alien street is its own
// area, built far apart (the rooms down the x = -300 line, the annex out at
// x = 400) so a door is a jump.

import { seeded } from '../../middleearth/shire/rules';
import { makeWalker, pushOut } from '../../middleearth/towns/walker';

export { behindYaw, cameraMove } from '../../middleearth/towns/walker';

// ── the areas ──

export const AREAS = {
  street: { x0: -60, x1: 60, z0: -40, z1: 40 },
  annex: { x0: 370, x1: 430, z0: -22, z1: 22 },
  // the Smith house, ground floor: the plan's rooms (PLAN) fill all of it but the
  // outside corner south-west
  house: { x0: -312, x1: -288, z0: -8, z1: 8.5 },
  upstairs: { x0: -306, x1: -294.7, z0: 394, z1: 410.3 },
  garage: { x0: -306, x1: -294, z0: 94, z1: 106 },
  school: { x0: -308, x1: -292, z0: 194, z1: 206 },
  arcade: { x0: -310, x1: -290, z0: 292, z1: 308 },
};
export const ROOM_IDS = ['house', 'upstairs', 'garage', 'school', 'arcade'];
export const OUTDOOR = ['street', 'annex'];

// `pad` grows the area (shrinks it, below zero) all round
export const inArea = (id, x, z, pad = 0) => {
  const a = AREAS[id];
  return x >= a.x0 - pad && x <= a.x1 + pad && z >= a.z0 - pad && z <= a.z1 + pad;
};
export const areaAt = (x, z) => Object.keys(AREAS).find((id) => inArea(id, x, z)) ?? null;

// ── the street ──

// the asphalt is z in [-5, 5], the sidewalks go on to +-7, across the whole street
export const ROAD = { z: 0, w: 10, sidewalk: 2 };
const VERGE = ROAD.w / 2 + ROAD.sidewalk;

// A building: where its footprint's centre is, its width on x and depth on z,
// its wall height and its ridge's height.
// The Smith house as it stands in the show: the garage wing on the west, a
// metre forward of the house, whose east 8 m (x -3 to 5) is two storeys.
export const HOUSE = { id: 'house', x: -5, z: -21.5, w: 20, d: 13, h: 3.2, roof: 8.6 };
export const GARAGE = { id: 'garage', x: -19, z: -19.5, w: 8, d: 11, h: 3.4, roof: 6.2 };
export const SCHOOL = { id: 'school', x: 40, z: 23, w: 30, d: 16, h: 8, roof: 8.5 };
export const ARCADE = { id: 'arcade', x: 400, z: -10, w: 18, d: 12, h: 7, roof: 9 };
// the house and garage as one footprint, which is what the scene fits its model over
export const HOUSE_GARAGE = { x0: -23, x1: 5, z0: -28, z1: -14 };

const TINTS = [0xe9c9a1, 0xb7d3c6, 0xe7b8b0, 0xc2cfe6, 0xf0dd9a, 0xd9bfd8];
export const NEIGHBOURS = [
  [-42, -20],
  [24, -20],
  [46, -20],
  [-42, 21],
  [-18, 21],
  [4, 21],
].map(([x, z], i) => ({ id: `${z < 0 ? 'n' : 's'}${i % 3}`, x, z, w: 12, d: 10, h: 5.5, roof: 8, tint: TINTS[i] }));
export const BUILDINGS = [HOUSE, GARAGE, SCHOOL, ...NEIGHBOURS];

// the driveway runs from the garage door to the sidewalk; the cruiser parks on it, nose south
export const DRIVEWAY = { x0: -23, x1: -15, z0: -14, z1: -7 };
export const BOARD = { x: -19, z: -10.5, yaw: 0 };
// the red-brick front walk, from the front door to the sidewalk
export const FRONT_WALK = { x0: -8.6, x1: -7.4, z0: -15, z1: -7 };

// on the sidewalk at the foot of the front walk, looking up at the house
export const START = { area: 'street', x: -8, z: -6, face: Math.PI / 2 };

// ── doors, exits and portals ──
// A link is where you stand to go through. `arrive` is where you come out:
// a little way outside the matching door (facing away from it), 2 m in from
// a room's south wall (facing the far wall), or inside the house at the other
// end of its door or stairs, and always clear of every link's reach so you
// are never sent straight back. `kind` is 'door', 'exit' (back outside),
// 'portal' or 'stairs'.

const ROOM_X = -300;
const FACE_N = Math.PI / 2;
const HOUSE_DOOR = { x: -8, z: -14.4 };
const GARAGE_DOOR = { x: -19, z: -13.4 };
const SCHOOL_DOOR = { x: 40, z: 14.4 };
const ARCADE_DOOR = { x: 400, z: -3.4 };
// where you come out by a door: `across` and `along` metres from it, facing straight away from it
const beside = (door, across, along) => ({ x: door.x + across, z: door.z + along, face: Math.atan2(-along, across) });
const into = (room) => ({ x: ROOM_X, z: AREAS[room].z1 - 2, face: FACE_N });
const exit = (room, to, arrive) => ({ id: `${room}-exit`, area: room, x: ROOM_X, z: AREAS[room].z1 - 0.6, r: 0.9, kind: 'exit', to, label: 'Back outside', arrive });

export const LINKS = [
  // the front door opens on the entry; the garage's on the lab
  { id: 'house-door', area: 'street', ...HOUSE_DOOR, r: 1.6, kind: 'door', to: 'house', label: 'Smith house', arrive: { x: -297.6, z: 1.4, face: FACE_N } },
  { id: 'garage-door', area: 'street', ...GARAGE_DOOR, r: 1.6, kind: 'door', to: 'garage', label: 'Rick’s garage', arrive: into('garage') },
  { id: 'school-door', area: 'street', ...SCHOOL_DOOR, r: 1.6, kind: 'door', to: 'school', label: 'Harry Herpson High', arrive: into('school') },
  { id: 'arcade-door', area: 'annex', ...ARCADE_DOOR, r: 1.6, kind: 'door', to: 'arcade', label: 'Blips and Chitz', arrive: into('arcade') },
  { id: 'front', area: 'house', x: -297.6, z: 3, r: 0.9, kind: 'exit', to: 'street', label: 'Back outside', arrive: beside(HOUSE_DOOR, 0, 2.4) },
  // out of the garage, to the east of the parked cruiser rather than into it
  exit('garage', 'street', beside(GARAGE_DOOR, 2.4, 1)),
  exit('school', 'street', beside(SCHOOL_DOOR, 0, -2.4)),
  exit('arcade', 'annex', beside(ARCADE_DOOR, 0, 2.4)),
  // the kitchen's west wall and the garage lab's east side
  { id: 'kitchen-garage', area: 'house', x: -311.6, z: 1.1, r: 0.9, kind: 'door', to: 'garage', label: 'Rick’s garage', arrive: { x: -296.8, z: 97.5, face: Math.PI } },
  { id: 'garage-kitchen', area: 'garage', x: -294.8, z: 97.5, r: 0.9, kind: 'door', to: 'house', label: 'The kitchen', arrive: { x: -309.4, z: 1.1, face: 0 } },
  { id: 'stairs-up', area: 'house', x: -295.1, z: 2.6, r: 0.9, kind: 'stairs', to: 'upstairs', label: 'Upstairs', arrive: { x: -303, z: 402, face: FACE_N } },
  { id: 'stairs-down', area: 'upstairs', x: -303, z: 403.4, r: 0.9, kind: 'stairs', to: 'house', label: 'Downstairs', arrive: { x: -296.9, z: 0.6, face: FACE_N } },
  { id: 'garage-portal', area: 'garage', x: -294.8, z: 100, r: 1.4, kind: 'portal', to: 'annex', label: 'Through the portal', arrive: { x: 400, z: 9, face: FACE_N } },
  { id: 'annex-portal', area: 'annex', x: 400, z: 13, r: 1.4, kind: 'portal', to: 'garage', label: 'Back to the garage', arrive: { x: -296.8, z: 100, face: Math.PI } },
];

const nearest = (list, area, x, z) => {
  let best = null;
  let bestD = Infinity;
  for (const o of list) {
    const d = Math.hypot(x - o.x, z - o.z);
    if (o.area === area && d <= o.r && d < bestD) {
      best = o;
      bestD = d;
    }
  }
  return best;
};
export const nearLink = (area, x, z) => nearest(LINKS, area, x, z);

// ── trees and fences ──

const rectDist = (x0, x1, z0, z1, x, z) => Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1));
const edgeDist = (b, x, z) => rectDist(b.x - b.w / 2, b.x + b.w / 2, b.z - b.d / 2, b.z + b.d / 2, x, z);
const segDist = (px, pz, [x0, z0, x1, z1]) => {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const t = Math.max(0, Math.min(1, ((px - x0) * dx + (pz - z0) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - (x0 + t * dx), pz - (z0 + t * dz));
};

// Low picket fences round each back yard: down both sides from the back of
// the house, and across behind. (The Smiths' house sticks out behind the
// garage, so its yard's two sides start at different backs.)
const fenceYard = (x0, x1, far, backWest, backEast = backWest) =>
  [
    [x0, backWest, x0, far],
    [x1, backEast, x1, far],
    [x0, far, x1, far],
  ].map((run) => [...run, 0.08, true]);
export const FENCES = [
  fenceYard(HOUSE_GARAGE.x0, HOUSE_GARAGE.x1, -33, GARAGE.z - GARAGE.d / 2, HOUSE_GARAGE.z0),
  ...NEIGHBOURS.map((n) => {
    const north = n.z < 0;
    return fenceYard(n.x - n.w / 2, n.x + n.w / 2, north ? -33 : 33, n.z + (north ? -1 : 1) * (n.d / 2));
  }),
].flat();

// the straight way from the sidewalk to each street door, which no tree stands in
const LANES = LINKS.filter((l) => l.area === 'street').map((l) => [l.x, l.z, l.x, Math.sign(l.z) * VERGE]);
// where Morty comes out in the street
const LANDINGS = LINKS.filter((l) => l.to === 'street').map((l) => l.arrive);

function treeFits(x, z) {
  if (!inArea('street', x, z, -2) || Math.abs(z - ROAD.z) < VERGE + 0.5) return false;
  if (BUILDINGS.some((b) => edgeDist(b, x, z) < 2)) return false;
  if (rectDist(DRIVEWAY.x0, DRIVEWAY.x1, DRIVEWAY.z0, DRIVEWAY.z1, x, z) < 2) return false;
  if (LINKS.some((l) => l.area === 'street' && Math.hypot(x - l.x, z - l.z) < 2.5)) return false;
  if (LANDINGS.some((a) => Math.hypot(x - a.x, z - a.z) < 2.5)) return false;
  if (LANES.some((lane) => segDist(x, z, lane) < 2.5)) return false;
  if (FENCES.some((f) => segDist(x, z, f) < 1.2)) return false;
  return Math.hypot(x - START.x, z - START.z) >= 3;
}

// Trees along the sidewalks and about the yards, the same every visit.
export const TREES = (() => {
  const rand = seeded(137);
  const out = [];
  for (let tries = 0; out.length < 18 && tries < 4000; tries++) {
    const x = AREAS.street.x0 + 3 + rand() * (AREAS.street.x1 - AREAS.street.x0 - 6);
    const z = rand() < 0.4 ? (rand() < 0.5 ? -1 : 1) * (VERGE + 0.5 + rand() * 1.5) : AREAS.street.z0 + 3 + rand() * (AREAS.street.z1 - AREAS.street.z0 - 6);
    if (!treeFits(x, z) || out.some((t) => Math.hypot(t.x - x, t.z - z) < 7)) continue;
    out.push({ x, z, s: 0.8 + rand() * 0.55, kind: Math.floor(rand() * 3), turn: rand() * Math.PI * 2 });
  }
  return out;
})();

// ── inside the Smith house: the plan ──

// The rooms of each floor, as the show's plans have them. `floor` is the
// colour of the floor for the scene. Everything in the house area that is not
// in a room is outside the house (blocked), as is the void beside the stairs
// upstairs.
const WOOD = 0xc4a77a;
const room = (id, area, name, x0, x1, z0, z1, floor = WOOD) => ({ id, area, name, x0, x1, z0, z1, floor });
export const PLAN = [
  room('kitchen', 'house', 'The kitchen', -312, -306.7, -8, 3.4, 0xe6e1cf),
  room('living', 'house', 'The living room', -306.7, -296.9, -8, -1.9),
  room('den', 'house', 'The den', -296.9, -288, -8, -1.6),
  room('dining', 'house', 'The dining room', -306.7, -299.5, -1.9, 3.4),
  room('entry', 'house', 'The entry', -299.5, -295.7, -1.9, 3.4),
  room('hall', 'house', 'The hall', -295.7, -288, -1.6, 0.5),
  room('stairs', 'house', 'The stairs', -295.7, -294.5, 0.5, 3.4),
  room('rickroom', 'house', 'The back room', -294.5, -288, 0.5, 8.5, 0x8d8aa3),
  room('summer', 'upstairs', 'Summer’s room', -306, -299.8, 394, 399.9, 0xd9a6b8),
  room('morty', 'upstairs', 'Morty’s room', -299.8, -294.7, 394, 399.9, 0x9fb4c9),
  room('upHall', 'upstairs', 'The upstairs hall', -306, -294.7, 399.9, 401.7),
  room('master', 'upstairs', 'Beth and Jerry’s room', -302.4, -294.7, 401.7, 408.8, 0xb9a58f),
  room('balcony', 'upstairs', 'The balcony', -302.4, -294.7, 408.8, 410.3, 0x9a7650),
  // the top of the stairs, a notch in the void, open to the hall and the master bedroom
  room('stairTop', 'upstairs', 'Top of the stairs', -303.6, -302.4, 401.7, 404),
];

// The red rug in the entry
export const RUGS = [{ id: 'entry', area: 'house', x: -297.6, z: 0.75, w: 2.6, d: 3.4, color: 0xa23a2e }];

// The walls inside, between the rooms: [x0, z0, x1, z1, thick], 2.6 m high.
// A gap in a line of wall is a door (1.8 m, or 3 m for the living room's wide
// opening to the dining room): Morty is 0.8 m across.
const wall = (x0, z0, x1, z1) => [x0, z0, x1, z1, 0.12];
export const INNER_WALLS = {
  house: [
    // the kitchen: doors to the living room and the dining room
    wall(-306.7, -8, -306.7, -6),
    wall(-306.7, -4.2, -306.7, 0),
    wall(-306.7, 1.8, -306.7, 3.4),
    // the living room's south side and the entry's north: a wide opening to the dining room
    wall(-306.7, -1.9, -305.2, -1.9),
    wall(-302.2, -1.9, -295.7, -1.9),
    // the living room and the den: a door at the north end
    wall(-296.9, -6.2, -296.9, -1.9),
    // the dining room and the entry
    wall(-299.5, -1.9, -299.5, 0.3),
    wall(-299.5, 2.1, -299.5, 3.4),
    // the entry's east side, open to the hall and the stairs
    wall(-295.7, -1.9, -295.7, -1.3),
    // the hall: doors to the den (north) and the back room (south); the stairs are closed off from it
    wall(-295.7, -1.6, -293.4, -1.6),
    wall(-291.6, -1.6, -288, -1.6),
    wall(-295.7, 0.5, -291.9, 0.5),
    wall(-290.1, 0.5, -288, 0.5),
    // the stairs and the back room
    wall(-294.5, 0.5, -294.5, 3.4),
  ],
  upstairs: [
    // Summer's room and Morty's
    wall(-299.8, 394, -299.8, 399.9),
    // the hall's north wall: doors to each of them
    wall(-306, 399.9, -304.6, 399.9),
    wall(-302.8, 399.9, -298.4, 399.9),
    wall(-296.6, 399.9, -294.7, 399.9),
    // the hall's south wall: open by the stairs, a door to the master bedroom
    wall(-301, 401.7, -299, 401.7),
    wall(-297.2, 401.7, -294.7, 401.7),
    // the master bedroom and the balcony: a wide glass door
    wall(-302.4, 408.8, -300, 408.8),
    wall(-297, 408.8, -294.7, 408.8),
  ],
};

// ── the furniture ──

// Each piece: its centre (x, z), its width across its front (w) and its depth
// (d) and height (h), and the way it faces. Its front faces +z (south) at
// `turn` 0; `turn` is its rotation.y, so a quarter turn of pi/2 faces it east
// and -pi/2 west. The scene draws from this list and each piece is a box in
// the way (the same list makes the colliders), so what you see is what you
// walk into.
const E = Math.PI / 2; // faces east
const W = -Math.PI / 2; // faces west
const N = Math.PI; // faces north
const item = (id, kind, area, x, z, w, d, h, turn = 0) => ({ id, kind, area, x, z, w, d, h, turn });
export const FURNITURE = [
  // the kitchen
  item('counter', 'counter', 'house', -311.4, -6, 4, 1.2, 0.95, E),
  item('stove', 'stove', 'house', -311.4, -3.4, 1.2, 1.2, 0.95, E),
  item('fridge', 'fridge', 'house', -307.5, -7.4, 1.2, 1.2, 1.9),
  // the living room: the TV on the east wall, the couch facing it
  item('tv', 'tv', 'house', -297.3, -3.5, 2.6, 0.8, 1.4, W),
  item('couch', 'couch', 'house', -301.6, -3.5, 3, 1.1, 0.9, E),
  // the dining room's table
  item('table', 'table', 'house', -303.1, 0.8, 2.8, 1.4, 0.75),
  // the den
  item('desk-den', 'desk', 'house', -292.5, -7.5, 2.4, 1, 0.75),
  item('shelf-den', 'shelf', 'house', -288.3, -4.8, 3, 0.5, 1.9, W),
  // the back room
  item('bed-back', 'bed', 'house', -291.2, 7.4, 1.6, 2.1, 0.6, N),
  item('dresser-back', 'dresser', 'house', -288.3, 3, 1.8, 0.5, 0.9, W),
  // upstairs: Summer's room, Morty's, Beth and Jerry's
  item('bed-summer', 'bed', 'upstairs', -304.95, 397.5, 1.1, 2.1, 0.6, E),
  item('desk-summer', 'desk', 'upstairs', -302, 394.5, 1.6, 0.8, 0.75),
  item('bed-morty', 'bed', 'upstairs', -295.75, 397.5, 1.1, 2.1, 0.6, W),
  item('desk-morty', 'desk', 'upstairs', -297.6, 394.5, 1.4, 0.8, 0.75),
  item('bed-master', 'bed', 'upstairs', -295.8, 405.3, 1.8, 2.2, 0.6, W),
  item('dresser-master', 'dresser', 'upstairs', -302.15, 406.5, 2, 0.5, 0.9, E),
  // Rick's garage lab
  item('workbench', 'workbench', 'garage', -300, 94.6, 8, 1.2, 1),
  item('shelf-garage', 'shelf', 'garage', -305.5, 96, 3, 1, 1.9, E),
  item('plumbus', 'machine', 'garage', -305.3, 99, 2, 1.4, 1.6, E),
  item('portalpanic', 'arcade', 'garage', -305.3, 103, 1.4, 1.4, 1.8, E),
  item('toolchest', 'cabinet', 'garage', -304.6, 105.3, 1.4, 0.6, 1.1, N),
  // Mr. Goldenfold's classroom: the chalkboard, his desk, six desks for the class
  item('chalkboard', 'chalkboard', 'school', -300, 194.1, 6, 0.2, 1.3),
  item('goldenfold-desk', 'goldenfold-desk', 'school', -300, 195.4, 3, 1.2, 0.8),
  ...[-304.6, -295.4].flatMap((x, i) => [199, 201, 203].map((z, j) => item(`school-desk${i * 3 + j + 1}`, 'school-desk', 'school', x, z, 2, 0.9, 0.75, N))),
  // Blips and Chitz
  item('roy', 'roy', 'arcade', -300, 292.8, 2, 1.2, 2.1),
  item('cabinet1', 'arcade', 'arcade', -309.5, 297, 1.4, 1, 1.8, E),
  item('cabinet2', 'arcade', 'arcade', -290.5, 300, 1.4, 1, 1.8, W),
  item('cabinet3', 'arcade', 'arcade', -309.5, 303, 1.4, 1, 1.8, E),
];

// ── what's in the way ──

const box = (id, x, z, w, d, turn = 0) => ({ id, kind: 'box', x, z, w, d, turn });
const slab = (id, x0, x1, z0, z1) => box(id, (x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0);
const circle = (id, x, z, r) => ({ id, kind: 'circle', x, z, r });
const furnished = (area) => FURNITURE.filter((f) => f.area === area).map((f) => box(f.id, f.x, f.z, f.w, f.d, f.turn));

export const COLLIDERS = {
  street: [...BUILDINGS.map((b) => box(b.id, b.x, b.z, b.w, b.d)), ...TREES.map((t, i) => circle(`tree${i}`, t.x, t.z, 0.45 * t.s))],
  annex: [box('arcade', ARCADE.x, ARCADE.z, ARCADE.w, ARCADE.d)],
  // outside, south-west of the entry
  house: [slab('outside', AREAS.house.x0, -294.5, 3.4, AREAS.house.z1), ...furnished('house')],
  // the void west of the master bedroom, but for the notch at the top of the stairs
  upstairs: [slab('void-north', -306, -303.6, 401.7, 404), slab('void-south', -306, -302.4, 404, AREAS.upstairs.z1), ...furnished('upstairs')],
  garage: furnished('garage'),
  school: furnished('school'),
  arcade: furnished('arcade'),
};
// Walls: the street's fences, the house's inner walls and the balcony's low
// railing on its south edge. A room's outer walls are its area's edge, which
// `stepMorty` keeps in.
export const WALLS = {
  street: FENCES,
  annex: [],
  house: INNER_WALLS.house,
  upstairs: [...INNER_WALLS.upstairs, [-302.4, AREAS.upstairs.z1, -294.7, AREAS.upstairs.z1, 0.08, true]],
  garage: [],
  school: [],
  arcade: [],
};
// The parked cruiser is not here: it moves, so whoever walks passes it in.
export const collidersIn = (area) => COLLIDERS[area];
export const wallsIn = (area) => WALLS[area];

// ── the things to touch ──

const spot = (id, area, x, z, label, verb) => ({ id, area, x, z, r: 1.4, label, verb });
export const HOTSPOTS = [
  // the house: the TV is the east wall's, Jerry's on the couch facing it, Beth at the stove
  spot('cable', 'house', -298.1, -3.5, 'Watch interdimensional cable', 'Watch'),
  spot('jerry', 'house', -301.6, -3.5, 'Jerry', 'Talk'),
  spot('beth', 'house', -310.3, -3.4, 'Beth', 'Talk'),
  spot('butter', 'house', -302.6, 0.8, 'The butter robot', 'Switch on'),
  spot('summer', 'upstairs', -302.4, 397.2, 'Summer', 'Talk'),
  spot('mortyroom', 'upstairs', -297.2, 397, 'Morty’s room', 'Look round'),
  spot('rick', 'garage', -302, 95.6, 'Rick', 'Talk'),
  spot('meeseeks', 'garage', -297.5, 95.6, 'Mr. Meeseeks box', 'Press'),
  spot('plumbus', 'garage', -305.2, 99, 'The plumbus factory', 'Watch'),
  spot('portalpanic', 'garage', -305.2, 103, 'Portal panic cabinet', 'Play'),
  spot('quiz', 'school', -300, 196.4, 'Mr. Goldenfold’s pop quiz', 'Sit the quiz'),
  spot('roy', 'arcade', -300, 293.6, 'Roy: A Life Well Lived', 'Put the headset on'),
  spot('cabinet1', 'arcade', -308.4, 297, 'Arcade cabinet', 'Play'),
  spot('cabinet2', 'arcade', -291.6, 300, 'Arcade cabinet', 'Play'),
  spot('cabinet3', 'arcade', -308.4, 303, 'Arcade cabinet', 'Play'),
];
export const nearHotspot = (area, x, z) => nearest(HOTSPOTS, area, x, z);

// ── walking ──

export const MORTY = { radius: 0.4, walk: 3.6, run: 7, accel: 18, turn: 12 };
export const newMorty = (at = START) => ({ x: at.x, z: at.z, face: at.face ?? 0, vx: 0, vz: 0, speed: 0, running: false, edge: false });

// Morty can't stand within a body's width of the edge of where he is
const walkerFor = (area, extra = []) =>
  makeWalker({ radius: 1e4, colliders: [...collidersIn(area), ...extra], walls: wallsIn(area), blocked: (x, z) => !inArea(area, x, z, -MORTY.radius), body: MORTY });
const WALKERS = Object.fromEntries(Object.keys(AREAS).map((id) => [id, walkerFor(id)]));
// and one for the street with the cruiser parked in it, kept while it stays put
let parked = { x: NaN, z: NaN, walker: null };

// One step of walking. `move` is where the visitor wants to go, already turned
// to the world (the camera does that): { x, z } up to length 1, and `run`.
// `cruiser` is where the cruiser is parked, if it is: it stands in the street.
export function stepMorty(m, move, dt, area, { cruiser } = {}) {
  let walker = WALKERS[area];
  if (cruiser && area === 'street') {
    if (parked.x !== cruiser.x || parked.z !== cruiser.z) parked = { x: cruiser.x, z: cruiser.z, walker: walkerFor('street', [circle('cruiser', cruiser.x, cruiser.z, CRUISER.radius)]) };
    walker = parked.walker;
  }
  return walker.step(m, move, dt);
}

// ── the cruiser ──

export const CRUISER = { radius: 1.7, hover: 1.2, top: 22, accel: 9, turn: 1.8, climb: 8, ceiling: 40 };
const EDGE = 2; // it keeps this far in from the street's edge
const BANK = 0.45; // how far it leans, at most

export const newCruiser = () => ({ x: BOARD.x, z: BOARD.z, y: CRUISER.hover, yaw: BOARD.yaw, speed: 0, vy: 0, bank: 0 });

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// the buildings it is over: their footprints, and the cruiser's own width round
const under = (x, z) => BUILDINGS.filter((b) => Math.abs(x - b.x) <= b.w / 2 + CRUISER.radius && Math.abs(z - b.z) <= b.d / 2 + CRUISER.radius);

// How low it can fly at (x, z): its hover height, or two metres over the roof
// of whatever it is over.
export const floorAt = (x, z) => Math.max(CRUISER.hover, ...under(x, z).map((b) => b.roof + 2));

// One step of flying. input: { throttle -1..1, steer -1..1 (1 is left, as the
// cars turn), lift -1..1 }.
export function stepCruiser(c, { throttle = 0, steer = 0, lift = 0 } = {}, dt) {
  const turn = clamp(steer, -1, 1);
  const yaw = c.yaw + turn * CRUISER.turn * dt;
  const speed = c.speed + clamp(clamp(throttle, -1, 1) * CRUISER.top - c.speed, -CRUISER.accel * dt, CRUISER.accel * dt);
  const s = AREAS.street;
  const x = clamp(c.x + Math.sin(yaw) * speed * dt, s.x0 + EDGE, s.x1 - EDGE);
  const z = clamp(c.z + Math.cos(yaw) * speed * dt, s.z0 + EDGE, s.z1 - EDGE);
  let vy = c.vy + (clamp(lift, -1, 1) * CRUISER.climb - c.vy) * Math.min(1, dt * 5);
  let y = c.y + vy * dt;
  const floor = floorAt(x, z);
  if (y < floor || y > CRUISER.ceiling) {
    y = clamp(y, floor, CRUISER.ceiling);
    vy = 0;
  }
  const bank = c.bank + (turn * clamp(speed / CRUISER.top, -1, 1) * BANK - c.bank) * Math.min(1, dt * 6);
  return { x, z, y, yaw, speed, vy, bank };
}

// Slow, over open ground in the street (not a roof).
export const canLand = (c) => Math.abs(c.speed) < 3 && inArea('street', c.x, c.z) && under(c.x, c.z).length === 0;

// Where Morty steps out: beside it (its own +x side first), clear of the
// cruiser and everything else, facing the way its nose points.
export function exitCruiser(c) {
  const colliders = [...collidersIn('street'), circle('cruiser', c.x, c.z, CRUISER.radius)];
  const walls = wallsIn('street');
  const fx = Math.sin(c.yaw);
  const fz = Math.cos(c.yaw);
  const gap = CRUISER.radius + MORTY.radius + 0.6;
  const spots = [0, 0.9, 1.8].flatMap((more) =>
    [[fz, -fx], [-fz, fx], [-fx, -fz], [fx, fz]].map(([dx, dz]) => [c.x + dx * (gap + more), c.z + dz * (gap + more)])
  );
  const clear = ([x, z]) => {
    const [px, pz] = pushOut(x, z, MORTY.radius, colliders, walls);
    return inArea('street', x, z, -MORTY.radius) && Math.hypot(px - x, pz - z) < 1e-6;
  };
  const [x, z] = spots.find(clear) ?? pushOut(...spots[0], MORTY.radius, colliders, walls);
  return { x, z, face: Math.atan2(-fz, fx) };
}

// ── what there is to do ──

export const TASKS = [
  { id: 'cable', name: 'Watch interdimensional cable', hint: 'Go into the Smith house and put interdimensional cable on the TV.' },
  { id: 'butter', name: 'The butter robot', hint: 'Switch on the butter robot at the Smiths’ breakfast table.' },
  { id: 'meeseeks', name: 'Summon a Meeseeks', hint: 'Press the Meeseeks box on Rick’s workbench, in the garage.' },
  { id: 'plumbus', name: 'See a plumbus made', hint: 'Watch the plumbus factory in Rick’s garage.' },
  { id: 'portalpanic', name: 'Play Portal panic', hint: 'Play the Portal panic cabinet in Rick’s garage.' },
  { id: 'quiz', name: 'Pass the pop quiz', hint: 'Sit Mr. Goldenfold’s pop quiz at Harry Herpson High, and get seven right.' },
  { id: 'fly', name: 'Fly the cruiser', hint: 'Board Rick’s space cruiser in the driveway and take it up over the neighbourhood.' },
  { id: 'portal', name: 'Go through the portal', hint: 'Step through the portal at the back of Rick’s garage.' },
  { id: 'roy', name: 'Play Roy', hint: 'Find Blips and Chitz on the other side of the portal, and put the headset on at the Roy cabinet.' },
  { id: 'roy55', name: 'Outlive Morty’s 55', hint: 'Play Roy again and live past Morty’s 55.' },
];

// What's done and what's next. `done` is the ids finished, in any order.
export function progress(done = []) {
  const finished = TASKS.filter((t) => done.includes(t.id));
  const next = TASKS.find((t) => !done.includes(t.id)) ?? null;
  return { done: finished.map((t) => t.id), count: finished.length, total: TASKS.length, next, objective: next ? next.hint : 'Everything’s done. Wubba lubba dub dub.' };
}

// ── the pop quiz ──

// Ten questions on the show. `answer` is the index of the right option.
export const QUIZ = [
  { q: 'What is the name of Rick’s home dimension?', options: ['B-52', 'C-137', 'D-99', 'Z-612'], answer: 1 },
  { q: 'Which alien arcade does Rick take Morty to?', options: ['Blips and Chitz', 'Zorp’s Game Hole', 'Planet Pixel', 'The Citadel Arcade'], answer: 0 },
  { q: 'How old was Roy when Morty’s game of Roy: A Life Well Lived ended?', options: ['45', '65', '35', '55'], answer: 3 },
  { q: 'What did Rick turn himself into to get out of family therapy?', options: ['a teddy bear', 'a pickle', 'a toaster', 'a goldfish'], answer: 1 },
  { q: 'What does a Mr. Meeseeks exist to do?', options: ['cook breakfast for the family', 'guard Rick’s garage', 'complete one task, then vanish', 'fly the space cruiser'], answer: 2 },
  { q: 'What was the butter robot built to do?', options: ['toast the bread', 'wash the dishes', 'stir the coffee', 'pass the butter'], answer: 3 },
  { q: 'Which planet is Birdperson from?', options: ['Gazorpazorp', 'Bird World', 'Planet Squanch', 'Earth'], answer: 1 },
  { q: 'What do the giant floating heads in the sky demand?', options: ['Sing us a lullaby', 'Hand over the planet', 'Show me what you got', 'Pay the entry fee'], answer: 2 },
  { q: 'What is the line in Jerry’s apple ad?', options: ['Hungry for apples?', 'Got apples?', 'Crunch into summer?', 'Craving something sweet?'], answer: 0 },
  { q: 'Who is Morty’s sister?', options: ['Beth', 'Jessica', 'Summer', 'Tammy'], answer: 2 },
];

// `answers` is the option picked for each question, in order; a blank is wrong.
export function grade(answers = []) {
  const right = QUIZ.filter((q, i) => answers[i] === q.answer).length;
  return { right, total: QUIZ.length, pass: right >= 7 };
}
