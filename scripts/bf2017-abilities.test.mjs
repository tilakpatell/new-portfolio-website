import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { build, kitOf, readIndex } from './bf2017-abilities.mjs';

const root = fileURLToPath(new URL('./fixtures/bf2017/abilities/', import.meta.url));

describe('the abilities file, from a fixture of the game’s data', () => {
  it('finds a hero’s kit by the index', () => {
    const idx = readIndex(root);
    expect(kitOf(idx, 'Luke')).toBe('Gameplay/Kits/Hero/Luke/GP_Hero_Luke');
    expect(kitOf(idx, 'Maul')).toBe('Gameplay/Kits/Hero/Maul/GP_Hero_Maul');
  });
  it('writes each hero’s abilities under its site id, and names what the index has that isn’t fetched', () => {
    const { heroes, missing } = build({ root, heroes: ['Luke', 'Maul', 'KyloRen', 'Nobody'] });
    expect(Object.keys(heroes)).toEqual(['luke', 'maul']);
    expect(heroes.luke.kit).toBe('GP_Hero_Luke');
    expect(heroes.luke.abilities).toHaveLength(1);
    expect(heroes.luke.abilities[0]).toMatchObject({ asset: 'Ability_Luke_ForcePush', kind: 'push', recharge: 20, activation: 0.5, cone: 30, range: 12, damage: { hero: 90, trooper: 150 }, knock: 10 });
    expect(heroes.maul.abilities[0]).toMatchObject({ asset: 'Ability_Maul_ForceChoke', kind: 'choke', cone: 40, range: 15, damage: { perSecond: 80, for: 1.5 } });
    expect(heroes.maul.health).toBe(700);
    expect(missing).toEqual(['data/Gameplay/Prefabs/Affectors/CharacterState/Affector_ForcePushed_14m.json']);
  });
});
