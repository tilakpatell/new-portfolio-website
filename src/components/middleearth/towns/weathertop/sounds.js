// Weathertop's sounds, synthesised so nothing is downloaded: the wind over
// the hilltop (and a fire's crackle when one's near), a stamp on burning
// grass, the brand's whoosh, a sword's ring, the kingsfoil found, the
// gallop to the Ford and the river rising, and on the side the scrape of
// lichen off old stone. The Nazgûl's shriek is the Shire's
// (../../shire/sounds.js). All through the site's master volume.

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

// The hilltop: wind, gusting and moaning in the crags; fire(k) brings up a
// crackle (0 none, 1 right by it); level(k) the wind itself. { fire, level,
// stop }.
export function air() {
  const [ac, out] = ready();
  if (!ac) return { fire() {}, level() {}, stop() {} };
  const master = ac.createGain();
  master.gain.value = 0.0001;
  master.gain.setTargetAtTime(0.45, ac.currentTime, 1.5);
  master.connect(out);
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  src.loop = true;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 380;
  bp.Q.value = 0.7;
  const windGain = ac.createGain();
  windGain.gain.value = 0.16;
  src.connect(bp).connect(windGain).connect(master);
  src.start();
  let crackle = 0;
  let on = true;
  const tick = () => {
    if (!on) return;
    const t = ac.currentTime + 0.05;
    // the wind's own slow rise and fall
    bp.frequency.setTargetAtTime(260 + Math.random() * 380, t, 1.2);
    if (Math.random() < 0.22) hiss(ac, master, t, { type: 'bandpass', f: 420, q: 2.5, gain: 0.08, attack: 1.0, length: 2.8, sweep: 700 });
    if (crackle > 0.02) for (let i = 0; i < 4; i++) hiss(ac, master, t + Math.random() * 0.35, { type: 'highpass', f: 1800 + Math.random() * 2500, gain: (0.05 + Math.random() * 0.06) * crackle, attack: 0.001, length: 0.02 + Math.random() * 0.03 });
    timer = setTimeout(tick, crackle > 0.02 ? 320 + Math.random() * 300 : 1100 + Math.random() * 1500);
  };
  let timer = setTimeout(tick, 600);
  return {
    fire(k) {
      crackle = Math.max(0, Math.min(1, k));
    },
    level(k) {
      master.gain.setTargetAtTime(0.45 * k + 0.0001, ac.currentTime, 1);
    },
    stop() {
      on = false;
      clearTimeout(timer);
      master.gain.setTargetAtTime(0.0001, ac.currentTime, 0.3);
      src.stop(ac.currentTime + 1);
    },
  };
}

// a foot brought down on burning grass, and the hiss as it goes out
export function stamp(out = false) {
  const [ac, o] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  tone(ac, o, t, { type: 'sine', f: 90, to: 45, gain: 0.45, attack: 0.002, length: 0.12 });
  hiss(ac, o, t, { type: 'lowpass', f: 900, gain: 0.3, attack: 0.002, length: 0.1 });
  if (out) hiss(ac, o, t + 0.05, { type: 'highpass', f: 3000, gain: 0.12, attack: 0.02, length: 0.6 });
}
// the brand swung, and a thrust: a whoosh of flame
export function whoosh(big = false) {
  const [ac, out] = ready();
  if (!ac) return;
  hiss(ac, out, ac.currentTime + 0.01, { type: 'bandpass', f: big ? 600 : 900, q: 0.8, gain: big ? 0.35 : 0.16, attack: 0.03, length: big ? 0.45 : 0.25, sweep: big ? 200 : 400 });
}
// a Nazgûl driven back: a hiss, and steel
export function recoil() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  hiss(ac, out, t, { type: 'bandpass', f: 2600, q: 4, gain: 0.12, attack: 0.01, length: 0.5, sweep: 1200 });
  tone(ac, out, t, { type: 'triangle', f: 1760, to: 1500, gain: 0.04, attack: 0.002, length: 0.8 });
}
// a blade in the dark
export function stab() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  tone(ac, out, t, { type: 'sawtooth', f: 220, to: 55, gain: 0.18, attack: 0.005, length: 0.9 });
  hiss(ac, out, t, { type: 'highpass', f: 4000, gain: 0.2, attack: 0.002, length: 0.25 });
  tone(ac, out, t + 0.05, { type: 'sine', f: 1200, to: 300, gain: 0.08, attack: 0.01, length: 1.6 });
}
// kingsfoil, found: a little rising chime
export function found(n = 1) {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  [523, 659, 784, 1047].slice(0, 2 + Math.min(2, n)).forEach((f, i) => tone(ac, out, t + i * 0.09, { type: 'sine', f, gain: 0.1, attack: 0.01, length: 0.6 }));
}
// lichen scraped off old stone: a short dry rasp
export function scrape() {
  const [ac, out] = ready();
  if (!ac) return;
  hiss(ac, out, ac.currentTime + 0.01, { type: 'bandpass', f: 1800 + Math.random() * 900, q: 2.2, gain: 0.07, attack: 0.01, length: 0.11 });
}
// a weed pulled up
export function rustle() {
  const [ac, out] = ready();
  if (!ac) return;
  hiss(ac, out, ac.currentTime + 0.01, { type: 'bandpass', f: 3000, q: 1.2, gain: 0.1, attack: 0.02, length: 0.25 });
}
// the time's up, or Strider's come: a low horn-like swell
export function swell(good = true) {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  for (const f of good ? [196, 247, 294] : [110, 131, 156]) tone(ac, out, t, { type: 'triangle', f, gain: 0.07, attack: 0.4, length: 2.2 });
}

