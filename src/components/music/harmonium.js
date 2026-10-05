// The harmonium, from a real one: every key from E2 to D5 recorded at Yale's
// Euterpea Studio by donyaquick (Freesound #330410, CC0), each held note
// looping a stretch of its own sustain (scripts/build-harmonium.py), so a key
// sounds for as long as it's held, the reeds' own beating and all. A note is
// played from its nearest recorded key, retuned a few cents (the keys follow
// the room's just intonation and its Sa); past the recordings, a modelled
// reed plays it.
//
// Reeds sound in banks chosen by stops (bass, male, female: ./harmoniumRules.js),
// through the bellows: by hand, they hold only the air they're pumped with,
// and the reeds grow quieter and darker as it runs out. Space holds every
// note on, as a sustain pedal does.

import { audioContext, prefetch } from '../../lib/audio';
import { decode, mix } from './room';
import { sa } from './tuning';
import { HARMONIUM_KEYS, HARMONIUM_URL, SYNC } from './harmoniumSamples';
import { keyFor, pressure, pump, reedsFor, stepBellows } from './harmoniumRules';

// ── Loading ────────────────────────────────────────────────────────────────
let sprite = null; // Promise<{ buf, shift }>
let ready = null;

// Where the sync click really is in the decoded sprite: decoders pad an MP3's
// start differently, and the loops must start and end on the very sample.
function syncShift(buf) {
  const d = buf.getChannelData(0);
  const sr = buf.sampleRate;
  const a = Math.max(0, Math.floor((SYNC - 0.15) * sr));
  const b = Math.min(d.length, Math.ceil((SYNC + 0.15) * sr));
  let at = -1;
  let peak = 0;
  for (let i = a; i < b; i++) {
    const v = Math.abs(d[i]);
    if (v > peak) {
      peak = v;
      at = i;
    }
  }
  return peak > 0.1 ? at / sr - SYNC : 0;
}

function load(ac = null) {
  if (!sprite) {
    sprite = prefetch(HARMONIUM_URL)
      .then((bytes) => decode(bytes, ac))
      .then((buf) => {
        ready = { buf, shift: syncShift(buf) };
        return ready;
      });
    sprite.catch(() => {
      sprite = null; // try again next time
    });
  }
  return sprite;
}
// Fetch and decode the keys ahead of the first one (as the harmonium comes into view).
export const warmHarmonium = () => load().catch(() => null);
export const harmoniumReady = () => Boolean(ready);

// ── The instrument's sound ─────────────────────────────────────────────────
let bus = null; // { input, level, tone }
let reedWave = null;

function out(ac) {
  if (bus) return bus.input;
  const input = ac.createGain();
  input.gain.value = 0.9;
  // the bellows' pressure: how loud, and (with the filter) how bright
  const level = ac.createGain();
  level.gain.value = pressure(air);
  const tone = ac.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 9000;
  tone.Q.value = 0.5;
  // the box: a little warmth where its chamber resonates, nothing below the lowest reed
  const chamber = ac.createBiquadFilter();
  chamber.type = 'peaking';
  chamber.frequency.value = 1100;
  chamber.Q.value = 1;
  chamber.gain.value = 1.5;
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 60;
  input.connect(level).connect(tone).connect(chamber).connect(hp).connect(mix(ac));
  bus = { input, level, tone };
  return input;
}

// A reed modelled where no recording reaches: every harmonic, falling off
// gently, a little brighter in the middle.
function modelledReed(ac, hz, t, dest) {
  if (!reedWave) {
    const n = 40;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let k = 1; k < n; k++) imag[k] = (1 / Math.pow(k, 0.9)) * (k >= 3 && k <= 7 ? 1.35 : 1);
    reedWave = ac.createPeriodicWave(real, imag);
  }
  const o = ac.createOscillator();
  o.setPeriodicWave(reedWave);
  o.frequency.value = hz;
  const g = ac.createGain();
  g.gain.value = 0.16; // near the recordings' level
  o.connect(g).connect(dest);
  o.start(t);
  return o;
}

function recordedReed(ac, hit, t, dest) {
  const { buf, shift } = ready;
  const [, , at, ls, le] = hit.key;
  const src = ac.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.loopStart = ls + shift;
  src.loopEnd = le + shift;
  src.playbackRate.value = hit.rate;
  src.connect(dest);
  src.start(t, at + shift);
  return src;
}

