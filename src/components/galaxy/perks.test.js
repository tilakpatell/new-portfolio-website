import { describe, expect, it } from 'vitest';
import { MAX_PERKS, PERKS, PERK_IDS, perkEffects, readPerks } from './perks';

describe('the perks', () => {
  it('each bends at least one number and says so', () => {
    for (const id of PERK_IDS) {
      const p = PERKS[id];
      expect(p.name.length).toBeGreaterThan(2);
      expect(p.about.length).toBeGreaterThan(10);
      expect(Object.keys(p).filter((k) => typeof p[k] === 'number').length).toBeGreaterThanOrEqual(1);
    }
    expect(PERK_IDS.length).toBeGreaterThanOrEqual(8);
  });
  it('reads a choice: perks only, no twice, three at most', () => {
    expect(readPerks(['focus', 'focus', 'nope', 'nimble', 'survivor', 'riposte'])).toEqual(['focus', 'nimble', 'survivor']);
    expect(readPerks(null)).toEqual([]);
    expect(MAX_PERKS).toBe(3);
  });
  it('multiplies, and leaves the rest at one', () => {
    const none = perkEffects([]);
    for (const v of Object.values(none)) expect(v).toBe(1);
    const fx = perkEffects(['survivor', 'heatsink']);
    expect(fx.hurt).toBe(0.75);
    expect(fx.heat).toBe(0.75);
    expect(fx.cool).toBe(1.35);
    expect(fx.damage).toBe(1);
  });
});
