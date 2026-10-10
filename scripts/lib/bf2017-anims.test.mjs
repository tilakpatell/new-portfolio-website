import { describe, expect, it } from 'vitest';
import { animEntry, animPath, globRe } from './bf2017-anims.mjs';
import { readManifest } from './bf2017-manifest.mjs';

const ANIMS = readManifest(
  [
    { name: 'A_Luke_AttackLoop_Strike1', file: 'anims/walrus_humanmale/a_luke_attackloop_strike1.glb', fps: 30, frames: 48, skeleton: 'Characters/Rigs/Humanoids/Walrus_HumanMale' },
    { name: 'C_Luke_Stand_Walk_Fwd_01', file: 'anims/walrus_humanmale/c_luke_stand_walk_fwd_01.glb', fps: 30, frames: 52, skeleton: 'Characters/Rigs/Humanoids/Walrus_HumanMale' },
  ]
    .map((e) => JSON.stringify(e))
    .join('\n'),
);

describe('the 2017 clips’ manifest', () => {
  it('finds a clip by its name, or by its name in another case', () => {
    expect(animEntry(ANIMS, 'A_Luke_AttackLoop_Strike1').frames).toBe(48);
    expect(animEntry(ANIMS, 'a_luke_attackloop_strike1').frames).toBe(48);
    expect(animEntry(ANIMS, 'A_Luke_AttackLoop_Strike9')).toBe(null);
  });

  it('puts a clip’s file under the bucket’s web/', () => {
    expect(animPath(animEntry(ANIMS, 'C_Luke_Stand_Walk_Fwd_01'))).toBe('web/anims/walrus_humanmale/c_luke_stand_walk_fwd_01.glb');
  });

  it('matches a glob over whole names, a star for any run of characters', () => {
    const re = globRe('A_Luke_*');
    expect([...ANIMS.keys()].filter((n) => re.test(n))).toEqual(['A_Luke_AttackLoop_Strike1']);
  });
});
