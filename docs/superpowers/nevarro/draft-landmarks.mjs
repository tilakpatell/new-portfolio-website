// Nevarro, rebuilt landmark-first (a scratch candidate for the `nevarro`
// entry in src/components/galaxy/surface/sites/outer.js; lab/ is git-ignored).
//
// Nevarro City as the show's artists built it: a town sunk into a shelf of
// black lava rock (its floor 9 m under the rock, the rock round it a natural
// wall with domes along its top), a market square in front of Greef Karga's
// cantina, the Magistrate's hall, rings of grey plaster houses with their
// backs to the rock, four ways out cut through the rock (the West Gate to
// the landing yard, the South Gate to the lava river, the East Gate to the
// watch hill, the North Lane to the Razor Crest), the covert's way down
// to the lava under the streets; the Charon River coming out of its tunnel
// under the town and running down to the lava flats; the Imperial base on
// the lip of a lava canyon in a 26 m plateau; the volcano behind it all.
//
// New kinds this needs (Meshy, see the design): nevarrohouse, nevarrorow,
// nevarrodomehouse, nevarrotower, nevarroarch1, nevarrobridge, ig11statue,
// nevarrohall, nevarroportal, nevarrobase, nevarrocantina (optional; the
// cantina below stays `cantina` until it exists).

import { grove } from '../../../src/components/galaxy/surface/sites/stand.js';

const { PI, cos, sin, hypot, atan2 } = Math;
const r1 = (v) => Math.round(v * 10) / 10;

// (outer.js's own helpers, as they are there)
const sky = (zenith, horizon, sun, extra = {}) => ({ zenith, horizon, haze: 0.8, hazeColor: horizon, suns: [{ az: 0.6, el: 0.35, color: sun, size: 0.016, glow: 1.1 }], clouds: { cover: 0.3, color: '#ffffff', shade: '#9aa0aa', scale: 0.6, speed: 0.005 }, ...extra });
const palette = (low, high, rock, accent, extra = {}) => ({ low, high, rock, accent, deep: rock, hLow: -4, hHigh: 14, rockAt: 0.4, accentCover: 0.25, ripple: { strength: 0.02, scale: 3, wind: 0.5 }, grain: 0.5, ...extra });
const hostile = (range, every, damage) => ({ range, every, damage, spread: 0.06 });
const troops = (tag, n, at, kind = 'stormtrooper') => ({ kind, n, at, spread: 12, roam: 5, hp: 2, tag, hostile: hostile(42, 2.3, 8) });

// ── The numbers everything hangs off ──

// the lava's level (every bed dug for it goes BED, 2.5 m under it); the
// ground in the walkable disc never comes below -1.1 m before it's dug
export const LAVA = -3;
const BED = -5.5;
// the town: its frame (local -x points at the landing; the square in the
// middle), the floor of its bowl, how far the bowl goes, the rock round it
export const TOWN = { at: [148.8, -65.4], yaw: 0.42 };
export const FLOOR = 11;
export const BOWL = 76;
const SHELF = { r: 120, height: 10, core: 0.75 };
// the Imperial base (where the puck quest sends you: unchanged) and the
// plateau it stands on; `n` is the way out over its canyon (toward the
// landing), `a` along the canyon
export const BASE = { at: [-260, 160], top: 30.5 };
const n = [0.852, -0.524];
const a = [0.524, 0.852];
const off = (p, s, t = 0) => [r1(p[0] + n[0] * s + a[0] * t), r1(p[1] + n[1] * s + a[1] * t)];
// the watch hill, behind the town from the landing
export const HILL = { at: [283.8, -217.8], r: 100, height: 50 };
// the volcano, to the right of the town and the hill from the landing
export const VOLCANO = [700, -900];
// the lava flats, where the river runs out into a basin of black crust
export const FLATS = [325, 245];

// a spot in the town's frame, in the world's
export const tw = ([x, z]) => [r1(TOWN.at[0] + x * cos(TOWN.yaw) + z * sin(TOWN.yaw)), r1(TOWN.at[1] - x * sin(TOWN.yaw) + z * cos(TOWN.yaw))];
const polar = (r, ang) => [r1(r * cos(ang)), r1(r * sin(ang))];
// a yaw that turns a thing's front (+z) toward the direction (dx, dz)
const facing = (dx, dz) => r1(atan2(dx, dz) * 100) / 100;

