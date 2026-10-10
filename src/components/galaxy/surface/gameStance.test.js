import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { strokeTable } from '../../../data/bf2017/strokes';
import { STANCES, STANCE_IDS } from './combatRules';
import { stanceFor } from './gameStance';

describe('a stance for a hero on the game’s rig', () => {
  it('is the game’s for a walrus hero with a table, the site’s for anyone else', () => {
    expect(stanceFor('single', { rig: 'walrus', pack: 'luke' }).strokes[0].clip).toBe('A_Luke_AttackLoop_Strike1');
    expect(stanceFor('single', { rig: 'walrus', pack: 'luke' })).toBe(stanceFor('single', { rig: 'walrus', pack: 'luke' }));
    expect(stanceFor('single', { pack: 'luke' })).toBe(STANCES.single);
    expect(stanceFor('double', { rig: 'walrus', pack: 'palpatine' })).toBe(STANCES.double);
    expect(stanceFor('nope')).toBe(STANCES.single);
    expect(STANCE_IDS).toEqual(['single', 'double', 'dual', 'heavy']);
    expect(strokeTable('luke').hero).toBe('luke');
    expect(strokeTable('han')).toBe(null);
  });

  // (the universe's online protocol imports combatRules.js for STANCE_IDS:
  // with the tables behind it, every flight page carried them, and a turret
  // took half a second longer to reach the other pilot, past fly-check's 3 s)
  it('leaves combatRules.js without the tables, so the pages that only need its names don’t load them', () => {
    const src = readFileSync(new URL('./combatRules.js', import.meta.url), 'utf8');
    expect(src).not.toMatch(/^import .*(data\/bf2017|stanceFromTable)/m);
  });
});
