import { describe, expect, it } from 'vitest';
import { ALLEGIANCES, allegianceOf, otherAllegiance, readAllegiance, sideFor } from './allegiance';
import { ASSAULTS } from './surface/missions/assaults';
import { SITES } from './surface/sites';

describe('allegiance', () => {
  it('is the light side unless it’s the dark, whatever was kept', () => {
    expect(readAllegiance('dark')).toBe('dark');
    for (const raw of ['light', null, undefined, '', 'empire', 3, { dark: true }]) expect(readAllegiance(raw)).toBe('light');
    expect(otherAllegiance('dark')).toBe('light');
    expect(otherAllegiance('nonsense')).toBe('dark');
    expect(Object.keys(ALLEGIANCES)).toEqual(['light', 'dark']);
  });

  it('finds your side in a battle, in either order, and the first when none is yours', () => {
    const sides = { sep: { allegiance: 'dark' }, rep: { allegiance: 'light' } };
    expect(sideFor(sides, 'light')).toBe('rep');
    expect(sideFor(sides, 'dark')).toBe('sep');
    expect(sideFor({ a: {}, b: {} }, 'dark')).toBe('a');
    expect(sideFor({ a: {}, b: { allegiance: 'dark' } }, 'light')).toBe('a');
    expect(sideFor({}, 'light')).toBe(null);
    expect(allegianceOf(undefined)).toBe('light');
  });

  it('every battle on the worlds has one side of each', () => {
    for (const [id, m] of Object.entries(ASSAULTS)) expect(new Set(Object.values(m.sides).map(allegianceOf)), id).toEqual(new Set(['light', 'dark']));
    for (const [id, site] of Object.entries(SITES)) {
      if (!site.skirmish) continue;
      expect(new Set(Object.values(site.skirmish.sides).map(allegianceOf)), id).toEqual(new Set(['light', 'dark']));
    }
  });
});