// a run of pits along a path [[x, z, r]…], each `floor` deep (absolute), a
// pit every 1.35 r (their floors still meet: each is flat out to 0.7 r); `gaps`: [i, j] spans of the path left undug (a rock
// bridge the lava runs under)
const run = (pts, floor, gaps = []) => {
  const pits = [];
  let s = 0;
  let next = 0; // (how far down the path the next pit goes)
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az, ar] = pts[i];
    const [bx, bz, br] = pts[i + 1];
    const len = hypot(bx - ax, bz - az);
    while (next <= s + len) {
      const t = (next - s) / len;
      const r = ar + (br - ar) * t;
      const at = [r1(ax + (bx - ax) * t), r1(az + (bz - az) * t)];
      if (!gaps.some(([g0, g1]) => next >= g0 && next <= g1)) pits.push({ at, r: r1(r), floor });
      next += r * 1.35;
    }
    s += len;
  }
  return pits;
};
// ── The town's ways out: cuts through the rock, at the floor's level, out
// to where the land outside is as low (local polar angle, half-width, how
// far out, the height they come out at) ──
export const WAYS = {
  west: { ang: PI, w: 8, out: 120, h: 11.5, k: 3 }, // the West Gate: the landing yard
  south: { ang: PI / 2, w: 7, out: 120, h: 9.5, k: 4 }, // the South Gate: the river, the lava flats
  north: { ang: -1.95, w: 6, out: 120, h: 11, k: 4 }, // the North Lane: the Razor Crest
};
const cut = ({ ang, w, out, h, k }) =>
  // (k + 1 flats, near enough that their middles meet)
   Array.from({ length: k + 1 }, (_, i) => {
    const d = BOWL - 2 + ((out - BOWL + 2) * i) / k;
    return { at: tw(polar(d, ang)), r: w, edge: 4, h: r1(FLOOR + ((h - FLOOR) * i) / k) };
  });

// ── The town, in its own frame: x across (−x to the landing), z down (+z to
// the lava flats); fronts (+z of each model) to the street they're on ──

// the frontage widths each kind takes along a street, and how deep
const W = { nevarrorow: 22, nevarrohouse: 11, nevarrodomehouse: 9, nevarrotower: 8 };
// a ring of buildings round the square at radius r, between two angles,
// fronts in (to the middle) or out; the kinds in turn, `gap` metres apart,
// centred in the arc
const arcRow = (r, a0, a1, kinds, { out = false, gap = 3, sink = 0 } = {}) => {
  const total = kinds.reduce((s, k) => s + W[k], 0) + gap * (kinds.length - 1);
  let at = (a0 + a1) / 2 - total / r / 2;
  return kinds.map((k) => {
    const mid = at + W[k] / r / 2;
    at += (W[k] + gap) / r;
    const [x, z] = polar(r, mid);
    const yaw = out ? facing(cos(mid), sin(mid)) : facing(-cos(mid), -sin(mid));
    const solid = k === 'nevarrotower' ? { solid: { r: 3.6 } } : k === 'nevarrodomehouse' ? { solid: { r: 4.1 } } : {};
    return { kind: k, at: [x, z], yaw, ...(sink ? { sink } : {}), ...solid };
  });
};
// (the half-angle a street of half-width w takes at radius r, and a bit)
const half = (w, r) => w / r + 0.04;
const { west: Wg, south: Sg, north: Ng } = WAYS;

