// Bree, the town: the lie of the land, where everything stands, who's
// about, and where the Nazgûl walk. No drawing (./scene.js draws it,
// ./BreeWorld.jsx drives it), so it can be tested on its own.
//
// Metres, the Shire's way round: +x is east, +z south, so north is -z; a
// figure's `face` turns its +x to (cos face, -sin face). A building's
// `turn` is the turn its model is given (its door faces local +z): 0 faces
// south, PI north, PI/2 east, -PI/2 west. Bree is a town of Big Folk, so
// its houses and doors are built for people of about 2.3 m; hobbits look
// small in it.

import { fbm, makeNoise, smooth } from '../../../../lib/paint';
import { pushOut } from '../walker';

// The disc you can walk in, and how far the hills go on past it.
export const WORLD = { radius: 46, edge: 92 };
// the stockade round the town, and its two gates on the East Road
export const TOWN = { r: 34, logs: 4.6 };
const ringAt = (a, r = TOWN.r) => [Math.cos(a) * r, Math.sin(a) * r];
const GATE_W = 5.2;
const gate = (a) => {
  const g = GATE_W / 2 / TOWN.r;
  const [x, z] = ringAt(a);
  // the gate's own +x runs along the stockade; its +z points into the town
  return { a, x, z, w: GATE_W, turn: Math.atan2(-Math.cos(a), -Math.sin(a)), posts: [ringAt(a - g), ringAt(a + g)], gap: g };
};
export const GATES = { west: gate(Math.atan2(3.6, -33.8)), east: gate(Math.atan2(-4, 33.8)) };

// ── where everything stands ──

// The high street is the East Road, gate to gate; the lanes go up Bree-hill
// to the north and down past Bill Ferny's to the south. [x, z] points.
export const STREET = [[-48, 3.4], [GATES.west.x, GATES.west.z], [-18, 4.2], [-4, 3.4], [10, 1.2], [22, -1.6], [GATES.east.x, GATES.east.z], [48, -7.6]];
export const ROADS = [
  ...STREET.slice(1).map((b, i) => ({ id: `street${i}`, a: STREET[i], b, w: 5 })),
  { id: 'north', a: [-8, 3.6], b: [-8, -29], w: 3.2 },
  { id: 'south', a: [-6, 9], b: [-6, 28], w: 3 },
  { id: 'yard', a: [17, -1], b: [17.5, -10.5], w: 4.5 },
];

