// The Citadel's sounds, synthesised so nothing is downloaded: the
// concourse's hum (a low drone, air handling, the murmur of a lot of Ricks
// and the PA's chime now and then), the portal, the line's clunk and the
// knife, Simple Rick's jingle, the Council's gavel, the alarm, the
// hangar's doors and the cruiser going. All through the site's master
// volume.

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

// The PA's two notes, before an announcement
export function chime() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  tone(ac, out, t, { type: 'sine', f: 784, gain: 0.12, attack: 0.01, length: 0.9 });
  tone(ac, out, t + 0.42, { type: 'sine', f: 587, gain: 0.12, attack: 0.01, length: 1.2 });
}
// a portal opening: a whoosh and a rising wobble
export function portal() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  hiss(ac, out, t, { type: 'bandpass', f: 300, q: 0.8, gain: 0.3, attack: 0.08, length: 0.9, sweep: 2400 });
  tone(ac, out, t, { type: 'sawtooth', f: 90, to: 420, gain: 0.06, attack: 0.05, length: 0.7 });
}
// the dispenser laying a layer
export function clunk() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  tone(ac, out, t, { type: 'square', f: 140, to: 70, gain: 0.08, attack: 0.002, length: 0.12 });
  hiss(ac, out, t, { type: 'lowpass', f: 900, gain: 0.2, attack: 0.002, length: 0.08 });
}
// the knife taking off what hangs over
export function cut() {
  const [ac, out] = ready();
  if (!ac) return;
  hiss(ac, out, ac.currentTime + 0.02, { type: 'highpass', f: 3000, gain: 0.18, attack: 0.002, length: 0.12, sweep: 6000 });
}
// a wafer spoilt, into the bin
export function spoil() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  tone(ac, out, t, { type: 'triangle', f: 330, to: 110, gain: 0.12, attack: 0.005, length: 0.35 });
  hiss(ac, out, t + 0.25, { type: 'lowpass', f: 600, gain: 0.2, attack: 0.002, length: 0.2 });
}
// Simple Rick's jingle, on a music box
export function jingle() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(ac, out, t + i * 0.18, { type: 'sine', f, gain: 0.1, attack: 0.004, length: 0.6 }));
}
// a happy little blip (a Morty in, a voter heard)
export function blip() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  tone(ac, out, t, { type: 'triangle', f: 660, to: 990, gain: 0.08, attack: 0.004, length: 0.14 });
}
// the Council's gavel
export function gavel() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  for (let i = 0; i < 2; i++) {
    tone(ac, out, t + i * 0.22, { type: 'sine', f: 180, to: 90, gain: 0.4, attack: 0.002, length: 0.14 });
    hiss(ac, out, t + i * 0.22, { type: 'bandpass', f: 1800, q: 2, gain: 0.18, attack: 0.002, length: 0.05 });
  }
}
// the hangar's blast doors, sliding
export function doors() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  hiss(ac, out, t, { type: 'bandpass', f: 2200, q: 1.5, gain: 0.2, attack: 0.01, length: 0.4, sweep: 900 });
  tone(ac, out, t + 0.1, { type: 'sawtooth', f: 60, to: 48, gain: 0.08, attack: 0.2, length: 1.4 });
}
// the cruiser, up and away
export function liftoff() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  tone(ac, out, t, { type: 'sawtooth', f: 70, to: 260, gain: 0.08, attack: 0.3, length: 3 });
  hiss(ac, out, t + 0.6, { type: 'bandpass', f: 400, q: 0.6, gain: 0.3, attack: 0.5, length: 2.6, sweep: 3200 });
}

// The red alert: the siren's two notes, round and round. { stop }.
export function alarm() {
  const [ac, out] = ready();
  if (!ac) return { stop() {} };
  return siren(ac, out);
}
// (the siren itself, into any context: tried out offline)
export function siren(ac, out) {
  const g = ac.createGain();
  g.gain.value = 0.0001;
  g.gain.setTargetAtTime(0.045, ac.currentTime, 0.4);
  g.connect(out);
  const o = ac.createOscillator();
  o.type = 'square';
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1400;
  o.connect(lp).connect(g);
  // its two notes, 740 and 560 Hz, 0.55 s each, for as long as it goes:
  // a slow square wave swinging the pitch either side of the middle
  o.frequency.value = 650;
  const swing = ac.createOscillator();
  swing.type = 'square';
  swing.frequency.value = 1 / 1.1;
  const depth = ac.createGain();
  depth.gain.value = 90 / 0.845; // (a built-in square's flats sit at 0.845: its ripple's peaks are 1)
  swing.connect(depth).connect(o.frequency);
  o.start();
  swing.start();
  return {
    stop() {
      g.gain.setTargetAtTime(0.0001, ac.currentTime, 0.2);
      o.stop(ac.currentTime + 0.8);
      swing.stop(ac.currentTime + 0.8);
    },
  };
}

// The concourse: a low drone, the air handling, the murmur of a crowd and
// the PA now and then. inside(k) muffles it (a room off the concourse);
// level(k) turns it down. { inside, level, stop }.
export function hum() {
  const [ac, out] = ready();
  if (!ac) return { inside() {}, level() {}, stop() {} };
  const master = ac.createGain();
  master.gain.value = 0.0001;
  master.gain.setTargetAtTime(0.4, ac.currentTime, 1.2);
  master.connect(out);
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 3200;
  lp.connect(master);
  const drones = [55, 82.4, 110.3].map((f, i) => {
    const o = ac.createOscillator();
    o.type = i ? 'sine' : 'triangle';
    o.frequency.value = f;
    const g = ac.createGain();
    g.gain.value = [0.07, 0.04, 0.025][i];
    o.connect(g).connect(lp);
    o.start();
    return o;
  });
  const air = ac.createBufferSource();
  air.buffer = noise(ac);
  air.loop = true;
  const airF = ac.createBiquadFilter();
  airF.type = 'bandpass';
  airF.frequency.value = 600;
  airF.Q.value = 0.4;
  const airG = ac.createGain();
  airG.gain.value = 0.05;
  air.connect(airF).connect(airG).connect(lp);
  air.start();
  let on = true;
  let indoors = 0;
  const tick = () => {
    if (!on) return;
    const t = ac.currentTime + 0.05;
    // the murmur of the crowd
    hiss(ac, lp, t, { type: 'bandpass', f: 380 + Math.random() * 300, q: 3, gain: 0.04 + Math.random() * 0.03, attack: 0.3, length: 1.6 });
    if (!indoors && Math.random() < 0.06) chime();
    timer = setTimeout(tick, 700 + Math.random() * 1400);
  };
  let timer = setTimeout(tick, 600);
  return {
    inside(k) {
      indoors = k;
      lp.frequency.setTargetAtTime(k > 0.5 ? 600 : 3200, ac.currentTime, 0.3);
    },
    level(k) {
      master.gain.setTargetAtTime(0.4 * k + 0.0001, ac.currentTime, 1);
    },
    stop() {
      on = false;
      clearTimeout(timer);
      master.gain.setTargetAtTime(0.0001, ac.currentTime, 0.3);
      for (const o of drones) o.stop(ac.currentTime + 1);
      air.stop(ac.currentTime + 1);
    },
  };
}
