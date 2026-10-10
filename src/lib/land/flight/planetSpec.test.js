import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLANETS, TYPE_BIOMES, planetSpecOf } from './planetSpec';
import { SITE_GROUND, SITE_LAYERS, WORLDS } from './planetTables';
import { makeSector } from '../../../components/expanse/gen/sector.js';
import { UNIVERSE } from '../../../components/expanse/gen/seed.js';
// (the test alone reaches into the galaxy: planetSpec.js stays pure)
import { SITES } from '../../../components/galaxy/surface/sites/index.js';

const ROOT = fileURLToPath(new URL('../../../..', import.meta.url));
const GALAXY = 'tatooine hoth endor yavin bespin dagobah mustafar coruscant naboo kashyyyk kamino geonosis scarif nevarro mandalore lothal sorgan'.split(' ');
const SECTOR = 'gazorpazorp squanch birdworld gearworld pluto snakeplanet nuptia resort cronenberg purge'.split(' ');
const FANDOM = 'cybertron middle-earth caribbean albuquerque scranton avengers invincible c-137 earth dot-matrix'.split(' ');

describe('PLANETS', () => {
  it('lists the roster’s fifty in its order: galaxy, sector, fandom, then 13 of the Expanse', () => {
    expect(PLANETS).toHaveLength(50);
    expect(PLANETS.slice(0, 37).map((p) => p.id)).toEqual([...GALAXY, ...SECTOR, ...FANDOM]);
    expect(PLANETS.slice(37).every((p) => p.id.startsWith('e:'))).toBe(true);
    expect(PLANETS.some((p) => p.id === 'alderaan')).toBe(false);
  });

  it('has unique ids the database takes, plain rows', () => {
    expect(new Set(PLANETS.map((p) => p.id)).size).toBe(50);
    for (const p of PLANETS) {
      expect(Object.keys(p)).toEqual(['id', 'name', 'type', 'seed']);
      expect(p.id).toMatch(/^[a-z0-9:_,-]{1,64}$/);
      expect(typeof p.name).toBe('string');
      expect(Number.isInteger(p.seed)).toBe(true);
    }
  });

  it('takes the Expanse planets from sector (1, 0) on', () => {
    const first = makeSector(UNIVERSE, 1, 0).systems[0].planets[0];
    expect(PLANETS[37]).toMatchObject({ id: first.id.toLowerCase(), name: first.name, type: first.type });
    for (const p of PLANETS.slice(37)) expect(TYPE_BIOMES[p.type]).toBeTruthy();
  });
});

