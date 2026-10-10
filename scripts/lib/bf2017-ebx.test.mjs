import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assetRefs, cutAsset, deref, follow, loadAsset, numbersOf, objectsOf, pick, pointee, pointsOf, readIndex, resolveStrings, rootOf, stringHash, transformOf, yawOf } from './bf2017-ebx.mjs';

const ROOT = join(import.meta.dirname, '..', 'fixtures', 'bf2017', 'data');
const FIRING = 'Gameplay/Equipment/Rifles/A280C/WeaponFiring_A280C';

describe('the 2017 data dump’s parsers', () => {
  it('reads the index', () => {
    const index = readIndex(ROOT);
    expect(index.get(FIRING).type).toBe('WeaponFiringDataAsset');
    expect(index.get(FIRING).file).toBe(`data/${FIRING}.json`);
  });

  it('loads an asset and finds its root', () => {
    const a = loadAsset(ROOT, FIRING);
    expect(a.objects).toHaveLength(3);
    expect(rootOf(a).$type).toBe('WeaponFiringDataAsset');
    expect(deref(a, rootOf(a).Data).$type).toBe('WeaponFiringData');
    expect(deref(a, { $ref: 99 })).toBeNull();
    expect(objectsOf(a, 'FiringFunctionData')).toHaveLength(1);
  });

  it('finds a record whose name and folders differ in case', () => {
    expect(rootOf(loadAsset(ROOT, 'gameplay/kits/mp/assault/affector_assaulthealth')).MaxHealth).toBe(150);
  });

  it('reads a gzipped asset', () => {
    const a = loadAsset(ROOT, 'Gameplay/Equipment/Rifles/A280C/W_BlasterRifle_A280C');
    expect(a.guid).toBeTruthy();
    expect(rootOf(a).$type).toBe('SoldierWeaponBlueprint');
    expect(assetRefs(a).find((r) => r.key === 'WeaponFiring').name).toBe(FIRING);
  });

  it('walks numbers by path, identity left out', () => {
    const n = numbersOf(loadAsset(ROOT, FIRING).objects[1]);
    expect(n).toContainEqual(['FireLogic.RateOfFire', 600]);
    expect(n).toContainEqual(['Shot.InitialSpeed.z', 700]);
    expect(n).toContainEqual(['OverHeat.OverHeatThreshold', 0.8]);
    expect(n.some(([p]) => p.endsWith('Identifier'))).toBe(false);
    expect(pick(loadAsset(ROOT, FIRING).objects[1], 'Shot.NumberOfBulletsPerBurst')).toBe(3);
  });

  it('reads a spawn’s transform and yaw', () => {
    const spawn = objectsOf(loadAsset(ROOT, 'Levels/MP/Hoth_01/FantasyBattle_Logic'), 'AlternateSpawnEntityData')[0];
    const t = transformOf(spawn);
    expect(t.at[0]).toBeCloseTo(-31.6588, 4);
    expect(t.at[1]).toBeCloseTo(313.1801, 4);
    expect(t.at[2]).toBeCloseTo(-975.2903, 4);
    expect(t.yaw).toBeCloseTo(Math.atan2(0.4769736, -0.878914952), 6);
    expect(yawOf({ x: 1, z: 0 })).toBeCloseTo(Math.PI / 2, 9);
  });

  it('reads shapes: polygons, spheres and boxes', () => {
    const a = loadAsset(ROOT, 'Levels/MP/Hoth_01/FantasyBattle_Shapes');
    const v = pointsOf(objectsOf(a, 'VolumeVectorShapeData')[0]);
    expect(v.points[0]).toEqual([168.96, -1044.48]);
    expect(v.y).toBeCloseTo(817.5338, 4);
    expect(pointsOf(objectsOf(a, 'SphereData')[0]).r).toBeCloseTo(12.09035, 5);
    expect(pointsOf(objectsOf(a, 'OBBData')[0]).half).toHaveLength(3);
  });

  it('follows an asset pointer once', () => {
    const v = { $asset: 'Gameplay/Kits/MP/Assault/Affector_AssaultHealth' };
    const a = follow(ROOT, v);
    expect(rootOf(a).MaxHealth).toBe(150);
    expect(follow(ROOT, v)).toBe(a);
    expect(pointee(ROOT, v).obj.MaxHealth).toBe(150);
    expect(follow(ROOT, { $asset: 'Gameplay/Nope/Nothing' })).toBeNull();
    expect(loadAsset(ROOT, 'Gameplay/Nope/Nothing')).toBeNull();
  });

  it('resolves string ids by their hash', () => {
    // (English.json holds 'FUEL PIPES' under this hash)
    expect(stringHash('ID_FANTASYBATTLES_HOTH_FUEL_SILO')).toBe('B00D7E43');
    const strings = { strings: { [stringHash('ID_X')]: 'X MARKS' } };
    expect(resolveStrings(['ID_X', 'ID_Y'], strings)).toEqual({ ID_X: 'X MARKS' });
  });

  it('cuts an asset to what it needs, re-indexed', () => {
    const a = { root: 1, objects: [{ $type: 'A', n: { $ref: 2 } }, { $type: 'R', list: [{ $ref: 0 }, { $ref: 3 }], one: { $ref: 3 } }, { $type: 'B' }, { $type: 'C' }] };
    const cut = cutAsset(a, (o) => o.$type === 'A');
    expect(cut.objects.map((o) => o.$type)).toEqual(['A', 'R', 'B']);
    expect(cut.root).toBe(1);
    expect(cut.objects[1]).toEqual({ $type: 'R', list: [{ $ref: 0 }], one: null });
    expect(cut.objects[0].n).toEqual({ $ref: 2 });
  });
});
