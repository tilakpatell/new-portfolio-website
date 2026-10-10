import { describe, expect, it } from 'vitest';
import { reticleState, HIT_MS } from './reticle';

describe('reticleState', () => {
  const none = reticleState(null, {});
  it('is hidden with no gun and no sights', () => {
    expect(none).toEqual({ shown: false, tight: 0, hit: null, locked: false });
  });
  it('shows while a gun is up, and tightens fully with the sights', () => {
    expect(reticleState(none, { gun: true }).shown).toBe(true);
    const s = reticleState(none, { gun: true, sights: true });
    expect(s.shown).toBe(true);
    expect(s.tight).toBe(1);
    expect(reticleState(none, { sights: true }).shown).toBe(true);
  });
  it('flashes a hit for 180 ms', () => {
    expect(HIT_MS).toBe(180);
    expect(reticleState(none, { gun: true, hitAt: 1000, now: 1050 }).hit).toBe(50);
    expect(reticleState(none, { gun: true, hitAt: 1000, now: 1180 }).hit).toBe(null);
    expect(reticleState(none, { gun: true, hitAt: null, now: 1050 }).hit).toBe(null);
  });
  it('rings a lock', () => {
    expect(reticleState(none, { gun: true, lock: { name: 'Trooper' } }).locked).toBe(true);
  });
  it('hands back the same object when nothing changed, so a frame loop can skip the render', () => {
    const a = reticleState(none, { gun: true });
    expect(reticleState(a, { gun: true })).toBe(a);
  });
});
