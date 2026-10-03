// The music room's instruments, all tuned to one Sa.
//
// Sitar: real recorded notes, retuned to each fret. Tanpura: a real recorded
// pluck, retuned to each of its four strings. Harmonium: free reeds, two to a
// key. Tabla: each stroke built from the drum's own modes, so the dayan rings
// at Sa.
//
// Pitches are just intonation against Sa. Every function that makes a sound
// needs `audioContext()` to have run inside the visitor's click or key press.

import { audioContext, loadBuffer, output, prefetch } from '../../lib/audio';

// ── Tuning ─────────────────────────────────────────────────────────────────
// Sa can be any note from C3 to B3. The tanpura's middle strings sound it.
export const SA_NOTES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const saHz = (i) => 440 * 2 ** ((48 + i - 69) / 12);

// The tanpura's first string: Pa for most ragas, Ma where Pa is left out
// (Malkauns), Ni for ragas built around it (Marwa, Puriya). All in the lower octave.
export const FIRST_STRING = {
  Pa: { ratio: 3 / 4, label: 'Pa', note: 'mandra Pa' },
  Ma: { ratio: 2 / 3, label: 'Ma', note: 'mandra Ma' },
  Ni: { ratio: 15 / 16, label: 'Ni', note: 'mandra Ni' },
};

// Swaras in just intonation. Lowercase r g d n are komal (flat); M is tivra (sharp) Ma.
export const SWARA = { S: 1, r: 16 / 15, R: 9 / 8, g: 6 / 5, G: 5 / 4, m: 4 / 3, M: 45 / 32, P: 3 / 2, d: 8 / 5, D: 5 / 3, n: 9 / 5, N: 15 / 8 };
export const SWARA_NAME = { S: 'Sa', r: 'Re', R: 'Re', g: 'Ga', G: 'Ga', m: 'Ma', M: 'Ma', P: 'Pa', d: 'Dha', D: 'Dha', n: 'Ni', N: 'Ni' };
// komal notes are written underlined, tivra Ma with a tick
export const swaraMark = (s) => (s === 'r' || s === 'g' || s === 'd' || s === 'n' ? 'komal' : s === 'M' ? 'tivra' : null);

// A phrase is written in sargam: N. is mandra Ni, S' is taar Sa, X>Y is a meend
// from X to Y, X~ is an andolan (a slow sway on the note), - holds, | strikes the chikari.
export const RAGAS = {
  yaman: { name: 'Yaman', time: 'Evening', notes: 'SRGMPDN', first: 'Pa', phrase: "N. R G - R G M>P - | M G R - N. R S - -", beat: 0.42 },
  bhairav: { name: 'Bhairav', time: 'Dawn', notes: 'SrGmPdN', first: 'Pa', phrase: "S G m d~ - P - | G m r~ - S - -", beat: 0.45 },
  kafi: { name: 'Kafi', time: 'Night', notes: 'SRgmPDn', first: 'Pa', phrase: "S R g m P - | m g R g>R S - -", beat: 0.4 },
  bhupali: { name: 'Bhupali', time: 'Evening', notes: 'SRGPD', first: 'Pa', phrase: "S R G - P G - | D P G R S - -", beat: 0.4 },
  malkauns: { name: 'Malkauns', time: 'Late night', notes: 'Sgmdn', first: 'Ma', phrase: "n. S g m - | g m d n d m - | g m g S - -", beat: 0.42 },
  darbari: { name: 'Darbari', time: 'Late night', notes: 'SRgmPdn', first: 'Pa', phrase: "S R g~ - R S - | n. S R g~ - m P - | d~ - n P - -", beat: 0.5 },
};

// The frets for a raga: its notes from mandra Pa (or the nearest note above
// it) through the middle octave to taar Sa.
export function frets(ragaId) {
  const notes = [...RAGAS[ragaId].notes];
  const low = notes.filter((s) => SWARA[s] / 2 >= 0.74).map((s) => ({ s, oct: -1, ratio: SWARA[s] / 2 }));
  const mid = notes.map((s) => ({ s, oct: 0, ratio: SWARA[s] }));
  return [...low, ...mid, { s: 'S', oct: 1, ratio: 2 }];
}

// The tarab are tuned to the raga's notes, eleven of them from Sa up.
export function tarabRatios(ragaId) {
  const notes = [...RAGAS[ragaId].notes].map((s) => SWARA[s]);
  const out = [];
  for (let oct = 1; out.length < 11; oct *= 2) for (const r of notes) if (out.length < 11) out.push(r * oct);
  return out;
}