// The houses: x, z, the front's width `w` and the depth `d` (before the
// turn), floors, roof, a stone ground floor or not, a seed for the little
// differences, and the door's paint.
export const HOUSES = [
  // the north side of the high street, facing it
  { id: 'n1', x: -22.5, z: -3.5, w: 7, d: 7, turn: 0, floors: 3, roof: 'slate', stone: true, seed: 1, door: 0x5a3a24 },
  { id: 'n2', x: -14.5, z: -3.75, w: 6.5, d: 7.5, turn: 0, floors: 2, roof: 'thatch', stone: false, seed: 2, door: 0x2f4a5e },
  { id: 'e1', x: 26.5, z: -9.05, w: 6, d: 6.5, turn: 0, floors: 2, roof: 'slate', stone: true, seed: 3, door: 0x6a2e24 },
  // behind the Pony and the yard, up the hill
  { id: 'nb', x: 6.5, z: -20.5, w: 7, d: 6, turn: 0, floors: 2, roof: 'thatch', stone: true, seed: 14, door: 0x3d5a32 },
  { id: 'ne', x: 19.5, z: -20.5, w: 6, d: 6, turn: 0, floors: 2, roof: 'slate', stone: false, seed: 15, door: 0x7a5a2a },
  // up the north lane: the west side faces east, the east side west
  { id: 'l1', x: -13.8, z: -12, w: 6.5, d: 6, turn: Math.PI / 2, floors: 2, roof: 'slate', stone: false, seed: 4, door: 0x3d5a32 },
  { id: 'l2', x: -14.05, z: -20.5, w: 7, d: 6.5, turn: Math.PI / 2, floors: 3, roof: 'thatch', stone: true, seed: 5, door: 0x5a3a24 },
  { id: 'l3', x: -2.2, z: -16, w: 6, d: 6, turn: -Math.PI / 2, floors: 2, roof: 'thatch', stone: false, seed: 6, door: 0x7a5a2a },
  { id: 'l4', x: -1.7, z: -24, w: 6.5, d: 7, turn: -Math.PI / 2, floors: 3, roof: 'slate', stone: true, seed: 7, door: 0x2f4a5e },
  // the south side of the high street, facing it
  { id: 's1', x: -25, z: 10.85, w: 7, d: 6.5, turn: Math.PI, floors: 2, roof: 'thatch', stone: true, seed: 8, door: 0x6a2e24 },
  { id: 's2', x: -16, z: 11.3, w: 6, d: 7, turn: Math.PI, floors: 3, roof: 'slate', stone: false, seed: 9, door: 0x3d5a32 },
  { id: 's4', x: 9, z: 8.45, w: 7, d: 6.5, turn: Math.PI, floors: 3, roof: 'slate', stone: true, seed: 10, door: 0x5a3a24 },
  { id: 's5', x: 18.5, z: 6.25, w: 6.5, d: 6.5, turn: Math.PI, floors: 2, roof: 'thatch', stone: false, seed: 11, door: 0x7a5a2a },
  { id: 's6', x: 27, z: 4.3, w: 6, d: 6, turn: Math.PI, floors: 2, roof: 'slate', stone: false, seed: 12, door: 0x2f4a5e },
  // down the south lane, east side
  { id: 's3', x: -0.3, z: 22, w: 6, d: 6, turn: -Math.PI / 2, floors: 2, roof: 'thatch', stone: true, seed: 13, door: 0x6a2e24 },
  // and the back gardens to the south
  { id: 's7', x: -21.5, z: 19.5, w: 6, d: 6, turn: Math.PI / 2, floors: 2, roof: 'slate', stone: true, seed: 16, door: 0x5a3a24 },
  { id: 's8', x: 13, z: 19.5, w: 6.5, d: 6, turn: Math.PI, floors: 3, roof: 'thatch', stone: false, seed: 17, door: 0x2f4a5e },
  { id: 's9', x: 23, z: 15, w: 6, d: 6, turn: Math.PI, floors: 2, roof: 'slate', stone: true, seed: 18, door: 0x6a2e24 },
];
// The Prancing Pony: three floors on the north side of the high street, its
// door on to the street, its stable yard beside it.
export const PONY = { x: 4, z: -7.1, w: 15, d: 9, turn: 0 };
export const STABLE = { x: 17.8, z: -13.5, w: 9, d: 4.5, turn: 0 };
// the gatekeeper's lodge, inside the West Gate
export const LODGE = { x: -30, z: -2.8, w: 3.6, d: 3.6, turn: 0 };
// Bill Ferny's: dark, down the south lane, facing it
export const FERNY = { x: -12, z: 23, w: 6, d: 6, turn: Math.PI / 2 };
export const WELL = { x: -10.5, z: 10.5, r: 1.1 };
export const STALLS = [
  { x: -10.2, z: 14.6, w: 3.2, d: 1.8, turn: Math.PI, cloth: 0xa8452e },
  { x: -1.6, z: 14.8, w: 3.2, d: 1.8, turn: Math.PI, cloth: 0x3a6a5a },
];
// trees in the yards and gardens: [x, z, size]
export const TREES = [
  [-15.5, 18.5, 1],
  [7.5, 16.5, 1.1],
  [27, 10.5, 0.9],
  [-24.5, -13.5, 1],
  [12.5, -18, 1.15],
  [15, -24.5, 1],
  [-20, -26, 0.9],
  [4, 27.5, 0.95],
];
// carts, barrels and crates about the streets: kind, x, z, turn
export const CLUTTER = [
  ['cart', 13.6, -5.4, 0.4],
  ['barrels', -2.6, -2.2, 0],
  ['barrels', 12.2, -2.4, 0.5],
  ['crates', -11.6, 6.9, 0.2],
  ['crates', 22.6, -4.2, -0.3],
  ['barrels', -19.6, 7.4, 0.8],
  ['hay', 21.5, -11, 0.3],
  ['hay', 14, -12.2, -0.4],
  ['barrels', -27.2, -0.4, 0.2],
];
// lamp posts at the street's edge: x, z, turn (the lantern hangs to +x)
export const LAMPS = [
  [-20, 1.15, -Math.PI / 2],
  [-6.6, 6.5, Math.PI / 2],
  [20.6, -4.1, -Math.PI / 2],
];
// puddles in the mud: x, z, the two radii, turn
export const PUDDLES = [
  [-40, 4.4, 1.5, 0.8, 0.2],
  [-36.2, 2.6, 1.1, 0.6, -0.4],
  [-27, 4.6, 1.8, 0.9, 0.1],
  [-19, 3.2, 1.2, 0.7, 0.5],
  [-11, 4.8, 1.6, 0.8, -0.2],
  [-6.4, 2.4, 1.0, 0.6, 0.3],
  [1.5, 1.4, 1.4, 0.8, 0],
  [8, 3.1, 1.7, 0.9, -0.3],
  [15, 0.8, 1.2, 0.7, 0.4],
  [24, -2.9, 1.5, 0.8, 0.1],
  [-8.4, -6, 0.9, 0.6, 0.2],
  [-7.6, -15, 1.2, 0.6, -0.1],
  [-6.3, 17, 1.0, 0.6, 0.3],
  [16.8, -6.8, 1.3, 0.8, 0.5],
];

