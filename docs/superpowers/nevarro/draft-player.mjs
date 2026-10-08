// Player-first Nevarro (scratch): the whole site entry that would replace
// SITES.nevarro in src/components/galaxy/surface/sites/outer.js. Plain data
// plus the few helpers it needs (they'd sit at the top of outer.js, beside
// sky/palette/troops/ring).
import { grove } from '../../../src/components/galaxy/surface/sites/stand.js';

const PI = Math.PI;
const r1 = (v) => Math.round(v * 10) / 10;
const sky = (zenith, horizon, sun, extra = {}) => ({ zenith, horizon, haze: 0.8, hazeColor: horizon, suns: [{ az: 0.6, el: 0.35, color: sun, size: 0.016, glow: 1.1 }], clouds: { cover: 0.3, color: '#ffffff', shade: '#9aa0aa', scale: 0.6, speed: 0.005 }, ...extra });
const palette = (low, high, rock, accent, extra = {}) => ({ low, high, rock, accent, deep: rock, hLow: -4, hHigh: 14, rockAt: 0.4, accentCover: 0.25, ripple: { strength: 0.02, scale: 3, wind: 0.5 }, grain: 0.5, ...extra });
const hostile = (range, every, damage) => ({ range, every, damage, spread: 0.06 });
const troops = (tag, n, at, kind = 'stormtrooper') => ({ kind, n, at, spread: 12, roam: 5, hp: 2, tag, hostile: hostile(42, 2.3, 8) });
const turn = ([x, z], yaw) => [x * Math.cos(yaw) + z * Math.sin(yaw), -x * Math.sin(yaw) + z * Math.cos(yaw)];
// points every `step` metres from a to b, ends included
const line = (a, b, step) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.max(1, Math.round(L / step)); return Array.from({ length: n + 1 }, (_, i) => [r1(a[0] + ((b[0] - a[0]) * i) / n), r1(a[1] + ((b[1] - a[1]) * i) / n)]); };
// level ground stepping evenly from a to b (a road up a slope), as Naboo's
const ramp = (a, b, h0, h1, n, r, edge = r) => Array.from({ length: n + 1 }, (_, i) => ({ at: [r1(a[0] + ((b[0] - a[0]) * i) / n), r1(a[1] + ((b[1] - a[1]) * i) / n)], r, edge, h: r1(h0 + ((h1 - h0) * i) / n) }));
// facing the middle from a spot
const facing = ([x, z]) => r1(Math.atan2(-x, -z));
const H = PI / 2;

// ── The lie of it ──
// F: street level (the yard, the town's floor, the camp); the town's rock
// is 7 m over it, the escarpment 34
export const F = 5.5;
// Nevarro City's frame: its middle (the square) and its turn, local +z out
// through the gate to the landing yard, local +x up the ramp to the roofs
export const T = [150, -80];
export const TY = -1.08;
export const townAt = (l) => { const [x, z] = turn(l, TY); return [r1(T[0] + x), r1(T[1] + z)]; };
// the base's frame: local +z out over the cliff toward the landing
export const B = [-260, 160];
export const BY = 2.12;
export const baseAt = (l) => { const [x, z] = turn(l, BY); return [r1(B[0] + x), r1(B[1] + z)]; };

const LAMP = { h: 4.5, light: '#ffb070', color: '#2a2828' }; // the town's dark posts, warm
const IMP = { h: 5, light: '#cfe8ff', color: '#3a3e44' }; // the Empire's, cold
const STEAM = { h: 30, n: 7, color: '#c3c8ce', spread: 0.8 };
const VENT = { h: 70, n: 9, color: '#4a4648', spread: 1.3 };

// the Imperial road, from the yard straight up the cliff to the base's gate
const ROAD = [[-128, 79], [-222, 137]];
// the black canyon, from the flats up through the escarpment to its top,
// south of the base
const CANYON = [[-218, 30], [-322, 98]];
const canyonAt = (t) => [r1(CANYON[0][0] + (CANYON[1][0] - CANYON[0][0]) * t), r1(CANYON[0][1] + (CANYON[1][1] - CANYON[0][1]) * t)];
// the Charon's mouth, in the town rock's south face, and the run of lava out of it
const PORTAL = [146, -183];
const STREAM = [[145, -192], [139, -236]];
const streamYaw = r1(Math.atan2(STREAM[0][0] - STREAM[1][0], STREAM[0][1] - STREAM[1][1]) * 100) / 100; // (its -z downstream)
const streamLen = Math.round(Math.hypot(STREAM[1][0] - STREAM[0][0], STREAM[1][1] - STREAM[0][1]));
// the cantina, in the town's frame, and its door (the middle of its front, +z)
const CANTINA = [6, -19];
export const DOOR = townAt([6, -10.6]);
export const BACK = townAt([6, -7.6]);
// the covert's sunken yard, in the town's frame
const COVERT = [-62, -30];

