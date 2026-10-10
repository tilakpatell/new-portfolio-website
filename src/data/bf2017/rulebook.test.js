// The Battlefront rulebooks (written by scripts/bf2017-data.mjs from the 2017
// game's data, and the hand files beside them): every file parses, every
// number names its source, every id a file names exists where it should, and
// nothing of the sequel era got in.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = import.meta.dirname;
const FILES = ['teams', 'classes', 'heroes', 'reinforcements', 'vehicles', 'weapons', 'abilities', 'cards', 'ai', 'cameras', 'ui', 'strings', 'points', 'maps/hoth', 'maps/hoth.lighting', 'maps/hoth.stages'];
const read = (name) => JSON.parse(readFileSync(join(DIR, `${name}.json`), 'utf8'));
const rb = Object.fromEntries(FILES.map((f) => [f, read(f)]));
const rows = (f) => rb[f].rows ?? rb[f];

// (copied from scripts/lib/bf2017-rulebook.mjs: src/data imports nothing from scripts)
function checkSources(json) {
  const bad = [];
  const real = (s) => typeof s === 'string' && /^(derived: \S|web\/\S|[^#\s]+#\S)/.test(s);
  const walk = (v, path, covered) => {
    if (typeof v === 'number') return covered || bad.push(path);
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${path}.${i}`, covered));
    const all = covered || v.source === 'hand' || real(v._source);
    for (const [k, x] of Object.entries(v)) {
      if (k.endsWith('_source') || k === '_from') continue;
      walk(x, path ? `${path}.${k}` : k, all || real(v[`${k}_source`]));
    }
  };
  walk(json, '', false);
  return bad;
}

// (copied from scripts/lib/bf2017-manifest.mjs's SEQUEL, with its matcher)
const SEQUEL = ['kyloren', 'rey', 'finn', 'captainphasma', 'firstorder', 'starkiller', 'takodana', 'jakku', 'resurgent', 'xwing_t70', 'tiefighterfirstorder', 'tiefighterspecialforces', 'resistance', 'ep7', 'ep9', 'skytrooper', 'jump_cop', 'newera', 'kylo', 'phasma', 'bb8', 'bb9e', 'crait'];
const TESTS = SEQUEL.map((s) => (s.length < 5 ? new RegExp(`(^|[_\\-.\\d])${s}($|[_\\-.\\d])`) : new RegExp(s.replace(/[_-]/g, '[_-]'))));
const isSequel = (name) => name.toLowerCase().split('/').some((seg) => TESTS.some((re) => re.test(seg)));

describe('the Battlefront rulebooks', () => {
  it('stay small', () => {
    const bytes = FILES.reduce((n, f) => n + readFileSync(join(DIR, `${f}.json`)).length, 0);
    expect(bytes).toBeLessThan(2 * 1024 * 1024);
    expect(readFileSync(join(DIR, 'maps/hoth.json')).length).toBeLessThan(600 * 1024);
  });

  it.each(FILES)('%s names the source of every number', (f) => {
    expect(checkSources(rb[f])).toEqual([]);
  });

  it('a hand file says so', () => {
    expect(rb.points.source).toBe('hand');
    expect(rb['maps/hoth.stages'].source).toBe('hand');
  });

  it('every stage names volumes, paths, prefabs and spawns the map has', () => {
    const map = rows('maps/hoth');
    const ids = new Set([...map.volumes, ...map.waypoints, ...map.prefabs, ...map.spheres, ...map.boxes].map((x) => x.id));
    const spawnIds = new Set([...map.spawns, ...map.polygons].map((x) => x.id));
    const bad = [];
    for (const stage of rb['maps/hoth.stages'].stages) {
      for (const o of stage.objectives) for (const key of ['volume', 'waypoints', 'prefab', 'sphere']) if (o[key] && !ids.has(o[key])) bad.push(`${stage.id}: ${key} ${o[key]}`);
      for (const id of [...stage.spawns.attack, ...stage.spawns.defend]) if (!spawnIds.has(id)) bad.push(`${stage.id}: spawn ${id}`);
    }
    expect(bad).toEqual([]);
  });

  it('every team names classes, heroes, reinforcements and vehicles the rulebooks hold', () => {
    const bad = [];
    for (const team of Object.values(rows('teams')))
      for (const side of [team.light, team.dark])
        for (const [key, book] of [['classes', 'classes'], ['heroes', 'heroes'], ['reinforcements', 'reinforcements'], ['vehicles', 'vehicles']])
          for (const id of side[key]) if (!rows(book)[id]) bad.push(`${side.team}: ${key} ${id}`);
    for (const cls of Object.values(rows('classes'))) if (cls.weapon && !rows('weapons')[cls.weapon]) bad.push(`${cls.id}: weapon ${cls.weapon}`);
    expect(bad).toEqual([]);
  });

  it('every Battle Point cost names a vehicle the rulebook holds', () => {
    const bad = Object.keys(rb.points.cost.vehicles).filter((id) => id !== 'default' && !rows('vehicles')[id]);
    for (const stage of rb['maps/hoth.stages'].stages) for (const id of [...stage.vehicles, ...stage.objectives.map((o) => o.vehicle).filter(Boolean)]) if (!rows('vehicles')[id]) bad.push(`${stage.id}: ${id}`);
    expect(bad).toEqual([]);
  });

  it('every name is a string the strings hold', () => {
    const strings = rows('strings');
    const bad = [];
    for (const f of ['classes', 'heroes', 'reinforcements', 'weapons']) for (const r of Object.values(rows(f))) if (r.name && !strings[r.name]) bad.push(`${f}: ${r.id} ${r.name}`);
    for (const stage of rb['maps/hoth.stages'].stages) for (const id of [stage.name, stage.nameDefend, ...stage.objectives.map((o) => o.name)].filter(Boolean)) if (!strings[id]) bad.push(`stage ${stage.id}: ${id}`);
    expect(bad).toEqual([]);
  });

  it('holds nothing of the sequel era', () => {
    const bad = [];
    const walk = (v, path) => {
      if (typeof v === 'string') return isSequel(v) && bad.push(`${path}: ${v}`);
      if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (k !== 'refused') walk(x, `${path}.${k}`);
    };
    for (const f of FILES) if (!['ui', 'ai', 'strings', 'maps/hoth.lighting'].includes(f)) walk(rows(f), f);
    walk(Object.keys(rows('ui').icons), 'ui.icons');
    expect(bad).toEqual([]);
  });
});
