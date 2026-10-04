// Paper toss's sounds, made in the browser: the sheet crumpled in the hand,
// the throw, the plastic rim, the swish into the bin, a thud on the carpet and
// a knock on a desk. Each is short noise shaped to its material.

import { audioContext, output } from '../../lib/audio';

let noise = null;
function noiseBuf(ac) {
  if (noise) return noise;
  noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noise;
}

// a burst of filtered noise
function hiss(ac, at, { type = 'bandpass', freq = 2000, q = 0.8, gain = 0.3, attack = 0.002, len = 0.05, sweep = null } = {}) {
  const src = ac.createBufferSource();
  src.buffer = noiseBuf(ac);
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, at);
  if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, at + len);
  f.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  src.connect(f).connect(g).connect(output());
  src.start(at, Math.random() * 0.8);
  src.stop(at + len + 0.02);
}

// paper crinkling: a scatter of tiny bright crackles
function crinkle(ac, at, count, spread, gain) {
  for (let i = 0; i < count; i++) {
    const t = at + Math.random() * spread;
    hiss(ac, t, { type: 'highpass', freq: 2500 + Math.random() * 4000, q: 0.7, gain: gain * (0.4 + Math.random() * 0.6), len: 0.006 + Math.random() * 0.018 });
  }
}

function tone(ac, at, freq, len, gain, type = 'triangle') {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  o.frequency.exponentialRampToValueAtTime(freq * 0.7, at + len);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  o.connect(g).connect(output());
  o.start(at);
  o.stop(at + len + 0.02);
}

const SOUNDS = {
  // the sheet, balled up in the hand
  crumple(ac, at) {
    crinkle(ac, at, 26, 0.32, 0.22);
    hiss(ac, at, { freq: 1400, q: 0.5, gain: 0.05, len: 0.32 });
  },
  // the arm and the air
  throw(ac, at, power = 0.5) {
    hiss(ac, at, { freq: 600 + power * 900, sweep: 2600, q: 1.1, gain: 0.08 + power * 0.08, attack: 0.04, len: 0.24 });
    crinkle(ac, at, 5, 0.06, 0.1);
  },
  // the bin's plastic rim: a hollow tick
  rim(ac, at, speed = 1) {
    const g = Math.min(0.35, 0.12 + speed * 0.06);
    tone(ac, at, 880, 0.07, g, 'square');
    tone(ac, at, 1320, 0.05, g * 0.5);
    hiss(ac, at, { freq: 3000, q: 2, gain: g * 0.6, len: 0.03 });
  },
  // in: paper on paper at the bottom of the bin
  swish(ac, at) {
    hiss(ac, at, { freq: 900, q: 0.6, gain: 0.16, attack: 0.01, len: 0.18, sweep: 500 });
    crinkle(ac, at + 0.04, 10, 0.12, 0.18);
    tone(ac, at + 0.03, 140, 0.12, 0.12, 'sine');
  },
  // a soft landing on carpet
  floor(ac, at, speed = 1) {
    hiss(ac, at, { type: 'lowpass', freq: 500, q: 0.6, gain: Math.min(0.2, 0.06 + speed * 0.03), len: 0.08 });
    crinkle(ac, at, 4, 0.04, 0.08);
  },
  // the side of the bin, or a desk
  knock(ac, at) {
    tone(ac, at, 220, 0.09, 0.18, 'sine');
    hiss(ac, at, { freq: 900, q: 1.2, gain: 0.12, len: 0.05 });
  },
  // the fan coming on: a motor's whirr rising
  fan(ac, at) {
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(40, at);
    o.frequency.exponentialRampToValueAtTime(110, at + 0.8);
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 600;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.05, at + 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 1.2);
    o.connect(f).connect(g).connect(output());
    o.start(at);
    o.stop(at + 1.25);
    hiss(ac, at + 0.2, { freq: 1200, q: 0.4, gain: 0.04, attack: 0.3, len: 1.0 });
  },
};

// Play a sound (needs the audio context, which a click or key has woken).
export function playToss(name, opts) {
  const ac = audioContext();
  if (!ac || !SOUNDS[name]) return;
  const out = output();
  if (!out) return;
  SOUNDS[name](ac, ac.currentTime + 0.005, opts);
}
