import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HEROES_2017, KIND, abilitiesOfKit, abilityRow, affectorFacts, damageOf, healthOf, fieldHash, knockOf, outputRoles, prefabFacts, readAbility, shareRoles } from './bf2017-abilities.mjs';

const FIX = new URL('../fixtures/bf2017/abilities/data/', import.meta.url);
const doc = (name) => JSON.parse(readFileSync(new URL(`${name}.json`, FIX), 'utf8'));

describe('the game’s field hash', () => {
  it('is djb2 with xor, as Frostbite names a field: the pie slice’s Angle and Radius read back', () => {
    expect(fieldHash('Angle')).toBe(205597860);
    expect(fieldHash('Radius')).toBe(-996560163);
    // (an output named outright: Anakin’s Retribution’s ChokeDuration, Yoda’s MaxRange)
    expect(fieldHash('ChokeDuration') >>> 0).toBe(1768461841);
    expect(fieldHash('MaxRange')).toBe(403774958);
  });
});

describe('a kit', () => {
  it('lists the hero’s own abilities, not the shared jump, dodge, emotes or weapon', () => {
    expect(abilitiesOfKit(doc('Gameplay/Kits/Hero/Luke/GP_Hero_Luke'))).toEqual(['Gameplay/Kits/Hero/Luke/Ability_Luke_ForcePush']);
    expect(abilitiesOfKit(doc('Gameplay/Kits/Hero/Maul/GP_Hero_Maul'))).toEqual(['Gameplay/Kits/Hero/Maul/Ability_Maul_ForceChoke']);
  });
  it('reads none of the sequel era, and every hero has a site id', () => {
    for (const bad of ['KyloRen', 'Rey', 'BB8', 'BB9E', 'Finn', 'Phasma']) expect(HEROES_2017[bad]).toBeUndefined();
    expect(HEROES_2017.Emperor).toBe('palpatine');
    expect(Object.values(KIND).every((k) => typeof k === 'string')).toBe(true);
  });
});

describe('an ability', () => {
  const push = readAbility(doc('Gameplay/Kits/Hero/Luke/Ability_Luke_ForcePush'));
  it('has its times, its button, its prefab and its outputs at level one', () => {
    expect(push).toMatchObject({ asset: 'Gameplay/Kits/Hero/Luke/Ability_Luke_ForcePush', slot: 'left', recharge: 20, activation: 0.5, active: 0, id: 1029217446, blueprint: 'Gameplay/Kits/Hero/Luke/Prefabs/PF_Push_Luke' });
    expect(push.outputs).toEqual({ 1697178449: 30, 3791637896: 12 });
  });
  it('names its outputs by the fields they feed: the cone straight in, the range through the star card’s switch', () => {
    const roles = outputRoles(doc('Gameplay/Kits/Hero/Luke/Prefabs/PF_Push_Luke'), push.id);
    expect(roles[1697178449]).toEqual({ role: 'cone', via: 'DynamicQueryFilter.FilterOutAngle' });
    expect(roles[3791637896]).toEqual({ role: 'range', via: 'ConditionalFloat → SphereQuery.Radius' });
    // (another ability's outputs in the same prefab aren't this one's)
    expect(outputRoles(doc('Gameplay/Kits/Hero/Luke/Prefabs/PF_Push_Luke'), 7)).toEqual({});
  });
});