// the domes, towers and aerials up on the town's rock, at roof level (local)
const ROOFS = [
  ...[[39, 30, 1.6], [-31.5, 36, 1.5], [-63, 44, 1.5], [-38.6, -55, 1.4], [-13, -83, 1.5], [30, -61, 1.7], [69, -49, 1.3], [44, -17, 1.3], [-35, -83, 1.3], [74, 20, 1.1], [29, 63, 1.1], [8, -48, 1.1], [62, -76, 1.2], [86, -28, 1.0]].map(([x, z, s], i) => ({ kind: 'nevarrodome', at: [x, z], yaw: i * 1.3, scale: s, sink: 0.4 })),
  ...[[50, 51], [-40, 60], [51, -60]].map(([x, z], i) => ({ kind: 'nevarrotower', at: [x, z], yaw: i * 0.9 + 0.3, sink: 0.3 })),
  ...[[57, 31], [-30, 54], [-37, -35], [22, -91], [80, -9]].map(([x, z], i) => ({ kind: 'vaporator', at: [x, z], yaw: i, scale: 1.3 })),
];
// the gate street (local x 0, z 30 → 94): shopfronts and houses both
// sides, their backs in the rock, stalls in front, a bridge over it
const GATE_STREET = [
  { kind: 'nevarrorow', at: [-11, 43], yaw: H },
  { kind: 'nevarrohouse', at: [-11.5, 62], yaw: H },
  { kind: 'nevarrohouse', at: [-11.5, 79], yaw: H },
  { kind: 'nevarrohouse', at: [11.5, 40], yaw: -H },
  { kind: 'nevarrorow', at: [11, 58], yaw: -H },
  { kind: 'nevarrotower', at: [11, 76], yaw: -H, sink: 0.2 },
  { kind: 'nevarrobridge', at: [0, 50], yaw: H, solid: false },
  ...[[-4.8, 36, H], [4.8, 48, -H], [-4.8, 54, H], [4.8, 66, -H], [-4.8, 70, H], [4.8, 84, -H]].map(([x, z, yaw]) => ({ kind: 'nevarrostall', at: [x, z], yaw })),
  ...[[-5.5, 31], [5.5, 62], [-5.5, 86]].map((at) => ({ kind: 'lamp', at, opts: LAMP })),
  { kind: 'barrel', at: [-3.2, 45], yaw: 0.4 },
  { kind: 'barrel', at: [-2.6, 46.1], yaw: 1.7 },
  { kind: 'cratecube', at: [3.4, 60], yaw: 0.3 },
  { kind: 'empirecrate', at: [3.2, 77], yaw: 1.2 },
  { kind: 'vaporator', at: [9, 93], yaw: 0.5 },
  // the gate, at the mouth of the cut (walk-through: its own box would bar it)
  { kind: 'nevarroarch', at: [0, 89], yaw: 0, solid: false, sink: 0.2 },
];
// the square (flat, r 30): the cantina across it from the gate, houses
// round its wall, Gideon's TIE on the dirt where it set down
const SQUARE = [
  { kind: 'nevarrocantina', at: CANTINA, yaw: 0 },
  ...[[-19.5, 16], [-24, -14], [24, -12]].map((at) => ({ kind: 'nevarrohouse', at, yaw: facing(at) })),
  { kind: 'nevarrorow', at: [21, 19], yaw: facing([21, 19]) },
  { kind: 'parked', at: [-6, 4], yaw: 0.6, opts: { kind: 'tie', metres: 7 } },
  ...[[-6, 14, H], [16, -2, -H]].map(([x, z, yaw]) => ({ kind: 'nevarrostall', at: [x, z], yaw })),
  ...[[13, 7], [-14, 4]].map((at) => ({ kind: 'lamp', at, opts: LAMP })),
  { kind: 'barrel', at: [-12, -6], yaw: 0.1 },
  { kind: 'empirecrate', at: [-10.5, -7.4], yaw: 2.2 },
];
// the back street (local [-28,-4] → [-108,-14]): the Client's safe house,
// then houses out to the rock's south edge
const BACK_STREET = [
  { kind: 'bunker', model: false, at: [-52, 3], yaw: PI, opts: { w: 14, d: 9 } },
  { kind: 'lamp', at: [-43, -1], opts: IMP },
  { kind: 'nevarrohouse', at: [-77, -0.5], yaw: PI },
  { kind: 'nevarrorow', at: [-96, -1.5], yaw: PI },
  { kind: 'nevarrohouse', at: [-90, -22.5], yaw: 0 },
  { kind: 'lamp', at: [-67, -17], opts: LAMP },
];

