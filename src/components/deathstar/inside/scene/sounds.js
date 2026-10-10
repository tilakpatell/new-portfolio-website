// The station’s sounds, synthesised in Web Audio so nothing is downloaded.
// The hum changes with the kind of room: a low drone and the air in the
// vents everywhere, a hangar vast and airy, a corridor close, detention
// harsh with the buzz of its lights, the compactor wet and dripping, a
// shaft deep and windy, the throne room cold over the reactor’s thrum far
// below. On top of it: the doors (a slide’s hiss, a blast door’s clang, a
// hatch’s clunk), the lift’s whine, the klaxon by the section’s alarm,
// blasters and hits placed by how far off and to which side they are, the
// saber’s hum and clash, footsteps by what is underfoot, the speakers’
// voices (lib/voiced) with a droid’s beeps, a trooper’s helmet comm or the
// intercom’s chime, and the music. The music is the site’s own, written
// for this: a slow low drone, and for alerts a brass-like figure in a
// minor mode over a march pulse; nothing in it quotes the film’s score.
//
// Everything goes through the bus the module is given (rt.audio.bus(),
// which the runtime fades out and lets go when the world goes) by way of
// one reverb the room kind sizes, so a shot in a hangar rings and one in a
// cell doesn’t. Positions are { x, y, z } in metres and the listener is
// { x, y, z, yaw } (yaw 0 faces −z, turning towards +x), as the rules use.
//
//   createSounds(bus, ctx, { rand }) → sounds     quiet (every call does nothing) without a bus and a context
//     hum(roomKind)                   cross-fade the station’s hum to that kind of room (layout’s ROOM_KINDS)
//     door(kind, at?)                 'slide' | 'blast' | 'hatch'; an 'arch' has no leaf, so nothing
//     lift(on)                        the whine while a lift moves; winding down and a clunk as it stops
//     alarm(level)                    the klaxon for an alarm.js level; calm and wary are quiet
//     blaster(weapon, at?, listener?) a shot, through lib/sfx’s laser, with its blast under the heavy guns
//     hit(at?)                        a bolt striking
//     hurt(gain, pitch?)              you, hit: a dull thump in the chest, at your ear, as loud as the hit
//     quake(at?, size)                the station shaking (size 0…1), and a panel bursting at `at`
//     saber(on, kind?)                light ('jedi' | 'sith') or put away your blade; it hums while lit
//     clash(at?)                      blade on blade
//     step(surface, at?)              a footfall on 'deck' | 'grate' | 'wet' (surfaceOf gives a room’s)
//     say(who, text) → Promise<handle | null>   the line in its speaker’s voice, after their chatter
//     music(mood)                     'quiet' | 'calm' | 'alert'
//     update(listener)                each frame: where the ear is, and whatever is due (drips, klaxon, notes)
//     dispose()                       stop everything; the bus is the runtime’s to let go
//   An `at` left out is at the listener: your own gun, your own feet.
//
//   heard(at, listener) → { gain, pan, cut }   how loud, which side and how dull a sound from `at` is
//   HUMS, humFor(kind) → { drone, air, airHz, airQ, bright, size, wind, drip, wet, thrum, harsh, cold }
//   doorFor(kind) → profile | null   gunFor(weapon) → { gain, body, crack }   klaxonFor(level) → { period, gain, whoop } | null
//   surfaceOf(roomKind) → surface    stepFor(surface) → { gain, thud, click, ring, splash }
//   chatterOf(who) → 'beeps' | 'honk' | 'comm' | 'chime' | null    musicFor(mood) → { level, figure } | null
//   BPM, FIGURE                      the alert’s figure: [semitones from D, beats]
//   notes(t0, from, to) → [{ at, semis, beats }]   the figure’s notes, looped from t0, that start in [from, to)
//   ticks(t0, period, from, to) → [time]           a beat’s times from t0 that fall in [from, to)

import { beeps, blast, clang, hit as thump, laser, alarm as twoTone, saber as ignite } from '../../../../lib/sfx';
import { sayVoiced, stopVoiced } from '../../../../lib/voiced';

// ── where a sound is heard from ──
const NEAR = 3; // metres within which a sound is at full strength
const FAR = 60; // the furthest a rifle reaches; beyond it a shot isn’t worth a voice
const OPEN = 16000; // the low-pass for a sound close by (all of it)
const DULL = 1500; // the most a distant sound is dulled to

