// The Avengers compound, the world: the compound's plan (../compound/plan.js)
// at walking scale, for Spider-Man to walk about. What's here: the
// buildings he can't walk through and the lawn he can't leave, the doors into
// the seven games, the portal the Space Stone opens, who's about and what
// they say, and how far the stone heist has got. Plain numbers, tested
// (rules.test.js); the drawing is in ./scene.js.
//
// The world is in metres: x east, z south (the plan's y), y up.

import { BERM, CRES, CRES_FOOT, GATE, HANGAR, LAB, LAWN, PROW, RIVER, ROADS, STALLS, TRAINING, TREES, arcPt, inPoly } from '../compound/plan';

// A plan unit is about four metres from the air; on foot the compound is
// drawn smaller across the ground, so a walk between buildings takes seconds,
// and a little taller than that, so a floor is still a floor.
export const S = 1.6; // metres to a plan unit, along the ground
export const V = 2.4; // metres to a plan unit, upwards
export const toWorld = ([x, y]) => [x * S, y * S];
const footOf = (foot) => foot.map(toWorld);

// A path in the plan's SVG syntax (M, L, C only) as points, every `step`
// units (the drives).
export function samplePath(d, step = 1) {
  const tok = d.match(/[MLC]|-?\d*\.?\d+/g);
  const out = [];
  let i = 0;
  let cur = [0, 0];
  let cmd = 'M';
  const num = () => Number(tok[i++]);
  while (i < tok.length) {
    if (/[MLC]/.test(tok[i])) cmd = tok[i++];
    if (cmd === 'M') {
      cur = [num(), num()];
      out.push(cur);
      cmd = 'L';
    } else if (cmd === 'L') {
      const b = [num(), num()];
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - cur[0], b[1] - cur[1]) / step));
      for (let k = 1; k <= n; k++) out.push([cur[0] + ((b[0] - cur[0]) * k) / n, cur[1] + ((b[1] - cur[1]) * k) / n]);
      cur = b;
    } else {
      const c1 = [num(), num()];
      const c2 = [num(), num()];
      const b = [num(), num()];
      const n = Math.max(2, Math.ceil(Math.hypot(b[0] - cur[0], b[1] - cur[1]) / step) * 2);
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        const s = 1 - t;
        out.push([s * s * s * cur[0] + 3 * s * s * t * c1[0] + 3 * s * t * t * c2[0] + t * t * t * b[0], s * s * s * cur[1] + 3 * s * s * t * c1[1] + 3 * s * t * t * c2[1] + t * t * t * b[1]]);
      }
      cur = b;
    }
  }
  return out;
}

// ── the ground ──

export const LAWN_W = footOf(LAWN);
export const RIVER_W = footOf(RIVER);
export const ROADS_W = ROADS.map((d) => samplePath(d, 0.8).map(toWorld));
export const ROAD_HALF = (3.7 * S) / 2;
const EDGE = 1.4; // how near the edge of the lawn you can walk
export const HERO_R = 0.45; // how round he is, for bumping into things

// ── the buildings: footprints (metres) and roof heights ──

const bounds = (foot) => {
  const xs = foot.map((p) => p[0]);
  const zs = foot.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
};
const building = (id, foot, h) => {
  const f = footOf(foot);
  return { id, foot: f, h, box: bounds(f) };
};
export const BUILDINGS = [
  building('hangar', HANGAR, 9.35 * V),
  building('prow', PROW, 13.4 * V),
  building('wing', CRES_FOOT, (CRES.h + 1.7) * V),
  building('training', TRAINING, 8.4 * V),
  building('lab', LAB, 7.2 * V),
  building('gate', GATE, 3.2 * V),
  building('berm', BERM, 2.2 * V),
  building('stalls', STALLS, 3 * V),
  // the bridge from the hangar to the main building is overhead: only its pier stands on the lawn
  building('pier', [[36.6, 25.6], [37.6, 25.6], [37.6, 26.6], [36.6, 26.6]], 4.6 * V),
];
// the bridge itself, for the drawing and the camera: overhead from 4.6 to 7 units
export const BRIDGE_SPAN = { y0: 4.6 * V, y1: 7 * V };

// ── things on the lawn: the parked Quinjet, the cars, the trees down the drives ──

