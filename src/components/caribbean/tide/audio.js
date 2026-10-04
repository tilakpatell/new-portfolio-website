// Dead man's tide, heard: guns, shot hitting water and wood, the ship's bell,
// the kraken, the wash of the sea, and drums when there's a fight on. All
// synthesised, all through the site's master volume, so the sound setting
// mutes them.

import { audioContext, output } from '../../../lib/audio';

let white = null;
function noise(ac) {
  if (white) return white;
  const n = ac.sampleRate * 2;
  white = ac.createBuffer(1, n, ac.sampleRate);
  const d = white.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return white;
}

const ctx = () => {
  const ac = audioContext();
  const out = ac ? output() : null;
  return ac && out ? { ac, out, t: ac.currentTime } : null;
};

// a burst of noise through a filter that sweeps from f0 to f1
function burst({ ac, out, t }, { type = 'lowpass', f0, f1, q = 0.8, gain = 0.5, attack = 0.004, decay = 0.4, at = 0 }) {
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  src.loop = true;
  const f = ac.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t + at);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + at + decay);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t + at);
  g.gain.exponentialRampToValueAtTime(gain, t + at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + at + decay);
  src.connect(f).connect(g).connect(out);
  src.start(t + at, Math.random());
  src.stop(t + at + decay + 0.05);
}

// a tone that slides from f0 to f1 and dies away
function tone({ ac, out, t }, { type = 'sine', f0, f1 = f0, gain = 0.4, attack = 0.005, decay = 0.3, at = 0 }) {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t + at);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + at + decay);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t + at);
  g.gain.exponentialRampToValueAtTime(gain, t + at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + at + decay);
  o.connect(g).connect(out);
  o.start(t + at);
  o.stop(t + at + decay + 0.05);
}

// not more often than every `ms`: a broadside is a roll of guns, not a wall
const every = (ms, fn) => {
  let last = 0;
  return (...args) => {
    const now = performance.now();
    if (now - last < ms) return;
    last = now;
    fn(...args);
  };
};

// near is 1 beside you, 0 far off: far guns are duller and softer
export const cannon = every(38, (near = 1) => {
  const c = ctx();
  if (!c) return;
  const k = 0.25 + 0.75 * near;
  burst(c, { f0: 500 + 1900 * near, f1: 90, gain: 0.55 * k, decay: 0.38 + 0.25 * near });
  tone(c, { f0: 110, f1: 38, gain: 0.6 * k, decay: 0.32 });
});
export const splash = every(70, (near = 1) => {
  const c = ctx();
  if (c) burst(c, { type: 'bandpass', f0: 1500, f1: 420, q: 0.6, gain: 0.22 * (0.2 + 0.8 * near), attack: 0.02, decay: 0.42 });
});
export const crunch = every(50, (near = 1) => {
  const c = ctx();
  if (!c) return;
  burst(c, { type: 'bandpass', f0: 2400, f1: 500, q: 1.2, gain: 0.3 * (0.3 + 0.7 * near), decay: 0.16 });
  tone(c, { type: 'triangle', f0: 190, f1: 90, gain: 0.25 * (0.3 + 0.7 * near), decay: 0.14 });
});
export function hurt() {
  const c = ctx();
  if (!c) return;
  burst(c, { f0: 1600, f1: 120, gain: 0.6, decay: 0.45 });
  tone(c, { f0: 85, f1: 34, gain: 0.7, decay: 0.42 });
  burst(c, { type: 'bandpass', f0: 3000, f1: 700, q: 1.5, gain: 0.3, decay: 0.2, at: 0.03 });
}
export function boom(near = 1) {
  const c = ctx();
  if (!c) return;
  burst(c, { f0: 900, f1: 60, gain: 0.7 * (0.3 + 0.7 * near), decay: 0.9 });
  tone(c, { f0: 70, f1: 28, gain: 0.7 * (0.3 + 0.7 * near), decay: 0.7 });
  burst(c, { type: 'bandpass', f0: 1800, f1: 500, q: 0.5, gain: 0.2 * near, attack: 0.05, decay: 0.9, at: 0.1 });
}
export function coin() {
  const c = ctx();
  if (!c) return;
  for (const [f, at] of [[1320, 0], [1760, 0.07], [2640, 0.14]]) tone(c, { f0: f, gain: 0.14, decay: 0.35, at });
}
export function rum() {
  const c = ctx();
  if (!c) return;
  for (const [f, at] of [[392, 0], [523, 0.09], [659, 0.18]]) tone(c, { type: 'triangle', f0: f, gain: 0.16, decay: 0.3, at });
}
// the ship's bell, struck `n` times
export function bell(n = 2) {
  const c = ctx();
  if (!c) return;
  for (let i = 0; i < n; i++) {
    const at = i * 0.42;
    for (const [f, g, d] of [[660, 0.2, 1.4], [1320 * 1.02, 0.1, 1.0], [1980 * 1.01, 0.06, 0.7], [2770, 0.04, 0.4]]) tone(c, { f0: f, gain: g, decay: d, at, attack: 0.002 });
  }
}
// something very large and angry coming up
export function roar() {
  const c = ctx();
  if (!c) return;
  const { ac, out, t } = c;
  const o = ac.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(62, t);
  o.frequency.linearRampToValueAtTime(96, t + 0.5);
  o.frequency.exponentialRampToValueAtTime(34, t + 2.1);
  const wob = ac.createOscillator();
  wob.frequency.value = 13;
  const wobG = ac.createGain();
  wobG.gain.value = 9;
  wob.connect(wobG).connect(o.frequency);
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.Q.value = 6;
  f.frequency.setValueAtTime(240, t);
  f.frequency.linearRampToValueAtTime(900, t + 0.6);
  f.frequency.exponentialRampToValueAtTime(140, t + 2.1);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5, t + 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
  o.connect(f).connect(g).connect(out);
  o.start(t);
  wob.start(t);
  o.stop(t + 2.3);
  wob.stop(t + 2.3);
  burst(c, { f0: 400, f1: 80, gain: 0.3, attack: 0.2, decay: 2 });
}
export function sinking() {
  const c = ctx();
  if (!c) return;
  boom(0.8);
  burst(c, { type: 'bandpass', f0: 500, f1: 160, q: 3, gain: 0.25, attack: 0.3, decay: 2.4, at: 0.3 });
  tone(c, { type: 'triangle', f0: 150, f1: 48, gain: 0.25, decay: 1.8, at: 0.2 });
}
export function fanfare(won = true) {
  const c = ctx();
  if (!c) return;
  const notes = won ? [[294, 0], [370, 0.16], [440, 0.32], [587, 0.5], [740, 0.5]] : [[294, 0], [277, 0.28], [220, 0.56], [147, 0.9]];
  for (const [f, at] of notes) {
    tone(c, { type: 'sawtooth', f0: f, gain: 0.07, decay: 0.9, at, attack: 0.03 });
    tone(c, { type: 'triangle', f0: f / 2, gain: 0.12, decay: 0.9, at, attack: 0.03 });
  }
}

