import { describe, expect, it } from 'vitest';
import { FIGURES } from './figures';
import { OWNERS } from '../warEffects';
import { TROOP_NAMES, garrisonAt, garrisonLife, garrisonLines, troopKind } from './garrison';

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

describe('who meets you at the landing', () => {
  const site = { id: 'yavin', land: { at: [10, -20] }, life: [] };
  it('gives the holder’s troops round the landing, on paths and at posts, and a search party where the holder isn’t the world’s own', () => {
    const own = garrisonAt(site, { owner: 'rebel', troops: 'rebel' }, 'rebel');
    const count = (list) => list.reduce((n, a) => n + (a.n ?? 1), 0);
    expect(count(own)).toBeGreaterThanOrEqual(6);
    expect(count(own)).toBeLessThanOrEqual(10);
    for (const a of own) {
      expect(a.kind).toBe('rebel');
      expect(a.garrison).toBe(true);
      const at = a.at ?? a.path[0];
      expect(Math.hypot(at[0] - 10, at[1] + 20)).toBeLessThan(80);
    }
    expect(own.some((a) => a.path)).toBe(true);
    expect(own.some((a) => a.still)).toBe(true);
    expect(own.some((a) => a.kind === 'probe')).toBe(false);
    const taken = garrisonAt(site, { owner: 'empire', troops: 'stormtrooper' }, 'rebel');
    expect(count(taken.filter((a) => a.kind === 'stormtrooper'))).toBeGreaterThanOrEqual(6);
    expect(taken.filter((a) => a.kind === 'probe').length).toBe(1);
  });
  it('nobody without a holder, and nobody from the Hutts but their enforcers', () => {
    expect(garrisonAt(site, null, 'rebel')).toEqual([]);
    expect(garrisonAt(site, { owner: 'hutt', troops: 'mercenary' }, 'rebel').every((a) => a.kind === 'mercenary')).toBe(true);
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
  it('the landing party speaks by your standing', () => {
    const site = { id: 'hoth', land: { at: [0, 0] }, life: [] };
    const own = garrisonAt(site, { owner: 'rebel', troops: 'rebel', side: 'rebel', war: 'gcw', rank: 4 }, 'rebel');
    expect(own.find((a) => a.path).says).toContain('General.');
    const unsworn = garrisonAt(site, { owner: 'rebel', troops: 'rebel', side: null, war: 'gcw', rank: 0 }, 'rebel');
    expect(unsworn.find((a) => a.path).says).toEqual(['Move along.']);
  });
});

describe('one table of troops', () => {
  it('the families are ground/troops.js’s', async () => {
    const { FAMILIES } = await import('./garrison');
    const troops = await import('./ground/troops');
    expect(FAMILIES).toBe(troops.FAMILIES);
  });
});
