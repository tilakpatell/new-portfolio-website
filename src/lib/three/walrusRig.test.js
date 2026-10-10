import { describe, expect, it } from 'vitest';
import { BODY, CLIP_FALLBACK, FINGERS, SOCKETS, checkWalrus, isWalrus, resolveClip } from './walrusRig';

describe('the game’s skeleton, by name', () => {
  it('has the 23 body bones, 48 finger bones and five sockets', () => {
    expect(BODY).toHaveLength(23);
    expect(FINGERS).toHaveLength(48);
    expect(Object.values(SOCKETS)).toEqual(['Wep_Root', 'Wep_Muzzle', 'Wep_Aim', 'IK_Joint_LeftHand', 'IK_Joint_RightHand']);
  });
  it('is ok with the body and the sockets, reporting the fingers it lacks without failing', () => {
    expect(checkWalrus(BODY.concat(Object.values(SOCKETS)))).toEqual({ ok: true, missing: [...FINGERS] });
  });
  it('fails without the weapon socket', () => {
    const r = checkWalrus(BODY.concat(Object.values(SOCKETS).filter((n) => n !== 'Wep_Root')));
    expect(r.ok).toBe(false);
    expect(r.missing).toContain('Wep_Root');
  });
  it('tells a 2017 rig from Meshy’s', () => {
    expect(isWalrus([...BODY, 'Spine1'])).toBe(true);
    expect(isWalrus([...BODY, 'Spine02'])).toBe(false);
    expect(isWalrus(['Hips'])).toBe(false);
  });
});

describe('a clip the body lacks', () => {
  it('falls back to the nearest it has, else nothing', () => {
    expect(resolveClip('hit.head', (n) => n === 'hit.chest')).toBe('hit.chest');
    expect(resolveClip('die.fwd', () => false)).toBeNull();
    expect(resolveClip('walk', (n) => n === 'walk')).toBe('walk');
    expect(CLIP_FALLBACK['die.blown']).toBe('die');
  });
});
