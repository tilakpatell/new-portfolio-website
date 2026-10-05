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
//
// Between the notes played on the neck, the right hand strikes the chikari by
// itself (the auto chikari, unless it's switched off): on the tabla's beat
// while a theka plays, else in the player's own pulse or at a speed they set,
// filling the rests and never crowding a note. Held down, the chikari rolls on
// at that speed. When it strikes is decided in sitarRules.js.

import { audioContext, prefetch } from '../../lib/audio';
import { decode, mix } from './room';
import { getTuning, isRaga, onTuning, ragaOf, sa } from './tuning';
import { SITAR_VARIANTS } from './sitarSamples';
import { CHIKARI, chikariLevel, chikariPlan, chikariSpeed, parsePhrase, sampleFor, sitarSaFor, tarabHz } from './sitarRules';
import { jawariString } from './strings';
import { thekaGrid } from './tabla';

export const LISTEN_URL = '/audio/sitar-listen.mp3';
export const sitarSa = () => sitarSaFor(sa());

// ── Loading ────────────────────────────────────────────────────────────────
const loading = new Map(); // variant -> Promise<AudioBuffer>
const buffers = new Map(); // variant -> AudioBuffer, once decoded
const failed = new Set(); // variants that didn't load the last time they were tried

function loadVariant(i, ac = null) {
  if (!loading.has(i)) {
    const p = prefetch(SITAR_VARIANTS[i].url)
      .then((bytes) => decode(bytes, ac))
      .then((buf) => {
        buffers.set(i, buf);
        failed.delete(i);
        return buf;
      });
    p.catch(() => {
      loading.delete(i); // try again next time
      failed.add(i);
    });
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
    return fallback(ac, freq, stroke);
  }
}

// The same without waiting, for strokes timed to the clock: null while the
// recording is still on its way (it is fetched for next time).
function bufferNow(ac, freq, stroke) {
  const pick = sampleFor(freq, stroke);
  if (buffers.has(pick.variant)) return { pick, buf: buffers.get(pick.variant) };
  if (failed.has(pick.variant)) return fallback(ac, freq, stroke);
  loadVariant(pick.variant, ac).catch(() => null);
  return null;
}

