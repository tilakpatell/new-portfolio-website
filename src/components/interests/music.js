// Indian classical music in the browser, tuned to Sa = D.
//
// Sitar: a real instrument. One clean note (high Sa, D4 at 294 Hz) cut from
// "Sitar clipping" by Sanath311 (CC BY-SA 3.0, Wikimedia Commons) is
// resampled to each note of Raga Yaman. Meend, the slide between notes, is a
// glide of the playback rate.
//
// Tanpura: synthesised, since no clean recording is freely licensed. Each
// string is a plucked-string model whose length shortens while it presses on
// the curved jawari bridge, which moves energy into the overtones the way the
// real bridge does (instead of clipping it away). Checked against the real
// sitar recording: the overtones bloom after the pluck rather than dying out.
//
// Listen: the full 15-second recording.

import { audioContext, loadBuffer, output, prefetch } from '../../lib/audio';

const SAMPLE_URL = '/audio/sitar-sa.mp3';
export const LISTEN_URL = '/audio/sitar-listen.mp3';
const SAMPLE_HZ = 294.0; // the recorded note: high Sa, measured at 294.0 Hz
const SA_HZ = 293.66; // D4, so the sitar is exactly in tune with the tanpura's D

// Raga Yaman in just intonation, with tivra (sharp) Ma.
export const NOTES = [
  { name: 'Sa', ratio: 1 },
  { name: 'Re', ratio: 9 / 8 },
  { name: 'Ga', ratio: 5 / 4 },
  { name: 'Ma', ratio: 45 / 32 },
  { name: 'Pa', ratio: 3 / 2 },
  { name: 'Dha', ratio: 5 / 3 },
  { name: 'Ni', ratio: 15 / 8 },
  { name: 'Sa’', ratio: 2 },
];

let bus = null; // the sitar and tanpura mix, before the site's master volume
function mix(ac) {
  if (bus) return bus;
  // a little air around the instrument: a short, dark stereo room
  const dry = ac.createGain();
  dry.gain.value = 0.9;
  const room = ac.createConvolver();
  room.buffer = roomImpulse(ac, 1.4);
  const wet = ac.createGain();
  wet.gain.value = 0.18;
  const sum = ac.createGain();
  sum.gain.value = 0.85;
  dry.connect(sum);
  dry.connect(room).connect(wet).connect(sum);
  sum.connect(output());
  bus = dry;
  return bus;
}

function roomImpulse(ac, seconds) {
  const n = Math.floor(ac.sampleRate * seconds);
  const ir = ac.createBuffer(2, n, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      lp = lp * 0.6 + (Math.random() * 2 - 1) * 0.4; // darker than white noise
      d[i] = lp * Math.pow(1 - i / n, 2.6);
    }
  }
  return ir;
}

// The decoded sitar note (needs the audio context, so only after a click).
export function prepare() {
  return loadBuffer(SAMPLE_URL).catch(() => null);
}

// Download the sitar note early (on hover) without starting audio.
export function warm() {
  return prefetch(SAMPLE_URL).catch(() => null);
}

// Play note i of the octave. `octave` 0.5 plays it an octave down. `slideFrom`
// (in semitones) starts the note bent and lets it settle: a descending meend.
// Returns a handle whose bend(semitones) pulls the string while it rings.
export async function pluck(i, { when = 0, gain = 1, octave = 1, slideFrom = 0 } = {}) {
  const ac = audioContext();
  if (!ac || !NOTES[i]) return null;
  const buf = await prepare();
  if (!buf) return null;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const rate = (NOTES[i].ratio * octave * SA_HZ) / SAMPLE_HZ;
  const at = ac.currentTime + when + 0.005;
  src.playbackRate.setValueAtTime(rate * 2 ** (slideFrom / 12), at);
  if (slideFrom) src.playbackRate.setTargetAtTime(rate, at + 0.18, 0.08);
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(g).connect(mix(ac));
  src.start(at);
  return {
    bend(semitones) {
      src.playbackRate.setTargetAtTime(rate * 2 ** (semitones / 12), ac.currentTime, 0.035);
    },
  };
}

// The chikari: two high drone strings, struck together for rhythm.
export async function chikari() {
  const ac = audioContext();
  if (!ac) return false;
  const buf = await prepare();
  if (!buf) return false;
  for (const [rate, gain, delay] of [
    [2, 0.32, 0],
    [2.006, 0.22, 0.014],
  ]) {
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = ac.createGain();
    g.gain.value = gain;
    src.connect(g).connect(mix(ac));
    src.start(ac.currentTime + delay + 0.005);
  }
  return true;
}

// A short phrase in Yaman: Ni Re Ga, Ma Dha Ni Sa', then a meend down to Pa.
export async function phrase() {
  const ac = audioContext();
  if (!ac || !(await prepare())) return 0;
  const seq = [
    [6, 0, 0.5],
    [1, 0.38, 1],
    [2, 0.74, 1],
    [3, 1.18, 1],
    [5, 1.56, 1],
    [6, 1.92, 1],
    [7, 2.3, 1],
    [6, 3.0, 1],
    [4, 3.45, 1, 2],
  ];
  for (const [n, at, octave, slideFrom = 0] of seq) pluck(n, { when: at, octave, slideFrom, gain: 0.95 });
  setTimeout(chikari, 1180);
  setTimeout(chikari, 2300);
  return 4.4;
}