// ── Playing ────────────────────────────────────────────────────────────────
const voices = new Map(); // id -> { g, sources, reeds }
// listeners for each note as it's struck (the music planet's harmonium shows them)
const noteListeners = new Set();
export const onHarmoniumNote = (fn) => {
  noteListeners.add(fn);
  return () => noteListeners.delete(fn);
};
const held = new Set(); // ids whose key is down
let sustain = false;

// Sound a note `ratio` above Sa on the chosen reed banks; vel 0 to 1 (a MIDI key's).
export function harmoniumOn(id, ratio, { banks = { male: true }, vel = 1 } = {}) {
  const ac = audioContext();
  if (!ac) return;
  held.add(id);
  if (voices.has(id)) release(ac, id); // struck again while sustained
  const dest = out(ac);
  if (!ready) load(ac).catch(() => null);
  const t = ac.currentTime + 0.003;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.55 + 0.45 * vel, t + 0.012);
  g.connect(dest);
  const reeds = reedsFor(ratio * sa(), banks);
  const sources = reeds.map((r) => {
    const level = ac.createGain();
    level.gain.value = r.level;
    level.connect(g);
    const hit = ready && keyFor(r.hz, HARMONIUM_KEYS);
    return hit ? recordedReed(ac, hit, t, level) : modelledReed(ac, r.hz, t, level);
  });
  voices.set(id, { g, sources, reeds: reeds.length });
  bellowsAwake(ac);
  noteListeners.forEach((fn) => fn(ratio));
}

function release(ac, id) {
  const v = voices.get(id);
  if (!v) return;
  voices.delete(id);
  const t = ac.currentTime;
  v.g.gain.cancelScheduledValues(t);
  v.g.gain.setValueAtTime(v.g.gain.value, t);
  // a reed stops when its air does: quickly, the room carrying the rest
  v.g.gain.setTargetAtTime(0, t, 0.035);
  for (const s of v.sources)
    try {
      s.stop(t + 0.4);
    } catch {
      /* already stopped */
    }
  setTimeout(() => v.g.disconnect(), 600);
}

export function harmoniumOff(id) {
  held.delete(id);
  const ac = audioContext();
  if (!ac || sustain) return; // the pedal holds it
  release(ac, id);
}

export function harmoniumAllOff() {
  held.clear();
  const ac = voices.size ? audioContext() : null;
  if (ac) for (const id of [...voices.keys()]) release(ac, id);
}

// The sustain pedal: while it's down, a key let go of keeps sounding.
export function setHarmoniumSustain(on) {
  sustain = Boolean(on);
  if (sustain) return;
  const ac = voices.size ? audioContext() : null;
  if (ac) for (const id of [...voices.keys()]) if (!held.has(id)) release(ac, id);
}

// ── The bellows ────────────────────────────────────────────────────────────
// 'auto' keeps them full; 'hand' gives the reeds only the air they're pumped.
let mode = 'auto';
let air = 1;
let ticking = 0;
let last = 0;
const bellowsListeners = new Set();
export const onBellows = (fn) => {
  bellowsListeners.add(fn);
  return () => bellowsListeners.delete(fn);
};
const tell = () => bellowsListeners.forEach((fn) => fn(air));

function apply(ac) {
  if (!bus) return;
  const p = mode === 'auto' ? 1 : pressure(air);
  const t = ac.currentTime;
  bus.level.gain.setTargetAtTime(p, t, 0.05);
  // less air, a darker reed
  bus.tone.frequency.setTargetAtTime(1800 + 7200 * p * p, t, 0.05);
}

function bellowsAwake(ac) {
  if (mode !== 'hand' || ticking) return;
  last = performance.now();
  ticking = setInterval(() => {
    const now = performance.now();
    const dt = Math.min(0.5, (now - last) / 1000);
    last = now;
    let reeds = 0;
    for (const v of voices.values()) reeds += v.reeds;
    air = stepBellows(air, dt, reeds);
    apply(ac);
    tell();
    if (!voices.size && air <= 0) {
      clearInterval(ticking);
      ticking = 0;
    }
  }, 50);
}

export function setBellowsMode(next) {
  mode = next === 'hand' ? 'hand' : 'auto';
  if (mode === 'auto') air = 1;
  const ac = bus ? audioContext() : null;
  if (ac) {
    apply(ac);
    bellowsAwake(ac);
  }
  tell();
}

// Pump the bellows by `amount` (the hand's travel, as a fraction of their width).
export function pumpBellows(amount) {
  if (mode !== 'hand') return air;
  air = pump(air, amount);
  const ac = audioContext();
  if (ac) {
    out(ac);
    apply(ac);
    bellowsAwake(ac);
  }
  tell();
  return air;
}
export const bellowsAir = () => air;