describe('a prefab’s facts', () => {
  const facts = prefabFacts(doc('Gameplay/Kits/Hero/Luke/Prefabs/PF_Push_Luke'));
  it('lists what it applies, to whom: the hero filter’s first output the heroes, its second the troopers', () => {
    expect(facts.applies.slice(0, 2)).toEqual([
      { affector: 'Gameplay/Prefabs/Affectors/States/Affector_Damage_Luke_ForcePush', duration: 1, rank: 0, vs: 'hero' },
      { affector: 'Gameplay/Prefabs/Affectors/States/Affector_Damage_Luke_ForcePush', duration: 1, rank: 1, vs: 'trooper' },
    ]);
    expect(facts.radii).toEqual([10]);
  });
  it('takes damage by rank, and the knockback from the least of the pushed affectors', () => {
    const affectors = { 'Gameplay/Prefabs/Affectors/States/Affector_Damage_Luke_ForcePush': affectorFacts(doc('Gameplay/Prefabs/Affectors/States/Affector_Damage_Luke_ForcePush')) };
    expect(affectors['Gameplay/Prefabs/Affectors/States/Affector_Damage_Luke_ForcePush']).toMatchObject({ damage: [90, 150], perSecond: null, interval: 0.5 });
    expect(damageOf(facts.applies, affectors)).toMatchObject({ hero: 90, trooper: 150 });
    expect(knockOf(facts.applies)).toMatchObject({ metres: 10 });
    expect(knockOf([])).toBeNull();
  });
  it('finds the hit points a hero spawns with', () => {
    expect(healthOf(doc('Gameplay/Kits/Hero/Maul/GP_Hero_Maul'))).toBe('Gameplay/Kits/Hero/Maul/Affector_Health_Maul');
    expect(healthOf(doc('Gameplay/Kits/Hero/Luke/GP_Hero_Luke'))).toBeNull();
    expect(affectorFacts({ objects: [{ $type: 'MaxHealthAffectorAsset', MaxHealth: 700 }] }).maxHealth).toBe(700);
  });
  it('keeps a choke’s damage by the second, and leaves a star card’s variant out', () => {
    const choke = prefabFacts(doc('Gameplay/Kits/Hero/Maul/PF_ForceChoke_Maul'));
    const affectors = {
      'Gameplay/Prefabs/Affectors/States/Affector_Damage_Maul_ForceChoke': affectorFacts(doc('Gameplay/Prefabs/Affectors/States/Affector_Damage_Maul_ForceChoke')),
      'Gameplay/Prefabs/Affectors/States/Affector_Damage_Maul_ForceChoke_StarCard': { damage: [999] },
    };
    expect(damageOf(choke.applies, affectors)).toMatchObject({ any: { perSecond: 80, for: 1.5 } });
  });
});

describe('a row', () => {
  it('keeps each number with where it came from, an output another prefab names plainly taking that name', () => {
    const luke = readAbility(doc('Gameplay/Kits/Hero/Luke/Ability_Luke_ForcePush'));
    const maul = readAbility(doc('Gameplay/Kits/Hero/Maul/Ability_Maul_ForceChoke'));
    const entries = [
      { ability: luke, roles: outputRoles(doc('Gameplay/Kits/Hero/Luke/Prefabs/PF_Push_Luke'), luke.id) },
      { ability: maul, roles: outputRoles(doc('Gameplay/Kits/Hero/Maul/PF_ForceChoke_Maul'), maul.id) },
    ];
    // (Maul's range goes into arithmetic; Luke's names it)
    expect(entries[1].roles[3791637896]).toBeUndefined();
    shareRoles(entries);
    expect(entries[1].roles[3791637896]).toMatchObject({ role: 'range', shared: true });
    const facts = prefabFacts(doc('Gameplay/Kits/Hero/Maul/PF_ForceChoke_Maul'));
    const affectors = { 'Gameplay/Prefabs/Affectors/States/Affector_Damage_Maul_ForceChoke': affectorFacts(doc('Gameplay/Prefabs/Affectors/States/Affector_Damage_Maul_ForceChoke')) };
    const row = abilityRow({ ability: maul, roles: entries[1].roles, facts, affectors, kind: 'choke' });
    expect(row).toMatchObject({ asset: 'Ability_Maul_ForceChoke', kind: 'choke', slot: 'middle', recharge: 18, cone: 40, range: 15, damage: { perSecond: 80, for: 1.5 } });
    expect(row.from.range).toMatch(/Ability_Luke_ForcePush feeds to/);
    expect(row.from.damage).toBe('Affector_Damage_Maul_ForceChoke');
  });
});
