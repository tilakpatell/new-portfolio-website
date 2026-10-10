import { describe, expect, it } from 'vitest';
import { gameClips, heroOfClips } from './saberGame';

const clip = (source) => ({ userData: { source } });

describe('a 2017 hero’s clips, for the saber', () => {
  const clips = { idle: clip('L_Luke_Stand_Unarmed_Idle_01'), 'sword.light.a': clip('A_ObiWan_AttackLoop_Strike1'), 'sword.block': clip('A_ObiWan_Stand_Block_SwingRight_01') };

  it('says whose strikes they are by the strike’s own name, not an idle borrowed from another', () => {
    expect(heroOfClips(clips)).toBe('obiwan');
    expect(heroOfClips({ idle: clip('L_Luke_Stand_Unarmed_Idle_01') })).toBe(null);
    expect(heroOfClips(null)).toBe(null);
  });

  it('keeps the pack’s names and adds the game’s, the same clip under both', () => {
    const all = gameClips(clips);
    expect(all['sword.light.a']).toBe(clips['sword.light.a']);
    expect(all.A_ObiWan_AttackLoop_Strike1).toBe(clips['sword.light.a']);
    expect(all.A_ObiWan_Stand_Block_SwingRight_01).toBe(clips['sword.block']);
  });
});
