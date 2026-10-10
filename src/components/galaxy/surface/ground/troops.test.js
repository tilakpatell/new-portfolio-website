import { describe, expect, test } from 'vitest';
import { PICKABLE, WEAPONS } from '../weaponRules';
import { FIGURES } from '../figures';
import { OWNERS } from '../../warEffects';
import { SIDE_OF_KIND } from './standing';
import { ARMS, FAMILIES, KINDS_OF_SIDE, SOLDIERS, TROOPS, damageOf, dressOf, hpOf, hurt, kindFor, newSoldier } from './troops';

describe('troops', () => {
  test('every kind a side fields has a row, with a gun the galaxy knows (or none)', () => {
    for (const kind of Object.keys(SIDE_OF_KIND)) {
      const t = TROOPS[kind];
      expect(t, kind).toBeTruthy();
      expect(t.hp).toBeGreaterThan(0);
      if (t.weapon) expect(WEAPONS[t.weapon], `${kind} ${t.weapon}`).toBeTruthy();
    }
    expect(TROOPS.stormtrooper).toMatchObject({ hp: 100, weapon: 'rifle', range: 48, speed: 3.2, cone: 0.3, nerve: 1 });
    expect(TROOPS.clone.weapon).toBe('dc15');
    expect(TROOPS.battledroid).toMatchObject({ hp: 60, weapon: 'e5', nerve: 0 });
    expect(TROOPS.superdroid).toMatchObject({ hp: 160, nerve: 0 });
    expect(TROOPS.droideka.shield).toBe(3);
    expect(TROOPS.probe.weapon).toBeNull();
  });
  test('the clone’s DC-15 and the droid’s E-5 are soldiers’ guns, not the hero panel’s', () => {
    expect(WEAPONS.dc15).toMatchObject({ damage: 1, every: 0.4, burst: 3, spread: 0.012, range: 120, side: 'galaxy' });
    expect(PICKABLE).not.toContain('dc15');
    expect(PICKABLE).not.toContain('e5');
    expect(WEAPONS.e5).toMatchObject({ damage: 1, every: 0.5, spread: 0.03, range: 70, side: 'galaxy' });
    expect(PICKABLE).not.toContain('dc15');
    expect(PICKABLE).not.toContain('e5');
  });
  test('each side fields figures the surface can draw, the warEffects owner’s troops first', () => {
    for (const [side, o] of Object.entries(OWNERS)) {
      expect(KINDS_OF_SIDE[side][0], side).toBe(o.troops);
      for (const k of KINDS_OF_SIDE[side]) expect(FIGURES, k).toContain(k);
    }
    expect(KINDS_OF_SIDE.empire).toContain(kindFor('empire', () => 0));
  });
  test('damage falls past two thirds of the range', () => {
    expect(damageOf('rifle', 10)).toBe(10);
    expect(damageOf('rifle', 100)).toBe(6);
    expect(damageOf('nope', 10)).toBe(20); // (weaponRules' blaster's numbers when unknown)
  });
  test('hurt says down at nothing left, and a quest spec’s hp maps to the scale', () => {
    const s = newSoldier({ id: 'a', kind: 'battledroid', side: 'separatists', role: 'post', at: [1, 2], yaw: 0, home: [1, 2], squad: 'q' }, () => 0.5);
    expect(s).toMatchObject({ id: 'a', hp: 60, hpMax: 60, weapon: 'e5', alive: true, suppressed: 0, heat: 0, grudge: 0, b: { x: 1, z: 2 } });
    expect(hurt(s, 30)).toBe('hurt');
    expect(hurt(s, 30)).toBe('down');
    expect(s.alive).toBe(false);
    expect(hpOf({ hp: 4 })).toBe(40);
  });
  test('the old tables are the one table’s', () => {
    expect(ARMS).toEqual({ tusken: 'sniper', jango: 'westar', greedo: 'blaster', aqualish: 'blaster', scouttrooper: 'blaster', stormtrooper: 'e11', sandtrooper: 'e11', snowtrooper: 'e11', shoretrooper: 'e11', deathtrooper: 'e11', clone: 'dc15', battledroid: 'e5', mercenary: 'rifle', hothtrooper: 'a280', rebel: 'a280' });
    expect(FAMILIES).toEqual({ stormtrooper: ['stormtrooper', 'sandtrooper', 'snowtrooper', 'scouttrooper'], rebel: ['rebel', 'hothtrooper'], clone: ['clone'], battledroid: ['battledroid', 'superdroid'], mercenary: ['mercenary'] });
    expect([...SOLDIERS]).toEqual(['stormtrooper', 'sandtrooper', 'snowtrooper', 'scouttrooper', 'shoretrooper', 'deathtrooper', 'tiepilot', 'officer', 'clone', 'rex', 'battledroid', 'superdroid', 'rebel', 'hothtrooper', 'wingguard', 'senateguard', 'bobafett', 'greedo', 'jango', 'mando', 'bokatan', 'fennec', 'caradune', 'ig11', 'greef']);
  });
});

describe('a world’s own kit', () => {
  test('dresses a side’s trooper in the world’s uniform, and leaves the rest', () => {
    const hoth = { stormtrooper: 'snowtrooper', rebel: 'hothtrooper' };
    expect(dressOf('stormtrooper', hoth)).toBe('snowtrooper');
    expect(dressOf('rebel', hoth)).toBe('hothtrooper');
    expect(dressOf('mercenary', hoth)).toBe('mercenary');
    expect(dressOf('stormtrooper', undefined)).toBe('stormtrooper');
  });
});
