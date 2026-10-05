// Orthanc, in sound, synthesised so nothing is downloaded: the hall's hum
// and the furnaces under it, the braziers, wind in the stair's slits, the
// storm on the pinnacle; the doors, the stone waking, the Eye turning, the
// wizards' staves, the moth's wings, thunder, and the Windlord's cry. All
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

// The air of each place: place('hall' | 'stair' | 'top' | 'vision').
// { place, stop }.
export function air() {
  const [ac, out] = ready();
  if (!ac) return { place() {}, stop() {} };
  const master = ac.createGain();
  master.gain.value = 0.0001;
  master.gain.setTargetAtTime(0.42, ac.currentTime, 1.5);
  master.connect(out);
  // wind: noise through a band that wanders
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  src.loop = true;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 400;
  bp.Q.value = 1.2;
  const wind = ac.createGain();
  wind.gain.value = 0.0001;
  src.connect(bp).connect(wind).connect(master);
  // rain: high, steady
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 3200;
  const rain = ac.createGain();
  rain.gain.value = 0.0001;
  src.connect(hp).connect(rain).connect(master);
  src.start();
  // the tower's hum: the furnaces far below
  const hum = ac.createOscillator();
  hum.type = 'sawtooth';
  hum.frequency.value = 36;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 120;
  const humGain = ac.createGain();
  humGain.gain.value = 0.0001;
  hum.connect(lp).connect(humGain).connect(master);
  hum.start();
  let where = 'hall';
  let on = true;
  const tick = () => {
    if (!on) return;
    const t = ac.currentTime + 0.05;
    if (where === 'hall') {
      // the braziers crackle; far under the floor, a hammer
      for (let i = 0; i < 3; i++) hiss(ac, master, t + Math.random() * 0.5, { type: 'highpass', f: 2500 + Math.random() * 2000, gain: 0.015, attack: 0.001, length: 0.03 });
      if (Math.random() < 0.3) tone(ac, master, t + 0.3, { type: 'triangle', f: 90, to: 70, gain: 0.03, attack: 0.002, length: 0.25 });
    } else if (where === 'stair') bp.frequency.setTargetAtTime(500 + Math.random() * 900, t, 0.8);
    else if (where === 'top') bp.frequency.setTargetAtTime(250 + Math.random() * 500, t, 1.2);
    timer = setTimeout(tick, 700 + Math.random() * 1400);
  };
  let timer = setTimeout(tick, 500);
  return {
    place(z) {
      where = z;
      const now = ac.currentTime;
      wind.gain.setTargetAtTime(z === 'top' ? 0.16 : z === 'stair' ? 0.06 : z === 'vision' ? 0.04 : 0.008, now, 1);
      rain.gain.setTargetAtTime(z === 'top' ? 0.05 : 0.0001, now, 1);
      humGain.gain.setTargetAtTime(z === 'hall' ? 0.05 : z === 'vision' ? 0.08 : z === 'stair' ? 0.02 : 0.0001, now, 1);
    },
    stop() {
      on = false;
      clearTimeout(timer);
      master.gain.setTargetAtTime(0.0001, ac.currentTime, 0.3);
      src.stop(ac.currentTime + 1);
      hum.stop(ac.currentTime + 1);
    },
  };
}