// the Quinjet parked on the landing pad, nose along `yaw` (the drawing's 1.15 scale)
export const PARKED_JET = { x: 12 * S, z: 80 * S, yaw: Math.PI + (22 * Math.PI) / 180, scale: 0.75 };
// cars in the car park by the gate: [x, z, yaw, kind, colour]
export const PARKED_CARS = [
  [52.8, 99, Math.PI, 'sedan', 0xc0392b],
  [57.2, 99, Math.PI, 'suv', 0xf2f2f2],
  [63.7, 99, 0, 'sedan', 0x22304a],
  [65.9, 103.3, 0, 'sedan', 0x8a949e],
  [53.9, 103.3, Math.PI, 'suv', 0xf2f2f2],
  [60.4, 103.3, 0, 'sedan', 0x1e2a44],
].map(([x, y, yaw, kind, color]) => ({ x: x * S, z: y * S, yaw, kind, color }));
// the trees that stand on the lawn (the rest are the woods round it)
export const LAWN_TREES = TREES.filter((t) => inPoly(t.x, t.y, LAWN)).map((t) => ({ x: t.x * S, z: t.y * S, r: t.r * S, tone: t.tone }));

// Round things the hero bumps into: { x, z, r }.
const jetBody = () => {
  const out = [];
  const s = PARKED_JET.scale;
  // along the fuselage, nose (+) to tail (−), in the jet's own metres
  for (const along of [12, 6, 0, -6, -12]) out.push({ x: PARKED_JET.x + Math.sin(PARKED_JET.yaw) * along * s, z: PARKED_JET.z + Math.cos(PARKED_JET.yaw) * along * s, r: 2.6 * s + 0.4 });
  return out;
};
const carBody = (c) => [-1.25, 1.25].map((along) => ({ x: c.x + Math.sin(c.yaw) * along, z: c.z + Math.cos(c.yaw) * along, r: c.kind === 'suv' ? 1.15 : 1.05 }));

// ── the doors into the games ──

