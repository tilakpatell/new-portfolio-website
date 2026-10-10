import { describe, expect, it } from 'vitest';
import { BODY, CLIP_FALLBACK, FINGERS, SOCKETS, checkWalrus, isWalrus, resolveClip } from './walrusRig';

describe('the 2017 game’s skeleton, as the site knows it', () => {
  it('has the body, its fingers and its sockets by the game’s names', () => {
    expect(BODY).toHaveLength(23);
    expect(BODY).toContain('Spine1');
    expect(FINGERS).toHaveLength(48);
    expect(FINGERS).toContain('LeftHandThumb1');
    expect(FINGERS).not.toContain('LeftHandThumb0');
    expect(SOCKETS.weapon).toBe('Wep_Root');
  });

  it('checks a tree for the body and the sockets, reporting the fingers without failing on them', () => {
    expect(checkWalrus(BODY.concat(Object.values(SOCKETS)))).toEqual({ ok: true, missing: [...FINGERS] });
    const r = checkWalrus(BODY.concat(Object.values(SOCKETS)).filter((n) => n !== 'Wep_Root'));
    expect(r.ok).toBe(false);
    expect(r.missing).toContain('Wep_Root');
  });

  it('tells a 2017 rig from Meshy’s', () => {
    expect(isWalrus([...BODY, 'Spine1'])).toBe(true);
    expect(isWalrus([...BODY, 'Spine02'])).toBe(false);
    expect(isWalrus(['Hips'])).toBe(false);
  });

  it('falls back to the nearest clip it has, never to nothing when it has one', () => {
    expect(resolveClip('hit.head', (n) => n === 'hit.chest')).toBe('hit.chest');
    expect(resolveClip('die.fwd', () => false)).toBe(null);
    expect(resolveClip('walk', (n) => n === 'walk')).toBe('walk');
    expect(resolveClip('kneel', (n) => n === 'idle')).toBe('idle');
    for (const to of Object.values(CLIP_FALLBACK)) expect(typeof to).toBe('string');
  });
});
