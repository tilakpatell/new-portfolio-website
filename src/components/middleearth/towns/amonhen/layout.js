// Amon Hen, the land: the lawn of Parth Galen on the western shore of Nen
// Hithoel with the camp and the boats drawn up; the woods rising west up
// the hill, the old kings' statues in a glade among them; the ruined
// stair, and the Seat of Seeing on the summit. No drawing (./scene.js
// draws it, ./AmonHenWorld.jsx drives it), so it can be tested on its own.
//
// The towns' conventions (../bree/layout.js): metres, +x east, +z south; a
// figure's `face` turns its +x to (cos face, -sin face).

import { fbm, makeNoise, smooth } from '../../../../lib/paint';
import { pushOut } from '../walker';

export const LAND = { west: -92, north: -56, south: 56 };
// the lake's edge, wandering a little; the water is east of it
export const shoreX = (z) => 46 + 3 * Math.sin(z * 0.05);
export const LAKE_Y = -1.2;
export const inLake = (x, z) => x > shoreX(z) - 0.5;

// the camp on the lawn, the boats drawn up, the summit and its Seat, the
// old stair up to it
export const CAMP = { x: 32, z: 4 };
export const BOATS = [
  { x: 43, z: -7, turn: 0.1 },
  { x: 43.5, z: 1.5, turn: -0.05 },
  { x: 43, z: 10, turn: 0.15 },
];
export const SEAT = { x: -74, z: -8, r: 4.8 };
export const STAIR = { x0: -50, x1: -64, z: -8, w: 2.6 };
export const GLADE = { x: -22, z: -1, r: 7 };
// the old kings in the woods: [kind, x, z, turn]
export const KINGS = [
  ['head', -25, 10, 0.6],
  ['seated', -32, -15, Math.PI / 2 - 0.3],
  ['standing', -12, -14, Math.PI / 2 + 0.4],
];
export const PILLARS = [
  [-17, 9, 0.6],
  [-29, 4, 1.4],
  [-40, -14, 2.2],
  [-58, 2, 0.3],
  [-66, -18, 1.9],
];