// The middle of edge i of a footprint (plan units), `out` units outside it:
// where its door is, and the way out (nx, ny).
function doorOf(foot, i, out) {
  const a = foot[i];
  const b = foot[(i + 1) % foot.length];
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  let nx = (b[1] - a[1]) / l;
  let ny = -(b[0] - a[0]) / l;
  // the outside is away from the footprint's middle
  const cx = foot.reduce((s, p) => s + p[0], 0) / foot.length;
  const cy = foot.reduce((s, p) => s + p[1], 0) / foot.length;
  if ((mx - cx) * nx + (my - cy) * ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  return { x: (mx + nx * out) * S, z: (my + ny * out) * S, nx, ny };
}
// the facing (as the hero's `face`) that looks along plan direction (nx, ny)
const faceOf = (nx, ny) => Math.atan2(-ny, nx);
const at = (d) => ({ x: d.x, z: d.z, face: faceOf(d.nx, d.ny) });

const STARK = (() => {
  const a = (53 * Math.PI) / 180;
  const [x, y] = arcPt(CRES.rOut + 1.4, a);
  return { x: x * S, z: y * S, face: faceOf(Math.cos(a), Math.sin(a)) };
})();
const CRATER = { x: 45 * S, z: 58 * S, r: 2.6 };
// an Iron Man armour on a plinth beside the workshop's door, facing out
const ARMOUR = (() => {
  const ox = Math.cos(STARK.face);
  const oz = -Math.sin(STARK.face);
  return { x: STARK.x - ox * 0.6 + oz * 4, z: STARK.z - oz * 0.6 - ox * 4, face: STARK.face, r: 0.75 };
})();

// The doors, in the order of the tour: the seven buildings with a stone to
// win, and Spider-Man at the front gate, who has a game but no stone.
// `stone` is what winning there earns (Clint's and Natasha's halves of the
// Soul Stone are a stone between them); `face` is the way out of the door, which the hero faces as he leaves;
// `accent` is the game's own colour and `sign` what's over its door.
export const PLACES = [
  {
    id: 'stark',
    accent: '#8fe9ff',
    sign: 'Workshop',
    name: 'Tony Stark’s workshop',
    where: 'Main building · the glass wing',
    act: 'Suit up',
    stone: 'power',
    hint: 'Ultron’s drones are coming over the trees. Suit up at Tony’s workshop, in the glass wing.',
    blurb: 'Where the suits get built and tested. Out back is the test field, and Ultron’s drones are coming over the trees.',
    ...STARK,
  },
  {
    id: 'thor',
    accent: '#bfe0ff',
    sign: null,
    name: 'Mjolnir',
    where: 'The lawn, out front',
    act: 'Lift it',
    stone: 'reality',
    hint: 'Mjolnir is in its crater on the lawn. Lift it: the Chitauri are coming across the grass.',
    blurb: 'Mjolnir waits in a crater on the lawn, for someone worthy. Lift it, because the Chitauri are coming across the lawn in the rain.',
    x: CRATER.x + 2.4,
    z: CRATER.z + 1.4,
    face: faceOf(1, 0.5),
  },
  {
    id: 'cap',
    accent: '#ff6b5e',
    sign: 'Training',
    name: 'The training center',
    where: 'The training center',
    act: 'Train',
    stone: 'mind',
    hint: 'Twelve rooms of training bots, and a shield that bounces off steel. The training center, past the track.',
    blurb: 'Twelve rooms of training bots, and a shield that bounces off steel. It always comes back.',
    ...at(doorOf(TRAINING, 2, 1.6)),
  },
  {
    id: 'hawkeye',
    accent: '#c9a2ff',
    sign: 'Range',
    name: 'The range',
    where: 'Past the hangar',
    act: 'Pick up the bow',
    stone: 'soul-clint',
    hint: 'Clint’s range, past the hangar: boards out to sixty metres, clays, and trick arrows.',
    blurb: 'A clearing past the hangar, where Clint keeps his eye in: boards out to sixty metres, clays from the traps, and trick arrows for anyone who strings three together.',
    ...at(doorOf(STALLS, 1, 1.4)),
  },
  {
    id: 'widow',
    accent: '#ff4b3e',
    sign: 'Operations',
    name: 'Operations',
    where: 'Main building · the front door',
    act: 'Go in',
    stone: 'soul-natasha',
    hint: 'Natasha’s at the main door. A HYDRA facility is up on the holotable, eight levels deep.',
    blurb: 'Natasha ran the compound from this room for five years. On the holotable: a HYDRA facility, eight levels deep, and her file at the bottom of it. Every move she makes, the guards make one too.',
    ...at(doorOf(PROW, 2, 1.5)),
  },
  {
    id: 'banner',
    accent: '#7dff6a',
    sign: 'Laboratory',
    name: 'Bruce Banner’s lab',
    where: 'The lab',
    act: 'Go in',
    stone: 'time',
    hint: 'Bruce’s lab, down the east drive. It’s 2012 in there, and Midtown is full of Chitauri.',
    blurb: 'Gamma research, and a scientist who would rather you didn’t push him. Push him anyway: it’s 2012, the portal is open over Stark Tower, and Midtown is full of Chitauri.',
    ...at(doorOf(LAB, 0, 1.6)),
  },
  {
    id: 'spidey',
    accent: '#ff5a4f',
    sign: null,
    name: 'The front gate',
    where: 'Spider-Man · the gatehouse',
    act: 'Swing to school',
    stone: null,
    hint: 'Peter’s at the front gate, late for school, two kilometres away.',
    blurb: 'Happy dropped the kid off here. Inside, Tony had a new suit and a room full of reporters waiting; Peter turned both down and went back to Queens. Now he’s late for school, two kilometres away, and the quickest way there is between the buildings.',
    ...at(doorOf(GATE, 0, 1.6)),
  },
  {
    id: 'vault',
    accent: '#6cc8ff',
    sign: 'Hangar 1',
    name: 'The hangar',
    where: 'The hangar · the Tesseract',
    act: 'Go in',
    stone: 'space',
    hint: 'The Tesseract is in the hangar. Fly it home, slung under a Quinjet, and set it down gently.',
    blurb: 'The Quinjets live here, and so did the quantum tunnel for the time heist. The Tesseract has to come home to it, slung in its case under a Quinjet, through the hangar doors in a storm.',
    ...at(doorOf(HANGAR, 2, 1.5)),
  },
];
export const placeById = (id) => PLACES.find((p) => p.id === id) ?? null;
export const DOOR_R = 3.4; // how near a door you have to be to go in
export { ARMOUR, CRATER };

// The portal the Space Stone opens, over the helipad: walk under it to Titan.
export const PORTAL = { x: 70 * S, z: 52 * S, r: 6, y: 24 };

// Where you start: on the main drive, looking up it at the main building.
export const START = { x: 60.5 * S, z: 74 * S, face: Math.PI / 2 };

// ── who's about ──

// Lines go round in turn; `after` are a hero's lines once his game is won.
export const CAST = [
  {
    id: 'thor',
    name: 'Thor',
    style: 'thor',
    x: CRATER.x - 3.2,
    z: CRATER.z - 1.6,
    face: faceOf(0.6, 1),
    lines: ['Whosoever holds this hammer, if they be worthy, shall possess the power of Thor.', 'Go on, Spider-Man. Give it a pull. Nobody’s judging. Much.', 'The Chitauri are coming. I can feel it in the air.'],
    after: { place: 'thor', lines: ['I knew it!', 'Worthy! I knew there was something about you, spider.'] },
  },
  {
    id: 'natasha',
    name: 'Natasha Romanoff',
    style: 'widow',
    x: PROW[2][0] * S - 4.5,
    z: PROW[2][1] * S + 3.2,
    face: faceOf(-0.4, 1),
    lines: ['The file’s on the holotable. HYDRA, eight levels down.', 'I’ve got red in my ledger. I’d like to wipe it out.', 'Clint’s at the range, if you want the other half of that stone. Try to keep up, kid.'],
    after: { place: 'widow', lines: ['Clean. Not one guard saw me.', 'Ledger’s a little lighter today.'] },
  },
  {
    id: 'hulk',
    name: 'Hulk',
    style: 'hulk',
    x: LAB[0][0] * S + 6,
    z: LAB[0][1] * S - 5,
    face: faceOf(0.2, -1),
    lines: ['That’s my secret, kid. I’m always angry.', 'Hulk smash!', 'Puny god.'],
    after: { place: 'banner', lines: ['Hulk smash!', 'Midtown is safe. Mostly.'] },
    r: 0.9,
  },
  {
    id: 'bot',
    name: 'Training bot',
    style: 'bot',
    x: TRAINING[3][0] * S + 12,
    z: TRAINING[3][1] * S + 4.5,
    face: faceOf(0, 1),
    lines: ['Training sequence ready, Spider-Man.', 'Twelve rooms. One shield.', 'Please do not throw the shield at me.'],
    after: { place: 'cap', lines: ['Sequence complete. All units… dented.'] },
  },
];
export const linesFor = (c, done) => (c.after && done.includes(c.after.place) ? c.after.lines : c.lines);
export function nearCast(x, z, r = 3.4) {
  let best = null;
  for (const c of CAST) {
    const d = Math.hypot(x - c.x, z - c.z);
    if (d < r && (!best || d < best.d)) best = { ...c, d };
  }
  return best;
}

// ── bumping into things ──

// Everything round the hero bumps into, besides the buildings.
export const ROUND = [...jetBody(), ...PARKED_CARS.flatMap(carBody), ...LAWN_TREES.map((t) => ({ x: t.x, z: t.z, r: 0.45 })), { x: CRATER.x, z: CRATER.z, r: 0.5 }, { x: ARMOUR.x, z: ARMOUR.z, r: ARMOUR.r }, ...CAST.map((c) => ({ x: c.x, z: c.z, r: c.r ?? 0.5 }))];

// The nearest point on a polygon's edge to (x, z), and how far it is.
export function nearestEdge(x, z, foot) {
  let best = { x, z, d: Infinity };
  for (let i = 0; i < foot.length; i++) {
    const [ax, az] = foot[i];
    const [bx, bz] = foot[(i + 1) % foot.length];
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    const px = ax + t * dx;
    const pz = az + t * dz;
    const d = Math.hypot(x - px, z - pz);
    if (d < best.d) best = { x: px, z: pz, d, nx: -dz, nz: dx };
  }
  return best;
}

// Out of a footprint, or `rad` clear of it, by the nearest edge.
function outOf(x, z, foot, rad) {
  const inside = inPoly(x, z, foot);
  const e = nearestEdge(x, z, foot);
  if (!inside && e.d >= rad) return [x, z];
  let ux;
  let uz;
  if (e.d > 1e-6) {
    ux = (x - e.x) / e.d;
    uz = (z - e.z) / e.d;
    if (inside) {
      ux = -ux;
      uz = -uz;
    }
  } else {
    // on the edge: out along its normal, whichever way leaves
    const l = Math.hypot(e.nx, e.nz) || 1;
    ux = e.nx / l;
    uz = e.nz / l;
    if (inPoly(e.x + ux * 0.01, e.z + uz * 0.01, foot)) {
      ux = -ux;
      uz = -uz;
    }
  }
  return [e.x + ux * rad, e.z + uz * rad];
}

// Back inside the lawn, `rad` from its edge.
function onLawn(x, z, rad) {
  const inside = inPoly(x, z, LAWN_W);
  const e = nearestEdge(x, z, LAWN_W);
  if (inside && e.d >= rad) return [x, z];
  let ux;
  let uz;
  if (e.d > 1e-6) {
    // from the edge towards the middle of the lawn
    ux = (x - e.x) / e.d;
    uz = (z - e.z) / e.d;
    if (!inside) {
      ux = -ux;
      uz = -uz;
    }
  } else {
    const l = Math.hypot(e.nx, e.nz) || 1;
    ux = e.nx / l;
    uz = e.nz / l;
    if (!inPoly(e.x + ux * 0.01, e.z + uz * 0.01, LAWN_W)) {
      ux = -ux;
      uz = -uz;
    }
  }
  return [e.x + ux * rad, e.z + uz * rad];
}

// Where (x, z) ends up for something `rad` round: out of the buildings and the
// things on the lawn, and on the lawn.
export function collide(x, z, rad) {
  for (let pass = 0; pass < 2; pass++) {
    for (const b of BUILDINGS) {
      const [x0, z0, x1, z1] = b.box;
      if (x < x0 - rad || x > x1 + rad || z < z0 - rad || z > z1 + rad) continue;
      [x, z] = outOf(x, z, b.foot, rad);
    }
    for (const c of ROUND) {
      const dx = x - c.x;
      const dz = z - c.z;
      const d = Math.hypot(dx, dz);
      const min = c.r + rad;
      if (d < min) {
        if (d > 1e-6) {
          x = c.x + (dx / d) * min;
          z = c.z + (dz / d) * min;
        } else x = c.x + min;
      }
    }
    [x, z] = onLawn(x, z, Math.max(rad, EDGE));
  }
  return [x, z];
}

// Whether (x, z) is somewhere you can stand: on the lawn and in nothing.
export function walkable(x, z, rad = HERO_R) {
  const [cx, cz] = collide(x, z, rad);
  return Math.hypot(cx - x, cz - z) < 1e-6;
}

// ── walking ──

// metres a second, and how fast he gets there: a brisk walk, a run like a
// super-hero's, and a spider's jump (about a metre and three quarters)
export const HERO = { walk: 2.8, run: 9.5, accel: 15, turn: 11, jump: 8.4, gravity: 21, air: 0.35 };
export const newHero = (at = START) => ({ x: at.x, z: at.z, y: 0, vy: 0, face: at.face ?? 0, vx: 0, vz: 0, speed: 0, running: false, air: false });

// One step. `move` is where the visitor wants to go, already turned to the
// world (the camera does that, cameraMove): { x, z } up to length 1, `run`,
// and `jump` (a press, not a hold).
export function stepHero(h, { x: mx = 0, z: mz = 0, run = false, jump = false } = {}, dt) {
  const len = Math.hypot(mx, mz);
  const k = len > 1 ? 1 / len : 1;
  const top = run ? HERO.run : HERO.walk;
  const tx = mx * k * top;
  const tz = mz * k * top;
  const grip = (h.air ? HERO.air : 1) * Math.min(1, ((HERO.accel * dt) / Math.max(1, top)) * 2.2);
  let vx = h.vx + (tx - h.vx) * grip;
  let vz = h.vz + (tz - h.vz) * grip;
  if (len < 0.05 && Math.hypot(vx, vz) < 0.05) {
    vx = 0;
    vz = 0;
  }
  // up and down: a jump off the ground, gravity back to it
  let vy = h.vy;
  let y = h.y;
  if (jump && y <= 0 && vy <= 0) vy = HERO.jump;
  vy -= HERO.gravity * dt;
  y += vy * dt;
  if (y <= 0) {
    y = 0;
    vy = 0;
  }
  let [x, z] = collide(h.x + vx * dt, h.z + vz * dt, HERO_R);
  const moved = Math.hypot(x - h.x, z - h.z) / Math.max(dt, 1e-6);
  let face = h.face;
  if (len > 0.05) {
    const want = Math.atan2(-mz, mx);
    let d = want - face;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    face += d * Math.min(1, HERO.turn * dt);
  }
  return { x, z, y, vy, face, vx: (x - h.x) / Math.max(dt, 1e-6), vz: (z - h.z) / Math.max(dt, 1e-6), speed: moved, running: run && moved > HERO.walk + 0.5, air: y > 0 };
}

// The walking keys and the stick, turned by the camera's yaw into the world.
export function cameraMove(yaw, forward, right) {
  return { x: -Math.sin(yaw) * forward + Math.cos(yaw) * right, z: -Math.cos(yaw) * forward - Math.sin(yaw) * right };
}
// the yaw that puts the camera behind a hero facing `face`
export const behindYaw = (face) => Math.atan2(-Math.cos(face), Math.sin(face));

// How far from the hero (lx, lz) out to the camera (cx, cy, cz) it can be
// before it's in a building, under the bridge's deck or out in the woods:
// 0 (at the hero) to 1 (all the way).
export function camRoom(lx, lz, cx, cy, cz) {
  const len = Math.hypot(cx - lx, cz - lz);
  const n = Math.max(1, Math.ceil(len / 0.25));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const x = lx + (cx - lx) * t;
    const z = lz + (cz - lz) * t;
    const y = cy; // (the camera's height; it barely changes along the way)
    let hit = !inPoly(x, z, LAWN_W) && y < 22;
    for (const b of BUILDINGS) {
      if (hit) break;
      if (y > b.h + 0.6) continue;
      const [x0, z0, x1, z1] = b.box;
      if (x < x0 - 0.4 || x > x1 + 0.4 || z < z0 - 0.4 || z > z1 + 0.4) continue;
      hit = inPoly(x, z, b.foot) || nearestEdge(x, z, b.foot).d < 0.4;
    }
    if (hit) return Math.max(0, (i - 1) / n - 0.04);
  }
  return 1;
}

