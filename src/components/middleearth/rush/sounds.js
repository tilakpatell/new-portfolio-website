// The rush's sounds, synthesised (nothing to download): things picked up and
// set down, the knife on the board, scrubbing, a plop into the pot, the
// bell on Butterbur's counter, a coin, a grumble when an order's gone, a
// sizzle when something burns, and the clock's last ticks. Through the
// site's master volume.

import { audioContext, output } from '../../../lib/audio';

let noiseBuf = null;
function noise(ac) {
  if (noiseBuf) return noiseBuf;
  const n = ac.sampleRate;
  noiseBuf = ac.createBuffer(1, n, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}
const ready = () => {
  const ac = audioContext();
  const out = ac ? output() : null;
  return ac && out ? [ac, out] : [null, null];
};
const env = (param, t, points) => {
  param.cancelScheduledValues(t);
  param.setValueAtTime(points[0][1], t + points[0][0]);
  for (let i = 1; i < points.length; i++) param.exponentialRampToValueAtTime(Math.max(points[i][1], 0.0001), t + points[i][0]);
};
function hiss(ac, out, t, { type = 'bandpass', f = 1000, q = 1, gain = 0.3, attack = 0.005, length = 0.2, sweep = null }) {
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  const flt = ac.createBiquadFilter();
  flt.type = type;
  flt.frequency.setValueAtTime(f, t);
  if (sweep) flt.frequency.exponentialRampToValueAtTime(sweep, t + length);
  flt.Q.value = q;
  const g = ac.createGain();
  env(g.gain, t, [[0, 0.0001], [attack, gain], [length, 0.0001]]);
  src.connect(flt).connect(g).connect(out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + length + 0.05);
}
function tone(ac, out, t, { type = 'sine', f = 440, to = null, gain = 0.2, attack = 0.005, length = 0.3 }) {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + length);
  const g = ac.createGain();
  env(g.gain, t, [[0, 0.0001], [attack, gain], [length, 0.0001]]);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + length + 0.05);
}
const play = (fn) => {
  const [ac, out] = ready();
  if (ac) fn(ac, out, ac.currentTime + 0.01);
};

const SOUNDS = {
  pick: () => play((ac, out, t) => tone(ac, out, t, { type: 'triangle', f: 520, to: 780, gain: 0.08, length: 0.08 })),
  put: () => play((ac, out, t) => {
    tone(ac, out, t, { f: 260, to: 150, gain: 0.14, attack: 0.002, length: 0.09 });
    hiss(ac, out, t, { type: 'lowpass', f: 1400, gain: 0.06, attack: 0.002, length: 0.05 });
  }),
  chop: () => play((ac, out, t) => {
    tone(ac, out, t, { type: 'square', f: 180, to: 90, gain: 0.05, attack: 0.001, length: 0.05 });
    hiss(ac, out, t, { type: 'highpass', f: 2500, gain: 0.05, attack: 0.001, length: 0.04 });
  }),
  scrub: () => play((ac, out, t) => hiss(ac, out, t, { type: 'bandpass', f: 2200, q: 2, gain: 0.05, attack: 0.02, length: 0.16, sweep: 3200 })),
  add: () => play((ac, out, t) => tone(ac, out, t, { f: 420, to: 160, gain: 0.16, attack: 0.002, length: 0.16 })),
  ladle: () => play((ac, out, t) => hiss(ac, out, t, { type: 'lowpass', f: 900, gain: 0.12, attack: 0.02, length: 0.3, sweep: 300 })),
  filled: () => play((ac, out, t) => [0, 0.07, 0.14].forEach((d, i) => tone(ac, out, t + d, { f: 300 - i * 40, to: 200 - i * 30, gain: 0.08, length: 0.08 }))),
  baked: () => play((ac, out, t) => tone(ac, out, t, { type: 'triangle', f: 660, gain: 0.08, length: 0.25 })),
  cooked: () => play((ac, out, t) => tone(ac, out, t, { type: 'triangle', f: 590, gain: 0.08, length: 0.25 })),
  served: () => play((ac, out, t) => {
    tone(ac, out, t, { type: 'sine', f: 1320, gain: 0.16, attack: 0.002, length: 0.9 });
    tone(ac, out, t, { type: 'sine', f: 1980, gain: 0.05, attack: 0.002, length: 0.6 });
    tone(ac, out, t + 0.12, { type: 'triangle', f: 1760, to: 2100, gain: 0.07, length: 0.12 });
  }),
  order: () => play((ac, out, t) => [0, 0.14].forEach((d) => tone(ac, out, t + d, { type: 'sine', f: 1180, gain: 0.08, attack: 0.002, length: 0.4 }))),
  nope: () => play((ac, out, t) => tone(ac, out, t, { type: 'sawtooth', f: 140, to: 110, gain: 0.05, length: 0.16 })),
  lapsed: () => play((ac, out, t) => tone(ac, out, t, { type: 'sawtooth', f: 200, to: 90, gain: 0.08, attack: 0.02, length: 0.6 })),
  burnt: () => play((ac, out, t) => {
    hiss(ac, out, t, { type: 'highpass', f: 3000, gain: 0.08, attack: 0.05, length: 0.8 });
    [0, 0.2, 0.4].forEach((d) => tone(ac, out, t + d, { type: 'square', f: 880, gain: 0.03, length: 0.1 }));
  }),
  spilt: () => play((ac, out, t) => hiss(ac, out, t, { type: 'bandpass', f: 1400, q: 0.8, gain: 0.2, attack: 0.01, length: 0.45, sweep: 500 })),
  dash: () => play((ac, out, t) => hiss(ac, out, t, { type: 'bandpass', f: 600, q: 0.7, gain: 0.08, attack: 0.01, length: 0.18, sweep: 1800 })),
  tick: () => play((ac, out, t) => tone(ac, out, t, { type: 'square', f: 1400, gain: 0.03, attack: 0.001, length: 0.04 })),
  start: () => play((ac, out, t) => [0, 0.18, 0.36].forEach((d, i) => tone(ac, out, t + d, { type: 'triangle', f: [523, 659, 784][i], gain: 0.1, length: 0.3 }))),
  end: () => play((ac, out, t) => [0, 0.25, 0.5].forEach((d) => tone(ac, out, t + d, { type: 'sine', f: 990, gain: 0.14, attack: 0.002, length: 1.2 }))),
};

export const sound = (name) => SOUNDS[name]?.();