const KEY = 'tp-music';
const DEFAULT_TUNING = { sa: 2, first: 'Pa', raga: 'yaman' }; // Sa = D
let tuning = (() => {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) || 'null');
    if (saved && saved.sa >= 0 && saved.sa < 12 && FIRST_STRING[saved.first] && RAGAS[saved.raga]) return saved;
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_TUNING;
})();
const tuningListeners = new Set();
export const getTuning = () => tuning;
export const onTuning = (fn) => {
  tuningListeners.add(fn);
  return () => tuningListeners.delete(fn);
};
export function setTuning(next) {
  tuning = { ...tuning, ...next };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(tuning));
  } catch {
    /* storage unavailable */
  }
  tuningListeners.forEach((fn) => fn(tuning));
}
export const sa = () => saHz(tuning.sa);

// ── The shared mix: a little air around the instruments ────────────────────
let bus = null;
function mix(ac) {
  if (bus) return bus;
  const dry = ac.createGain();
  dry.gain.value = 0.9;
  const room = ac.createConvolver();
  room.buffer = roomImpulse(ac, 1.5);
  const wet = ac.createGain();
  wet.gain.value = 0.16;
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
      lp = lp * 0.6 + (Math.random() * 2 - 1) * 0.4;
      d[i] = lp * Math.pow(1 - i / n, 2.6);
    }
  }
  return ir;
}

// ── Sitar ──────────────────────────────────────────────────────────────────
// Real notes: four takes of one note (D4) on a sitar, Sanath311's (CC BY-SA 3.0)
// and three strokes by chinpen (CC BY 3.0), taken in turn so a repeated note
// never sounds quite the same, each retuned to its fret. A new note on the main
// string stops the last, as the plectrum does; meend glides the playback rate,
// the way a pulled string bends.
const TAKES = [
  { url: '/audio/sitar-sa.mp3', hz: 293.3 },
  { url: '/audio/sitar-d4-1.mp3', hz: 292.4 },
  { url: '/audio/sitar-d4-2.mp3', hz: 291.9 },
  { url: '/audio/sitar-d4-3.mp3', hz: 291.0 },
];
export const LISTEN_URL = '/audio/sitar-listen.mp3';

// The sitar plays an octave above the tanpura's Sa while that keeps it close
// to the recorded note, so the retuning stays gentle.
export const sitarSa = () => {
  const s = sa();
  return s * 2 <= 330 ? s * 2 : s;
};

let takes = null;
let next = 0;
let voice = null; // the note ringing on the main string
const pluckListeners = new Set();

// Every take decoded, in order (one shared promise, so plucks resume in the order asked).
function loadTakes() {
  if (!takes)
    takes = Promise.all(TAKES.map((t) => loadBuffer(t.url).then((buf) => ({ buf, hz: t.hz })).catch(() => null))).then((list) => {
      const ok = list.filter(Boolean);
      if (!ok.length) takes = null; // try again next time
      return ok;
    });
  return takes;
}

// Download the notes early (on hover, say) without starting audio.
export const warm = () => Promise.all(TAKES.map((t) => prefetch(t.url).catch(() => null)));

// Called with each note's ratio as it sounds, for the sympathetic strings' glow.
export const onSitarPluck = (fn) => {
  pluckListeners.add(fn);
  return () => pluckListeners.delete(fn);
};
const told = (ratio, at) => {
  const ac = audioContext();
  const ms = ac ? Math.max(0, (at - ac.currentTime) * 1000) : 0;
  setTimeout(() => pluckListeners.forEach((fn) => fn(ratio)), ms);
};

function note(ac, take, freq, at, vel, dest) {
  const src = ac.createBufferSource();
  src.buffer = take.buf;
  src.playbackRate.setValueAtTime(freq / take.hz, at);
  const g = ac.createGain();
  g.gain.setValueAtTime(vel * 0.6, at); // level with the tanpura and harmonium
  src.connect(g).connect(dest);
  src.start(at);
  return { src, g, hz: take.hz };
}

// the plectrum stops what was ringing on the main string
function stopVoice(v, at) {
  if (!v) return;
  v.g.gain.setTargetAtTime(0.0001, at, 0.03);
  v.src.stop(at + 0.25);
}

