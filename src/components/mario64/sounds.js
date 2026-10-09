// The game's sounds, all synthesised on the runtime's audio bus: effects
// (jumps, coins, stars, stomps, pounds, hurts, splashes, the painting's
// whoosh, a Bob-omb's blast) and original music for the castle, the field,
// the title and a star got, played by a small step sequencer (a lead, a
// bass, chords, drums). Nothing here is the original game's.
//
// createSounds(bus, ctx) → { play(name), music(track | null), mute(on), dispose() }

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
// note names to MIDI: 'C4' → 60; '.' a rest, '-' holds the last note
const midi = (s) => {
  if (s === '.' || s === '-') return s;
  const m = /^([A-G])(#|b)?(\d)$/.exec(s);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]];
  return base + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12;
};
const seq = (str) => str.trim().split(/\s+/).map(midi);

// Original tunes. Each: tempo (16ths a minute), a lead, a bass and chords
// (one entry a 16th), drums as strings of k (kick) h (hat) s (snare).
const TUNES = {
  field: {
    bpm: 140,
    lead: seq(`E5 - G5 - C6 - G5 - A5 - - - G5 - E5 - D5 - E5 - G5 - - - . . . .
               E5 - G5 - C6 - D6 - E6 - D6 - C6 - A5 - G5 - - - E5 - - - . . . .
               F5 - A5 - C6 - A5 - G5 - E5 - C5 - E5 - D5 - - - G4 - - - . . . .
               E5 - G5 - C6 - B5 - C6 - - - G5 - E5 - C5 - - - - - - - . . . .
               G4 - A4 - C5 - D5 - E5 - - - . . . .`),
    bass: seq(`C3 - - - G3 - - - C3 - - - G3 - - - A2 - - - E3 - - - A2 - - - E3 - - -
               F2 - - - C3 - - - F2 - - - C3 - - - G2 - - - D3 - - - G2 - - - B2 - - -
               F2 - - - C3 - - - F2 - - - A2 - - - C3 - - - G2 - - - G2 - - - D3 - - -
               C3 - - - G3 - - - F2 - - - G2 - - - C3 - - - G2 - - - C3 - - - . - - -`),
    chords: [
      [60, 64, 67],
      [57, 60, 64],
      [53, 57, 60],
      [55, 59, 62],
      [53, 57, 60],
      [55, 59, 62],
      [60, 64, 67],
      [55, 59, 62],
    ],
    drums: 'k.h.s.h.k.h.s.hh',
    wave: 'square',
  },
  castle: {
    bpm: 96,
    lead: seq(`A4 - - - C5 - - - E5 - - - D5 - - - C5 - B4 - A4 - - - - - - - . . . .
               F4 - - - A4 - - - C5 - - - B4 - - - A4 - G4 - E4 - - - - - - - . . . .
               D5 - - - C5 - - - B4 - - - A4 - - - G#4 - - - B4 - - - E5 - - - . . . .
               C5 - - - B4 - - - A4 - - - E4 - - - A4 - - - - - - - - - - - . . . .`),
    bass: seq(`A2 - - - - - - - - - - - E2 - - - A2 - - - - - - - - - - - . - - -
               F2 - - - - - - - - - - - C3 - - - E2 - - - - - - - - - - - . - - -
               D2 - - - - - - - - - - - F2 - - - E2 - - - - - - - - - - - . - - -
               A2 - - - - - - - E2 - - - - - - - A2 - - - - - - - - - - - . - - -`),
    chords: [
      [57, 60, 64],
      [57, 60, 64],
      [53, 57, 60],
      [52, 56, 59],
      [50, 53, 57],
      [52, 56, 59],
      [57, 60, 64],
      [57, 60, 64],
    ],
    drums: 'k.......h.......',
    wave: 'triangle',
  },
  title: {
    bpm: 120,
    lead: seq(`C5 - E5 - G5 - C6 - - - B5 - G5 - - - A5 - F5 - A5 - C6 - - - - - - -
               G5 - E5 - C5 - E5 - D5 - - - G4 - - - C5 - - - - - - - - - - - - - - - - -`),
    bass: seq(`C3 - - - - - - - G2 - - - - - - - F2 - - - - - - - F2 - - - - - - -
               C3 - - - - - - - G2 - - - - - - - C3 - - - - - - - . - - - - - - -`),
    chords: [
      [60, 64, 67],
      [55, 59, 62],
      [53, 57, 60],
      [53, 57, 60],
      [60, 64, 67],
      [55, 59, 62],
      [60, 64, 67],
      [60, 64, 67],
    ],
    drums: 'k...h...s...h...',
    wave: 'square',
  },
  starget: {
    bpm: 180,
    once: true,
    lead: seq(`C5 E5 G5 C6 - - E6 - G6 - - - - - - - . . . .`),
    bass: seq(`C3 - - - - - - - G3 - - - C4 - - - . . . .`),
    chords: [[60, 64, 67]],
    drums: 'k...k...k.k.s...',
    wave: 'square',
  },
};

export function createSounds(bus, ctx) {
  const out = ctx.createGain();
  out.gain.value = 0.8;
  out.connect(bus);
  const musicGain = ctx.createGain();
  musicGain.gain.value = 0.32;
  musicGain.connect(out);
  const sfxGain = ctx.createGain();
  sfxGain.gain.value = 0.6;
  sfxGain.connect(out);

  const now = () => ctx.currentTime;
  let noiseBuf = null;
  const noise = () => {
    if (noiseBuf) return noiseBuf;
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  };

  // one tone: an oscillator through an envelope, optionally swept
  function tone(dest, { type = 'square', f0, f1 = f0, at = now(), dur = 0.15, vol = 0.3, attack = 0.005, curve = 'exp' }) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, at);
    if (f1 !== f0) {
      if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), at + dur);
      else o.frequency.linearRampToValueAtTime(f1, at + dur);
    }
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(dest);
    o.start(at);
    o.stop(at + dur + 0.05);
  }
  function hiss(dest, { at = now(), dur = 0.2, vol = 0.3, freq = 2000, q = 1, type = 'bandpass', sweep }) {
    const s = ctx.createBufferSource();
    s.buffer = noise();
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, at);
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, at + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    s.connect(f).connect(g).connect(dest);
    s.start(at);
    s.stop(at + dur + 0.05);
  }
  const arp = (notes, step, opts) => notes.forEach((n, i) => tone(sfxGain, { f0: NOTE(n), at: now() + i * step, dur: step * 2, ...opts }));

  const SFX = {
    jump: () => tone(sfxGain, { f0: 280, f1: 620, dur: 0.14, vol: 0.18 }),
    double: () => tone(sfxGain, { f0: 340, f1: 820, dur: 0.16, vol: 0.18 }),
    triple: () => arp([72, 76, 79, 84], 0.05, { vol: 0.16 }),
    coin: () => {
      tone(sfxGain, { type: 'triangle', f0: NOTE(81), dur: 0.08, vol: 0.3 });
      tone(sfxGain, { type: 'triangle', f0: NOTE(88), at: now() + 0.07, dur: 0.35, vol: 0.3 });
    },
    red: () => arp([81, 85, 88, 93], 0.06, { type: 'triangle', vol: 0.28 }),
    star: () => arp([72, 76, 79, 84, 88, 91, 96], 0.07, { vol: 0.2 }),
    oneup: () => arp([76, 79, 88, 84, 86, 91], 0.08, { type: 'triangle', vol: 0.26 }),
    stomp: () => {
      tone(sfxGain, { type: 'sine', f0: 220, f1: 60, dur: 0.18, vol: 0.5 });
      hiss(sfxGain, { dur: 0.08, vol: 0.2, freq: 1200 });
    },
    pound: () => {
      tone(sfxGain, { type: 'sine', f0: 140, f1: 40, dur: 0.35, vol: 0.7 });
      hiss(sfxGain, { dur: 0.25, vol: 0.25, freq: 400, type: 'lowpass' });
    },
    punch: () => hiss(sfxGain, { dur: 0.09, vol: 0.25, freq: 3000, sweep: 800 }),
    hurt: () => tone(sfxGain, { f0: 660, f1: 160, dur: 0.4, vol: 0.2, curve: 'lin' }),
    splash: () => hiss(sfxGain, { dur: 0.5, vol: 0.35, freq: 1500, sweep: 300, q: 0.6 }),
    stroke: () => hiss(sfxGain, { dur: 0.25, vol: 0.12, freq: 900, sweep: 400, q: 0.8 }),
    painting: () => {
      tone(sfxGain, { type: 'sine', f0: 200, f1: 900, dur: 0.6, vol: 0.25 });
      hiss(sfxGain, { dur: 0.6, vol: 0.15, freq: 600, sweep: 4000 });
    },
    door: () => {
      tone(sfxGain, { type: 'sawtooth', f0: 90, f1: 70, dur: 0.3, vol: 0.12 });
      tone(sfxGain, { type: 'sine', f0: 80, f1: 40, at: now() + 0.25, dur: 0.2, vol: 0.4 });
    },
    explode: () => {
      tone(sfxGain, { type: 'sine', f0: 120, f1: 30, dur: 0.8, vol: 0.8 });
      hiss(sfxGain, { dur: 0.9, vol: 0.5, freq: 900, sweep: 120, type: 'lowpass' });
    },
    locked: () => {
      tone(sfxGain, { type: 'square', f0: 120, dur: 0.12, vol: 0.15 });
      tone(sfxGain, { type: 'square', f0: 110, at: now() + 0.14, dur: 0.18, vol: 0.15 });
    },
    land: () => tone(sfxGain, { type: 'sine', f0: 140, f1: 70, dur: 0.08, vol: 0.18 }),
    step: () => hiss(sfxGain, { dur: 0.03, vol: 0.05, freq: 2500 }),
    bonk: () => tone(sfxGain, { type: 'triangle', f0: 600, f1: 300, dur: 0.1, vol: 0.2 }),
    dialog: () => tone(sfxGain, { type: 'triangle', f0: NOTE(79), dur: 0.06, vol: 0.12 }),
    fuse: () => hiss(sfxGain, { dur: 0.3, vol: 0.1, freq: 5000, q: 2 }),
    grab: () => tone(sfxGain, { type: 'triangle', f0: 300, f1: 450, dur: 0.1, vol: 0.18 }),
    throw: () => hiss(sfxGain, { dur: 0.18, vol: 0.2, freq: 1500, sweep: 400 }),
    hit: () => {
      tone(sfxGain, { type: 'square', f0: 200, f1: 90, dur: 0.25, vol: 0.25 });
      hiss(sfxGain, { dur: 0.2, vol: 0.2, freq: 700 });
    },
    appear: () => arp([79, 84, 88, 91], 0.09, { type: 'triangle', vol: 0.2 }),
    dead: () => arp([71, 70, 69, 68, 64, 60], 0.13, { vol: 0.18 }),
  };

  // ─── The sequencer ───────────────────────────────────────────────────────
  let track = null;
  let step = 0;
  let nextAt = 0;
  let timer = null;
  const voices = [];
  function playStep(tune, i, at) {
    const len = 60 / tune.bpm;
    const n = tune.lead[i % tune.lead.length];
    if (typeof n === 'number') {
      let hold = 1;
      while (tune.lead[(i + hold) % tune.lead.length] === '-' && hold < 16) hold++;
      tone(musicGain, { type: tune.wave, f0: NOTE(n), at, dur: len * hold * 0.95, vol: 0.12, attack: 0.01 });
      tone(musicGain, { type: 'sine', f0: NOTE(n + 12), at, dur: len * hold * 0.6, vol: 0.03, attack: 0.01 });
    }
    const b = tune.bass[i % tune.bass.length];
    if (typeof b === 'number') {
      let hold = 1;
      while (tune.bass[(i + hold) % tune.bass.length] === '-' && hold < 16) hold++;
      tone(musicGain, { type: 'triangle', f0: NOTE(b), at, dur: len * hold * 0.9, vol: 0.22, attack: 0.01 });
    }
    // a chord every bar (16 steps), soft
    if (i % 16 === 0) {
      const ch = tune.chords[Math.floor(i / 16) % tune.chords.length];
      for (const c of ch) tone(musicGain, { type: 'sine', f0: NOTE(c), at, dur: len * 15, vol: 0.035, attack: 0.08 });
    }
    const d = tune.drums[i % tune.drums.length];
    if (d === 'k') tone(musicGain, { type: 'sine', f0: 150, f1: 45, at, dur: 0.14, vol: 0.32 });
    else if (d === 'h') hiss(musicGain, { at, dur: 0.04, vol: 0.05, freq: 8000, type: 'highpass' });
    else if (d === 's') hiss(musicGain, { at, dur: 0.12, vol: 0.12, freq: 1800 });
  }
  function tick() {
    if (!track) return;
    const tune = TUNES[track];
    const len = 60 / tune.bpm;
    while (nextAt < now() + 0.15) {
      if (tune.once && step >= tune.lead.length) {
        track = null;
        return;
      }
      playStep(tune, step, nextAt);
      step++;
      nextAt += len;
    }
  }

  return {
    // the mix's levels, for the ?debug panel (module.js's tune)
    mix: { music: musicGain.gain, sfx: sfxGain.gain },
    play(name) {
      SFX[name]?.();
    },
    music(name) {
      if (name === track) return;
      track = TUNES[name] ? name : null;
      step = 0;
      nextAt = now() + 0.05;
      if (track && !timer) timer = setInterval(tick, 30);
      if (!track && timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    get track() {
      return track;
    },
    mute(on) {
      out.gain.setTargetAtTime(on ? 0 : 0.8, now(), 0.05);
    },
    dispose() {
      if (timer) clearInterval(timer);
      timer = null;
      track = null;
      for (const v of voices) v.stop?.();
      out.disconnect();
    },
  };
}

export const TRACKS = Object.keys(TUNES);
