// What each planet on the universe map is like down on it, once the ship's
// set down there and the crew are out (G, ../footScene.js): pure data,
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
//   scatter     [{ kind, n, from, to, scale: [a, b], opts?, solid? }]: many
//               of a kind, drawn instanced, `from` to `to` metres out, clear
//               of the things and the ship (solid: false to walk through)
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

export const LANDINGS = {
  middleearth: {
    title: 'The Shire',
    sub: 'Middle-earth · Hobbiton, the day of the party',
    ground: { style: 'grass', colors: ['#4d7a2a', '#7aa544', '#a08c58'] },
    sky: { zenith: '#4f86d4', horizon: '#e4ecd6', sun: '#fff0c4' },
    things: [
      { kind: 'bagEnd', at: [-30, 30], r: 10 },
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
      { kind: 'rv', at: [-28, 16], r: 5, face: false, yaw: -1.2 },
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
      { kind: 'portal', at: [-20, 14], r: 1.6 },
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
      { kind: 'pavilion', at: [0, 40], r: 6 },
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
      optimus: { url: '/models/universe/optimus.glb', tall: 9.4 },
      megatron: { url: '/models/universe/megatron.glb', tall: 10 },
    },
    things: [
      { kind: 'optimus', at: [-22, 30], r: 3 },
      { kind: 'megatron', at: [26, 34], r: 3 },
      { kind: 'gate', at: [0, 46], r: 13 },
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
      { kind: 'hq', at: [0, 72], r: 31 },
      { kind: 'pad', at: [-44, 22], r: 14 },
      { kind: 'monument', at: [27, 28], r: 2.5 },
      { kind: 'hero', at: [-14, 22], r: 0.6, opts: { who: 'thor' } },
      { kind: 'hero', at: [-4, 25], r: 0.6, opts: { who: 'widow' } },
      { kind: 'hero', at: [6, 25], r: 0.6, opts: { who: 'ironman' } },
      { kind: 'hero', at: [15, 21], r: 1, opts: { who: 'hulk' } },
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
    things: [{ kind: 'lot', at: [0, 42], yaw: -Math.PI / 2, r: 0, strip: [23, 18] }],
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
      { kind: 'gameboy', at: [0, 50], r: 5 },
      { kind: 'mario', at: [-18, 22], r: 1 },
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
      { kind: 'airfield', at: [0, 46], r: 0, face: false, strip: [110, 16] },
      { kind: 'signpost', at: [-14, 20], r: 0.6 },
    ],
    scatter: [
      { kind: 'tree', n: 24, from: 26, to: 110, scale: range(1) },
      { kind: 'flowers', n: 300, from: 3, to: 80, scale: range(1), solid: false },
    ],
  },
  caribbean: {
    title: 'A Caribbean island',
    sub: 'Pirates of the Caribbean · ashore, the Pearl at anchor',
    ground: { style: 'sand', colors: ['#ecd9a6', '#dcc28a', '#b49a68'] },
    sky: { zenith: '#2a8ad8', horizon: '#d2f0f4', sun: '#fff8e0' },
    models: {
      pearl: { url: '/games/caribbean/pearl.glb', long: 46 },
      palm: { url: '/models/galaxy/surface/palm.glb', tall: 11 },
      chest: { url: '/games/caribbean/chest.glb', wide: 1.1 },
      skull: { url: '/games/caribbean/skull.glb', wide: 34 },
    },
    things: [
      { kind: 'sea', at: [0, 109], r: 0, face: false, strip: [130, 75], opts: { shore: -75, deep: 150 } },
      { kind: 'pearl', at: [-14, 82], r: 0, face: false, yaw: 1.2, solid: false },
      { kind: 'skull', at: [50, 80], r: 0, solid: false },
      { kind: 'rowboat', at: [-16, 26], r: 2.2, face: false, yaw: 0.3 },
      { kind: 'chest', at: [18, 20], r: 0.8 },
      { kind: 'cargo', at: [24, 14], r: 1.6 },
      { kind: 'fire', at: [-24, 8], r: 1 },
    ],
    scatter: [
      { kind: 'palm', n: 14, from: 24, to: 90, scale: range(1) },
      { kind: 'shells', n: 120, from: 3, to: 34, scale: range(1), solid: false },
    ],
  },
  invincible: {
    title: 'The Graysons’ city',
    sub: 'Invincible · after Omni-Man came through',
    ground: { style: 'asphalt', colors: ['#5d5e5c', '#6c6b68', '#c9b98a'] },
    sky: { zenith: '#3a5fa0', horizon: '#f0b07a', sun: '#ffd8a8' },
    things: [
      { kind: 'skyline', at: [0, 0], r: 0, face: false, around: true },
      { kind: 'crater', at: [-8, 36], r: 11 },
      { kind: 'wreck', at: [20, 24], r: 2.4, face: false, yaw: 0.7 },
      { kind: 'wreck', at: [-26, 18], r: 2.4, face: false, yaw: 2.2, opts: { color: '#2f4f7a', side: true } },
      { kind: 'wreck', at: [10, 48], r: 2.4, face: false, yaw: 1.4, opts: { color: '#c9c3b4' } },
    ],
    scatter: [
      { kind: 'rubble', n: 160, from: 4, to: 60, scale: range(1.2), solid: false },
      { kind: 'glass', n: 120, from: 3, to: 50, scale: range(1), solid: false },
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
