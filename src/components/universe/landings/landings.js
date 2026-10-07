// What each planet on the universe map is like down on it, once the ship's
// flown down onto it and the crew are out (../entry.js, ../footScene.js): pure data,
// tested in Node. Each planet's things are built by its own file
// (./<id>.js, loaded only when you land there; ./furnish.js puts them on
// the ground).
//
//   title, sub  the place's name on the card as you come down, and under it
//   ground      { style, colors: [a, b, c] }: the ground round you, up close
//               (./ground.js has the styles; a, b the main colours, c a
//               third for paths, seams, patches)
//   sky         { zenith, horizon, sun, space? }: the day sky (space: how
//               much of space shows through overhead by day, 0…1)
//   models      GLBs by kind: { url, tall | long | wide (metres: the size it's
//               brought to, by its height, its longest way along the ground
//               or its widest), yaw?, y? (a turn, a lift, in metres) }
//   things      [{ kind, at: [x, z], yaw?, face?, r, opts? }] in metres round
//               where the ship comes down, three.js's way round: +z ahead,
//               the way the ship faces, +x to its left (the door's on its
//               right, −x). r is how far it reaches along the ground; face
//               'spot' (left out) turns its front (+z) to the ship, false
//               leaves it as yaw has it from the ship's heading; strip:
//               [hw, hd], a long flat thing's half length and width (a
//               road), kept clear of the scatter but walked over; around:
//               laid out round the landing spot itself (a skyline: its
//               builder keeps its parts out past the things)
//               door: { label, at?, reach? }: G there goes into the planet's
//               page ('Into Bag End'), at a spot on the thing (its own
//               frame, metres) or by it; say: { name, line }: what someone
//               (a figure: kind 'figure', opts { url | meshy, tall }) says
//               when you come up to them
//   scatter     [{ kind, n, from, to, scale: [a, b], opts?, solid? }]: many
//               of a kind, drawn instanced, `from` to `to` metres out, clear
//               of the things and the ship (solid: false to walk through)
//   biomes      the parts of the planet you can come down on, read off the
//               colour of its map under the spot (./biomes.js): each its
//               own name, ground, sky (haze: the air along its horizon),
//               things and scatter, the planet's own where it leaves one
//               out; the last is the fallback, the landing as above
//
// A kind is one of `models`, or a builder in the planet's file (its PROPS
// for things, SCATTER or PROPS for scatter).

// how far from where the ship comes down anything solid stands (metres:
// the Falcon, the biggest, parks about 30 m long)
export const CLEAR = 22;
// the most of anything scattered a landing draws (phones: half)
export const SCATTER_MAX = 900;

const sz = 0.6; // (a scatter scale range's spread, as a share of its base)
const range = (k) => [k * (1 - sz / 2), k * (1 + sz / 2)];
// (a biome's test on its map colour, biomes.js's classify: h degrees, s and l 0…1)
const hue = (c, a, b) => c.h >= a && c.h <= b;

