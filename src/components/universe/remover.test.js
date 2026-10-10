import { describe, expect, it } from 'vitest';
import { REMOVER, hearRemover, hitRemover, hpLeft, landingOpen, newRemover, removedUntil, stepRemover } from './remover';

// step a remover on by `s` seconds, a frame at a time; every event back
const run = (r, s, dt = 0.1) => {
  const out = [];
  for (let t = 0; t < s - 1e-9; t += dt) {
    const e = stepRemover(r, dt);
    if (e) out.push(e);
  }
  return out;
};

describe('the NX-5 Planet Remover', () => {
  it('drops out of warp, charges its array, then fires on the planet', () => {
    const r = newRemover('c137');
    expect(r).toMatchObject({ phase: 'arriving', t: 0, planet: 'c137' });
    expect(hpLeft(r)).toBe(REMOVER.hp);
    run(r, REMOVER.arrive - 0.05);
    expect(r.phase).toBe('arriving');
    run(r, 0.1);
    expect(r.phase).toBe('charging');
    // how charged the array is, 0 to 1, over the charge
    expect(r.charge).toBeGreaterThanOrEqual(0);
    run(r, REMOVER.charge / 2);
    expect(r.charge).toBeCloseTo(0.5, 1);
    expect(run(r, REMOVER.charge / 2 + 0.1)).toEqual(['fired']);
    expect(r.phase).toBe('fired');
    // and it fires once, then jumps away
    expect(run(r, REMOVER.leave + 0.2)).toEqual(['left']);
    expect(r.phase).toBe('gone');
    expect(run(r, 30)).toEqual([]);
  });
  it('adds up damage from every pilot shooting at it, and goes up when it’s had enough', () => {
    const r = newRemover('c137');
    run(r, REMOVER.arrive + 1);
    expect(hitRemover(r, 5)).toBe('hit');
    // another pilot's word on what they've done to it (their share, all told)
    expect(hearRemover(r, 'peer-1', 4)).toBe('hit');
    expect(hpLeft(r)).toBe(REMOVER.hp - 9);
    // a pilot's share only grows: an older, smaller word from them changes nothing
    expect(hearRemover(r, 'peer-1', 2)).toBe(null);
    expect(hpLeft(r)).toBe(REMOVER.hp - 9);
    expect(hitRemover(r, REMOVER.hp)).toBe('destroyed');
    expect(r.phase).toBe('destroyed');
    expect(hpLeft(r)).toBe(0);
    // after that, nothing more to hit, and it never fires
    expect(hitRemover(r, 3)).toBe(null);
    expect(run(r, REMOVER.charge + 20)).toEqual(['left']);
    expect(r.firedAt).toBe(null);
    expect(removedUntil(r)).toBe(null);
  });
  it('can be hit as it arrives, but not once it’s fired or gone', () => {
    const r = newRemover('c137');
    run(r, 1);
    expect(hitRemover(r, 1)).toBe('hit');
    run(r, REMOVER.arrive + REMOVER.charge);
    expect(r.phase).toBe('fired');
    expect(hitRemover(r, 1)).toBe(null);
  });
  it('takes the planet away for a minute from when it fires', () => {
    const r = newRemover('c137');
    run(r, REMOVER.arrive + REMOVER.charge + 0.05);
    expect(r.firedAt).toBeCloseTo(REMOVER.arrive + REMOVER.charge, 0);
    expect(removedUntil(r)).toBeCloseTo(r.firedAt + REMOVER.gone, 5);
    expect(REMOVER.gone).toBe(60);
  });
  it('refuses a landing on a removed planet, and only there, and only for the minute', () => {
    const gone = { c137: 100 };
    expect(landingOpen(gone, 'c137', 99)).toBe(false);
    expect(landingOpen(gone, 'c137', 100.1)).toBe(true);
    expect(landingOpen(gone, 'avengers', 50)).toBe(true);
    expect(landingOpen({}, 'c137', 0)).toBe(true);
  });
});
