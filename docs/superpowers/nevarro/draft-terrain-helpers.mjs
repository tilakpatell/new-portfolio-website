// Terrain-first Nevarro: the ground, the lava and the places' flats/pits,
// written as it would go into sites/outer.js (scratch; not in the repo).

const r1 = (v) => Math.round(v * 10) / 10;
// points every `step` metres along a polyline (its ends included)
export const along = (pts, step) => {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let j = 0; j < n; j++) out.push([r1(a[0] + ((b[0] - a[0]) * j) / n), r1(a[1] + ((b[1] - a[1]) * j) / n)]);
  }
  out.push(pts[pts.length - 1]);
  return out;
};
// level ground stepping evenly from a to b (core.js's ramp)
export const ramp = (a, b, h0, h1, n = 12, r = 8) =>
  Array.from({ length: n + 1 }, (_, i) => ({ at: [r1(a[0] + ((b[0] - a[0]) * i) / n), r1(a[1] + ((b[1] - a[1]) * i) / n)], r, edge: r, h: r1(h0 + ((h1 - h0) * i) / n) }));
// a trench cut down into the rock (a street, a canyon): pits down to a floor
// going from f0 at its start to f1 at its end
export const trench = (pts, r, f0, f1 = f0, step = 6) => {
  const p = along(pts, step);
  return p.map((at, i) => ({ at, r, floor: r1(f0 + ((f1 - f0) * i) / Math.max(1, p.length - 1)) }));
};

export const LAVA = 1.5; // the lava's level
export const BED = LAVA - 1.3; // a lava river's bed: waist-deep if you wade in
// a lava river across the open fields: flats down to its bed, its banks easing up over `edge`
export const river = (pts, r, edge = 9, step = 7) => along(pts, step).map((at) => ({ at, r, edge, h: BED }));

// ── the key spots ──
export const TOWN = [140, -90]; // (the cantina's zone door is tied to it)
export const MESA = [150, -98]; // the middle of the lava tableland the town is cut into
export const FLOOR = 9; // the town's floor, its streets, the yard and the landing
export const GATE = [58, -37]; // the main street's mouth, where the arch stands
export const LAND = [0, 0];
export const BASE = [-260, 160];
export const ESC = [-454, 278]; // the escarpment's middle
export const CREST = [40, -170];
export const FLATS = [352, 250];
export const CONE = [660, -380]; // the volcano
export const BLUFF = [363, -214]; // the scouts' bluff, on the volcano's flank

// the Charon River: out of its tunnel under the town, across the lava
// fields to the flats (a gap where it runs under a crust bridge)
export const GORGE = [[172, -10], [178, 14]];
export const CHARON = [[[178, 14], [194, 56], [226, 98], [250, 124]], [[260, 152], [272, 176], [300, 214], [322, 252]]];
// a second arm, from a vent on the volcano's foot
export const SPILL = [[430, -60], [420, 20], [380, 90], [352, 150], [332, 212]];
// the lava channel along the foot of the Imperial base's cliff (gentle far bank, so not a trap)
export const MOAT = [[-300, 58], [-270, 82], [-240, 106], [-214, 140]];
// Trexler's run: a slot canyon from the back of the base up onto the escarpment
export const SLOT = [[-286, 176], [-318, 214], [-342, 262]];

export const ground = {
  detail: 'ash',
  detailLook: { color: 0.75, normal: 0.85 },
  seed: 21,
  base: 5,
  wind: 0.6,
  layers: [
    { type: 'swell', scale: 420, height: 4 },
    { type: 'hills', scale: 130, height: 4 },
    // the ropy crust
    { type: 'ridges', scale: 44, height: 2.2 },
    // cracks: dry gullies on the plain, lava where the land is low
    { type: 'channels', scale: 210, depth: 3, width: 0.05 },
    // the range all round, close: its feet at the edge of where you can go
    { type: 'mountains', from: 560, to: 1150, height: 440, scale: 620 },
    // the volcano behind the town, and its crater
    { type: 'island', at: CONE, r: 460, height: 300, core: 0.1, ragged: 0.22 },
    { type: 'island', at: CONE, r: 70, height: -50, core: 0.35, ragged: 0.2 },
    // the black lava tableland the town is cut into
    { type: 'island', at: MESA, r: 112, height: 9, core: 0.8, ragged: 0.18 },
    // the escarpment the Imperial base hangs on
    { type: 'island', at: ESC, r: 250, height: 56, core: 0.82, ragged: 0.22 },
    // the lava flats: a broad sag where the crust is thin
    { type: 'island', at: [340, 280], r: 250, height: -6.5, core: 0.45, ragged: 0.3 },
    // black ridges south of the landing, between it and the flats
    { type: 'island', at: [150, 250], r: 120, height: 34, core: 0.2, ragged: 0.4 },
    { type: 'island', at: [70, 330], r: 110, height: 28, core: 0.2, ragged: 0.4 },
    // the western butte
    { type: 'island', at: [-420, -180], r: 120, height: 42, core: 0.78, ragged: 0.18 },
    // an old lava dome to the north
    { type: 'island', at: [-120, -430], r: 120, height: 32, core: 0.45, ragged: 0.3 },
  ],
  flats: [
    // the lava channel under the base's cliff
    ...river(MOAT, 5, 12, 6),
    // the road up to the base, round the channel's end
    ...ramp([-160, 206], [-226, 176], 8, 33, 10, 6),
    // the rivers
    ...CHARON.flatMap((run) => river(run, 6)),
    ...river(SPILL, 5, 8),
  ],
  pits: [
    // the town's streets, cut down into the rock: the main street out to
    // the gate, the north lane out to the Razor Crest, the back lane to the
    // river tunnel
    ...trench([[104, -67], GATE], 9, FLOOR),
    ...trench([[106, -117], [62, -152]], 8, FLOOR),
    ...trench([[158, -52], [166, -30]], 7, FLOOR),
    // the river's gorge out of the tableland
    ...trench(GORGE, 8, BED, BED, 5),
    // Trexler's run, from the base's floor up to the escarpment's top
    ...trench(SLOT, 7, 33, 62, 5),
  ],
};

export const water = { level: LAVA, color: '#ff4a0e', deep: '#2a0904', kind: 'lava', glow: 1.7 };
export const fog = { color: '#9aa6b2', density: 0.0007 };
export const land = { at: LAND, yaw: 0.6, h: FLOOR };

export const places = [
  { id: 'town', at: TOWN, r: 60, flat: { r: 44, edge: 6, h: FLOOR } },
  { id: 'yard', at: [38, -24], r: 40, flat: { r: 30, edge: 14, h: FLOOR } },
  { id: 'crest', at: CREST, r: 30, flat: { r: 30, h: FLOOR } },
  { id: 'base', at: BASE, r: 50, flat: { r: 38, edge: 6, h: 33 } },
  { id: 'lava', at: FLATS, r: 60, flat: { r: 9, edge: 10, h: LAVA + 1.4 } },
  { id: 'charon', at: [178, 4], r: 26 },
  { id: 'bluff', at: BLUFF, r: 30, flat: { r: 14 } },
  { id: 'homestead', at: [-70, -120], r: 24, flat: { r: 14 } },
  { id: 'fingers', at: [-200, -70], r: 60 },
];
export const SPOTS = { mando: [48, -160], deathspawn: [90, -210], asset: [-252, 166], cantinadoor: [143, -80.4], cantinaback: [143.7, -78], gate: GATE, portal: [173, -8], slottop: [-342, 262], roadtop: [-226, 175], roadfoot: [-160, 206], spillhead: [430, -60] };