// the outer ring: backs to the rock, fronts in, on the ring lane
const RO = 66;
const OUTER = [
  // from the West Gate round to the North Lane (the old town)
  ...arcRow(RO, -PI + half(Wg.w, RO), Ng.ang - half(Ng.w, RO), ['nevarrorow', 'nevarrohouse', 'nevarrorow']),
  // from the North Lane to the covert's way down
  ...arcRow(RO, Ng.ang + half(Ng.w, RO), -1.5, ['nevarrohouse'], { gap: 2 }),
  // from the covert round to the South Gate: the new quarter, its towers
  ...arcRow(RO, -1.0, Sg.ang - half(Sg.w, RO), ['nevarrohouse', 'nevarrodomehouse', 'nevarrotower', 'nevarrorow', 'nevarrotower', 'nevarrohouse', 'nevarrorow', 'nevarrotower', 'nevarrodomehouse', 'nevarrohouse']),
  // from the South Gate back round to the West Gate
  ...arcRow(RO, Sg.ang + half(Sg.w, RO), PI - half(Wg.w, RO), ['nevarrorow', 'nevarrohouse', 'nevarrodomehouse', 'nevarrorow']),
];
// the inner ring: fronts out onto the ring lane, round the square (the
// Magistrate's hall takes the east of it)
const RI = 41;
const INNER = [
  ...arcRow(RI, -PI + half(Wg.w, RI), Ng.ang - half(Ng.w, RI), ['nevarrohouse', 'nevarrodomehouse'], { out: true }),
  ...arcRow(RI, Ng.ang + half(Ng.w, RI), -0.35, ['nevarrodomehouse', 'nevarrohouse', 'nevarrodomehouse', 'nevarrohouse'], { out: true }),
  ...arcRow(RI, 0.45, Sg.ang - half(Sg.w, RI), ['nevarrohouse', 'nevarrodomehouse', 'nevarrodomehouse'], { out: true }),
  ...arcRow(RI, Sg.ang + half(Sg.w, RI), PI - half(Wg.w, RI), ['nevarrodomehouse', 'nevarrohouse', 'nevarrohouse'], { out: true }),
];
// the rock's top round the bowl: domes at its level (the roofs of what's
// under the rock, as the show's model of the city has them), and every
// third a drum house sunk to its dome; none over the ways out
const RIM = 87;
const clearOf = (ang) => Object.values(WAYS).every((w) => Math.abs(atan2(sin(ang - w.ang), cos(ang - w.ang))) > 0.2);
const RIMDOMES = Array.from({ length: 24 }, (_, i) => -PI + (i + 0.5) * ((2 * PI) / 24))
  .filter(clearOf)
  .map((ang, i) => (i % 3 === 2 ? { kind: 'nevarrodomehouse', at: polar(RIM + 1, ang), yaw: facing(-cos(ang), -sin(ang)), sink: 2.6 } : { kind: 'nevarrodome', at: polar(RIM, ang), yaw: r1(ang * 3), scale: i % 2 ? 1.3 : 1.1, sink: 0.6 }));

// the cantina (where Greef's zone door is: kept to the centimetre), the
// square in front of it, the Magistrate's hall on its east side, the statue
export const CANTINA = { at: [2, -26.05], yaw: -0.12 };
export const COVERT = { local: polar(66, -1.25), r: 15 };
const CORE = [
  { kind: 'cantina', at: CANTINA.at, yaw: CANTINA.yaw },
  // (the square's paving: dark slabs, lit round the edge)
  { kind: 'deck', at: [0, 1], model: false, solid: false, opts: { hw: 21, hd: 16, depth: 1, color: '#5f5e59' } },
  { kind: 'nevarrohall', at: [34, 3], yaw: -PI / 2, solid: { r: 9 } },
  { kind: 'ig11statue', at: [-11, -11], yaw: 0.5, y: 0.3 },
  // the inner gate, just inside the West Gate's cut: two great pillars under
  // a footbridge, across Gate Street
  { kind: 'nevarrobridge', at: [-73, 0], yaw: PI / 2 },
  // the market: stalls round the square's west and south sides and down
  // Gate Street (the bazaar by the way in), cargo
  { kind: 'stall', at: [-17, -8], yaw: PI / 2, y: 0.3 },
  { kind: 'stall', at: [-17, 9], yaw: PI / 2, y: 0.3 },
  { kind: 'stall', at: [-13, 15], yaw: PI, y: 0.3 },
  { kind: 'stall', at: [12, 15], yaw: PI, y: 0.3 },
  { kind: 'stall', at: [18, 9], yaw: -PI / 2, y: 0.3 },
  { kind: 'stall', at: [-27, -6.8], yaw: 0 },
  { kind: 'stall', at: [-34, -6.8], yaw: 0 },
  { kind: 'stall', at: [-29, 6.8], yaw: PI },
  { kind: 'crates', at: [-12, -14], y: 0.3 },
  { kind: 'crates', at: [16, -12], yaw: 0.8, y: 0.3 },
  { kind: 'cratecube', at: [-14, 12], yaw: 0.4, y: 0.3 },
  { kind: 'barrel', at: [-15.5, 12.8], yaw: 0.2, y: 0.3 },
  { kind: 'barrel', at: [15.6, 13.6], yaw: 1.2, y: 0.3 },
  { kind: 'vaporator', at: [24, -20] },
  { kind: 'speedertruck', at: [-24, -14], yaw: 0.3 },
];
// the street lamps (the dark posts Mustafar's use): round the square,
// round the ring lane, out along the ways to the gates
const LAMP = { h: 5, light: '#ffb070', color: '#2a2828' };
const LAMPS = [
  [-20, -15], [20, -15], [-20, 17], [20, 17],
  ...[-2.6, -0.6, 1.0, 2.3].map((ang) => polar(54, ang)),
  ...[90, 116].map((d) => polar(d, Wg.ang + 0.08)),
  ...[90, 112].map((d) => polar(d, Sg.ang + 0.08)),
  polar(96, Ng.ang - 0.07),
].map((at) => ({ kind: 'lamp', at, opts: LAMP }));
// the gates, across their cuts at the rock's outer face: the S2 gate where
// the ships set down and again to the river, the S1 arch by the Razor Crest
// (their solids: just their two pillars, from PROPS stand-ins with the same
// names and the catalog's `solids: 'built'`; see the design)
const GATES = [
  { kind: 'nevarroarch', at: polar(104, Wg.ang), yaw: r1(-Wg.ang + PI / 2), sink: 0.2 },
  { kind: 'nevarroarch', at: polar(97, Sg.ang), yaw: r1(-Sg.ang + PI / 2), scale: 0.9, sink: 0.2 },
  { kind: 'nevarroarch1', at: polar(97, Ng.ang), yaw: r1(-Ng.ang + PI / 2), sink: 0.8 },
];
// roof gear: vaporators up on every third roof of the outer ring
const ROOFS = OUTER.filter((_, i) => i % 3 === 0).map((b, i) => ({ kind: 'vaporator', at: [r1(b.at[0] * 1.04), r1(b.at[1] * 1.04)], y: b.kind === 'nevarrotower' ? 18 : 6.5, solid: false, yaw: i }));