// Any recording that did load, retuned further; a modelled string if none has.
function fallback(ac, freq, stroke) {
  const loaded = buffers.entries().next().value;
  if (!loaded) return { pick: null, buf: synthBuffer(ac, freq) };
  const [i, buf] = loaded;
  const take = SITAR_VARIANTS[i].takes[stroke % 2];
  return { pick: { variant: i, take: stroke % 2, rate: freq / take[2], at: take[0], dur: take[1] }, buf };
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
// `level` sets how loud the string is apart from how hard it was struck.
function voiceAt(ac, pick, buf, freq, t, vel, dest, level = 1) {
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
  g.gain.setValueAtTime(vel * 0.62 * level, t);
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
const chikariListeners = new Set();
export const onSitarChikari = (fn) => {
  chikariListeners.add(fn);
  return () => chikariListeners.delete(fn);
};

// ── Playing ────────────────────────────────────────────────────────────────
// Pluck a note `ratio` above the sitar's Sa (2 is taar Sa). Resolves to a
// handle: bend(semitones) pulls the string across the fret (meend);
// slide(ratio) moves to another fret without a new stroke (a krintan or a
// glide along the neck); damp() lets go of it. `byHand` is for the notes a
// visitor plays on the neck: the auto chikari fills the rests around them.
export async function pluck(ratio, { when = 0, vel = 0.9, byHand = false } = {}) {
  const ac = audioContext();
  if (!ac) return null;
  const asked = ac.currentTime + when;
  const dest = out(ac);
  const freq = ratio * sitarSa();
  const st = nextStroke(asked);
  // no chikari while the note is on its way (its recording may still be loading)
  hand.coming++;
  cancelPending(ac);
  let at;
  let v;
  try {
    const { pick, buf } = await bufferFor(ac, freq, st);
    at = Math.max(asked, ac.currentTime) + 0.005;
    v = voiceAt(ac, pick, buf, freq, at, vel * (st ? 0.88 : 1), dest);
  } finally {
    hand.coming--;
  }
  stopVoice(voice, at);
  voice = v;
  told(ac, ratio, at);
  noteHeard(ac, at, ratio, byHand);
  const base = freq;
  let heldAt = freq; // where the left hand last was, as far as the chikari knows
  const move = (f) => {
    if (Math.abs(1200 * Math.log2(f / heldAt)) < 20) return;
    heldAt = f;
    leftHand(ac);
  };
  return {
    bend(semitones) {
      if (voice !== v) return;
      const f = base * 2 ** (semitones / 12);
      move(f);
      glide(v, f, ac.currentTime, 0.04);
    },
    slide(r, tau = 0.05) {
      if (voice !== v) return;
      const f = r * sitarSa();
      move(f);
      glide(v, f, ac.currentTime, tau);
    },
    damp() {
      if (voice !== v) return;
      stopVoice(v, ac.currentTime);
      voice = null;
      rest(ac);
    },
  };
}

// ── The chikari ────────────────────────────────────────────────────────────
// The two high drone strings, Sa and taar Sa, struck for rhythm. They don't
// stop the melody; struck again, they stop what they were ringing.
let chikVoices = [];
let lastHit = null; // the last stroke: when, its voices, and whether the right hand struck it by itself

// Strike them at t, if their recordings are here (null if not yet). `flip`
// swaps which string takes the Da and which the Ra. A thin string struck
// lightly is still bright, so `vel` sets the tone and the strings' own levels
// are set apart from it. Returns the stroke, so it can be taken back before
// it sounds.
function strike(ac, t, vel, flip = 0, s = sitarSa(), auto = false) {
  const hi = bufferNow(ac, 2 * s, flip);
  const lo = bufferNow(ac, s, 1 - flip);
  if (!hi || !lo) return null;
  const dest = out(ac);
  const choked = chikVoices;
  for (const v of choked) {
    v.g.gain.cancelScheduledValues(t);
    v.g.gain.setTargetAtTime(0.0001, t, 0.03);
  }
  chikVoices = [voiceAt(ac, hi.pick, hi.buf, 2 * s, t, vel, dest, 0.5), voiceAt(ac, lo.pick, lo.buf, s, t + 0.016, vel, dest, 0.3)];
  const hit = { t, voices: chikVoices, choked, cancelled: false };
  lastHit = { t, voices: chikVoices, auto };
  setTimeout(
    () => {
      if (!hit.cancelled) chikariListeners.forEach((fn) => fn(t));
    },
    Math.max(0, (t - ac.currentTime) * 1000),
  );
  return hit;
}

// The same, waiting for the recordings if it must.
async function strum(ac, at, vel, flip = 0) {
  const s = sitarSa();
  await Promise.all([bufferFor(ac, 2 * s, flip), bufferFor(ac, s, 1 - flip)]);
  return strike(ac, Math.max(at, ac.currentTime + 0.005), vel, flip, s);
}

export async function chikari({ when = 0, vel = 0.7 } = {}) {
  const ac = audioContext();
  if (!ac) return false;
  const at = ac.currentTime + when + 0.005;
  // struck by hand: the auto chikari makes room for it
  cancelPending(ac);
  firm = Math.max(firm, at);
  hand.chik = Math.max(hand.chik, at);
  await strum(ac, at, vel);
  return true;
}

export function damp() {
  const ac = audioContext();
  if (ac) {
    stopVoice(voice, ac.currentTime);
    rest(ac);
  }
  voice = null;
}

// Play a raga's phrase, or `text` in it (its aroha and avaroha, say), with its
// notes where the raga puts them. Resolves to its length in seconds (0 if no
// sound). The phrase strikes its own chikari, so the auto chikari keeps out
// of it.
export async function playPhrase(ragaId = getTuning().raga, { text } = {}) {
  const ac = audioContext();
  if (!ac || !isRaga(ragaId)) return 0;
  rest(ac);
  hand.quiet = Infinity;
  try {
    const raga = ragaOf(ragaId);
    const { events, seconds } = parsePhrase(typeof text === 'string' && text.trim() ? text : raga.phrase, raga.beat, raga.tune);
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
      else if (e.kind === 'chikari') strike(ac, at, 0.6, 0, s);
    }
    voice = cur;
    lastStroke = t0 + seconds;
    hand.quiet = t0 + seconds;
    return seconds;
  } finally {
    if (hand.quiet === Infinity) hand.quiet = ac.currentTime;
  }
}

// ── Auto chikari ───────────────────────────────────────────────────────────
// What the hand has done, on the audio clock, for chikariPlan: the visitor's
// recent notes, the last one's ratio, when the left hand last moved, the last
// chikari, when the chikari was taken up and held (null when it isn't), until
// when a phrase has the sitar, and how many notes are on their way.
const hand = { onsets: [], ratio: 1, moved: -Infinity, chik: -Infinity, roll: null, quiet: -Infinity, coming: 0 };
// How far ahead of the clock the chikari is decided: far enough that a busy
// page (a long render, a slow phone) doesn't leave gaps in it. Anything
// struck sooner than that takes back a chikari still to sound and the plan
// is made again from there, so a note never has one landing on top of it.
const LOOK = 0.15;
let pending = []; // auto strokes scheduled, not yet sounded, oldest first
let until = 0; // how far along the clock the plan has gone
let firm = -Infinity; // the last chikari sure to sound: struck by hand, or already sounding
let timer = 0;
let flip = 0;

export const autoChikari = () => getTuning().autoChikari !== false;
// strokes a minute, or 0 to follow the music (the player's pulse, the tabla's beat)
const speedNow = () => (getTuning().chikariFollow === false ? chikariSpeed(getTuning().chikariSpeed) : 0);

// Take back the auto strokes that haven't sounded yet, letting the strings
// they would have stopped ring on.
function cancelPending(ac) {
  const now = ac.currentTime;
  for (let i = pending.length - 1; i >= 0; i--) {
    const p = pending[i];
    if (p.t <= now) {
      firm = Math.max(firm, p.t); // already sounding
      continue;
    }
    p.cancelled = true;
    for (const v of p.voices) {
      v.g.gain.cancelScheduledValues(0);
      v.g.gain.value = 0;
      try {
        v.src.stop();
      } catch {
        /* already stopped */
      }
    }
    for (const v of p.choked) v.g.gain.cancelScheduledValues(p.t);
    if (chikVoices === p.voices) chikVoices = p.choked;
  }
  pending = [];
  // plan again from now, knowing what has changed, from the last stroke that will really sound
  hand.chik = firm;
  until = Math.min(until, now);
}

// A note struck. One the visitor played, the chikari fills around; anything
// else playing the sitar (a flourish), it steps aside for.
function noteHeard(ac, at, ratio, byHand) {
  cancelPending(ac);
  // a stroke the right hand began a moment before the note was the hand on its
  // way to the main string: it barely sounds, rather than flam with the note
  if (lastHit?.auto && at - lastHit.t >= 0 && at - lastHit.t < 0.06)
    for (const v of lastHit.voices) {
      v.g.gain.cancelScheduledValues(at);
      v.g.gain.setTargetAtTime(0.0001, at, 0.012);
    }
  if (!byHand) {
    hand.onsets = [];
    return;
  }
  hand.onsets = [...hand.onsets.filter((t) => t > at - 6), at].sort((a, b) => a - b).slice(-8);
  hand.ratio = ratio;
  wake(ac);
}

// The left hand moved the note (a krintan, a slide, a meend): no chikari on top of it.
function leftHand(ac) {
  hand.moved = ac.currentTime;
  cancelPending(ac);
}

// The string has stopped, or something else has the sitar: nothing to fill.
function rest(ac) {
  hand.onsets = [];
  cancelPending(ac);
}

function tick(ac) {
  const now = ac.currentTime;
  for (const p of pending) if (p.t <= now) firm = Math.max(firm, p.t);
  pending = pending.filter((p) => p.t > now);
  const last = hand.onsets[hand.onsets.length - 1];
  const auto = autoChikari();
  if (hand.roll === null && (!auto || last === undefined || now - last > CHIKARI.ring + 0.5)) {
    sleep();
    return;
  }
  const from = Math.max(until, now, hand.quiet);
  const to = now + LOOK;
  until = to;
  if (hand.coming > 0 || to <= from) return;
  const level = chikariLevel(getTuning().chikariLevel);
  for (const c of chikariPlan(from, to, { ...hand, grid: thekaGrid(), speed: speedNow(), auto })) {
    // a hand, not a clock: a few milliseconds either way, a little louder or softer
    const t = Math.max(now + 0.004, c.t + (Math.random() - 0.5) * 0.008);
    flip = 1 - flip;
    const hit = strike(ac, t, Math.min(1, c.vel * level * (0.94 + Math.random() * 0.12)), flip, sitarSa(), true);
    if (!hit) continue; // its recordings are still loading
    pending.push(hit);
    hand.chik = c.t;
  }
}

function wake(ac) {
  if (timer || (hand.roll === null && !autoChikari())) return;
  until = ac.currentTime;
  timer = setInterval(() => {
    try {
      tick(ac);
    } catch {
      sleep(); // the next note wakes it again
    }
  }, 25);
}

function sleep() {
  clearInterval(timer);
  timer = 0;
}

// Take up the chikari and hold it (true), striking it now and then on and on
// at its speed, in time with the tabla if it plays; let go of it (false).
// `who` is what holds it (a key, a button), so letting go of one doesn't stop
// another; it rolls until all have let go. Call it inside the press, so the
// first stroke can sound.
const holders = new Set();
export function holdChikari(on, who = 'hand') {
  if (!on) {
    holders.delete(who);
    if (!holders.size) hand.roll = null;
    return;
  }
  const ac = audioContext();
  if (!ac) return;
  holders.add(who);
  if (hand.roll !== null) return;
  chikari({ vel: Math.min(1, 0.7 * chikariLevel(getTuning().chikariLevel)) });
  hand.roll = ac.currentTime + 0.005; // when that first stroke sounds
  wake(ac);
}

// Leaving the music room, or switching the auto chikari off: no more chikari
// for the notes already played, and none held.
export function stopAutoChikari() {
  hand.onsets = [];
  hand.roll = null;
  holders.clear();
  const ac = pending.length ? audioContext() : null;
  if (ac) cancelPending(ac);
  sleep();
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
  if (!autoChikari()) {
    // the rests stop filling; a chikari being held rolls on
    hand.onsets = [];
    const ac = pending.length ? audioContext() : null;
    if (ac && hand.roll === null) cancelPending(ac);
  }
  const ac = bus && audioContext();
  if (!ac) return;
  clearTimeout(retune);
  retune = setTimeout(() => tarab(ac), 250);
});
