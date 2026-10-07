import { describe, expect, it } from 'vitest';
import { RANKS, rankOf } from './ranks';
import { SIDES } from './sides';

describe('the ranks', () => {
  it('six a side for every side you can swear to, `at` strictly rising from 0', () => {
    const sworn = Object.values(SIDES).filter((s) => s.stance !== 'hutt').map((s) => s.id);
    expect(Object.keys(RANKS).sort()).toEqual(sworn.sort());
    for (const [side, ranks] of Object.entries(RANKS)) {
      expect(ranks, side).toHaveLength(6);
      expect(ranks[0].at).toBe(0);
      for (let i = 1; i < ranks.length; i++) expect(ranks[i].at, `${side} ${ranks[i].id}`).toBeGreaterThan(ranks[i - 1].at);
      for (const r of ranks) expect(r.name).toMatch(/^[A-Z]/);
      expect(new Set(ranks.map((r) => r.id)).size).toBe(6);
    }
  });
  it('the Rebellion from Flight Cadet to Commander, the Empire from Ensign to Admiral', () => {
    expect(RANKS.rebel.map((r) => r.name)).toEqual(['Flight Cadet', 'Pilot', 'Flight Leader', 'Squadron Leader', 'Captain', 'Commander']);
    expect(RANKS.empire.map((r) => r.at)).toEqual([0, 5, 15, 35, 70, 120]);
    expect(RANKS.empire.at(-1).name).toBe('Admiral');
  });
  it('rankOf at 0, at a boundary, past the top, and for nobody', () => {
    expect(rankOf('rebel', 0).name).toBe('Flight Cadet');
    expect(rankOf('rebel', 4.99).name).toBe('Flight Cadet');
    expect(rankOf('rebel', 5).name).toBe('Pilot');
    expect(rankOf('separatists', 10000)).toBe(RANKS.separatists[5]);
    expect(rankOf(null, 50)).toBeNull();
    expect(rankOf('hutt', 50)).toBeNull();
  });
});
