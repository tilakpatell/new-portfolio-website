// Amon Hen's sounds, synthesised so nothing is downloaded: the woods and
// the lake, and the falls of Rauros roaring far off; the Ring going on (the
// world gone hollow and roaring) and coming off; the Eye; Boromir; the
// Uruk-hai's roar and steel; Merry and Pippin's shout; the horn of Gondor;
// Sam in the water. All through the site's master volume.

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

// The air: wind in the pines, the lake lapping, the falls far off, birds.
// ring(1) hollows it out into the Unseen world's roar. { ring, stop }.
export function air() {
  const [ac, out] = ready();
  if (!ac) return { ring() {}, stop() {} };
  const master = ac.createGain();
  master.gain.value = 0.0001;
  master.gain.setTargetAtTime(0.42, ac.currentTime, 1.5);
  master.connect(out);
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  src.loop = true;
  // the falls, a low steady roar
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 420;
  const falls = ac.createGain();
  falls.gain.value = 0.07;
  src.connect(lp).connect(falls).connect(master);
  // the wind in the trees
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 900;
  bp.Q.value = 0.6;
  const wind = ac.createGain();
  wind.gain.value = 0.04;
  src.connect(bp).connect(wind).connect(master);
  src.start();
  // the Unseen world: a hollow rushing drone
  const drone = [55, 58.3, 110].map((f) => {
    const o = ac.createOscillator();
    o.type = 'sawtooth';
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
      bp.frequency.setTargetAtTime(600 + Math.random() * 700, t, 1.4);
      if (Math.random() < 0.4) {
        const f = 2200 + Math.random() * 1400;
        for (let i = 0; i < 3; i++) tone(ac, master, t + i * 0.14, { f: f * (1 - i * 0.06), gain: 0.022, attack: 0.01, length: 0.1 });
      }
    } else hiss(ac, master, t, { type: 'bandpass', f: 300 + Math.random() * 400, q: 3, gain: 0.08, attack: 0.6, length: 2.2, sweep: 900 });
    timer = setTimeout(tick, 1100 + Math.random() * 1800);
  };
  let timer = setTimeout(tick, 600);
  return {
    ring(v) {
      k = v;
      const now = ac.currentTime;
      drone.forEach(({ g }, i) => g.gain.setTargetAtTime([0.03, 0.025, 0.012][i] * v + 0.0001, now, 0.5));
      wind.gain.setTargetAtTime(0.04 * (1 - v) + 0.0001, now, 0.5);
      falls.gain.setTargetAtTime(0.07 + v * 0.1, now, 0.5);
      lp.frequency.setTargetAtTime(v ? 220 : 420, now, 0.5);
    },
    stop() {
      on = false;
      clearTimeout(timer);
      master.gain.setTargetAtTime(0.0001, ac.currentTime, 0.3);
      src.stop(ac.currentTime + 1);
      drone.forEach(({ o }) => o.stop(ac.currentTime + 1));
    },
  };
}

// a stick picked up
export function snap() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  hiss(ac, out, t, { type: 'highpass', f: 2000, gain: 0.2, attack: 0.001, length: 0.05 });
  hiss(ac, out, t + 0.03, { type: 'bandpass', f: 900, q: 2, gain: 0.08, attack: 0.002, length: 0.12 });
}
// the Ring going on: a rush, and the world hollow
export function ringOn() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  hiss(ac, out, t, { type: 'bandpass', f: 400, q: 1, gain: 0.35, attack: 0.05, length: 1.4, sweep: 2600 });
  tone(ac, out, t, { type: 'sawtooth', f: 110, to: 55, gain: 0.08, attack: 0.05, length: 1.6 });
}
// and coming off: the world back, all at once
export function ringOff() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  hiss(ac, out, t, { type: 'bandpass', f: 2600, q: 1, gain: 0.25, attack: 0.01, length: 0.7, sweep: 300 });
  tone(ac, out, t + 0.1, { f: 660, gain: 0.05, attack: 0.02, length: 1.2 });
}
// the Eye: a furnace roar, and its voice
export function eye() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  hiss(ac, out, t, { type: 'lowpass', f: 160, q: 0.8, gain: 0.45, attack: 0.2, length: 1.8, sweep: 900 });
  tone(ac, out, t, { type: 'sawtooth', f: 49, to: 41, gain: 0.08, attack: 0.3, length: 1.8 });
  hiss(ac, out, t + 0.3, { type: 'bandpass', f: 3400, q: 4, gain: 0.07, attack: 0.4, length: 1.2, sweep: 1600 });
}
// Boromir, hearing you: a shout
export function boromir() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  tone(ac, out, t, { type: 'sawtooth', f: 180, to: 140, gain: 0.07, attack: 0.03, length: 0.5 });
  hiss(ac, out, t, { type: 'bandpass', f: 700, q: 2, gain: 0.12, attack: 0.03, length: 0.5 });
}
// an Uruk's roar
export function roar() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  tone(ac, out, t, { type: 'sawtooth', f: 110, to: 70, gain: 0.12, attack: 0.08, length: 1 });
  hiss(ac, out, t, { type: 'bandpass', f: 500, q: 1.2, gain: 0.22, attack: 0.08, length: 1, sweep: 260 });
}
// steel on steel
export function clash() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  hiss(ac, out, t, { type: 'highpass', f: 3500, gain: 0.25, attack: 0.001, length: 0.2 });
  tone(ac, out, t, { type: 'triangle', f: 1480, to: 1320, gain: 0.06, attack: 0.002, length: 0.9 });
  tone(ac, out, t, { type: 'triangle', f: 2210, gain: 0.03, attack: 0.002, length: 0.6 });
}
// "Hey! Over here!"
export function shout() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  for (let i = 0; i < 3; i++) {
    tone(ac, out, t + i * 0.32, { type: 'triangle', f: 420 + i * 30, to: 360, gain: 0.06, attack: 0.02, length: 0.25 });
    hiss(ac, out, t + i * 0.32, { type: 'bandpass', f: 1400, q: 3, gain: 0.05, attack: 0.02, length: 0.25 });
  }
}
// the horn of Gondor, long and wavering, three times
export function horn() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.05;
  for (let i = 0; i < 3; i++) {
    tone(ac, out, t + i * 2.2, { type: 'sawtooth', f: 147, to: 139, gain: 0.07, attack: 0.25, length: 1.8 });
    tone(ac, out, t + i * 2.2, { type: 'triangle', f: 294, to: 278, gain: 0.04, attack: 0.25, length: 1.8 });
  }
}
// Sam in the water: k how big a splash
export function splash(k = 1) {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  hiss(ac, out, t, { type: 'bandpass', f: 900, q: 0.7, gain: 0.25 * k, attack: 0.01, length: 0.6, sweep: 300 });
  hiss(ac, out, t + 0.05, { type: 'highpass', f: 3000, gain: 0.08 * k, attack: 0.02, length: 0.8 });
}
