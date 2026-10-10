import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { blueprintFor, readBlueprint } from './bf2017-blueprint.mjs';

// the Imperial crate's blueprint, cut to the records it reads
const BOX = JSON.parse(readFileSync(new URL('../fixtures/bf2017/blueprints/box_m_04.json', import.meta.url), 'utf8'));
const TSV = ['Objects/Props/ObjectSets/_GalacticEmpire/Box_M_04/Box_M_04\tObjectBlueprint\tdata/x.json\t7036', 'Objects/Props/ObjectSets/_GalacticEmpire/Box_M_04/Box_M_04_Variation\tObjectVariation\tdata/y.json\t10'].join('\n');

describe('an object’s blueprint', () => {
  it('is found by its mesh’s name without `_mesh`', () => {
    expect(blueprintFor('objects/props/objectsets/_galacticempire/box_m_04/box_m_04_mesh', TSV)).toBe('Objects/Props/ObjectSets/_GalacticEmpire/Box_M_04/Box_M_04');
    expect(blueprintFor('objects/props/objectsets/_galacticempire/box_m_09/box_m_09_mesh', TSV)).toBeNull();
  });

  it('says whether the game’s object collides and is held fixed, and where it says so', () => {
    expect(readBlueprint(BOX)).toEqual({ solid: true, fixed: true, mesh: 'objects/props/objectsets/_galacticempire/box_m_04/box_m_04_mesh', _source: 'Objects/Props/ObjectSets/_GalacticEmpire/Box_M_04/Box_M_04#RigidBodyData' });
    const ghost = { ...BOX, objects: BOX.objects.filter((o) => o.$type !== 'RigidBodyData') };
    expect(readBlueprint(ghost)).toMatchObject({ solid: false, fixed: false });
    expect(readBlueprint({ type: 'ObjectVariation', objects: [] })).toBeNull();
  });
});
