// The terrain-first Nevarro, as a whole site entry (scratch; what would
// replace SITES.nevarro in src/components/galaxy/surface/sites/outer.js).
// The new Meshy kinds it uses: nevarrorow, nevarrohouse, nevarrotower,
// nevarrobase, charonportal, ig11statue, mudhornhut, keelboat.
import { grove } from '../../../src/components/galaxy/surface/sites/stand.js';
import * as T from './design.mjs';

const { PI } = Math;
const r1 = (v) => Math.round(v * 10) / 10;
const sky = (zenith, horizon, sun, extra = {}) => ({ zenith, horizon, haze: 0.8, hazeColor: horizon, suns: [{ az: 0.6, el: 0.35, color: sun, size: 0.016, glow: 1.1 }], clouds: { cover: 0.3, color: '#ffffff', shade: '#9aa0aa', scale: 0.6, speed: 0.005 }, ...extra });
const hostile = (range, every, damage) => ({ range, every, damage, spread: 0.06 });
const troops = (tag, n, at, kind = 'stormtrooper') => ({ kind, n, at, spread: 12, roam: 5, hp: 2, tag, hostile: hostile(42, 2.3, 8) });
// a spot round the town's middle: `deg` round from +x toward +z, `r` out, facing the middle
const round = (deg, r) => { const a = (deg * PI) / 180; return [r1(Math.cos(a) * r), r1(Math.sin(a) * r), r1(-a - PI / 2)]; };
// a spot along a street from a to b: t metres along, `side` metres off to its left (+) or right (−), facing across it
const street = (a, b, t, side) => {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const d = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  const n = [-d[1], d[0]]; // its left
  const at = [r1(a[0] + d[0] * t + n[0] * side), r1(a[1] + d[1] * t + n[1] * side)];
  const face = side > 0 ? [-n[0], -n[1]] : n; // across the street
  return { at, yaw: r1(Math.atan2(face[0], face[1])) };
};
const DARK = { h: 4.5, light: '#ffb070', color: '#2a2828' }; // Nevarro's lamp posts
const IMP = { h: 5, light: '#cfe8ff', color: '#3a3e44' }; // the base's
const STEAM = { h: 40, n: 7, color: '#c5cad0', spread: 0.8 };
const rel = (at, o) => [r1(at[0] - o[0]), r1(at[1] - o[1])];

// the town's streets (world), as design.mjs cuts them
const MAIN = [[104, -67], T.GATE];
const NORTH = [[106, -117], [62, -152]];
// the trench-wall house fronts round the town's floor (between the streets' mouths)
const WALL = [90, 108, 124, 172, 194, 242, 262, 282, 302, 322, 342, 2, 22, 42].map((deg) => { const [x, z, yaw] = round(deg, 40.5); return { kind: 'nevarrorow', at: [x, z], yaw, sink: 0.2 }; });
// …and along the main street's north wall, the market on its south
const onMain = (t, side) => { const s = street(...MAIN, t, side); return { ...s, at: rel(s.at, T.TOWN), abs: true, y: T.FLOOR }; };
// the domes and towers up on the rock, at roof level
const ROOFS = [
  ...[[10, 64], [100, 62], [250, 66], [300, 70]].map(([deg, r], i) => { const [x, z] = round(deg, r); return { kind: 'nevarrohouse', at: [x, z], yaw: i * 1.3, sink: 0.6 }; }),
  ...[[40, 76], [125, 66], [180, 60], [275, 58], [335, 72]].map(([deg, r], i) => { const [x, z] = round(deg, r); return { kind: 'nevarrodome', at: [x, z], yaw: i * 1.1, scale: 1.5, sink: 0.6 }; }),
  ...[[30, 78], [320, 80], [200, 76]].map(([deg, r], i) => { const [x, z] = round(deg, r); return { kind: 'nevarrotower', at: [x, z], yaw: i * 0.9, sink: 0.4 }; }),
  ...[[0, 58], [100, 57], [290, 58]].map(([deg, r]) => { const [x, z] = round(deg, r); return { kind: 'vaporator', at: [x, z], yaw: deg / 50 }; }),
];
// the base's frame: f toward the landing, s along the cliff
const F = [0.855, -0.518];
const S = [0.518, 0.855];
const at = (f, s) => [r1(F[0] * f + S[0] * s), r1(F[1] * f + S[1] * s)];
const FACE = r1(Math.atan2(F[0], F[1])); // (2.1: facing the landing)
// the Fingers: black rock spires west of the landing
const FINGERS = [[0, 0, 48, 10], [-28, 18, 36, 8], [22, -26, 42, 9], [-40, -30, 30, 7], [34, 20, 28, 6.5], [-12, 44, 34, 7.5], [46, -6, 24, 6], [-52, 6, 40, 8.5], [10, -50, 32, 7]].map(([x, z, h, r], i) => ({ kind: 'lothspire', at: [x, z], yaw: i * 1.7, opts: { h, r, seed: i + 21, color: '#26282d' } }));

