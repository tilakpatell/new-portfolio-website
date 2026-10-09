// The flight's planets: what a planet id flies over. Hoth is written out (the
// spec's example, Echo Base and all); the other authored planets and the
// Expanse's generated ones take their type's biome stacks (TYPE_BIOMES),
// their own seed and no POIs.
//
// Ids are lower case because the shared world's database takes nothing else
// (supabase/migrations' planets check); an Expanse planet is its sector.js id
// lowered, 'e:sx,sz:i:j', and either case is read back.
//
// Pure: no three.js. Runs on the page; the worker gets the spec it makes.
//
//   PLANETS → { id, name, type, seed }[] (50: the authored eight, then 42 of
//     the Expanse's from sectors (1,0), (0,1), (−1,0), (0,−1), (1,1) in order)
//   TYPE_BIOMES[type] → biomes ({ id, at, reach, base, relief })
//   planetSpecOf(id) → { id, name, seed, type, climate, biomes, pois, palette, clutter } | null

import { makeSector } from '../../../components/expanse/gen/sector.js';
import { UNIVERSE, hash64 } from '../../../components/expanse/gen/seed.js';
import { fold } from './fnl.js';

const CLIMATE = { frequency: 0.00025, warp: 400 };

// the stylised planets' ground: FastNoiseLite warped hard and folded
const toon = (height, frequency = 0.0012) => ({ type: 'fnl', noise: { type: 'simplex', fractal: 'pingpong', frequency, octaves: 3, warp: 600 }, height });

export const TYPE_BIOMES = {
  ice: [
    { id: 'plain', at: [0.2, 0.5], reach: 0.35, base: 0, relief: [{ type: 'swell', scale: 900, height: 24 }, { type: 'hills', scale: 180, height: 7 }] },
    { id: 'ridge', at: [0.8, 0.3], reach: 0.3, base: 40, relief: [{ type: 'ridges', scale: 700, height: 160 }, { type: 'hills', scale: 120, height: 10 }] },
    { id: 'glacier', at: [0.3, 0.9], reach: 0.3, base: 10, relief: [{ type: 'dunes', scale: 300, height: 14, wind: 0.4 }] },
  ],
  rock: [
    { id: 'flats', at: [0.3, 0.4], reach: 0.4, base: 0, relief: [{ type: 'swell', scale: 1200, height: 30 }, { type: 'hills', scale: 200, height: 12 }] },
    { id: 'crags', at: [0.75, 0.6], reach: 0.35, base: 30, relief: [{ type: 'ridges', scale: 600, height: 180 }] },
  ],
  lava: [
    { id: 'basalt', at: [0.4, 0.4], reach: 0.4, base: 0, relief: [{ type: 'swell', scale: 800, height: 20 }, { type: 'mesas', scale: 400, height: 40, cover: 0.2 }] },
    { id: 'cones', at: [0.8, 0.7], reach: 0.3, base: 20, relief: [{ type: 'ridges', scale: 500, height: 140 }] },
  ],
  ocean: [
    { id: 'shelf', at: [0.5, 0.5], reach: 0.5, base: 0, relief: [{ type: 'swell', scale: 1400, height: 12 }, { type: 'hills', scale: 260, height: 5 }] },
    { id: 'reef', at: [0.2, 0.8], reach: 0.3, base: 6, relief: [{ type: 'hills', scale: 90, height: 8 }] },
  ],
  gas: [
    // a gas giant's cloud deck, flown over as if it were ground
    { id: 'deck', at: [0.5, 0.5], reach: 0.6, base: 0, relief: [{ type: 'swell', scale: 2400, height: 60 }, { type: 'dunes', scale: 600, height: 18, wind: 1.1 }] },
  ],
  forest: [
    { id: 'meadow', at: [0.3, 0.6], reach: 0.4, base: 0, relief: [{ type: 'hills', scale: 300, height: 18 }] },
    { id: 'knolls', at: [0.7, 0.4], reach: 0.35, base: 10, relief: [toon(70)] },
  ],
  desert: [
    { id: 'erg', at: [0.3, 0.3], reach: 0.4, base: 0, relief: [{ type: 'dunes', scale: 260, height: 26, wind: 0.7 }] },
    { id: 'buttes', at: [0.75, 0.7], reach: 0.35, base: 5, relief: [toon(60, 0.0009), { type: 'mesas', scale: 500, height: 50, cover: 0.25 }] },
  ],
};
TYPE_BIOMES.ringed = TYPE_BIOMES.gas;

