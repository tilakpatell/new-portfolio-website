import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CLUTTER_KIT, CLUTTER_KIT_OF, LANDMARKS, SITE_PLACES, clutterKitOf } from './landmarkTables.js';
import { PLANETS, planetSpecOf } from './planetSpec.js';
import { CLUTTER_KINDS } from './leafMesh.js';

const manifest = (pack) => JSON.parse(readFileSync(new URL(`../../../../public/kit/${pack}/index.json`, import.meta.url), 'utf8'));
const kitHas = ({ kit, name }) => {
  const row = manifest(kit).models[name];
  return Boolean(row) && !row.rig;
};

describe('the landmark tables', () => {
  it('gives every POI planetTables doesn’t build a site place or a list of its own, never both', () => {
    let n = 0;
    for (const { id } of PLANETS) {
      const spec = planetSpecOf(id);
      const built = new Set((spec.landmarks ?? []).map((l) => l.at));
      for (const poi of spec.pois) {
        const site = SITE_PLACES[id]?.[poi.id];
        const own = LANDMARKS[id]?.[poi.id];
        if (built.has(poi.id)) expect(Boolean(site || own), `${id}/${poi.id} is lane A's`).toBe(false);
        else expect(Boolean(site) !== Boolean(own), `${id}/${poi.id}`).toBe(true);
        n++;
      }
    }
    expect(n).toBeGreaterThan(80);
  });

  it('names only POIs the planets have', () => {
    for (const table of [SITE_PLACES, LANDMARKS])
      for (const [planet, byPoi] of Object.entries(table)) {
        const ids = new Set(planetSpecOf(planet).pois.map((p) => p.id));
        for (const poi of Object.keys(byPoi)) expect(ids.has(poi), `${planet}/${poi}`).toBe(true);
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
    expect(clutterKitOf({ id: 'yavin', type: 'forest' }).trunk.name).toBe('TallThick_2');
    expect(clutterKitOf({ id: 'e:1,0:0:0', type: 'forest' }).trunk.name).toBe('TallThick_5');
    expect(clutterKitOf({ id: 'x', type: 'gas' })).toEqual({});
    expect(clutterKitOf(null)).toEqual({});
  });
});