// The sea under everything, and the drums over it when the guns are out.
// set({ speed 0…1, fight 0…1, on }) every frame; stop() when the game goes.
export function soundscape() {
  const c = ctx();
  if (!c) return { set() {}, stop() {} };
  const { ac, out, t } = c;
  const master = ac.createGain();
  master.gain.value = 0;
  master.connect(out);

  // the wash: noise under a filter that breathes like waves on a hull
  const wash = ac.createBufferSource();
  wash.buffer = noise(ac);
  wash.loop = true;
  const washF = ac.createBiquadFilter();
  washF.type = 'lowpass';
  washF.frequency.value = 520;
  const washG = ac.createGain();
  washG.gain.value = 0.16;
  const swell = ac.createOscillator();
  swell.frequency.value = 0.13;
  const swellG = ac.createGain();
  swellG.gain.value = 0.07;
  swell.connect(swellG).connect(washG.gain);
  wash.connect(washF).connect(washG).connect(master);
  // the rush past the hull, by speed
  const rush = ac.createBufferSource();
  rush.buffer = noise(ac);
  rush.loop = true;
  const rushF = ac.createBiquadFilter();
  rushF.type = 'bandpass';
  rushF.frequency.value = 1400;
  rushF.Q.value = 0.5;
  const rushG = ac.createGain();
  rushG.gain.value = 0;
  rush.connect(rushF).connect(rushG).connect(master);
  // a low drone under the fight: D and A, a little out of tune with each other
  const drone = ac.createGain();
  drone.gain.value = 0;
  const droneF = ac.createBiquadFilter();
  droneF.type = 'lowpass';
  droneF.frequency.value = 420;
  drone.connect(droneF).connect(master);
  const voices = [73.42, 73.9, 110, 146.5].map((f) => {
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    const g = ac.createGain();
    g.gain.value = 0.045;
    o.connect(g).connect(drone);
    o.start(t);
    return o;
  });
  [wash, swell, rush].forEach((n) => n.start(t));

  // drums in six-eight, scheduled a little ahead of the clock
  let fight = 0;
  let next = ac.currentTime + 0.2;
  let beat = 0;
  const BEAT = 0.2;
  const LINE = [146.83, 174.61, 220, 196, 174.61, 164.81, 146.83, 220, 261.63, 233.08, 220, 174.61]; // D minor, round and round
  const drum = (at, f, gain) => {
    const o = ac.createOscillator();
    o.frequency.setValueAtTime(f, at);
    o.frequency.exponentialRampToValueAtTime(f * 0.45, at + 0.22);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
    o.connect(g).connect(master);
    o.start(at);
    o.stop(at + 0.35);
  };
  const pluck = (at, f, gain) => {
    const o = ac.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.34);
    o.connect(g).connect(master);
    o.start(at);
    o.stop(at + 0.4);
  };
  const timer = setInterval(() => {
    const now = ac.currentTime;
    if (next < now) next = now + 0.05;
    while (next < now + 0.3) {
      if (fight > 0.15) {
        const b = beat % 6;
        if (b === 0) drum(next, 82, 0.5 * fight);
        else if (b === 3) drum(next, 110, 0.36 * fight);
        else if (b === 2 || b === 5) drum(next, 150, 0.14 * fight);
        if (fight > 0.5) pluck(next, LINE[beat % LINE.length], 0.085 * fight);
      }
      beat += 1;
      next += BEAT;
    }
  }, 90);

  let alive = true;
  return {
    set({ speed = 0, fight: f = 0, on = true }) {
      if (!alive) return;
      const now = ac.currentTime;
      fight += (f - fight) * 0.03;
      rushG.gain.setTargetAtTime(0.1 * speed, now, 0.3);
      rushF.frequency.setTargetAtTime(900 + 900 * speed, now, 0.3);
      drone.gain.setTargetAtTime(fight * 0.8, now, 0.6);
      master.gain.setTargetAtTime(on ? 0.9 : 0, now, 0.25);
    },
    stop() {
      if (!alive) return;
      alive = false;
      clearInterval(timer);
      const now = ac.currentTime;
      master.gain.setTargetAtTime(0, now, 0.1);
      [wash, swell, rush, ...voices].forEach((n) => n.stop(now + 0.5));
    },
  };
}
