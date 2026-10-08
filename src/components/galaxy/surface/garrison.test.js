import { describe, expect, it } from 'vitest';
import { FIGURES } from './figures';
import { OWNERS } from '../warEffects';
import { TROOP_NAMES, garrisonAt, garrisonLife, troopKind } from './garrison';

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
    const own = garrisonAt(site, { owner: 'rebel', troops: 'rebel' }, 'rebel').life;
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
    const taken = garrisonAt(site, { owner: 'empire', troops: 'stormtrooper' }, 'rebel').life;
    expect(count(taken.filter((a) => a.kind === 'stormtrooper'))).toBeGreaterThanOrEqual(6);
    expect(taken.filter((a) => a.kind === 'probe').length).toBe(1);
  });
  it('nobody without a holder, and nobody from the Hutts but their enforcers', () => {
    expect(garrisonAt(site, null, 'rebel')).toEqual({ life: [], hostiles: [] });
    expect(garrisonAt(site, { owner: 'hutt', troops: 'mercenary' }, 'rebel').life.every((a) => a.kind === 'mercenary')).toBe(true);
  });
});

describe('the garrison knows your side', () => {
  const site = { id: 'endor', land: { at: [0, 0] }, life: [] };
  it('never re-dresses someone named or with a quest', () => {
    const life = [{ kind: 'clone', id: 'gree', named: true, quest: 'beachhead', name: 'Commander Gree', says: ['x'] }, { kind: 'clone', n: 3 }];
    const out = garrisonLife(life, 'rebel');
    expect(out[0]).toBe(life[0]);
    expect(out[1].kind).toBe('rebel');
  });
  it('an enemy garrison is hostiles, not people to talk to', () => {
    const { life, hostiles } = garrisonAt(site, { troops: 'stormtrooper', owner: 'empire', side: 'rebel', hostile: true, yours: false });
    expect(life).toEqual([]);
    expect(hostiles.length).toBeGreaterThan(0);
    for (const h of hostiles) {
      expect(h.hostile).toBeTruthy();
      expect(h.tag).toBe('garrison');
    }
    // (the same party as it stands about a world it doesn't hunt you on: six to ten)
    const n = (list) => list.reduce((k, a) => k + (a.n ?? 1), 0);
    expect(n(hostiles.filter((h) => h.kind === 'stormtrooper'))).toBe(n(garrisonAt(site, { troops: 'stormtrooper', owner: 'empire' }).life.filter((a) => a.kind === 'stormtrooper')));
  });
  it('a friendly garrison greets you by rank', () => {
    const { life, hostiles } = garrisonAt(site, { troops: 'rebel', owner: 'rebel', side: 'rebel', yours: true, rank: 3 });
    expect(hostiles).toEqual([]);
    expect(life.some((e) => e.says.some((s) => /Commander|Captain|Lieutenant|General|sir/i.test(s)))).toBe(true);
    expect(life.some((e) => e.says.some((s) => /Squadron Leader/.test(s)))).toBe(true);
  });
  it('unsworn, the garrison is as it always was', () => {
    const { life, hostiles } = garrisonAt(site, { troops: 'stormtrooper', owner: 'empire', side: null, war: 'gcw' });
    expect(hostiles).toEqual([]);
    expect(life.some((e) => e.says.includes('Move along.'))).toBe(true);
  });
  it('the Hutts’ enforcers never hunt anyone', () => {
    expect(garrisonAt(site, { troops: 'mercenary', owner: 'hutt', side: 'rebel', war: 'gcw', hostile: true }).hostiles).toEqual([]);
  });
});