// The ride: Asfaloth's gallop, and wind past your ears. speed(k) is how
// hard she's going (1 at a canter, more spurred); { speed, stop }.
export function gallop() {
  const [ac, out] = ready();
  if (!ac) return { speed() {}, stop() {} };
  const level = ac.createGain();
  level.gain.value = 0.35;
  level.connect(out);
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  src.loop = true;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 600;
  const rush = ac.createGain();
  rush.gain.value = 0.06;
  src.connect(bp).connect(rush).connect(level);
  src.start();
  let k = 1;
  let on = true;
  let next = ac.currentTime + 0.05;
  const beat = () => {
    if (!on) return;
    while (next < ac.currentTime + 0.25) {
      for (const [dt, v] of [[0, 1], [0.07, 0.65], [0.14, 0.85], [0.21, 0.7]]) {
        tone(ac, level, next + dt / k, { type: 'sine', f: 82, to: 48, gain: v * 0.5, attack: 0.003, length: 0.1 });
        hiss(ac, level, next + dt / k, { type: 'lowpass', f: 600, gain: v * 0.25, attack: 0.002, length: 0.05 });
      }
      next += 0.42 / k;
    }
    timer = setTimeout(beat, 80);
  };
  let timer = setTimeout(beat, 0);
  return {
    speed(v) {
      k = Math.max(0.3, v);
      bp.frequency.setTargetAtTime(400 + v * 500, ac.currentTime, 0.2);
      rush.gain.setTargetAtTime(0.03 + v * 0.06, ac.currentTime, 0.2);
    },
    stop() {
      on = false;
      clearTimeout(timer);
      level.gain.setTargetAtTime(0.0001, ac.currentTime, 0.3);
      src.stop(ac.currentTime + 1);
    },
  };
}
// a branch, a stumble
export function crash() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  hiss(ac, out, t, { type: 'lowpass', f: 1600, gain: 0.4, attack: 0.002, length: 0.35, sweep: 300 });
  tone(ac, out, t, { type: 'sine', f: 70, to: 40, gain: 0.4, attack: 0.002, length: 0.25 });
}
// the river rising: a roar that grows, and breaks
export function flood() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  hiss(ac, out, t, { type: 'lowpass', f: 300, q: 0.5, gain: 0.6, attack: 2.2, length: 6.5, sweep: 1800 });
  hiss(ac, out, t + 1.5, { type: 'bandpass', f: 900, q: 0.4, gain: 0.35, attack: 1.5, length: 5, sweep: 2400 });
  for (let i = 0; i < 4; i++) hiss(ac, out, t + 2 + i * 0.6, { type: 'highpass', f: 2500, gain: 0.12, attack: 0.3, length: 1.4 });
}