// a great door, shut: a boom, and its echo round the hall
export function boom() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  tone(ac, out, t, { f: 60, to: 34, gain: 0.5, attack: 0.005, length: 1.4 });
  hiss(ac, out, t, { type: 'lowpass', f: 500, gain: 0.3, attack: 0.005, length: 0.5 });
  tone(ac, out, t + 0.35, { f: 52, to: 32, gain: 0.15, attack: 0.02, length: 1.6 });
}
// pages turning
export function pages() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  for (let i = 0; i < 3; i++) hiss(ac, out, t + i * 0.18, { type: 'bandpass', f: 3000, q: 0.7, gain: 0.08, attack: 0.03, length: 0.15, sweep: 1800 });
}
// the stone waking under your eyes: a low chord, rising
export function wake() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  [55, 82.5, 110].forEach((f, i) => tone(ac, out, t + i * 0.1, { type: 'sawtooth', f, to: f * 1.5, gain: 0.03, attack: 0.4, length: 2.4 }));
  hiss(ac, out, t, { type: 'bandpass', f: 300, q: 1, gain: 0.12, attack: 0.6, length: 2.2, sweep: 1200 });
}
// the Eye turning to search the stone: a deep throb
export function turn() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  for (let i = 0; i < 3; i++) tone(ac, out, t + i * 0.42, { f: 48, to: 40, gain: 0.35, attack: 0.02, length: 0.4 });
  hiss(ac, out, t, { type: 'bandpass', f: 220, q: 3, gain: 0.12, attack: 0.3, length: 1.6 });
}
// found: a shriek, and the light goes out
export function found() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  tone(ac, out, t, { type: 'sawtooth', f: 900, to: 300, gain: 0.08, attack: 0.02, length: 1 });
  hiss(ac, out, t, { type: 'bandpass', f: 2600, q: 3, gain: 0.25, attack: 0.02, length: 1.1, sweep: 600 });
  tone(ac, out, t, { f: 70, to: 30, gain: 0.4, attack: 0.005, length: 1.2 });
}
// Saruman's staff, raised and coming down: a gathering whine, then the blow
export function gather() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  tone(ac, out, t, { type: 'triangle', f: 300, to: 900, gain: 0.05, attack: 0.1, length: 0.7 });
  hiss(ac, out, t, { type: 'bandpass', f: 600, q: 2, gain: 0.08, attack: 0.3, length: 0.7, sweep: 2400 });
}
export function blast() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  tone(ac, out, t, { f: 110, to: 40, gain: 0.45, attack: 0.003, length: 0.5 });
  hiss(ac, out, t, { type: 'lowpass', f: 1600, gain: 0.35, attack: 0.003, length: 0.4, sweep: 300 });
}
// the blow turned: a crack, and a ring of power
export function parry() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  hiss(ac, out, t, { type: 'highpass', f: 3000, gain: 0.3, attack: 0.001, length: 0.12 });
  [660, 990].forEach((f) => tone(ac, out, t, { type: 'triangle', f, to: f * 0.96, gain: 0.06, attack: 0.002, length: 1 }));
}
// Gandalf's push: a great shove of air
export function shove() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  hiss(ac, out, t, { type: 'bandpass', f: 300, q: 0.7, gain: 0.45, attack: 0.02, length: 0.6, sweep: 90 });
  tone(ac, out, t, { f: 80, to: 46, gain: 0.35, attack: 0.01, length: 0.5 });
}
// a blow landing: thrown back against the stone
export function thud() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  tone(ac, out, t, { f: 80, to: 40, gain: 0.45, attack: 0.002, length: 0.3 });
  hiss(ac, out, t, { type: 'lowpass', f: 700, gain: 0.25, attack: 0.002, length: 0.2 });
}
// a fumble: the staff knocking the floor
export function knock() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  tone(ac, out, t, { type: 'triangle', f: 220, to: 180, gain: 0.08, attack: 0.002, length: 0.15 });
}
// the staff torn from your hand
export function taken() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  tone(ac, out, t, { type: 'sawtooth', f: 200, to: 1200, gain: 0.06, attack: 0.05, length: 0.6 });
  hiss(ac, out, t, { type: 'bandpass', f: 800, q: 2, gain: 0.2, attack: 0.05, length: 0.6, sweep: 4000 });
}
// a moth's wings by your ear
export function flutter() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  for (let i = 0; i < 8; i++) hiss(ac, out, t + i * 0.035, { type: 'bandpass', f: 900, q: 2, gain: 0.03, attack: 0.004, length: 0.03 });
}
// a gust coming
export function gust() {
  const [ac, out] = ready();
  if (!ac) return;
  hiss(ac, out, ac.currentTime + 0.01, { type: 'bandpass', f: 300, q: 0.8, gain: 0.3, attack: 0.4, length: 1.4, sweep: 900 });
}
// thunder over Isengard
export function thunder() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.3 + Math.random() * 0.6;
  hiss(ac, out, t, { type: 'lowpass', f: 300, gain: 0.5, attack: 0.02, length: 2.6, sweep: 60 });
  hiss(ac, out, t + 0.1, { type: 'lowpass', f: 900, gain: 0.25, attack: 0.005, length: 0.4 });
  tone(ac, out, t, { f: 45, to: 30, gain: 0.25, attack: 0.05, length: 2.4 });
}
// the Windlord's cry
export function cry() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  tone(ac, out, t, { type: 'sawtooth', f: 1400, to: 2100, gain: 0.04, attack: 0.03, length: 0.35 });
  tone(ac, out, t + 0.33, { type: 'sawtooth', f: 2000, to: 1100, gain: 0.04, attack: 0.02, length: 0.6 });
  hiss(ac, out, t, { type: 'bandpass', f: 2600, q: 4, gain: 0.08, attack: 0.03, length: 0.9 });
}
// a smoke ring, blown
export function puff() {
  const [ac, out] = ready();
  if (!ac) return;
  hiss(ac, out, ac.currentTime + 0.01, { type: 'lowpass', f: 600, gain: 0.12, attack: 0.08, length: 0.6 });
}
