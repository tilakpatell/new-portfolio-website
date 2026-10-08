import { describe, expect, it } from 'vitest';
import { DEFAULT, DIFFICULTY, LEVELS, TIERS, difficultyOf, packSkill, readDifficulty } from './difficulty';
import { SKILLS } from './hunterRules';

const seeded = (seed = 7) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

describe('difficulty', () => {
  it('has four levels, normal by default, and anything else reads as normal', () => {
    expect(LEVELS).toEqual(['story', 'normal', 'hard', 'outlaw']);
    expect(DEFAULT).toBe('normal');
    expect(difficultyOf('hard')).toBe(DIFFICULTY.hard);
    expect(difficultyOf('nonsense')).toBe(DIFFICULTY.normal);
    expect(difficultyOf(undefined)).toBe(DIFFICULTY.normal);
    expect(readDifficulty('outlaw')).toBe('outlaw');
    expect(readDifficulty(3)).toBe('normal');
  });

  it('gets harder level by level: tougher pilots, harder hits, bigger packs, a longer search, slower shields', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      const a = DIFFICULTY[LEVELS[i - 1]];
      const b = DIFFICULTY[LEVELS[i]];
      expect(TIERS.indexOf(b.skill)).toBeGreaterThan(TIERS.indexOf(a.skill));
      expect(b.damage).toBeGreaterThan(a.damage);
      expect(b.size).toBeGreaterThanOrEqual(a.size);
      expect(b.search).toBeGreaterThan(a.search);
      expect(b.regen).toBeLessThan(a.regen);
      expect(b.promote).toBeGreaterThanOrEqual(a.promote);
    }
    // and normal is no easier than the old fight
    expect(DIFFICULTY.normal.damage).toBeGreaterThanOrEqual(1);
    expect(DIFFICULTY.normal.skill).toBe('regular');
    expect(DIFFICULTY.normal.promote).toBeGreaterThan(0);
  });

  it('names a skill tier the hunters know for every level', () => {
    expect(TIERS).toEqual(Object.keys(SKILLS));
    for (const id of LEVELS) expect(SKILLS[DIFFICULTY[id].skill]).toBeTruthy();
    for (const id of LEVELS) expect(DIFFICULTY[id].label).toBeTruthy();
  });

  it('promotes a pack the hotter things are, never past the best', () => {
    const share = (base, heat, promote = 0.3) => {
      const rand = seeded(11);
      const got = Array.from({ length: 600 }, () => packSkill(base, { heat, promote, rand }));
      return { up: got.filter((t) => TIERS.indexOf(t) > TIERS.indexOf(base)).length / got.length, got };
    };
    const calm = share('regular', 0);
    const hot = share('regular', 5);
    expect(hot.up).toBeGreaterThan(calm.up + 0.2);
    expect(calm.got.every((t) => TIERS.indexOf(t) >= TIERS.indexOf('regular'))).toBe(true);
    expect(share('elite', 5).got.every((t) => t === 'elite')).toBe(true);
    // story's rookies stay rookies at no heat with no promotion
    expect(share('rookie', 0, 0).got.every((t) => t === 'rookie')).toBe(true);
  });
});
