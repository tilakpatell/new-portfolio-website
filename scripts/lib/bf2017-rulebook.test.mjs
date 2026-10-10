import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { abilityRow, cardRow, checkSources, classRow, weaponRow } from './bf2017-rulebook.mjs';

const ROOT = join(import.meta.dirname, '..', 'fixtures', 'bf2017', 'data');
const A280C = 'Gameplay/Equipment/Rifles/A280C/Ability_Weapon_BlasterRifle_A280C';

// A copy of the fixtures with one record changed, for the broken-chain cases.
function rootWith(name, edit) {
  const dir = mkdtempSync(join(tmpdir(), 'bf2017-'));
  cpSync(ROOT, dir, { recursive: true });
  const file = join(dir, 'data', `${name}.json`);
  writeFileSync(file, JSON.stringify(edit(JSON.parse(readFileSync(file, 'utf8')))));
  return dir;
}

describe('the weapon row', () => {
  const w = weaponRow(ROOT, A280C);

  it('reads the A280C from ability to projectile', () => {
    expect(w.id).toBe('a280c');
    expect(w.name).toBe('ID_W_A280C');
    expect(w.family).toBe('rifle');
    expect(w.firing).toMatchObject({ rof: 600, burst: 3, burstsPerMinute: 110, speed: 700, bulletsPerShot: 1, deploy: 0.8 });
    expect(w.firing.charge).toBeUndefined();
    expect(w.firing.rof_source).toMatch(/#FiringFunctionData\.FireLogic\.RateOfFire$/);
    expect(w.ammo).toBeUndefined();
  });

  it('reads the heat and the active cooling', () => {
    expect(w.heat).toMatchObject({ perBullet: 0.03334, dropPerSecond: 0.3, dropDelay: 5, threshold: 0.8, penalty: 3, overheatedDrop: 1.5, warning: 0.7 });
    expect(w.heat.perBullet_source).toMatch(/W_BlasterRifle_A280C#WeaponOverheatModifier\.HeatPerBullet$/);
    expect(w.heat.cooling).toMatchObject({ window: [0.8, 0.65], shrink: 1, reset: -100, successPenalty: 0.2, failurePenalty: 0.3, minHeat: 0.1, vent: 1, super: [0.4, 0.3] });
  });

  it('reads damage from the bolt', () => {
    expect(w.damage).toMatchObject({ start: 33, end: 19, startDistance: 20, endDistance: 40, min: 1, max: 1 });
    expect(w.damage.start_source).toMatch(/BlasterProjectile_BlasterRifle_A295#WSBulletEntityData\.StartDamage$/);
    expect(w.colour).toBe('red');
  });

  it('reads dispersion by stance, recoil, zoom and range', () => {
    expect(w.dispersion[0]).toMatchObject({ stance: 'stand', min: 0, max: 0.8, perShot: 0.08, decay: 1, noFireDelay: 0.2 });
    expect(w.dispersion[3].min).toBe(0.5);
    expect(w.dispersion).toHaveLength(8);
    expect(w.recoil).toMatchObject({ spring: 3000, damping: 0.84 });
    expect(w.zoom[0].fov).toBeGreaterThan(0);
    expect(w.range).toBe(200);
    expect(w._missing).toEqual([]);
  });

  it('names every number’s source', () => {
    expect(checkSources(w)).toEqual([]);
    expect(checkSources({ a: 1, b: { c: 2, c_source: 'x' }, d: { source: 'hand', e: 3 } })).toEqual(['a']);
    expect(checkSources({ list: [1, 2], list_source: 'x', rows: [{ _source: 'y', n: 1 }] })).toEqual([]);
  });

  it('a weapon whose projectile is missing still has its firing row', () => {
    const root = rootWith('Gameplay/Equipment/Rifles/A280C/WeaponFiring_A280C', (a) => {
      a.objects[1].Shot.ProjectileData.$asset = 'Gameplay/Equipment/Shared/Projectiles/Nope';
      return a;
    });
    const broken = weaponRow(root, A280C);
    expect(broken.firing.rof).toBe(600);
    expect(broken.damage).toBeUndefined();
    expect(broken._missing).toHaveLength(1);
    expect(broken._missing[0]).toContain('Nope');
    expect(checkSources(broken)).toEqual([]);
  });

  it('a weapon that is not there is null', () => {
    expect(weaponRow(ROOT, 'Gameplay/Equipment/Rifles/Nope/Ability_Weapon_Nope')).toBeNull();
  });
});

describe('abilities, cards and classes', () => {
  it('reads Force Choke, its card ranks among its modifiers', () => {
    const a = abilityRow(ROOT, 'Gameplay/Kits/Hero/DarthVader/Ability_DarthVader_ForceChoke_02');
    expect(a).toMatchObject({ id: 'Ability_DarthVader_ForceChoke_02', kind: 'active', slot: 'right', recharge: 25, active: 1.5, activation: 0.1 });
    expect(a.ranks.length).toBeGreaterThanOrEqual(1);
    expect(a.ranks.flatMap((r) => r.modifiers).some((m) => m.property === 'ActiveTime' && m.value === 2.1)).toBe(true);
    expect(checkSources(a)).toEqual([]);
  });

  it('reads the combat roll as a state with a cost', () => {
    const a = abilityRow(ROOT, 'Gameplay/Kits/MP/Assault/Ability_Assault_CombatRoll_CharacterState');
    expect(a).toMatchObject({ kind: 'state', cost: 0.5, recharge: 4, active: 0.1 });
    expect(a.ranks.map((r) => r.level)).toEqual([1, 2, 3, 4]);
    expect(a.ranks[0].modifiers.map((m) => m.value)).toContain(0.95);
  });

  it('reads a star card', () => {
    const c = cardRow(ROOT, 'Gameplay/Equipment/Abilities/Ability_AssaultTraining/SC_Trooper_01_AssaultTraining');
    expect(c).toMatchObject({ id: 'SC_Trooper_01_AssaultTraining', kind: 'passive' });
    expect(c.ranks.length).toBeGreaterThan(0);
  });

  it('reads the Rebel assault class on Hoth', () => {
    const c = classRow(ROOT, 'Assault', 'Orig', 'L');
    expect(c.name).toContain('ID_C_ASSAULT_TROOPER');
    expect(c).toMatchObject({ id: 'l-orig-assault', cls: 'assault', era: 'Orig', faction: 'L', health: 150, regen: { rate: 30, delay: 6 }, weapon: 'a280' });
    expect(c.weapon_source).toContain('DefaultWeapon_L_Assault_Orig');
    expect(c.abilities.map((a) => a.slot)).toEqual(['left', 'middle', 'right']);
    expect(c.abilities[0].id).toBe('DefaultAbility_Assault_ThermalDetonator');
    expect(c.cards).toContain('SC_Trooper_01_AssaultTraining');
    expect(c.weapons).toContain('a280c');
    expect(c.kits).toEqual(['Kit_L_Assault_Orig_HO']);
    expect(checkSources(c)).toEqual([]);
  });
});
