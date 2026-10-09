import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { AUTHORED, ID, seedSql } from './supabase-seed.mjs';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/planets.json', import.meta.url), 'utf8'));
const seed = readFileSync(new URL('../supabase/seed.sql', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/migrations/20261009000000_world_entities.sql', import.meta.url), 'utf8');

describe('the planets seeded', () => {
  it('are fifty, the authored eight first, each an id the table takes', () => {
    const ids = fixture.planets.map((p) => p.id);
    expect(ids).toHaveLength(50);
    expect(new Set(ids).size).toBe(50);
    expect(ids.slice(0, 8)).toEqual(AUTHORED);
    expect(ids.slice(8).every((id) => /^E:-?\d+,-?\d+:\d+:\d+$/.test(id))).toBe(true);
    for (const id of ids) expect(id).toMatch(ID);
  });

  it('check ids the way the migration does', () => {
    expect(migration).toContain(`check (id ~ '${ID.source}')`);
  });

  it('keep Echo Base, levelled land and the land easing round it, out of reach', () => {
    expect(fixture.pois).toEqual([{ id: 'hoth:echo-base', planetId: 'hoth', name: 'Echo Base', x: 1200, z: -800, r: 380 }]);
  });

  it('are what seed.sql says, as the script wrote it', () => {
    expect(seed).toBe(seedSql(fixture, 'scripts/fixtures/planets.json'));
    expect(seed.match(/insert into public\.planets/g)).toHaveLength(50);
    expect(seed.match(/insert into public\.pois/g)).toHaveLength(1);
  });

  it('quote a name with an apostrophe, and refuse a list the table would', () => {
    const one = { planets: [{ id: 'a', name: "Kel'Dor", type: 'rock', seed: '1' }], pois: [] };
    expect(seedSql(one, 'x')).toContain("'Kel''Dor'");
    expect(() => seedSql({ planets: [{ ...one.planets[0], id: 'a b' }], pois: [] }, 'x')).toThrow(/refuses/);
    expect(() => seedSql({ planets: [one.planets[0], one.planets[0]], pois: [] }, 'x')).toThrow(/twice/);
    expect(() => seedSql({ ...one, pois: [{ id: 'p', planetId: 'b', name: 'P', x: 0, z: 0, r: 1 }] }, 'x')).toThrow(/not listed/);
  });
});
