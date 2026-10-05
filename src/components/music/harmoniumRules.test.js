import { describe, expect, it } from 'vitest';
import { BELLOWS, REEDS, STRETCH, computerKeyFor, keyFor, keyForComputer, keyForMidi, pressure, pump, reedsFor, stepBellows } from './harmoniumRules';
import { HARMONIUM_KEYS, SYNC } from './harmoniumSamples';

const semis = (r) => 12 * Math.log2(r);

describe('the recordings', () => {
  it('are every key from E2 to D5, rising, each with a loop inside it', () => {
    expect(HARMONIUM_KEYS.length).toBe(35);
    HARMONIUM_KEYS.forEach(([midi, hz, at, ls, le], i) => {
      expect(midi).toBe(40 + i);
      // in tune with its key, within a quarter of a semitone (the instrument is a little sharp)
      expect(Math.abs(semis(hz / (440 * 2 ** ((midi - 69) / 12))))).toBeLessThan(0.25);
      expect(at).toBeGreaterThan(SYNC);
      expect(ls - at).toBeGreaterThan(0.3); // the attack before the loop
      expect(le - ls).toBeGreaterThan(0.7); // a loop long enough not to be heard as one
      if (i) expect(at).toBeGreaterThan(HARMONIUM_KEYS[i - 1][4]);
    });
  });

  it('plays every note from the nearest key, retuned a little; past the recordings, nothing', () => {
    const a4 = keyFor(440, HARMONIUM_KEYS);
    expect(a4.key[0]).toBe(69);
    expect(Math.abs(semis(a4.rate))).toBeLessThan(0.25);
    // C#2 to F#5: four semitones either side of the recordings (the instrument is a little sharp)
    for (let midi = 37; midi <= 78; midi++) {
      const hz = 440 * 2 ** ((midi - 69) / 12);
      const got = keyFor(hz, HARMONIUM_KEYS);
      expect(got).not.toBeNull();
      expect(Math.abs(semis(got.rate))).toBeLessThanOrEqual(STRETCH);
    }
    expect(keyFor(40, HARMONIUM_KEYS)).toBeNull();
    expect(keyFor(2000, HARMONIUM_KEYS)).toBeNull();
  });
});

describe('the reeds', () => {
  it('sound an octave down, at pitch and an octave up, a few cents apart so they beat', () => {
    const all = reedsFor(220, { bass: true, male: true, female: true });
    expect(all.map((r) => r.bank)).toEqual(['bass', 'male', 'female']);
    expect(all[0].hz).toBeCloseTo(110 * 2 ** (REEDS.bass.cents / 1200), 6);
    expect(all[1].hz).toBe(220);
    expect(Math.abs(1200 * Math.log2(all[2].hz / 440))).toBeGreaterThan(1);
    // more banks, each quieter
    expect(all[1].level).toBeLessThan(reedsFor(220).find((r) => r.bank === 'male').level);
  });

  it('always sound on at least one bank', () => {
    expect(reedsFor(220, {}).map((r) => r.bank)).toEqual(['male']);
    expect(reedsFor(220, null).length).toBe(1);
  });
});

describe('the bellows', () => {
  it('empty faster the more reeds sound, and fill as they are pumped', () => {
    const one = stepBellows(1, 2, 1);
    const chord = stepBellows(1, 2, 6);
    expect(chord).toBeLessThan(one);
    expect(one).toBeLessThan(1);
    expect(pump(0.2, 0.5)).toBeCloseTo(0.2 + 0.5 * BELLOWS.stroke, 9);
    expect(pump(0.9, -1)).toBe(1); // either way across, and never more than full
    expect(stepBellows(0.01, 10, 4)).toBe(0);
  });

  it('keep the reeds at full voice until nearly empty, then let them fade', () => {
    expect(pressure(1)).toBe(1);
    expect(pressure(BELLOWS.full)).toBe(1);
    expect(pressure(0)).toBe(0);
    let prev = 0;
    for (let a = 0; a <= BELLOWS.full; a += 0.01) {
      expect(pressure(a)).toBeGreaterThanOrEqual(prev);
      prev = pressure(a);
    }
  });

  it('last a good while on one note, and not long on a full chord', () => {
    let air = 1;
    let t = 0;
    while (pressure(air) === 1 && t < 60) {
      air = stepBellows(air, 0.1, 1);
      t += 0.1;
    }
    expect(t).toBeGreaterThan(10);
    air = 1;
    t = 0;
    while (pressure(air) === 1 && t < 60) {
      air = stepBellows(air, 0.1, 9);
      t += 0.1;
    }
    expect(t).toBeLessThan(3);
  });
});

describe('the keys', () => {
  it('lay the computer keyboard out as two octaves, Z and Q', () => {
    expect(keyForComputer('z')).toBe(0);
    expect(keyForComputer('S')).toBe(1);
    expect(keyForComputer('m')).toBe(11);
    expect(keyForComputer(',')).toBe(12);
    expect(keyForComputer('q')).toBe(12);
    expect(keyForComputer('2')).toBe(13);
    expect(keyForComputer('i')).toBe(24);
    expect(keyForComputer('a')).toBe(-1);
    for (let k = 0; k < 25; k++) expect(keyForComputer(computerKeyFor(k))).toBe(k);
  });

  it('play a MIDI keyboard from its own C3', () => {
    expect(keyForMidi(48)).toBe(0);
    expect(keyForMidi(60)).toBe(12);
    expect(keyForMidi(36)).toBe(-12);
  });
});
