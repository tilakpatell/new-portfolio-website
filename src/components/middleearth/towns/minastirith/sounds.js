// Minas Tirith, in sound, synthesised so nothing is downloaded: the air of
// each place (the city waking, the court high up, the hall's hush, the
// mountain wind at the beacon, the fires along the mountains, the siege at
// night with the drums of Mordor, the morning of the crowning); Shadowfax's
// hooves on the stones; and the one-shots: a cart knocked, a gate's
// trumpet, the great doors, the guard stirring and his shout, the pile
// creaking, the beacon catching and roaring, the trebuchets winding and
// loosing, a siege-tower falling, a stone landing, a fell beast's scream,
// the horns of Rohan, the bells, a tomato, a cheer. All through the site's
// master volume.

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
const rnd = (a, b) => a + Math.random() * (b - a);

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

// A bell: a hum an octave down, the strike tone, and the bright partials
// over it, each dying away at its own rate.
const PARTIALS = [[0.5, 0.45, 1.5], [1, 1, 1], [1.19, 0.45, 0.75], [1.5, 0.32, 0.55], [2, 0.3, 0.45], [2.52, 0.16, 0.32], [3.01, 0.12, 0.25], [4.16, 0.07, 0.16]];
function bell(ac, out, t, { f = 600, gain = 0.05, length = 2.4 }) {
  for (const [r, a, d] of PARTIALS) tone(ac, out, t, { f: f * r * rnd(0.998, 1.002), gain: gain * a, attack: 0.003, length: length * d });
}
// Brass: two saws a hair apart, through a filter that opens as the note
// speaks; it scoops up to its pitch, and wavers a little as it's held.
function brass(ac, out, t, { f = 440, length = 0.5, gain = 0.06, bright = 2400, attack = 0.05, scoop = 0.96, vib = 0.006 }) {
  const g = ac.createGain();
  env(g.gain, t, [[0, 0.0001], [attack, gain], [Math.max(attack + 0.02, length - 0.14), gain * 0.85], [length, 0.0001]]);
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 1.4;
  lp.frequency.setValueAtTime(f * 1.4, t);
  lp.frequency.exponentialRampToValueAtTime(bright, t + attack * 1.6);
  lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.6, bright * 0.55), t + length);
  const lfo = ac.createOscillator();
  lfo.frequency.value = rnd(4.5, 5.8);
  const depth = ac.createGain();
  depth.gain.value = f * vib;
  lfo.connect(depth);
  for (const d of [0, 5]) {
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f * scoop, t);
    o.frequency.exponentialRampToValueAtTime(f, t + attack * 1.3);
    o.detune.value = d;
    depth.connect(o.frequency);
    o.connect(lp);
    o.start(t);
    o.stop(t + length + 0.05);
  }
  lfo.start(t);
  lfo.stop(t + length + 0.05);
  lp.connect(g).connect(out);
}
// Something like a voice: a buzz through two formants gliding from one
// vowel to the next, the pitch along `f` (spread over the length), and a
// rasp (`rough`, Hz) for a throat that's shouting.
function voice(ac, out, t, { f = [140, 180, 120], formants = [[570, 840], [300, 2200]], length = 0.4, gain = 0.3, attack = 0.03, rough = 0 }) {
  const o = ac.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(f[0], t);
  for (let i = 1; i < f.length; i++) o.frequency.linearRampToValueAtTime(f[i], t + (length * i) / (f.length - 1));
  const sum = ac.createGain();
  for (let k = 0; k < 2; k++) {
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = k ? 9 : 5;
    bp.frequency.setValueAtTime(formants[0][k], t);
    bp.frequency.linearRampToValueAtTime(formants[formants.length - 1][k], t + length * 0.75);
    const lv = ac.createGain();
    lv.gain.value = k ? 0.7 : 1;
    o.connect(bp).connect(lv).connect(sum);
  }
  const g = ac.createGain();
  env(g.gain, t, [[0, 0.0001], [attack, gain], [length * 0.7, gain * 0.75], [length, 0.0001]]);
  if (rough) {
    const am = ac.createGain();
    am.gain.value = 0.6;
    const lfo = ac.createOscillator();
    lfo.frequency.value = rough;
    const depth = ac.createGain();
    depth.gain.value = 0.4;
    lfo.connect(depth).connect(am.gain);
    lfo.start(t);
    lfo.stop(t + length + 0.05);
    sum.connect(am).connect(g);
  } else sum.connect(g);
  g.connect(out);
  o.start(t);
  o.stop(t + length + 0.05);
}
// Wood creaking: a slow buzz of little catches, through the ring of the timber.
function creakAt(ac, out, t, { rate = [30, 55], length = 0.5, f = 1100, q = 8, gain = 0.2 }) {
  const o = ac.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(rate[0], t);
  o.frequency.linearRampToValueAtTime(rate[1], t + length);
  const g = ac.createGain();
  env(g.gain, t, [[0, 0.0001], [length * 0.2, gain], [length * 0.8, gain * 0.7], [length, 0.0001]]);
  for (const [k, lv] of [[1, 1], [1.9, 0.5]]) {
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f * k;
    bp.Q.value = q;
    const l = ac.createGain();
    l.gain.value = lv;
    o.connect(bp).connect(l).connect(g);
  }
  g.connect(out);
  o.start(t);
  o.stop(t + length + 0.05);
}
// A drum, a big one, far off.
function drum(ac, out, t, { f = 48, gain = 0.3 }) {
  tone(ac, out, t, { f: f * 1.8, to: f, gain, attack: 0.004, length: 0.75 });
  hiss(ac, out, t, { type: 'lowpass', f: 280, gain: gain * 0.6, attack: 0.003, length: 0.28 });
}
// wood knocking on wood, or on stone
function clack(ac, out, t, { f = 500, gain = 0.06 }) {
  tone(ac, out, t, { type: 'triangle', f, to: f * 0.82, gain, attack: 0.001, length: 0.07 });
  hiss(ac, out, t, { type: 'bandpass', f: f * 2.6, q: 5, gain: gain * 1.2, attack: 0.001, length: 0.05 });
}
const crackle = (ac, out, t, gain = 0.02) => hiss(ac, out, t, { type: 'highpass', f: rnd(2400, 4800), gain, attack: 0.001, length: rnd(0.015, 0.04) });
const drip = (ac, out, t, gain = 0.02) => {
  const f = rnd(700, 1500);
  tone(ac, out, t, { f, to: f * 1.9, gain, attack: 0.002, length: 0.05 });
};
// a bird: a few quick notes, up and down
function chirp(ac, out, t, gain = 0.012) {
  let at = t;
  const base = rnd(2400, 4200);
  for (let i = 0, n = 2 + Math.floor(Math.random() * 4); i < n; i++) {
    const f = base * rnd(0.85, 1.2);
    tone(ac, out, at, { f, to: f * rnd(0.7, 1.4), gain, attack: 0.004, length: rnd(0.05, 0.11) });
    at += rnd(0.07, 0.14);
  }
}
// A short echo for far-off sounds: what's connected to the returned node
// comes out dry and again, softer and duller, and again. Undone after `life`.
function echo(ac, out, { time = 0.3, feedback = 0.32, cut = 1600, wet = 0.5, life = 5 } = {}) {
  const input = ac.createGain();
  const d = ac.createDelay(1);
  d.delayTime.value = time;
  const fb = ac.createGain();
  fb.gain.value = feedback;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = cut;
  const w = ac.createGain();
  w.gain.value = wet;
  input.connect(out);
  input.connect(d);
  d.connect(lp);
  lp.connect(fb);
  fb.connect(d);
  lp.connect(w);
  w.connect(out);
  setTimeout(() => [input, d, fb, lp, w].forEach((n) => n.disconnect()), life * 1000);
  return input;
}

