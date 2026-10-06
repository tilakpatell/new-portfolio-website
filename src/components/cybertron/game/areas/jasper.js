// The desert outside Jasper, Nevada, as Transformers: Prime has it: mesas
// and buttes in red rock, the road running east to west through it, the
// edge of town to the east, a Decepticon energon mine dug into the canyons,
// and the ground bridge's portal opening by the road. Predaking and
// Dreadwing go over now and then.

const rng = (seed) => {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0) / 4294967296);
};

const ROAD = 18; // the road's half-width, along z = 0
const MINE = { x: 300, z: -250 };
const PORTAL = { x: -450, z: 0 };
const POD = { x: -180, z: 330 };

// Mesas and buttes, kept off the road, the portal, the mine's mouth and the pod
function mesas() {
  const rand = rng(77);
  const out = [];
  const clear = (x, z, r) => Math.abs(z) > ROAD + r + 20 && Math.hypot(x - PORTAL.x, z - PORTAL.z) > r + 60 && Math.hypot(x - MINE.x, z - MINE.z) > r + 70 && Math.hypot(x - POD.x, z - POD.z) > r + 50 && Math.hypot(x - 500, z - 200) > r + 90;
  for (let tries = 0; out.length < 26 && tries < 600; tries++) {
    const x = (rand() - 0.5) * 1100;
    const z = (rand() - 0.5) * 1100;
    const r = 18 + rand() ** 1.5 * 70;
    if (!clear(x, z, r) || out.some((m) => Math.hypot(m.x - x, m.z - z) < m.r + r + 24)) continue;
    out.push({ kind: 'circle', x: +x.toFixed(1), z: +z.toFixed(1), r: +r.toFixed(1), top: +(40 + rand() * 100).toFixed(1), tag: 'mesa' });
  }
  return out;
}

// The mine: a horseshoe of rock open to the west, round its pit
const mine = Array.from({ length: 9 }, (_, i) => {
  const a = Math.PI * 0.25 + (i / 8) * Math.PI * 1.5;
  return { kind: 'circle', x: +(MINE.x + Math.cos(a) * 70).toFixed(1), z: +(MINE.z + Math.sin(a) * 70).toFixed(1), r: 18, top: 34 + (i % 3) * 8, tag: 'rock' };
});

// The edge of town: a gas station, a diner and a few low buildings
const town = [
  { kind: 'box', x: 480, z: 170, hw: 14, hd: 9, top: 8, tag: 'building' },
  { kind: 'box', x: 520, z: 205, hw: 10, hd: 12, top: 10, tag: 'building' },
  { kind: 'box', x: 470, z: 240, hw: 16, hd: 8, top: 7, tag: 'building' },
  { kind: 'box', x: 545, z: 150, hw: 8, hd: 8, top: 12, tag: 'building' },
  { kind: 'box', x: 430, z: 60, hw: 9, hd: 4, top: 6, tag: 'station' },
];

export const JASPER = {
  id: 'jasper',
  name: 'Jasper, Nevada',
  era: 'tfp',
  player: { robot: 'optimus-tfp', vehicle: 'truck-tfp' },
  bounds: { minX: -600, maxX: 600, minZ: -600, maxZ: 600 },
  spawn: { x: -420, z: 0, yaw: Math.PI / 2 },
  spawns: {
    start: { x: -420, z: 0, yaw: Math.PI / 2 },
    bridge: { x: -420, z: 0, yaw: Math.PI / 2 },
  },
  solids: [...mesas(), ...mine, ...town],
  people: [],
  pickups: [
    ...[
      [300, -230],
      [318, -262],
      [284, -270],
      [330, -240],
      [300, -290],
      [270, -240],
    ].map(([x, z], i) => ({ id: `jasper-crystal-${i}`, kind: 'crystal', x, y: 0, z })),
    { id: 'jasper-relic', kind: 'relic', x: POD.x + 6, y: 0, z: POD.z - 4, mission: 'relic' },
  ],
  exits: [{ id: 'ground-bridge', x: PORTAL.x, z: PORTAL.z, r: 10, to: 'base', at: 'tunnel', label: 'Ground bridge to base' }],
  missions: [],
  look: {
    sky: 'desert',
    fog: ['#d9b48a', 300, 1600],
    sun: { dir: [0.5, 0.8, 0.35], color: '#fff1d6', intensity: 3.2 },
    ambient: ['#b8a68e', 0.6],
    env: 0.8,
    exposure: 1.0,
    bloom: 0.4,
  },
  stage: {
    road: { z: 0, half: ROAD },
    portal: PORTAL,
    mine: MINE,
    pod: POD,
    flyovers: ['predaking', 'dreadwing-jet'],
  },
};
