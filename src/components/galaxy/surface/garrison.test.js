import { describe, expect, it } from 'vitest';
import { FIGURES } from './figures';
import { OWNERS } from '../warEffects';
import { TROOP_NAMES, garrisonLife, troopKind } from './garrison';

describe('the garrison on the ground', () => {
  it('an Imperial trooper kind maps to the Rebellion’s on a Rebel world, and back', () => {
    expect(troopKind('stormtrooper', 'rebel')).toBe('rebel');
    expect(troopKind('snowtrooper', 'rebel')).toBe('rebel');
    expect(troopKind('rebel', 'stormtrooper')).toBe('stormtrooper');
    // the Empire's own: the site's own kind of trooper kept
    expect(troopKind('sandtrooper', 'stormtrooper')).toBe('sandtrooper');
    expect(troopKind('scouttrooper', 'stormtrooper')).toBe('scouttrooper');
    expect(troopKind('clone', 'battledroid')).toBe('battledroid');
  });
  it('leaves everyone else as they are, and everything without a garrison', () => {
    expect(troopKind('jawa', 'rebel')).toBe('jawa');
    expect(troopKind('bantha', 'clone')).toBe('bantha');
    expect(troopKind('stormtrooper', null)).toBe('stormtrooper');
  });
  it('every side’s troops are a figure the surface can draw, with a name', () => {
    for (const o of Object.values(OWNERS)) {
      expect(FIGURES, o.troops).toContain(o.troops);
      expect(TROOP_NAMES[o.troops], o.troops).toMatch(/\S/);
    }
  });
  it('a swapped trooper takes the new side’s name and leaves the old side’s words behind', () => {
    const life = [
      { kind: 'stormtrooper', n: 4, name: 'Stormtrooper', says: ['Move along.'], speed: 1.4 },
      { kind: 'jawa', n: 2, name: 'Jawa', says: ['Utinni!'] },
    ];
    const out = garrisonLife(life, 'rebel');
    expect(out[0]).toEqual({ kind: 'rebel', n: 4, name: 'Rebel trooper', speed: 1.4 });
    expect(out[1]).toBe(life[1]);
    expect(garrisonLife(life, 'stormtrooper')).toEqual(life);
    expect(garrisonLife(life, null)).toBe(life);
    expect(garrisonLife(undefined, 'rebel')).toBeUndefined();
  });
});
