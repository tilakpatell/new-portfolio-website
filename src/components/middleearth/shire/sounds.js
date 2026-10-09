// The Shire's sounds, synthesised so nothing is downloaded: birdsong by day
// and crickets by night, a mushroom picked, Maggot's dogs barking, a puff of
// pipe smoke and a ring going through, rockets and their bangs, hoofbeats on
// the East Road and the Rider's sniffing and its scream, and on the side a
// silver spoon found or pocketed by Lobelia, and his footsteps. All through the
// site's master volume, so the sound setting mutes them.

import { audioContext, output } from '../../../lib/audio';

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
const ramp = (param, t, points) => {
  param.cancelScheduledValues(t);
  param.setValueAtTime(points[0][1], t + points[0][0]);
  for (let i = 1; i < points.length; i++) param.exponentialRampToValueAtTime(Math.max(points[i][1], 0.0001), t + points[i][0]);
};
// a burst of filtered noise
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
  ramp(g.gain, t, [[0, 0.0001], [attack, gain], [length, 0.0001]]);
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
  ramp(g.gain, t, [[0, 0.0001], [attack, gain], [length, 0.0001]]);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + length + 0.05);
}

export function pick() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime;
  tone(ac, out, t, { type: 'triangle', f: 880, to: 1320, gain: 0.12, length: 0.12 });
  tone(ac, out, t + 0.07, { type: 'sine', f: 1760, gain: 0.08, length: 0.2 });
}

// a silver spoon found: a bright little ting, and its ring dying away
export function spoon() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime;
  tone(ac, out, t, { type: 'sine', f: 2637, gain: 0.09, attack: 0.002, length: 0.5 });
  tone(ac, out, t, { type: 'sine', f: 3951, gain: 0.04, attack: 0.002, length: 0.3 });
  tone(ac, out, t + 0.09, { type: 'triangle', f: 1760, gain: 0.05, length: 0.35 });
}

// Lobelia pockets one: a sour little drop
export function pocketed() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime;
  tone(ac, out, t, { type: 'triangle', f: 392, to: 370, gain: 0.12, length: 0.18 });
  tone(ac, out, t + 0.16, { type: 'triangle', f: 311, to: 262, gain: 0.12, length: 0.32 });
}

export function bark() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime;
  for (const at of [0, 0.22]) {
    tone(ac, out, t + at, { type: 'sawtooth', f: 520, to: 260, gain: 0.16, attack: 0.01, length: 0.14 });
    hiss(ac, out, t + at, { f: 900, q: 2, gain: 0.25, attack: 0.008, length: 0.13, sweep: 500 });
  }
}

// a footstep: a soft brush of grass, or a crunch on the road's gravel;
// a running foot lands harder, and is louder
export function step({ run = false, road = false } = {}) {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.005;
  const gain = run ? 0.1 : 0.065;
  if (road) hiss(ac, out, t, { type: 'bandpass', f: 1500 + Math.random() * 500, q: 1.2, gain, attack: 0.003, length: 0.08 });
  else hiss(ac, out, t, { type: 'lowpass', f: 700 + Math.random() * 300, q: 0.7, gain: gain * 1.2, attack: 0.01, length: 0.12, sweep: 350 });
  tone(ac, out, t, { f: 85 + Math.random() * 15, to: 55, gain: gain * 0.6, attack: 0.004, length: 0.07 });
}

export function puff() {
  const [ac, out] = ready();
  if (!ac) return;
  hiss(ac, out, ac.currentTime, { type: 'lowpass', f: 900, q: 0.5, gain: 0.18, attack: 0.04, length: 0.45, sweep: 300 });
}

export function chime(n = 1) {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime;
  const base = [523, 659, 784][Math.min(2, n - 1)] ?? 523;
  tone(ac, out, t, { f: base, gain: 0.14, length: 0.5 });
  tone(ac, out, t + 0.1, { f: base * 1.5, gain: 0.1, length: 0.6 });
}

export function rocket() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime;
  hiss(ac, out, t, { type: 'bandpass', f: 1200, q: 4, gain: 0.1, attack: 0.05, length: 0.85, sweep: 4200 });
  tone(ac, out, t, { type: 'sine', f: 900, to: 2400, gain: 0.03, attack: 0.1, length: 0.8 });
}

export function bang(size = 1) {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime;
  hiss(ac, out, t, { type: 'lowpass', f: 900, q: 0.7, gain: 0.45 * size, attack: 0.003, length: 0.9 * size, sweep: 120 });
  tone(ac, out, t, { type: 'sine', f: 90, to: 40, gain: 0.35 * size, length: 0.5 });
  // the crackle after
  for (let i = 0; i < 10; i++) hiss(ac, out, t + 0.25 + Math.random() * 0.8, { type: 'highpass', f: 3000, q: 0.5, gain: 0.05, attack: 0.002, length: 0.03 });
}

