import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BY, cutGrid, materialRulebook, nameFromEffect, pairOf, physicsOf, usedIndicesOf } from './bf2017-materials.mjs';

// Hoth's grid, cut to the default, the soldier's foot, the blaster, metal
// (14), snow (28), concrete (45) and the impact grenade (149)
const FIXTURE = JSON.parse(readFileSync(join(import.meta.dirname, '../fixtures/bf2017/data/hoth_materialgrid.cut.json'), 'utf8'));

// a two-row grid of our own, for what Hoth's does not have (bands, physics)
function tiny() {
  const objects = [
    null,
    { $type: 'MaterialRelationEffectData', ImpactEffects: [{ Effect: { $asset: 'FX/x/FX_Impact_Slow' }, MinSpeed: 0, MaxSpeed: 50 }, { Effect: { $asset: 'FX/x/FX_Impact_Fast' }, MinSpeed: 50, MaxSpeed: 10000 }] },
    { $type: 'MaterialPropertyPhysicsData', DynamicFriction: 0.2, StaticFriction: 0.3, Restitution: 0.6, DynamicFrictionModifier: 1, StaticFrictionModifier: 1, Resistance: 0 },
    { $type: 'MaterialRelationDamageData', DamagePenetrationMultiplier: 1 },
  ];
  const empty = { PhysicsMaterialProperties: [], PhysicsPropertyProperties: [] };
  objects[0] = {
    $type: 'MaterialGridData',
    DefaultMaterialIndex: 0,
    MaterialIndexMap: [0, 1, ...Array(254).fill(0)],
    MaterialProperties: [empty, { PhysicsMaterialProperties: [{ $ref: 2 }], PhysicsPropertyProperties: [] }],
    InteractionGrid: [
      { Items: [{ PhysicsMaterialProperties: [], PhysicsPropertyProperties: [{ $ref: 3 }] }, empty] },
      { Items: [{ PhysicsMaterialProperties: [{ $ref: 1 }], PhysicsPropertyProperties: [] }, empty] },
    ],
  };
  return { name: 'tiny', objects };
}

describe('the material grid', () => {
  it('reads a pair through the index map: a blaster on 14 is metal, on 28 snow', () => {
    expect(pairOf(FIXTURE, 14, BY.blaster)).toMatchObject({ effects: [{ effect: 'FX_Impact_Blaster_Metal', min: 0, max: 10000 }], decal: 'Decal_Metal_Blaster' });
    expect(pairOf(FIXTURE, 28, BY.blaster)).toMatchObject({ effects: [{ effect: 'FX_Impact_Blaster_Snow' }], decal: 'Decal_Snow_Blaster' });
    expect(pairOf(FIXTURE, 28, BY.blaster).sound).toMatch(/Blaster/);
  });

  it('a soldier’s foot on snow leaves a print; on concrete only a step', () => {
    expect(pairOf(FIXTURE, 28, BY.foot)).toMatchObject({ footprint: 'FX_FootStep_Soldier_Snow_Decal_01' });
    expect(pairOf(FIXTURE, 45, BY.foot)).toMatchObject({ effects: [{ effect: 'FX_FootStep_Soldier_Concrete' }], footprint: null });
  });

  it('an index the level never declares reads the default’s row; an empty pair is null', () => {
    expect(pairOf(FIXTURE, 77, BY.blaster)).toEqual(pairOf(FIXTURE, 0, BY.blaster));
    expect(pairOf(FIXTURE, 14, 28).sound).toMatch(/Vehicles_Snow/);
    expect(pairOf(tiny(), 1, 1)).toBe(null);
  });

  it('keeps every speed band, and the physics properties where a material has them', () => {
    expect(pairOf(tiny(), 0, 1).effects).toEqual([
      { min: 0, max: 50, effect: 'FX_Impact_Slow' },
      { min: 50, max: 10000, effect: 'FX_Impact_Fast' },
    ]);
    expect(physicsOf(tiny(), 1)).toMatchObject({ dynamicFriction: 0.2, restitution: 0.6 });
    expect(physicsOf(tiny(), 0)).toBe(null);
  });

  it('names a surface from the blaster’s effect on it (hand rule)', () => {
    expect(nameFromEffect('FX_Impact_Blaster_Metal')).toBe('metal');
    expect(nameFromEffect('FX_Impact_Blaster_Metal_WeakSpot')).toBe('metal weak spot');
    expect(nameFromEffect('FX_Impact_Blaster_FFloor_PineDry')).toBe('pine floor');
    expect(nameFromEffect('FX_Impact_Blaster_RockSnow')).toBe('rock snow');
    expect(nameFromEffect('FX_Grenade_ImpactGrenade_Explosion')).toBe(null);
  });

  it('builds the rulebook: names by hand, every number sourced, the grenade’s pair apart from the bolt’s', () => {
    const book = materialRulebook(FIXTURE, [14, 28, 45], { level: 'hoth_01' });
    expect(book.default).toBe(0);
    expect(book.materials[14]).toMatchObject({ name: 'metal', nameSource: 'hand' });
    expect(book.materials[28].name).toBe('snow');
    expect(book.materials[0].name).toBe('generic');
    expect(book.pairs['28,5'].effects[0]).toMatchObject({ effect: 'FX_Impact_Blaster_Snow', min: 0, max: 10000 });
    expect(book.pairs['28,5'].effects[0].min_source).toMatch(/#MaterialGridData\.InteractionGrid\[\d+\]\.Items\[\d+\]\.MaterialRelationEffectData\.ImpactEffects\[0\]\.MinSpeed$/);
    expect(book.pairs['28,149'].effects[0].effect).toBe('FX_Grenade_ImpactGrenade_Snow_Explosion');
    expect(book.pairs['28,3'].footprint).toBe('FX_FootStep_Soldier_Snow_Decal_01');
    expect(book.by.source).toBe('hand');
  });

  it('counts the indices a level’s meshes use from the manifest and physics.jsonl', () => {
    const manifest = { meshes: [{ file: 'models/Props/Crate/crate_01_mesh.glb' }, { file: 'models/props/rock/rock_01_mesh.glb' }] };
    const records = [
      { res: 'props/crate/crate_01_physics_win32', materials: [{ index: 14 }, { index: 0 }] },
      { res: 'props/rock/rock_01_physics_win32', materials: [{ index: 14 }, { index: 14 }] },
      { res: 'props/other_physics_win32', materials: [{ index: 99 }] },
    ];
    expect(usedIndicesOf(manifest, records)).toEqual([
      [14, 2],
      [0, 1],
    ]);
  });

  it('the fixture is a cut of the root that reads the same as the whole', () => {
    const again = cutGrid(FIXTURE, [5, 14, 28]);
    expect(pairOf(again, 14, 5)).toEqual({ ...pairOf(FIXTURE, 14, 5), at: expect.any(Array) });
    expect(JSON.stringify(FIXTURE).length).toBeLessThan(40 * 1024);
  });
});
