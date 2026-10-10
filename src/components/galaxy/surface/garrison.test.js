import { describe, expect, it } from 'vitest';
import { FIGURES } from './figures';
import { OWNERS } from '../warEffects';
import { TROOP_NAMES, garrisonLife, garrisonLines, garrisonProbe, troopKind } from './garrison';

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

describe('the search party', () => {
  const site = { id: 'yavin', land: { at: [10, -20] }, life: [] };
  it('a probe droid where the Empire holds a world that isn’t its own, and nowhere else', () => {
    const probe = garrisonProbe(site, { owner: 'empire', troops: 'stormtrooper' }, 'rebel');
    expect(probe).toHaveLength(1);
    expect(probe[0]).toMatchObject({ kind: 'probe', garrison: true });
    expect(Math.hypot(probe[0].at[0] - 10, probe[0].at[1] + 20)).toBeLessThan(80);
    expect(garrisonProbe(site, { owner: 'remnant', troops: 'stormtrooper' }, 'rebel')).toHaveLength(1);
    expect(garrisonProbe(site, { owner: 'empire', troops: 'stormtrooper' }, 'empire')).toEqual([]);
    expect(garrisonProbe(site, { owner: 'rebel', troops: 'rebel' }, 'empire')).toEqual([]);
    expect(garrisonProbe(site, null, 'rebel')).toEqual([]);
  });
});

describe('the garrison knows your side', () => {
  it('never re-dresses a named person, a quest giver or anyone with an id', () => {
    const life = [
      { id: 'gree', kind: 'clone', name: 'Commander Gree', says: ['The Wookiees fight beside us.'] },
      { kind: 'clone', named: true, name: 'Captain Rex', says: ['Rex here.'] },
      { kind: 'clone', quest: 'q1', name: 'Clone officer', says: ['A job for you.'] },
      { kind: 'clone', n: 3, name: 'Clone trooper', says: ['Sir.'] },
    ];
    const out = garrisonLife(life, 'battledroid');
    expect(out.slice(0, 3)).toEqual(life.slice(0, 3));
    expect(out[3]).toEqual({ kind: 'battledroid', n: 3, name: 'Battle droid' });
  });
  it('salutes its own by rank, and tells the rest to move along', () => {
    expect(garrisonLines('ally', 0)).toContain('Commander.');
    expect(garrisonLines('ally', 0)).toContain('Good to have you back.');
    expect(garrisonLines('ally', 3)).toContain('General.');
    expect(garrisonLines('neutral', 5)).toEqual(['Move along.']);
  });
});

describe('one table of troops', () => {
  it('the families are ground/troops.js’s', async () => {
    const { FAMILIES } = await import('./garrison');
    const troops = await import('./ground/troops');
    expect(FAMILIES).toBe(troops.FAMILIES);
  });
  it('a swapped trooper wears the world’s uniform (Hoth’s snow kit)', () => {
    const hoth = { stormtrooper: 'snowtrooper', rebel: 'hothtrooper' };
    const life = [{ kind: 'hothtrooper', n: 3, name: 'Rebel trooper', says: ['Hold the line.'] }];
    expect(garrisonLife(life, 'stormtrooper', hoth)[0]).toEqual({ kind: 'snowtrooper', n: 3, name: 'Snowtrooper' });
    expect(garrisonLife(life, 'rebel', hoth)).toBe(life);
    expect(garrisonLife(life, 'mercenary', hoth)[0]).toMatchObject({ kind: 'mercenary', name: 'Hutt enforcer' });
  });
});
