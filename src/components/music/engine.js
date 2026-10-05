// The music room's instruments, all tuned to one Sa.
//
// Sitar: real strokes, pitch-shifted across the neck, with sympathetic
// strings and a chikari that fills the rests by itself (./sitar.js). Tanpura:
// a real recorded pluck, retuned to each of its four strings. Harmonium: a
// real one's keys, looped while held, on bass, male and female reeds
// (./harmonium.js). Tabla: real strokes, the dayan retuned to Sa (./tabla.js).
//
// Pitches are just intonation against Sa (./tuning.js). Every function that
// makes a sound needs `audioContext()` to have run inside the visitor's click
// or key press.

import { audioContext, loadBuffer } from '../../lib/audio';
import { mix } from './room';
import { jawariString } from './strings';
import { FIRST_STRING, getTuning, sa, saHz } from './tuning';
import { stopTheka } from './tabla';
import { stopAutoChikari } from './sitar';
import { harmoniumAllOff } from './harmonium';
import { dayanTarget } from './tablaRules';

export * from './tuning';
export { BOLS, LAYA, TAALS, playBol, setThekaLaya, setThekaTempo, startTheka, stopTheka, thekaGrid, thekaPlaying, tihai, warmTabla } from './tabla';
export { bolLabel } from './tablaRules';

// ── Sitar ──────────────────────────────────────────────────────────────────
export { LISTEN_URL, autoChikari, chikari, damp, holdChikari, onSitarChikari, onSitarPluck, playPhrase, pluck, sitarSa, stopAutoChikari, warm, warmNeck } from './sitar';
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
// A real harmonium's keys, looped as they're held, on its reed banks and
// through its bellows (./harmonium.js).
export { bellowsAir, harmoniumOff, harmoniumOn, harmoniumReady, onBellows, pumpBellows, setBellowsMode, setHarmoniumSustain, warmHarmonium } from './harmonium';
export { harmoniumAllOff };

// The dayan's pitch for the current Sa, for the tuning readout.
export const dayanHz = () => dayanTarget(sa());

// Stop everything (leaving the page).
export function stopAll() {
  stopTanpura();
  stopTheka();
  stopAutoChikari();
  harmoniumAllOff();
}