export function heard(at, listener) {
  if (!at || !listener) return { gain: 1, pan: 0, cut: OPEN };
  const dx = at.x - listener.x;
  const dy = (at.y ?? listener.y) - listener.y;
  const dz = at.z - listener.z;
  const d = Math.hypot(dx, dy, dz);
  if (d > FAR) return { gain: 0, pan: 0, cut: DULL };
  const flat = Math.hypot(dx, dz);
  const yaw = listener.yaw ?? 0;
  // the right ear points along (cos yaw, sin yaw) in x, z: east when facing north
  const side = flat > 1e-6 ? (dx * Math.cos(yaw) + dz * Math.sin(yaw)) / flat : 0;
  // something right on top of you is in both ears, so a step past doesn’t flick hard from one to the other
  const pan = side * 0.9 * Math.min(1, flat / 1.5);
  const gain = d <= NEAR ? 1 : NEAR / d;
  const cut = Math.max(DULL, OPEN * Math.pow(NEAR / Math.max(d, NEAR), 0.6));
  return { gain, pan, cut };
}

// ── the hum of each kind of room ──
// drone: the fundamental (Hz); air: the vents’ level, airHz and airQ their
// band; bright: the low-pass over all of it; size: the reverb’s send (how
// big the room sounds); wind: a slow gusting band of low noise; drip: drips
// a second; wet: the slosh underfoot; thrum: the reactor’s beat (Hz);
// harsh: the buzz of the lights; cold: a thin high whistle.
const HUM = { drone: 55, air: 0.04, airHz: 600, airQ: 0.8, bright: 1200, size: 0.12, wind: 0, drip: 0, wet: 0, thrum: 0, harsh: 0, cold: 0 };
export const HUMS = Object.freeze({
  hangar: { drone: 41, air: 0.1, airHz: 900, airQ: 0.4, bright: 2400, size: 0.6, wind: 0.15 },
  tiebay: { drone: 41, air: 0.09, airHz: 1000, airQ: 0.4, bright: 2600, size: 0.55, wind: 0.1 },
  dock: { drone: 44, air: 0.08, airHz: 900, airQ: 0.4, bright: 2200, size: 0.5, wind: 0.1 },
  control: { drone: 58, air: 0.03, airHz: 1400, airQ: 1, bright: 1800, size: 0.1, harsh: 0.08 },
  corridor: {},
  lift: { drone: 62, air: 0.02, airHz: 500, airQ: 1, bright: 900, size: 0.04 },
  lobby: { drone: 50, air: 0.05, airHz: 700, airQ: 0.6, bright: 1500, size: 0.25 },
  detention: { drone: 60, air: 0.04, airHz: 1600, airQ: 1.2, bright: 3000, size: 0.15, harsh: 0.5 },
  cellbay: { drone: 60, air: 0.035, airHz: 1500, airQ: 1.2, bright: 2600, size: 0.12, harsh: 0.35 },
  cell: { drone: 60, air: 0.02, airHz: 1200, airQ: 1.5, bright: 1500, size: 0.04, harsh: 0.2 },
  compactor: { drone: 46, air: 0.03, airHz: 400, airQ: 0.6, bright: 900, size: 0.4, drip: 1.4, wet: 1 },
  chute: { drone: 46, air: 0.08, airHz: 350, airQ: 0.5, bright: 700, size: 0.3, wind: 0.5, wet: 0.3 },
  shaft: { drone: 33, air: 0.12, airHz: 300, airQ: 0.5, bright: 800, size: 0.8, wind: 1 },
  chasm: { drone: 33, air: 0.12, airHz: 320, airQ: 0.5, bright: 900, size: 0.8, wind: 0.9 },
  conference: { drone: 52, air: 0.025, airHz: 800, airQ: 0.8, bright: 1000, size: 0.2 },
  overbridge: { drone: 48, air: 0.03, airHz: 900, airQ: 0.7, bright: 1600, size: 0.35, harsh: 0.05 },
  firecontrol: { drone: 55, air: 0.03, airHz: 1200, airQ: 1, bright: 2000, size: 0.2, harsh: 0.15, thrum: 0.8 },
  meditation: { drone: 38, air: 0.015, airHz: 500, airQ: 1, bright: 600, size: 0.3, cold: 0.1 },
  archive: { drone: 52, air: 0.02, airHz: 900, airQ: 1, bright: 1200, size: 0.15 },
  maintenance: { drone: 50, air: 0.06, airHz: 500, airQ: 0.8, bright: 1000, size: 0.15, drip: 0.25 },
  reactor: { drone: 30, air: 0.1, airHz: 400, airQ: 0.6, bright: 1200, size: 0.7, wind: 0.4, thrum: 2.2 },
  throne: { drone: 36, air: 0.02, airHz: 2000, airQ: 1.5, bright: 2800, size: 0.65, thrum: 1.4, cold: 0.3 },
  holding: { drone: 52, air: 0.04, airHz: 800, airQ: 0.8, bright: 1400, size: 0.25 },
  command: { drone: 55, air: 0.03, airHz: 1200, airQ: 1, bright: 2200, size: 0.3, harsh: 0.1 },
  superstructure: { drone: 33, air: 0.1, airHz: 350, airQ: 0.5, bright: 900, size: 0.8, wind: 1, cold: 0.2 },
  gallery: { drone: 50, air: 0.03, airHz: 900, airQ: 0.8, bright: 1600, size: 0.4 },
  // the Falcon’s hold: her own smaller, higher hum
  ship: { drone: 70, air: 0.02, airHz: 700, airQ: 1, bright: 900, size: 0.05 },
});

