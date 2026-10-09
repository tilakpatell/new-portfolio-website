import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CLUTTER_KIT, CLUTTER_KIT_OF, LANDMARKS, POIS, SITE_PLACES, clutterKitOf } from './landmarkTables.js';
import { CLUTTER_KINDS } from './leafMesh.js';

const manifest = (pack) => JSON.parse(readFileSync(new URL(`../../../../public/kit/${pack}/index.json`, import.meta.url), 'utf8'));
const kitHas = ({ kit, name }) => {
  const row = manifest(kit).models[name];
  return Boolean(row) && !row.rig;
};

describe('the landmark tables', () => {
  it('gives every POI a site place or a list of its own, never both', () => {
    for (const [planet, pois] of Object.entries(POIS))
      for (const poi of pois) {
        const site = SITE_PLACES[planet]?.[poi.id];
        const own = LANDMARKS[planet]?.[poi.id];
        expect(Boolean(site) !== Boolean(own), `${planet}/${poi.id}`).toBe(true);
      }
  });

  it('keeps every POI a flat the land can ease into', () => {
    for (const pois of Object.values(POIS)) {
      expect(new Set(pois.map((p) => p.id)).size).toBe(pois.length);
      for (const p of pois) {
        expect(p.id).toMatch(/^[a-z0-9-]+$/);
        expect(p.r).toBeGreaterThan(0);
        expect(p.edge).toBeGreaterThanOrEqual(0);
        expect(p.at.every(Number.isFinite)).toBe(true);
      }
      // (two flats overlapping would fight over the ground between them)
      for (const a of pois) for (const b of pois) if (a !== b) expect(Math.hypot(a.at[0] - b.at[0], a.at[1] - b.at[1])).toBeGreaterThan(a.r + a.edge + b.r + b.edge);
    }
  });

  it('names only kit models the kits have, and no rig', () => {
    const named = [
      ...Object.values(LANDMARKS).flatMap((byPoi) => Object.values(byPoi).flat()).filter((t) => t.kit).map((t) => t.kit),
      ...Object.values(CLUTTER_KIT).flatMap(Object.values),
      ...Object.values(CLUTTER_KIT_OF).flatMap(Object.values),
    ];
    expect(named.length).toBeGreaterThan(5);
    for (const k of named) expect(kitHas(k), `${k.kit}/${k.name}`).toBe(true);
  });

  it('maps only the ground’s clutter kinds, each to a size', () => {
    for (const table of [...Object.values(CLUTTER_KIT), ...Object.values(CLUTTER_KIT_OF)])
      for (const [kind, k] of Object.entries(table)) {
        expect(CLUTTER_KINDS).toContain(kind);
        expect(k.size).toBeGreaterThan(0);
      }
  });

  it('gives a planet its own trees over its type’s', () => {
    expect(clutterKitOf({ id: 'endor', type: 'forest' }).spire.name).toBe('TallThick_5');
    expect(clutterKitOf({ id: 'e:1,0:0:0', type: 'forest' }).spire.name).toBe('GiantPine_2');
    expect(clutterKitOf({ id: 'x', type: 'gas' })).toEqual({});
    expect(clutterKitOf(null)).toEqual({});
  });
});
