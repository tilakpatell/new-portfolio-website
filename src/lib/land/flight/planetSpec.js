// The flight's planets: what a planet id flies over. The fifty are the
// roster of docs/research/2026-10-09-planet-geographies.md, in its order:
// the galaxy's 17 worlds, the Rick and Morty sector's 10, the universe map's
// 10 fandom planets (each written out in ./planetTables.js: its biomes,
// POIs, pits, palette, clutter, and `step` or `soft` where it has them),
// then 13 of the Expanse's generated planets, each through its type's stacks
// (TYPE_BIOMES, the galaxy's worlds as templates), its own seed and no POIs.
// Scattered islands and craters are placed from the planet's own seed.
//
// Ids are lower case because the shared world's database takes nothing else
// (supabase/migrations' planets check); an Expanse planet is its sector.js id
// lowered, 'e:sx,sz:i:j', and either case is read back.
//
// Pure: no three.js, nothing from a world but the Expanse's generator (pure).
// scripts/supabase-seed.mjs reads PLANETS.
//
//   PLANETS → { id, name, type, seed }[] (50)
//   TYPE_BIOMES[type] → an Expanse planet's biomes
//   TERRAIN_VERSION → the ground's version (what's built is put back on a newer one)
//   planetSpecOf(id) → { id, name, seed, type, climate, biomes, pois, pits,
//     palette, clutter, step, soft, ground, water, fog, landmarks, hero } | null

import { makeSector } from '../../../components/expanse/gen/sector.js';
import { UNIVERSE, hash64 } from '../../../components/expanse/gen/seed.js';
import { fold } from './fnl.js';
import { TYPE_BIOMES, TYPE_LOOK, WORLDS, expand } from './planetTables.js';

// The ground's version, for what's built on it (the shared world's
// terrain_version): bumped by hand whenever this file or ./planetTables.js
// changes a planet's ground, so a turret stored on the old ground's height is
// put back on the new one's. planetSpec.test.js hashes the ground and fails
// when it moves without this.
export const TERRAIN_VERSION = 1;

export { TYPE_BIOMES };

const CLIMATE = { frequency: 0.00025, warp: 400 };
const EXPANSE_COUNT = 13;

// a named world's seed is its own where it has one (Hoth's), else its id hashed
const seedOf = (w) => w.seed ?? fold(hash64('fly', w.id));

const SECTORS = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1]];
const EXPANSE = [];
for (const [sx, sz] of SECTORS) {
  for (const s of makeSector(UNIVERSE, sx, sz).systems)
    for (const p of s.planets) if (EXPANSE.length < EXPANSE_COUNT) EXPANSE.push({ id: p.id.toLowerCase(), name: p.name, type: p.type, seed: fold(p.seed) });
  if (EXPANSE.length >= EXPANSE_COUNT) break;
}

export const PLANETS = [...WORLDS.map((w) => ({ id: w.id, name: w.name, type: w.type, seed: seedOf(w) })), ...EXPANSE];

const specOf = ({ id, name, type, seed }, w) => ({
  id,
  name,
  seed,
  type,
  climate: CLIMATE,
  biomes: expand(w.biomes, seed),
  pois: w.pois ?? [],
  pits: w.pits ?? [],
  palette: w.palette,
  clutter: w.clutter,
  step: w.step ?? 0,
  soft: Boolean(w.soft),
  ground: w.ground ?? null,
  water: w.water ?? null,
  fog: w.fog ?? null,
  landmarks: w.landmarks ?? [],
  hero: w.hero ?? null,
});

const EXPANSE_ID = /^e:(-?\d+),(-?\d+):(\d+):(\d+)$/;

export function planetSpecOf(planetId) {
  if (typeof planetId !== 'string') return null;
  const id = planetId.toLowerCase();
  const w = WORLDS.find((x) => x.id === id);
  if (w) return specOf({ id, name: w.name, type: w.type, seed: seedOf(w) }, w);
  const m = id.match(EXPANSE_ID);
  if (!m) return null;
  const [sx, sz, i, j] = m.slice(1).map(Number);
  const p = makeSector(UNIVERSE, sx, sz).systems[i]?.planets[j];
  if (!p || !TYPE_BIOMES[p.type]) return null;
  const look = TYPE_LOOK[p.type];
  return specOf({ id, name: p.name, type: p.type, seed: fold(p.seed) }, { biomes: TYPE_BIOMES[p.type], palette: look.palette, clutter: look.clutter, soft: look.soft, ground: look.ground, water: look.water });
}
