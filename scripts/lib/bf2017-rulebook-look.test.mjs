import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isSequel } from './bf2017-ebx.mjs';
import { camerasRow, copyUiAssets, lightingRow, uiRow } from './bf2017-rulebook-look.mjs';
import { checkSources } from './bf2017-rulebook.mjs';

const ROOT = join(import.meta.dirname, '..', 'fixtures', 'bf2017', 'data');
const FILES = readFileSync(join(ROOT, 'web', 'files.txt'), 'utf8').split('\n').filter(Boolean);

describe('the lighting row', () => {
  const l = lightingRow(ROOT, 'hoth_01');

  it('reads the sunny weather from its visual environment', () => {
    expect(l.default).toBe('sunny');
    const w = l.weathers.sunny;
    expect(w.sun.colour[0]).toBeCloseTo(1, 4);
    expect(w.sun.colour[1]).toBeCloseTo(0.9559, 4);
    expect(w.sun.colour[2]).toBeCloseTo(0.9176, 4);
    expect(w.exposure.ev).toBe(10);
    expect(w.bloom.scale).toBeCloseTo(0.1, 6);
    expect(w.bloom.gaussians).toHaveLength(5);
    expect(w.ao.hbao.radius).toBe(1.5);
    expect(w.wind.strength).toBe(5);
    [2.2311, -4.5655, 2.9244, -0.0088].forEach((v, i) => expect(w.fog.curve[i]).toBeCloseTo(v, 4));
    expect(w.grading.lut).toBe('T_CC_Hoth_Sunny_01');
  });

  it('reads the placed lights, volumetrics and probes', () => {
    expect(l.lights).toHaveLength(5);
    expect(l.lights[0]).toMatchObject({ kind: 'sphere', intensity: 55000, radius: 30 });
    [22.26, 34.9, 48.0].forEach((v, i) => expect(l.lights[0].colour[i]).toBeCloseTo(v, 2));
    expect(l.lights.find((x) => x.kind === 'spot')).toMatchObject({ inner: 70, outer: 90 });
    expect(l.volumetrics[0].exponent).toBe(2);
    expect(l.probes[0].res).toEqual([5, 5, 5]);
  });

  it('reads the lighting prefabs and the lights inside them', () => {
    expect(l.prefabs).toHaveLength(2);
    const name = l.prefabs[0].name;
    expect(l.prefabLights[name].length).toBeGreaterThan(0);
    expect(l.prefabLights[name][0].intensity).toBeGreaterThan(0);
  });

  it('names every number’s source', () => {
    expect(checkSources(l)).toEqual([]);
  });
});

describe('the cameras row', () => {
  const c = camerasRow(ROOT, { soldier: 'Gameplay/Characters/StormTrooperShared', weapons: [{ id: 'a280c', zoom: [{ fov: 55, zoomIn: 1, zoomOut: 1, _source: 'x' }] }], vehicles: ['Gameplay/Vehicles/Ground/AT-AT_MP/Vehicle_Ground_AT-AT_MP'] });

  it('reads the soldier’s third-person camera', () => {
    expect(c.soldier).toMatchObject({ arm: 1.2, maxPitch: 55, reducedArm: { length: 0.5, minPitch: 5, maxPitch: 70 } });
    expect(c.soldier.cull).toMatchObject({ stand: 1.8, crouch: 1.5, prone: 0.32, dead: 0.2 });
    expect(c.aim.a280c[0].fov).toBe(55);
  });

  it('reads a vehicle’s seat cameras', () => {
    const v = c.vehicles['vehicle_ground_at-at_mp'];
    expect(v.seats[0].pitch).toEqual([-35, 24]);
    expect(v.seats[0].inertia).toEqual({ input: 0.8, none: 0.5 });
    expect(v.seats).toHaveLength(3);
    expect(v.redirect[0][0]).toMatchObject({ rate: 6 });
    expect(checkSources(c)).toEqual([]);
  });
});

describe('the UI row', () => {
  const u = uiRow(ROOT, ['UI/InGame/Hud/Weapons/Widgets/WeaponHeat/WeaponHeatBar', 'UI/Customize/Screens/SpawnOverlayScreen'], { files: FILES });

  it('flattens a widget into its element tree, through its widget references', () => {
    const bar = u.widgets.WeaponHeatBar;
    const all = [];
    const walk = (n) => (all.push(n), (n.children ?? []).forEach(walk));
    bar.children.forEach(walk);
    expect(all.some((n) => ['text', 'vectorShape', 'rectangle', 'fill'].includes(n.type))).toBe(true);
    expect(all.some((n) => n.widget === 'WeaponHeatProgress')).toBe(true);
  });

  it('lists the deploy screen’s strings', () => {
    expect(u.widgets.SpawnOverlayScreen.texts.length).toBeGreaterThan(0);
    expect(u.widgets.SpawnOverlayScreen.texts[0]).toMatch(/^ID_/);
  });

  it('lists the icons, sequel refused, and every font', () => {
    expect(Object.keys(u.icons).length).toBeGreaterThan(10);
    expect(Object.values(u.icons).some((p) => isSequel(p))).toBe(false);
    expect(u.fonts).toHaveLength(23);
    expect(u.palette.length).toBeGreaterThan(10);
    expect(checkSources(u)).toEqual([]);
  });

  it('copies the icons it has and the HUD fonts it has', () => {
    const out = mkdtempSync(join(tmpdir(), 'bf2017-ui-'));
    const copied = copyUiAssets(ROOT, out, u);
    expect(copied.icons).toBe(2);
    expect(existsSync(join(out, 'icons', 'UI/SVG/Classes/Class_Troopers_Assault_01.svg'))).toBe(true);
  });
});