export const TOWN_THINGS = [...CORE, ...OUTER, ...INNER, ...RIMDOMES, ...GATES, ...LAMPS, ...ROOFS];

// ── The Charon River: out of its tunnel under the town's south-east rock,
// down to the lava flats, under one rock bridge on the way ──
export const PORTAL = { local: polar(105, 1.1), ang: 1.1 };
const P0 = tw(PORTAL.local);
export const RIVER = [[...P0, 7], [r1(P0[0] + 4), r1(P0[1] + 20), 7.5], [242, 48, 8], [250, 80, 8.5], [256, 112, 9], [268, 146, 9.5], [284, 180, 10], [300, 212, 10]];
// (where the bridge is, in metres down the river from the tunnel)
export const BRIDGES = [[90, 124]];

// (the river's pits, and the first one past the bridge: the tunnel the
// lava comes out of there stands in its upstream end)
export const RIVERPITS = run(RIVER, BED, BRIDGES);
const pastBridge = (() => {
  const i = RIVERPITS.findIndex((p, j) => j > 0 && hypot(p.at[0] - RIVERPITS[j - 1].at[0], p.at[1] - RIVERPITS[j - 1].at[1]) > p.r * 2);
  const [p, q] = [RIVERPITS[i], RIVERPITS[i + 1]];
  const d = hypot(q.at[0] - p.at[0], q.at[1] - p.at[1]);
  const u = [(q.at[0] - p.at[0]) / d, (q.at[1] - p.at[1]) / d];
  return { at: [r1(p.at[0] - u[0] * p.r * 0.55), r1(p.at[1] - u[1] * p.r * 0.55)], yaw: r1(facing(...u) * 100) / 100 };
})();

// ── The Imperial base's canyon: a lava trench along the plateau's
// south-east lip, closed at both ends ──
const C0 = off(BASE.at, 70);
export const CANYON = run([[...off(C0, 0, -110), 18], [...off(C0, 0, -60), 22], [...off(C0, 0, 40), 22], [...off(C0, 0, 78), 16]], BED);
// the ways out of the lava for anyone who falls in (the beds' walls are too
// steep to climb): the canyon drains into a sloping pool at its south-west
// end; the river's top stretch, between the tunnel and the rock bridge, has
// a sloping bank on its town side
export const EXITS = [
  { at: off(C0, 10, -128), r: 28, depth: 17, cone: true },
  { at: [228.5, 51.6], r: 24, depth: 18, cone: true },
];
// the way up to it: round the canyon's north end and up the plateau's
// flank (no road dug: the slope's walkable), Imperial posts along it
export const BASEWAY = [[0, 0], [-180, -30], [-312, -28], [-300, 100], [-260, 160]];

