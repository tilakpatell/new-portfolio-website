import { describe, expect, it } from 'vitest';
import { RAGAS, THAATS, TIMES, customRaga } from './ragas';
import { parsePhrase, tarabHz } from './sitarRules';
import { CHROMATIC, FIRST_STRING, SWARA, frets, isRaga, ragaOf, swaraOf } from './tuning';

const NOTE = /^([SrRgGmMPdDnN])([.']?)$/;
// every swara a line of sargam plays, meend and krintan targets included
const swarasIn = (text) =>
  String(text)
    .split(/\s+/)
    .filter((t) => t && t !== '-' && t !== '|')
    .flatMap((t) => t.replace(/~$/, '').split(/[>^]/))
    .map((t) => {
      const m = NOTE.exec(t);
      if (!m) throw new Error(`not a note: ${t}`);
      return m[1];
    });

describe('the raga database', () => {
  const all = Object.entries(RAGAS);

  it('has a good many ragas, from every thaat', () => {
    expect(all.length).toBeGreaterThanOrEqual(35);
    for (const t of Object.keys(THAATS)) expect(all.some(([, r]) => r.thaat === t)).toBe(true);
  });

  it('writes each raga’s notes in order up the octave, from Sa', () => {
    for (const [id, r] of all) {
      expect(r.notes[0], id).toBe('S');
      expect(r.notes, id).toBe(CHROMATIC.filter((s) => r.notes.includes(s)).join(''));
      expect(r.notes.length, id).toBeGreaterThanOrEqual(5);
    }
  });

  it('keeps every raga to its own notes: way up, way down, vadi, samvadi and phrase', () => {
    for (const [id, r] of all) {
      for (const field of ['aroha', 'avaroha', 'phrase']) for (const s of swarasIn(r[field])) expect(r.notes, `${id} ${field}: ${s}`).toContain(s);
      expect(r.notes, id).toContain(r.vadi);
      expect(r.notes, id).toContain(r.samvadi);
      expect(r.vadi, id).not.toBe(r.samvadi);
    }
  });

  it('goes up to taar Sa and comes down to Sa', () => {
    for (const [id, r] of all) {
      expect(r.aroha.trim().split(/\s+/).at(-1), id).toBe("S'");
      expect(r.avaroha.trim().split(/\s+/).at(-1), id).toBe('S');
    }
  });

  it('says when each is sung, and tunes the tanpura to a note it has', () => {
    for (const [id, r] of all) {
      expect(TIMES[r.time], id).toBeTruthy();
      expect(r.thaat === null || Boolean(THAATS[r.thaat]), id).toBe(true);
      expect(FIRST_STRING[r.first], id).toBeTruthy();
      // a raga without Pa never has the tanpura sound it
      if (!r.notes.includes('P')) expect(r.first, id).not.toBe('Pa');
    }
  });

  it('plays every phrase in time and in tune', () => {
    for (const [id, r] of all) {
      const { events, seconds } = parsePhrase(r.phrase, r.beat, r.tune);
      expect(seconds, id).toBeGreaterThan(2);
      expect(events.filter((e) => e.kind === 'pluck').length, id).toBeGreaterThanOrEqual(5);
      for (const e of events) if (e.ratio) expect(Number.isFinite(e.ratio) && e.ratio > 0.4 && e.ratio < 3, id).toBe(true);
    }
  });

  it('only ever lowers a note where a raga tunes it its own way', () => {
    for (const [id, r] of all) {
      if (!r.tune) continue;
      for (const [s, ratio] of Object.entries(r.tune)) {
        expect(r.notes, id).toContain(s);
        expect(ratio, id).toBeLessThan(SWARA[s]);
        expect(1200 * Math.log2(SWARA[s] / ratio), id).toBeLessThan(30); // a shade lower, never another note
      }
    }
  });
});

describe('a raga’s own intonation', () => {
  it('puts Darbari’s Ga and Dha low in its phrase, its frets and its sympathetic strings', () => {
    const d = ragaOf('darbari');
    const ga = parsePhrase('S R g', 0.5, d.tune).events.at(-1).ratio;
    expect(ga).toBeCloseTo(32 / 27, 9);
    const own = frets('darbari', { set: 'raga' });
    expect(own.filter((f) => f.ati).map((f) => f.s)).toEqual(expect.arrayContaining(['g', 'd']));
    expect(tarabHz('darbari', 1).some((hz) => Math.abs(hz - 32 / 27) < 1e-9)).toBe(true);
    // a raga that doesn't tune its own way plays the just notes
    expect(parsePhrase('S R g', 0.5, ragaOf('kafi').tune).events.at(-1).ratio).toBeCloseTo(6 / 5, 9);
  });

  it('keeps Todi’s komal Re, Ga and Dha low', () => {
    const own = frets('todi', { set: 'raga' });
    expect(new Set(own.filter((f) => f.ati).map((f) => f.s))).toEqual(new Set(['r', 'g', 'd']));
  });
});

describe('a raga of your own', () => {
  it('runs up and down the notes you chose, in order, from Sa', () => {
    const r = customRaga('PGSgx', '  Evening walk ');
    expect(r.notes).toBe('SgGP');
    expect(r.name).toBe('Evening walk');
    expect(r.aroha).toBe("S g G P S'");
    expect(r.avaroha).toBe("S' P G g S");
    for (const s of swarasIn(r.phrase)) expect(r.notes).toContain(s);
    expect(r.first).toBe('Pa');
  });

  it('tunes the tanpura to Ma or Ni when it has no Pa, and is always called something', () => {
    expect(customRaga('SRgmD').first).toBe('Ma');
    expect(customRaga('SRGD').first).toBe('Ni');
    expect(customRaga('SRG', '').name).toBe('Your raga');
    expect(customRaga('SRG', 'x'.repeat(80)).name.length).toBe(32);
  });

  it('is found like any other raga, and an unknown one falls back to Yaman', () => {
    expect(isRaga('custom')).toBe(true);
    expect(isRaga('nonsense')).toBe(false);
    expect(ragaOf('custom', { customRaga: { notes: 'SRGPD', name: 'Mine' } })).toMatchObject({ name: 'Mine', notes: 'SRGPD', custom: true });
    expect(ragaOf('custom', { customRaga: { notes: '', name: '' } }).notes.length).toBeGreaterThan(1);
    expect(ragaOf('nonsense').name).toBe('Yaman');
    // its frets and sympathetic strings follow it like any other's
    expect(frets('custom', { set: 'raga' }).length).toBeGreaterThan(0);
  });
});

describe('naming a note heard', () => {
  it('finds the swara and its octave, in or out of tune by a little', () => {
    expect(swaraOf(1)).toEqual({ s: 'S', oct: 0 });
    expect(swaraOf(1.5)).toEqual({ s: 'P', oct: 0 });
    expect(swaraOf(0.75)).toEqual({ s: 'P', oct: -1 });
    expect(swaraOf(2)).toEqual({ s: 'S', oct: 1 });
    expect(swaraOf(1.99)).toEqual({ s: 'S', oct: 1 });
    expect(swaraOf(0.999)).toEqual({ s: 'S', oct: 0 });
    expect(swaraOf(32 / 27)).toEqual({ s: 'g', oct: 0 }); // Darbari's low Ga is still Ga
    expect(swaraOf((15 / 8) * 0.5)).toEqual({ s: 'N', oct: -1 });
  });
});