// ── the air ──

// The level of each layer of the air, in each place.
const LAYERS = {
  ride: { wind: 0.05, whistle: 0.004, murmur: 0.045, trickle: 0.0001, fire: 0.0001, battle: 0.0001 },
  court: { wind: 0.07, whistle: 0.012, murmur: 0.006, trickle: 0.014, fire: 0.0001, battle: 0.0001 },
  hall: { wind: 0.006, whistle: 0.0001, murmur: 0.0001, trickle: 0.0001, fire: 0.018, battle: 0.0001 },
  beacon: { wind: 0.16, whistle: 0.03, murmur: 0.0001, trickle: 0.0001, fire: 0.0001, battle: 0.0001 },
  chain: { wind: 0.12, whistle: 0.014, murmur: 0.0001, trickle: 0.0001, fire: 0.09, battle: 0.0001 },
  walls: { wind: 0.05, whistle: 0.0001, murmur: 0.0001, trickle: 0.0001, fire: 0.075, battle: 0.065 },
  day: { wind: 0.03, whistle: 0.0001, murmur: 0.07, trickle: 0.006, fire: 0.0001, battle: 0.0001 },
};
// The air of each place: place('ride' | 'court' | 'hall' | 'beacon' |
// 'chain' | 'walls' | 'day'). { place, stop }.
export function air() {
  const [ac, out] = ready();
  if (!ac) return { place() {}, stop() {} };
  const master = ac.createGain();
  master.gain.value = 0.0001;
  master.gain.setTargetAtTime(0.42, ac.currentTime, 1.5);
  master.connect(out);
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  src.loop = true;
  const layer = (type, f, q) => {
    const flt = ac.createBiquadFilter();
    flt.type = type;
    flt.frequency.value = f;
    flt.Q.value = q;
    const g = ac.createGain();
    g.gain.value = 0.0001;
    src.connect(flt).connect(g).connect(master);
    return { flt, g };
  };
  // wind, and its whistle in the stones; a crowd far off; the fountain; fire; a battle
  const L = {
    wind: layer('bandpass', 380, 1.1),
    whistle: layer('bandpass', 1200, 9),
    murmur: layer('bandpass', 520, 1.3),
    trickle: layer('highpass', 2600, 0.7),
    fire: layer('lowpass', 240, 0.7),
    battle: layer('bandpass', 650, 0.8),
  };
  src.start();
  let where = 'ride';
  let on = true;
  const level = (k) => (LAYERS[where] ?? LAYERS.court)[k];
  const tick = () => {
    if (!on) return;
    const t = ac.currentTime + 0.05;
    // the wind wanders; the crowd and the battle swell and ebb
    L.wind.flt.frequency.setTargetAtTime(where === 'beacon' || where === 'chain' ? rnd(260, 900) : rnd(260, 600), t, 1);
    L.wind.g.gain.setTargetAtTime(level('wind') * rnd(0.6, 1.4), t, 0.9);
    L.whistle.flt.frequency.setTargetAtTime(rnd(900, 1700), t, 1.5);
    L.whistle.g.gain.setTargetAtTime(level('whistle') * rnd(0.3, 1.5), t, 1.2);
    L.murmur.flt.frequency.setTargetAtTime(rnd(420, where === 'day' ? 900 : 700), t, 0.3);
    L.murmur.g.gain.setTargetAtTime(level('murmur') * rnd(0.6, 1.3), t, 0.4);
    L.battle.g.gain.setTargetAtTime(level('battle') * rnd(0.4, 1.5), t, 1.2);
    L.fire.g.gain.setTargetAtTime(level('fire') * rnd(0.7, 1.3), t, 0.6);
    if (where === 'ride') {
      if (Math.random() < 0.16) bell(ac, master, t + rnd(0, 0.5), { f: rnd(440, 720), gain: 0.025, length: 2.8 });
    } else if (where === 'court') {
      for (let i = 0, n = 1 + Math.floor(Math.random() * 3); i < n; i++) drip(ac, master, t + rnd(0, 0.6), 0.012);
      if (Math.random() < 0.05) bell(ac, master, t + 0.3, { f: rnd(380, 520), gain: 0.018, length: 3.2 });
    } else if (where === 'hall') {
      for (let i = 0; i < 3; i++) crackle(ac, master, t + rnd(0, 0.6), 0.012);
    } else if (where === 'chain') {
      for (let i = 0; i < 2; i++) crackle(ac, master, t + rnd(0, 0.6), 0.008);
    } else if (where === 'walls') {
      for (let i = 0; i < 3; i++) crackle(ac, master, t + rnd(0, 0.6), 0.014);
      if (Math.random() < 0.3) for (const f of [1800, 2650, 3900]) tone(ac, master, t + 0.2, { type: 'triangle', f: f * rnd(0.95, 1.05), gain: 0.006, attack: 0.001, length: 0.2 });
    } else if (where === 'day') {
      if (Math.random() < 0.6) chirp(ac, master, t + rnd(0, 0.4));
      if (Math.random() < 0.2) bell(ac, master, t + rnd(0, 0.4), { f: rnd(520, 880), gain: 0.025, length: 2.6 });
    }
    timer = setTimeout(tick, 500 + Math.random() * 900);
  };
  let timer = setTimeout(tick, 300);
  // the drums of Mordor, on the walls: a slow beat, kept in time
  const BEAT = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0.7, 0, 0, 0, 0, 0];
  const STEP = 60 / 76 / 2;
  let step = 0;
  let next = ac.currentTime + 0.4;
  const drums = () => {
    if (!on) return;
    const now = ac.currentTime;
    if (next < now) next = now + 0.05;
    while (next < now + 0.3) {
      const v = BEAT[step % BEAT.length];
      if (where === 'walls' && v) drum(ac, master, next, { f: rnd(44, 50), gain: 0.3 * v });
      step += 1;
      next += STEP;
    }
    drumTimer = setTimeout(drums, 120);
  };
  let drumTimer = setTimeout(drums, 100);
  const api = {
    place(z) {
      where = z;
      const now = ac.currentTime;
      for (const k of Object.keys(L)) L[k].g.gain.setTargetAtTime(level(k), now, 1);
      L.fire.flt.frequency.setTargetAtTime(z === 'hall' ? 1400 : 260, now, 0.5);
    },
    stop() {
      on = false;
      clearTimeout(timer);
      clearTimeout(drumTimer);
      master.gain.setTargetAtTime(0.0001, ac.currentTime, 0.3);
      src.stop(ac.currentTime + 1);
    },
  };
  api.place(where);
  return api;
}