// ── The site ──
export const nevarro = {
  place: 'The lava fields outside Nevarro City',
  line: 'Black rock, rivers of fire, and a town that runs on bounties.',
  sky: sky('#5a6d8e', '#a9b5c3', '#ffe2c0', { clouds: { cover: 0.6, color: '#c9ced4', shade: '#4c5058', scale: 0.6, speed: 0.006 } }),
  // (thinner than it was, 0.0012, so the range and the volcano read)
  fog: { color: '#9ca6b0', density: 0.00085 },
  light: { sun: 2.4, sky: '#b4c0d0', ground: '#2e3036', ambient: 0.64 },
  dust: '#2a2a2e',
  edge: 'Nothing out there but lava fields and the Guild’s competition. Turn back.',
  ground: {
    detail: 'ash',
    detailLook: { color: 0.7, normal: 0.8 },
    seed: 21,
    layers: [
      { type: 'swell', scale: 380, height: 10 },
      { type: 'hills', scale: 120, height: 10 },
      // the range round the valley, near enough now to be seen
      { type: 'mountains', from: 540, to: 1900, height: 520, scale: 900 },
      // (new, after the old three so theirs keep their shapes) the shelf
      // of rock the town's sunk into
      { type: 'island', at: TOWN.at, r: SHELF.r, height: SHELF.height, core: SHELF.core, ragged: 0.18 },
      // the plateau the Imperial base is built into the lip of
      { type: 'island', at: [-300, 205], r: 200, height: 26, core: 0.72, ragged: 0.15 },
      // the watch hill behind the town
      { type: 'island', at: HILL.at, r: HILL.r, height: HILL.height, core: 0.28, ragged: 0.2 },
      // the volcano, a kilometre behind the town from the landing
      { type: 'island', at: VOLCANO, r: 620, height: 480, core: 0.1, ragged: 0.2 },
      // the lava flats: a basin a few metres over the lava, its lowest
      // hollows under it
      { type: 'island', at: FLATS, r: 150, height: -9, core: 0.5, ragged: 0.4 },
    ],
    flats: Object.values(WAYS).flatMap(cut),
    pits: [
      // the river, its side channels, the canyon's lava
      ...RIVERPITS,
      ...CANYON,
      ...EXITS,
    ],
    palette: palette('#26282e', '#3a3b40', '#1b1f21', '#6e6b62', { hLow: -3, hHigh: 34, rockAt: 0.36, accentCover: 0.3, roughness: 0.9, wet: { level: LAVA, band: 2.2, color: '#7a1e06' }, mark: '#18191c' }),
  },
  water: { level: LAVA, color: '#ff4a0a', deep: '#2a0904', kind: 'lava', glow: 1.8 },
  weather: [{ kind: 'ash', count: 700, color: '#8a8e94' }],
  // where you set down: the landing yard outside the West Gate (land.r
  // makes the yard 34 m across the flat), facing the gate as you step out
  land: { at: [0, 0], yaw: 1.64, r: 34 },
  places: [
    {
      id: 'town',
      name: 'Nevarro City',
      at: TOWN.at,
      yaw: TOWN.yaw,
      r: 96,
      flat: { r: BOWL, h: FLOOR, edge: 5 },
      about: 'The Guild’s town, sunk in a shelf of black lava rock: Greef Karga’s cantina on the market square, the Magistrate’s hall, streets of domed plaster houses with their backs to the rock, and four ways out cut through it.',
      things: TOWN_THINGS,
      pits: [
        // the covert's way down: a funnel in the floor, and at its foot the
        // lava that runs under the streets
        { at: COVERT.local, r: COVERT.r, depth: 8, cone: true },
        { at: COVERT.local, r: 7.5, floor: BED },
      ],
    },
    {
      id: 'covert',
      name: 'The covert’s way down',
      at: tw(COVERT.local),
      r: 16,
      about: 'Steps down into the sewers under the town, where the lava river runs and the Armorer keeps her forge. The Tribe’s covert, if you’re invited.',
      things: [
        // (the sewer's mouth in the funnel's far wall, the lava below it)
        { kind: 'nevarroportal', at: [0, -10], yaw: 0, scale: 0.55, abs: true, y: 5 },
        // (a rock standing up out of the lava: its solid keeps you out of the hole)
        { kind: 'lavarock', at: [0, 0], scale: 2.2, abs: true, y: -4, solid: { r: 8.2 } },
        { kind: 'fire', at: [5, -8] },
        { kind: 'welderrack', at: [-7, -9], yaw: 0.6 },
        { kind: 'ammocan', at: [-5.6, -10.2], yaw: 1.1 },
      ],
    },
    { id: 'crest', name: 'The Razor Crest', at: [40, -170], r: 30, flat: { r: 30 }, about: 'Din Djarin’s gunship, older than it looks and patched in more places than it should be.', things: [{ kind: 'razorcrest', at: [0, 0], yaw: 1.2 }, { kind: 'fire', at: [12, 10] }, { kind: 'crates', at: [-11, 8], yaw: 0.6 }] },
    {
      id: 'base',
      name: 'The Imperial base',
      at: BASE.at,
      r: 50,
      flat: { r: 46, h: BASE.top },
      about: 'An Imperial Remnant base built into the lip of a canyon, its coolant tanks hanging out over the lava. Still running. Still guarding something.',
      things: [],
    },
    {
      id: 'river',
      name: 'The lava river',
      at: tw(polar(118, 1.1)),
      r: 30,
      about: 'Where the Charon River comes out from under the town, through a tunnel the Guild once rode keelboats down, and runs off toward the lava flats.',
      things: [],
    },
    { id: 'lava', name: 'The lava flats', at: FLATS, r: 60, about: 'A crust of black glass over rivers of fire. Don’t stop walking.', things: [] },
    {
      id: 'hill',
      name: 'The watch hill',
      at: HILL.at,
      r: 32,
      flat: { r: 14 },
      about: 'A black hill over the city with the magistrate’s watchtower on top: the whole valley from here, the lava running to the flats, and the volcano beyond.',
      things: [
        { kind: 'nevarrotower', at: [0, 0], yaw: 2.3 },
        { kind: 'kmast', at: [9, -5] },
        { kind: 'lamp', at: [-7, 7], opts: LAMP },
      ],
    },
  ],
  // (filled below: the base, the river's things, the yard)
  things: [],
  scatter: [
    { kind: 'lavarock', n: 120, within: [36, 470], scale: [0.35, 1.6], sink: 0.25, solid: 0.6, flat: 0.8 },
    { kind: 'lavarock', n: 40, within: [140, 820], scale: [2, 6], sink: 0.6 },
    { kind: 'lavacrack', n: 420, within: [40, 600], scale: [1.4, 3.2], solid: false },
    { kind: 'basalt', n: 60, within: [60, 560], scale: [0.8, 2.0], flat: 0.85 },
    { kind: 'stones', n: 220, within: [10, 420], scale: [0.25, 0.8], solid: false, opts: { color: '#2a2a2e' } },
  ],
  zones: [], // (the cantina's, unchanged: see outer.js)
  life: [], // (below)
  quests: [], // (the puck and the protect quests, unchanged: see outer.js)
  // a scout trooper's speeder bike, left at the North Lane's mouth (the
  // ride out to the base)
  rides: [{ kind: 'speederbike', at: [66, -146], yaw: 2.2 }],
  sound: { wind: 0.4, rain: 0, sea: 0, lava: 0.45, critters: 0, city: 0.3, ground: 'sand' },
  flyovers: [{ kind: 'tie', n: 2, metres: 7, alt: 90, speed: 100, every: 50 }],
};

