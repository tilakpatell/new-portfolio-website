import { describe, expect, it } from 'vitest';
import { BLASTS, IMPACTS, SURFACES, blastPlan, countFor, familySurface, impactPlan, rampColour, stepChunk, surfaceOf } from './fxPlan';

describe('countFor: particle counts by tier', () => {
  it('all at high and ultra, half at mid, a quarter at low, never under one', () => {
    expect(countFor(24, 'high')).toBe(24);
    expect(countFor(24, 'ultra')).toBe(24);
    expect(countFor(24, 'mid')).toBe(12);
    expect(countFor(24, 'low')).toBe(6);
    expect(countFor(2, 'low')).toBe(1);
    expect(countFor(0, 'low')).toBe(0);
  });
});

describe('surfaceOf', () => {
  it('the ground a world says it has, a wall as metal or stone', () => {
    expect(surfaceOf({ sound: { ground: 'snow' } }, true)).toBe('snow');
    expect(surfaceOf({ sound: { ground: 'sand' } }, true)).toBe('sand');
    expect(surfaceOf({ sound: { ground: 'grass' } }, true)).toBe('stone');
    expect(surfaceOf({ sound: { ground: 'mud' } }, true)).toBe('stone');
    expect(surfaceOf({ sound: { ground: 'metal' } }, true)).toBe('metal');
    expect(surfaceOf({ sound: { ground: 'metal' } }, false)).toBe('metal');
    expect(surfaceOf({ sound: { ground: 'snow' } }, false)).toBe('stone');
    // most worlds say it by their terrain's detail
    expect(surfaceOf({ ground: { detail: 'snow' } }, true)).toBe('snow');
    expect(surfaceOf({ ground: { detail: 'sand' } }, true)).toBe('sand');
    expect(surfaceOf({ ground: { detail: 'redsoil' } }, true)).toBe('sand');
    expect(surfaceOf({ ground: { detail: 'leaves' } }, true)).toBe('stone');
    expect(surfaceOf({ sound: { ground: 'sand' }, ground: { detail: 'snow' } }, true)).toBe('sand');
    expect(surfaceOf({}, true)).toBe('stone');
    expect(surfaceOf(null, true)).toBe('stone');
  });
});

describe('familySurface', () => {
  it('takes the material family the game’s grid named (lane P4) to the look’s surface', () => {
    expect(familySurface('snow')).toBe('snow');
    expect(familySurface('rock')).toBe('stone');
    expect(familySurface('wood')).toBe('wood');
    expect(familySurface('metal')).toBe('metal');
    expect(familySurface(undefined)).toBeNull();
    expect(familySurface('glass')).toBeNull();
  });
});

describe('impactPlan', () => {
  it('each surface its mark, its chunks and its colour', () => {
    for (const s of SURFACES) {
      const p = impactPlan(s, 'high');
      expect(IMPACTS[s]).toBeTruthy();
      expect(p.mark.sheet).toMatch(/^(impact|scorch\.metal)$/);
      expect(p.debris.set).toMatch(/^debris\./);
      expect(p.mark.tint).toHaveLength(3);
    }
    expect(impactPlan('metal').mark.sheet).toBe('scorch.metal');
    expect(impactPlan('snow').debris.set).toBe('debris.snow');
    expect(impactPlan('sand').debris.set).toBe('debris.sand');
    // snow is thrown up more than stone is
    expect(impactPlan('snow', 'high').debris.n).toBeGreaterThan(impactPlan('stone', 'high').debris.n);
  });

  it('an unknown surface is stone, and fewer chunks below high', () => {
    expect(impactPlan('lava')).toEqual(impactPlan('stone'));
    expect(impactPlan('snow', 'low').debris.n).toBeLessThan(impactPlan('snow', 'high').debris.n);
  });
});

describe('blastPlan: explosions by vehicle class', () => {
  it('grows with the class, its debris the class’s own, capped by tier', () => {
    const g = blastPlan('grenade', 'high');
    const s = blastPlan('speeder', 'high');
    const w = blastPlan('walker', 'high');
    expect(g.size).toBeLessThan(s.size);
    expect(s.size).toBeLessThan(w.size);
    expect(w.debris.set).toBe('debris.walker');
    expect(blastPlan('fighter', 'high').debris.set).toBe('debris.fighter');
    expect(blastPlan('walker', 'low').debris.n).toBe(Math.max(1, Math.round(w.debris.n / 4)));
    for (const k of Object.keys(BLASTS)) expect(blastPlan(k, 'ultra').debris.n).toBeLessThanOrEqual(32);
  });

  it('an unknown class is a grenade’s', () => {
    expect(blastPlan('nope')).toEqual(blastPlan('grenade'));
  });
});

describe('rampColour', () => {
  it('reads the fire’s colour along the game’s ramp, hot white to dark', () => {
    const ramp = [
      [0, 0, 0],
      [1, 0.5, 0],
      [1, 1, 1],
    ];
    expect(rampColour(ramp, 1)).toEqual([1, 1, 1]);
    expect(rampColour(ramp, 0)).toEqual([0, 0, 0]);
    expect(rampColour(ramp, 0.75)).toEqual([1, 0.75, 0.5]);
    expect(rampColour(ramp, 2)).toEqual([1, 1, 1]);
  });
});

describe('stepChunk', () => {
  it('falls, bounces off the ground losing speed, and comes to rest', () => {
    const c = { p: [0, 2, 0], v: [1, 0, 0], spin: [3, 0, 0], r: [0, 0, 0], rest: false };
    for (let i = 0; i < 400; i++) stepChunk(c, 1 / 60, () => 0);
    expect(c.p[1]).toBeCloseTo(0, 1);
    expect(c.rest).toBe(true);
    expect(c.p[0]).toBeGreaterThan(0.2);
    expect(Math.hypot(...c.v)).toBe(0);
  });

  it('never goes through the ground', () => {
    const c = { p: [0, 0.1, 0], v: [0, -30, 0], spin: [0, 0, 0], r: [0, 0, 0], rest: false };
    stepChunk(c, 1 / 30, () => 0);
    expect(c.p[1]).toBeGreaterThanOrEqual(0);
  });
});
