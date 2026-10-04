// The sitar, from real strokes on a real sitar: two (a Da and a Ra) by
// chinpen (CC BY 3.0), pitch-shifted to every fourth semitone across the neck
// (scripts/build-sitar.py), so each note is the nearest recording retuned by
// two semitones at most. Strokes alternate Da and Ra when they come quickly,
// as the mizrab does.
//
// The main string carries one note at a time: a new stroke stops the last, as
// the plectrum does. Meend and krintan move the note without a new stroke,
// gliding its pitch the way a pulled string bends. Under the frets, eleven
// sympathetic strings (tarab) are tuned to the raga; they ring when a note
// you play matches one, by convolution with modelled jawari strings, so they
// follow the raga and the Sa.

import { audioContext, prefetch } from '../../lib/audio';
import { decode, mix } from './room';
import { getTuning, onTuning, RAGAS, sa } from './tuning';
import { SITAR_VARIANTS } from './sitarSamples';
import { parsePhrase, sampleFor, sitarSaFor, tarabHz } from './sitarRules';
import { jawariString } from './strings';

export const LISTEN_URL = '/audio/sitar-listen.mp3';
export const sitarSa = () => sitarSaFor(sa());

// ── Loading ────────────────────────────────────────────────────────────────
const loading = new Map(); // variant -> Promise<AudioBuffer>
const buffers = new Map(); // variant -> AudioBuffer, once decoded

function loadVariant(i, ac = null) {
  if (!loading.has(i)) {
    const p = prefetch(SITAR_VARIANTS[i].url)
      .then((bytes) => decode(bytes, ac))
      .then((buf) => {
        buffers.set(i, buf);
        return buf;
      });
    p.catch(() => loading.delete(i)); // try again next time
    loading.set(i, p);
  }
  return loading.get(i);
}

// The recordings for a stretch of the neck (ratios of the sitar's Sa), fetched
// and decoded ahead of the first note. Needs no click.
export function warm(lo = 0.9, hi = 2.1) {
  const s = sitarSa();
  const wanted = new Set();
  for (let r = lo; r <= hi * 1.001; r *= 2 ** (1 / 12)) wanted.add(sampleFor(r * s).variant);
  return Promise.all([...wanted].map((i) => loadVariant(i).catch(() => null)));
}
// The whole neck, from mandra Pa to taar Ga.
export const warmNeck = () => warm(0.74, 2.51);

// The buffer for a note, waiting for it if it must; a neighbour's if it can't load.
async function bufferFor(ac, freq, stroke) {
  const pick = sampleFor(freq, stroke);
  if (buffers.has(pick.variant)) return { pick, buf: buffers.get(pick.variant) };
  try {
    return { pick, buf: await loadVariant(pick.variant, ac) };
  } catch {
    // any recording that did load, retuned further
    const loaded = buffers.entries().next().value;
    if (!loaded) return { pick: null, buf: synthBuffer(ac, freq) };
    const [i, buf] = loaded;
    const take = SITAR_VARIANTS[i].takes[stroke % 2];
    return { pick: { variant: i, take: stroke % 2, rate: freq / take[2], at: take[0], dur: take[1] }, buf };
  }
}

// If no recording loads at all: a modelled string with a jawari bridge.
const synthCache = new Map();
function synthBuffer(ac, freq) {
  const key = freq.toFixed(1);
  if (!synthCache.has(key)) {
    const data = jawariString(ac.sampleRate, freq, 2.5, 7 + synthCache.size);
    const buf = ac.createBuffer(1, data.length, ac.sampleRate);
    buf.getChannelData(0).set(data);
    synthCache.set(key, buf);
  }
  return synthCache.get(key);
}

// ── The instrument's sound ─────────────────────────────────────────────────
let bus = null; // the sitar's own level, before the room
let send = null; // what the main string gives the sympathetic strings

function out(ac) {
  if (bus) return bus;
  bus = ac.createGain();
  bus.gain.value = 1;
  // the gourd: a little body low down and presence where the jawari buzzes
  const body = ac.createBiquadFilter();
  body.type = 'peaking';
  body.frequency.value = 240;
  body.Q.value = 0.9;
  body.gain.value = 2.5;
  const buzz = ac.createBiquadFilter();
  buzz.type = 'peaking';
  buzz.frequency.value = 3200;
  buzz.Q.value = 0.8;
  buzz.gain.value = 1.5;
  bus.connect(body).connect(buzz).connect(mix(ac));
  send = ac.createGain();
  send.gain.value = 1;
  bus.connect(send);
  tarab(ac);
  return bus;
}