// ── the lie of the land ──

const toSeg = (x, z, a, b) => {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - (a[0] + t * dx), z - (a[1] + t * dz));
};
export const onRoad = (x, z) => ROADS.some((r) => toSeg(x, z, r.a, r.b) <= r.w / 2);
// 1 in the middle of a road, 0 a little way off it (for painting the ground)
export function roadAmount(x, z) {
  let best = 0;
  for (const r of ROADS) best = Math.max(best, 1 - smooth(r.w * 0.32, r.w * 0.62, toSeg(x, z, r.a, r.b)));
  return best;
}
const gauss = (x, z, cx, cz, r) => Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * r * r));
const noise = makeNoise(17);
const noise2 = makeNoise(53);

// the land before anything's built on it: rising to the north, Bree-hill
// to the north-east, and hills all round past the stockade
function land(x, z) {
  let h = (fbm(noise, x * 0.04 + 5, z * 0.04 + 9, { octaves: 3 }) - 0.5) * 1.4;
  h += Math.max(0, -z) * 0.07;
  h += 15 * gauss(x, z, 26, -52, 17);
  h += smooth(37, 84, Math.hypot(x, z)) * (7 + fbm(noise2, x * 0.05, z * 0.05, { octaves: 3 }) * 11);
  return h;
}

// a box in its own frame: how far outside it (x, z) is (negative inside)
export function boxDist(b, x, z) {
  const t = b.turn || 0;
  const dx = x - b.x;
  const dz = z - b.z;
  const lx = dx * Math.cos(t) - dz * Math.sin(t);
  const lz = dx * Math.sin(t) + dz * Math.cos(t);
  return Math.max(Math.abs(lx) - b.w / 2, Math.abs(lz) - b.d / 2);
}

// Every building stands on a level pad, at the height of its middle.
const PADS = [...HOUSES, PONY, STABLE, LODGE, FERNY].map((b) => ({ ...b, y: land(b.x, b.z) }));

export function height(x, z) {
  let h = land(x, z);
  for (const p of PADS) {
    const k = 1 - smooth(0.4, 2.6, boxDist(p, x, z));
    if (k > 0) h += (p.y - h) * k;
  }
  // the streets are worn a little lower than their edges
  return h - roadAmount(x, z) * 0.12;
}
export const groundY = height;

// ── what's in the way ──

const box = (id, b, o = {}) => ({ id, kind: 'box', x: b.x, z: b.z, w: b.w, d: b.d, turn: b.turn || 0, ...o });
const circle = (id, x, z, r, o = {}) => ({ id, kind: 'circle', x, z, r, ...o });