const own = (table, key) => (typeof key === 'string' && Object.hasOwn(table, key) ? table[key] : undefined);

export function humFor(kind) {
  // a bay’s open side is heard as the bay it opens
  return { ...HUM, ...(own(HUMS, kind === 'field' ? 'hangar' : kind) ?? HUMS.corridor) };
}

// ── doors, guns, klaxons and feet ──
// length: how long the leaf travels (a sliding door opens in 0.45 s); hiss:
// the pneumatics; thud: the leaf home; clang and rumble: a blast door’s
// weight; clunk: a hatch’s latch.
const DOORS = Object.freeze({
  slide: { gain: 0.8, length: 0.45, hiss: 0.22, thud: 0.08, clang: 0, rumble: 0, clunk: 0 },
  blast: { gain: 1, length: 1.6, hiss: 0.12, thud: 0.2, clang: 0.6, rumble: 1, clunk: 0 },
  hatch: { gain: 0.8, length: 0.35, hiss: 0.1, thud: 0, clang: 0, rumble: 0, clunk: 1 },
  arch: null,
});
export const doorFor = (kind) => own(DOORS, kind) ?? (kind === 'arch' ? null : DOORS.slide);

// body: how much of lib/sfx’s blast sits under the chirp (the heavy guns’
// thump); crack: the band of the bolt’s snap leaving the muzzle.
const GUNS = Object.freeze({
  e11: { gain: 0.9, body: 0, crack: 2600 },
  dh17: { gain: 0.8, body: 0, crack: 3000 },
  dl44: { gain: 1, body: 0.55, crack: 2000 },
  a280: { gain: 1, body: 0.3, crack: 2300 },
});
export const gunFor = (weapon) => own(GUNS, weapon) ?? GUNS.e11;

// period: seconds from one round of the klaxon to the next; whoop: the
// rising horn of a lockdown rather than the alert’s two tones.
const KLAXONS = Object.freeze({
  calm: null,
  wary: null,
  alert: { period: 2.4, gain: 0.6, whoop: false },
  lockdown: { period: 1.2, gain: 0.9, whoop: true },
  hunt: { period: 2.6, gain: 0.5, whoop: true },
});
export const klaxonFor = (level) => own(KLAXONS, level) ?? null;

const WET = new Set(['compactor']);
const GRATE = new Set(['shaft', 'chasm', 'reactor', 'superstructure', 'maintenance']);
export const surfaceOf = (kind) => (WET.has(kind) ? 'wet' : GRATE.has(kind) ? 'grate' : 'deck');

const STEPS = Object.freeze({
  deck: { gain: 0.5, thud: 0.12, click: 0.05, ring: 0, splash: 0 },
  grate: { gain: 0.55, thud: 0.08, click: 0.04, ring: 0.04, splash: 0 },
  wet: { gain: 0.6, thud: 0.06, click: 0, ring: 0, splash: 0.14 },
});
export const stepFor = (surface) => own(STEPS, surface) ?? STEPS.deck;

// What a speaker sounds like before (or instead of) their words.
const CHATTER = Object.freeze({
  artoo: 'beeps',
  r2: 'beeps',
  r5: 'beeps',
  mouse: 'beeps',
  gonk: 'honk',
  trooper: 'comm',
  stormtrooper: 'comm',
  dstrooper: 'comm',
  gunner: 'comm',
  tiepilot: 'comm',
  intercom: 'chime',
});
export const chatterOf = (who) => own(CHATTER, who) ?? null;

// ── the music ──
const MOODS = Object.freeze({ quiet: null, calm: { level: 0.5, figure: false }, alert: { level: 0.6, figure: true } });
export const musicFor = (mood) => own(MOODS, mood) ?? null;

export const BPM = 84;
const ROOT = 73.42; // D2, the drone; the figure plays an octave above
// Three bars of four in D natural minor, a bar a line: a dotted opening that
// climbs to the minor third and falls to the flat seventh; up to the fourth
// and down to the flat sixth; then from the flat seventh it settles on the
// root, held through the last bar.
export const FIGURE = Object.freeze([
  ...[[0, 1.5], [3, 0.5], [2, 1], [-2, 1]],
  ...[[0, 1], [5, 0.5], [3, 0.5], [2, 1], [-4, 1]],
  ...[[-2, 1], [0, 3]],
]);
const LOOP = FIGURE.reduce((sum, [, beats]) => sum + beats, 0);