export const LANDINGS = {
  middleearth: {
    title: 'The Shire',
    sub: 'Middle-earth · Hobbiton, the day of the party',
    ground: { style: 'grass', colors: ['#4d7a2a', '#7aa544', '#a08c58'] },
    sky: { zenith: '#4f86d4', horizon: '#e4ecd6', sun: '#fff0c4' },
    things: [
      { kind: 'bagEnd', at: [-30, 30], r: 10, door: { label: 'Bag End', at: [0, 6.5], reach: 3 } },
      { kind: 'gandalf', at: [-18, 22], r: 0.5, say: { name: 'Gandalf', line: 'A wizard is never late, nor is he early.' } },
      { kind: 'hobbit', at: [14, 42], r: 0.4, say: { name: 'Sam', line: 'It’s the party of the century, Mr Frodo!' }, opts: { cloak: '#7a6a3a', pack: true } },
      { kind: 'hobbit', at: [-1, 41], r: 0.4, opts: { cloak: '#4b5a3a' } },
      { kind: 'hole', at: [-46, 4], r: 7, opts: { door: '#a83224', seed: 2 } },
      { kind: 'hole', at: [34, 36], r: 7, opts: { door: '#d8a92e', seed: 3 } },
      { kind: 'hole', at: [44, 8], r: 7, opts: { door: '#2f5f9a', seed: 5 } },
      { kind: 'partyTree', at: [6, 50], r: 7 },
      { kind: 'signpost', at: [-17, 18], r: 0.6, opts: { lines: ['Hobbiton', 'Bag End', 'The Green Dragon'] } },
      { kind: 'cart', at: [22, 24], r: 2.6, face: false, yaw: 0.6 },
      { kind: 'hayBale', at: [26, 21], r: 1 },
      { kind: 'beehive', at: [-40, 18], r: 0.6 },
      { kind: 'barrel', at: [-20, 20], r: 0.6 },
      { kind: 'mailbox', at: [-38, -6], r: 0.4 },
      { kind: 'scarecrow', at: [-30, -34], r: 0.6 },
      { kind: 'sheep', at: [30, -26], r: 0.9, face: false, yaw: 2.1, opts: { seed: 1 } },
      { kind: 'sheep', at: [36, -30], r: 0.9, face: false, yaw: 1.2, opts: { seed: 2 } },
      { kind: 'sheep', at: [28, -34], r: 0.9, face: false, yaw: 3.5, opts: { seed: 3 } },
      { kind: 'greenDragon', at: [8, -58], r: 10 },
    ],
    scatter: [
      { kind: 'oak', n: 8, from: 34, to: 110, scale: range(1), opts: { which: 0 } },
      { kind: 'oak', n: 8, from: 34, to: 110, scale: range(1), opts: { which: 1 } },
      { kind: 'oak', n: 7, from: 40, to: 110, scale: range(1), opts: { which: 2 } },
      { kind: 'flowers', n: 260, from: 5, to: 80, scale: range(1), solid: false },
      { kind: 'mushroom', n: 26, from: 6, to: 60, scale: range(1), solid: false },
      { kind: 'tufts', n: 320, from: 3, to: 70, scale: range(1), solid: false },
    ],
    // Tolkien's map (scripts/planets/middleearth.mjs): the Belegaer and the
    // inland seas; Mordor's black plain; Mirkwood's, Fangorn's and the Old
    // Forest's dark woods; the Misty, White and Grey Mountains, rock and
    // snow; Harad's sands; and the green of Eriador, Rohan and Gondor, the
    // Shire's
    biomes: [
      { id: 'sea', sea: true, match: (c) => hue(c, 185, 255) && c.s > 0.25 && c.l < 0.6 },
      {
        id: 'mordor',
        match: (c) => c.l < 0.3 && (c.s < 0.12 || c.h < 60 || c.h > 300),
        title: 'Mordor',
        sub: 'Middle-earth · the plateau of Gorgoroth, under Orodruin',
        ground: { style: 'sand', colors: ['#3a3330', '#4a403a', '#241e1c'] },
        sky: { zenith: '#3a2420', horizon: '#8a3a20', sun: '#ff6a30', haze: '#a8401c' },
        things: [
          { kind: 'orodruin', at: [-60, 230], r: 70, face: false, solid: false },
          { kind: 'baradDur', at: [170, 190], r: 24, face: false, yaw: -0.7, solid: false },
          { kind: 'fissure', at: [-26, 24], r: 3, face: false, yaw: 0.4 },
          { kind: 'fissure', at: [32, -20], r: 3, face: false, yaw: 2.2, opts: { seed: 5 } },
        ],
        scatter: [
          { kind: 'rock', n: 60, from: 24, to: 110, scale: range(2.2), opts: { color: '#2c2522', sharp: 0.8, seed: 4 } },
          { kind: 'stones', n: 200, from: 4, to: 80, scale: range(0.6), solid: false, opts: { color: '#3a302c' } },
          { kind: 'embers', n: 60, from: 6, to: 90, scale: range(1), solid: false },
        ],
      },
      {
        id: 'forest',
        match: (c) => (c.l < 0.26 && hue(c, 95, 170)) || (c.l < 0.22 && hue(c, 60, 170)),
        title: 'The old forest',
        sub: 'Middle-earth · under the eaves, where the trees are older than the Shire',
        ground: { style: 'grass', colors: ['#26381c', '#34481f', '#4a3a26'] },
        sky: { zenith: '#557a8a', horizon: '#a8b49a', sun: '#f0e6c0' },
        things: [],
        scatter: [
          { kind: 'oak', n: 30, from: 24, to: 110, scale: range(1.2), opts: { which: 0 } },
          { kind: 'oak', n: 30, from: 24, to: 110, scale: range(1.2), opts: { which: 1 } },
          { kind: 'oak', n: 30, from: 26, to: 110, scale: range(1.2), opts: { which: 2 } },
          { kind: 'mushroom', n: 60, from: 4, to: 70, scale: range(1), solid: false },
          { kind: 'tufts', n: 160, from: 3, to: 70, scale: range(0.8), solid: false },
        ],
      },
      {
        id: 'mountains',
        match: (c) => (c.s < 0.15 && c.l >= 0.35 && !(hue(c, 90, 170) && c.s > 0.08)) || c.l > 0.8,
        title: 'The mountains',
        sub: 'Middle-earth · high on a pass, the snow above',
        ground: { style: 'sand', colors: ['#7c7872', '#8e8a84', '#eef0f2'] },
        sky: { zenith: '#3f72c0', horizon: '#dfe6ee', sun: '#fff8ea' },
        things: [],
        scatter: [
          { kind: 'rock', n: 70, from: 24, to: 110, scale: range(2.4), opts: { color: '#7a766f', sharp: 0.7, seed: 6 } },
          { kind: 'rock', n: 40, from: 24, to: 110, scale: range(1.4), opts: { color: '#e8ecf0', sharp: 0.3, seed: 8 } },
          { kind: 'stones', n: 160, from: 4, to: 80, scale: range(0.6), solid: false, opts: { color: '#6e6a64' } },
        ],
      },
      {
        id: 'harad',
        match: (c, at) => hue(c, 20, 60) && c.s > 0.15 && c.l > 0.42 && (!at || (at[0] < 10 && at[1] > -20 && at[1] < 90)),
        title: 'Harad',
        sub: 'Middle-earth · the sands of the Haradrim, far south of Gondor',
        ground: { style: 'sand', colors: ['#d8b880', '#c8a468', '#9a7848'] },
        sky: { zenith: '#3f78c8', horizon: '#f2dcb0', sun: '#fff2d0' },
        things: [],
        scatter: [
          { kind: 'rock', n: 30, from: 24, to: 110, scale: range(1.6), opts: { color: '#a88a60', seed: 3 } },
          { kind: 'stones', n: 140, from: 4, to: 80, scale: range(0.5), solid: false, opts: { color: '#8a6e4c' } },
          { kind: 'scrub', n: 60, from: 5, to: 90, scale: range(0.8), solid: false },
        ],
      },
      { id: 'shire' },
    ],
  },

  breakingbad: {
    title: 'The desert',
    sub: 'Breaking Bad · out past Albuquerque, where the RV cooks',
    ground: { style: 'sand', colors: ['#e6c896', '#d6b07e', '#a8845e'] },
    sky: { zenith: '#2f74cc', horizon: '#f0dcbc', sun: '#fff6dc' },
    models: {
      rv: { url: '/models/albuquerque/world/rv.glb', long: 8.5 },
      cactus: { url: '/models/sketchfab/cactus.glb', tall: 4.2 },
      tumbleweed: { url: '/models/sketchfab/tumbleweed.glb', wide: 1.1 },
      tower: { url: '/models/sketchfab/watertower.glb', tall: 14 },
      barrel: { url: '/models/metherria/drum-blue.glb', tall: 0.9 },
      bucket: { url: '/models/sketchfab/bucket.glb', tall: 0.42 },
      car: { url: '/models/albuquerque/world/aztek.glb', long: 4.6 },
    },
    things: [
      { kind: 'rv', at: [-28, 16], r: 5, face: false, yaw: -1.2, door: { label: 'the RV', reach: 7 } },
      { kind: 'figure', at: [-36, 24], r: 0.4, say: { name: 'Saul', line: 'Better call Saul!' }, opts: { url: '/models/albuquerque/saul.glb', tall: 1.78 } },
      { kind: 'figure', at: [26, 38], r: 0.4, say: { name: 'Mike', line: 'No more half measures.' }, opts: { url: '/models/albuquerque/mike.glb', tall: 1.8 } },
      { kind: 'barrel', at: [-23, 11], r: 0.5 },
      { kind: 'barrel', at: [-22.2, 12.1], r: 0.5 },
      { kind: 'barrel', at: [-23.4, 12.6], r: 0.5 },
      { kind: 'bucket', at: [-21.5, 14], r: 0.3 },
      { kind: 'cook', at: [-22, 22.5], r: 1.6 },
      { kind: 'car', at: [-40, 30], r: 2.6, face: false, yaw: 0.9 },
      { kind: 'tower', at: [34, 48], r: 4 },
      { kind: 'mesa', at: [-10, 78], r: 18, face: false },
      { kind: 'mesa', at: [64, -30], r: 16, face: false, yaw: 1.3, opts: { seed: 4 } },
      { kind: 'mesa', at: [-70, -40], r: 18, face: false, yaw: 2.6, opts: { seed: 7 } },
    ],
    scatter: [
      { kind: 'cactus', n: 12, from: 26, to: 100, scale: range(1) },
      { kind: 'tumbleweed', n: 10, from: 10, to: 60, scale: range(1), solid: false },
      { kind: 'rock', n: 70, from: 24, to: 110, scale: range(1.6), opts: { color: '#a07a56' } },
      { kind: 'stones', n: 160, from: 4, to: 70, scale: range(0.5), solid: false, opts: { color: '#8a6a4e' } },
      { kind: 'scrub', n: 120, from: 5, to: 90, scale: range(1), solid: false },
    ],
    // New Mexico (scripts/planets/breakingbad.mjs): Albuquerque where the
    // bake puts it (35° N on the face shown first, its CITY's 0.045 rad
    // round), White Sands' gypsum in the southern basins, the malpais' black
    // lava, the ranges' granite, juniper and pine, and the high desert
    biomes: [
      {
        id: 'city',
        near: [35, 0, 2.6],
        title: 'Albuquerque',
        sub: 'Breaking Bad · a lot off Central Avenue, by Los Pollos Hermanos',
        ground: { style: 'asphalt', colors: ['#5a5a58', '#6a6966', '#e8e2c8'] },
        sky: { zenith: '#2f74cc', horizon: '#f0dcbc', sun: '#fff6dc' },
        models: {
          pollos: { url: '/models/albuquerque/world/pollos.glb', wide: 22 },
          carwash: { url: '/models/albuquerque/world/carwash.glb', wide: 20 },
          suv: { url: '/models/albuquerque/world/suv.glb', long: 5 },
        },
        things: [
          { kind: 'pollos', at: [0, 52], r: 14, door: { label: 'Los Pollos Hermanos', reach: 9 } },
          { kind: 'carwash', at: [-48, 26], r: 13, yaw: 0.3 },
          { kind: 'figure', at: [6, 34], r: 0.4, say: { name: 'Gus', line: 'I hide in plain sight, same as you.' }, opts: { url: '/models/albuquerque/gus.glb', tall: 1.85 } },
          { kind: 'car', at: [24, 30], r: 2.6, face: false, yaw: 1.6 },
          { kind: 'suv', at: [30, 22], r: 2.6, face: false, yaw: 1.5 },
        ],
        scatter: [{ kind: 'stones', n: 60, from: 4, to: 60, scale: range(0.4), solid: false, opts: { color: '#8a8478' } }],
      },
      {
        id: 'sands',
        match: (c, at) => c.l > 0.84 && c.s < 0.4 && (!at || at[0] < 34),
        title: 'White Sands',
        sub: 'Breaking Bad · the gypsum dunes, south toward Alamogordo',
        ground: { style: 'sand', colors: ['#f4f1ea', '#e6e0d2', '#cfc4ae'] },
        sky: { zenith: '#2466cc', horizon: '#e6eef6', sun: '#ffffff' },
        things: [
          { kind: 'rv', at: [-28, 16], r: 5, face: false, yaw: -1.2, door: { label: 'the RV', reach: 7 } },
          { kind: 'figure', at: [-34, 24], r: 0.4, say: { name: 'Jesse', line: 'Yeah, science!' }, opts: { url: '/models/albuquerque/jesse.glb', tall: 1.75 } },
        ],
        scatter: [
          { kind: 'dune', n: 26, from: 30, to: 110, scale: range(1), solid: false },
          { kind: 'scrub', n: 40, from: 5, to: 90, scale: range(0.8), solid: false },
          { kind: 'tumbleweed', n: 6, from: 10, to: 60, scale: range(1), solid: false },
        ],
      },
      {
        id: 'malpais',
        match: (c) => c.l < 0.3 && c.s < 0.18,
        title: 'The malpais',
        sub: 'Breaking Bad · the black lava flows, out past Carrizozo',
        ground: { style: 'sand', colors: ['#3b3430', '#524640', '#5a2e22'] },
        sky: { zenith: '#2a6ccc', horizon: '#ecdcc4', sun: '#fff4d8' },
        things: [
          { kind: 'rv', at: [-28, 16], r: 5, face: false, yaw: -1.2, door: { label: 'the RV', reach: 7 } },
          { kind: 'cook', at: [-22, 22.5], r: 1.6 },
        ],
        scatter: [
          { kind: 'rock', n: 90, from: 24, to: 110, scale: range(1.8), opts: { color: '#3b3430', sharp: 0.9, seed: 9 } },
          { kind: 'stones', n: 200, from: 4, to: 80, scale: range(0.6), solid: false, opts: { color: '#2e2826' } },
          { kind: 'scrub', n: 50, from: 5, to: 90, scale: range(0.8), solid: false },
        ],
      },
      {
        id: 'mountains',
        match: (c) => c.l < 0.45 && c.s < 0.4,
        title: 'The mountains',
        sub: 'Breaking Bad · up among the juniper and the granite, the valley far below',
        ground: { style: 'sand', colors: ['#8a7a68', '#74675a', '#b8a890'] },
        sky: { zenith: '#2a6ccc', horizon: '#e6dccb', sun: '#fff6dc' },
        things: [
          { kind: 'car', at: [-26, 22], r: 2.6, face: false, yaw: 0.9, door: { label: 'the Aztek, back down to the city', reach: 4 } },
          { kind: 'mesa', at: [-10, 90], r: 22, face: false, opts: { seed: 9, h: 40, r: 22 } },
          { kind: 'mesa', at: [80, 40], r: 20, face: false, yaw: 1.1, opts: { seed: 3, h: 34, r: 20 } },
        ],
        scatter: [
          { kind: 'rock', n: 80, from: 24, to: 110, scale: range(2), opts: { color: '#7a6a5a', sharp: 0.7, seed: 5 } },
          { kind: 'juniper', n: 40, from: 24, to: 110, scale: range(1) },
          { kind: 'stones', n: 160, from: 4, to: 70, scale: range(0.5), solid: false, opts: { color: '#6a5c4e' } },
          { kind: 'scrub', n: 60, from: 5, to: 90, scale: range(1), solid: false },
        ],
      },
      { id: 'desert' },
    ],
  },

  rickmorty: {
    title: 'Dimension C-137',
    sub: 'Rick and Morty · the Smiths’ street',
    ground: { style: 'grass', colors: ['#4f9a3c', '#86bf52', '#8d8a82'] },
    sky: { zenith: '#3f9be0', horizon: '#d8f3fb', sun: '#fff6d8' },
    models: {
      house: { url: '/models/c137/smith-house.glb', wide: 17 },
      school: { url: '/models/c137/school.glb', wide: 34 },
      limo: { url: '/models/c137/limo.glb', long: 9 },
      fedship: { url: '/models/c137/fedship.glb', wide: 14 },
      shoneys: { url: '/models/c137/shoneys.glb', wide: 20 },
    },
    things: [
      { kind: 'road', at: [0, 32], r: 0, face: false, strip: [70, 7] },
      { kind: 'house', at: [-24, 50], r: 11 },
      { kind: 'school', at: [42, 66], r: 20 },
      { kind: 'limo', at: [-4, 30], r: 4.6, face: false },
      { kind: 'portal', at: [-20, 14], r: 1.6, door: { label: 'the portal', reach: 3 } },
      { kind: 'figure', at: [-30, 37.5], r: 0.4, opts: { meshy: 'beth', tall: 1.7 } },
      { kind: 'figure', at: [-27, 37], r: 0.4, say: { name: 'Jerry', line: 'Hungry for apples?' }, opts: { meshy: 'jerry', tall: 1.78 } },
      { kind: 'figure', at: [-23, 37.5], r: 0.4, say: { name: 'Summer', line: 'Ugh. Grandpa’s here again.' }, opts: { meshy: 'summer', tall: 1.65 } },
      { kind: 'figure', at: [6, 31], r: 0.4, say: { name: 'The President', line: 'Get in the limo, Rick.' }, opts: { meshy: 'president', tall: 1.88 } },
      { kind: 'hydrant', at: [-12, 26.5], r: 0.3 },
      { kind: 'mailbox', at: [-20, 37.5], r: 0.3 },
      { kind: 'fedship', at: [34, -8], r: 8 },
      { kind: 'shoneys', at: [-50, -30], r: 12 },
    ],
    scatter: [
      { kind: 'tree', n: 18, from: 30, to: 100, scale: range(1) },
      { kind: 'bush', n: 40, from: 22, to: 90, scale: range(1) },
      { kind: 'plumbus', n: 4, from: 12, to: 40, scale: range(1), solid: false },
    ],
    // the show's world (scripts/planets/rickmorty.mjs): its purple and pink
    // hills, out past town; the rest is the Smiths' street
    biomes: [
      {
        id: 'hills',
        match: (c) => hue(c, 250, 350) && c.s > 0.25,
        title: 'The purple hills',
        sub: 'Rick and Morty · out past town, where the portal came out',
        ground: { style: 'grass', colors: ['#7a4aa8', '#9a6ac8', '#e88ac0'] },
        sky: { zenith: '#3f9be0', horizon: '#e8d8fb', sun: '#fff6d8' },
        things: [
          { kind: 'portal', at: [-20, 14], r: 1.6, door: { label: 'the portal', reach: 3 } },
          { kind: 'figure', at: [-14, 22], r: 0.4, say: { name: 'Rick', line: 'Wubba lubba dub dub!' }, opts: { meshy: 'rick', tall: 1.85 } },
        ],
        scatter: [
          { kind: 'bush', n: 50, from: 22, to: 100, scale: range(1.2), opts: { color: '#c86ab8' } },
          { kind: 'plumbus', n: 6, from: 12, to: 50, scale: range(1), solid: false },
        ],
      },
      { id: 'street' },
    ],
  },

  // (the rest get their own ground and sky now, and their things in turn)
  music: {
    title: 'The courtyard',
    sub: 'Indian classical music · dusk, and the lamps lit',
    ground: { style: 'tiles', colors: ['#d9b48a', '#c99d70', '#7a5a3c'] },
    sky: { zenith: '#1f2350', horizon: '#f2894a', sun: '#ffc27a' },
    models: {
      pavilion: { url: '/models/music/pavilion.glb', wide: 8 },
      gaddi: { url: '/models/music/gaddi.glb', wide: 2.6 },
      harmonium: { url: '/models/music/harmonium.glb', wide: 0.62 },
      tabla: { url: '/models/music/tabla.glb', wide: 0.62 },
      sitar: { url: '/models/music/sitar.glb', long: 1.22 },
      tanpura: { url: '/models/music/tanpura.glb', tall: 1.4 },
      lamp: { url: '/models/music/lamp.glb', tall: 1.25 },
    },
    things: [
      { kind: 'pavilion', at: [0, 40], r: 6, door: { label: 'the music room', reach: 8 } },
      { kind: 'recital', at: [0, 29], r: 1.6 },
      { kind: 'lamp', at: [-7, 26], r: 0.4 },
      { kind: 'lamp', at: [7, 26], r: 0.4 },
      { kind: 'lamp', at: [-9, 40], r: 0.4 },
      { kind: 'lamp', at: [9, 40], r: 0.4 },
      { kind: 'fountain', at: [-32, 16], r: 3.8 },
      { kind: 'screen', at: [36, 32], r: 10.5 },
      { kind: 'screen', at: [-46, 40], r: 10.5 },
      { kind: 'screen', at: [12, -46], r: 10.5 },
    ],
    scatter: [
      { kind: 'tree', n: 12, from: 30, to: 100, scale: range(1) },
      { kind: 'marigolds', n: 180, from: 5, to: 70, scale: range(1), solid: false },
      { kind: 'petals', n: 260, from: 3, to: 40, scale: range(1), solid: false },
      { kind: 'diyas', n: 70, from: 4, to: 45, scale: range(1), solid: false },
    ],
  },
  transformers: {
    title: 'Cybertron',
    sub: 'Transformers · the plating outside Iacon',
    ground: { style: 'plating', colors: ['#3e4350', '#2a2e37', '#7fd8ff'] },
    sky: { zenith: '#170f2e', horizon: '#6a4c8a', sun: '#d8c8ff', space: 0.5 },
    models: {
      optimus: { url: '/models/cybertron/optimus-orbit.glb', tall: 9.4 },
      megatron: { url: '/models/cybertron/megatron-orbit.glb', tall: 10.5 },
    },
    things: [
      { kind: 'optimus', at: [-22, 30], r: 3 },
      { kind: 'megatron', at: [26, 34], r: 3 },
      { kind: 'gate', at: [0, 46], r: 13, door: { label: 'the gate to Iacon', reach: 7 } },
      { kind: 'figure', at: [-11, 27], r: 0.8, say: { name: 'Bumblebee', line: '[a burst of radio] …roll out!' }, opts: { url: '/games/meshy/rollout/bumblebee.glb', tall: 4.8 } },
      { kind: 'tower', at: [-50, 62], r: 8, opts: { seed: 2, w: 14 } },
      { kind: 'tower', at: [48, 70], r: 7, opts: { seed: 5, w: 12, color: '#4a4f5c', glow: '#ff5a3a' } },
      { kind: 'tower', at: [-12, 90], r: 9, opts: { seed: 9, w: 16 } },
      { kind: 'tower', at: [72, -20], r: 6, opts: { seed: 4, w: 11, glow: '#ff5a3a' } },
      { kind: 'tower', at: [-68, -30], r: 7, opts: { seed: 7, w: 13 } },
      { kind: 'energon', at: [-28, 8], r: 2.4 },
      { kind: 'energon', at: [30, 2], r: 2, opts: { seed: 4, s: 1.3, color: '#ff5adf' } },
      { kind: 'wreck', at: [12, -30], r: 3 },
      { kind: 'wreck', at: [-30, -20], r: 3, opts: { seed: 9 } },
    ],
    scatter: [
      { kind: 'shard', n: 140, from: 4, to: 90, scale: range(1), solid: false },
      { kind: 'crystals', n: 60, from: 8, to: 90, scale: range(1), solid: false },
    ],
  },
  marvel: {
    title: 'Avengers HQ',
    sub: 'Marvel · upstate, on the compound’s lawn',
    ground: { style: 'grass', colors: ['#5f8f3a', '#8fb85a', '#9a9a96'] },
    sky: { zenith: '#3f82cf', horizon: '#dfe9ef', sun: '#fff4dc' },
    models: {
      gauntlet: { url: '/models/universe/marvel.glb', tall: 5 },
    },
    things: [
      { kind: 'hq', at: [0, 72], r: 31, door: { label: 'the compound', at: [0, 8], reach: 5 } },
      { kind: 'pad', at: [-44, 22], r: 14 },
      { kind: 'monument', at: [27, 28], r: 2.5 },
      { kind: 'hero', at: [-14, 22], r: 0.6, opts: { who: 'thor' }, say: { name: 'Thor', line: 'Another!' } },
      { kind: 'hero', at: [-4, 25], r: 0.6, opts: { who: 'widow' } },
      { kind: 'hero', at: [6, 25], r: 0.6, opts: { who: 'ironman' } },
      { kind: 'hero', at: [15, 21], r: 1, opts: { who: 'hulk' }, say: { name: 'Hulk', line: 'Hulk… smash?' } },
      { kind: 'flag', at: [-15, 42], r: 0.3 },
      { kind: 'flag', at: [15, 42], r: 0.3 },
    ],
    scatter: [
      { kind: 'tree', n: 18, from: 34, to: 110, scale: range(1) },
      { kind: 'conifer', n: 14, from: 40, to: 110, scale: range(1) },
    ],
  },
  office: {
    title: 'Scranton Business Park',
    sub: 'The Office · the lot out back of Dunder Mifflin',
    ground: { style: 'asphalt', colors: ['#4e4f52', '#5d5e61', '#e8e2c8'] },
    sky: { zenith: '#9aa4ae', horizon: '#dcd8cf', sun: '#f2f0ea' },
    things: [
      { kind: 'lot', at: [0, 42], yaw: -Math.PI / 2, r: 0, strip: [23, 18], door: { label: 'Dunder Mifflin', at: [-16, 3.5], reach: 4 } },
      { kind: 'figure', at: [-7, 25], r: 0.4, say: { name: 'Michael', line: 'Would I rather be feared or loved? Easy. Both.' }, opts: { url: '/models/office/cast/michael.glb', tall: 1.75 } },
      { kind: 'figure', at: [-4, 24], r: 0.4, say: { name: 'Dwight', line: 'Fact: this lot is under my jurisdiction.' }, opts: { url: '/models/office/cast/dwight.glb', tall: 1.88 } },
      { kind: 'figure', at: [6, 25], r: 0.4, say: { name: 'Jim', line: '[looks at the camera]' }, opts: { url: '/models/office/cast/jim.glb', tall: 1.91 } },
    ],
    scatter: [
      { kind: 'paper', n: 70, from: 3, to: 70, scale: range(1), solid: false },
      { kind: 'reams', n: 5, from: 8, to: 30, scale: range(1), solid: false },
    ],
  },
  gaming: {
    title: 'Dot Matrix',
    sub: 'Gaming · four shades of green',
    ground: { style: 'pixel', colors: ['#306230', '#8bac0f', '#0f380f'] },
    sky: { zenith: '#8bac0f', horizon: '#9bbc0f', sun: '#e0f8d0' },
    models: {
      gameboy: { url: '/models/universe/gaming.glb', tall: 14 },
      mario: { url: '/models/universe/mario.glb', tall: 3.2 },
      piranha: { url: '/models/universe/piranha.glb', tall: 2.4 },
    },
    things: [
      { kind: 'gameboy', at: [0, 50], r: 5, door: { label: 'the Game Boy', reach: 8 } },
      { kind: 'mario', at: [-18, 22], r: 1, say: { name: 'Mario', line: 'It’s-a me!' } },
      { kind: 'pipe', at: [20, 26], r: 1.4, opts: { plant: 'piranha' } },
      { kind: 'pipe', at: [28, -14], r: 1.4, opts: { h: 2 } },
      { kind: 'blocks', at: [-6, 30], r: 2.5 },
      { kind: 'flagpole', at: [34, 46], r: 0.8 },
      { kind: 'cartridge', at: [-36, 14], r: 1.2, opts: { project: 0 } },
      { kind: 'cartridge', at: [-40, 27], r: 1.2, opts: { project: 1 } },
      { kind: 'cartridge', at: [-32, 39], r: 1.2, opts: { project: 2 } },
      { kind: 'cartridge', at: [-38, 1], r: 1.2, opts: { project: 3 } },
    ],
    scatter: [
      { kind: 'tree', n: 16, from: 30, to: 100, scale: range(1) },
      { kind: 'bush', n: 40, from: 6, to: 80, scale: range(1), solid: false },
    ],
  },
  travel: {
    title: 'Earth',
    sub: 'Travel · an airfield somewhere I’ve been',
    ground: { style: 'grass', colors: ['#4c7a34', '#76a04a', '#a39a7a'] },
    sky: { zenith: '#3c7fd6', horizon: '#d6e6f2', sun: '#fff6e2' },
    models: {
      plane: { url: '/models/sketchfab/earth-plane.glb', long: 36 },
    },
    things: [
      { kind: 'airfield', at: [0, 46], r: 0, face: false, strip: [110, 16], door: { label: 'the plane', at: [-24, 0], reach: 18 } },
      { kind: 'signpost', at: [-14, 20], r: 0.6 },
    ],
    scatter: [
      { kind: 'tree', n: 24, from: 26, to: 110, scale: range(1) },
      { kind: 'flowers', n: 300, from: 3, to: 80, scale: range(1), solid: false },
    ],
    // Earth: the sea (on to the nearest land), the ice caps, and land
    biomes: [
      { id: 'sea', sea: true, match: (c) => hue(c, 200, 250) && c.s > 0.3 && c.l < 0.5 },
      {
        id: 'ice',
        match: (c) => c.l > 0.78 && (c.s < 0.15 || (hue(c, 180, 260) && c.s < 0.5)),
        title: 'The ice',
        sub: 'Travel · as far as anyone goes, and not been yet',
        ground: { style: 'sand', colors: ['#eef2f6', '#dfe6ee', '#b8c4d0'] },
        sky: { zenith: '#3a6cb8', horizon: '#e8f0f8', sun: '#fffaf0' },
        things: [{ kind: 'signpost', at: [-14, 20], r: 0.6 }],
        scatter: [],
      },
      { id: 'land' },
    ],
  },
  caribbean: {
    title: 'A Caribbean island',
    sub: 'Pirates of the Caribbean · ashore, the Pearl at anchor',
    ground: { style: 'sand', colors: ['#ecd9a6', '#dcc28a', '#b49a68'] },
    sky: { zenith: '#2a8ad8', horizon: '#d2f0f4', sun: '#fff8e0' },
    models: {
      ship: { url: '/games/caribbean/pearl.glb', long: 46 },
      palm: { url: '/models/galaxy/surface/palm.glb', tall: 11 },
      chest: { url: '/games/caribbean/chest.glb', wide: 1.1 },
      skull: { url: '/games/caribbean/skull.glb', wide: 34 },
    },
    things: [
      { kind: 'sea', at: [0, 109], r: 0, face: false, strip: [130, 75], opts: { shore: -75, deep: 150 } },
      { kind: 'pearl', at: [-14, 82], r: 0, face: false, yaw: 1.2, solid: false },
      { kind: 'skull', at: [50, 80], r: 0, solid: false },
      { kind: 'rowboat', at: [-16, 26], r: 2.2, face: false, yaw: 0.3, door: { label: 'the rowboat, out to the Pearl', reach: 4 } },
      { kind: 'figure', at: [-10, 22], r: 0.4, say: { name: 'Jack', line: 'This is the day you will always remember…' }, opts: { url: '/games/caribbean/jack.glb', tall: 1.78 } },
      { kind: 'chest', at: [18, 20], r: 0.8 },
      { kind: 'cargo', at: [24, 14], r: 1.6 },
      { kind: 'fire', at: [-24, 8], r: 1 },
    ],
    scatter: [
      { kind: 'palm', n: 14, from: 24, to: 90, scale: range(1) },
      { kind: 'shells', n: 120, from: 3, to: 34, scale: range(1), solid: false },
    ],
    // the Caribbean (scripts/planets/caribbean.mjs): Tortuga where the bake
    // put it (its frame(20, π + 0.08)), the deep sea (on to the nearest
    // island), the banks' turquoise shallows, and an island's beach
    biomes: [
      {
        id: 'tortuga',
        near: [20, 4.6, 3],
        title: 'Tortuga',
        sub: 'Pirates of the Caribbean · the port, the Faithful Bride’s lamps lit',
        ground: { style: 'sand', colors: ['#b49a70', '#9a8260', '#6a5640'] },
        models: { port: { url: '/games/caribbean/port.glb', wide: 44 } },
        things: [
          { kind: 'sea', at: [0, 109], r: 0, face: false, strip: [130, 75], opts: { shore: -75, deep: 150 } },
          { kind: 'pearl', at: [-30, 92], r: 0, face: false, yaw: 1.2, solid: false },
          { kind: 'port', at: [34, 52], r: 22, yaw: -0.5 },
          { kind: 'rowboat', at: [-16, 26], r: 2.2, face: false, yaw: 0.3, door: { label: 'the rowboat, out to the Pearl', reach: 4 } },
          { kind: 'figure', at: [-8, 24], r: 0.4, say: { name: 'Jack', line: 'If every town in the world were like this one, no man would ever feel unwanted.' }, opts: { url: '/games/caribbean/jack.glb', tall: 1.78 } },
          { kind: 'cargo', at: [-30, 30], r: 1.6, opts: { seed: 3 } },
          { kind: 'cargo', at: [12, 24], r: 1.6, opts: { seed: 7 } },
          { kind: 'fire', at: [-26, 6], r: 1 },
        ],
        scatter: [{ kind: 'shells', n: 40, from: 3, to: 30, scale: range(1), solid: false }],
      },
      { id: 'sea', sea: true, match: (c) => hue(c, 195, 240) && c.l < 0.42 },
      {
        id: 'reef',
        match: (c) => hue(c, 155, 200) && c.l >= 0.4,
        title: 'A reef flat',
        sub: 'Pirates of the Caribbean · the shallows at low tide, the Pearl standing off',
        ground: { style: 'sand', colors: ['#e0d4a8', '#d0c294', '#5fbcb4'] },
        sky: { zenith: '#2a8ad8', horizon: '#d2f4f4', sun: '#fff8e0' },
        things: [
          { kind: 'sea', at: [0, 90], r: 0, face: false, strip: [130, 60], opts: { shore: -60, deep: 120 } },
          { kind: 'pearl', at: [-14, 82], r: 0, face: false, yaw: 1.2, solid: false },
          { kind: 'rowboat', at: [-16, 26], r: 2.2, face: false, yaw: 0.3, door: { label: 'the rowboat, out to the Pearl', reach: 4 } },
          { kind: 'figure', at: [-10, 22], r: 0.4, say: { name: 'Jack', line: 'Not all treasure is silver and gold, mate.' }, opts: { url: '/games/caribbean/jack.glb', tall: 1.78 } },
          { kind: 'chest', at: [18, 20], r: 0.8 },
        ],
        scatter: [
          { kind: 'shells', n: 260, from: 3, to: 60, scale: range(1), solid: false },
          { kind: 'coral', n: 90, from: 6, to: 60, scale: range(1), solid: false },
        ],
      },
      { id: 'beach' },
    ],
  },
  invincible: {
    title: 'The Graysons’ city',
    sub: 'Invincible · after Omni-Man came through',
    ground: { style: 'asphalt', colors: ['#5d5e5c', '#6c6b68', '#c9b98a'] },
    sky: { zenith: '#3a5fa0', horizon: '#f0b07a', sun: '#ffd8a8' },
    things: [
      { kind: 'skyline', at: [0, 0], r: 0, face: false, around: true },
      { kind: 'crater', at: [-8, 36], r: 11, door: { label: 'the city', reach: 13 } },
      { kind: 'figure', at: [6, 30], r: 0.4, say: { name: 'Mark', line: 'Think, Mark!' }, opts: { url: '/models/invincible/mark.glb', tall: 1.78 } },
      { kind: 'wreck', at: [20, 24], r: 2.4, face: false, yaw: 0.7 },
      { kind: 'wreck', at: [-26, 18], r: 2.4, face: false, yaw: 2.2, opts: { color: '#2f4f7a', side: true } },
      { kind: 'wreck', at: [10, 48], r: 2.4, face: false, yaw: 1.4, opts: { color: '#c9c3b4' } },
    ],
    scatter: [
      { kind: 'rubble', n: 160, from: 4, to: 60, scale: range(1.2), solid: false },
      { kind: 'glass', n: 120, from: 3, to: 50, scale: range(1), solid: false },
    ],
    // the war-worn world (scripts/build-invincible-planet.mjs): its pale
    // rust plateaus, out of town; the dark old sea beds, the city
    biomes: [
      {
        id: 'badlands',
        match: (c) => c.l > 0.55,
        title: 'The badlands',
        sub: 'Invincible · miles out of town, where the fight threw them',
        ground: { style: 'sand', colors: ['#c8865a', '#b07048', '#6a3a2a'] },
        sky: { zenith: '#3a5fa0', horizon: '#f0b07a', sun: '#ffd8a8' },
        things: [
          { kind: 'crater', at: [-8, 36], r: 11, door: { label: 'the city', reach: 13 } },
          { kind: 'figure', at: [6, 30], r: 0.4, say: { name: 'Mark', line: 'I’d still have you, Dad.' }, opts: { url: '/models/invincible/mark.glb', tall: 1.78 } },
          { kind: 'crater', at: [44, 60], r: 14, opts: { r: 12, seed: 8 } },
          { kind: 'wreck', at: [20, 24], r: 2.4, face: false, yaw: 0.7 },
        ],
        scatter: [
          { kind: 'rubble', n: 120, from: 4, to: 80, scale: range(1.4), solid: false },
          { kind: 'rock', n: 50, from: 24, to: 110, scale: range(1.8), opts: { color: '#8a4a30', sharp: 0.6, seed: 2 } },
        ],
      },
      { id: 'city' },
    ],
  },
  // ── the Rick and Morty system's moons, round the Citadel (universes.js's MOONS; ./rmmoons.js) ──
  gazorpazorp: {
    title: 'Gazorpazorp',
    sub: 'Rick and Morty · the men’s desert, the women’s gate',
    ground: { style: 'sand', colors: ['#c85a3a', '#e08a5a', '#8a3a2a'] },
    sky: { zenith: '#4a1a4a', horizon: '#f2b070', sun: '#ffd8a0' },
    things: [
      { kind: 'portal', at: [-20, 17], r: 1.6, door: { label: 'through the portal to C-137', reach: 3 } },
      { kind: 'gate', at: [0, 52], r: 6, face: false },
      { kind: 'figure', at: [0, 44], r: 0.4, say: { name: 'Mar-Sha', line: 'A boy. From the sky. We make an exception for a Morty.' }, opts: { meshy: 'marsha', tall: 2.3 } },
      { kind: 'figure', at: [22, 30], r: 0.5, say: { name: 'A Gazorpian', line: 'RAAARGH. (He throws a rock at a rock.)' }, opts: { meshy: 'gazorpian', tall: 2.8 } },
      { kind: 'figure', at: [26, 26], r: 0.5, opts: { meshy: 'gazorpian', tall: 2.8 } },
      { kind: 'figure', at: [-14, 34], r: 0.4, say: { name: 'Morty Jr.', line: 'Dad? You’re back? I wrote a book about you. It isn’t kind.' }, opts: { meshy: 'mortyjr', tall: 2.0 } },
      { kind: 'rock', at: [16, 44], r: 2.6, face: false, opts: { seed: 3, size: 2.4 } },
      { kind: 'rock', at: [-26, 24], r: 3, face: false, opts: { seed: 7, size: 3 } },
    ],
    scatter: [
      { kind: 'rock', n: 60, from: 24, to: 110, scale: range(1), opts: { color: '#8a3a2a' } },
      { kind: 'bone', n: 30, from: 20, to: 80, scale: range(1), solid: false },
    ],
  },
  squanch: {
    title: 'Planet Squanch',
    sub: 'Rick and Morty · Squanchy’s planet, red grass and cat trees',
    ground: { style: 'grass', colors: ['#b83a3a', '#d85a4a', '#7a2a2a'] },
    sky: { zenith: '#2a8a9a', horizon: '#f2d8b8', sun: '#fff0d8' },
    models: {
      house: { url: '/models/c137/rm/squanchy-house.glb', tall: 9 },
      guest: { url: '/models/c137/rm/magdalian-a.glb', tall: 1.55 },
      guest2: { url: '/models/c137/rm/magdalian-c.glb', tall: 1.6 },
    },
    things: [
      { kind: 'portal', at: [-20, 17], r: 1.6, door: { label: 'through the portal to C-137', reach: 3 } },
      { kind: 'house', at: [-16, 50], r: 4 },
      { kind: 'figure', at: [-8, 36], r: 0.4, say: { name: 'Squanchy', line: 'You squanch what you squanch, Morty. Welcome to my squanch.' }, opts: { meshy: 'squanchy', tall: 1.15 } },
      { kind: 'figure', at: [10, 40], r: 0.4, say: { name: 'Birdperson', line: 'Morty. You have come a long way. It is good to see a friend.' }, opts: { meshy: 'birdperson', tall: 2.0 } },
      { kind: 'guest', at: [4, 30], r: 0.4 },
      { kind: 'guest2', at: [16, 32], r: 0.4 },
      { kind: 'suckulent', at: [24, 44], r: 1.6, face: false },
      { kind: 'suckulent', at: [-28, 30], r: 1.6, face: false, opts: { seed: 5 } },
    ],
    scatter: [
      { kind: 'cattree', n: 10, from: 40, to: 120, scale: range(1) },
      { kind: 'suckulent', n: 24, from: 26, to: 100, scale: range(0.8) },
    ],
  },
  birdworld: {
    title: 'Bird World',
    sub: 'Rick and Morty · Birdperson’s home, the nest on the rocks',
    ground: { style: 'grass', colors: ['#4a8a3a', '#6aa84a', '#8a6a3a'] },
    sky: { zenith: '#3a7ad8', horizon: '#d8f0f8', sun: '#fff8e8' },
    models: {
      nest: { url: '/models/c137/rm/birdperson-house.glb', tall: 14 },
    },
    things: [
      { kind: 'portal', at: [-20, 17], r: 1.6, door: { label: 'through the portal to C-137', reach: 3 } },
      { kind: 'nest', at: [0, 56], r: 7 },
      { kind: 'figure', at: [-4, 40], r: 0.4, say: { name: 'Phoenixperson', line: '(A hum of servos. He looks at you for a long time, and does not fire.)' }, opts: { meshy: 'phoenixperson', tall: 2.05 } },
      { kind: 'figure', at: [12, 36], r: 0.4, say: { name: 'Unity', line: 'We are all of us. Welcome to Bird World, Morty. The locals are a little quiet.' }, opts: { meshy: 'unity', tall: 1.75 } },
      { kind: 'perch', at: [20, 46], r: 0.6, face: false },
      { kind: 'perch', at: [-22, 44], r: 0.6, face: false, opts: { h: 7 } },
      { kind: 'rock', at: [26, 30], r: 3, face: false, opts: { seed: 11, size: 3, color: '#6a6a60' } },
    ],
    scatter: [
      { kind: 'rock', n: 40, from: 26, to: 110, scale: range(1), opts: { color: '#6a6a60' } },
      { kind: 'feather', n: 50, from: 10, to: 70, scale: range(1), solid: false },
    ],
  },
  gearworld: {
    title: 'Gear World',
    sub: 'Rick and Morty · everything here is a gear, and so is everyone',
    ground: { style: 'plating', colors: ['#b88a3a', '#d8aa5a', '#6a4a2a'] },
    sky: { zenith: '#5a4a2a', horizon: '#d8b070', sun: '#ffe8b0' },
    models: {
      gearperson: { url: '/models/c137/rm/gearperson-a.glb', tall: 1.8 },
      gearperson2: { url: '/models/c137/rm/gearperson-b.glb', tall: 1.8 },
    },
    things: [
      { kind: 'portal', at: [-20, 17], r: 1.6, door: { label: 'through the portal to C-137', reach: 3 } },
      { kind: 'figure', at: [2, 38], r: 0.4, say: { name: 'Gearhead', line: 'Rick! Oh. Not Rick. Everyone’s best friend, Gearhead. Welcome to Gear World.' }, opts: { meshy: 'gearhead', tall: 1.8 } },
      { kind: 'gearperson', at: [-12, 34], r: 0.4 },
      { kind: 'gearperson2', at: [14, 30], r: 0.4 },
      { kind: 'bigcog', at: [0, 56], r: 8, face: false },
      { kind: 'cog', at: [24, 40], r: 3, face: false, opts: { r: 2.6 } },
      { kind: 'cog', at: [-26, 28], r: 2.4, face: false, opts: { r: 2, seed: 2 } },
    ],
    scatter: [
      { kind: 'cog', n: 40, from: 24, to: 110, scale: range(1) },
      { kind: 'bolt', n: 60, from: 10, to: 80, scale: range(1), solid: false },
    ],
  },
};

