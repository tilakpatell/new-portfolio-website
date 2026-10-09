import { describe, expect, it } from 'vitest';
import { PLANETS, TERRAIN_VERSION, TYPE_BIOMES, planetSpecOf } from './planetSpec';
import { makeSector } from '../../../components/expanse/gen/sector.js';
import { UNIVERSE } from '../../../components/expanse/gen/seed.js';

describe('PLANETS', () => {
  it('lists fifty, the authored eight first', () => {
    expect(PLANETS).toHaveLength(50);
    expect(PLANETS.slice(0, 8).map((p) => p.id)).toEqual(['hoth', 'tatooine', 'endor', 'yavin', 'bespin', 'mustafar', 'kamino', 'dagobah']);
  });

  it('has unique ids the database takes', () => {
    expect(new Set(PLANETS.map((p) => p.id)).size).toBe(50);
    for (const p of PLANETS) {
      expect(p.id).toMatch(/^[a-z0-9:_,-]{1,64}$/);
      expect(typeof p.name).toBe('string');
      expect(TYPE_BIOMES[p.type]).toBeTruthy();
      expect(Number.isInteger(p.seed)).toBe(true);
    }
  });

  it('takes the Expanse planets from sector (1, 0) on', () => {
    const first = makeSector(UNIVERSE, 1, 0).systems[0].planets[0];
    expect(PLANETS[8].id).toBe(first.id.toLowerCase());
    expect(PLANETS[8].name).toBe(first.name);
    expect(PLANETS[8].type).toBe(first.type);
  });
});

describe('planetSpecOf', () => {
  it('knows Hoth, Echo Base and all', () => {
    const s = planetSpecOf('hoth');
    expect(s.type).toBe('ice');
    expect(s.seed).toBe(0x48f1a2c3);
    expect(s.pois).toHaveLength(1);
    expect(s.pois[0].name).toBe('Echo Base');
    expect(s.pois[0].at).toEqual([1200, -800]);
  });

  it('builds an Expanse planet from its sector, either case', () => {
    const id = PLANETS[9].id;
    const s = planetSpecOf(id);
    expect(s.id).toBe(id);
    expect(s.biomes.length).toBeGreaterThan(0);
    expect(Number.isInteger(s.seed)).toBe(true);
    expect(s.pois).toEqual([]);
    expect(planetSpecOf(id.toUpperCase())).toEqual(s);
  });

  it('is the same spec every time', () => {
    expect(planetSpecOf(PLANETS[20].id)).toEqual(planetSpecOf(PLANETS[20].id));
  });

  it('refuses what it does not know', () => {
    for (const id of ['nowhere', 'e:1,0:99:0', 'e:0,0:0:0', 'e:x', '', undefined]) expect(planetSpecOf(id)).toBeNull();
  });

  it('gives the cartoon types a warped, ping-pong biome', () => {
    for (const type of ['forest', 'desert']) {
      const layers = TYPE_BIOMES[type].flatMap((b) => b.relief);
      expect(layers.some((l) => l.type === 'fnl' && l.noise.fractal === 'pingpong' && l.noise.warp === 600)).toBe(true);
    }
  });
});

// Each planet's ground, as the field is given it, hashed (FNV-1a over the
// specs' JSON): what a built thing stands on. A change to the tables, a
// seed, a biome or a POI moves the hash, and this fails until
// TERRAIN_VERSION is bumped and the new hash written beside it, so a turret
// built on the old ground is put back on the new (structures.js) rather
// than left floating. (GROUND is filled in, never edited: one line a version.)
const GROUND = { 1: '8f5398dc' };
function groundHash() {
  let h = 0x811c9dc5;
  const text = JSON.stringify(PLANETS.map(({ id }) => planetSpecOf(id)).map(({ id, seed, type, climate, biomes, pois }) => ({ id, seed, type, climate, biomes, pois })));
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}

describe('TERRAIN_VERSION', () => {
  it('is bumped whenever a planet’s ground changes', () => {
    expect(Number.isInteger(TERRAIN_VERSION) && TERRAIN_VERSION >= 1).toBe(true);
    expect(groundHash(), `the ground changed: bump TERRAIN_VERSION and add GROUND[${TERRAIN_VERSION + 1}]`).toBe(GROUND[TERRAIN_VERSION]);
  });
});