// One stroke at time t. Returns the voice, so it can be bent, slid or stopped.
function voiceAt(ac, pick, buf, freq, t, vel, dest) {
  const src = ac.createBufferSource();
  src.buffer = buf;
  const rate = pick ? pick.rate : 1;
  src.playbackRate.setValueAtTime(rate, t);
  // a lighter stroke is darker and softer
  const tone = ac.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 3000 + 14000 * vel * vel;
  tone.Q.value = 0.4;
  const g = ac.createGain();
  g.gain.setValueAtTime(vel * 0.62, t);
  src.connect(tone).connect(g).connect(dest);
  if (pick) src.start(t, pick.at, pick.dur);
  else src.start(t);
  src.stop(t + 8);
  // the recording's own pitch, so glides can be aimed at any frequency
  return { src, g, base: freq / rate, freq };
}

let voice = null; // the note ringing on the main string
let lastStroke = -Infinity;
let stroke = 0; // 0 Da, 1 Ra

// the plectrum stops what was ringing on the main string
function stopVoice(v, at) {
  if (!v) return;
  v.g.gain.cancelScheduledValues(at);
  v.g.gain.setTargetAtTime(0.0001, at, 0.03);
  try {
    v.src.stop(at + 0.3);
  } catch {
    /* already stopped */
  }
}

function glide(v, freq, at, tau) {
  v.freq = freq;
  v.src.playbackRate.setTargetAtTime(freq / v.base, at, tau);
}

// Da when a note stands alone; Da and Ra in turn when strokes come quickly.
function nextStroke(t) {
  stroke = t - lastStroke < 0.7 ? 1 - stroke : 0;
  lastStroke = t;
  return stroke;
}

// ── Listeners, for the neck's glow ─────────────────────────────────────────
const pluckListeners = new Set();
export const onSitarPluck = (fn) => {
  pluckListeners.add(fn);
  return () => pluckListeners.delete(fn);
};
const told = (ac, ratio, at) => {
  const ms = Math.max(0, (at - ac.currentTime) * 1000);
  setTimeout(() => pluckListeners.forEach((fn) => fn(ratio)), ms);
};

// ── Playing ────────────────────────────────────────────────────────────────
// Pluck a note `ratio` above the sitar's Sa (2 is taar Sa). Resolves to a
// handle: bend(semitones) pulls the string across the fret (meend);
// slide(ratio) moves to another fret without a new stroke (a krintan or a
// glide along the neck); damp() lets go of it.
export async function pluck(ratio, { when = 0, vel = 0.9 } = {}) {
  const ac = audioContext();
  if (!ac) return null;
  const asked = ac.currentTime + when;
  const dest = out(ac);
  const freq = ratio * sitarSa();
  const st = nextStroke(asked);
  const { pick, buf } = await bufferFor(ac, freq, st);
  const at = Math.max(asked, ac.currentTime) + 0.005;
  const v = voiceAt(ac, pick, buf, freq, at, vel * (st ? 0.88 : 1), dest);
  stopVoice(voice, at);
  voice = v;
  told(ac, ratio, at);
  const base = freq;
  return {
    bend(semitones) {
      if (voice === v) glide(v, base * 2 ** (semitones / 12), ac.currentTime, 0.04);
    },
    slide(r, tau = 0.05) {
      if (voice === v) glide(v, r * sitarSa(), ac.currentTime, tau);
    },
    damp() {
      if (voice !== v) return;
      stopVoice(v, ac.currentTime);
      voice = null;
    },
  };
}

// The chikari: the two high drone strings, struck for rhythm. They don't stop
// the melody.
async function strum(ac, at, vel, dest) {
  const s = sitarSa();
  const [hi, lo] = await Promise.all([bufferFor(ac, 2 * s, 0), bufferFor(ac, s, 1)]);
  const t = Math.max(at, ac.currentTime + 0.005);
  voiceAt(ac, hi.pick, hi.buf, 2 * s, t, vel * 0.5, dest);
  voiceAt(ac, lo.pick, lo.buf, s, t + 0.016, vel * 0.3, dest);
}

export async function chikari({ when = 0, vel = 0.7 } = {}) {
  const ac = audioContext();
  if (!ac) return false;
  await strum(ac, ac.currentTime + when + 0.005, vel, out(ac));
  return true;
}

export function damp() {
  const ac = audioContext();
  if (ac) stopVoice(voice, ac.currentTime);
  voice = null;
}

