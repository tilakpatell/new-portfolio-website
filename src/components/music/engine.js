// The music room's instruments, all tuned to one Sa.
//
// Sitar: real strokes, pitch-shifted across the neck, with sympathetic
// strings (./sitar.js). Tanpura: a real recorded pluck, retuned to each of its
// four strings. Harmonium: free reeds, two to a key. Tabla: real strokes, the
// dayan retuned to Sa (./tabla.js).
//
// Pitches are just intonation against Sa (./tuning.js). Every function that
// makes a sound needs `audioContext()` to have run inside the visitor's click
// or key press.

import { audioContext, loadBuffer } from '../../lib/audio';
import { mix } from './room';
import { jawariString } from './strings';
import { FIRST_STRING, getTuning, sa, saHz } from './tuning';
import { stopTheka } from './tabla';
import { dayanTarget } from './tablaRules';

export * from './tuning';
export { BOLS, LAYA, TAALS, playBol, setThekaLaya, setThekaTempo, startTheka, stopTheka, thekaPlaying, tihai, warmTabla } from './tabla';
export { bolLabel } from './tablaRules';

// ── Sitar ──────────────────────────────────────────────────────────────────
export { LISTEN_URL, chikari, damp, onSitarPluck, playPhrase, pluck, sitarSa, warm, warmNeck } from './sitar';
export { parsePhrase } from './sitarRules';

// ── Tanpura ──────────────────────────────────────────────────────────────────
// The four strings, plucked in turn: the first (Pa, Ma or Ni), Sa, Sa, low Sa.
export function tanpuraStrings(t = getTuning()) {
  const s = saHz(t.sa);
  return [
    { hz: s * FIRST_STRING[t.first].ratio, gain: 0.55, label: FIRST_STRING[t.first].label },
    { hz: s, gain: 0.42, label: 'Sa' },
    { hz: s, gain: 0.42, label: 'Sa' },
    { hz: s / 2, gain: 0.7, label: 'Sa' },
  ];
}

// The real pluck: one tanpura string (A♯2, 116.35 Hz) recorded by
// luckylittleraven (CC0), retuned to each string. The modelled string below is
// only the fallback if it can't load.
const PLUCK = { url: '/audio/tanpura-pluck.mp3', hz: 116.35 };
let pluckBuf; // undefined while loading, null if it failed

const stringCache = new Map();
function stringBuffer(ac, hz) {
  const key = hz.toFixed(3);
  if (!stringCache.has(key)) {
    const data = jawariString(ac.sampleRate, hz, 7, 101 + stringCache.size * 17);
    const buf = ac.createBuffer(1, data.length, ac.sampleRate);
    buf.getChannelData(0).set(data);
    stringCache.set(key, buf);
  }
  return stringCache.get(key);
}

let drone = null;
export const tanpuraPlaying = () => Boolean(drone);

// Starts the drone. `onPluck(i)` is called as each string sounds, for the visual.
// It follows the tuning as it changes: the next pluck of each string is in tune.
export function startTanpura(onPluck) {
  const ac = audioContext();
  if (!ac || drone) return Boolean(drone);
  const level = ac.createGain();
  level.gain.setValueAtTime(0, ac.currentTime);
  level.gain.linearRampToValueAtTime(0.75, ac.currentTime + 0.6);
  level.connect(mix(ac));
  if (pluckBuf === undefined)
    loadBuffer(PLUCK.url)
      .then((buf) => (pluckBuf = buf))
      .catch(() => (pluckBuf = null));
  let at = ac.currentTime + 0.12;
  let n = 0;
  const timers = [];
  const schedule = () => {
    if (pluckBuf === undefined && at < ac.currentTime + 0.5) return; // still loading the pluck
    // keep a second of plucks queued ahead of the clock
    while (at < ac.currentTime + 1) {
      const i = n % 4;
      const str = tanpuraStrings()[i];
      const src = ac.createBufferSource();
      if (pluckBuf) {
        src.buffer = pluckBuf;
        // retuned to the string, with a hair of drift so no two plucks are identical
        src.playbackRate.value = (str.hz / PLUCK.hz) * (1 + (Math.random() - 0.5) * 0.003);
      } else src.buffer = stringBuffer(ac, str.hz);
      const g = ac.createGain();
      g.gain.value = str.gain * (pluckBuf ? 1.15 : 1) * (0.92 + Math.random() * 0.12);
      src.connect(g).connect(level);
      src.start(Math.max(at, ac.currentTime + 0.01));
      const delay = Math.max(0, (at - ac.currentTime) * 1000);
      timers.push(setTimeout(() => drone?.onPluck?.(i), delay));
      at += (i === 3 ? 1.55 : 1.05) + (Math.random() - 0.5) * 0.06;
      n++;
    }
    if (timers.length > 40) timers.splice(0, 20);
  };
  drone = { level, timers, onPluck, interval: 0 };
  schedule();
  drone.interval = setInterval(schedule, 250);
  return true;
}