// ── The base: built into the canyon's lip (its roof 3 m over the plateau,
// its pad out over the lava), TIEs on the plateau, the bunker the way in,
// barracks, a watchtower, a mast, guns on the lip ──
const IMP = { h: 5, light: '#dfe8ff', color: '#2a2c30' };
const BASEPLACE = nevarro.places.find((p) => p.id === 'base');
// (in the base's own frame: s out toward the canyon, t along it; the place
// has no yaw, so these are world offsets)
const bt = (s, t) => [r1(n[0] * s + a[0] * t), r1(n[1] * s + a[1] * t)];
const OUT = r1(facing(...n) * 100) / 100; // the yaw that faces out over the canyon
BASEPLACE.things = [
  { kind: 'nevarrobase', at: bt(44, 4), yaw: OUT, abs: true, y: 9, solid: { box: [50, 12] } },
  { kind: 'bunker', at: bt(-8, 26), yaw: OUT + PI / 2 },
  { kind: 'bunker', at: bt(-30, 8), yaw: OUT, model: false, opts: { w: 16, d: 10 } },
  { kind: 'bunker', at: bt(-30, -14), yaw: OUT, model: false, opts: { w: 12, d: 9 } },
  { kind: 'lookout', at: bt(-26, -36), yaw: OUT, opts: { h: 24 } },
  { kind: 'kmast', at: bt(-12, 38) },
  { kind: 'parked', url: '/models/galaxy/tie.glb', metres: 7.2, at: bt(-4, -18), yaw: OUT, opts: { kind: 'tie', metres: 7.2 } },
  { kind: 'parked', url: '/models/galaxy/tie.glb', metres: 7.2, at: bt(-14, -26), yaw: OUT + 0.2, opts: { kind: 'tie', metres: 7.2 } },
  { kind: 'eweb', at: bt(24, -24), yaw: OUT },
  { kind: 'eweb', at: bt(24, 30), yaw: OUT },
  { kind: 'crates', at: bt(10, 16) },
  { kind: 'crates', at: bt(-18, 14), yaw: 0.7 },
  { kind: 'empirecrate', at: bt(4, 22), yaw: 0.3 },
  { kind: 'cratecube', at: bt(6, -8), yaw: 1.2 },
  { kind: 'lamp', at: bt(14, -12), opts: IMP },
  { kind: 'lamp', at: bt(14, 14), opts: IMP },
  { kind: 'lamp', at: bt(-20, 0), opts: IMP },
];
// the river: the tunnel's mouth, under the town's south-east rock, facing
// down the river; steam off the flats; the yard's ships and cargo
const RIVERPLACE = nevarro.places.find((p) => p.id === 'river');
{
  const pa = PORTAL.ang;
  const face = TOWN.yaw + facing(cos(pa), sin(pa));
  RIVERPLACE.things = [];
  nevarro.things.push(
    { kind: 'nevarroportal', at: tw(polar(104, pa)), yaw: r1(face * 100) / 100, abs: true, y: LAVA - 0.5, solid: false },
    // the second: where it comes out from under the rock bridge
    { kind: 'nevarroportal', at: pastBridge.at, yaw: pastBridge.yaw, scale: 0.85, abs: true, y: LAVA - 0.5, solid: false },
  );
}
nevarro.places.find((p) => p.id === 'lava').things = [
  // (steam off the vents in the crust, on dry spots round the pool)
  { kind: 'smoke', at: [-40, -40], solid: false, opts: { h: 40, n: 8, color: '#b8bcc2', spread: 0.8 } },
  { kind: 'smoke', at: [70, 0], solid: false, opts: { h: 30, n: 7, color: '#b8bcc2', spread: 0.7 } },
  { kind: 'wrecksmoke', at: [-60, 0], solid: false, opts: { h: 14, r: 1.4, n: 10 } },
  ...grove(41, 12, 18, 60, ['lavarock'], [1.5, 4.5]),
];
nevarro.things.push(
  // the volcano's steam, over its top
  { kind: 'smoke', at: VOLCANO, abs: true, y: 655, solid: false, opts: { h: 260, n: 10, color: '#c4c8cc', spread: 5 } },
  // the landing yard: a New Republic X-wing down beside the gate, the
  // Guild's cargo, a fuel pump, marker blocks
  { kind: 'parked', at: [24, -46], yaw: 2.6, opts: { kind: 'xwing', metres: 12.5 } },
  { kind: 'vaporator', at: [34, -36] },
  { kind: 'hothconsole', at: [36, -33], yaw: 2.4 },
  { kind: 'cratecube', at: [14, 10], yaw: 0.4 },
  { kind: 'cratecube', at: [15.3, 10.5], yaw: 1.1 },
  { kind: 'barrel', at: [12.5, 12], yaw: 0.2 },
  { kind: 'empirecrate', at: [-16, -8], yaw: 2.3 },
  { kind: 'bevelcrate', at: [52, -10], yaw: 0.3 },
  { kind: 'bevelcrate', at: [38, 30], yaw: 1.3 },
  { kind: 'bevelcrate', at: [-30, 36], yaw: 2.1 },
  { kind: 'lamp', at: [18, 6], opts: LAMP },
  { kind: 'lamp', at: [38, -20], opts: LAMP },
  // the way to the base: Imperial posts along it
  ...[[-150, -25], [-236, -29], [-306, 10], [-302, 70]].map((at) => ({ kind: 'lamp', at, opts: IMP })),
);