export const nevarro = {
  place: 'The landing yard outside Nevarro City',
  line: 'Black rock, rivers of fire, and a town that runs on bounties.',
  // (The Mandalorian's Nevarro: black volcanic rock and grey ash under a
  // cool steel-blue overcast, the haze grey, not brown; thinner than it
  // was, so the volcano behind the town reads through it)
  sky: sky('#5a6d8e', '#a9b5c3', '#ffe2c0', { clouds: { cover: 0.6, color: '#c9ced4', shade: '#4c5058', scale: 0.6, speed: 0.006 } }),
  fog: { color: '#9ca6b0', density: 0.0007 },
  light: { sun: 2.4, sky: '#b4c0d0', ground: '#3a3b40', ambient: 0.72 },
  dust: '#2c2c30',
  edge: 'Nothing out there but lava and ash. Nevarro City’s back the other way.',
  sound: { wind: 0.45, lava: 0.3, city: 0.25, ground: 'stone' },
  weather: [{ kind: 'ash', count: 700, color: '#6a6a70' }],
  ground: {
    detail: 'ash',
    detailLook: { color: 0.7, normal: 0.8 },
    seed: 21,
    layers: [
      { type: 'swell', scale: 380, height: 6 },
      { type: 'hills', scale: 120, height: 4 },
      // the range round the valley, close enough now to read through the haze
      { type: 'mountains', from: 700, to: 2200, height: 380, scale: 700 },
      // the lava's ropy crust
      { type: 'ridges', scale: 45, height: 1.8 },
      // the town's black rock: a lava tongue 7 m up, its streets cut down into it
      { type: 'island', at: [158, -84], r: 104, height: 7, core: 0.95, ragged: 0.1 },
      // the escarpment the Imperial base sits on, west: a 34 m cliff
      { type: 'island', at: [-590, 60], r: 360, height: 34, core: 0.94, ragged: 0.12 },
      // the volcano behind the town (ESE, 1.4 km): a broad foot and a cone
      { type: 'island', at: [1235, -660], r: 650, height: 130, core: 0.35, ragged: 0.18 },
      { type: 'island', at: [1235, -660], r: 320, height: 120, core: 0.08, ragged: 0.12 },
      // the scout troopers' rise, out on the plain toward the canyon: 12 m, rounded
      { type: 'island', at: [-100, -90], r: 70, height: 12, core: 0.25, ragged: 0.3 },
    ],
    flats: [
      // the Imperial road up the cliff to the base (17°)
      ...ramp(ROAD[0], ROAD[1], F, 37, 16, 7, 10),
      // the town's streets, cut down to street level through its rock: the
      // gate street (29 m between its walls) and the back street (25 m)
      ...line([0, 30], [0, 94], 8).map((l) => ({ at: townAt(l), r: 14.5, edge: 3, h: F })),
      ...line([-28, -4], [-108, -14], 8).map((l) => ({ at: townAt(l), r: 12.5, edge: 3, h: F })),
      // the ramp from the square up onto the town's roofs (10°)
      ...ramp(townAt([24, 6]), townAt([62, 12]), F, F + 7, 8, 6, 4),
      // the lava's bed out of the Charon's mouth
      ...line(STREAM[0], STREAM[1], 7).map((at) => ({ at, r: 6, edge: 6, h: F })),
    ],
    // the black canyon: a slot cut up through the escarpment, its floor rising 5.5 → 35
    pits: line(CANYON[0], CANYON[1], 7).map((at, i, all) => ({ at, r: 11, floor: r1(F + ((35 - F) * i) / (all.length - 1)) })),
    palette: palette('#26282e', '#36373d', '#1e2226', '#5a5a56', { mark: '#18191c' }),
  },
  land: { at: [0, 0], yaw: 1.45, h: F },
  lines: {
    out: {
      xwing: [['luke', 'Nevarro. Bounty hunters, black rock, and the Empire still hanging on up on that cliff.'], ['r2', '(A wary warble. It would rather stay with the ship.)']],
      falcon: [['han', 'Guild town. Keep your blaster where they can see it and your credits where they can’t.'], ['chewie', '(A low growl of agreement.)']],
      cruiser: [['morty', 'R-Rick, there’s a volcano. Right there. Right behind the town.'], ['rick', 'Every frontier town’s got one, Morty. It’s basically zoning.']],
      rv: [['jesse', 'Yo, this whole place is built on lava, Mr. White.'], ['walt', 'Cooled basalt, Jesse. Stay on the black and off the orange.']],
    },
  },
  places: [
    {
      id: 'yard',
      name: 'The landing yard',
      at: [36, -20],
      r: 30,
      flat: { r: 46, edge: 18, h: F },
      about: 'Where the guild’s ships set down, on black gravel outside the gate. Nevarro City is through the arch; the Imperial base is the dark slab up on the cliff to the west.',
      things: [
        // Dengar's Punishing One, a hunter in town on guild business, framing the yard
        { kind: 'parked', url: '/models/galaxy/punishingone.glb', metres: 21, at: [-6, -26], yaw: 1.9, opts: { kind: 'punishingone', metres: 21 } },
        // the marker blocks on the gravel, as the show has them: two rows
        // either side of the way to the gate
        ...[[-10, 2], [2, -4], [14, -10], [26, -16], [-14, -7], [-2, -13], [10, -19], [22, -25]].map(([x, z], i) => ({ kind: 'cratecube', at: [x, z], yaw: 0.45 + (i % 3) * 0.1 })),
        // cargo off a freighter, waiting on a sled
        { kind: 'cargosled', at: [-14, 6], yaw: 1.1 },
        { kind: 'barrel', at: [-17, 9], yaw: 0.2 },
        { kind: 'barrel', at: [-15.8, 9.6], yaw: 1.4 },
        { kind: 'empirecrate', at: [-19, 7], yaw: 2.3 },
        { kind: 'vaporator', at: [8, 18], yaw: 0.4 },
        { kind: 'lamp', at: [-6, 6], opts: LAMP },
        { kind: 'lamp', at: [20, -30], opts: LAMP },
      ],
    },
    {
      id: 'bazaar',
      name: 'The bazaar',
      at: townAt([0, 66]),
      r: 24,
      about: 'The street in from the gate, cut down into the black rock: stalls under orange awnings, a happabore that won’t move, and nobody asking where you got your money.',
      things: [],
    },
    {
      id: 'town',
      name: 'Nevarro City',
      at: T,
      yaw: TY,
      r: 34,
      flat: { r: 30, h: F, edge: 5 },
      about: 'The square at the heart of Nevarro City, where Moff Gideon’s TIE set down. Greef Karga’s cantina is the dark hall with the round door, and he has work for you.',
      lines: {
        xwing: [['luke', 'A TIE fighter, parked in the square like it owns the place.'], ['r2', '(An indignant squawk.)']],
        falcon: [['han', 'Cantina’s that one. There’s always a cantina.'], ['chewie', '(A hopeful rumble.)']],
        cruiser: [['morty', 'Everybody here has a gun, Rick. Everybody.'], ['rick', 'It’s a bounty hunters’ guild town, Morty. The guns are the economy.']],
        rv: [['walt', 'A whole economy built on finding people who don’t want to be found.'], ['jesse', 'Sounds like your old job, yo.']],
      },
      things: [...SQUARE, ...GATE_STREET, ...BACK_STREET, ...ROOFS],
    },
    {
      id: 'covert',
      name: 'The covert',
      at: townAt(COVERT),
      yaw: TY,
      r: 13,
      about: 'Smoke out of a sunken yard off the back street: the Mandalorians’ forge, where the sewers come up. The Armorer works the beskar here and asks nothing of you but the Creed.',
      pits: [{ at: [0, 0], r: 13, floor: F - 2.5 }],
      things: [
        { kind: 'fire', at: [0, -1] },
        { kind: 'welderrack', at: [5, -4], yaw: -0.6 },
        { kind: 'ammocan', at: [-4.5, -3], yaw: 0.3 },
        { kind: 'empirecrate', at: [-3.8, 3.4], yaw: 1.2 },
        { kind: 'empirecrate', at: [-2.3, 4.6], yaw: 0.4 },
        { kind: 'smoke', at: [0, -1], solid: false, opts: { h: 32, n: 7, color: '#5e5e64', spread: 0.6 } },
      ],
    },
    {
      id: 'roofs',
      name: 'The rooftops',
      at: townAt([64, 28]),
      r: 20,
      about: 'Up on the black rock over the streets, among the domes and the aerials: the whole town at your feet, the volcano behind it, and the Imperial base across the valley on its cliff.',
      lines: {
        xwing: [['luke', 'You can see the base from here. And they can see us.'], ['r2', '(A nervous two-tone whistle.)']],
        falcon: [['han', 'Nice view. Lousy neighbourhood.']],
        cruiser: [['morty', 'Whoa. The whole town’s, like, dug into the rock.'], ['rick', 'Cheaper than walls, Morty. And the lava keeps the rent down.']],
      },
      things: [],
    },
    {
      id: 'portal',
      name: 'The Charon’s mouth',
      at: PORTAL,
      r: 26,
      about: 'Where the Charon, the city’s underground river of lava, runs out of the rock and onto the flats. The heroes came out this way on a keelboat with a platoon waiting, and IG-11 walked out alone to meet it.',
      lines: {
        xwing: [['luke', 'A river of lava, under a whole town. Who builds on top of that?'], ['r2', '(A doubtful burble.)']],
        falcon: [['han', 'Bet the sewers smell great.'], ['chewie', '(A disgusted snort.)']],
        rv: [['jesse', 'The droid just walked out there? Into all of them?'], ['walt', 'He was protecting the child, Jesse. That was the whole of his programming. And he chose it.']],
      },
      things: [],
    },
    {
      id: 'crest',
      name: 'The Razor Crest',
      at: [40, -170],
      r: 30,
      flat: { r: 30, h: F },
      about: 'Din Djarin’s camp on the rock below the town: the Razor Crest, older than it looks and patched in more places than it should be, Kuiil’s blurrgs, a fire, and the Child.',
      lines: {
        xwing: [['luke', 'That gunship’s seen some fights.'], ['r2', '(An appreciative whistle at the patch-work.)']],
        falcon: [['han', 'Now that’s a ship with character. Like mine. Held together the same way, too.']],
        cruiser: [['morty', 'Rick, Rick, the little green guy. Look at the little green guy.'], ['rick', 'Don’t, Morty. Don’t get attached. Everyone in this galaxy wants that kid.']],
      },
      things: [
        { kind: 'razorcrest', at: [0, 0], yaw: 1.2 },
        { kind: 'fire', at: [12, 15] },
        { kind: 'barrel', at: [-9, 12], yaw: 0.4 },
        { kind: 'cratecube', at: [-10.5, 10.4], yaw: 1.1 },
        { kind: 'ammocan', at: [-8, 14.2], yaw: 2 },
        ...grove(83, 5, 22, 34, ['lavarock'], [1, 2.4]),
      ],
    },
    {
      id: 'lava',
      name: 'The lava flats',
      at: [130, -340],
      r: 60,
      about: 'A crust of black glass over rivers of fire, spitting and steaming all the way to the volcano. The death troopers came in across here. Don’t stop walking.',
      things: [
        { kind: 'lavaspout', at: [-20, 10], opts: { h: 16 } },
        { kind: 'lavaspout', at: [30, -24], opts: { h: 22 } },
        { kind: 'lavaspout', at: [6, 40], opts: { h: 12 } },
        ...[[40, 30], [-36, -30], [10, -50]].map((at) => ({ kind: 'smoke', at, solid: false, opts: VENT })),
        ...grove(41, 7, 6, 50, ['lavarock'], [1.8, 4.5]),
      ],
    },
    {
      id: 'canyon',
      name: 'The black canyon',
      at: canyonAt(0.5),
      r: 30,
      about: 'A slot in the escarpment, black walls thirty metres high, climbing to the back of the Imperial base. Somebody flew a TIE fighter down here once. Somebody else shot it.',
      lines: {
        xwing: [['luke', 'Tight. Like Beggar’s Canyon back home, only darker.'], ['r2', '(A worried whistle about the walls.)']],
        falcon: [['han', 'Flying a TIE through here? Kid had guts. Not much else, by the look of it.']],
        cruiser: [['morty', 'Rick, there’s a crashed TIE fighter down here.'], ['rick', 'Canyon chase, Morty. Never works out for the guy in the TIE.']],
      },
      things: [],
    },
    {
      id: 'base',
      name: 'The Imperial base',
      at: B,
      yaw: BY,
      r: 50,
      flat: { r: 40, h: 37, edge: 6 },
      about: 'An Imperial Remnant outpost on the lip of the cliff, coolant tanks along its face and a TIE on the pad. Still running, still guarding something. The road goes straight up to its gate; the canyon comes round the back.',
      lines: {
        xwing: [['luke', 'The Empire’s gone. Somebody should tell them.'], ['r2', '(A defiant blat.)']],
        falcon: [['han', 'Remnant. They never know when to quit.'], ['chewie', '(A rumble that means: so let’s help them.)']],
        cruiser: [['morty', 'They’re still doing the whole Empire thing, Rick. The Empire lost.'], ['rick', 'Nobody tells a franchise it’s over, Morty.']],
        rv: [['walt', 'Disciplined. Organised. And no one has told them the war is over.'], ['jesse', 'So, like, cops.']],
      },
      things: [],
    },
    {
      id: 'scouts',
      name: 'The scouts’ rise',
      at: [-100, -90],
      r: 24,
      about: 'A rise out on the plain where two scout troopers wait with a speeder bike and practise their aim on a can. It goes about as well as you’d think. Their bike gets you to the canyon fast.',
      things: [],
    },
    {
      id: 'vents',
      name: 'The steam vents',
      at: [40, 330],
      r: 45,
      about: 'Out on the northern flats the last flow is still cooling: steam out of every crack, a spout of fire now and then, and nothing living but the blurrgs, who seem to like it.',
      lines: {
        xwing: [['luke', 'The whole ground’s breathing, Artoo.'], ['r2', '(A nervous burble. It would like to stop standing on it.)']],
        cruiser: [['morty', 'It’s like, like the planet’s got a cold, Rick.'], ['rick', 'It’s got a mantle, Morty. Show some respect.']],
      },
      things: [
        ...[[0, 0], [-22, 14], [18, 20], [26, -16], [-14, -24]].map((at) => ({ kind: 'smoke', at, solid: false, opts: { h: 42, n: 7, color: '#d0d4d8', spread: 0.9 } })),
        { kind: 'lavaspout', at: [6, -4], opts: { h: 10, n: 8 } },
        ...grove(91, 6, 8, 40, ['lavarock'], [1, 2.8]),
      ],
    },
  ],
  things: [],
  probes: [[1235, -660, 'volcano top'], [-260, 160, 'base'], [-322, 98, 'canyon top'], [-270, 64, 'canyon mid'], [-100, -90, 'scouts rise'], [0, 900, 'mountains N 900'], [0, -1200, 'mountains S 1200'], [...townAt([0, 50]), 'gate street'], [...townAt([0, 104]), 'gate'], [...townAt([62, 12]), 'ramp top'], [...townAt([-62, -30]), 'covert'], [...PORTAL, 'portal'], [...STREAM[1], 'stream end']],
};