// Pluck a note `ratio` above the sitar's Sa (2 is taar Sa). Returns a handle:
// bend(semitones) pulls the string (meend); slide(ratio) moves to another fret
// without plucking again.
export async function pluck(ratio, { when = 0, vel = 0.9 } = {}) {
  const ac = audioContext();
  if (!ac) return null;
  const list = await loadTakes();
  if (!list.length) return null;
  const at = ac.currentTime + when + 0.005;
  const freq = ratio * sitarSa();
  const v = note(ac, list[next++ % list.length], freq, at, vel, mix(ac));
  stopVoice(voice, at);
  voice = v;
  told(ratio, at);
  const glide = (hz, tau) => v.src.playbackRate.setTargetAtTime(hz / v.hz, ac.currentTime, tau);
  return {
    bend(semitones) {
      glide(freq * 2 ** (semitones / 12), 0.04);
    },
    slide(r) {
      glide(r * sitarSa(), 0.05);
    },
  };
}

// The chikari: the high drone strings, struck for rhythm (they don't stop the melody).
function strum(ac, list, at, vel, dest) {
  const s = sitarSa();
  note(ac, list[next++ % list.length], 2 * s, at, vel * 0.55, dest);
  note(ac, list[next++ % list.length], s, at + 0.014, vel * 0.3, dest);
}

export async function chikari({ when = 0, vel = 0.7 } = {}) {
  const ac = audioContext();
  if (!ac) return false;
  const list = await loadTakes();
  if (!list.length) return false;
  strum(ac, list, ac.currentTime + when + 0.005, vel, mix(ac));
  return true;
}

export function damp() {
  const ac = audioContext();
  if (ac) stopVoice(voice, ac.currentTime);
  voice = null;
}