export const COLLIDERS = [
  ...HOUSES.map((h) => box(h.id, h, { top: 6 + h.floors * 2.4 })),
  box('pony', PONY, { top: 13 }),
  box('stable', { ...STABLE, z: STABLE.z - 0.5, d: STABLE.d - 1 }, { top: 4.5 }),
  box('lodge', LODGE, { top: 5 }),
  box('ferny', FERNY, { top: 9 }),
  circle('well', WELL.x, WELL.z, WELL.r, { low: true, top: 1.4 }),
  ...STALLS.map((s, i) => box(`stall${i}`, s, { top: 2.6 })),
  ...TREES.map(([x, z, s], i) => circle(`tree${i}`, x, z, 0.45 * s, { top: 9 })),
  ...CLUTTER.map(([kind, x, z, turn], i) =>
    kind === 'cart' ? box(`cart${i}`, { x, z, w: 3, d: 1.8, turn }, { low: true, top: 1.6 }) : circle(`${kind}${i}`, x, z, kind === 'hay' ? 0.75 : 0.7, { low: true, top: 1.2 }),
  ),
  ...LAMPS.map(([x, z], i) => circle(`lamp${i}`, x, z, 0.2, { low: true, top: 2.5 })),
  // the gateposts
  ...Object.entries(GATES).flatMap(([k, g]) => g.posts.map(([x, z], i) => circle(`${k}-post${i}`, x, z, 0.5, { top: 6 }))),
];

// The stockade, as arcs of wall from gate to gate, and the dike's banks
// along the road outside each gate. [x0, z0, x1, z1, thick, low]
function arc(a0, a1, r = TOWN.r) {
  const n = Math.max(2, Math.ceil((Math.abs(a1 - a0) * r) / 3));
  const out = [];
  for (let i = 0; i < n; i++) {
    const [x0, z0] = ringAt(a0 + ((a1 - a0) * i) / n, r);
    const [x1, z1] = ringAt(a0 + ((a1 - a0) * (i + 1)) / n, r);
    out.push([x0, z0, x1, z1, 0.4]);
  }
  return out;
}
const W = GATES.west;
const E = GATES.east;
export const STOCKADE = [...arc(E.a + E.gap, W.a - W.gap), ...arc(W.a + W.gap, E.a - E.gap + Math.PI * 2)];
// the banks: from each gatepost out along the road, past the rim
export const BANKS = [
  [W.posts[1][0] - 0.4, W.posts[1][1] - 0.3, -50, 0.6, 0.8],
  [W.posts[0][0] - 0.4, W.posts[0][1] + 0.3, -50, 6.8, 0.8],
  [E.posts[0][0] + 0.4, E.posts[0][1] - 0.3, 50, -11.2, 0.8],
  [E.posts[1][0] + 0.4, E.posts[1][1] + 0.3, 50, -4.1, 0.8],
];
export const WALLS = [...STOCKADE, ...BANKS];
// a shut gate is a wall across its gap
export const GATE_WALLS = Object.fromEntries(Object.entries(GATES).map(([k, g]) => [k, [[...g.posts[0], ...g.posts[1], 0.3]]]));

// ── the places to stop ──

export const START = { x: -42, z: 4.6, face: 0 };
// where you come out of the Pony, on to its forecourt
export const INN_DOOR = { x: 4, z: -1.2, face: -Math.PI / 2 };
export const SPOTS = [
  { id: 'gate', x: -36.8, z: 3.7, r: 2.6 },
  { id: 'pony', x: 4, z: -1.6, r: 1.9 },
  { id: 'east', x: 30.2, z: -3.2, r: 2.6 },
  { id: 'leave', x: 40, z: -5.6, r: 3.6 },
];
export const spot = (id) => SPOTS.find((s) => s.id === id);