// ── where you are ──

export function nearPlace(x, z, r = DOOR_R) {
  let best = null;
  for (const p of PLACES) {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < r && (!best || d < best.d)) best = { ...p, d };
  }
  return best;
}
export const underPortal = (x, z) => Math.hypot(x - PORTAL.x, z - PORTAL.z) < PORTAL.r;

// Where the hero stands coming out of a place: a step outside its door,
// facing out.
export function outside(p) {
  return newHero({ x: p.x + Math.cos(p.face) * 1.6, z: p.z - Math.sin(p.face) * 1.6, face: p.face });
}

// ── the heist so far ──

const WHOLE = ['space', 'mind', 'reality', 'power', 'time', 'soul'];

// From the stones earned (as hq/stones keeps them, halves of Soul included):
// each place done or not, the next one to go to, which stones are back,
// whether the portal is open, and the line at the top of the screen.
export function progress(earned = []) {
  const has = new Set(earned);
  const places = PLACES.map((p) => ({ ...p, done: p.stone ? has.has(p.stone) : false }));
  // (the gate has no stone: it's never the next one for the heist)
  const next = places.find((p) => p.stone && !p.done) ?? null;
  const have = WHOLE.filter((s) => has.has(s));
  const stones = have.length;
  const portal = has.has('space');
  const finished = !next;
  const objective = finished
    ? 'Every stone is back. The portal is open over the helipad: walk under it, and Thanos is on the other side.'
    : portal
      ? `The portal is open over the helipad. ${stones} of 6 stones: ${next.hint}`
      : next.hint;
  return { places, next: next?.id ?? null, have, stones, portal, finished, objective, done: places.filter((p) => p.done).map((p) => p.id) };
}
