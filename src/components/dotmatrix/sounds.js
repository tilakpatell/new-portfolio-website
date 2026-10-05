// Dot Matrix's sounds, made the way the handheld made them: two pulse
// channels (a square with a narrow duty cycle, for that reedy Game Boy
// edge), a soft triangle for the bass and noise for the hats and splashes.
// Every sound goes through the site's master volume (lib/audio), so the
// sound setting mutes them. The tune is an original loop written for the
// island.

import { audioContext, output } from '../../lib/audio';

const ready = () => {
  const ac = audioContext();
  const out = output();
  return ac && out ? [ac, out] : [null, null];
};

// a pulse wave of the given duty (0.125, 0.25, 0.5), from its Fourier series
const waves = new Map();
function pulse(ac, duty) {
  const key = `${duty}`;
  if (waves.has(key)) return waves.get(key);
  const n = 32;
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  for (let k = 1; k < n; k++) {
    re[k] = (2 / (k * Math.PI)) * Math.sin(2 * Math.PI * k * duty);
    im[k] = (2 / (k * Math.PI)) * (1 - Math.cos(2 * Math.PI * k * duty));
  }
  const w = ac.createPeriodicWave(re, im);
  waves.set(key, w);
  return w;
}

let noiseBuf = null;
function noise(ac) {
  if (noiseBuf) return noiseBuf;
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  let lfsr = 0x7fff; // the Game Boy's noise was a shift register too
  for (let i = 0; i < d.length; i++) {
    const bit = (lfsr ^ (lfsr >> 1)) & 1;
    lfsr = (lfsr >> 1) | (bit << 14);
    d[i] = lfsr & 1 ? 0.6 : -0.6;
  }
  return noiseBuf;
}

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

// One note: a pulse (or triangle) at f, sliding to f2 if given, with a quick
// attack and a decay.
function note(ac, dest, { at = 0, f, f2 = null, dur = 0.1, vol = 0.07, duty = 0.25, type = null }) {
  const t = ac.currentTime + at;
  const o = ac.createOscillator();
  if (type) o.type = type;
  else o.setPeriodicWave(pulse(ac, duty));
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.004);
  g.gain.setValueAtTime(vol, t + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function hiss(ac, dest, { at = 0, dur = 0.2, vol = 0.08, from = 6000, to = 800 }) {
  const t = ac.currentTime + at;
  const s = ac.createBufferSource();
  s.buffer = noise(ac);
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(dest);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.02);
}

const play = (fn) => () => {
  const [ac, out] = ready();
  if (ac) fn(ac, out);
};