// ── Shadowfax ──

// His hooves on the stones of the city: four beats a stride, in time with
// the gallop's legs (../weathertop/props.js gallop, its strides a second),
// louder and quicker as he goes faster; nothing when he stands.
// set(speed 0..1+), stop().
export function gallop() {
  const [ac, out] = ready();
  if (!ac) return { set() {}, stop() {} };
  const bus = ac.createGain();
  bus.gain.value = 0.9;
  bus.connect(out);
  let speed = 0;
  let on = true;
  let next = ac.currentTime + 0.05;
  const hoof = (t, k) => {
    tone(ac, bus, t, { f: rnd(105, 130), to: 55, gain: 0.13 * k, attack: 0.002, length: 0.09 });
    hiss(ac, bus, t, { type: 'bandpass', f: rnd(1700, 2700), q: 3, gain: 0.07 * k, attack: 0.001, length: 0.045 });
    hiss(ac, bus, t, { type: 'lowpass', f: 520, gain: 0.07 * k, attack: 0.002, length: 0.07 });
  };
  const BEATS = [[0, 0.85], [0.1, 1], [0.45, 0.8], [0.55, 0.95]];
  const pump = () => {
    if (!on) return;
    const now = ac.currentTime;
    if (next < now) next = now + 0.02;
    // standing, nothing; going, a stride at a time, a little ahead
    if (speed <= 0.03) next = now + 0.05;
    else {
      while (next < now + 0.25) {
        const stride = 1 / Math.min(2.8, 1.5 + 0.75 * speed);
        const k = Math.min(1, 0.4 + speed * 0.6);
        for (const [o, a] of BEATS) hoof(next + o * stride + rnd(-0.006, 0.006), k * a);
        next += stride;
      }
    }
    timer = setTimeout(pump, 80);
  };
  let timer = setTimeout(pump, 0);
  return {
    set(s) {
      speed = Math.max(0, Number(s) || 0);
    },
    stop() {
      on = false;
      clearTimeout(timer);
      bus.gain.setTargetAtTime(0.0001, ac.currentTime, 0.1);
    },
  };
}