export const nevarro = {
  place: 'The lava fields outside Nevarro City',
  line: 'Black rock, rivers of fire, and a town that runs on bounties.',
  sky: sky('#5d7190', '#aab6c4', '#ffe2c0', { clouds: { cover: 0.6, color: '#c9ced4', shade: '#4c5058', scale: 0.6, speed: 0.006 } }),
  fog: T.fog,
  // (the lava adds its own orange from below: water.js's HemisphereLight, 0.9)
  light: { sun: 2.3, sky: '#b0bccd', ground: '#2f2e33', ambient: 0.66 },
  dust: '#3a3a3e',
  edge: 'Nothing out there but more rock and the mountains. Turn back.',
  ground: {
    ...T.ground,
    // pale ash where it's low and open, black lava up on the tablelands and
    // ridges and in lobes across the plain, blue-black rock on the cliffs,
    // the crust darkening and warming at the lava's edge
    palette: { low: '#6f6b62', high: '#24272c', rock: '#15181b', accent: '#22262b', deep: '#1b1d20', hLow: 10.5, hHigh: 16, rockAt: 0.36, accentCover: 0.3, ripple: { strength: 0.02, scale: 3, wind: 0.5 }, grain: 0.6, roughness: 0.9, wet: { level: T.LAVA, band: 5, color: '#2a1612' }, mark: '#18191c' },
  },
  water: T.water,
  weather: [{ kind: 'ash', count: 700, color: '#5d5f66' }, { kind: 'embers', count: 160 }],
  land: T.land,
  places: [
    {
      id: 'town',
      name: 'Nevarro City',
      at: T.TOWN,
      r: 60,
      flat: T.places.find((p) => p.id === 'town').flat,
      about: 'The guild’s town, cut down into the black rock: its streets are trenches, its roofs and domes level with the lava plain. Greef Karga’s cantina is in the middle of it.',
      things: [
        { kind: 'cantina', at: [0, 0], yaw: 0.3 },
        { kind: 'ig11statue', at: [-8, 18], yaw: -1.0 },
        ...WALL,
        { kind: 'nevarrorow', ...onMain(14, 5.8), sink: 0.2 },
        { kind: 'nevarrorow', ...onMain(37, 5.8), sink: 0.2 },
        ...[16, 27, 38].map((t) => { const { abs, y, ...o } = onMain(t, -3.6); return { kind: 'stall', ...o }; }),
        ...[21.5, 32.5, 48].map((t) => ({ kind: 'lamp', at: onMain(t, -4.2).at, opts: DARK })),
        ...[10, 100, 190, 280].map((deg) => { const [x, z] = round(deg, 30); return { kind: 'lamp', at: [x, z], opts: DARK }; }),
        ...ROOFS,
        { kind: 'speedertruck', at: [24, -26], yaw: 0.9 },
        { kind: 'swoop', at: [24, 24], yaw: 2.2 },
        { kind: 'cratecube', at: [-30, -12], yaw: 0.3 },
        { kind: 'barrel', at: [-28.5, -10], yaw: 1.1 },
      ],
    },
    {
      id: 'yard',
      name: 'The landing yard',
      at: [38, -24],
      r: 40,
      flat: T.places.find((p) => p.id === 'yard').flat,
      about: 'Black gravel outside the city’s arch, where the hunters set down: marker blocks, a pair of New Republic X-wings, and the way in.',
      things: [
        { kind: 'nevarroarch', at: rel([62, -40], [38, -24]), yaw: -0.99, scale: 1.15, sink: 0.2, solid: false },
        { kind: 'parked', at: [6, 26], yaw: 2.0, opts: { kind: 'xwing', metres: 12.5 } },
        { kind: 'parked', at: [-14, -18], yaw: 0.4, opts: { kind: 'xwing', metres: 12.5 } },
        ...[[-20, -4], [2, -24], [22, 8], [-16, 22], [20, 30], [-28, -30]].map(([x, z], i) => ({ kind: 'cratecube', at: [x, z], yaw: i * 0.7 })),
        { kind: 'lamp', at: [18, -24], opts: DARK },
        { kind: 'lamp', at: [28, -8], opts: DARK },
        { kind: 'vaporator', at: [-24, 10] },
        { kind: 'vaporator', at: [-26.5, 13] },
      ],
    },
    {
      id: 'crest',
      name: 'The Razor Crest',
      at: T.CREST,
      r: 30,
      flat: T.places.find((p) => p.id === 'crest').flat,
      about: 'Din Djarin’s gunship on a pad below the town’s north lane, older than it looks and patched in more places than it should be.',
      things: [
        { kind: 'pad', at: [0, 0], opts: { r: 15, color: '#3a3b3f', light: '#ffb070' } },
        { kind: 'razorcrest', at: [0, 0], yaw: 1.2 },
        { kind: 'nevarroarch', at: rel([66, -149], T.CREST), yaw: -2.24, sink: 0.2, solid: false },
        { kind: 'fire', at: [12, 13] },
        { kind: 'tent', at: [18, 4], yaw: 1.4 },
        { kind: 'welderrack', at: [-10, 12], yaw: 2 },
        { kind: 'ammocan', at: [-12.2, 10], yaw: 0.6 },
      ],
    },
    {
      id: 'base',
      name: 'The Imperial base',
      at: T.BASE,
      r: 50,
      flat: T.places.find((p) => p.id === 'base').flat,
      about: 'A Remnant base built into the side of a cliff, its coolant tanks along the rock and a landing pad out over the lava below. Still running, still guarding something.',
      things: [
        { kind: 'nevarrobase', at: at(-26, 0), yaw: FACE },
        { kind: 'bunker', at: [-6, -8], yaw: FACE },
        { kind: 'pad', at: at(36, 0), abs: true, y: 33, opts: { r: 12, color: '#4a4f55', light: '#ffd9a0' } },
        { kind: 'parked', at: at(36, 0), abs: true, y: 33.3, yaw: FACE, opts: { kind: 'tie', metres: 7 } },
        { kind: 'lookout', at: at(0, -30), yaw: FACE, opts: { h: 26 } },
        { kind: 'kmast', at: at(4, 27) },
        { kind: 'bunker', at: at(-4, 24), yaw: FACE, model: false, opts: { w: 14, d: 9 } },
        { kind: 'bunker', at: at(10, -24), yaw: FACE, model: false, opts: { w: 12, d: 8 } },
        { kind: 'turret', at: at(30, 12), yaw: FACE },
        { kind: 'turret', at: at(30, -12), yaw: FACE },
        { kind: 'eweb', at: [18, 4], yaw: FACE },
        { kind: 'eweb', at: [4, -18], yaw: FACE },
        { kind: 'hothconsole', at: [10, -6], yaw: FACE },
        ...[[-14, 8], [-12.4, 9.2], [16, 16]].map(([x, z], i) => ({ kind: 'empirecrate', at: [x, z], yaw: FACE + i * 0.4 })),
        { kind: 'cratecube', at: [-16, 2], yaw: 0.4 },
        ...[[0, 20], [20, -6], [-20, -16]].map(([x, z]) => ({ kind: 'lamp', at: [x, z], opts: IMP })),
        // steam off the coolant tanks
        { kind: 'smoke', at: at(-30, 18), abs: true, y: 50, solid: false, opts: { h: 30, n: 6, color: '#d8dce0', spread: 0.6 } },
      ],
    },
    {
      id: 'lava',
      name: 'The lava fields',
      at: T.FLATS,
      r: 60,
      flat: T.places.find((p) => p.id === 'lava').flat,
      about: 'Where the Charon River comes out into the open: a crust of black glass over rivers of fire, steaming. Don’t stop walking.',
      things: [
        { kind: 'lavaspout', at: [-26, -12], opts: { h: 16, lit: true } },
        { kind: 'lavaspout', at: [28, 40], opts: { h: 12 } },
        ...[[-30, 10], [10, -30], [40, 10]].map(([x, z]) => ({ kind: 'smoke', at: [x, z], solid: false, opts: { h: 36, n: 7, color: '#c9cdd2', spread: 0.7 } })),
      ],
    },
    {
      id: 'charon',
      name: 'The Charon River',
      at: [178, 4],
      r: 26,
      about: 'The lava river runs from the sewers under the city out through this tunnel mouth, and on down to the lava fields. IG-11 walked out of it alone.',
      things: [
        { kind: 'charonportal', at: rel([173, -12], [178, 4]), abs: true, y: T.BED, yaw: 0.25 },
        { kind: 'keelboat', at: rel([181, 20], [178, 4]), abs: true, y: T.LAVA - 0.3, yaw: 0.4 },
        { kind: 'smoke', at: rel([180, 10], [178, 4]), abs: true, y: T.LAVA, solid: false, opts: { h: 30, n: 6, color: '#9a8a80', spread: 0.6 } },
      ],
    },
    {
      id: 'bluff',
      name: 'The scouts’ bluff',
      at: T.BLUFF,
      r: 30,
      flat: T.places.find((p) => p.id === 'bluff').flat,
      about: 'A shoulder of the volcano over the town, where the Remnant’s scout troopers sat on their speeder bikes and watched the gate.',
      things: [
        { kind: 'speederbike', at: [3, 2], yaw: 2.4 },
        { kind: 'lothspire', at: [-14, 10], yaw: 0.6, opts: { h: 30, r: 7, seed: 31, color: '#26282d' } },
        { kind: 'lothspire', at: [12, -14], yaw: 2.2, opts: { h: 24, r: 6, seed: 32, color: '#26282d' } },
      ],
    },
    {
      id: 'homestead',
      name: 'Clan Mudhorn’s homestead',
      at: [-70, -120],
      r: 24,
      flat: { r: 14 },
      about: 'The cabin Greef Karga gave the Mandalorian and his foundling, a short walk from the city: a round door, a dome on the roof, mossy black rocks.',
      things: [
        { kind: 'mudhornhut', at: [0, 0], yaw: 1.0 },
        { kind: 'vaporator', at: [8, 6] },
        { kind: 'lamp', at: [-6, 8], opts: DARK },
        ...grove(9, 9, 10, 20, ['lavarock'], [0.6, 1.4]),
      ],
    },
    {
      id: 'fingers',
      name: 'The Fingers',
      at: [-200, -70],
      r: 60,
      about: 'Black lava spires standing out of the ash west of the landing, the western butte behind them. Good cover, if you’re being hunted.',
      things: FINGERS,
    },
  ],
  things: [
    // the guild's cargo where you set down
    { kind: 'cratecube', at: [14, 10], yaw: 0.4 },
    { kind: 'cratecube', at: [15.3, 10.5], yaw: 1.1 },
    { kind: 'barrel', at: [12.5, 12], yaw: 0.2 },
    { kind: 'empirecrate', at: [-16, -8], yaw: 2.3 },
    { kind: 'lamp', at: [18, 6], opts: DARK },
    // the volcano's plume, ash and steam
    { kind: 'smoke', at: T.CONE, abs: true, y: 310, solid: false, opts: { h: 260, n: 14, color: '#6f7176', spread: 4 } },
    { kind: 'smoke', at: [700, -400], abs: true, y: 352, solid: false, opts: { h: 180, n: 10, color: '#c8ccd2', spread: 2.6 } },
    // the vent on the volcano's foot, and its fall into the second river
    { kind: 'lavaspout', at: [433, -84], opts: { h: 18, lit: true } },
    { kind: 'lavafall', at: [431, -72], abs: true, y: 22.5, yaw: -0.11, opts: { w: 10, h: 21, bend: 1.0 } },
    // the lava channel under the base: where it wells up
    { kind: 'lavaspout', at: [-300, 58], opts: { h: 12 } },
    // the Remnant's TIEs and shuttle up on the escarpment, over the base
    { kind: 'parked', at: [-326, 300], yaw: 2.1, opts: { kind: 'tie', metres: 7 } },
    { kind: 'parked', at: [-312, 318], yaw: 2.1, opts: { kind: 'tie', metres: 7 } },
    { kind: 'parked', at: [-342, 318], yaw: 2.1, opts: { kind: 'tie', metres: 7 } },
    { kind: 'lambda', at: [-300, 342], yaw: 2.1 },
    { kind: 'lamp', at: [-320, 286], opts: IMP },
    { kind: 'lamp', at: [-296, 326], opts: IMP },
    // steam at the feet of the cliffs and the volcano
    ...[[-240, 104], [430, -96], [300, -120], [-306, -136], [60, 250], [262, 134]].map((p) => ({ kind: 'smoke', at: p, solid: false, opts: STEAM })),
  ],
  scatter: [
    { kind: 'lavarock', n: 70, within: [40, 560], scale: [0.4, 1.6], sink: 0.25, solid: 0.6, clear: 18 },
    { kind: 'lavarock', n: 30, within: [150, 800], scale: [2, 6], sink: 0.8, clear: 22 },
    { kind: 'blackspire', n: 110, within: [70, 585], scale: [1.6, 5], flat: 0.85, clear: 22, opts: { color: '#1d2024' } },
    { kind: 'basalt', n: 70, within: [40, 560], scale: [0.8, 2.2], flat: 0.9, clear: 12 },
    { kind: 'lavacrack', n: 420, within: [40, 585], scale: [1.4, 3.2], solid: false, clear: 8 },
    { kind: 'rock', n: 120, within: [20, 560], scale: [0.6, 2.4], clear: 10, opts: { color: '#24262a', sharp: 0.7 } },
    { kind: 'stones', n: 220, within: [8, 420], scale: [0.25, 0.8], solid: false, clear: 6, opts: { color: '#2b2b2f' } },
  ],
  rides: [{ kind: 'speederbike', at: [18, -6], yaw: 0.6 }],
  // (zones, life and quests: the current entry's, with the changes listed in the plan)
};
