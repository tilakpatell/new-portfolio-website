import { describe, expect, it } from 'vitest';
import luke from '../../../data/bf2017/strokes/luke.json';
import palpatine from '../../../data/bf2017/strokes/palpatine.json';
import { DIRS, HEAVY, STANCES, strokeFor } from './combatRules';
import { duelFor } from './duellists';
import { stanceFromTable } from './stanceFromTable';

const of = (table, base = STANCES.single) => stanceFromTable(table, { base, dirs: DIRS, heavy: HEAVY });

describe('a 2017 hero’s stance, from its stroke table', () => {
  const st = of(luke);

  it('has every field a stance has, so the saber reads it as one', () => {
    for (const k of Object.keys(STANCES.single)) expect(st).toHaveProperty(k);
    for (const s of st.strokes) {
      expect(typeof s.clip).toBe('string');
      expect(s.speed).toBeGreaterThan(0);
      expect(s.damage).toBeGreaterThan(0);
    }
  });

  it('chains the game’s six strikes in its order, each with its measured window and its return', () => {
    expect(st.strokes.map((s) => s.clip)).toEqual([1, 2, 3, 4, 5, 6].map((i) => `A_Luke_AttackLoop_Strike${i}`));
    const one = luke.strikes.find((s) => s.name === 'A_Luke_AttackLoop_Strike1');
    expect(st.strokes[0].contact).toEqual(one.contact);
    expect(st.strokes[0].back).toBe('A_Luke_AttackLoop_Strike1_BackToIdle');
    // (a return is never a strike)
    expect(st.strokes.some((s) => /BackToIdle/.test(s.clip))).toBe(false);
  });

  it('makes its heavies of the jump attack and the dash, and names its blocks', () => {
    expect(st.heavies.map((h) => h.clip)).toEqual(['A_Luke_Jump_SaberAttack_Light_FH_01', 'A_Luke_Stand_SaberDash_01']);
    expect(st.blocks.left[0]).toBe('A_Luke_Stand_Block_SwingLeft_01');
    expect(st.blocks.right[0]).toBe('A_Luke_Stand_Block_SwingRight_01');
    expect(st.blocks.left.length).toBeGreaterThan(1); // (the game's several, by variant)
  });

  it('cuts each way with a strike that cuts that way, read from the tip', () => {
    for (const k of Object.keys(DIRS)) expect(st.dirs[k].clip).toMatch(/^A_Luke_/);
    expect(luke.strikes.find((s) => s.name === st.dirs.left.clip).dir).toBe('left');
  });

  it('keeps its cadence: each strike’s length and its return’s', () => {
    const s1 = one('A_Luke_AttackLoop_Strike1');
    // (the strike is over when its blade comes to rest: the clip holds the pose on for the chain)
    expect(st.cadence['A_Luke_AttackLoop_Strike1']).toEqual({ dur: s1.settle, back: s1.returnDuration });
    expect(s1.settle).toBeLessThan(s1.duration);
  });

  it('is nothing for a set with no strikes (Palpatine’s): the caller keeps its own', () => {
    expect(of(palpatine)).toBe(null);
  });
});

const one = (name) => luke.strikes.find((s) => s.name === name);

describe('strokeFor on the game’s stance', () => {
  const st = of(luke);

  it('gives the game’s names: the chain, a way, a heavy', () => {
    const a = strokeFor(st);
    expect(a.clip).toBe('A_Luke_AttackLoop_Strike1');
    const b = strokeFor(st, { last: { ...a, endedAt: 1 }, now: 1.2 });
    expect(b.clip).toBe('A_Luke_AttackLoop_Strike2');
    expect(strokeFor(st, { dir: 'left' }).clip).toBe(st.dirs.left.clip);
    const h = strokeFor(st, { heavy: true });
    expect(h).toMatchObject({
      kind: 'heavy',
      heavy: true,
      clip: 'A_Luke_Jump_SaberAttack_Light_FH_01',
    });
    expect(strokeFor(st, { heavy: true, last: { ...h, endedAt: 1 }, now: 1.1 }).clip).toBe('A_Luke_Stand_SaberDash_01');
  });

  it('leaves the site’s own stances as they were', () => {
    expect(strokeFor(STANCES.single, { heavy: true }).clip).toBe(HEAVY.clips[0]);
    expect(strokeFor(STANCES.single, { dir: 'rise' }).clip).toBe(DIRS.rise.clip);
  });
});

describe('a 2017 duellist', () => {
  const spec = { kind: 'luke', hostile: { blade: { stance: 'single' } } };

  it('fences with the game’s strikes at the game’s cadence', () => {
    const d = duelFor(spec, 1, { rig: 'walrus', pack: 'luke' });
    expect(d.strokes[0]).toBe('A_Luke_AttackLoop_Strike1');
    expect(d.cadence['A_Luke_AttackLoop_Strike1'].back).toBe(one('A_Luke_AttackLoop_Strike1').returnDuration);
  });

  it('is the site’s duellist for a figure on another rig', () => {
    // (Luke's crew row is the game's own figure since phase 1: no hero here is the site's rig)
    const d = duelFor(spec, 1, null);
    expect(d.strokes).toEqual(STANCES.single.strokes.map((k) => k.clip));
    expect(d.cadence).toBe(null);
  });

  it('is the game’s for the spawn’s own kind when its crew row is the game’s figure', () => {
    expect(duelFor(spec, 1).strokes[0]).toBe('A_Luke_AttackLoop_Strike1');
  });
});