const PALETTES = {
  ice: { low: '#e9f0f7', high: '#ffffff', rock: '#6b7a8c', accent: '#9fb7d1' },
  rock: { low: '#8a7f73', high: '#a39383', rock: '#5c544c', accent: '#6f6a64' },
  lava: { low: '#2a2220', high: '#4a3a34', rock: '#1a1514', accent: '#ff6b4a' },
  ocean: { low: '#2f6f8f', high: '#9fd3c7', rock: '#3b5a66', accent: '#e8f4f0' },
  gas: { low: '#c9a77a', high: '#f0dcb4', rock: '#a07850', accent: '#fff2d8' },
  forest: { low: '#4f8f3a', high: '#9bd06a', rock: '#6b5a44', accent: '#e3f2b0' },
  desert: { low: '#e0b878', high: '#f4d9a2', rock: '#b07a4a', accent: '#fff1cf' },
};
PALETTES.ringed = PALETTES.gas;

const CLUTTER = {
  ice: [{ kind: 'rock', perKm2: 60 }, { kind: 'spire', perKm2: 6, depth: 5 }, { kind: 'debris', perKm2: 20 }],
  rock: [{ kind: 'rock', perKm2: 90 }, { kind: 'spire', perKm2: 4, depth: 5 }],
  lava: [{ kind: 'rock', perKm2: 70 }, { kind: 'spire', perKm2: 8, depth: 5 }],
  ocean: [{ kind: 'rock', perKm2: 20 }],
  gas: [],
  forest: [{ kind: 'rock', perKm2: 30 }, { kind: 'spire', perKm2: 10, depth: 5 }],
  desert: [{ kind: 'rock', perKm2: 40 }, { kind: 'debris', perKm2: 10 }],
};
CLUTTER.ringed = CLUTTER.gas;

// the authored eight; Hoth's seed is the spec's, the rest are their ids hashed
const AUTHORED = [
  { id: 'hoth', name: 'Hoth', type: 'ice', seed: 0x48f1a2c3, pois: [{ id: 'echo-base', name: 'Echo Base', at: [1200, -800], r: 220, edge: 160, h: 12 }] },
  { id: 'tatooine', name: 'Tatooine', type: 'desert' },
  { id: 'endor', name: 'Endor', type: 'forest' },
  { id: 'yavin', name: 'Yavin 4', type: 'forest' },
  { id: 'bespin', name: 'Bespin', type: 'gas' },
  { id: 'mustafar', name: 'Mustafar', type: 'lava' },
  { id: 'kamino', name: 'Kamino', type: 'ocean' },
  { id: 'dagobah', name: 'Dagobah', type: 'forest' },
].map((p) => ({ seed: fold(hash64('fly', p.id)), pois: [], ...p }));

const SECTORS = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1]];
const EXPANSE = [];
for (const [sx, sz] of SECTORS) {
  for (const s of makeSector(UNIVERSE, sx, sz).systems)
    for (const p of s.planets) if (EXPANSE.length < 42) EXPANSE.push({ id: p.id.toLowerCase(), name: p.name, type: p.type, seed: fold(p.seed) });
  if (EXPANSE.length >= 42) break;
}

export const PLANETS = [...AUTHORED, ...EXPANSE].map(({ id, name, type, seed }) => ({ id, name, type, seed }));

const specOf = (p, pois) => ({
  id: p.id,
  name: p.name,
  seed: p.seed,
  type: p.type,
  climate: CLIMATE,
  biomes: TYPE_BIOMES[p.type],
  pois,
  palette: PALETTES[p.type],
  clutter: CLUTTER[p.type],
});

const EXPANSE_ID = /^e:(-?\d+),(-?\d+):(\d+):(\d+)$/;

export function planetSpecOf(planetId) {
  if (typeof planetId !== 'string') return null;
  const id = planetId.toLowerCase();
  const authored = AUTHORED.find((p) => p.id === id);
  if (authored) return specOf(authored, authored.pois);
  const m = id.match(EXPANSE_ID);
  if (!m) return null;
  const [sx, sz, i, j] = m.slice(1).map(Number);
  const p = makeSector(UNIVERSE, sx, sz).systems[i]?.planets[j];
  if (!p || !TYPE_BIOMES[p.type]) return null;
  return specOf({ id, name: p.name, type: p.type, seed: fold(p.seed) }, []);
}