export function setTanpuraListener(onPluck) {
  if (drone) drone.onPluck = onPluck;
}

export function stopTanpura() {
  if (!drone) return; // nothing playing: don't create an audio context just to stop
  const ac = audioContext();
  const { level, interval, timers } = drone;
  clearInterval(interval);
  timers.forEach(clearTimeout);
  if (ac) {
    level.gain.cancelScheduledValues(ac.currentTime);
    level.gain.setTargetAtTime(0, ac.currentTime, 0.25);
  }
  setTimeout(() => level.disconnect(), 2000);
  drone = null;
}

// ── Harmonium ──────────────────────────────────────────────────────────────
// Two reeds to a key, the second a few cents sharp so they beat gently, like a
// real harmonium's coupled reeds. The bellows breathe: a slow sway in pressure.
let reedWave = null;
let reedBus = null;
const voices = new Map();

function reeds(ac) {
  if (reedBus) return reedBus;
  // a free reed: every harmonic, falling off gently, a little brighter in the middle
  const n = 40;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let k = 1; k < n; k++) imag[k] = (1 / Math.pow(k, 0.9)) * (k >= 3 && k <= 7 ? 1.35 : 1);
  reedWave = ac.createPeriodicWave(real, imag);
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 4200;
  lp.Q.value = 0.5;
  const chamber = ac.createBiquadFilter();
  chamber.type = 'peaking';
  chamber.frequency.value = 1150;
  chamber.Q.value = 1.1;
  chamber.gain.value = 3;
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 90;
  const bellows = ac.createGain();
  bellows.gain.value = 0.5;
  const breath = ac.createOscillator();
  breath.frequency.value = 0.45;
  const depth = ac.createGain();
  depth.gain.value = 0.035;
  breath.connect(depth).connect(bellows.gain);
  breath.start();
  bellows.connect(hp).connect(chamber).connect(lp).connect(mix(ac));
  reedBus = bellows;
  return reedBus;
}

export function harmoniumOn(id, ratio, { bass = false } = {}) {
  const ac = audioContext();
  if (!ac || voices.has(id)) return;
  const busIn = reeds(ac);
  const t = ac.currentTime;
  const f = ratio * sa();
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.13, t + 0.035);
  g.connect(busIn);
  const oscs = [
    [f, 0, 1],
    [f, 4, 0.7],
    ...(bass ? [[f / 2, -2, 0.6]] : []),
  ].map(([hz, cents, level]) => {
    const o = ac.createOscillator();
    o.setPeriodicWave(reedWave);
    o.frequency.value = hz;
    o.detune.value = cents;
    const v = ac.createGain();
    v.gain.value = level;
    o.connect(v).connect(g);
    o.start(t);
    return o;
  });
  voices.set(id, { g, oscs });
}

export function harmoniumOff(id) {
  const v = voices.get(id);
  const ac = audioContext();
  if (!v || !ac) return;
  voices.delete(id);
  const t = ac.currentTime;
  v.g.gain.cancelScheduledValues(t);
  v.g.gain.setValueAtTime(v.g.gain.value, t);
  v.g.gain.linearRampToValueAtTime(0, t + 0.14);
  v.oscs.forEach((o) => o.stop(t + 0.16));
}

export const harmoniumAllOff = () => [...voices.keys()].forEach(harmoniumOff);

// The dayan's pitch for the current Sa, for the tuning readout.
export const dayanHz = () => dayanTarget(sa());

// Stop everything (leaving the page).
export function stopAll() {
  stopTanpura();
  stopTheka();
  harmoniumAllOff();
}
