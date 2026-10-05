// Rivendell's sounds, synthesised so nothing is downloaded: the falls and
// the river, birds, a harp now and then from the house, a door, a chime as
// each of the Fellowship falls in, the Council's voices rising, Gimli's
// axe shattering on the Ring, Bilbo's snarl, the shards' clink, and
// Boromir's horn at the gate. All through the site's master volume.

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
// a plucked string: a quick bright attack and a long decay
const pluck = (ac, out, t, f, gain = 0.06) => {
  tone(ac, out, t, { type: 'triangle', f, gain, attack: 0.004, length: 1.8 });
  tone(ac, out, t, { type: 'sine', f: f * 2, gain: gain * 0.4, attack: 0.003, length: 0.9 });
};
// D dorian, for the harp
const HARP = [293.7, 329.6, 349.2, 392, 440, 493.9, 523.3, 587.3, 659.3];

// The valley: the falls and the river (a steady roar, low), birds, and a
// harp's phrase now and then; inside(k) hushes it all to a room's quiet.
export function valley() {
  const [ac, out] = ready();
  if (!ac) return { inside() {}, stop() {} };
  const master = ac.createGain();
  master.gain.value = 0.0001;
  master.gain.setTargetAtTime(0.5, ac.currentTime, 1.4);
  master.connect(out);
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  src.loop = true;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  const roar = ac.createGain();
  roar.gain.value = 0.14;
  src.connect(lp).connect(roar).connect(master);
  src.start();
  let on = true;
  let indoors = 0;
  const tick = () => {
    if (!on) return;
    const t = ac.currentTime + 0.05;
    if (Math.random() < 0.5) {
      // a bird
      const f = 2400 + Math.random() * 1800;
      for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) tone(ac, master, t + i * 0.11, { type: 'sine', f, to: f * (1.1 + Math.random() * 0.3), gain: 0.02 * (1 - indoors), attack: 0.01, length: 0.08 });
    }
    if (Math.random() < 0.12) {
      // the harp, from the house
      let n = Math.floor(Math.random() * 4);
      for (let i = 0; i < 6; i++) {
        n = Math.max(0, Math.min(HARP.length - 1, n + Math.floor(Math.random() * 4) - 1));
        pluck(ac, master, t + i * 0.32, HARP[n], 0.05);
      }
    }
    timer = setTimeout(tick, 1400 + Math.random() * 2200);
  };
  let timer = setTimeout(tick, 900);
  return {
    inside(k) {
      indoors = k;
      lp.frequency.setTargetAtTime(k > 0.5 ? 300 : 900, ac.currentTime, 0.4);
      roar.gain.setTargetAtTime(k > 0.5 ? 0.05 : 0.14, ac.currentTime, 0.4);
    },
    stop() {
      on = false;
      clearTimeout(timer);
      master.gain.setTargetAtTime(0.0001, ac.currentTime, 0.3);
      src.stop(ac.currentTime + 1);
    },
  };
}

export function door() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  hiss(ac, out, t, { type: 'bandpass', f: 500, q: 1.5, gain: 0.2, attack: 0.05, length: 0.6, sweep: 300 });
  tone(ac, out, t + 0.5, { type: 'sine', f: 110, to: 70, gain: 0.25, attack: 0.003, length: 0.18 });
}
// one more of the Fellowship: a rising chime, higher with each
export function chime(n = 1) {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  pluck(ac, out, t, HARP[Math.min(HARP.length - 1, n - 1)], 0.09);
  pluck(ac, out, t + 0.12, HARP[Math.min(HARP.length - 1, n + 1)], 0.07);
}
// the Council's voices, rising with the argument (k 0..1)
export function voices(k = 0.5) {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  for (let i = 0; i < 3 + Math.round(k * 5); i++) {
    const f = 110 + Math.random() * 140;
    tone(ac, out, t + Math.random() * 0.8, { type: 'sawtooth', f, to: f * (0.85 + Math.random() * 0.3), gain: 0.012 + k * 0.02, attack: 0.05, length: 0.35 + Math.random() * 0.4 });
    hiss(ac, out, t + Math.random() * 0.8, { type: 'bandpass', f: 600 + Math.random() * 900, q: 3, gain: 0.03 + k * 0.04, attack: 0.04, length: 0.3 });
  }
}
// and silence, all at once
export function hush() {
  const [ac, out] = ready();
  if (!ac) return;
  tone(ac, out, ac.currentTime + 0.05, { type: 'sine', f: 196, gain: 0.05, attack: 0.6, length: 3 });
}
// Gimli's axe on the Ring: a ringing blow, and the blade in pieces
export function shatter() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.5;
  tone(ac, out, t, { type: 'square', f: 1400, to: 900, gain: 0.08, attack: 0.001, length: 0.5 });
  tone(ac, out, t, { type: 'sine', f: 2637, gain: 0.1, attack: 0.001, length: 1.6 });
  hiss(ac, out, t, { type: 'highpass', f: 3000, gain: 0.35, attack: 0.001, length: 0.4 });
  for (let i = 0; i < 6; i++) tone(ac, out, t + 0.15 + i * 0.07 + Math.random() * 0.05, { type: 'triangle', f: 1800 + Math.random() * 1600, gain: 0.04, attack: 0.001, length: 0.12 });
}
// Bilbo, changed
export function snarl() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  tone(ac, out, t, { type: 'sawtooth', f: 160, to: 90, gain: 0.08, attack: 0.02, length: 0.6 });
  hiss(ac, out, t, { type: 'bandpass', f: 900, q: 2, gain: 0.25, attack: 0.02, length: 0.5, sweep: 400 });
}
// a breath let out
export function gasp() {
  const [ac, out] = ready();
  if (!ac) return;
  hiss(ac, out, ac.currentTime + 0.02, { type: 'bandpass', f: 1500, q: 1, gain: 0.15, attack: 0.05, length: 0.7, sweep: 700 });
}
// a shard set down; and the sword whole again
export function clink(whole = false) {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  tone(ac, out, t, { type: 'triangle', f: 2100 + Math.random() * 300, gain: 0.06, attack: 0.001, length: 0.4 });
  if (whole) [392, 493.9, 587.3, 784].forEach((f, i) => pluck(ac, out, t + 0.1 + i * 0.12, f, 0.08));
}
// the Horn of Gondor
export function horn() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.05;
  for (const [f, g] of [[146.8, 0.12], [293.7, 0.06], [440, 0.03]]) tone(ac, out, t, { type: 'sawtooth', f, to: f * 0.98, gain: g, attack: 0.25, length: 2.8 });
}