// ── Tanpura ──────────────────────────────────────────────────────────────
export function jawariString(sr, freq, seconds, seed) {
  const n = Math.floor(sr * seconds);
  const y = new Float32Array(n);
  const period = sr / freq;
  const len = Math.ceil(period);
  let s = seed >>> 0 || 1;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s / 4294967296) * 2 - 1;
  };
  // the string's shape as it is released by the fingertip: a soft triangle
  const at = 0.15;
  for (let i = 0; i < len + 2; i++) {
    const u = (i % len) / len;
    y[i] = (u < at ? u / at : (1 - u) / (1 - at)) - 0.5 + 0.05 * rand();
  }
  let a0 = 0;
  for (let i = 0; i < len + 2; i++) a0 = Math.max(a0, Math.abs(y[i]));
  const loss = Math.pow(10, -3 / (10 * freq)); // T60 of ten seconds
  const m = 0.2; // how much the bridge shortens the string
  const bright = 0.05;
  let dc = 0;
  for (let i = len + 2; i < n; i++) {
    const press = Math.max(0, y[i - 1] - dc) / a0;
    const pos = i - period * (1 - m * press);
    const k = Math.floor(pos);
    if (k < 1) continue;
    const f = pos - k;
    const a = y[k] * (1 - f) + y[k + 1] * f;
    const b = y[k - 1] * (1 - f) + y[k] * f;
    const v = loss * ((1 - bright) * a + bright * b);
    dc = dc * 0.9995 + v * 0.0005;
    y[i] = v;
  }
  // remove what DC is left, normalise, and fade the tail so the buffer ends silently
  let h = 0;
  let pk = 0;
  for (let i = 0; i < n; i++) {
    h = h * 0.999 + y[i] * 0.001;
    y[i] -= h;
    pk = Math.max(pk, Math.abs(y[i]));
  }
  const fade = Math.floor(sr * 1.2);
  for (let i = 0; i < n; i++) {
    const tail = i > n - fade ? (n - i) / fade : 1;
    y[i] = (y[i] / (pk || 1)) * tail;
  }
  return y;
}

// Pa (A2), Sa, Sa (D3), low Sa (D2): the classic tuning, plucked in turn.
const TANPURA = [
  { hz: 110.0, gain: 0.55 },
  { hz: 146.83, gain: 0.42 },
  { hz: 146.83, gain: 0.42 },
  { hz: 73.42, gain: 0.7 },
];
let strings = null;
let drone = null;

function tanpuraBuffers(ac) {
  if (strings) return strings;
  strings = TANPURA.map((s, i) => {
    const data = jawariString(ac.sampleRate, s.hz, 7, 101 + i * 17);
    const buf = ac.createBuffer(1, data.length, ac.sampleRate);
    buf.getChannelData(0).set(data);
    return buf;
  });
  return strings;
}

export function tanpuraPlaying() {
  return Boolean(drone);
}

// Starts the drone. `onPluck(i)` is called as each string sounds, for the visual.
export function startTanpura(onPluck) {
  const ac = audioContext();
  if (!ac || drone) return Boolean(drone);
  const bufs = tanpuraBuffers(ac);
  const level = ac.createGain();
  level.gain.setValueAtTime(0, ac.currentTime);
  level.gain.linearRampToValueAtTime(0.75, ac.currentTime + 0.6);
  level.connect(mix(ac));
  let next = ac.currentTime + 0.08;
  let n = 0;
  const timers = [];
  const schedule = () => {
    // keep a second of plucks queued ahead of the clock
    while (next < ac.currentTime + 1) {
      const i = n % 4;
      const src = ac.createBufferSource();
      src.buffer = bufs[i];
      const g = ac.createGain();
      g.gain.value = TANPURA[i].gain * (0.92 + Math.random() * 0.12); // no two plucks quite alike
      src.connect(g).connect(level);
      src.start(next);
      const delay = Math.max(0, (next - ac.currentTime) * 1000);
      timers.push(setTimeout(() => onPluck?.(i), delay));
      next += (i === 3 ? 1.55 : 1.05) + (Math.random() - 0.5) * 0.06;
      n++;
    }
  };
  schedule();
  const interval = setInterval(schedule, 250);
  drone = { level, interval, timers };
  return true;
}

export function stopTanpura() {
  if (!drone) return; // nothing playing: don't create an audio context just to stop
  const ac = audioContext();
  if (!ac) return;
  const { level, interval, timers } = drone;
  clearInterval(interval);
  timers.forEach(clearTimeout);
  level.gain.cancelScheduledValues(ac.currentTime);
  level.gain.setTargetAtTime(0, ac.currentTime, 0.25);
  setTimeout(() => level.disconnect(), 2000);
  drone = null;
}
