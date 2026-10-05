// Moria's sounds, synthesised so nothing is downloaded: the still lake and
// the night wind outside, the deep's hum and its drips within; the Watcher
// rising and slamming, the Doors grinding and the gate coming down; the
// dwarf down the well; the drums; the troll; the stair and the Balrog. All
// through the site's master volume.

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
// a big low blow: a drum, a footfall, stone on stone
function thud(ac, out, t, { f = 60, gain = 0.5, length = 0.5, grit = 0.2 }) {
  tone(ac, out, t, { type: 'sine', f, to: f * 0.55, gain, attack: 0.004, length });
  hiss(ac, out, t, { type: 'lowpass', f: 420, gain: grit, attack: 0.003, length: length * 0.6 });
}

// The air of the place. Outside (0): wind off the hills and a lap of
// water; inside (1): a deep, slow hum and water dripping in the dark.
// { inside(k), stop }.
export function air() {
  const [ac, out] = ready();
  if (!ac) return { inside() {}, stop() {} };
  const master = ac.createGain();
  master.gain.value = 0.0001;
  master.gain.setTargetAtTime(0.42, ac.currentTime, 1.5);
  master.connect(out);
  // the wind, outside
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  src.loop = true;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 340;
  bp.Q.value = 0.8;
  const windGain = ac.createGain();
  windGain.gain.value = 0.12;
  src.connect(bp).connect(windGain).connect(master);
  src.start();
  // the hum of the deep, inside
  const hum = [55, 82.4, 110.3].map((f) => {
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const g = ac.createGain();
    g.gain.value = 0.0001;
    o.connect(g).connect(master);
    o.start();
    return { o, g };
  });
  let k = 0;
  let on = true;
  const tick = () => {
    if (!on) return;
    const t = ac.currentTime + 0.05;
    if (k < 0.5) {
      bp.frequency.setTargetAtTime(240 + Math.random() * 300, t, 1.4);
      // the lake, lapping
      if (Math.random() < 0.5) hiss(ac, master, t, { type: 'lowpass', f: 500, gain: 0.05, attack: 0.25, length: 0.9 });
    } else {
      // a drip, somewhere, and its echo
      const f = 1400 + Math.random() * 1600;
      tone(ac, master, t, { type: 'sine', f, to: f * 1.6, gain: 0.05, attack: 0.002, length: 0.09 });
      tone(ac, master, t + 0.28, { type: 'sine', f, to: f * 1.6, gain: 0.015, attack: 0.002, length: 0.09 });
      if (Math.random() < 0.15) hiss(ac, master, t, { type: 'bandpass', f: 180, q: 3, gain: 0.06, attack: 1.5, length: 3.5 });
    }
    timer = setTimeout(tick, k < 0.5 ? 900 + Math.random() * 1400 : 1200 + Math.random() * 2600);
  };
  let timer = setTimeout(tick, 500);
  return {
    inside(v) {
      k = Math.max(0, Math.min(1, v));
      const now = ac.currentTime;
      windGain.gain.setTargetAtTime(0.12 * (1 - k) + 0.0001, now, 0.8);
      hum.forEach(({ g }, i) => g.gain.setTargetAtTime([0.05, 0.02, 0.012][i] * k + 0.0001, now, 1.2));
    },
    stop() {
      on = false;
      clearTimeout(timer);
      master.gain.setTargetAtTime(0.0001, ac.currentTime, 0.3);
      src.stop(ac.currentTime + 1);
      hum.forEach(({ o }) => o.stop(ac.currentTime + 1));
    },
  };
}

