import { describe, expect, it } from 'vitest';
import { FRET_KEYS, fretForKey, fretOf, keyForFret, meendTarget, parsePhrase, ratioOf, sameNote, sampleFor, sitarSaFor, tarabHz } from './sitarRules';
import { SITAR_VARIANTS } from './sitarSamples';
import { CHROMATIC, NECK_HIGH, NECK_LOW, RAGAS, SWARA, frets, saHz } from './tuning';

const semis = (r) => 12 * Math.log2(r);

describe('the frets', () => {
  it('has a fret for every swara from mandra Pa to taar Ga, with all the notes', () => {
    for (const id of Object.keys(RAGAS)) {
      const list = frets(id, { all: true });
      expect(list.length).toBe(22);
      expect(list[0]).toMatchObject({ s: 'P', oct: -1 });
      expect(list[list.length - 1]).toMatchObject({ s: 'G', oct: 1 });
      // twelve to the octave, rising
      for (let i = 1; i < list.length; i++) expect(list[i].ratio).toBeGreaterThan(list[i - 1].ratio);
      expect(new Set(list.filter((f) => f.oct === 0).map((f) => f.s))).toEqual(new Set(CHROMATIC));
    }
  });

  it('marks the raga’s notes, and keeps only those when set for the raga', () => {
    const all = frets('bhupali', { all: true });
    const raga = frets('bhupali');
    expect(raga.every((f) => f.inRaga)).toBe(true);
    expect(raga.length).toBe(all.filter((f) => f.inRaga).length);
    expect(all.filter((f) => !f.inRaga).map((f) => f.s)).toContain('m');
    for (const f of raga) expect('SRGPD').toContain(f.s);
  });

  it('stays on the neck', () => {
    for (const id of Object.keys(RAGAS)) for (const f of frets(id, { all: true })) expect(f.ratio >= NECK_LOW && f.ratio <= NECK_HIGH).toBe(true);
  });

  it('has a key for every fret', () => {
    expect(FRET_KEYS.length).toBeGreaterThanOrEqual(frets('yaman', { all: true }).length);
    expect(fretForKey('1')).toBe(0);
    expect(fretForKey('Q')).toBe(12);
    expect(keyForFret(fretForKey('['))).toBe('[');
    expect(fretForKey('z')).toBe(-1);
  });
});

describe('the recordings', () => {
  it('plays every note on the neck, for every Sa, from a recording within two semitones', () => {
    for (let i = 0; i < 12; i++) {
      const s = sitarSaFor(saHz(i));
      for (const f of frets('yaman', { all: true })) {
        const pick = sampleFor(f.ratio * s);
        expect(Math.abs(semis(pick.rate))).toBeLessThanOrEqual(2.05);
      }
    }
  });

  it('alternates between the Da and Ra strokes of the same recording', () => {
    const a = sampleFor(300, 0);
    const b = sampleFor(300, 1);
    expect(a.variant).toBe(b.variant);
    expect(a.take).not.toBe(b.take);
    expect(SITAR_VARIANTS[a.variant].takes.length).toBe(2);
  });

  it('keeps the sitar near its recordings: Sa between 174 and 330 Hz', () => {
    for (let i = 0; i < 12; i++) {
      const s = sitarSaFor(saHz(i));
      expect(s).toBeGreaterThan(174);
      expect(s).toBeLessThanOrEqual(330);
    }
  });
});

describe('meend', () => {
  it('pulls to the next note of the raga', () => {
    // Yaman: from Ga, the next note up is tivra Ma
    expect(meendTarget(SWARA.G, 'yaman')).toBeCloseTo(semis(SWARA.M / SWARA.G), 5);
    // Bhupali has no Ma: from Ga it pulls all the way to Pa
    expect(meendTarget(SWARA.G, 'bhupali')).toBeCloseTo(semis(SWARA.P / SWARA.G), 5);
    // and never further than a fourth
    for (const r of [1, 1.2, 1.5, 0.75, 2]) {
      const st = meendTarget(r, 'malkauns');
      expect(st).toBeGreaterThanOrEqual(1);
      expect(st).toBeLessThanOrEqual(5);
    }
  });
});

describe('phrases', () => {
  it('reads sargam with octave marks', () => {
    expect(ratioOf('S')).toBe(1);
    expect(ratioOf("S'")).toBe(2);
    expect(ratioOf('N.')).toBeCloseTo(15 / 16, 9);
    expect(ratioOf('x')).toBeNull();
  });

  it('turns meend, krintan, andolan, holds and the chikari into timed events', () => {
    const { events, seconds } = parsePhrase("S G>m - N.^S | P~", 0.5);
    expect(seconds).toBeCloseTo(2.5, 9);
    const kinds = events.map((e) => e.kind);
    expect(kinds.filter((k) => k === 'pluck').length).toBe(4);
    expect(kinds).toContain('chikari');
    const krintan = events.find((e) => e.kind === 'glide' && e.tau < 0.02);
    expect(krintan.ratio).toBe(1);
    // events never go back in time within a note
    const plucks = events.filter((e) => e.kind === 'pluck').map((e) => e.t);
    expect([...plucks].sort((a, b) => a - b)).toEqual(plucks);
  });

  it('plays every raga’s own phrase', () => {
    for (const r of Object.values(RAGAS)) {
      const { events, seconds } = parsePhrase(r.phrase, r.beat);
      expect(seconds).toBeGreaterThan(2);
      expect(events.filter((e) => e.kind === 'pluck').length).toBeGreaterThan(4);
      for (const e of events) if (e.ratio) expect(e.ratio).toBeGreaterThan(0);
    }
  });
});

describe('the sympathetic strings', () => {
  it('are eleven, tuned to the raga, from the sitar’s Sa up', () => {
    const s = 293.66;
    const hz = tarabHz('bhupali', s);
    expect(hz.length).toBe(11);
    expect(hz[0]).toBeCloseTo(s, 6);
    for (const f of hz) expect(['S', 'R', 'G', 'P', 'D'].some((n) => sameNote(f, s * SWARA[n]))).toBe(true);
  });

  it('finds the fret a note is on', () => {
    const list = frets('yaman', { all: true });
    expect(list[fretOf(1.5, list)].s).toBe('P');
    expect(fretOf(1.033, list)).toBe(-1); // between Sa and komal Re
  });
});
