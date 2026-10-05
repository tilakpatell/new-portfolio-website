import { describe, expect, it } from 'vitest';
import {
  CHIKARI,
  FRET_KEYS,
  chikariAccent,
  chikariLevel,
  chikariPlan,
  chikariSpeed,
  chikariSub,
  fretForKey,
  fretOf,
  keyForFret,
  meendTarget,
  parsePhrase,
  playerRhythm,
  ratioOf,
  restsOn,
  sameNote,
  sampleFor,
  sitarSaFor,
  tarabHz,
} from './sitarRules';
import { SITAR_VARIANTS } from './sitarSamples';
import { CHROMATIC, NECK_HIGH, NECK_LOW, RAGAS, SWARA, frets, saHz } from './tuning';
import { LAYA, TAALS } from './tablaRules';

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

describe('the auto chikari', () => {
  // The plan decided a stretch at a time, as the sitar's clock asks for it,
  // each stroke remembered as the last chikari, as the sitar does.
  const run = (from, to, hand, step = 0.09) => {
    const out = [];
    let chik = hand.chik ?? -Infinity;
    for (let t = from; t < to; t += step) {
      for (const c of chikariPlan(t, Math.min(t + step, to), { ...hand, chik })) {
        out.push(c);
        chik = c.t;
      }
    }
    return out;
  };
  const times = (plan) => plan.map((c) => Math.round(c.t * 1000) / 1000);
  const grid = { at: 10, beat: 0, len: 0.4, laya: 1, taal: TAALS.teentaal }; // teentaal at 150 bpm, beat 0 at 10 s

  it('stays quiet until a note is played', () => {
    expect(chikariPlan(0, 10, { onsets: [] })).toEqual([]);
    expect(chikariPlan(0, 10, { onsets: [], grid })).toEqual([]);
  });

  it('fills the rest after a note, in a steady pulse, fading as the note does', () => {
    const plan = run(0.9, 8, { onsets: [1], ratio: SWARA.G });
    expect(times(plan)).toEqual([1.5, 2, 2.5]);
    for (let i = 1; i < plan.length; i++) expect(plan[i].vel).toBeLessThan(plan[i - 1].vel);
  });

  it('rings on longer after Sa or Pa, where a phrase rests', () => {
    for (const r of [1, 2, 0.75, 1.5]) {
      expect(restsOn(r)).toBe(true);
      expect(run(0.9, 8, { onsets: [1], ratio: r }).length).toBe(CHIKARI.restFills);
    }
    expect(restsOn(SWARA.G)).toBe(false);
  });

  it('keeps the player’s own pulse, and leaves the next note its beat', () => {
    // notes every 0.8 s: the chikari halves it, and leaves where the next note is due
    expect(times(run(3.3, 9, { onsets: [1, 1.8, 2.6, 3.4], ratio: SWARA.G }))).toEqual([3.8, 4.6]);
    // notes every 0.4 s: the beat after the last is the player's, then the chikari's
    expect(times(run(2.1, 9, { onsets: [1, 1.4, 1.8, 2.2], ratio: SWARA.G }))).toEqual([3, 3.4]);
  });

  it('waits for the left hand: no chikari on top of a slide or a meend', () => {
    const plan = run(0.9, 8, { onsets: [1], ratio: SWARA.G, moved: 1.7 });
    expect(times(plan)).toEqual([2.2, 2.7, 3.2]);
    for (const c of plan) expect(c.t - 1.7).toBeGreaterThanOrEqual(0.14);
  });

  it('leaves room for a chikari struck by hand', () => {
    expect(times(run(0.9, 8, { onsets: [1], ratio: SWARA.G, chik: 1.45 }))).toEqual([2, 2.5]);
  });

  it('keeps the tabla’s beat while a theka plays, hardest on sam, until the note dies away', () => {
    const plan = run(14.9, 20, { onsets: [15], ratio: SWARA.G, grid });
    expect(times(plan)).toEqual([15.2, 15.6, 16, 16.4, 16.8, 17.2, 17.6]);
    for (const c of plan) {
      const beat = (c.t - grid.at) / grid.len;
      expect(beat).toBeCloseTo(Math.round(beat), 6); // on the beat
      expect(c.t - 15).toBeLessThanOrEqual(CHIKARI.ring);
    }
    const sam = plan.find((c) => Math.abs(c.t - 16.4) < 1e-6); // beat 16, the next cycle's first
    for (const c of plan) if (c !== sam) expect(c.vel).toBeLessThan(sam.vel);
  });

  it('never strikes just after a note, even one played between the beats', () => {
    const plan = run(10.3, 12, { onsets: [10.35], ratio: SWARA.G, grid });
    expect(times(plan)[0]).toBe(10.8); // not 10.4, a moment after the note
  });

  it('leaves the beat to the player when their notes come with it', () => {
    const plan = run(13.1, 17, { onsets: [12, 12.4, 12.8, 13.2], ratio: SWARA.G, grid });
    expect(times(plan)[0]).toBe(14);
    expect(times(plan)).not.toContain(13.6);
  });

  it('decides the same strokes however the clock slices the time', () => {
    const hands = [
      { onsets: [1], ratio: 1 },
      { onsets: [1, 1.8, 2.6, 3.4], ratio: SWARA.G },
      { onsets: [15], ratio: SWARA.G, grid },
      { onsets: [12, 12.4, 12.8, 13.2], ratio: 1, grid: { ...grid, laya: LAYA.dugun } },
    ];
    for (const hand of hands) {
      const whole = chikariPlan(0, 30, hand);
      for (const step of [0.025, 0.09, 0.137, 0.5]) expect(times(run(0, 30, hand, step))).toEqual(times(whole));
    }
  });

  it('plays alone if the tabla’s beat makes no sense', () => {
    const bad = { at: 0, beat: 0, len: 0, laya: 1, taal: null };
    expect(times(chikariPlan(0.9, 8, { onsets: [1], ratio: SWARA.G, grid: bad }))).toEqual([1.5, 2, 2.5]);
  });

  it('strikes more often on a slow beat or a quick laya, but never too fast', () => {
    expect(chikariSub(0.4)).toBe(1);
    expect(chikariSub(1)).toBe(2);
    expect(chikariSub(0.4, LAYA.dugun)).toBe(2);
    expect(chikariSub(0.25, LAYA.dugun)).toBe(1);
    for (let bpm = 40; bpm <= 320; bpm += 5)
      for (const laya of Object.values(LAYA)) {
        const sub = chikariSub(60 / bpm, laya);
        const pulse = 60 / bpm / sub;
        expect(pulse).toBeLessThanOrEqual(CHIKARI.hi);
        if (sub > 1) expect(pulse).toBeGreaterThanOrEqual(CHIKARI.fastest);
      }
  });

  it('falls hardest on sam, lighter on khali, lightest between the beats', () => {
    for (const taal of Object.values(TAALS)) {
      const n = taal.theka.length;
      for (let b = 1; b < n; b++) expect(chikariAccent(taal, b)).toBeLessThan(chikariAccent(taal, 0));
      expect(chikariAccent(taal, n)).toBe(chikariAccent(taal, 0)); // the next cycle's sam
      expect(chikariAccent(taal, 1, false)).toBeLessThan(chikariAccent(taal, 1));
    }
    // teentaal: beat 9 begins the khali vibhag, beat 5 the second clap's
    expect(chikariAccent(TAALS.teentaal, 8)).toBeLessThan(chikariAccent(TAALS.teentaal, 4));
  });

  it('keeps a speed the player sets, filling the rest for as long as it would at the usual pulse', () => {
    expect(times(run(0.9, 8, { onsets: [1], ratio: SWARA.G, speed: 120 }))).toEqual([1.5, 2, 2.5]);
    const fast = run(0.9, 8, { onsets: [1], ratio: SWARA.G, speed: 300 });
    expect(times(fast)).toEqual([1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.4, 2.6]);
    for (let i = 1; i < fast.length; i++) expect(fast[i].vel).toBeLessThan(fast[i - 1].vel);
    // a slow speed still strikes once
    expect(times(run(0.9, 8, { onsets: [1], ratio: SWARA.G, speed: 40 }))).toEqual([2.5]);
  });

  it('makes a jhala of notes played evenly over a quick chikari', () => {
    // notes every 0.8 s, the chikari at 300 a minute: three strokes between, the fourth beat left to the note
    const plan = run(0, 3.1, { onsets: [0, 0.8, 1.6, 2.4], ratio: SWARA.G, speed: 300 });
    expect(times(plan)).toEqual([2.6, 2.8, 3]);
    // held as a roll, the same: the note's beat stays the note's
    const held = run(2.4, 3.5, { onsets: [0, 0.8, 1.6, 2.4], ratio: SWARA.G, speed: 300, roll: -1 });
    expect(times(held)).toEqual([2.6, 2.8, 3, 3.4]);
  });

  it('keeps a set speed to the nearest division of the tabla’s beat, counted from sam', () => {
    // teentaal at 150 bpm: 300 a minute is two to a beat, 75 one every other beat
    expect(chikariSub(0.4, 1, 300)).toBe(2);
    expect(chikariSub(0.4, 1, 75)).toBe(0.5);
    expect(chikariSub(0.4, 1, 600)).toBe(4);
    const two = run(14.9, 16.5, { onsets: [15], ratio: SWARA.G, grid, speed: 300 });
    expect(times(two)).toEqual([15.2, 15.4, 15.6, 15.8, 16, 16.2, 16.4]);
    // rupak has seven beats: one every other beat still lands on sam in every cycle
    const rupak = { at: 0, beat: 0, len: 0.4, laya: 1, taal: TAALS.rupak };
    const held = run(0, 6, { onsets: [], grid: rupak, speed: 75, roll: 0 });
    const beats = times(held).map((t) => Math.round(t / 0.4));
    for (const b of [7, 14]) expect(beats).toContain(b);
    for (const b of beats) expect((b % 7) % 2).toBe(0);
  });

  it('rolls on while it is held, with or without a note, auto or not', () => {
    const plan = run(0, 20, { onsets: [], roll: 1, auto: false });
    expect(plan.length).toBe(Math.floor(19 / CHIKARI.roll)); // every quarter second from 1.25 to 20
    expect(plan[0].t).toBeCloseTo(1 + CHIKARI.roll, 9);
    for (const c of plan) expect(c.t).toBeGreaterThan(1); // nothing from before it was taken up
    // auto off and nothing held: nothing at all
    expect(chikariPlan(0, 20, { onsets: [1], auto: false })).toEqual([]);
    // at a set speed, on the tabla's beat
    const tabla = run(10, 14, { onsets: [], grid, speed: 150, roll: 10.05 });
    expect(times(tabla)).toEqual([10.4, 10.8, 11.2, 11.6, 12, 12.4, 12.8, 13.2, 13.6, 14]);
  });

  it('makes room in a roll for the notes played over it', () => {
    const plan = run(0, 4, { onsets: [2.02], ratio: SWARA.G, roll: 1, speed: 600 });
    for (const c of plan) expect(c.t < 2.02 || c.t - 2.02 >= 0.14).toBe(true);
    // and carries on in step with the note, the way a jhala's strokes run on from the melody's
    expect(times(plan).filter((t) => t > 2 && t < 2.5)).toEqual([2.22, 2.32, 2.42]);
  });

  it('decides a roll and a set speed the same however the clock slices the time', () => {
    const hands = [
      { onsets: [], roll: 1, speed: 420 },
      { onsets: [3, 3.8], ratio: 1, roll: 1 },
      { onsets: [12], ratio: SWARA.G, grid, speed: 500 },
      { onsets: [], roll: 10, grid: { ...grid, taal: TAALS.rupak }, speed: 75 },
    ];
    for (const hand of hands) {
      const whole = chikariPlan(0, 30, hand);
      for (const step of [0.025, 0.09, 0.137]) expect(times(run(0, 30, hand, step))).toEqual(times(whole));
    }
  });

  it('keeps a stored speed and strength in range', () => {
    expect(chikariSpeed(Infinity)).toBe(CHIKARI.speeds[1]);
    expect(chikariSpeed(5)).toBe(CHIKARI.speeds[0]);
    expect(chikariSpeed('fast')).toBe(240);
    expect(chikariLevel(NaN)).toBe(1);
    expect(chikariLevel(9)).toBe(CHIKARI.level[1]);
    // a speed out of range never stalls the plan
    expect(chikariPlan(0, 2, { onsets: [], roll: 0, speed: Infinity }).length).toBe(20);
  });

  it('hears the player’s pulse since their last pause', () => {
    expect(playerRhythm([1])).toMatchObject({ steady: false, pulse: CHIKARI.pulse });
    const even = playerRhythm([0, 3, 3.5, 4, 4.5]); // the pause after 0 isn't part of it
    expect(even.ioi).toBeCloseTo(0.5, 9);
    expect(even.steady).toBe(true);
    expect(playerRhythm([0, 0.9, 1.2]).steady).toBe(false);
    expect(playerRhythm([0, 0.5, 0.52, 1.02]).ioi).toBeCloseTo(0.5, 9); // a slip of the finger is no rhythm
    // folded into a comfortable range
    expect(playerRhythm([0, 1.2, 2.4]).pulse).toBeCloseTo(0.6, 9);
    expect(playerRhythm([0, 0.2, 0.4]).pulse).toBeCloseTo(0.4, 9);
  });
});
