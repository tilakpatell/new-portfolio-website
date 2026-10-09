import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { floraFor } from '../../lib/land/flora';
import { LAND_TYPES } from '../../lib/land/spec';
import { PACKS } from '../worlds/packs';
import { WORLD_MB } from '../worlds/worlds';
import { PACK } from './pack';

// the kit's manifest, as the browser fetches it
const PUBLIC = new URL('../../../public/', import.meta.url);
const MODELS = JSON.parse(readFileSync(new URL('kit/naturemega/index.json', PUBLIC), 'utf8')).models;

// every family file a planet's flora can draw: each name in every land's
// tables, through the manifest's `file` (the kit's pools fetch a model's
// file, its LOD1 in the same one)
const drawn = () => {
  const names = LAND_TYPES.flatMap((type) => {
    const f = floraFor(type);
    return [...f.species, ...f.cover].flatMap((r) => r.names);
  });
  return [...new Set(names.map((n) => `/kit/naturemega/${MODELS[n].file}`))].sort();
};

describe('the Expanse’s pack', () => {
  it('is the world’s, in the list of packs', () => {
    expect(PACK.id).toBe('/universe/expanse');
    expect(PACKS['/universe/expanse']).toBe(PACK);
  });

  it('fetches the kit’s manifest and exactly the family files the flora tables can draw, so a table edit can’t miss one', () => {
    expect(PACK.urls).toEqual(['/kit/naturemega/index.json']);
    expect([...PACK.globs].sort()).toEqual(drawn());
  });

  it('is no lighter at the gate than the kit files it fetches', () => {
    const bytes = [...PACK.urls, ...PACK.globs].reduce((s, u) => s + statSync(new URL(`.${u}`, PUBLIC)).size, 0);
    expect(WORLD_MB['/universe/expanse'] * 1048576).toBeGreaterThan(bytes);
  });
});