export function cheer() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime;
  for (let i = 0; i < 14; i++) hiss(ac, out, t + Math.random() * 0.5, { type: 'bandpass', f: 600 + Math.random() * 900, q: 3, gain: 0.05, attack: 0.08, length: 1 + Math.random() * 0.6 });
}

export function door() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime;
  tone(ac, out, t, { type: 'sawtooth', f: 180, to: 140, gain: 0.04, attack: 0.1, length: 0.7 });
  hiss(ac, out, t + 0.6, { type: 'lowpass', f: 300, gain: 0.3, length: 0.25 });
}

export function sizzle() {
  const [ac, out] = ready();
  if (!ac) return;
  hiss(ac, out, ac.currentTime, { type: 'highpass', f: 2500, q: 0.6, gain: 0.12, attack: 0.05, length: 1.6 });
}

// Hoofbeats, coming on: returns { near(k), stop() }; k 0…1 is how close.
export function hooves() {
  const [ac, out] = ready();
  if (!ac) return { near() {}, stop() {} };
  const level = ac.createGain();
  level.gain.value = 0.05;
  level.connect(out);
  let k = 0.1;
  let on = true;
  let next = ac.currentTime + 0.05;
  const beat = () => {
    if (!on) return;
    while (next < ac.currentTime + 0.25) {
      // a gallop: three beats and a rest
      for (const [dt, v] of [[0, 1], [0.09, 0.7], [0.18, 0.85]]) {
        tone(ac, level, next + dt, { type: 'sine', f: 75, to: 45, gain: v * 0.9, attack: 0.004, length: 0.12 });
        hiss(ac, level, next + dt, { type: 'lowpass', f: 500, gain: v * 0.5, attack: 0.002, length: 0.06 });
      }
      next += k > 0.95 ? 0.9 : 0.5;
    }
    timer = setTimeout(beat, 80);
  };
  let timer = setTimeout(beat, 0);
  return {
    near(v) {
      k = v;
      level.gain.setTargetAtTime(0.04 + v * 0.5, ac.currentTime, 0.2);
    },
    stop() {
      on = false;
      clearTimeout(timer);
      level.gain.setTargetAtTime(0.0001, ac.currentTime, 0.3);
    },
  };
}

export function sniff() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime;
  for (let i = 0; i < 3; i++) hiss(ac, out, t + i * 0.16, { type: 'bandpass', f: 2200, q: 3, gain: 0.18, attack: 0.03, length: 0.12 });
}

export function shriek() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime;
  for (const [f, d] of [[1250, 1], [1330, 0.8], [910, 0.6]]) {
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f * 0.8, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.25);
    o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 1.6);
    const vib = ac.createOscillator();
    vib.frequency.value = 23;
    const vg = ac.createGain();
    vg.gain.value = f * 0.03;
    vib.connect(vg).connect(o.frequency);
    const g = ac.createGain();
    ramp(g.gain, t, [[0, 0.0001], [0.15, 0.09 * d], [1.7, 0.0001]]);
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 0.8;
    o.connect(bp).connect(g).connect(out);
    o.start(t);
    vib.start(t);
    o.stop(t + 1.8);
    vib.stop(t + 1.8);
  }
  hiss(ac, out, t, { type: 'highpass', f: 1500, gain: 0.2, attack: 0.1, length: 1.6 });
}

// The air: birds by day, crickets by night. Returns { night(k), stop() }.
export function ambience() {
  const [ac, out] = ready();
  if (!ac) return { night() {}, stop() {} };
  const level = ac.createGain();
  level.gain.value = 0.0001;
  level.gain.setTargetAtTime(0.5, ac.currentTime, 1);
  level.connect(out);
  let n = 0;
  let on = true;
  const tick = () => {
    if (!on) return;
    const t = ac.currentTime + 0.05;
    if (Math.random() > n) {
      // a bird: a few quick falling chirps
      const f = 2600 + Math.random() * 1800;
      const count = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < count; i++) tone(ac, level, t + i * 0.09, { type: 'sine', f: f * (1 + Math.random() * 0.1), to: f * 0.7, gain: 0.025, attack: 0.01, length: 0.07 });
    } else {
      // crickets: a pulse train high up
      for (let i = 0; i < 6; i++) tone(ac, level, t + i * 0.045, { type: 'sine', f: 4400, gain: 0.012, attack: 0.004, length: 0.03 });
    }
    timer = setTimeout(tick, (n > 0.5 ? 500 : 1200) + Math.random() * 2200);
  };
  let timer = setTimeout(tick, 600);
  return {
    night(k) {
      n = k;
    },
    stop() {
      on = false;
      clearTimeout(timer);
      level.gain.setTargetAtTime(0.0001, ac.currentTime, 0.3);
    },
  };
}