export const jump = play((ac, o) => note(ac, o, { f: 380, f2: 820, dur: 0.16, vol: 0.06, duty: 0.5 }));
export const coin = play((ac, o) => {
  note(ac, o, { f: hz(83), dur: 0.07, vol: 0.07, duty: 0.5 });
  note(ac, o, { at: 0.07, f: hz(88), dur: 0.32, vol: 0.07, duty: 0.5 });
});
export const bump = play((ac, o) => note(ac, o, { f: 140, f2: 70, dur: 0.1, vol: 0.09, duty: 0.5 }));
export const stomp = play((ac, o) => {
  note(ac, o, { f: 520, f2: 160, dur: 0.12, vol: 0.07, duty: 0.25 });
  hiss(ac, o, { dur: 0.1, vol: 0.06, from: 3000, to: 400 });
});
export const hurt = play((ac, o) => {
  for (let i = 0; i < 3; i++) note(ac, o, { at: i * 0.07, f: 600 - i * 140, f2: 300 - i * 70, dur: 0.07, vol: 0.06, duty: 0.125 });
});
export const heart = play((ac, o) => [72, 76, 79, 84].forEach((m, i) => note(ac, o, { at: i * 0.06, f: hz(m), dur: 0.12, vol: 0.055 })));
export const cartridge = play((ac, o) => {
  // a little fanfare: up the chord, then a held top note with a harmony under it
  [72, 76, 79, 84, 79, 84].forEach((m, i) => note(ac, o, { at: i * 0.08, f: hz(m), dur: 0.1, vol: 0.06, duty: 0.25 }));
  note(ac, o, { at: 0.5, f: hz(88), dur: 0.55, vol: 0.06, duty: 0.25 });
  note(ac, o, { at: 0.5, f: hz(79), dur: 0.55, vol: 0.045, duty: 0.5 });
  note(ac, o, { at: 0.5, f: hz(48), dur: 0.55, vol: 0.12, type: 'triangle' });
});
export const warp = play((ac, o) => {
  for (let i = 0; i < 3; i++) note(ac, o, { at: i * 0.12, f: hz(67 - i * 5), f2: hz(55 - i * 5), dur: 0.11, vol: 0.06, duty: 0.5 });
});
export const splash = play((ac, o) => hiss(ac, o, { dur: 0.45, vol: 0.12, from: 7000, to: 300 }));
export const blip = play((ac, o) => note(ac, o, { f: 1400, dur: 0.025, vol: 0.025, duty: 0.5 }));
export const over = play((ac, o) => [76, 72, 67, 64, 60].forEach((m, i) => note(ac, o, { at: i * 0.16, f: hz(m), dur: 0.2, vol: 0.06, duty: 0.5 })));
export const fullSet = play((ac, o) => {
  const lead = [72, 76, 79, 84, 83, 79, 81, 84, 88];
  lead.forEach((m, i) => note(ac, o, { at: i * 0.11, f: hz(m), dur: i === lead.length - 1 ? 0.7 : 0.12, vol: 0.06 }));
  [48, 55, 53, 48].forEach((m, i) => note(ac, o, { at: i * 0.27, f: hz(m), dur: 0.26, vol: 0.12, type: 'triangle' }));
});

// ── the island's tune ──
//
// Eight bars of eighth notes at 132 to the minute: a pulse lead over a
// triangle bass, hats on the off-beats. MIDI notes; null rests.
const LEAD = [
  [76, null, 79, null, 84, null, 79, 76],
  [77, null, 81, null, 79, null, 76, null],
  [74, 76, 77, null, 79, null, 81, 79],
  [76, null, 72, null, 74, null, null, null],
  [76, null, 79, null, 84, null, 86, 84],
  [83, null, 79, null, 81, null, 77, null],
  [76, 77, 79, null, 74, null, 79, null],
  [72, null, null, null, null, null, 67, 71],
].flat();
const ROOTS = [48, 53, 55, 48, 48, 52, 55, 48];
const BASS = ROOTS.flatMap((r) => [r, null, r + 7, null, r + 12, null, r + 7, null]);
const STEP = 60 / 132 / 2;

export function music() {
  const [ac, out] = ready();
  if (!ac) return { stop() {} };
  const bus = ac.createGain();
  bus.gain.value = 0;
  bus.gain.linearRampToValueAtTime(1, ac.currentTime + 0.6);
  bus.connect(out);
  let i = 0;
  let next = ac.currentTime + 0.1;
  const tick = () => {
    while (next < ac.currentTime + 0.35) {
      const at = next - ac.currentTime;
      const k = i % LEAD.length;
      if (LEAD[k] != null) note(ac, bus, { at, f: hz(LEAD[k]), dur: STEP * 0.9, vol: 0.03, duty: 0.25 });
      if (BASS[k] != null) note(ac, bus, { at, f: hz(BASS[k]), dur: STEP * 1.6, vol: 0.075, type: 'triangle' });
      if (k % 2 === 1) hiss(ac, bus, { at, dur: 0.035, vol: 0.02, from: 9000, to: 5000 });
      i += 1;
      next += STEP;
    }
  };
  tick();
  const id = setInterval(tick, 90);
  return {
    stop() {
      clearInterval(id);
      try {
        bus.gain.cancelScheduledValues(ac.currentTime);
        bus.gain.setTargetAtTime(0, ac.currentTime, 0.08);
        setTimeout(() => bus.disconnect(), 600);
      } catch {
        // the context went first
      }
    },
  };
}