// Who's about, by the time of day ('evening', 'night', 'dawn'), and what
// they say as you come by; their lines go round in turn.
export const CAST = [
  { id: 'harry', name: 'Harry the gatekeeper', x: -29.2, z: 0.7, face: -2.4, look: 'harry', when: ['evening', 'dawn'], lines: ['Mind how you go, young masters. There’s strange folk on the road tonight.', 'Hobbits, out of the Shire! Whatever next.', 'It’s my job to ask questions after nightfall. Can’t be too careful.'] },
  { id: 'sam', name: 'Samwise Gamgee', x: 7.4, z: -1.0, face: Math.PI, look: 'sam', when: ['evening'], lines: ['It’s raining cats and dogs, Mr. Frodo. Can we go in?', 'I don’t like the look of this place. Folk are all so big.', 'Mind, Mr. Frodo: Gandalf said to call yourself Underhill.'] },
  { id: 'merry', name: 'Merry Brandybuck', x: -0.6, z: -1.3, face: 0, look: 'merry', when: ['evening'], lines: ['The Prancing Pony! Best beer in Bree, they say.', 'Come on, Frodo. It’s warm in there.'] },
  { id: 'pippin', name: 'Pippin Took', x: 0.9, z: -0.6, face: Math.PI, look: 'pippin', when: ['evening'], lines: ['Do you think they do pints here?', 'Ooh, smell that. Somebody’s roasting something.'] },
  { id: 'carrot', name: 'A man with a carrot', x: 12.4, z: -0.9, face: Math.PI / 2 + 0.4, look: 'carrot', when: ['evening'], lines: ['(He takes a bite of his carrot, and watches you go by.)', '(Crunch.)', '(He offers you the carrot. Then thinks better of it.)'] },
  { id: 'breelander', name: 'A Bree-lander', x: -3.4, z: 9.4, face: Math.PI / 2, look: 'breelander', when: ['evening'], lines: ['Hobbits in Bree! We don’t see many Shire-folk this far out.', 'Butterbur keeps a good fire at the Pony. Best place on a night like this.'] },
  { id: 'ferny', name: 'Bill Ferny', x: -8.4, z: 23.2, face: 0, look: 'ferny', when: ['evening', 'dawn'], lines: ['What are you looking at?', 'Strider? He’s no friend of yours. Ask anyone in Bree.', 'Running off with that Ranger, are you? Good riddance.'] },
  // at dawn, at the East Gate, ready to go
  { id: 'strider', name: 'Strider', x: 31.4, z: -1.8, face: Math.PI, look: 'strider', when: ['dawn'], lines: ['Gentlemen, we do not stop till nightfall.', 'Weathertop is six days from here, by the wild ways.'] },
  { id: 'sam-dawn', name: 'Samwise Gamgee', x: 29.4, z: -4.5, face: Math.PI, look: 'sam', when: ['dawn'], lines: ['This is Bill. Bill the pony. Half-starved, poor thing, but he’ll carry our things.', 'I’ve packed some apples for him.'] },
  { id: 'pippin-dawn', name: 'Pippin Took', x: 27.6, z: -2.4, face: 0, look: 'pippin', when: ['dawn'], lines: ['What about breakfast?', 'We’ve had one, yes. What about second breakfast?'] },
];
export const castFor = (sky) => CAST.filter((c) => !c.when || c.when.includes(sky));
// where Bill the pony stands at dawn, by Sam
export const BILL = { x: 27.6, z: -4.7, face: 0 };
// Harry, behind his gate, before he opens it
export const HARRY_AT_HATCH = { x: -32.6, z: 3.3, face: Math.PI };
// Strider, at night, where he waits for you by the East Gate
export const STRIDER_NIGHT = { x: 31.2, z: -2.6, face: Math.PI };

// The Nazgûl's rounds through Bree at night: corners on open ground.
export const ROUNDS = [
  [[8, 1.6], [26, -2.4]],
  [[-8, -5], [-8, -27]],
  [[-12.2, 9], [-2.4, 10.2], [-5.4, 18.4]],
  [[23.6, -1.2], [30.6, -0.6], [30.8, -6.2]],
];

// A saved spot, if it's still a fair one for how far you've got: never
// inside anything, never outside the town before the gate's been opened,
// never out past the East Gate before dawn.
export function validAt(saved, done = []) {
  const has = (id) => done.includes(id);
  if (!saved || !Number.isFinite(saved.x) || !Number.isFinite(saved.z)) return has('gate') ? INN_DOOR : START;
  if (!has('gate')) return START;
  if (Math.hypot(saved.x, saved.z) > WORLD.radius - 0.5) return INN_DOOR;
  if (saved.x > TOWN.r && !has('slip')) return INN_DOOR;
  const [x, z] = pushOut(saved.x, saved.z, 0.4, COLLIDERS, WALLS);
  if (Math.hypot(x - saved.x, z - saved.z) > 0.05) return INN_DOOR;
  return { x: saved.x, z: saved.z, face: Number.isFinite(saved.face) ? saved.face : 0 };
}