// the path, from the camp up to the summit: [x, z] points
export const PATH = [
  [CAMP.x + 2, CAMP.z - 2],
  [18, 1],
  [6, 4],
  [-8, 2],
  [-20, -2],
  [-34, -6],
  [-46, -8],
  [STAIR.x0, STAIR.z],
  [STAIR.x1, STAIR.z],
  [SEAT.x + SEAT.r + 1.4, SEAT.z],
];
export function toPath(x, z, path = PATH) {
  let best = Infinity;
  for (let i = 1; i < path.length; i++) {
    const [ax, az] = path[i - 1];
    const [bx, bz] = path[i];
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

const noise = makeNoise(71);
// the hill, without its bumps: rising west from the lawn to the summit
const hill = (x) => 30 * smooth(16, -70, x);
// The ground: the lawn by the lake, the hill rising west under the woods,
// the summit flat round the Seat, and the shore dropping into the water.
export function height(x, z) {
  let h = hill(x);
  // bumps, less on the path and the lawn
  const bump = (fbm(noise, x * 0.045, z * 0.045, { octaves: 3 }) - 0.5) * 3.2;
  h += bump * smooth(1.5, 6, toPath(x, z)) * smooth(22, 8, x);
  // the summit, flat round the Seat
  const d = Math.hypot(x - SEAT.x, z - SEAT.z);
  const top = hill(SEAT.x);
  h += (top - h) * (1 - smooth(SEAT.r + 2, SEAT.r + 9, d));
  // into the lake
  h -= smooth(shoreX(z) - 3, shoreX(z) + 3, x) * 2.6;
  return h;
}

// Firewood at the edge of the trees: [x, z]
export const STICKS = [
  [14, -16],
  [11, -6.5],
  [16, 9],
  [9.5, 18],
  [13, 26],
];

// The woods: pines and beeches, a scatter, kept off the path, the lawn, the
// glade and the summit. [x, z, kind (0 pine, 1 beech), seed]
const seeded = (seed) => {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
};
export const TREES = (() => {
  const rand = seeded(97);
  const out = [];
  for (let n = 0; n < 3000 && out.length < 120; n++) {
    const x = LAND.west + 2 + rand() * (20 - LAND.west);
    const z = LAND.north + 2 + rand() * (LAND.south - LAND.north - 4);
    if (toPath(x, z) < 4) continue;
    if (Math.hypot(x - GLADE.x, z - GLADE.z) < GLADE.r + 1) continue;
    if (Math.hypot(x - SEAT.x, z - SEAT.z) < SEAT.r + 5) continue;
    if (KINGS.some(([, kx, kz]) => Math.hypot(x - kx, z - kz) < 6)) continue;
    if (STICKS.some(([sx, sz]) => Math.hypot(x - sx, z - sz) < 2.5)) continue;
    if (out.some(([ox, oz]) => Math.hypot(x - ox, z - oz) < 5.2)) continue;
    out.push([x, z, rand() < 0.6 ? 0 : 1, Math.floor(rand() * 1000)]);
  }
  return out;
})();

// On the side: where you skip stones with Merry and Pippin, on the shore
// south of the boats, facing out over the lake (east), and where the two
// of them stand to watch
export const SKIPPING = { x: shoreX(20) - 1.6, z: 20, face: 0 };
export const SKIPPERS = [
  { look: 'pippin', x: SKIPPING.x - 0.6, z: SKIPPING.z + 1.7, face: 0.4 },
  { look: 'merry', x: SKIPPING.x - 1.7, z: SKIPPING.z + 2.6, face: 0.3 },
];

// Merry and Pippin, hiding behind a tree when the Uruk-hai come; the
// boats' spot on the shore
export const DECOY = { x: -4, z: 15, r: 9 };
export const SHORE_SPOT = { x: 41, z: -3 };

const circle = (id, x, z, r, o = {}) => ({ id, kind: 'circle', x, z, r, ...o });
const box = (id, b, o = {}) => ({ id, kind: 'box', x: b.x, z: b.z, w: b.w, d: b.d, turn: b.turn || 0, ...o });

export const COLLIDERS = [
  ...TREES.map(([x, z, kind], i) => circle(`tree${i}`, x, z, kind ? 0.55 : 0.4, { top: 20 })),
  ...KINGS.map(([kind, x, z], i) => circle(`king${i}`, x, z, kind === 'head' ? 2.2 : 1.8, { top: kind === 'head' ? 4 : 8 })),
  ...PILLARS.map(([x, z], i) => circle(`pillar${i}`, x, z, 0.5, { top: 2 })),
  circle('seat', SEAT.x, SEAT.z, SEAT.r, { low: true, top: 1 }),
  circle('fire', CAMP.x, CAMP.z, 1.1, { low: true, top: 0.4 }),
  ...BOATS.map((b, i) => box(`boat${i}`, { x: b.x, z: b.z, w: 6, d: 1.2, turn: b.turn }, { low: true, top: 0.8 })),
];
// the edges: the steep hill past the summit, and the woods thick north and
// south (the lake is handled by `inLake`)
export const WALLS = [
  [LAND.west, LAND.north, LAND.west, LAND.south, 0.4],
  [LAND.west, LAND.north, 60, LAND.north, 0.4],
  [LAND.west, LAND.south, 60, LAND.south, 0.4],
  // the stair's low side walls
  [STAIR.x0, STAIR.z - STAIR.w / 2 - 0.2, STAIR.x1, STAIR.z - STAIR.w / 2 - 0.2, 0.25],
  [STAIR.x0, STAIR.z + STAIR.w / 2 + 0.2, STAIR.x1, STAIR.z + STAIR.w / 2 + 0.2, 0.25],
];

// Where things start
export const START = { x: 36, z: 1, face: Math.PI };
export const RUN_START = { x: STAIR.x0 + 2, z: STAIR.z, face: 0 };

// Places to do things: the quest each is for
export const SPOTS = [
  { id: 'seat', x: SEAT.x + SEAT.r + 1.6, z: SEAT.z, r: 2.6, quest: 'seat' },
  { id: 'boats', x: SHORE_SPOT.x, z: SHORE_SPOT.z, r: 3, quest: 'promise' },
];

// The Uruk-hai's rounds through the woods, for the run down to the shore
export const URUK_ROUNDS = [
  [
    [-36, -20],
    [-30, 6],
    [-40, 14],
  ],
  [
    [-18, 18],
    [-10, -8],
    [-24, -18],
  ],
  [
    [-2, -20],
    [4, 10],
  ],
  [
    [8, 24],
    [-6, 30],
    [-14, 8],
  ],
  [
    [12, -28],
    [2, -6],
    [14, 4],
  ],
];
// and where they run off to, after Merry and Pippin
export const DECOY_RUN = { x: -20, z: 50 };

// Who's about, by what's next (`while`). `look` is who they're drawn as.
export const CAST = [
  { id: 'aragorn-camp', name: 'Aragorn', look: 'aragorn', x: 35, z: -1.5, face: Math.PI, while: ['camp'], lines: ['“We cross the lake at nightfall. Hide the boats and continue on foot. We approach Mordor from the north.”', '“Gather wood, Frodo. We won’t light it till dark.”'] },
  { id: 'gimli-camp', name: 'Gimli', look: 'gimli', x: 28.5, z: 7.5, face: 0.4, while: ['camp'], lines: ['“Oh, yes? Just a simple matter of finding our way through Emyn Muil. An impassable labyrinth of razor-sharp rocks. And after that, it gets even better: festering, stinking marshland as far as the eye can see.”', '“Recover my strength? Pay no heed to that, young hobbit.”'] },
  { id: 'legolas-camp', name: 'Legolas', look: 'legolas', x: 30, z: -4, face: Math.PI / 2, while: ['camp'], lines: ['He stares into the trees. “We should leave now.” “No.” “Orcs patrol the eastern shore. A shadow and a threat has been growing in my mind. Something draws near. I can feel it.”'] },
  { id: 'boromir-camp', name: 'Boromir', look: 'boromir', x: 37, z: 8.5, face: Math.PI * 0.85, while: ['camp'], lines: ['He is watching you, and he looks away.', '“Minas Tirith is the safer road. You know that.”'] },
  { id: 'merry-camp', name: 'Merry Brandybuck', look: 'merry', x: 31, z: 10.5, face: Math.PI / 2, while: ['camp'], lines: ['“Pippin, are you sure you’ve had enough? You’ve only had… four meals today.”'] },
  { id: 'pippin-camp', name: 'Pippin Took', look: 'pippin', x: 32.4, z: 11, face: Math.PI / 2, while: ['camp'], lines: ['“What about second breakfast?”'] },
  { id: 'sam-camp', name: 'Samwise Gamgee', look: 'sam', x: 33.5, z: 7, face: Math.PI, while: ['camp'], lines: ['He is setting out the pans. “Mr. Frodo, you need to eat something.”'] },
  { id: 'merry-decoy', name: 'Merry Brandybuck', look: 'merry', x: DECOY.x - 1.2, z: DECOY.z, face: Math.PI / 2, while: ['run'], lines: ['“Frodo! Hide here, quick! Come on!”'] },
  { id: 'pippin-decoy', name: 'Pippin Took', look: 'pippin', x: DECOY.x + 0.6, z: DECOY.z + 0.8, face: Math.PI / 2, while: ['run'], lines: ['“He’s leaving.” “Run, Frodo! Go!”'] },
];
export const castFor = (next) => CAST.filter((c) => !c.while || c.while.includes(next));

// A saved spot, if it's a fair one.
export function validAt(saved) {
  const back = { ...START };
  if (!saved || !Number.isFinite(saved.x) || !Number.isFinite(saved.z)) return back;
  if (saved.x < LAND.west + 1 || saved.z < LAND.north + 1 || saved.z > LAND.south - 1 || inLake(saved.x, saved.z)) return back;
  const [x, z] = pushOut(saved.x, saved.z, 0.4, COLLIDERS, WALLS);
  if (Math.hypot(x - saved.x, z - saved.z) > 0.05) return back;
  return { x: saved.x, z: saved.z, face: Number.isFinite(saved.face) ? saved.face : 0 };
}
