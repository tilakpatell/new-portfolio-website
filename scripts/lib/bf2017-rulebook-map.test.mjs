import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mapRow } from './bf2017-rulebook-map.mjs';
import { checkSources } from './bf2017-rulebook.mjs';

const ROOT = join(import.meta.dirname, '..', 'fixtures', 'bf2017', 'data');

describe('the map row', () => {
  const m = mapRow(ROOT, 'hoth_01');

  it('finds the level and its modes', () => {
    expect(m.level).toBe('Levels/MP/Hoth_01/Hoth_01');
    expect(m.modes).toEqual(['galacticAssault']);
  });

  it('reads the spawns', () => {
    expect(m.spawns).toHaveLength(12);
    expect(m.spawns[0]).toMatchObject({ mode: 'galacticAssault', team: 2, priority: 1, enabled: false, layer: 'FantasyBattle_Logic' });
    expect(m.spawns[0].at[1]).toBeCloseTo(313.18, 2);
    expect(m.spawns[0].id).toMatch(/^FantasyBattle_Logic:\d+$/);
  });

  it('duplicate spawns collapse', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bf2017-'));
    cpSync(ROOT, dir, { recursive: true });
    const file = join(dir, 'data', 'Levels/MP/Hoth_01/FantasyBattle_Logic.json');
    const a = JSON.parse(readFileSync(file, 'utf8'));
    const first = a.objects.findIndex((o) => o.$type === 'AlternateSpawnEntityData');
    a.objects.push(structuredClone(a.objects[first]), structuredClone(a.objects[first]));
    writeFileSync(file, JSON.stringify(a));
    expect(mapRow(dir, 'hoth_01').spawns).toHaveLength(12);
  });

  it('reads the shapes', () => {
    expect(m.polygons).toHaveLength(54);
    expect(m.polygons[0]).toMatchObject({ team: 2, enabled: false });
    expect(m.volumes.filter((v) => v.layer === 'FantasyBattle_Shapes')).toHaveLength(16);
    expect(m.volumes.find((v) => v.layer === 'FantasyBattle_Shapes').y).toBeCloseTo(817.5338, 4);
    expect(m.spheres).toHaveLength(2);
    expect(m.boxes).toHaveLength(2);
  });

  it('reads the walkers’ paths, locators and cameras', () => {
    expect(m.waypoints.length).toBeGreaterThanOrEqual(1);
    expect(m.waypoints[0].points.length).toBeGreaterThanOrEqual(2);
    expect(m.waypoints[0].points[0]).toHaveLength(3);
    expect(m.locators.length).toBeGreaterThanOrEqual(1);
    expect(m.cameras[0]).toMatchObject({ focalLength: 35 });
  });

  it('reads the objective strings, the terrain and the vehicle spawns', () => {
    expect(m.strings).toContain('ID_FANTASYBATTLES_HOTH_FUEL_SILO');
    expect(m.terrain.world.file).toMatch(/hoth_01_terrain_height\.png$/);
    expect(m.vehicleSpawns[0]).toMatchObject({ blueprint: 'Gameplay/Vehicles/Mount/Tauntaun/Mount_Tauntaun' });
    expect(m.vehicleSpawns[0].at).toHaveLength(3);
    expect(m.bounds.min[0]).toBeLessThan(m.bounds.max[0]);
  });

  it('names every number’s source', () => {
    expect(checkSources(m)).toEqual([]);
  });
});
