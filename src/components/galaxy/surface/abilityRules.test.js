import { describe, expect, it } from 'vitest';
import { ABILITIES, ABILITY_IDS, JET, abilitiesOf, jetStep, newJet } from './abilityRules';

describe('the abilities', () => {
  it('each have a name, a word about them and a cooldown, and the thrown ones a blast', () => {
    expect(ABILITY_IDS.length).toBeGreaterThanOrEqual(10);
    for (const id of ABILITY_IDS) {
      const a = ABILITIES[id];
      expect(a.name.length, id).toBeGreaterThan(2);
      expect(a.about.length, id).toBeGreaterThan(10);
      expect(a.cool, id).toBeGreaterThanOrEqual(0);
      if (a.radius != null) {
        expect(a.fuse).toBeGreaterThan(0);
        expect(a.speed).toBeGreaterThan(0);
        expect(a.damage).toBeGreaterThan(0);
      }
    }
    expect(ABILITIES.jetpack.hold).toBe(true);
  });

  it('gives a spec its own pair, else the Force to a saber and a detonator to a gun', () => {
    expect(abilitiesOf({ abilities: { power: 'jetpack', second: 'rocket' } })).toEqual({ power: 'jetpack', second: 'rocket' });
    expect(abilitiesOf({ saber: { color: '#fff' } })).toEqual({ power: 'push', second: 'pull' });
    expect(abilitiesOf({ gun: 'portal' })).toEqual({ power: 'detonator', second: 'overcharge' });
    expect(abilitiesOf({ abilities: { power: 'nope', second: 'rocket' } })).toEqual({ power: 'detonator', second: 'overcharge' });
    expect(abilitiesOf(null)).toEqual({ power: 'detonator', second: 'overcharge' });
  });

  it('burns the jetpack while held, runs dry, and refills on the ground', () => {
    const jet = newJet();
    expect(jet.fuel).toBe(JET.tank);
    jetStep(jet, { hold: true, grounded: true, dt: 0.5 });
    expect(jet.on).toBe(true);
    expect(jet.fuel).toBeCloseTo(JET.tank - 0.5);
    for (let i = 0; i < 20; i++) jetStep(jet, { hold: true, grounded: false, dt: 0.5 });
    expect(jet.fuel).toBe(0);
    expect(jet.on).toBe(false);
    // in the air with the key up: nothing, and no refill
    jetStep(jet, { hold: false, grounded: false, dt: 1 });
    expect(jet.fuel).toBe(0);
    // down: it fills over its refill time, and never past the tank
    jetStep(jet, { hold: false, grounded: true, dt: JET.refill / 2 });
    expect(jet.fuel).toBeCloseTo(JET.tank / 2);
    jetStep(jet, { hold: false, grounded: true, dt: 10 });
    expect(jet.fuel).toBe(JET.tank);
    expect(jet.on).toBe(false);
  });
});