// Play a raga's phrase. Resolves to its length in seconds (0 if no sound).
export async function playPhrase(ragaId = getTuning().raga) {
  const ac = audioContext();
  if (!ac || !RAGAS[ragaId]) return 0;
  const raga = RAGAS[ragaId];
  const { events, seconds } = parsePhrase(raga.phrase, raga.beat);
  const s = sitarSa();
  const dest = out(ac);
  // every recording the phrase needs, before its first note
  await Promise.all(events.filter((e) => e.kind === 'pluck').map((e, k) => bufferFor(ac, e.ratio * s, k % 2)));
  await Promise.all([bufferFor(ac, 2 * s, 0), bufferFor(ac, s, 1)]);
  const t0 = ac.currentTime + 0.06;
  let cur = voice;
  let k = 0;
  for (const e of events) {
    const at = t0 + e.t;
    if (e.kind === 'pluck') {
      const { pick, buf } = await bufferFor(ac, e.ratio * s, k % 2);
      const v = voiceAt(ac, pick, buf, e.ratio * s, at, k % 2 ? 0.8 : 0.9, dest);
      stopVoice(cur, at);
      cur = v;
      k++;
      told(ac, e.ratio, at);
    } else if (e.kind === 'glide' && cur) glide(cur, e.ratio * s, at, e.tau);
    else if (e.kind === 'chikari') strum(ac, at, 0.6, dest);
  }
  voice = cur;
  lastStroke = t0 + seconds;
  return seconds;
}

// ── The sympathetic strings ────────────────────────────────────────────────
// Each tarab string is a modelled jawari string; together they are the
// impulse response the main string's sound is convolved with, so a note sets
// ringing exactly the strings that share its pitches. Rebuilt (a string at a
// time, so the page never stalls) when the raga or Sa changes, and crossfaded.
const TARAB_LEVEL = 1.7;
const TARAB_SECONDS = 3.2;
let tarabNow = null; // { key, conv, wet }
let building = null;

const tarabKey = () => `${getTuning().raga}:${sitarSa().toFixed(2)}`;

function tarab(ac) {
  const key = tarabKey();
  if ((tarabNow && tarabNow.key === key) || (building && building.key === key)) return;
  const job = { key, cancelled: false };
  if (building) building.cancelled = true;
  building = job;
  const sr = ac.sampleRate;
  const freqs = tarabHz(getTuning().raga, sitarSa());
  const n = Math.floor(sr * TARAB_SECONDS);
  const ir = new Float32Array(n);
  let i = 0;
  const step = () => {
    if (job.cancelled) return;
    if (i < freqs.length) {
      const y = jawariString(sr, freqs[i], TARAB_SECONDS, 301 + i * 13);
      // A ringing string answers its own pitch with a gain of about its ring
      // time in samples; dividing by the response's total (its L1 norm) brings
      // that to about one, so the level below means the same for every string.
      let l1 = 0;
      for (let k = 0; k < n; k++) l1 += Math.abs(y[k]);
      // the lower strings are thicker and ring a little louder
      const g = (1.6 * (1 - i * 0.04)) / (l1 || 1);
      for (let k = 0; k < n; k++) ir[k] += y[k] * g;
      i++;
      setTimeout(step, 0);
      return;
    }
    // a soft start, so the strings bloom after the stroke rather than click with it
    const rise = Math.floor(sr * 0.012);
    for (let k = 0; k < rise; k++) ir[k] *= k / rise;
    const buf = ac.createBuffer(1, n, sr);
    buf.getChannelData(0).set(ir);
    const conv = ac.createConvolver();
    conv.normalize = false;
    conv.buffer = buf;
    const wet = ac.createGain();
    const t = ac.currentTime;
    wet.gain.setValueAtTime(0, t);
    wet.gain.linearRampToValueAtTime(TARAB_LEVEL, t + 0.4);
    send.connect(conv).connect(wet).connect(mix(ac));
    const old = tarabNow;
    if (old) {
      old.wet.gain.cancelScheduledValues(t);
      old.wet.gain.setTargetAtTime(0, t, 0.3);
      setTimeout(() => {
        try {
          send.disconnect(old.conv);
        } catch {
          /* already gone */
        }
        old.wet.disconnect();
      }, TARAB_SECONDS * 1000 + 1500);
    }
    tarabNow = { key, conv, wet };
    building = null;
  };
  step();
}

// follow the raga and the Sa, once the sitar has been played
let retune = 0;
onTuning(() => {
  const ac = bus && audioContext();
  if (!ac) return;
  clearTimeout(retune);
  retune = setTimeout(() => tarab(ac), 250);
});