export const landingOf = (id) => LANDINGS[id] ?? null;

// a number from a planet's id, for laying its landing out the same for
// everyone who lands there
export function seedOf(id) {
  let h = 2166136261;
  for (const ch of String(id)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

// Where `n` of a scatter entry go ([{ x, z, s, yaw }], metres): spread
// evenly over the ring `from`…`to` out, each `reach` (its footprint at
// scale 1, metres) clear of the things (and, if it's solid, of the ship)
export function scatterSpots(entry, things, rand, { n = entry.n, reach = 0.5 } = {}) {
  const out = [];
  const [s0, s1] = entry.scale ?? [1, 1];
  for (let tries = 0; out.length < n && tries < n * 12; tries++) {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(entry.from ** 2 + rand() * (entry.to ** 2 - entry.from ** 2));
    const x = Math.sin(a) * d;
    const z = Math.cos(a) * d;
    const s = s0 + rand() * (s1 - s0);
    const r = reach * s;
    if (entry.solid !== false && d - r < CLEAR) continue;
    if (things.some((t) => (t.strip ? Math.abs(t.at[0] - x) < t.strip[0] + r && Math.abs(t.at[1] - z) < t.strip[1] + r : Math.hypot(t.at[0] - x, t.at[1] - z) < t.r + r + 1))) continue;
    out.push({ x, z, s, yaw: rand() * Math.PI * 2 });
  }
  return out;
}