export function notes(t0, from, to) {
  const beat = 60 / BPM;
  const loop = LOOP * beat;
  const out = [];
  for (let k = Math.max(0, Math.floor((from - t0) / loop)); t0 + k * loop < to; k++) {
    let at = t0 + k * loop;
    for (const [semis, beats] of FIGURE) {
      if (at >= from && at < to) out.push({ at, semis, beats });
      at += beats * beat;
    }
  }
  return out;
}

export function ticks(t0, period, from, to) {
  const out = [];
  for (let k = Math.max(0, Math.floor((from - t0) / period)); t0 + k * period < to; k++) {
    const at = t0 + k * period;
    if (at >= from) out.push(at);
  }
  return out;
}

// ── the sounds themselves ──
const AHEAD = 0.25; // seconds scheduled ahead each update, so a slow frame doesn’t leave a gap
const POOL = 16; // placed voices, reused in turn
const SINKS = 3; // placed voices for lib/sfx’s ringing sounds alone (see `pool` below)
const RINGS = 0.05; // the quietest one of those is worth its ring at

const QUIET = Object.freeze({
  hum() {},
  door() {},
  lift() {},
  alarm() {},
  blaster() {},
  hit() {},
  hurt() {},
  quake() {},
  saber() {},
  clash() {},
  step() {},
  say: () => Promise.resolve(null),
  music() {},
  update() {},
  dispose() {},
});

