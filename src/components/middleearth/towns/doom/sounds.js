// Mordor's sounds, made in WebAudio: the ash wind and the mountain's rumble,
// the column's drums and the whip, the Eye, the fire, and the eagles. Each
// is played once when called, so nothing is downloaded.

import { audioContext, output } from '../../../../lib/audio';

let noiseBuf = null;
function noise(ac) {
  if (noiseBuf) return noiseBuf;
  const n = ac.sampleRate * 2;
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
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const flt = ac.createBiquadFilter();
  flt.type = type;
  flt.frequency.setValueAtTime(f, t);
  if (sweep) flt.frequency.exponentialRampToValueAtTime(sweep, t + length);
  flt.Q.value = q;
  const g = ac.createGain();
  env(g.gain, t, [[0, 0.0001], [attack, gain], [length, 0.0001]]);
  src.connect(flt).connect(g).connect(out);
  src.start(t, Math.random());
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

// The air of each place: place('plain' | 'slope' | 'crack'). { place, stop }.
export function air() {
  const [ac, out] = ready();
  if (!ac) return { place() {}, stop() {} };
  const master = ac.createGain();
  master.gain.value = 0.0001;
  master.gain.setTargetAtTime(0.42, ac.currentTime, 1.5);
  master.connect(out);
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  src.loop = true;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 260;
  bp.Q.value = 0.7;
  const wind = ac.createGain();
  wind.gain.value = 0.08;
  src.connect(bp).connect(wind).connect(master);
  src.start();
  // the mountain, always, under everything
  const rumble = ac.createBufferSource();
  rumble.buffer = noise(ac);
  rumble.loop = true;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 70;
  const deep = ac.createGain();
  deep.gain.value = 0.15;
  rumble.connect(lp).connect(deep).connect(master);
  rumble.start();
  let where = 'plain';
  let on = true;
  const tick = () => {
    if (!on) return;
    const t = ac.currentTime + 0.05;
    if (where === 'crack') hiss(ac, master, t, { type: 'lowpass', f: 300 + Math.random() * 200, gain: 0.12, attack: 0.3, length: 1.6 });
    else bp.frequency.setTargetAtTime(160 + Math.random() * 260, t, 1.5);
    timer = setTimeout(tick, 900 + Math.random() * 1600);
  };
  let timer = setTimeout(tick, 500);
  return {
    place(z) {
      where = z;
      const now = ac.currentTime;
      wind.gain.setTargetAtTime(z === 'crack' ? 0.02 : 0.09, now, 1);
      deep.gain.setTargetAtTime(z === 'crack' ? 0.45 : z === 'slope' ? 0.3 : 0.15, now, 1);
    },
    stop() {
      on = false;
      clearTimeout(timer);
      master.gain.setTargetAtTime(0.0001, ac.currentTime, 0.3);
      src.stop(ac.currentTime + 1);
      rumble.stop(ac.currentTime + 1);
    },
  };
}

// the column's drum: k how quick
export function drum(k = 1) {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  const gap = 0.42 / k;
  for (let i = 0; i < 4; i++) {
    tone(ac, out, t + i * gap, { f: 70, to: 40, gain: 0.35 - (i % 2) * 0.12, attack: 0.003, length: 0.3 });
    hiss(ac, out, t + i * gap, { type: 'lowpass', f: 400, gain: 0.12, attack: 0.002, length: 0.12 });
  }
}
// the whip
export function whip() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  hiss(ac, out, t, { type: 'bandpass', f: 1200, q: 1, gain: 0.08, attack: 0.15, length: 0.18, sweep: 4000 });
  hiss(ac, out, t + 0.18, { type: 'highpass', f: 2500, gain: 0.5, attack: 0.001, length: 0.06 });
}
// orcs snarling
export function snarl() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  for (let i = 0; i < 3; i++) {
    tone(ac, out, t + i * 0.18, { type: 'sawtooth', f: 110 + Math.random() * 60, to: 80, gain: 0.06, attack: 0.03, length: 0.3 });
    hiss(ac, out, t + i * 0.18, { type: 'bandpass', f: 700, q: 3, gain: 0.08, attack: 0.03, length: 0.3 });
  }
}
// the Eye turning on you
export function eye() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  tone(ac, out, t, { type: 'sawtooth', f: 55, to: 110, gain: 0.1, attack: 0.4, length: 1.6 });
  hiss(ac, out, t, { type: 'bandpass', f: 300, q: 4, gain: 0.25, attack: 0.4, length: 1.6, sweep: 900 });
}
// a footstep on cinders
export function step() {
  const [ac, out] = ready();
  if (!ac) return;
  hiss(ac, out, ac.currentTime + 0.01, { type: 'bandpass', f: 900 + Math.random() * 400, q: 1, gain: 0.12, attack: 0.002, length: 0.09 });
}
// a stumble, and cinders sliding
export function slide() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  hiss(ac, out, t, { type: 'lowpass', f: 1600, gain: 0.3, attack: 0.02, length: 0.9, sweep: 300 });
  tone(ac, out, t, { f: 90, to: 50, gain: 0.25, attack: 0.003, length: 0.25 });
}
// the mountain shaking
export function quake() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  hiss(ac, out, t, { type: 'lowpass', f: 120, gain: 0.8, attack: 0.1, length: 2.2, sweep: 50 });
  hiss(ac, out, t + 0.2, { type: 'bandpass', f: 500, q: 1, gain: 0.15, attack: 0.3, length: 1.8 });
}
// the fire roaring up: k how big
export function fire(k = 1) {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  hiss(ac, out, t, { type: 'lowpass', f: 500, gain: 0.35 * k, attack: 0.2, length: 1.4 * k + 0.4, sweep: 180 });
  hiss(ac, out, t, { type: 'bandpass', f: 1500, q: 0.7, gain: 0.08 * k, attack: 0.1, length: 1.2 * k });
}
// Gollum's cry as he falls
export function precious() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  tone(ac, out, t, { type: 'triangle', f: 900, to: 300, gain: 0.08, attack: 0.05, length: 1.6 });
  hiss(ac, out, t, { type: 'bandpass', f: 2600, q: 3, gain: 0.08, attack: 0.05, length: 1.6, sweep: 900 });
}
// your hand on his
export function grab() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  hiss(ac, out, t, { type: 'bandpass', f: 600, q: 1, gain: 0.25, attack: 0.002, length: 0.12 });
  [523, 659, 784].forEach((f, i) => tone(ac, out, t + 0.1 + i * 0.08, { f, gain: 0.05, attack: 0.03, length: 1.2 }));
}
// the eagle's cry
export function eagle() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  tone(ac, out, t, { type: 'triangle', f: 1800, to: 1200, gain: 0.07, attack: 0.02, length: 0.6 });
  tone(ac, out, t + 0.5, { type: 'triangle', f: 1700, to: 1000, gain: 0.06, attack: 0.02, length: 0.8 });
  hiss(ac, out, t, { type: 'bandpass', f: 3000, q: 4, gain: 0.04, attack: 0.02, length: 1.2 });
}
// wings, beating past
export function wings() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  for (let i = 0; i < 3; i++) hiss(ac, out, t + i * 0.45, { type: 'lowpass', f: 500, gain: 0.25, attack: 0.08, length: 0.35 });
}
// it's done: a long, quiet chord
export function done() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.05;
  [262, 330, 392, 523].forEach((f, i) => tone(ac, out, t + i * 0.25, { f, gain: 0.04, attack: 0.6, length: 4 }));
}