// ── one-shots ──

// a cart knocked: a jolt, and the clatter of what's on it
export function knock() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  tone(ac, out, t, { f: 150, to: 75, gain: 0.25, attack: 0.002, length: 0.2 });
  hiss(ac, out, t, { type: 'lowpass', f: 900, gain: 0.15, attack: 0.002, length: 0.12 });
  for (let i = 0; i < 7; i++) clack(ac, out, t + i * 0.045 + rnd(0, 0.04), { f: rnd(280, 900), gain: rnd(0.04, 0.07) });
}
// a gate passed: a bright call on a trumpet from the wall above, and a bell
export function gate() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  const far = echo(ac, out, { time: 0.22, feedback: 0.25, cut: 2200, wet: 0.4, life: 3 });
  brass(ac, far, t, { f: 587.3, length: 0.16, gain: 0.05, bright: 3200, attack: 0.03 });
  brass(ac, far, t + 0.2, { f: 587.3, length: 0.13, gain: 0.05, bright: 3200, attack: 0.03 });
  brass(ac, far, t + 0.36, { f: 880, length: 0.6, gain: 0.055, bright: 3600, attack: 0.04 });
  bell(ac, out, t + 0.1, { f: 660, gain: 0.02, length: 2 });
}
// the great doors: a boom, and its echo down the hall
export function door() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  creakAt(ac, out, t, { rate: [18, 26], length: 0.5, f: 320, q: 6, gain: 0.12 });
  tone(ac, out, t + 0.45, { f: 60, to: 32, gain: 0.5, attack: 0.005, length: 1.5 });
  hiss(ac, out, t + 0.45, { type: 'lowpass', f: 450, gain: 0.3, attack: 0.005, length: 0.5 });
  tone(ac, out, t + 0.85, { f: 50, to: 32, gain: 0.16, attack: 0.03, length: 1.5 });
  tone(ac, out, t + 1.3, { f: 46, to: 30, gain: 0.07, attack: 0.04, length: 1.5 });
}
// the guard shifting on his stool: a scrape, armour, a cough
export function stir() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  hiss(ac, out, t, { type: 'bandpass', f: 1000, q: 2, gain: 0.08, attack: 0.03, length: 0.35, sweep: 500 });
  tone(ac, out, t + 0.12, { type: 'triangle', f: 2300, to: 2200, gain: 0.015, attack: 0.001, length: 0.15 });
  for (const [dt, g] of [[0.38, 1], [0.58, 0.6]]) {
    hiss(ac, out, t + dt, { type: 'bandpass', f: 480, q: 1.6, gain: 0.16 * g, attack: 0.006, length: 0.13 });
    hiss(ac, out, t + dt, { type: 'bandpass', f: 1500, q: 2.2, gain: 0.08 * g, attack: 0.006, length: 0.1 });
  }
}
// seen: a gruff shout, something like "Oi!"
export function caught() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  voice(ac, out, t, { f: [120, 170, 185, 120], formants: [[600, 900], [560, 1000], [320, 2200]], length: 0.42, gain: 0.45, attack: 0.025, rough: 38 });
  hiss(ac, out, t, { type: 'bandpass', f: 1200, q: 0.8, gain: 0.05, attack: 0.02, length: 0.3 });
}
// climbing the pile: a creak of wood
export function climb() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  creakAt(ac, out, t, { rate: [28, 52], length: rnd(0.35, 0.5), f: rnd(900, 1300), gain: 0.16 });
  clack(ac, out, t + 0.02, { f: 260, gain: 0.04 });
}
// the beacon catching: a whoosh, the fire taking, crackling
export function ignite() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  hiss(ac, out, t, { type: 'bandpass', f: 250, q: 0.8, gain: 0.28, attack: 0.25, length: 0.8, sweep: 2400 });
  hiss(ac, out, t + 0.2, { type: 'lowpass', f: 320, gain: 0.25, attack: 0.3, length: 1.5 });
  for (let i = 0; i < 10; i++) crackle(ac, out, t + 0.3 + rnd(0, 1.1), 0.04);
}
// a great fire flaring up
export function roar() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  hiss(ac, out, t, { type: 'lowpass', f: 500, gain: 0.4, attack: 0.35, length: 2.4, sweep: 1500 });
  hiss(ac, out, t, { type: 'bandpass', f: 180, q: 0.7, gain: 0.25, attack: 0.5, length: 2.4 });
  tone(ac, out, t, { f: 48, to: 40, gain: 0.18, attack: 0.4, length: 2 });
  for (let i = 0; i < 18; i++) crackle(ac, out, t + rnd(0.2, 2.2), 0.05);
}
// a trebuchet winding: the ratchet, and the timbers taking the strain
export function creak() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  for (let i = 0; i < 12; i++) {
    hiss(ac, out, t + i * 0.12, { type: 'bandpass', f: 2600, q: 4, gain: 0.05, attack: 0.001, length: 0.03 });
    tone(ac, out, t + i * 0.12, { type: 'triangle', f: 900, to: 760, gain: 0.025, attack: 0.001, length: 0.04 });
  }
  creakAt(ac, out, t + 0.1, { rate: [16, 30], length: 1.3, f: 700, q: 7, gain: 0.12 });
}
// a trebuchet loosed: the catch knocked out, the arm's whoosh, and the thump
// of it against its stop
export function loose() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  clack(ac, out, t, { f: 200, gain: 0.12 });
  hiss(ac, out, t + 0.05, { type: 'bandpass', f: 240, q: 1.2, gain: 0.32, attack: 0.3, length: 0.6, sweep: 900 });
  hiss(ac, out, t + 0.4, { type: 'bandpass', f: 900, q: 1.2, gain: 0.18, attack: 0.02, length: 0.4, sweep: 300 });
  tone(ac, out, t + 0.55, { f: 72, to: 38, gain: 0.45, attack: 0.003, length: 0.5 });
  hiss(ac, out, t + 0.55, { type: 'lowpass', f: 650, gain: 0.25, attack: 0.003, length: 0.3 });
  for (let i = 0; i < 5; i++) clack(ac, out, t + 0.6 + rnd(0, 0.3), { f: rnd(220, 600), gain: 0.04 });
}
// a siege-tower going over: its timbers groaning, the crash, the wreck
export function crash() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  creakAt(ac, out, t, { rate: [14, 9], length: 0.95, f: 260, q: 5, gain: 0.22 });
  hiss(ac, out, t + 0.9, { type: 'lowpass', f: 1400, gain: 0.4, attack: 0.01, length: 1.6, sweep: 180 });
  tone(ac, out, t + 0.9, { f: 52, to: 28, gain: 0.4, attack: 0.005, length: 1.8 });
  for (let i = 0; i < 16; i++) clack(ac, out, t + 0.9 + rnd(0, 1.3), { f: rnd(160, 700), gain: rnd(0.04, 0.09) });
}
// a stone coming down in the earth
export function thud() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  tone(ac, out, t, { f: 66, to: 34, gain: 0.45, attack: 0.002, length: 0.5 });
  hiss(ac, out, t, { type: 'lowpass', f: 420, gain: 0.3, attack: 0.002, length: 0.35 });
  hiss(ac, out, t + 0.03, { type: 'bandpass', f: 1500, q: 0.8, gain: 0.07, attack: 0.02, length: 0.5 });
}
// a fell beast: a harsh, piercing scream, falling away
export function screech() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  const L = 1.6;
  const am = ac.createGain();
  am.gain.value = 0.55;
  const rasp = ac.createOscillator();
  rasp.frequency.value = 86;
  const depth = ac.createGain();
  depth.gain.value = 0.45;
  rasp.connect(depth).connect(am.gain);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(2400, t);
  bp.frequency.exponentialRampToValueAtTime(1100, t + L);
  bp.Q.value = 1.4;
  const g = ac.createGain();
  env(g.gain, t, [[0, 0.0001], [0.07, 0.22], [0.35, 0.16], [L * 0.7, 0.09], [L, 0.0001]]);
  const vib = ac.createOscillator();
  vib.frequency.value = 13;
  const vd = ac.createGain();
  vd.gain.value = 30;
  vib.connect(vd);
  for (const [f0, f1] of [[1500, 560], [1585, 610], [760, 300]]) {
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0 * 0.92, t);
    o.frequency.exponentialRampToValueAtTime(f0, t + 0.08);
    o.frequency.exponentialRampToValueAtTime(f1, t + L);
    vd.connect(o.frequency);
    o.connect(bp);
    o.start(t);
    o.stop(t + L + 0.05);
  }
  bp.connect(am).connect(g).connect(out);
  rasp.start(t);
  rasp.stop(t + L + 0.05);
  vib.start(t);
  vib.stop(t + L + 0.05);
  hiss(ac, out, t, { type: 'bandpass', f: 3000, q: 3, gain: 0.08, attack: 0.05, length: L, sweep: 1200 });
}
// the horns of Rohan, away to the north: several, deep, one after another
export function horns() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.05;
  const dull = ac.createBiquadFilter();
  dull.type = 'lowpass';
  dull.frequency.value = 1300;
  const far = echo(ac, out, { time: 0.42, feedback: 0.35, cut: 900, wet: 0.55, life: 9 });
  dull.connect(far);
  setTimeout(() => dull.disconnect(), 9000);
  [[146.8, 0, 2.6], [110, 0.7, 3], [164.8, 1.5, 2.4], [130.8, 2.3, 3.2]].forEach(([f, dt, len]) => {
    brass(ac, dull, t + dt, { f, length: len, gain: 0.06, bright: 900, attack: 0.3, scoop: 0.92, vib: 0.004 });
    brass(ac, dull, t + dt + 0.02, { f: f * 2, length: len * 0.9, gain: 0.016, bright: 1100, attack: 0.35, scoop: 0.94, vib: 0.004 });
  });
}
// the bells of the city, for the crowning: a peal, rung down and round again
export function bells() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  const SCALE = [784, 698.5, 659.3, 587.3, 523.3, 493.9, 440, 392];
  bell(ac, out, t, { f: 196, gain: 0.06, length: 4.5 });
  for (let round = 0; round < 2; round++) {
    SCALE.forEach((f, i) => bell(ac, out, t + 0.15 + (round * SCALE.length + i) * 0.27 + rnd(-0.015, 0.015), { f, gain: 0.04, length: 2.4 }));
  }
  bell(ac, out, t + 0.15 + 16 * 0.27, { f: 196, gain: 0.06, length: 4.5 });
}
// biting a tomato: the skin goes, and it's all juice
export function crunch() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  hiss(ac, out, t, { type: 'highpass', f: 3200, gain: 0.1, attack: 0.001, length: 0.025 });
  hiss(ac, out, t + 0.01, { type: 'bandpass', f: 1300, q: 1.5, gain: 0.22, attack: 0.004, length: 0.2, sweep: 450 });
  tone(ac, out, t + 0.01, { f: 190, to: 90, gain: 0.08, attack: 0.003, length: 0.1 });
  for (let i = 0; i < 4; i++) {
    const f = rnd(500, 1300);
    tone(ac, out, t + 0.06 + i * rnd(0.03, 0.06), { f, to: f * 1.7, gain: 0.035, attack: 0.002, length: 0.035 });
  }
}
// a cheer from a crowd
export function cheer() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  hiss(ac, out, t, { type: 'bandpass', f: 900, q: 0.6, gain: 0.2, attack: 0.4, length: 2.4 });
  hiss(ac, out, t + 0.1, { type: 'bandpass', f: 2400, q: 1, gain: 0.06, attack: 0.4, length: 2 });
  for (let i = 0; i < 12; i++) {
    const f = rnd(170, 340);
    const len = rnd(0.8, 1.6);
    const a = rnd(500, 800);
    voice(ac, out, t + rnd(0, 0.6), { f: [f, f * 1.25, f * 1.1, f * 0.85], formants: [[a, rnd(1100, 1500)], [a * 0.9, rnd(1500, 2000)]], length: len, gain: 0.05, attack: 0.12 });
  }
}
