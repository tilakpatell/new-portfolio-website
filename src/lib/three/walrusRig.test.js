import { describe, expect, it } from 'vitest';
import { BODY, CLIP_FALLBACK, FINGERS, SOCKETS, WEAPON_FRAME, checkWalrus, isWalrus, resolveClip } from './walrusRig';

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

describe('the weapon socket’s frame', () => {
  it('is a turn of unit length that never points the blade back down the arm', () => {
    const [x, y, z, w] = WEAPON_FRAME.quaternion;
    expect(Math.hypot(x, y, z, w)).toBeCloseTo(1, 6);
    // (the socket's +y through the turn: v' = v + 2w(q×v) + 2q×(q×v))
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const q = [x, y, z];
    const t = cross(q, [0, 1, 0]).map((c) => 2 * c);
    const v = [0, 1, 0].map((c, i) => c + w * t[i] + cross(q, t)[i]);
    expect(v[1]).toBeGreaterThan(-0.2);
    expect(WEAPON_FRAME.position).toHaveLength(3);
  });
});