// silver lines waking on the rock: a soft shimmer, rising
export function rise() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  [784, 988, 1175, 1568].forEach((f, i) => tone(ac, out, t + i * 0.18, { type: 'sine', f, gain: 0.05, attack: 0.15, length: 1.8 }));
}
// a tentacle breaking the water
export function splash() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  hiss(ac, out, t, { type: 'bandpass', f: 1200, q: 0.7, gain: 0.2, attack: 0.02, length: 0.5, sweep: 500 });
  hiss(ac, out, t + 0.08, { type: 'highpass', f: 3500, gain: 0.06, attack: 0.05, length: 0.7 });
}
// and coming down: a heavy wet blow
export function slam() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  thud(ac, out, t, { f: 70, gain: 0.5, length: 0.4, grit: 0.3 });
  hiss(ac, out, t, { type: 'bandpass', f: 800, q: 0.6, gain: 0.18, attack: 0.003, length: 0.35, sweep: 300 });
}
// the gate, coming down behind you: rock falling, and falling
export function collapse() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  for (let i = 0; i < 9; i++) thud(ac, out, t + i * 0.16 + Math.random() * 0.1, { f: 40 + Math.random() * 40, gain: 0.45 - i * 0.03, length: 0.6, grit: 0.35 });
  hiss(ac, out, t, { type: 'lowpass', f: 1200, gain: 0.35, attack: 0.05, length: 2.6, sweep: 150 });
}
// stone doors swinging on their hinges
export function grind() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  hiss(ac, out, t, { type: 'bandpass', f: 140, q: 2, gain: 0.35, attack: 0.4, length: 3.2, sweep: 90 });
  tone(ac, out, t, { type: 'sawtooth', f: 46, to: 38, gain: 0.05, attack: 0.5, length: 3 });
  thud(ac, out, t + 3, { f: 50, gain: 0.35, length: 0.6 });
}
// caught, in your two hands
export function catchIt() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  hiss(ac, out, t, { type: 'bandpass', f: 1800, q: 1.5, gain: 0.12, attack: 0.002, length: 0.08 });
  tone(ac, out, t, { type: 'sine', f: 660, to: 880, gain: 0.06, attack: 0.005, length: 0.25 });
}
// bones and metal, falling a long way down: k is how hard it lands
export function clatter(k = 1) {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  const n = Math.round(3 + k * 4);
  for (let i = 0; i < n; i++) {
    const at = t + i * (0.09 + Math.random() * 0.12) * (1 + k * 0.4);
    hiss(ac, out, at, { type: 'bandpass', f: 1500 + Math.random() * 2500, q: 4, gain: (0.12 - i * 0.008) * Math.min(1, k + 0.3), attack: 0.001, length: 0.06 });
    tone(ac, out, at, { type: 'triangle', f: 600 + Math.random() * 900, gain: 0.03 * k, attack: 0.001, length: 0.2 });
  }
}
// boom. Boom. Boom-boom: drums in the deep
export function drums() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.05;
  for (const [dt, v] of [[0, 0.7], [0.9, 0.7], [1.8, 0.6], [2.15, 0.75], [3.2, 0.7], [4.1, 0.7], [5, 0.6], [5.35, 0.8]]) thud(ac, out, t + dt, { f: 52, gain: v, length: 0.9, grit: 0.12 });
}
// the troll's bellow
export function roar() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  tone(ac, out, t, { type: 'sawtooth', f: 90, to: 60, gain: 0.16, attack: 0.15, length: 1.4 });
  tone(ac, out, t, { type: 'sawtooth', f: 134, to: 84, gain: 0.08, attack: 0.15, length: 1.3 });
  hiss(ac, out, t, { type: 'bandpass', f: 400, q: 1.2, gain: 0.25, attack: 0.15, length: 1.4, sweep: 220 });
}
// its club, or its chain, on stone
export function smash() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  thud(ac, out, t, { f: 55, gain: 0.6, length: 0.6, grit: 0.4 });
  for (let i = 0; i < 4; i++) hiss(ac, out, t + 0.05 + i * 0.07, { type: 'highpass', f: 2200, gain: 0.08, attack: 0.001, length: 0.08 });
}
// a leap over the gap
export function leap() {
  const [ac, out] = ready();
  if (!ac) return;
  hiss(ac, out, ac.currentTime + 0.01, { type: 'bandpass', f: 700, q: 0.8, gain: 0.14, attack: 0.05, length: 0.5, sweep: 1500 });
}
// stone from the roof
export function rocks() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  thud(ac, out, t, { f: 65, gain: 0.45, length: 0.4, grit: 0.3 });
  for (let i = 0; i < 3; i++) thud(ac, out, t + 0.1 + i * 0.12, { f: 90 + Math.random() * 40, gain: 0.15, length: 0.2, grit: 0.15 });
}
// a stair breaking away
export function crack() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  hiss(ac, out, t, { type: 'highpass', f: 1600, gain: 0.3, attack: 0.001, length: 0.12 });
  thud(ac, out, t + 0.05, { f: 45, gain: 0.5, length: 1.1, grit: 0.35 });
}
// the Balrog: a furnace roar out of the deep, and its whip
export function balrog() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  hiss(ac, out, t, { type: 'lowpass', f: 220, q: 0.7, gain: 0.55, attack: 0.6, length: 3.2, sweep: 900 });
  tone(ac, out, t + 0.2, { type: 'sawtooth', f: 46, to: 30, gain: 0.14, attack: 0.5, length: 2.6 });
  tone(ac, out, t + 0.2, { type: 'sawtooth', f: 69, to: 44, gain: 0.08, attack: 0.5, length: 2.4 });
  hiss(ac, out, t + 2.4, { type: 'highpass', f: 2500, gain: 0.3, attack: 0.002, length: 0.15 });
}
