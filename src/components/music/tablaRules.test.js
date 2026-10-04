import { describe, expect, it } from 'vitest';
import {
  BAYAN_REF,
  BOLS,
  DAYAN_REF,
  LAYA,
  STROKES,
  TAALS,
  accent,
  alignStart,
  bayanTarget,
  beatBols,
  dayanTarget,
  humanize,
  isBol,
  planTihai,
  rateFor,
  rng,
  takeFor,
} from './tablaRules';
import { TABLA_SLOTS } from './tablaSprite';

const SA = Array.from({ length: 12 }, (_, i) => 440 * 2 ** ((48 + i - 69) / 12)); // C3..B3
const semis = (a, b) => 12 * Math.log2(a / b);
const pitchClass = (f, ref) => ((Math.round(semis(f, ref)) % 12) + 12) % 12;

describe('the strokes', () => {
  it('every bol is made of strokes that exist, dayan before bayan', () => {
    for (const [bol, parts] of Object.entries(BOLS)) {
      expect(parts.length, bol).toBeGreaterThan(0);
      for (const p of parts) expect(STROKES[p], `${bol}: ${p}`).toBeTruthy();
      if (parts.length === 2) {
        expect(STROKES[parts[0]].drum).toBe('dayan');
        expect(STROKES[parts[1]].drum).toBe('bayan');
      }
    }
  });

  it('every take is in the sprite', () => {
    for (const [name, s] of Object.entries(STROKES)) for (const t of s.takes) expect(TABLA_SLOTS[t], `${name}: ${t}`).toBeTruthy();
  });

  it('takes turns between takes, so a repeated bol never sounds machine-made', () => {
    const seen = new Set(Array.from({ length: 6 }, (_, i) => takeFor('ge', i)));
    expect(seen.size).toBe(STROKES.ge.takes.length);
    expect(takeFor('ge', 0)).not.toBe(takeFor('ge', 1));
    expect(takeFor('nonsense', 0)).toBeNull();
  });

  it('knows every bol in every theka', () => {
    for (const t of Object.values(TAALS)) for (const cell of t.theka) for (const b of [].concat(cell)) expect(isBol(b), `${t.name}: ${b}`).toBe(true);
  });
});

describe('tuning', () => {
  it('rings the dayan at Sa for every Sa, close to the drum as recorded', () => {
    for (const sa of SA) {
      const f = dayanTarget(sa);
      expect(pitchClass(f, sa)).toBe(0);
      expect(f).toBeGreaterThanOrEqual(220);
      expect(f).toBeLessThanOrEqual(470);
      expect(Math.abs(semis(f, DAYAN_REF))).toBeLessThanOrEqual(6.5);
    }
  });

  it('sets the bayan to Sa or Pa, never far from where it was recorded', () => {
    for (const sa of SA) {
      const f = bayanTarget(sa);
      expect([0, 7]).toContain(pitchClass(f, sa));
      expect(Math.abs(semis(f, BAYAN_REF))).toBeLessThanOrEqual(3.5);
    }
  });

  it('gives a playback rate that retunes each drum', () => {
    const d = 440 * 2 ** ((50 - 69) / 12); // D3
    expect(rateFor('dayan', d) * DAYAN_REF).toBeCloseTo(dayanTarget(d), 6);
    expect(rateFor('bayan', d) * BAYAN_REF).toBeCloseTo(bayanTarget(d), 6);
  });
});

describe('the theka', () => {
  it('fills each beat with its bols at thah, dugun and chaugun', () => {
    const t = TAALS.teentaal;
    expect(beatBols(t, 0, LAYA.thah)).toEqual([[0, 'Dha']]);
    expect(beatBols(t, 0, LAYA.dugun)).toEqual([
      [0, 'Dha'],
      [0.5, 'Dhin'],
    ]);
    // dugun wraps: the second half of the cycle repeats the theka
    expect(beatBols(t, 8, LAYA.dugun)).toEqual(beatBols(t, 0, LAYA.dugun));
    expect(beatBols(t, 0, LAYA.chaugun).map(([o]) => o)).toEqual([0, 0.25, 0.5, 0.75]);
  });

  it('splits a beat that holds quick bols evenly', () => {
    const t = TAALS.ektaal;
    expect(beatBols(t, 3, 1)).toEqual([
      [0, 'Ti'],
      [0.25, 'Ra'],
      [0.5, 'Ki'],
      [0.75, 'Tak'],
    ]);
  });

  it('plays sam hardest and the start of each vibhag harder than the rest', () => {
    const t = TAALS.jhaptaal;
    expect(accent(t, 0)).toBe(1);
    expect(accent(t, 2)).toBeGreaterThan(accent(t, 1));
    expect(accent(t, 5)).toBeGreaterThan(accent(t, 6));
  });
});

describe('the tihai', () => {
  it('lands its last stroke exactly on sam, in every taal', () => {
    for (const t of Object.values(TAALS)) {
      const beats = t.theka.length;
      const { events, start } = planTihai(beats);
      expect(start).toBeGreaterThanOrEqual(0);
      const last = events[events.length - 1];
      expect(last[0]).toBeCloseTo(beats, 9);
      expect(last[1]).toBe('Dha');
      // three equal phrases: Dha at the start of each
      expect(events.filter(([, b]) => b === 'Dha').length).toBe(6);
    }
  });

  it('keeps time: strokes in order, evenly spaced in pulses', () => {
    const { events, sub } = planTihai(16);
    for (let i = 1; i < events.length; i++) {
      expect(events[i][0]).toBeGreaterThan(events[i - 1][0]);
      const pulses = (events[i][0] - events[i - 1][0]) * sub;
      expect(Math.abs(pulses - Math.round(pulses))).toBeLessThan(1e-9);
    }
  });
});

describe('humanising', () => {
  it('stays within a few milliseconds and a few cents, and repeats from a seed', () => {
    const a = rng(7);
    const b = rng(7);
    for (let i = 0; i < 200; i++) {
      const h = humanize(a);
      expect(Math.abs(h.dt)).toBeLessThanOrEqual(0.004);
      expect(Math.abs(h.vel - 1)).toBeLessThanOrEqual(0.06);
      expect(Math.abs(h.cents)).toBeLessThanOrEqual(6);
      expect(humanize(b)).toEqual(h);
    }
  });
});

describe('the sprite', () => {
  it('finds where a stroke really starts when the decoder shifted it', () => {
    const sr = 1000;
    const data = new Float32Array(2000);
    for (let i = 1012; i < 1100; i++) data[i] = 0.5 * Math.exp(-(i - 1012) / 30);
    const at = alignStart(data, sr, 1.0, 0.3);
    expect(at).toBeGreaterThan(1.009);
    expect(at).toBeLessThan(1.012);
  });

  it('leaves the manifest alone where there is only silence', () => {
    expect(alignStart(new Float32Array(500), 1000, 0.2, 0.1)).toBe(0.2);
  });

  it('has no two strokes overlapping', () => {
    const slots = Object.values(TABLA_SLOTS).sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < slots.length; i++) expect(slots[i][0]).toBeGreaterThan(slots[i - 1][0] + slots[i - 1][1]);
  });
});