// ── What's in the rest of it (kept apart here for editing; inline in outer.js) ──
const place = (id) => nevarro.places.find((p) => p.id === id);
// the base, in its frame (+z out over the cliff, the road arriving at [0, 44])
place('base').things = [
  // the base itself: the long armoured slab, its tanks along the front, set back from the lip
  { kind: 'nevarrobase', at: [0, -18], yaw: 0 },
  // the gatehouse at the head of the road, E-Webs either side of it
  { kind: 'bunker', at: [-12, 26], yaw: 0.2 },
  { kind: 'eweb', at: [-4, 34], yaw: 0 },
  { kind: 'eweb', at: [4, 34], yaw: 0 },
  // the pad on the bastion's lip, and its TIE
  { kind: 'mpad', at: [22, 22], opts: { r: 12 } },
  { kind: 'parked', at: [22, 22], y: 1.25, yaw: 2.6, opts: { kind: 'tie', metres: 7 } },
  // barracks either side of the yard
  { kind: 'bunker', model: false, at: [-32, 0], yaw: H, opts: { w: 12, d: 8 } },
  { kind: 'bunker', model: false, at: [33, -4], yaw: -H, opts: { w: 12, d: 8 } },
  // the comms mast (its red beacon reads from the landing) and the sentry tower on the corner
  { kind: 'kmast', at: [24, -30] },
  { kind: 'lookout', at: [-24, 21], opts: { h: 18 } },
  // a probe droid on watch over the yard
  { kind: 'probe', at: [-14, 10], y: 2.6, yaw: 1 },
  ...[[-14, 14], [14, 12], [10, 34]].map((at) => ({ kind: 'lamp', at, opts: IMP })),
  { kind: 'empirecrate', at: [-20, -10], yaw: 0.1 },
  { kind: 'empirecrate', at: [-18.6, -10.8], yaw: 1.5 },
  { kind: 'cratecube', at: [16, -8], yaw: 0.6 },
  { kind: 'barrel', at: [17.2, -9.1], yaw: 0 },
  // coolant steam off the tanks
  { kind: 'smoke', at: [-16, -14], y: 12, solid: false, opts: STEAM },
];
// the canyon: a TIE that didn't make the turn, still smoking
place('canyon').things = [
  { kind: 'parked', at: [6, -4], yaw: 2.1, pitch: 0.45, roll: 1.1, sink: 1.2, solid: { r: 3.2 }, opts: { kind: 'tie', metres: 7, lift: 0.2 } },
  { kind: 'wrecksmoke', at: [6, -4], solid: false, opts: { h: 14 } },
  // boulders fallen down the walls, along the floor
  ...[[0.12, 5, 1.6], [0.2, -3.5, 2], [0.34, 4.5, 1.2], [0.62, -5, 1.8], [0.8, 5, 1.4]].map(([t, side, s], i) => { const p = canyonAt(t); return { kind: 'lavarock', at: [r1(p[0] + 0.548 * side + 270), r1(p[1] + 0.839 * side - 64)], yaw: i * 1.9, scale: s, sink: 0.3 }; }),
];
// the Charon's mouth: the portal in the rock face, the lava running out
// of it (a lava fall laid flat on its bed: the sheet runs along -z from
// its lip, so pitch atan(h / 1.2) and the glow at its foot sinks out of
// sight), the vent it pools into, smoke out of the tunnel
place('portal').things = [
  { kind: 'charonportal', at: [0, 0], yaw: -3.02, abs: true, y: F - 0.3 },
  { kind: 'lavafall', at: [STREAM[0][0] - PORTAL[0], STREAM[0][1] - PORTAL[1]], yaw: streamYaw, pitch: Math.round(Math.atan(streamLen / 1.2) * 1000) / 1000, abs: true, y: F + 0.12, solid: false, opts: { w: 5, h: streamLen, bend: 0 } },
  { kind: 'lavaspout', at: [STREAM[1][0] - PORTAL[0], STREAM[1][1] - PORTAL[1] - 4], opts: { h: 5, n: 6 } },
  { kind: 'smoke', at: [1, -8], solid: false, opts: { h: 30, n: 6, color: '#55525a', spread: 0.7 } },
  ...grove(61, 10, 10, 26, ['lavarock'], [0.8, 2.2]).filter((t) => Math.abs(t.at[0]) > 6 && t.at[1] < -4),
];
// the scouts' rise: their can on a rock
place('scouts').things = [
  ...grove(73, 6, 12, 34, ['lavarock'], [1, 2.6]),
  { kind: 'lavarock', at: [12, 8], scale: 1.2, yaw: 0.5 },
  { kind: 'barrel', at: [12, 8], y: 2.1, yaw: 0.3 },
  { kind: 'empirecrate', at: [-4, -3], yaw: 0.8 },
];
// out in the world: the road's lamps, the volcano's plume
nevarro.things = [
  ...[0.12, 0.32, 0.52, 0.72, 0.9].map((t, i) => { const s = i % 2 ? 1 : -1; const n = [-0.527 * s, -0.854 * s]; return { kind: 'lamp', at: [r1(ROAD[0][0] + (ROAD[1][0] - ROAD[0][0]) * t + n[0] * 8), r1(ROAD[0][1] + (ROAD[1][1] - ROAD[0][1]) * t + n[1] * 8)], opts: IMP }; }),
  // the volcano's own plume, off its top (out of reach: drawn, never walked)
  { kind: 'smoke', at: [1235, -660], abs: true, y: 318, solid: false, opts: { h: 260, n: 10, color: '#6e7076', spread: 6 } },
  // the fumaroles at the foot of the range
  ...[[-430, -330], [420, 300], [-200, 470]].map((at) => ({ kind: 'smoke', at, solid: false, opts: VENT })),
];
nevarro.scatter = [
  // black lava rock out past the town, the road and the canyon (scatter
  // doesn't keep off streets: inside 270 m the rocks are placed by hand)
  { kind: 'lavarock', n: 90, within: [275, 470], scale: [0.35, 1.6], sink: 0.25, solid: 0.6, flat: 0.85 },
  { kind: 'lavarock', n: 36, within: [320, 800], scale: [2, 5], sink: 0.6, flat: 0.85 },
  // the flats: glowing cracks in the crust, and spires of black rock
  { kind: 'lavacrack', n: 480, within: [270, 590], scale: [1.4, 3.2], solid: false, flat: 0.9 },
  { kind: 'blackspire', n: 40, within: [300, 600], scale: [1.5, 4.5], opts: { color: '#1e2024' }, flat: 0.8 },
  // grit underfoot
  { kind: 'stones', n: 200, within: [10, 400], scale: [0.25, 0.7], solid: false, opts: { color: '#2a2c30' } },
];
nevarro.life = [
  // the camp: the Mandalorian and the Child (his quest), Kuiil, Cara Dune, the blurrgs
  { kind: 'dindjarin', id: 'mando', at: [48, -160], still: true, face: 2.4, name: 'The Mandalorian', named: true, quest: 'protect', says: ['This is the Way.', 'I can bring you in warm, or I can bring you in cold.'] },
  { kind: 'grogu', at: [44, -156], still: true, face: 2.6, name: 'The Child', says: ['(He holds up a tiny hand, and looks very serious about it.)', '(A small coo.)'] },
  { kind: 'kuiil', at: [34, -151], still: true, face: 1.6, name: 'Kuiil', named: true, says: ['I have spoken.', 'The blurrgs know the way to town. Mind your feet on the crust.', 'Ugnaughts do not fight. We fix what fighting breaks.'] },
  { kind: 'caradune', at: [57, -174], still: true, face: 1.9, name: 'Cara Dune', named: true, says: ['The Remnant’s still dug in up on that cliff.', 'Death troopers. If they come, they come in across the flats.'] },
  { kind: 'blurrg', n: 2, at: [24, -186], spread: 8, roam: 10, speed: 0.8, r: 1 },
  // the town: IG-11 in the square, troopers at the safe house, locals in the bazaar
  { kind: 'ig11', at: townAt([-8, -2]), roam: 9, speed: 0.8, name: 'IG-11', named: true, says: ['I am a nurse droid. I am programmed to protect the child.', 'I have been reprogrammed. I was formerly a bounty hunter.'] },
  { kind: 'stormtrooper', n: 2, at: townAt([-52, -1]), spread: 3, roam: 2, speed: 0.6, name: 'Stormtrooper', says: ['The Client is not seeing visitors.', 'Move along. Guild business is in the cantina.'] },
  { kind: 'villager', n: 5, at: townAt([0, 62]), spread: 22, roam: 16, speed: 1, name: 'Nevarro local', says: ['The guild’s back in business. The Empire’s not.', 'Mind the happabore. It doesn’t mind you.'] },
  { kind: 'happabore', n: 1, at: townAt([0, 80]), roam: 5, speed: 0.4, r: 1.8 },
  { kind: 'mousedroid', n: 1, at: townAt([4, 8]), roam: 10, speed: 1.4, r: 0.2, solid: false },
  // the covert: the Armorer at her forge (the beskar, after Karga's puck)
  { kind: 'armorer', id: 'armorer', at: townAt([COVERT[0] + 2.5, COVERT[1] + 1]), still: true, face: 1.1, name: 'The Armorer', named: true, quest: 'forge', says: ['This is the Way.', 'Your armour is your honour. Do not trade it for credits.'] },
  // the yard: hunters, a sulky R5
  { kind: 'aqualish', n: 1, at: [24, -6], still: true, face: 0.8, name: 'Bounty hunter', says: ['Guild business. Keep walking.', 'Cantina’s in town, through the arch. Karga’s buying. Karga’s never buying.'] },
  { kind: 'twilek', at: [40, 8], still: true, face: 2.2, name: 'A Twi’lek hunter', says: ['That’s Dengar’s ship. Don’t touch it. Don’t even look at it.'] },
  { kind: 'r5', n: 1, at: [30, 12], roam: 6, speed: 0.6, name: 'An R5 unit', says: ['(A sulky beep. Somebody stole its restraining bolt. For the bolt.)'] },
  // the base: a patrol round the yard, an officer, the TIE's pilot
  { kind: 'stormtrooper', n: 4, path: [baseAt([-20, 14]), baseAt([20, 14]), baseAt([20, -4]), baseAt([-20, -4])], speed: 1.1, name: 'Remnant stormtrooper', says: ['Move along. This area is restricted.', 'Halt! Show your clearance.'] },
  { kind: 'officer', at: baseAt([0, -6]), still: true, face: BY, name: 'Imperial officer', says: ['The asset is not to leave this facility.', 'The Moff will hear of this.'] },
  { kind: 'tiepilot', at: baseAt([14, 20]), still: true, face: BY + 1, name: 'TIE pilot', says: ['Patrol’s at dusk. Stay off my pad.'] },
  // the scouts on their rise
  { kind: 'scouttrooper', n: 2, at: [-96, -92], spread: 3, roam: 1, speed: 0.4, name: 'Scout trooper', says: ['Bet you can’t hit that can from here.', '(He fires. The can doesn’t notice.)', 'These blasters pull left. Everybody knows that.'] },
  // the flats: blurrgs wandering, a pair of them
  { kind: 'blurrg', n: 2, at: [140, -320], spread: 20, roam: 24, speed: 0.9, r: 1 },
  { kind: 'blurrg', n: 2, at: [30, 320], spread: 16, roam: 20, speed: 0.8, r: 1 },
];
nevarro.rides = [
  { kind: 'speederbike', at: [-14, -22], yaw: -1.0 },
  { kind: 'speederbike', at: [-106, -84], yaw: -0.9 },
];
nevarro.zones = [
  {
    id: 'cantina',
    name: 'Greef Karga’s cantina',
    music: 'cantina',
    door: { at: DOOR, r: 2.6, prompt: 'Go into the cantina' },
    back: BACK,
    inside: { build: 'cantinainside', spawn: [0, 14.6], yaw: Math.PI, exit: { at: [0, 16], r: 1.5 }, bounds: [11.5, 17, 6.6], rooms: [[0, 13.6, 1.6, 3.1, 0, 3.2], [0, 0, 11, 11, 0, 6.6, 'round']], light: { sky: '#8a7a6a', ground: '#201814', ambient: 0.6, fog: '#14100c', density: 0.018 }, lamps: [[0, 3.6, -1, '#ffb070', 34, 16], [0, 3, -8.2, '#9a7dff', 20, 10], [-7, 2.6, 3, '#ff9a50', 16, 12], [7, 2.6, 3, '#ff9a50', 16, 12]] },
    life: [
      { kind: 'greef', id: 'greef', at: [-9.9, -0.8], still: true, face: 1.5, name: 'Greef Karga', named: true, quest: 'puck', says: ['I have a job. It pays well. It’s not for everyone.'] },
      { kind: 'wuher', at: [0, 0.8], still: true, face: 0, name: 'The barkeep', says: ['Guild members only past the bar.'] },
      { kind: 'aqualish', n: 2, at: [4, 4], spread: 2, roam: 2, speed: 0.5, name: 'Bounty hunter', says: ['Took a puck? So did I. Same one, probably.'] },
      { kind: 'twilek', at: [-4, 5], still: true, face: 2.4, name: 'A Twi’lek hunter', says: ['Mandalorians. Never take the helmet off.'] },
    ],
  },
];
nevarro.quests = [
  { id: 'puck', name: 'The bounty puck', giver: 'greef', intro: [['Greef Karga', 'A puck for you: the client wants an asset from the Imperial base up on the cliff. Alive. Questions are extra.']], steps: [{ type: 'reach', at: [-260, 160], r: 40, text: 'Go up to the Imperial base' }, { type: 'shoot', tag: 'basetroops', n: 6, text: 'Get past the guards', spawn: troops('basetroops', 6, [-260, 160]) }, { type: 'collect', item: 'asset', n: 1, spots: [[-252, 166]], text: 'Collect the asset' }, { type: 'talk', zone: 'cantina', actor: 'greef', text: 'Take it to Greef Karga' }], done: [['Greef Karga', 'The client is pleased. Here: a camtono of beskar. Don’t spend it all at once.']] },
  { id: 'protect', name: 'This is the Way', giver: 'mando', intro: [['The Mandalorian', 'Death troopers. They’ve tracked the kid here. Help me hold them off.']], steps: [{ type: 'shoot', tag: 'death', n: 5, text: 'Protect the Child from the death troopers', spawn: { ...troops('death', 5, [90, -210], 'deathtrooper'), hostile: { ...hostile(45, 2.6, 7), burst: { n: 3, gap: 0.1 }, strafe: { speed: 2.6, every: 2.2, keep: 14 } } } }], done: [['The Mandalorian', 'This is the Way.']] },
  { id: 'forge', name: 'The beskar', giver: 'armorer', after: ['puck'], intro: [['The Armorer', 'You were paid in beskar. It is not yours to spend. Bring it to the forge.']], steps: [{ type: 'use', id: 'forge', at: townAt(COVERT), r: 4, prompt: 'Lay the beskar on the forge', text: 'Bring the beskar to the Armorer’s forge', end: [{ shake: 0.3 }, { say: [[null, '(The ingots glow, soften and run. She works without a word.)']] }] }], done: [['The Armorer', 'It is done. Wear it with honour. This is the Way.']] },
];
nevarro.flyovers = [{ kind: 'tie', n: 2, metres: 7, alt: 90, speed: 100, every: 50 }];
// (scratch only: sizes for the map, the walk, and the new kinds)
nevarro.sizes = { nevarrohouse: 12, nevarrorow: 18, nevarrotower: 8, nevarrocantina: 20, nevarrobridge: 6, nevarrostall: 5, nevarrobase: 52, charonportal: 18, nevarrodome: 11, nevarroarch: 10.5, razorcrest: 23, bunker: 12, mpad: 24, kmast: 3, lookout: 7, lavafall: 5, parked: 7, lamp: 1.5, lavarock: 3 };
nevarro.route = [[0, -14], townAt([0, 89]), townAt([0, 66]), T, townAt([24, 6]), townAt([62, 12]), townAt([64, 28]), townAt([62, 12]), townAt([24, 6]), townAt([-28, -4]), townAt([-52, -7]), townAt([-62, -16]), townAt(COVERT), townAt([-62, -16]), townAt([-108, -14]), [140, -196], [139, -240], [130, -340], [90, -210], [48, -160], [-100, -90], CANYON[0], canyonAt(0.5), CANYON[1], baseAt([50, 8]), baseAt([-9.3, 3.7]), baseAt([0, 40]), ROAD[1], ROAD[0], [0, 0]];
