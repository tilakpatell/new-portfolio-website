import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cellOf, keepSub, lightsJson, readLight, rebase } from './bf2017-lights.mjs';

const fx = JSON.parse(readFileSync(new URL('../fixtures/bf2017/maps/hoth.extras.fixture.json', import.meta.url)));

describe('readLight', () => {
  it('a spot: the colour normalised, its peak folded into the lumens, the cone in radians, shining down its -Z', () => {
    const l = readLight(fx.lights[0]); // 65,500 lm, Color peak 60.34, 70°/90°, turned -90° about X
    expect(l.kind).toBe('spot');
    expect(Math.max(...l.color)).toBe(1);
    expect(l.cone[0]).toBeCloseTo((70 * Math.PI) / 180);
    expect(l.cone[1]).toBeCloseTo(Math.PI / 2);
    const lm = 65500 * 60.3398;
    expect(l.candela).toBeCloseTo(lm / (2 * Math.PI * (1 - Math.cos(Math.PI / 4))), 0);
    // (-90° about X turns -Z to -Y: a ceiling lamp)
    expect(l.dir[1]).toBeCloseTo(-1);
    expect(l.range).toBe(fx.lights[0].AttenuationRadius);
  });
  it('a dimmed one is dimmer; a sphere is a point over 4π', () => {
    const dim = fx.lights[1];
    expect(readLight(dim).candela).toBeCloseTo(readLight({ ...dim, Dimmer: 1 }).candela * 0.563, 3);
    const p = readLight(fx.lights[4]); // 5 lm, peak 1
    expect(p.kind).toBe('point');
    expect(p.candela).toBeCloseTo(5 / (4 * Math.PI));
  });
  it('a rect is a hemisphere spot at lm / π', () => {
    const r = readLight(fx.lights[6]);
    expect(r.kind).toBe('spot');
    expect(r.cone).toEqual([0, Math.PI]);
    expect(r.candela).toBeCloseTo((950 * 32) / Math.PI);
  });
  it('an off, an unlit or a foreign-unit light is left out, and says why', () => {
    expect(readLight(fx.lights[7]).skip).toBe('off');
    expect(readLight(fx.lights.find((l) => l.Enabled && !l.AffectDiffuse && !l.AffectSpecular)).skip).toBe('unlit');
    expect(readLight({ ...fx.lights[0], LightUnit: 'LightUnitType_Candela' }).skip).toBe('unit');
  });
});

describe('rebase', () => {
  it('takes the origin away and turns by yaw about +Y, the direction too', () => {
    const l = { pos: [110, 5, 20], dir: [1, 0, 0] };
    const r = rebase(l, [100, 0, 20], Math.PI / 2);
    expect(r.pos[0]).toBeCloseTo(0);
    expect(r.pos[1]).toBe(5);
    expect(r.pos[2]).toBeCloseTo(-10);
    expect(r.dir[2]).toBeCloseTo(-1);
    expect(rebase(l, [0, 0, 0], 0).pos).toEqual([110, 5, 20]);
  });
});

describe('cells and subworlds', () => {
  it('bins by 128 m', () => {
    expect(cellOf([130, 0, -1])).toBe('1,-1');
  });
  it('keeps the map and its content, not the modes, the lobby or the other weathers', () => {
    expect(keepSub('Levels/MP/Hoth_01/Hoth_01')).toBe(true);
    expect(keepSub('Levels/MP/Hoth_01/Content')).toBe(true);
    for (const s of ['PlanetaryMissions', 'HeroArena', 'Lobby', 'Cloudy', 'Sunset', 'Mode6_Intro', 'TeamDeathmatch_Online', 'Outro_Team2']) expect(keepSub(`Levels/MP/Hoth_01/${s}`)).toBe(false);
  });
});

describe('lightsJson', () => {
  it('ten lights: rebased, binned, converted; the left-out counted', () => {
    const origin = [200, 360, -1700];
    const json = lightsJson(fx, { origin, yaw: 0, cell: 128, arena: 768 }, { subworlds: fx.subworlds });
    // kept: the map's spot and sphere, the content's spot, two spheres and the rect; left
    // out: the missions' two (one off as well) and the hero arena's, a sphere lighting nothing
    expect(json.count).toBe(6);
    expect(json.kinds).toEqual({ point: 3, spot: 3 });
    expect(json.skipped).toEqual({ sub: 3, unlit: 1 });
    const all = Object.values(json.cells).flat();
    expect(all).toHaveLength(6);
    // the Content spot at (207.36, 362.58, -1705.746) is 7.36 m east, 5.75 m south of the origin: cell 0,-1
    const spot = json.cells['0,-1'].find((l) => l.kind === 'spot' && l.pos[0] === 7.36);
    expect(spot.pos).toEqual([7.36, 2.58, -5.75]);
    expect(spot.cone).toHaveLength(2);
    for (const l of all) expect(Math.max(...l.color)).toBe(1);
    expect(JSON.stringify(json).length).toBeLessThan(4096);
  });
  it('an arena leaves out what is beyond it, a cell’s margin added', () => {
    const json = lightsJson(fx, { origin: [200, 360, -1700], arena: 10, cell: 64 }, { subworlds: fx.subworlds });
    expect(json.skipped.outside).toBeGreaterThan(0);
    for (const l of Object.values(json.cells).flat()) expect(Math.abs(l.pos[0])).toBeLessThanOrEqual(74);
  });
});
