// Bree's sounds, synthesised so nothing is downloaded: the rain and its
// gusts (muffled once you're indoors, with the fire crackling), a knock on
// the gate, its hatch and its bolts, the tap running and a pint set down,
// and the Nazgûl. All through the site's master volume.

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

// Three knocks on a heavy gate
export function knock() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  for (let i = 0; i < 3; i++) {
    tone(ac, out, t + i * 0.28, { type: 'sine', f: 110, to: 60, gain: 0.5, attack: 0.002, length: 0.16 });
    hiss(ac, out, t + i * 0.28, { type: 'lowpass', f: 700, gain: 0.25, attack: 0.002, length: 0.08 });
  }
}
// the hatch sliding
export function hatch() {
  const [ac, out] = ready();
  if (!ac) return;
  hiss(ac, out, ac.currentTime + 0.02, { type: 'bandpass', f: 900, q: 2, gain: 0.25, attack: 0.03, length: 0.35, sweep: 1500 });
}
// bolts drawn back, and the gate's long creak
export function bolts() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  for (let i = 0; i < 2; i++) {
    tone(ac, out, t + i * 0.32, { type: 'square', f: 880, to: 300, gain: 0.06, attack: 0.002, length: 0.06 });
    hiss(ac, out, t + i * 0.32, { type: 'highpass', f: 2500, gain: 0.12, attack: 0.002, length: 0.08 });
  }
  tone(ac, out, t + 0.8, { type: 'sawtooth', f: 180, to: 140, gain: 0.05, attack: 0.2, length: 1.6 });
}
// a door, and the noise of a full common room for a moment
export function door() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  tone(ac, out, t, { type: 'triangle', f: 160, to: 90, gain: 0.2, attack: 0.01, length: 0.25 });
  hiss(ac, out, t + 0.1, { type: 'bandpass', f: 500, q: 0.7, gain: 0.12, attack: 0.3, length: 1.2 });
}
// the tap running while it's held: returns stop()
export function pouring() {
  const [ac, out] = ready();
  if (!ac) return () => {};
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  src.loop = true;
  const flt = ac.createBiquadFilter();
  flt.type = 'bandpass';
  flt.frequency.value = 600;
  flt.Q.value = 3;
  const lfo = ac.createOscillator();
  lfo.frequency.value = 9;
  const depth = ac.createGain();
  depth.gain.value = 200;
  lfo.connect(depth).connect(flt.frequency);
  const g = ac.createGain();
  g.gain.value = 0.0001;
  g.gain.setTargetAtTime(0.16, ac.currentTime, 0.05);
  src.connect(flt).connect(g).connect(out);
  src.start();
  lfo.start();
  let rise = setInterval(() => (flt.frequency.value = Math.min(1400, flt.frequency.value + 30)), 100);
  return () => {
    clearInterval(rise);
    rise = null;
    g.gain.setTargetAtTime(0.0001, ac.currentTime, 0.05);
    src.stop(ac.currentTime + 0.3);
    lfo.stop(ac.currentTime + 0.3);
  };
}
// a tankard set down on the bar
export function clunk() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  tone(ac, out, t, { type: 'sine', f: 240, to: 120, gain: 0.3, attack: 0.002, length: 0.12 });
  hiss(ac, out, t, { type: 'lowpass', f: 1200, gain: 0.15, attack: 0.002, length: 0.06 });
}
// ale over the brim
export function splash() {
  const [ac, out] = ready();
  if (!ac) return;
  hiss(ac, out, ac.currentTime + 0.02, { type: 'bandpass', f: 1400, q: 0.8, gain: 0.25, attack: 0.01, length: 0.5, sweep: 500 });
}
// a cheer from the hobbits' table
export function cheer() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  for (let i = 0; i < 6; i++) tone(ac, out, t + Math.random() * 0.2, { type: 'triangle', f: 300 + Math.random() * 300, to: 500 + Math.random() * 300, gain: 0.04, attack: 0.02, length: 0.4 });
}

// The weather: rain hissing, gusting now and then, and at the door's
// worth of distance a rumble of thunder. inside(k) muffles it and lights
// the fire's crackle; level(k) lets it die away at dawn. { inside, level, stop }.
export function weather() {
  const [ac, out] = ready();
  if (!ac) return { inside() {}, level() {}, stop() {} };
  const master = ac.createGain();
  master.gain.value = 0.0001;
  master.gain.setTargetAtTime(0.5, ac.currentTime, 1.2);
  master.connect(out);
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  src.loop = true;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 5200;
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 400;
  const rainGain = ac.createGain();
  rainGain.gain.value = 0.22;
  src.connect(hp).connect(lp).connect(rainGain).connect(master);
  src.start();
  let indoors = 0;
  let on = true;
  const tick = () => {
    if (!on) return;
    const t = ac.currentTime + 0.05;
    if (indoors > 0.5) {
      // the fire, crackling
      for (let i = 0; i < 3; i++) hiss(ac, master, t + Math.random() * 0.4, { type: 'highpass', f: 2000 + Math.random() * 2000, gain: 0.05 + Math.random() * 0.05, attack: 0.001, length: 0.02 + Math.random() * 0.03 });
    } else if (Math.random() < 0.18) {
      // a gust
      hiss(ac, master, t, { type: 'bandpass', f: 500, q: 0.5, gain: 0.12, attack: 0.8, length: 2.4, sweep: 900 });
    } else if (Math.random() < 0.05) {
      // thunder, far off
      hiss(ac, master, t, { type: 'lowpass', f: 140, q: 0.7, gain: 0.5, attack: 0.3, length: 3.5, sweep: 60 });
    }
    timer = setTimeout(tick, indoors > 0.5 ? 300 + Math.random() * 500 : 1200 + Math.random() * 2000);
  };
  let timer = setTimeout(tick, 800);
  return {
    inside(k) {
      indoors = k;
      lp.frequency.setTargetAtTime(k > 0.5 ? 500 : 5200, ac.currentTime, 0.3);
      rainGain.gain.setTargetAtTime(k > 0.5 ? 0.1 : 0.22, ac.currentTime, 0.3);
    },
    level(k) {
      master.gain.setTargetAtTime(0.5 * k + 0.0001, ac.currentTime, 1.5);
    },
    stop() {
      on = false;
      clearTimeout(timer);
      master.gain.setTargetAtTime(0.0001, ac.currentTime, 0.3);
      src.stop(ac.currentTime + 1);
    },
  };
}
