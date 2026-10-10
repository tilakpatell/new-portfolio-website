import { describe, expect, it } from 'vitest';
import { PACKS, clipPath, keyOf, packOf, planPacks } from './walrusClips';

describe('the game’s clips under the site’s names', () => {
  it('names each site clip once, in one pack', () => {
    const all = Object.values(PACKS).flat();
    expect(new Set(all).size).toBe(all.length);
    expect(PACKS.core).toHaveLength(7);
    expect(PACKS.sword).toHaveLength(31);
    expect(packOf('sword.block')).toBe('sword');
    expect(packOf('die.fwd')).toBe('life');
    expect(packOf('nope')).toBeNull();
  });
  it('finds a renamed clip under the bucket’s name', () => {
    expect(keyOf('A_Luke_Idle~0a1b2c3d')).toBe('A_Luke_Idle-0a1b2c3d');
    expect(keyOf('A_Luke_Idle')).toBe('A_Luke_Idle');
    expect(clipPath('X~deadbeef')).toBe('anims/walrus_humanmale/X-deadbeef.glb');
  });
  it('plans the packs from the map, saying what is missing and what the bucket lacks', () => {
    const plan = planPacks({ idle: 'GameIdle', 'sword.block': 'GameBlock', 'die.fwd': 'Gone' }, (p) => !p.includes('Gone'));
    expect(plan.core).toEqual([{ site: 'idle', game: 'GameIdle', path: 'anims/walrus_humanmale/GameIdle.glb' }]);
    expect(plan.sword.map((c) => c.site)).toEqual(['sword.block']);
    expect(plan.life).toEqual([]);
    expect(plan.absent).toEqual(['Gone']);
    expect(plan.missing).toContain('walk');
    expect(plan.missing).not.toContain('idle');
  });
});