// Parse a phrase into timed events (see RAGAS for the notation).
export function parsePhrase(text, beat) {
  const events = [];
  let t = 0;
  const ratioOf = (tok) => {
    const m = /^([SrRgGmMPdDnN])([.']?)$/.exec(tok);
    if (!m) return null;
    return SWARA[m[1]] * (m[2] === '.' ? 0.5 : m[2] === "'" ? 2 : 1);
  };
  for (const tok of text.trim().split(/\s+/)) {
    if (tok === '|') events.push({ t, kind: 'chikari' });
    else if (tok === '-') t += beat;
    else if (tok.includes('>')) {
      const [a, b] = tok.split('>').map(ratioOf);
      events.push({ t, kind: 'pluck', ratio: a }, { t: t + beat * 0.45, kind: 'glide', ratio: b, tau: 0.07 });
      t += beat;
    } else if (tok.endsWith('~')) {
      const r = ratioOf(tok.slice(0, -1));
      events.push({ t, kind: 'pluck', ratio: r });
      // andolan: a slow sway a little below the note and back, twice
      for (let k = 1; k <= 4; k++) events.push({ t: t + (k * beat) / 2, kind: 'glide', ratio: k % 2 ? r * 2 ** (-30 / 1200) : r, tau: 0.12 });
      t += beat;
    } else {
      const r = ratioOf(tok);
      if (r) events.push({ t, kind: 'pluck', ratio: r });
      t += beat;
    }
  }
  return { events, seconds: t };
}

// Play a raga's phrase. Resolves to its length in seconds (0 if no sound).
export async function playPhrase(ragaId = tuning.raga) {
  const ac = audioContext();
  if (!ac) return 0;
  const raga = RAGAS[ragaId];
  const { events, seconds } = parsePhrase(raga.phrase, raga.beat);
  const list = await loadTakes();
  if (!list.length) return 0;
  const s = sitarSa();
  const t0 = ac.currentTime + 0.05;
  const dest = mix(ac);
  let cur = voice;
  for (const e of events) {
    const at = t0 + e.t;
    if (e.kind === 'pluck') {
      const v = note(ac, list[next++ % list.length], e.ratio * s, at, 0.88, dest);
      stopVoice(cur, at);
      cur = v;
      told(e.ratio, at);
    } else if (e.kind === 'glide' && cur) cur.src.playbackRate.setTargetAtTime((e.ratio * s) / cur.hz, at, e.tau);
    else if (e.kind === 'chikari') strum(ac, list, at, 0.6, dest);
  }
  voice = cur;
  return seconds;
}

// ── Tanpura ────────────────────────────────────────────────────────────────
// A plucked string whose length shortens while it presses on the curved jawari
// bridge, which moves energy into the overtones the way the real bridge does.
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

// The four strings, plucked in turn: the first (Pa, Ma or Ni), Sa, Sa, low Sa.
export function tanpuraStrings(t = tuning) {
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

// ── Tabla ──────────────────────────────────────────────────────────────────
// The dayan (right drum) is tuned to Sa: its black syahi makes its first modes
// whole-number multiples of the fundamental, so each stroke is a few sine
// modes, each with its own level and decay. The bayan (left drum) is the bass;
// Ge is its open, ringing stroke, Ke the flat, closed one.
let tablaBus = null;
let noiseBuf = null;

function tablaOut(ac) {
  if (tablaBus) return tablaBus;
  tablaBus = ac.createGain();
  tablaBus.gain.value = 0.5;
  tablaBus.connect(mix(ac));
  const n = ac.sampleRate;
  noiseBuf = ac.createBuffer(1, n, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return tablaBus;
}

// modes: [multiple of the dayan's pitch, level, decay seconds]
const DAYAN = {
  na: { modes: [[1, 0.22, 0.16], [2, 1, 0.5], [3, 0.62, 0.34], [4, 0.4, 0.24], [5, 0.26, 0.16]], click: 0.5 },
  tin: { modes: [[1, 0.42, 0.26], [2, 0.9, 0.42], [3, 0.42, 0.28], [4, 0.2, 0.18], [5, 0.12, 0.12]], click: 0.25 },
  tun: { modes: [[1, 1, 0.9], [2, 0.42, 0.45], [3, 0.22, 0.3], [4, 0.1, 0.2]], click: 0.15 },
  ti: { modes: [[1, 0.3, 0.05], [2, 0.32, 0.04], [3, 0.2, 0.03]], click: 0.9, closed: true },
  ra: { modes: [[1, 0.22, 0.04], [2, 0.24, 0.035]], click: 0.6, closed: true },
};

function stroke(ac, out, t, f, spec, vel) {
  for (const [mul, level, decay] of spec.modes) {
    const o = ac.createOscillator();
    o.frequency.value = f * mul;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level * vel * 0.32, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay * 3);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + decay * 3 + 0.02);
  }
  // the finger on the skin: a short, bright knock
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = spec.closed ? 1800 : 3200;
  bp.Q.value = 0.9;
  const g = ac.createGain();
  const len = spec.closed ? 0.045 : 0.012;
  g.gain.setValueAtTime(spec.click * vel * 0.3, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(bp).connect(g).connect(out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + len + 0.01);
}

// Ge: the bass rings, its pitch settling as the skin relaxes. `gumki` lifts it
// with the heel of the hand, the bayan's signature swoop.
function ge(ac, out, t, f, vel, gumki = false) {
  const o = ac.createOscillator();
  o.frequency.setValueAtTime(f * 1.14, t);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.07);
  if (gumki) o.frequency.exponentialRampToValueAtTime(f * 1.32, t + 0.42);
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.5 * vel, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 1.15);
  const o2 = ac.createOscillator();
  o2.frequency.setValueAtTime(f * 2.2, t);
  o2.frequency.exponentialRampToValueAtTime(f * 2, t + 0.07);
  const g2 = ac.createGain();
  g2.gain.setValueAtTime(0, t);
  g2.gain.linearRampToValueAtTime(0.14 * vel, t + 0.004);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
  o2.connect(g2).connect(out);
  o2.start(t);
  o2.stop(t + 0.45);
  thump(ac, out, t, vel * 0.5, 420, 0.06);
}

// Ke: the flat hand on the bayan, closed: a dull slap.
function ke(ac, out, t, vel) {
  thump(ac, out, t, vel, 650, 0.06);
  const o = ac.createOscillator();
  o.frequency.value = 118;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.3 * vel, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.08);
}

function thump(ac, out, t, vel, cutoff, len) {
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = cutoff;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.5 * vel, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(lp).connect(g).connect(out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + len + 0.01);
}

// The bols, as strokes on the two drums.
export const BOLS = {
  Na: ['na'],
  Ta: ['na'],
  Tin: ['tin'],
  Tu: ['tun'],
  Ti: ['ti'],
  Ra: ['ra'],
  Ge: ['ge'],
  Ke: ['ke'],
  Ki: ['ke'],
  Kat: ['ke'],
  Dha: ['na', 'ge'],
  Dhin: ['tin', 'ge'],
  Dhi: ['tin', 'ge'],
};

export const dayanHz = () => {
  const s = sa();
  return s < 185 ? s * 2 : s; // the dayan sits between about 260 and 370 Hz
};
const bayanHz = () => dayanHz() / 3.2;

