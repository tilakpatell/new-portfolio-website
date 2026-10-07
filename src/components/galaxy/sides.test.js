import { describe, expect, it } from 'vitest';
import { ERAS } from './systems';
import { WAR_SYSTEMS } from './gcw';
import { SIDES, WARS, WAR_IDS, sideOfCode, warOfSide } from './sides';

describe('the sides', () => {
  it('have short codes, none the same, that a tally key can carry', () => {
    const codes = Object.values(SIDES).map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of codes) expect(c).toMatch(/^[a-z]{2,3}$/);
    for (const [id, s] of Object.entries(SIDES)) {
      expect(s.id).toBe(id);
      expect(sideOfCode(s.code)).toBe(id);
      expect(['light', 'dark', 'hutt']).toContain(s.stance);
      expect(s.name).toMatch(/\S/);
      expect(s.colour).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe('the wars', () => {
  it('one for each of the galaxy’s eras, liberator light and raider dark', () => {
    expect(WAR_IDS).toEqual(['clone', 'gcw', 'remnant']);
    expect(new Set(Object.values(WARS).map((w) => w.era))).toEqual(new Set(ERAS.map((e) => e.id)));
    for (const w of Object.values(WARS)) {
      expect(SIDES[w.liberator].stance, w.id).toBe('light');
      expect(SIDES[w.raider].stance, w.id).toBe('dark');
      expect(warOfSide(w.liberator)).toBe(w.id);
      expect(warOfSide(w.raider)).toBe(w.id);
    }
    expect(warOfSide('hutt')).toBeNull();
  });
  it('open on maps of war systems only, each held once, the Hutts on Tatooine in every war', () => {
    for (const w of Object.values(WARS)) {
      const named = Object.values(w.opening).flat();
      expect(new Set(named).size, w.id).toBe(named.length);
      for (const id of named) expect(WAR_SYSTEMS, `${w.id}: ${id}`).toContain(id);
      for (const side of Object.keys(w.opening)) expect([w.liberator, w.raider, 'hutt']).toContain(side);
      expect(w.opening.hutt).toContain('tatooine');
    }
  });
});