// ── Who's about ──
const sq = (p) => tw(p); // (a spot in the town, in the world)
const COV = tw(COVERT.local);
nevarro.life = [
  // (kept as they are: the protect quest's Mandalorian and the Child, the
  // landing's R5 and hunter, the blurrgs, the happabore on the ring lane)
  { kind: 'dindjarin', id: 'mando', at: [48, -160], still: true, face: 2.4, name: 'The Mandalorian', named: true, quest: 'protect', says: ['This is the Way.', 'I can bring you in warm, or I can bring you in cold.'] },
  { kind: 'grogu', at: [44, -156], still: true, face: 2.6, name: 'The Child', says: ['(He holds up a tiny hand, and looks very serious about it.)', '(A small coo.)'] },
  { kind: 'r5', n: 1, at: [12, 6], roam: 6, speed: 0.6, name: 'An R5 unit', says: ['(A sulky beep. Somebody stole its restraining bolt. For the bolt.)'] },
  { kind: 'aqualish', n: 1, at: [-14, -4], still: true, face: 0.8, name: 'Bounty hunter', says: ['Guild business. Keep walking.', 'Cantina’s in town. Karga’s buying. Karga’s never buying.'] },
  { kind: 'blurrg', n: 2, at: [70, -130], spread: 12, roam: 14, speed: 0.9, r: 1 },
  { kind: 'happabore', n: 1, at: [178, -108], roam: 8, speed: 0.5, r: 1.8 },
  // the town: its people about the square and the ring lane, hunters, a
  // stall-keeper, someone by the statue (IG-11 is a statue now: no roaming one)
  { kind: 'villager', n: 6, at: TOWN.at, spread: 40, roam: 22, speed: 1, name: 'Nevarro local', says: ['The Guild’s back in business. The Empire’s not.', 'Mind the steps down by the cantina. They go a long way down.'] },
  { kind: 'aqualish', n: 2, at: sq([-6, 6]), spread: 8, roam: 8, speed: 0.8, name: 'Bounty hunter', says: ['Took a puck? So did I. Same one, probably.'] },
  { kind: 'bith', at: sq([-15, 0]), still: true, face: r1(TOWN.yaw + PI / 2), name: 'A stall-keeper', says: ['Beskar? Ha. Try the Imperials. They had plenty, once.'] },
  { kind: 'villager', at: sq([-8, -6]), still: true, face: r1(TOWN.yaw + PI + 0.5), name: 'Nevarro local', says: ['That’s IG-11. He saved this town, and the Child. We put him up there.'] },
  // the covert's way down: the Armorer at the sewer's mouth, two of the Tribe
  { kind: 'armorer', id: 'armorer', at: [r1(COV[0] + 3), r1(COV[1] - 6)], still: true, face: 0, name: 'The Armorer', named: true, says: ['This is the Way.', 'The river of fire runs below these streets. The forge is beside it.', 'We survive by remaining hidden. You were not invited.'] },
  { kind: 'mando', n: 2, at: [r1(COV[0] - 4), r1(COV[1] + 8)], spread: 4, roam: 4, speed: 0.8, name: 'Mandalorian', says: ['This is the Way.'] },
  // the yard: a New Republic pilot by the X-wing
  { kind: 'pilot', at: [30, -42], still: true, face: 2.6, name: 'New Republic pilot', says: ['The Republic likes to keep an eye on Nevarro.', 'Watch where you park. The last Mandalorian set down on my fuel line.'] },
  // the base: its garrison in the yard (the puck quest's troops are spawned
  // there too), and a pair walking the canyon's lip
  { kind: 'stormtrooper', n: 4, at: BASE.at, spread: 20, roam: 12, speed: 1.2, name: 'Remnant stormtrooper', says: ['Move along. This area is restricted.'] },
  { kind: 'stormtrooper', n: 2, path: [bt(36, -40), bt(36, 40), bt(-20, 40), bt(-20, -40)].map(([x, z]) => [r1(BASE.at[0] + x), r1(BASE.at[1] + z)]), speed: 1.1, name: 'Remnant stormtrooper', says: ['The canyon’s a long way down. Don’t lean on the rail.'] },
];
