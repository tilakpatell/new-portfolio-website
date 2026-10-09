// The flight's planets: what a planet id flies over. Hoth is written out
// (Echo Base and all); the other authored planets and the Expanse's
// generated ones take their type's biomes, colours and clutter (./tables.js:
// TYPE_BIOMES, its craters and islands scattered from the planet's own
// seed), their own seed and no POIs.
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
import { CLUTTER, PALETTES, TYPE_BIOMES, expand } from './tables.js';
import { POIS } from './landmarkTables.js';

const CLIMATE = { frequency: 0.00025, warp: 400 };

export { TYPE_BIOMES };

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
].map((p) => ({ seed: fold(hash64('fly', p.id)), pois: POIS[p.id] ?? [], ...p }));

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
  biomes: expand(TYPE_BIOMES[p.type], p.seed),
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
