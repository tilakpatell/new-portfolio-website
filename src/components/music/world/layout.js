// The music planet's courtyard, as data: what stands where, what can't be
// walked through, where each instrument is and how near you must be to play
// it, and the first-person walking. Nothing here draws (./scene.js does);
// tested in layout.test.js.
//
// Metres, y up. Looking at yaw 0 is looking north, along -z. You arrive at
// the south end of a sandstone terrace; ahead is a stepped pool, then a
// rug where the instruments lie, a chhatri behind them, and past the parapet
// the planet's dunes under its rings.

import { makeWalker } from '../../middleearth/towns/walker';

export const TERRACE = { half: 16, height: 0.45 }; // the paving, and how far it stands above the dunes
export const PARAPET = { inset: 0.35, height: 0.85, thick: 0.4 }; // its low wall
export const EYE = 1.62; // a standing visitor's eyes, above the paving

// what each model is made to (scripts/meshy-music.mjs sizes them) and where it goes
export const PAVILION = { x: 0, z: -10.6, size: 8, turn: 0 };
export const POOL = { x: 0, z: 3.2, half: 3.1, depth: 0.9 };
export const RUG = { x: 0, z: -4.9, w: 5.4, d: 3.8 };
export const GADDI = { x: 0, z: -5.75, size: 2.6, turn: 0 };
export const LAMPS = [
  { x: -3.5, z: -4.6 },
  { x: 3.5, z: -4.6 },
];

// The instruments: where each lies (x, z, and its turn), how big, how near you
// must be to play it, and where you stand to play it (facing it).
export const INSTRUMENTS = {
  sitar: { name: 'Sitar', x: -0.15, z: -5.3, y: 0.2, size: 1.22, turn: 0.18, reach: 2.1 },
  tanpura: { name: 'Tanpura', x: -2.05, z: -5.95, y: 0, size: 1.4, turn: 0.35, reach: 2.1, lean: 0.12 },
  harmonium: { name: 'Harmonium', x: -1.35, z: -4.15, y: 0, size: 0.62, turn: -0.12, reach: 1.9 },
  tabla: { name: 'Tabla', x: 1.55, z: -4.25, y: 0, size: 0.62, turn: 0.22, reach: 1.9 },
};
export const INSTRUMENT_IDS = Object.keys(INSTRUMENTS);

// Where to stand to play an instrument: `away` metres south of it (towards
// the pool, where you come from), looking straight at it.
export function standFor(id, away = 1.25) {
  const i = INSTRUMENTS[id];
  return { x: i.x, z: i.z + away, yaw: 0 };
}

export const START = { x: 0, z: 12.5, yaw: 0 };

// ── What can't be walked through ───────────────────────────────────────────
const H = TERRACE.half - PARAPET.inset;
export const WALLS = [
  [-H, -H, H, -H, PARAPET.thick / 2],
  [H, -H, H, H, PARAPET.thick / 2],
  [H, H, -H, H, PARAPET.thick / 2],
  [-H, H, -H, -H, PARAPET.thick / 2],
];
export const COLLIDERS = [
  { kind: 'box', x: PAVILION.x, z: PAVILION.z, w: PAVILION.size + 0.4, d: PAVILION.size + 0.4 },
  { kind: 'box', x: POOL.x, z: POOL.z, w: POOL.half * 2 + 0.3, d: POOL.half * 2 + 0.3, low: true },
  { kind: 'box', x: GADDI.x, z: GADDI.z, w: GADDI.size + 0.1, d: 1.3, low: true },
  { kind: 'circle', x: INSTRUMENTS.tanpura.x, z: INSTRUMENTS.tanpura.z, r: 0.32 },
  { kind: 'box', x: INSTRUMENTS.harmonium.x, z: INSTRUMENTS.harmonium.z, w: 0.7, d: 0.55, turn: INSTRUMENTS.harmonium.turn, low: true },
  { kind: 'box', x: INSTRUMENTS.tabla.x, z: INSTRUMENTS.tabla.z, w: 0.7, d: 0.45, turn: INSTRUMENTS.tabla.turn, low: true },
  ...LAMPS.map((l) => ({ kind: 'circle', x: l.x, z: l.z, r: 0.28 })),
];

// a visitor: a little slimmer than a hobbit's stride is long
export const BODY = { radius: 0.32, walk: 2.6, run: 4.6, accel: 14, turn: 10 };
export const walker = makeWalker({ radius: TERRACE.half * 1.5, colliders: COLLIDERS, walls: WALLS, body: BODY });

// ── Looking and moving ─────────────────────────────────────────────────────
export const PITCH = { min: -1.1, max: 0.6 };
export const forwardOf = (yaw) => ({ x: -Math.sin(yaw), z: -Math.cos(yaw) });

// From the keys held, the way to walk in the world: forward and back along
// where you look, A and D to the side; up to length 1.
export function moveFor(held, yaw) {
  const f = (held.has('up') ? 1 : 0) - (held.has('down') ? 1 : 0);
  const s = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
  return stickMove(s, f, yaw, held.has('run'));
}

// A stick (or keys) as `side` and `fwd`, each -1 to 1, turned to the world.
export function stickMove(side, fwd, yaw, run = false) {
  const fw = forwardOf(yaw);
  // to the right of where you look
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  let x = fw.x * fwd + rx * side;
  let z = fw.z * fwd + rz * side;
  const len = Math.hypot(x, z);
  if (len > 1) {
    x /= len;
    z /= len;
  }
  return { x, z, run };
}

// ── Which instrument ───────────────────────────────────────────────────────
// The instrument you're near and looking towards, or the nearest one if
// you're right beside it whichever way you look; null if none is in reach.
export function nearInstrument(x, z, yaw) {
  const fw = forwardOf(yaw);
  let best = null;
  let score = Infinity;
  for (const id of INSTRUMENT_IDS) {
    const i = INSTRUMENTS[id];
    const dx = i.x - x;
    const dz = i.z - z;
    const d = Math.hypot(dx, dz);
    if (d > i.reach) continue;
    const facing = d < 1e-6 ? 1 : (dx * fw.x + dz * fw.z) / d; // cosine of the angle off where you look
    if (facing < 0.45 && d > 1.1) continue; // more than about 63° off, and not right beside it
    const s = d * (1.6 - facing);
    if (s < score) {
      score = s;
      best = id;
    }
  }
  return best;
}