export function playBol(bol, { when = 0, vel = 0.9, gumki = false } = {}) {
  const ac = audioContext();
  if (!ac || !BOLS[bol]) return false;
  const out = tablaOut(ac);
  const t = ac.currentTime + when;
  for (const part of BOLS[bol]) {
    if (part === 'ge') ge(ac, out, t, bayanHz(), vel, gumki);
    else if (part === 'ke') ke(ac, out, t, vel);
    else stroke(ac, out, t, dayanHz(), DAYAN[part], vel);
  }
  return true;
}

// Taals: the beats (matras), how they group into sections (vibhag), the clap
// marks (X is sam, the first beat; 0 is khali, the empty wave), and the theka,
// the basic pattern of bols. A beat can hold two or four quick bols.
export const TAALS = {
  teentaal: { name: 'Teentaal', vibhag: [4, 4, 4, 4], marks: ['X', '2', '0', '3'], bpm: 150, theka: ['Dha', 'Dhin', 'Dhin', 'Dha', 'Dha', 'Dhin', 'Dhin', 'Dha', 'Dha', 'Tin', 'Tin', 'Ta', 'Ta', 'Dhin', 'Dhin', 'Dha'] },
  jhaptaal: { name: 'Jhaptaal', vibhag: [2, 3, 2, 3], marks: ['X', '2', '0', '3'], bpm: 130, theka: ['Dhi', 'Na', 'Dhi', 'Dhi', 'Na', 'Ti', 'Na', 'Dhi', 'Dhi', 'Na'] },
  rupak: { name: 'Rupak', vibhag: [3, 2, 2], marks: ['0', '1', '2'], bpm: 120, theka: ['Tin', 'Tin', 'Na', 'Dhi', 'Na', 'Dhi', 'Na'] },
  ektaal: { name: 'Ektaal', vibhag: [2, 2, 2, 2, 2, 2], marks: ['X', '0', '2', '0', '3', '4'], bpm: 80, theka: ['Dhin', 'Dhin', ['Dha', 'Ge'], ['Ti', 'Ra', 'Ki', 'Ta'], 'Tu', 'Na', 'Kat', 'Ta', ['Dha', 'Ge'], ['Ti', 'Ra', 'Ki', 'Ta'], 'Dhi', 'Na'] },
  keherwa: { name: 'Keherwa', vibhag: [4, 4], marks: ['X', '0'], bpm: 130, theka: ['Dha', 'Ge', 'Na', 'Ti', 'Na', 'Ke', 'Dhi', 'Na'] },
  dadra: { name: 'Dadra', vibhag: [3, 3], marks: ['X', '0'], bpm: 140, theka: ['Dha', 'Dhi', 'Na', 'Dha', 'Ti', 'Na'] },
};

let theka = null;
export const thekaPlaying = () => Boolean(theka);

// Plays a taal's theka on a loop. `onBeat(i)` is called as each beat sounds.
export function startTheka(taalId, bpm, onBeat) {
  const ac = audioContext();
  if (!ac) return false;
  stopTheka();
  tablaOut(ac);
  const state = { taal: TAALS[taalId], bpm, beat: 0, next: ac.currentTime + 0.1, timers: [], onBeat, interval: 0 };
  const schedule = () => {
    while (state.next < ac.currentTime + 0.15) {
      const len = 60 / state.bpm;
      const i = state.beat % state.taal.theka.length;
      const cell = state.taal.theka[i];
      const bols = Array.isArray(cell) ? cell : [cell];
      bols.forEach((b, k) => playBol(b, { when: state.next - ac.currentTime + (k * len) / bols.length, vel: i === 0 ? 1 : 0.85 }));
      const at = state.next;
      state.timers.push(setTimeout(() => state.onBeat?.(i), Math.max(0, (at - ac.currentTime) * 1000)));
      if (state.timers.length > 32) state.timers.splice(0, 16);
      state.next += len;
      state.beat++;
    }
  };
  schedule();
  state.interval = setInterval(schedule, 25);
  theka = state;
  return true;
}

export function setThekaTempo(bpm) {
  if (theka) theka.bpm = bpm;
}

export function stopTheka() {
  if (!theka) return;
  clearInterval(theka.interval);
  theka.timers.forEach(clearTimeout);
  theka = null;
}

// Stop everything (leaving the page).
export function stopAll() {
  stopTanpura();
  stopTheka();
  harmoniumAllOff();
}