export function createSounds(bus, ctx, { rand = Math.random } = {}) {
  if (!bus || !ctx) return QUIET;
  let live = true;
  let ear = null;
  const now = () => ctx.currentTime;

  // noise, made once: white for hiss and vents, brown for rumble and slosh
  const buffers = {};
  const noiseBuffer = (color) => {
    if (buffers[color]) return buffers[color];
    const n = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < n; i++) {
      const w = rand() * 2 - 1;
      b = (b + 0.02 * w) / 1.02;
      d[i] = color === 'brown' ? b * 3.5 : w;
    }
    return (buffers[color] = buf);
  };

  // The room: what everything plays into, dry to the bus and sent to a
  // reverb whose send the room kind sets.
  const room = ctx.createGain();
  room.connect(bus);
  const send = ctx.createGain();
  send.gain.value = HUM.size;
  const verb = ctx.createConvolver();
  verb.buffer = (() => {
    const n = Math.floor(ctx.sampleRate * 2.4);
    const ir = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (rand() * 2 - 1) * Math.pow(1 - i / n, 3);
    }
    return ir;
  })();
  room.connect(send).connect(verb).connect(bus);

  // Placed voices (gain, then the low-pass of distance, then the pan), each
  // pool taken in turn. lib/sfx’s blast, clang, saber and beeps ring through
  // one hall per context, and it joins every destination any of them is
  // given: handed the station’s voices, every voice that once carried one
  // would carry every later ring at its own stale gain and pan. So those four
  // get a few sinks of their own, placed for the call and let down to silence
  // once it has sounded (the room’s reverb carries the ring on from there),
  // and a call too quiet to be worth its ring isn’t made.
  const pool = (size) => {
    const voices = [];
    let turn = 0;
    const take = () => (voices[turn++ % size] ??= makeVoice());
    return { voices, take };
  };
  const makeVoice = () => {
    const input = ctx.createGain();
    const body = ctx.createGain();
    body.connect(input);
    const cut = ctx.createBiquadFilter();
    cut.type = 'lowpass';
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    input.connect(cut);
    (pan ? cut.connect(pan) : cut).connect(room);
    return { input, body, cut, pan };
  };
  const set = (param, value, t) => {
    param.cancelScheduledValues(t);
    param.setValueAtTime(value, t);
  };
  const voices = pool(POOL);
  const sinks = pool(SINKS);
  // a voice from `from` placed for a sound at `at` heard by `who`, or null if it wouldn’t be heard over `least`
  const place = (at, level = 1, who = ear, from = voices, least = 0.01) => {
    if (!live) return null;
    const h = heard(at, who);
    if (h.gain * level < least) return null;
    const v = from.take();
    const t = now();
    v.level = h.gain * level;
    set(v.input.gain, v.level, t);
    set(v.cut.frequency, h.cut, t);
    if (v.pan) set(v.pan.pan, h.pan, t);
    set(v.body.gain, 1, t);
    return v;
  };
  // one of lib/sfx’s ringing sounds, played into a sink placed for `at`;
  // `play(dest)` gives how long until it has sounded, and the sink holds till then
  const rung = (play, at, level, who = ear) => {
    const k = place(at, level, who, sinks, RINGS);
    if (!k) return;
    const end = now() + (play(k.input) || 0);
    k.input.gain.setValueAtTime(k.level, end);
    k.input.gain.setTargetAtTime(0, end, 0.4);
  };

  const env = (param, t, points) => {
    param.cancelScheduledValues(t);
    param.setValueAtTime(points[0][1], t + points[0][0]);
    for (let i = 1; i < points.length; i++) param.exponentialRampToValueAtTime(Math.max(points[i][1], 0.0001), t + points[i][0]);
  };
  const tone = (out, t, { type = 'sine', f, to = null, gain, attack = 0.004, length }) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + length);
    const g = ctx.createGain();
    env(g.gain, t, [[0, 0.0001], [attack, gain], [length, 0.0001]]);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + length + 0.05);
    return o;
  };
  const puff = (out, t, { color = 'white', type = 'bandpass', f, to = null, q = 1, gain, attack = 0.004, length }) => {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(color);
    // looped, so a burst longer than what is left of the buffer after its random start doesn’t end early
    src.loop = true;
    const flt = ctx.createBiquadFilter();
    flt.type = type;
    flt.frequency.setValueAtTime(f, t);
    if (to) flt.frequency.exponentialRampToValueAtTime(to, t + length);
    flt.Q.value = q;
    const g = ctx.createGain();
    env(g.gain, t, [[0, 0.0001], [attack, gain], [length, 0.0001]]);
    src.connect(flt).connect(g).connect(out);
    src.start(t, rand());
    src.stop(t + length + 0.05);
    return src;
  };
  // a source that runs until stopped, into `out` through a gain of `level`
  const held = (out, make, level) => {
    const g = ctx.createGain();
    g.gain.value = level;
    g.connect(out);
    const src = make();
    src.connect(g);
    // noise starts somewhere along its buffer, so two layers of it aren’t the same sound twice
    if (src.buffer) src.start(now(), rand() * 1.5);
    else src.start(now());
    return src;
  };
  const oscillator = (type, f) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    return o;
  };
  const looped = (color) => {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuffer(color);
    s.loop = true;
    return s;
  };
  const drone = (out, type, f, level) => held(out, () => oscillator(type, f), level);
  const loopNoise = (out, color, level) => held(out, () => looped(color), level);
  const filter = (out, type, f, q = 0.7) => {
    const flt = ctx.createBiquadFilter();
    flt.type = type;
    flt.frequency.value = f;
    flt.Q.value = q;
    flt.connect(out);
    return flt;
  };
  // a slow wobble of `depth` on a param
  const wobble = (param, hz, depth) => {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = hz;
    const g = ctx.createGain();
    g.gain.value = depth;
    lfo.connect(g).connect(param);
    lfo.start(now());
    return lfo;
  };
  // fade a layer out and stop its sources once it is silent
  const release = (layer, tau = 0.4) => {
    if (!layer?.out) return;
    const t = now();
    layer.out.gain.cancelScheduledValues(t);
    layer.out.gain.setTargetAtTime(0.0001, t, tau);
    for (const s of layer.srcs) s.stop(t + tau * 5);
  };
  const layer = (out, level, tau) => {
    const g = ctx.createGain();
    const t = now();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.setTargetAtTime(level, t, tau);
    g.connect(out);
    return { out: g, srcs: [] };
  };

  // ── the hum ──
  let bed = null;
  let nextDrip = Infinity;
  const makeBed = (kind, p) => {
    const b = layer(room, 1, 0.6);
    b.kind = kind;
    b.p = p;
    const lp = filter(b.out, 'lowpass', p.bright);
    const s = b.srcs;
    // the drone: the fundamental twice a hair apart so it beats slowly, its octave and a faint twelfth
    s.push(drone(lp, 'sawtooth', p.drone, 0.05), drone(lp, 'sawtooth', p.drone * 1.006, 0.035), drone(lp, 'triangle', p.drone * 2, 0.025), drone(lp, 'sine', p.drone * 3, 0.008));
    s.push(loopNoise(filter(lp, 'bandpass', p.airHz, p.airQ), 'white', p.air));
    if (p.wind) {
      // gusts: a low band of noise whose pitch and strength wander
      const band = filter(lp, 'bandpass', 260, 0.7);
      const g = ctx.createGain();
      g.gain.value = 0.06 * p.wind;
      g.connect(band);
      const src = loopNoise(g, 'white', 1);
      s.push(src, wobble(band.frequency, 0.11, 140 * p.wind), wobble(g.gain, 0.07, 0.04 * p.wind));
    }
    if (p.wet) {
      const g = ctx.createGain();
      g.gain.value = 0.05 * p.wet;
      g.connect(filter(lp, 'lowpass', 320));
      s.push(loopNoise(g, 'brown', 1), wobble(g.gain, 0.23, 0.03 * p.wet));
    }
    if (p.thrum) {
      // the reactor: a deep tone beating at its own pace, felt more than heard
      const g = ctx.createGain();
      g.gain.value = 0.05;
      g.connect(b.out);
      s.push(drone(g, 'sine', 42, 1), wobble(g.gain, p.thrum, 0.045));
    }
    if (p.harsh) s.push(drone(filter(lp, 'bandpass', 2400, 2), 'square', 120, 0.02 * p.harsh));
    if (p.cold) s.push(drone(b.out, 'sine', 1975, 0.004 * p.cold), drone(b.out, 'sine', 1981, 0.003 * p.cold));
    return b;
  };
  const drip = (t) => {
    const a = ear ? { x: ear.x + (rand() - 0.5) * 12, y: ear.y - 1, z: ear.z + (rand() - 0.5) * 12 } : null;
    const v = place(a, 0.8);
    if (!v) return;
    const f = 900 + rand() * 700;
    tone(v.input, t, { f, to: f * 2.2, gain: 0.06, length: 0.07 });
    puff(v.input, t, { type: 'highpass', f: 3000, gain: 0.02, length: 0.02 });
  };

  // ── the klaxon ──
  let klaxon = null;
  const whoop = (out, t) => {
    const horn = filter(out, 'bandpass', 1100, 1.2);
    tone(horn, t, { type: 'sawtooth', f: 360, to: 720, gain: 0.07, attack: 0.05, length: 0.8 });
    tone(horn, t, { type: 'square', f: 180, to: 360, gain: 0.03, attack: 0.05, length: 0.8 });
  };

  // ── the music ──
  let score = null;
  const brass = (out, t, hz, length) => {
    // two saws a few cents apart and a square under them, the filter
    // opening on the attack the way a horn’s tone brightens as it speaks
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 1.2;
    env(lp.frequency, t, [[0, 350], [0.07, 1600], [0.3, 900]]);
    const g = ctx.createGain();
    env(g.gain, t, [[0, 0.0001], [0.06, 0.05], [Math.max(0.1, length - 0.12), 0.04], [length + 0.2, 0.0001]]);
    lp.connect(g).connect(out);
    for (const [type, f, level] of [['sawtooth', hz, 1], ['sawtooth', hz * 1.0035, 0.8], ['square', hz / 2, 0.35]]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = level;
      o.connect(og).connect(lp);
      o.start(t);
      o.stop(t + length + 0.3);
    }
  };
  const pulse = (out, t, down) => tone(out, t, { f: 80, to: 46, gain: down ? 0.14 : 0.07, attack: 0.005, length: 0.26 });

  // ── what runs until stopped ──
  let lifting = null;
  let blade = null;

  const sounds = {
    hum(kind) {
      if (!live || bed?.kind === kind) return;
      release(bed, 0.4);
      const p = humFor(kind);
      bed = makeBed(kind, p);
      send.gain.setTargetAtTime(p.size, now(), 0.5);
      nextDrip = p.drip ? now() + (0.4 + rand() * 1.2) / p.drip : Infinity;
    },
    door(kind, at) {
      const p = doorFor(kind);
      const v = p && place(at, p.gain);
      if (!v) return;
      const t = now();
      puff(v.input, t, { f: 3200, to: 900, q: 1.4, gain: p.hiss, attack: 0.02, length: p.length * 0.8 });
      if (p.thud) tone(v.input, t + p.length, { f: 90, to: 50, gain: p.thud, length: 0.12 });
      if (p.rumble) puff(v.input, t, { color: 'brown', type: 'lowpass', f: 220, gain: 0.25 * p.rumble, attack: 0.2, length: p.length });
      if (p.clang) rung((dest) => p.length * 0.9 + clang(ctx, dest, p.length * 0.9), at, p.gain * p.clang);
      if (p.clunk) {
        tone(v.input, t, { type: 'square', f: 150, to: 70, gain: 0.06 * p.clunk, attack: 0.002, length: 0.1 });
        puff(v.input, t, { type: 'lowpass', f: 900, gain: 0.15 * p.clunk, attack: 0.002, length: 0.08 });
      }
    },
    lift(on) {
      if (!live || Boolean(on) === Boolean(lifting)) return;
      if (on) {
        lifting = layer(room, 1, 0.3);
        const lp = filter(lifting.out, 'lowpass', 700);
        const motor = drone(lp, 'sawtooth', 70, 0.035);
        const whine = drone(lifting.out, 'sine', 280, 0.008);
        motor.frequency.setTargetAtTime(160, now(), 0.8);
        whine.frequency.setTargetAtTime(640, now(), 0.8);
        lifting.srcs.push(motor, whine, loopNoise(filter(lifting.out, 'lowpass', 250), 'brown', 0.08));
        lifting.motor = motor;
        lifting.whine = whine;
        return;
      }
      const t = now();
      lifting.motor.frequency.setTargetAtTime(50, t, 0.3);
      lifting.whine.frequency.setTargetAtTime(200, t, 0.3);
      release(lifting, 0.25);
      lifting = null;
      // the car settling on its stop
      tone(room, t + 0.3, { f: 110, to: 55, gain: 0.12, attack: 0.003, length: 0.18 });
      puff(room, t + 0.3, { type: 'lowpass', f: 600, gain: 0.1, length: 0.12 });
    },
    alarm(level) {
      if (!live || klaxon?.level === level) return;
      release(klaxon, 0.15);
      const k = klaxonFor(level);
      klaxon = { level, k };
      if (!k) return;
      Object.assign(klaxon, { out: ctx.createGain(), srcs: [], t0: now() + 0.05, to: now() });
      klaxon.out.gain.value = k.gain;
      klaxon.out.connect(room);
    },
    blaster(weapon, at, listener) {
      const g = gunFor(weapon);
      const v = place(at, g.gain, listener ?? ear);
      if (!v) return;
      laser(ctx, v.input);
      puff(v.input, now(), { type: 'bandpass', f: g.crack, q: 0.9, gain: 0.12, attack: 0.002, length: 0.06 });
      if (g.body) rung((dest) => blast(ctx, dest), at, g.gain * g.body, listener ?? ear);
    },
    quake(at, size = 1) {
      // the rumble is under your feet wherever you stand; the panel bursting is where it is
      const v = place(undefined, 0.9 * size);
      if (!v) return;
      const t = now();
      puff(v.input, t, { color: 'brown', type: 'lowpass', f: 160, gain: 0.5 * size, attack: 0.08, length: 1.4 });
      tone(v.input, t, { f: 55, to: 32, gain: 0.12 * size, attack: 0.02, length: 0.9 });
      if (at) rung((dest) => blast(ctx, dest), at, 0.8 * size);
    },
    hit(at) {
      const v = place(at, 0.7);
      if (!v) return;
      const t = now();
      puff(v.input, t, { type: 'highpass', f: 2200, gain: 0.25, attack: 0.002, length: 0.1 });
      tone(v.input, t, { type: 'sawtooth', f: 600, to: 120, gain: 0.05, attack: 0.002, length: 0.12 });
      set(v.body.gain, 0.35, t);
      thump(ctx, v.body);
    },
    hurt(gain = 1, pitch = 1) {
      // (at the ear: no place, so a hit on you is never dulled or panned)
      const v = place(undefined, 0.9 * Math.min(1, Math.max(0, gain)));
      if (!v) return;
      const t = now();
      tone(v.input, t, { f: 110 * pitch, to: 46 * pitch, gain: 0.3, attack: 0.003, length: 0.3 });
      puff(v.input, t, { color: 'brown', type: 'lowpass', f: 600 * pitch, gain: 0.35, attack: 0.002, length: 0.16 });
    },
    saber(on, kind = 'jedi') {
      if (!live || Boolean(on) === Boolean(blade)) return;
      const t = now();
      if (on) {
        rung((dest) => ignite(ctx, dest, 0, kind), null, 0.8);
        // the steady hum takes over as lib/sfx’s ignition fades
        const sith = kind === 'sith';
        blade = { out: ctx.createGain(), srcs: [] };
        blade.out.gain.setValueAtTime(0.0001, t);
        blade.out.gain.setTargetAtTime(1, t + 1, 0.2);
        blade.out.connect(room);
        const lp = filter(blade.out, 'lowpass', sith ? 900 : 700);
        for (const hz of sith ? [72, 75.5] : [92, 95]) blade.srcs.push(drone(lp, 'sawtooth', hz, 0.05));
        return;
      }
      release(blade, 0.06);
      blade = null;
      tone(room, t, { type: 'sawtooth', f: 520, to: 110, gain: 0.1, length: 0.3 });
      puff(room, t, { f: 2600, to: 900, gain: 0.12, length: 0.25 });
    },
    clash(at) {
      const v = place(at, 0.9);
      if (!v) return;
      const t = now();
      puff(v.input, t, { type: 'highpass', f: 1800, gain: 0.3, attack: 0.002, length: 0.16 });
      tone(filter(v.input, 'bandpass', 900, 1.5), t, { type: 'sawtooth', f: 140, to: 90, gain: 0.14, attack: 0.002, length: 0.2 });
      tone(v.input, t, { f: 1250, gain: 0.05, attack: 0.002, length: 0.35 });
    },
    step(surface, at) {
      const p = stepFor(surface);
      const v = place(at, p.gain);
      if (!v) return;
      const t = now();
      const k = 0.9 + rand() * 0.2;
      tone(v.input, t, { f: 95 * k, to: 55 * k, gain: p.thud, attack: 0.003, length: 0.07 });
      if (p.click) puff(v.input, t, { type: 'highpass', f: 3000 * k, gain: p.click, attack: 0.001, length: 0.025 });
      if (p.ring) for (const f of [860, 1290]) tone(v.input, t, { f: f * k, gain: p.ring, attack: 0.002, length: 0.2 });
      if (p.splash) {
        puff(v.input, t, { f: 900 * k, to: 350, gain: p.splash, attack: 0.01, length: 0.18 });
        puff(v.input, t, { color: 'brown', type: 'lowpass', f: 400, gain: p.splash * 0.6, attack: 0.01, length: 0.12 });
      }
    },
    say(who, text) {
      if (!live) return Promise.resolve(null);
      const chatter = chatterOf(who);
      const t = now();
      if (chatter === 'beeps') rung((dest) => beeps(ctx, dest), null, 1);
      const v = chatter && chatter !== 'beeps' && place(null, 1);
      if (chatter === 'honk') for (const at of [0, 0.32]) tone(filter(v.input, 'lowpass', 500), t + at, { type: 'square', f: 82, gain: 0.08, attack: 0.01, length: 0.24 });
      if (chatter === 'comm') {
        // the helmet’s comm keying on: a click and a breath of static
        tone(v.input, t, { type: 'square', f: 2400, gain: 0.03, attack: 0.001, length: 0.02 });
        puff(v.input, t + 0.01, { f: 2000, q: 0.6, gain: 0.04, attack: 0.005, length: 0.12 });
      }
      if (chatter === 'chime') {
        tone(v.input, t, { f: 698.46, gain: 0.08, attack: 0.01, length: 0.5 });
        tone(v.input, t + 0.28, { f: 523.25, gain: 0.08, attack: 0.01, length: 0.7 });
      }
      return sayVoiced(who, text);
    },
    music(mood) {
      if (!live || score?.mood === mood) return;
      release(score, 0.6);
      const m = musicFor(mood);
      if (!m) {
        score = { mood };
        return;
      }
      // non-diegetic, so dry to the bus, not into the room
      score = { mood, m, ...layer(bus, m.level, 2), t0: now() + 0.5, to: now() };
      const lp = filter(score.out, 'lowpass', 240);
      score.srcs.push(drone(lp, 'sawtooth', ROOT / 2, 0.06), drone(lp, 'sawtooth', ROOT * 1.004, 0.04), drone(lp, 'triangle', ROOT * 1.5, 0.015), wobble(lp.frequency, 0.05, 60));
    },
    update(listener) {
      if (listener) ear = listener;
      if (!live) return;
      const t = now();
      const until = t + AHEAD;
      if (bed?.p.drip && t >= nextDrip) {
        drip(t);
        nextDrip = t + (0.4 + rand() * 1.2) / bed.p.drip;
      }
      if (klaxon?.k) {
        // what was due while no frame came (a hidden tab) is let go, not played in a burst
        const from = Math.max(klaxon.to, t);
        for (const at of ticks(klaxon.t0, klaxon.k.period, from, until)) {
          if (klaxon.k.whoop) whoop(klaxon.out, at);
          else twoTone(ctx, klaxon.out, at - t);
        }
        klaxon.to = until;
      }
      if (score?.m?.figure) {
        const from = Math.max(score.to, t);
        const beat = 60 / BPM;
        for (const n of notes(score.t0, from, until)) brass(score.out, n.at, ROOT * 2 * Math.pow(2, n.semis / 12), n.beats * beat * 0.92);
        for (const at of ticks(score.t0, beat, from, until)) pulse(score.out, at, Math.round((at - score.t0) / beat) % 4 === 0);
        score.to = until;
      }
    },
    dispose() {
      if (!live) return;
      release(bed, 0.05);
      release(klaxon, 0.05);
      release(score, 0.05);
      release(lifting, 0.05);
      release(blade, 0.05);
      live = false;
      stopVoiced();
      // Once the releases have died away, the room, the score and the voices
      // let go of what they feed: the bus stays the runtime’s (and may carry
      // the next station’s sounds), and lib/sfx’s hall, which lives as long
      // as the context, keeps hold of the sinks it was handed, now leading nowhere.
      const outs = [room, verb, score?.out, ...[...voices.voices, ...sinks.voices].map((v) => v.input)];
      setTimeout(() => {
        for (const n of outs) {
          try {
            n?.disconnect();
          } catch {
            // the context went first
          }
        }
      }, 400);
    },
  };
  return sounds;
}