describe('planetSpecOf', () => {
  it('knows Hoth, Echo Base and all', () => {
    const s = planetSpecOf('hoth');
    expect(s.type).toBe('ice');
    expect(s.seed).toBe(0x48f1a2c3);
    expect(s.pois[0]).toMatchObject({ name: 'Echo Base', at: [1200, -800], r: 220, edge: 160, h: 12 });
  });

  it('gives every named world three to five biomes, each with a base, and its POIs', () => {
    for (const w of WORLDS) {
      const s = planetSpecOf(w.id);
      expect(s.biomes.length, w.id).toBeGreaterThanOrEqual(3);
      expect(s.biomes.length, w.id).toBeLessThanOrEqual(5);
      for (const b of s.biomes) {
        expect(Number.isFinite(b.base), `${w.id} ${b.id}`).toBe(true);
        expect(b.at.every((v) => v >= 0 && v <= 1), `${w.id} ${b.id}`).toBe(true);
        expect(b.scatter).toBeUndefined();
      }
      expect(s.palette).toMatchObject({ low: expect.any(String), high: expect.any(String), rock: expect.any(String), accent: expect.any(String) });
    }
  });

  // the ground round each walkable site is the site's own ground
  it.each(GALAXY.filter((id) => SITES[id]?.ground?.layers?.length))('%s: the landing biome begins with the site’s own layers', (id) => {
    const site = SITES[id].ground.layers;
    const relief = planetSpecOf(id).biomes[0].relief;
    expect(relief.slice(0, site.length).map((l) => l.type)).toEqual(site.map((l) => l.type));
    expect(relief.slice(0, site.length)).toEqual(site.map((l) => ({ ...l })).map((l) => expect.objectContaining(l)));
    expect(SITE_LAYERS[id]).toHaveLength(site.length);
  });

  // and wears the site's own ground look: Mos Eisley's sand from the air is the sand you walk on
  it.each(GALAXY)('%s: the ground look is the site’s own', (id) => {
    const look = { ...SITES[id].ground };
    for (const k of ['layers', 'flats', 'pits', 'seed', 'base']) delete look[k];
    expect(SITE_GROUND[id]).toEqual(look);
    if (id !== 'coruscant') expect(planetSpecOf(id).ground).toEqual(look);
    if (SITES[id].water && id !== 'bespin') expect(planetSpecOf(id).water).toEqual({ kind: SITES[id].water.kind, level: SITES[id].water.level });
  });

  it('gives every world a ground look, every Expanse type its template’s', () => {
    for (const p of PLANETS) expect(planetSpecOf(p.id).ground?.palette, p.id).toBeTruthy();
  });

  it('stands each landmark at a place the planet has, from a model the site carries', () => {
    let n = 0;
    for (const p of PLANETS) {
      const s = planetSpecOf(p.id);
      for (const l of s.landmarks) {
        n++;
        expect(s.pois.some((q) => q.id === l.at), `${p.id} ${l.id}`).toBe(true);
        for (const part of l.parts) {
          expect(existsSync(join(ROOT, 'public', part.url)), part.url).toBe(true);
          if (part.hq) expect(existsSync(join(ROOT, 'public', part.hq)), part.hq).toBe(true);
          expect(part.metres).toBeGreaterThan(0);
          expect(part.count).toBeGreaterThan(0);
        }
      }
    }
    expect(n).toBeGreaterThanOrEqual(10);
  });

  it('marks what the note marks: the pixel world stepped, the cloud deck soft, the cities blocked', () => {
    expect(planetSpecOf('dot-matrix').step).toBe(4);
    expect(planetSpecOf('bespin').soft).toBe(true);
    expect(planetSpecOf('hoth').soft).toBe(false);
    for (const id of ['invincible', 'cybertron']) expect(planetSpecOf(id).biomes.some((b) => b.relief.some((l) => l.type === 'blocks')), id).toBe(true);
    // Coruscant's city is towers standing on its floor, not bumps in it: one city to the haze, its landmarks the film-made models
    const c = planetSpecOf('coruscant');
    expect(c.biomes.some((b) => b.relief.some((l) => l.type === 'blocks' || l.type === 'mountains' || l.type === 'ridges'))).toBe(false);
    expect(c.clutter[0]).toMatchObject({ kinds: ['tower', 'slab', 'needle'], grid: 150 });
    expect(c.landmarks.map((l) => l.at)).toEqual(['senate', 'jedi-temple']);
    expect(c.hero.url).toMatch(/corutower\.glb$/);
    expect(planetSpecOf('tatooine').pits[0]).toMatchObject({ at: [2800, -1900], r: 90, depth: 40 });
  });

  it('builds an Expanse planet from its sector, either case, with no POIs', () => {
    const id = PLANETS[40].id;
    const s = planetSpecOf(id);
    expect(s.id).toBe(id);
    expect(s.biomes.length).toBeGreaterThan(0);
    expect(s.pois).toEqual([]);
    expect(planetSpecOf(id.toUpperCase())).toEqual(s);
    expect(planetSpecOf(PLANETS[40].id)).toEqual(planetSpecOf(PLANETS[40].id));
  });

  it('scatters a planet’s craters from its own seed', () => {
    const a = planetSpecOf('tatooine').biomes.find((x) => x.id === 'wastes').relief;
    expect(a.filter((l) => l.type === 'island').length).toBe(14);
    expect(planetSpecOf('tatooine').biomes).toEqual(planetSpecOf('tatooine').biomes);
  });

  it('refuses what it does not know', () => {
    for (const id of ['nowhere', 'alderaan', 'e:1,0:99:0', 'e:0,0:0:0', 'e:x', '', undefined]) expect(planetSpecOf(id)).toBeNull();
  });

  it('gives the cartoon worlds rounder hills or warped, ping-pong plateaus', () => {
    for (const id of ['squanch', 'gearworld']) expect(planetSpecOf(id).biomes.some((x) => x.relief.some((l) => l.type === 'fnl' && l.noise.fractal === 'pingpong' && l.noise.warp === 600)), id).toBe(true);
    expect(planetSpecOf('birdworld').biomes[0].relief[0]).toMatchObject({ type: 'hills', gain: 0.4, octaves: 3 });
  });
});
