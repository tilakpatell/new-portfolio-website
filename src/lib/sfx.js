// Cinema sound effects, synthesised with Web Audio: nothing to download.
// Every function takes an optional context and destination so the same code can
// be rendered offline for testing; by default it plays through the site's
// master volume (which respects the sound setting).
//
// All of these are original sounds, built from noise, oscillators and filters.

import { audioContext, output } from './audio';
import { createImpacts } from './impact';

const env = (param, t, points) => {
  param.cancelScheduledValues(t);
  param.setValueAtTime(points[0][1], t + points[0][0]);
  for (let i = 1; i < points.length; i++) {
    const [dt, v, kind] = points[i];
    if (kind === 'lin') param.linearRampToValueAtTime(v, t + dt);
    else param.exponentialRampToValueAtTime(Math.max(v, 0.0001), t + dt);
  }
};

const noiseCache = new WeakMap();
function noise(ac, seconds = 4, color = 'white') {
  const key = `${color}-${seconds}`;
  // (a pitched sound’s context is a stand-in: cache on the real one)
  let per = noiseCache.get(bare(ac));
  if (!per) noiseCache.set(bare(ac), (per = new Map()));
  if (per.has(key)) return per.get(key);
  const n = Math.floor(ac.sampleRate * seconds);
  const buf = ac.createBuffer(2, n, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let b = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (color === 'brown') {
        b = (b + 0.02 * w) / 1.02;
        d[i] = b * 3.5;
      } else d[i] = w;
    }
  }
  per.set(key, buf);
  return buf;
}

function noiseSource(ac, color, seconds) {
  const src = ac.createBufferSource();
  src.buffer = noise(ac, seconds, color);
  return src;
}

const irCache = new WeakMap();
function hall(acIn, seconds = 3) {
  const ac = bare(acIn);
  if (irCache.has(ac)) return irCache.get(ac);
  const n = Math.floor(ac.sampleRate * seconds);
  const ir = ac.createBuffer(2, n, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
  }
  const conv = ac.createConvolver();
  conv.buffer = ir;
  irCache.set(ac, conv);
  return conv;
}

// A bus with some reverb, for the big sounds; `level` trims the whole effect.
function bus(ac, dest, wet = 0.3, level = 1) {
  const input = ac.createGain();
  input.gain.value = level;
  const dry = ac.createGain();
  dry.gain.value = 1;
  const send = ac.createGain();
  send.gain.value = wet;
  input.connect(dry).connect(dest);
  const verb = hall(ac);
  input.connect(send).connect(verb);
  verb.connect(dest);
  return input;
}

const ready = (ac, dest) => {
  const a = ac ?? audioContext();
  const d = dest ?? (a ? output() : null);
  return a && d ? [a, d] : [null, null];
};

// A sound by force (docs/superpowers/specs/2026-10-08-game-feel-design.md
// §1): every sound below takes `{ gain = 1, pitch = 1 }` as its last
// argument. The gain trims the whole sound through one gain node in front of
// where it goes (clamped to 0…1, so no sound gets louder than it was made;
// at 0 nothing is made at all); the pitch scales every oscillator’s
// frequency and every buffer’s playback rate. Without it, or at 1 and 1, a
// sound is made exactly as it always was.
const bares = new WeakMap(); // a pitched stand-in → the real context
const bare = (ac) => bares.get(ac) ?? ac;
// (only those two keys: a node is never taken for them, though a test’s fake
// gain node is a plain object with a `gain`)
const isVoice = (a) => a != null && typeof a === 'object' && Object.getPrototypeOf(a) === Object.prototype && Object.keys(a).every((k) => k === 'gain' || k === 'pitch');
// the options off the end of a call’s arguments, if they are there
const voiceOf = (args) => (isVoice(args[args.length - 1]) ? args.pop() : null);
const gainOf = (v) => Math.min(1, Math.max(0, Number.isFinite(v?.gain) ? v.gain : 1));

// A param whose every value is scaled by `by`: the instance keeps its own
// class (so an LFO can still be joined to it), with its setters wrapped.
function scaled(p, by) {
  let d = null;
  for (let o = p; o && !d; o = Object.getPrototypeOf(o)) d = Object.getOwnPropertyDescriptor(o, 'value');
  let held = d && 'value' in d ? d.value : undefined;
  const read = d?.get ? () => d.get.call(p) : () => held;
  const write = d?.set
    ? (v) => d.set.call(p, v)
    : (v) => {
        held = v;
      };
  Object.defineProperty(p, 'value', {
    configurable: true,
    get: read,
    set(v) {
      write(v * by);
    },
  });
  for (const m of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime']) {
    const f = p[m];
    if (typeof f === 'function') p[m] = (v, ...rest) => f.call(p, v * by, ...rest);
  }
  const curve = p.setValueCurveAtTime;
  if (typeof curve === 'function') p.setValueCurveAtTime = (vs, ...rest) => curve.call(p, Float32Array.from(vs, (v) => v * by), ...rest);
  // what it already holds (an oscillator’s 440, a buffer’s rate of 1)
  write(read() * by);
  return p;
}

// The context a pitched sound is made in: the same context, whose
// oscillators and buffer sources come out with their pitch params scaled.
function pitched(ac, by) {
  const made = { createOscillator: 'frequency', createBufferSource: 'playbackRate' };
  const stand = new Proxy(ac, {
    get(t, k) {
      const v = t[k];
      if (typeof v !== 'function') return v;
      if (made[k]) {
        return (...args) => {
          const node = v.apply(t, args);
          if (node?.[made[k]]) scaled(node[made[k]], by);
          return node;
        };
      }
      return v.bind(t);
    },
  });
  bares.set(stand, ac);
  return stand;
}

// Makes `fn` with its voice: straight through when there’s nothing to change.
function voiced(fn, args, voice) {
  if (!voice) return fn(...args);
  const gain = gainOf(voice);
  const pitch = Number.isFinite(voice.pitch) && voice.pitch > 0 ? voice.pitch : 1;
  if (gain === 1 && pitch === 1) return fn(...args);
  const [ac, dest] = ready(args[0], args[1]);
  if (!ac) return 0;
  let out = dest;
  if (gain < 1) {
    out = ac.createGain();
    out.gain.value = gain;
    out.connect(dest);
  }
  return fn(pitch === 1 ? ac : pitched(ac, pitch), out, ...args.slice(2));
}

// The same sound asked for twice within a quarter second plays once (React's
// development mode runs effects twice; a double-click shouldn't double a boom).
const lastPlayed = new Map();
const once = (name, fn) =>
  function play(...args) {
    const voice = voiceOf(args);
    // (silent: nothing to make, and no turn of the throttle used up)
    if (voice && gainOf(voice) <= 0) return 0;
    if (!args[0]) {
      const now = performance.now();
      if (now - (lastPlayed.get(name) ?? -1e9) < 250) return 0;
      lastPlayed.set(name, now);
    }
    return voiced(fn, args, voice);
  };

// ── The Death Star (or a planet) exploding ─────────────────────────────────
function boomRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const out = bus(ac, dest, 0.35, 0.8);

  // the crack
  const crack = noiseSource(ac, 'white', 1);
  const crackF = ac.createBiquadFilter();
  crackF.type = 'highpass';
  crackF.frequency.value = 900;
  const crackG = ac.createGain();
  env(crackG.gain, t, [[0, 0.0001], [0.004, 0.45, 'lin'], [0.09, 0.0001]]);
  crack.connect(crackF).connect(crackG).connect(out);
  crack.start(t);
  crack.stop(t + 0.2);

  // the body: dark rumbling noise whose brightness falls away
  for (const [pan, delay] of [
    [-0.6, 0],
    [0.6, 0.03],
  ]) {
    const body = noiseSource(ac, 'brown', 6);
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.7;
    env(lp.frequency, t + delay, [[0, 2600], [0.25, 1600], [2.2, 380], [5.2, 90]]);
    const g = ac.createGain();
    env(g.gain, t + delay, [[0, 0.0001], [0.02, 0.5, 'lin'], [0.7, 0.36], [2.6, 0.12], [5.4, 0.0001]]);
    const p = ac.createStereoPanner ? ac.createStereoPanner() : null;
    if (p) p.pan.value = pan;
    body.connect(lp).connect(g);
    (p ? g.connect(p) : g).connect(out);
    body.start(t + delay);
    body.stop(t + delay + 5.5);
  }

  // the thump you feel: a sine dropping into the sub-bass
  const sub = ac.createOscillator();
  sub.type = 'sine';
  env(sub.frequency, t, [[0, 72], [1.3, 26]]);
  const subG = ac.createGain();
  env(subG.gain, t, [[0, 0.0001], [0.012, 0.6, 'lin'], [3.0, 0.0001]]);
  sub.connect(subG).connect(out);
  sub.start(t);
  sub.stop(t + 3.1);

  // the shock ring: a filtered whoosh that sweeps up and back down
  const ring = noiseSource(ac, 'white', 4);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.8;
  env(bp.frequency, t, [[0, 280], [0.55, 2600], [2.2, 420]]);
  const ringG = ac.createGain();
  env(ringG.gain, t, [[0, 0.0001], [0.5, 0.26, 'lin'], [2.4, 0.0001]]);
  ring.connect(bp).connect(ringG).connect(out);
  ring.start(t);
  ring.stop(t + 2.5);

  // debris: a scatter of small crackles
  for (let i = 0; i < 34; i++) {
    const at = t + 0.25 + Math.pow(Math.random(), 1.6) * 2.8;
    const d = noiseSource(ac, 'white', 1);
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1500 + Math.random() * 4500;
    f.Q.value = 3;
    const g = ac.createGain();
    const amp = 0.18 * (1 - (at - t) / 3.4) * (0.5 + Math.random() * 0.5);
    env(g.gain, at, [[0, 0.0001], [0.002, amp, 'lin'], [0.02 + Math.random() * 0.04, 0.0001]]);
    d.connect(f).connect(g).connect(out);
    d.start(at, Math.random() * 0.5);
    d.stop(at + 0.1);
  }
  return 5.5;
}

// ── The superlaser: a charge that climbs, then the beam ─────────────────────
function superlaserRaw(acIn, destIn, when = 0, charge = 1.1) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const out = bus(ac, dest, 0.25, 0.85);

  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 6;
  env(lp.frequency, t, [[0, 160], [charge, 2200]]);
  const g = ac.createGain();
  env(g.gain, t, [[0, 0.0001], [charge * 0.9, 0.35, 'lin'], [charge + 0.05, 0.2, 'lin'], [charge + 0.5, 0.0001]]);
  const trem = ac.createGain();
  trem.gain.value = 0.5;
  const lfo = ac.createOscillator();
  env(lfo.frequency, t, [[0, 5], [charge, 22]]);
  const lfoAmt = ac.createGain();
  lfoAmt.gain.value = 0.45;
  lfo.connect(lfoAmt).connect(trem.gain);
  for (const [f0, f1, det] of [
    [55, 220, 0],
    [55.4, 221, 7],
    [110, 440, -5],
  ]) {
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.detune.value = det;
    env(o.frequency, t, [[0, f0], [charge, f1]]);
    o.connect(lp);
    o.start(t);
    o.stop(t + charge + 0.6);
  }
  lp.connect(trem).connect(g).connect(out);
  lfo.start(t);
  lfo.stop(t + charge + 0.6);

  // the beam: a hard, bright buzz with a falling zap on top
  const at = t + charge;
  const beam = ac.createOscillator();
  beam.type = 'square';
  env(beam.frequency, at, [[0, 330], [0.38, 180]]);
  const beamF = ac.createBiquadFilter();
  beamF.type = 'bandpass';
  beamF.frequency.value = 1300;
  beamF.Q.value = 0.9;
  const beamG = ac.createGain();
  env(beamG.gain, at, [[0, 0.0001], [0.01, 0.4, 'lin'], [0.36, 0.25, 'lin'], [0.55, 0.0001]]);
  beam.connect(beamF).connect(beamG).connect(out);
  beam.start(at);
  beam.stop(at + 0.6);
  const zap = ac.createOscillator();
  zap.type = 'sawtooth';
  env(zap.frequency, at, [[0, 2600], [0.32, 160]]);
  const zapG = ac.createGain();
  env(zapG.gain, at, [[0, 0.0001], [0.005, 0.22, 'lin'], [0.34, 0.0001]]);
  zap.connect(zapG).connect(out);
  zap.start(at);
  zap.stop(at + 0.4);
  return charge + 0.6;
}

// ── Jumping to lightspeed ──────────────────────────────────────────────────
// Lined up with the Hyperspace animation (stars drift until 0.45 s, stretch
// until the jump at 1.15 s, tunnel until 1.95 s, gone by 2.45 s). The engines
// spool into a rising whine under a jet-flanged whoosh; the jump lands as a
// crack, a boom and a bright zip; the tunnel roars; a falling whoosh lets go.
// The boom is driven into soft clipping so its harmonics carry it on laptop
// and phone speakers, which can't play its fundamental.
const softClip = (k) => {
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  return curve;
};

function hyperspaceRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const jump = t + 1.15;
  const out = bus(ac, dest, 0.26, 0.62);
  const track = (node, from, to) => {
    node.start(from);
    node.stop(to);
  };

  // the engines spooling up: a low, rising hum
  const hum = ac.createOscillator();
  hum.type = 'sawtooth';
  env(hum.frequency, t, [[0, 38], [1.15, 70]]);
  const humF = ac.createBiquadFilter();
  humF.type = 'lowpass';
  humF.frequency.value = 480;
  const humG = ac.createGain();
  env(humG.gain, t, [[0, 0.0001], [0.3, 0.06, 'lin'], [1.1, 0.12, 'lin'], [1.2, 0.0001]]);
  hum.connect(humF).connect(humG).connect(out);
  track(hum, t, t + 1.25);

  // the whine, three partials climbing three octaves with the stretch
  for (const [mul, level] of [[1, 0.075], [2.01, 0.045], [3.02, 0.024]]) {
    const o = ac.createOscillator();
    env(o.frequency, t, [[0.3, 160 * mul], [1.15, 1250 * mul]]);
    const g = ac.createGain();
    env(g.gain, t, [[0.3, 0.0001], [0.95, level * 0.6], [1.13, level], [1.17, 0.0001]]);
    o.connect(g).connect(out);
    track(o, t + 0.3, t + 1.2);
  }

  // the whoosh: noise through a resonant band that sweeps up into the jump and
  // back down on the way out, flanged (mixed with a copy a few ms behind) like a jet
  const air = noiseSource(ac, 'white', 4);
  const band = ac.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 3;
  env(band.frequency, t, [[0.2, 260], [1.15, 5200], [1.3, 2400], [1.95, 1100], [2.45, 300]]);
  const warm = ac.createBiquadFilter();
  warm.type = 'lowshelf';
  warm.frequency.value = 400;
  warm.gain.value = 6;
  const flange = ac.createDelay(0.05);
  env(flange.delayTime, t, [[0.2, 0.012], [1.15, 0.0006], [1.95, 0.004], [2.45, 0.01]]);
  const flangeG = ac.createGain();
  flangeG.gain.value = 0.85;
  const airG = ac.createGain();
  env(airG.gain, t, [[0, 0.0001], [0.45, 0.06], [1.12, 0.78], [1.2, 0.36, 'lin'], [1.95, 0.22, 'lin'], [2.45, 0.0001]]);
  air.connect(band).connect(warm);
  warm.connect(airG);
  warm.connect(flange).connect(flangeG).connect(airG);
  airG.connect(out);
  track(air, t, t + 2.5);

  // the jump: a crack...
  const crack = noiseSource(ac, 'white', 1);
  const crackF = ac.createBiquadFilter();
  crackF.type = 'highpass';
  crackF.frequency.value = 1400;
  const crackG = ac.createGain();
  env(crackG.gain, jump, [[0, 0.0001], [0.004, 0.55, 'lin'], [0.09, 0.0001]]);
  crack.connect(crackF).connect(crackG).connect(out);
  track(crack, jump, jump + 0.12);

  // ...a boom, driven into soft clipping...
  const boomO = ac.createOscillator();
  env(boomO.frequency, jump, [[0, 150], [0.08, 90], [0.7, 40]]);
  const drive = ac.createWaveShaper();
  drive.curve = softClip(2.5);
  drive.oversample = '2x';
  const boomG = ac.createGain();
  env(boomG.gain, jump, [[0, 0.0001], [0.008, 0.6, 'lin'], [0.25, 0.32], [0.9, 0.0001]]);
  boomO.connect(drive).connect(boomG).connect(out);
  track(boomO, jump, jump + 0.95);
  const rumble = noiseSource(ac, 'brown', 2);
  const rumbleF = ac.createBiquadFilter();
  rumbleF.type = 'lowpass';
  env(rumbleF.frequency, jump, [[0, 1600], [0.6, 220]]);
  const rumbleG = ac.createGain();
  env(rumbleG.gain, jump, [[0, 0.0001], [0.01, 0.5, 'lin'], [0.8, 0.0001]]);
  rumble.connect(rumbleF).connect(rumbleG).connect(out);
  track(rumble, jump, jump + 0.85);

  // ...and a bright zip as the ship goes
  const zip = ac.createOscillator();
  zip.type = 'triangle';
  env(zip.frequency, jump, [[0, 1800], [0.14, 6400]]);
  const zipG = ac.createGain();
  env(zipG.gain, jump, [[0, 0.0001], [0.01, 0.06, 'lin'], [0.22, 0.0001]]);
  zip.connect(zipG).connect(out);
  track(zip, jump, jump + 0.25);

  // the tunnel: a roar that pulses as the light rushes past
  const roar = noiseSource(ac, 'brown', 2);
  const roarF = ac.createBiquadFilter();
  roarF.type = 'lowpass';
  roarF.frequency.value = 1100;
  roarF.Q.value = 2;
  const pulse = ac.createOscillator();
  pulse.frequency.value = 3.4;
  const pulseAmt = ac.createGain();
  pulseAmt.gain.value = 300;
  pulse.connect(pulseAmt).connect(roarF.frequency);
  const roarG = ac.createGain();
  env(roarG.gain, t, [[1.2, 0.0001], [1.4, 0.36, 'lin'], [1.95, 0.28, 'lin'], [2.45, 0.0001]]);
  roar.connect(roarF).connect(roarG).connect(out);
  track(roar, t + 1.2, t + 2.5);
  track(pulse, t + 1.2, t + 2.5);
  return 2.5;
}

// ── An original fanfare for the opening crawl: a timpani hit and a brass swell ─
// (a single held chord, not anyone's theme)
function fanfareRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const out = bus(ac, dest, 0.45);

  const timp = ac.createOscillator();
  timp.type = 'sine';
  env(timp.frequency, t, [[0, 104], [0.4, 87]]);
  const timpG = ac.createGain();
  env(timpG.gain, t, [[0, 0.0001], [0.008, 0.7, 'lin'], [1.6, 0.0001]]);
  timp.connect(timpG).connect(out);
  timp.start(t);
  timp.stop(t + 1.7);
  const skin = noiseSource(ac, 'white', 1);
  const skinF = ac.createBiquadFilter();
  skinF.type = 'bandpass';
  skinF.frequency.value = 180;
  skinF.Q.value = 1.4;
  const skinG = ac.createGain();
  env(skinG.gain, t, [[0, 0.0001], [0.004, 0.6, 'lin'], [0.25, 0.0001]]);
  skin.connect(skinF).connect(skinG).connect(out);
  skin.start(t);
  skin.stop(t + 0.3);

  // brass: stacked, slightly detuned saws through a filter that opens like breath
  const at = t + 0.12;
  const brassF = ac.createBiquadFilter();
  brassF.type = 'lowpass';
  brassF.Q.value = 1.2;
  env(brassF.frequency, at, [[0, 380], [0.55, 2600], [2.2, 1300], [3.6, 500]]);
  const brassG = ac.createGain();
  env(brassG.gain, at, [[0, 0.0001], [0.35, 0.42, 'lin'], [2.4, 0.34, 'lin'], [3.8, 0.0001]]);
  brassF.connect(brassG).connect(out);
  for (const hz of [116.54, 174.61, 233.08, 293.66, 349.23]) {
    for (const det of [-6, 0, 6]) {
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz;
      o.detune.value = det;
      const v = ac.createGain();
      v.gain.value = 0.12;
      o.connect(v).connect(brassF);
      o.start(at);
      o.stop(at + 3.9);
    }
  }
  // a cymbal swell under it
  const cym = noiseSource(ac, 'white', 4);
  const cymF = ac.createBiquadFilter();
  cymF.type = 'highpass';
  cymF.frequency.value = 6000;
  const cymG = ac.createGain();
  env(cymG.gain, t, [[0, 0.0001], [0.9, 0.16, 'lin'], [3.4, 0.0001]]);
  cym.connect(cymF).connect(cymG).connect(out);
  cym.start(t);
  cym.stop(t + 3.5);
  return 4;
}

// ── The two endings of the Battle of Yavin (original stings, not anyone's theme) ─
// A timpani stroke: a sine that sags in pitch, with the slap of the skin.
function timpani(ac, out, at, hz, level = 0.6) {
  const o = ac.createOscillator();
  env(o.frequency, at, [[0, hz * 1.12], [0.35, hz]]);
  const g = ac.createGain();
  env(g.gain, at, [[0, 0.0001], [0.008, level, 'lin'], [1.4, 0.0001]]);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + 1.5);
  const skin = noiseSource(ac, 'white', 1);
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = hz * 2;
  f.Q.value = 1.4;
  const sg = ac.createGain();
  env(sg.gain, at, [[0, 0.0001], [0.004, level * 0.8, 'lin'], [0.22, 0.0001]]);
  skin.connect(f).connect(sg).connect(out);
  skin.start(at);
  skin.stop(at + 0.25);
}

// Brass: detuned saws through a filter that opens like breath, then closes.
function brassChord(ac, out, at, notes, dur, level, bright = 2600) {
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.Q.value = 1.2;
  env(f.frequency, at, [[0, 320], [0.4, bright], [dur * 0.7, bright * 0.55], [dur, 420]]);
  const g = ac.createGain();
  env(g.gain, at, [[0, 0.0001], [0.25, level, 'lin'], [dur * 0.75, level * 0.8, 'lin'], [dur, 0.0001]]);
  f.connect(g).connect(out);
  for (const hz of notes) {
    for (const det of [-7, 0, 7]) {
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz;
      o.detune.value = det;
      const v = ac.createGain();
      v.gain.value = 0.1;
      o.connect(v).connect(f);
      o.start(at);
      o.stop(at + dur + 0.05);
    }
  }
}

// The Empire wins: two heavy strokes and a low, dark chord (G minor, with the flat sixth on top).
function imperialRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const out = bus(ac, dest, 0.4, 0.7);
  timpani(ac, out, t, 49, 0.7);
  timpani(ac, out, t + 0.42, 73.4, 0.6);
  brassChord(ac, out, t + 0.42, [98, 146.83, 196, 233.08, 311.13], 2.8, 0.36, 1500);
  return 3.3;
}

// The Rebels win: a bright run up a major chord, then the whole chord held, over a cymbal swell.
function victoryRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const out = bus(ac, dest, 0.42, 0.62);
  timpani(ac, out, t, 87.3, 0.55);
  [261.63, 329.63, 392, 523.25].forEach((hz, i) => brassChord(ac, out, t + i * 0.13, [hz], 0.42, 0.28, 3400));
  brassChord(ac, out, t + 0.55, [130.81, 261.63, 329.63, 392, 523.25, 659.25], 2.6, 0.34, 3600);
  timpani(ac, out, t + 0.55, 65.4, 0.5);
  const cym = noiseSource(ac, 'white', 4);
  const cymF = ac.createBiquadFilter();
  cymF.type = 'highpass';
  cymF.frequency.value = 6000;
  const cymG = ac.createGain();
  env(cymG.gain, t, [[0, 0.0001], [0.6, 0.14, 'lin'], [3, 0.0001]]);
  cym.connect(cymF).connect(cymG).connect(out);
  cym.start(t);
  cym.stop(t + 3.1);
  return 3.2;
}

// ── Theme switches (all original sounds) ───────────────────────────────────
// A lightsaber igniting: the snap-hiss, a quick rising "vwoom", then the hum.
// The Sith blade hums lower and dirtier.
function saberRaw(acIn, destIn, when = 0, kind = 'jedi') {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const out = bus(ac, dest, 0.18, 0.55);
  const sith = kind === 'sith';
  const hiss = noiseSource(ac, 'white', 1);
  const hissF = ac.createBiquadFilter();
  hissF.type = 'bandpass';
  hissF.frequency.value = 2600;
  hissF.Q.value = 0.8;
  const hissG = ac.createGain();
  env(hissG.gain, t, [[0, 0.0001], [0.01, 0.35, 'lin'], [0.22, 0.0001]]);
  hiss.connect(hissF).connect(hissG).connect(out);
  hiss.start(t);
  hiss.stop(t + 0.25);
  const sweep = ac.createOscillator();
  sweep.type = 'sawtooth';
  env(sweep.frequency, t, [[0, sith ? 110 : 150], [0.16, sith ? 520 : 760], [0.3, sith ? 150 : 190]]);
  const sweepF = ac.createBiquadFilter();
  sweepF.type = 'lowpass';
  sweepF.frequency.value = 1800;
  const sweepG = ac.createGain();
  env(sweepG.gain, t, [[0, 0.0001], [0.03, 0.22, 'lin'], [0.3, 0.0001]]);
  sweep.connect(sweepF).connect(sweepG).connect(out);
  sweep.start(t);
  sweep.stop(t + 0.32);
  // the hum: two saws a few hertz apart, beating, through a dark filter
  const humG = ac.createGain();
  env(humG.gain, t, [[0.08, 0.0001], [0.2, sith ? 0.2 : 0.16, 'lin'], [1.2, sith ? 0.16 : 0.13, 'lin'], [1.6, 0.0001]]);
  const humF = ac.createBiquadFilter();
  humF.type = 'lowpass';
  humF.frequency.value = sith ? 900 : 700;
  let chain = humF;
  if (sith) {
    const grit = ac.createWaveShaper();
    grit.curve = softClip(4);
    humF.connect(grit);
    chain = grit;
  }
  chain.connect(humG).connect(out);
  for (const hz of sith ? [72, 75.5] : [92, 95]) {
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = hz;
    o.connect(humF);
    o.start(t + 0.08);
    o.stop(t + 1.65);
  }
  return 1.6;
}

// An arcade coin: two square-wave notes, up a fourth.
function coinRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const o = ac.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(987.77, t);
  o.frequency.setValueAtTime(1318.51, t + 0.075);
  const g = ac.createGain();
  env(g.gain, t, [[0, 0.0001], [0.005, 0.12, 'lin'], [0.075, 0.12, 'lin'], [0.45, 0.0001]]);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + 0.47);
  return 0.5;
}

// A repulsor: the whine of it charging, then the blast.
function repulsorRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const out = bus(ac, dest, 0.25, 0.55);
  const whine = ac.createOscillator();
  env(whine.frequency, t, [[0, 320], [0.55, 1700]]);
  const whineG = ac.createGain();
  env(whineG.gain, t, [[0, 0.0001], [0.5, 0.12, 'lin'], [0.6, 0.0001]]);
  whine.connect(whineG).connect(out);
  whine.start(t);
  whine.stop(t + 0.62);
  const at = t + 0.58;
  const blast = noiseSource(ac, 'white', 1);
  const bf = ac.createBiquadFilter();
  bf.type = 'bandpass';
  bf.Q.value = 0.9;
  env(bf.frequency, at, [[0, 2600], [0.4, 500]]);
  const bg = ac.createGain();
  env(bg.gain, at, [[0, 0.0001], [0.01, 0.42, 'lin'], [0.45, 0.0001]]);
  blast.connect(bf).connect(bg).connect(out);
  blast.start(at);
  blast.stop(at + 0.5);
  const thump = ac.createOscillator();
  env(thump.frequency, at, [[0, 190], [0.3, 60]]);
  const tg = ac.createGain();
  env(tg.gain, at, [[0, 0.0001], [0.01, 0.35, 'lin'], [0.35, 0.0001]]);
  thump.connect(tg).connect(out);
  thump.start(at);
  thump.stop(at + 0.4);
  return 1.1;
}

// An office bell on the reception desk.
function dingRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const out = bus(ac, dest, 0.2, 0.5);
  for (const [mul, level, decay] of [[1, 0.32, 1.4], [2.76, 0.14, 0.7], [5.4, 0.07, 0.35]]) {
    const o = ac.createOscillator();
    o.frequency.value = 1046.5 * mul;
    const g = ac.createGain();
    env(g.gain, t, [[0, 0.0001], [0.004, level, 'lin'], [decay, 0.0001]]);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + decay + 0.05);
  }
  return 1.4;
}

// Knock, knock: two knuckles on a door.
function knockRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const out = bus(ac, dest, 0.3, 0.7);
  for (const at of [t, t + 0.2]) {
    const n = noiseSource(ac, 'white', 1);
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    const g = ac.createGain();
    env(g.gain, at, [[0, 0.0001], [0.003, 0.5, 'lin'], [0.07, 0.0001]]);
    n.connect(f).connect(g).connect(out);
    n.start(at);
    n.stop(at + 0.08);
    const o = ac.createOscillator();
    env(o.frequency, at, [[0, 170], [0.08, 110]]);
    const og = ac.createGain();
    env(og.gain, at, [[0, 0.0001], [0.003, 0.4, 'lin'], [0.1, 0.0001]]);
    o.connect(og).connect(out);
    o.start(at);
    o.stop(at + 0.12);
  }
  return 0.4;
}

// A robot changing shape: ratchets, a servo whine that climbs and settles, a clunk.
function transformRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const out = bus(ac, dest, 0.22, 0.6);
  [0, 0.09, 0.16, 0.3, 0.38, 0.52, 0.6, 0.74].forEach((dt, i) => {
    const n = noiseSource(ac, 'white', 1);
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2200 + (i % 3) * 900;
    f.Q.value = 3;
    const g = ac.createGain();
    env(g.gain, t + dt, [[0, 0.0001], [0.002, 0.3, 'lin'], [0.03, 0.0001]]);
    n.connect(f).connect(g).connect(out);
    n.start(t + dt);
    n.stop(t + dt + 0.04);
  });
  const servo = ac.createOscillator();
  servo.type = 'sawtooth';
  env(servo.frequency, t, [[0, 120], [0.45, 260], [0.9, 180]]);
  const sf = ac.createBiquadFilter();
  sf.type = 'bandpass';
  sf.Q.value = 2;
  env(sf.frequency, t, [[0, 500], [0.45, 1900], [0.9, 900]]);
  const sg = ac.createGain();
  env(sg.gain, t, [[0, 0.0001], [0.1, 0.16, 'lin'], [0.85, 0.12, 'lin'], [0.95, 0.0001]]);
  servo.connect(sf).connect(sg).connect(out);
  servo.start(t);
  servo.stop(t + 1);
  const at = t + 0.92;
  const clunk = ac.createOscillator();
  env(clunk.frequency, at, [[0, 140], [0.18, 55]]);
  const cg = ac.createGain();
  env(cg.gain, at, [[0, 0.0001], [0.005, 0.45, 'lin'], [0.25, 0.0001]]);
  clunk.connect(cg).connect(out);
  clunk.start(at);
  clunk.stop(at + 0.3);
  return 1.2;
}

// ── Easter eggs ─────────────────────────────────────────────────────────────
// Thunder for the hammer: a crack, then a long low roll.
function thunderRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const out = bus(ac, dest, 0.4, 0.55);
  const crack = noiseSource(ac, 'white', 1);
  const cf = ac.createBiquadFilter();
  cf.type = 'highpass';
  cf.frequency.value = 900;
  const cg = ac.createGain();
  env(cg.gain, t, [[0, 0.0001], [0.005, 0.5, 'lin'], [0.18, 0.0001]]);
  crack.connect(cf).connect(cg).connect(out);
  crack.start(t);
  crack.stop(t + 0.2);
  const roll = noiseSource(ac, 'brown', 4);
  const rf = ac.createBiquadFilter();
  rf.type = 'lowpass';
  env(rf.frequency, t, [[0, 900], [1.8, 160]]);
  const rg = ac.createGain();
  env(rg.gain, t, [[0, 0.0001], [0.08, 0.7, 'lin'], [0.5, 0.45, 'lin'], [2.2, 0.0001]]);
  roll.connect(rf).connect(rg).connect(out);
  roll.start(t);
  roll.stop(t + 2.3);
  return 2.3;
}

// A little droid's chirps: quick sine glides, never the same twice.
function beepsRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const out = bus(ac, dest, 0.15, 0.4);
  let at = t;
  for (let i = 0; i < 7; i++) {
    const o = ac.createOscillator();
    const f0 = 900 + Math.random() * 1800;
    const f1 = f0 * (0.6 + Math.random() * 1.1);
    const len = 0.05 + Math.random() * 0.09;
    o.frequency.setValueAtTime(f0, at);
    o.frequency.exponentialRampToValueAtTime(f1, at + len);
    const g = ac.createGain();
    env(g.gain, at, [[0, 0.0001], [0.006, 0.2, 'lin'], [len, 0.0001]]);
    o.connect(g).connect(out);
    o.start(at);
    o.stop(at + len + 0.01);
    at += len + 0.02 + Math.random() * 0.04;
  }
  return at - t;
}

// One more life: a bright run up the scale.
function oneUpRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  [659.25, 783.99, 1318.51, 1046.5, 1174.66, 1567.98].forEach((hz, i) => {
    const o = ac.createOscillator();
    o.type = 'square';
    o.frequency.value = hz;
    const g = ac.createGain();
    const at = t + i * 0.085;
    env(g.gain, at, [[0, 0.0001], [0.004, 0.09, 'lin'], [0.08, 0.0001]]);
    o.connect(g).connect(dest);
    o.start(at);
    o.stop(at + 0.09);
  });
  return 0.6;
}

// ── Trench run ──────────────────────────────────────────────────────────────
function torpedoRaw(acIn, destIn) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime;
  const o = ac.createOscillator();
  o.type = 'sawtooth';
  env(o.frequency, t, [[0, 880], [0.45, 140]]);
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  env(f.frequency, t, [[0, 4000], [0.45, 600]]);
  const g = ac.createGain();
  env(g.gain, t, [[0, 0.0001], [0.01, 0.3, 'lin'], [0.5, 0.0001]]);
  o.connect(f).connect(g).connect(dest);
  o.start(t);
  o.stop(t + 0.55);
  const n = noiseSource(ac, 'white', 1);
  const nf = ac.createBiquadFilter();
  nf.type = 'bandpass';
  nf.frequency.value = 900;
  const ng = ac.createGain();
  env(ng.gain, t, [[0, 0.0001], [0.01, 0.35, 'lin'], [0.4, 0.0001]]);
  n.connect(nf).connect(ng).connect(dest);
  n.start(t);
  n.stop(t + 0.45);
  return 0.55;
}

function hitRaw(acIn, destIn) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime;
  const s = ac.createOscillator();
  env(s.frequency, t, [[0, 120], [0.3, 45]]);
  const sg = ac.createGain();
  env(sg.gain, t, [[0, 0.0001], [0.01, 0.7, 'lin'], [0.4, 0.0001]]);
  s.connect(sg).connect(dest);
  s.start(t);
  s.stop(t + 0.45);
  const n = noiseSource(ac, 'brown', 1);
  const ng = ac.createGain();
  env(ng.gain, t, [[0, 0.0001], [0.01, 0.6, 'lin'], [0.35, 0.0001]]);
  n.connect(ng).connect(dest);
  n.start(t);
  n.stop(t + 0.4);
  return 0.45;
}

// A fighter screaming past, Doppler and all.
function flybyRaw(acIn, destIn) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime;
  const pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
  if (pan) env(pan.pan, t, [[0, -0.9], [1.4, 0.9, 'lin']]);
  const g = ac.createGain();
  env(g.gain, t, [[0, 0.0001], [0.55, 0.5, 'lin'], [1.4, 0.0001]]);
  (pan ? g.connect(pan) : g).connect(dest);
  const scream = noiseSource(ac, 'white', 2);
  for (const [fq, q] of [
    [820, 6],
    [2300, 5],
  ]) {
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    env(f.frequency, t, [[0, fq * 0.75], [0.55, fq * 1.25], [1.4, fq * 0.6]]);
    f.Q.value = q;
    scream.connect(f).connect(g);
  }
  const tone = ac.createOscillator();
  tone.type = 'sawtooth';
  env(tone.frequency, t, [[0, 140], [0.55, 210], [1.4, 95]]);
  const toneG = ac.createGain();
  toneG.gain.value = 0.18;
  tone.connect(toneG).connect(g);
  scream.start(t);
  scream.stop(t + 1.45);
  tone.start(t);
  tone.stop(t + 1.45);
  return 1.45;
}

// ── Middle-earth ───────────────────────────────────────────────────────────
// Stone doors grinding open: low, rough noise that drags, then settles.
function stoneRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const out = bus(ac, dest, 0.45, 0.7);
  const grind = noiseSource(ac, 'brown', 4);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 0.9;
  env(bp.frequency, t, [[0, 180], [1.4, 320, 'lin'], [3, 140, 'lin']]);
  const g = ac.createGain();
  env(g.gain, t, [[0, 0.0001], [0.3, 0.9, 'lin'], [2.4, 0.7, 'lin'], [3.2, 0.0001]]);
  // the drag is uneven: a slow wobble on the level
  const lfo = ac.createOscillator();
  lfo.frequency.value = 7;
  const lfoG = ac.createGain();
  lfoG.gain.value = 0.25;
  lfo.connect(lfoG).connect(g.gain);
  grind.connect(bp).connect(g).connect(out);
  const thud = ac.createOscillator();
  thud.type = 'sine';
  env(thud.frequency, t + 3, [[0, 70], [0.4, 38]]);
  const tg = ac.createGain();
  env(tg.gain, t + 3, [[0, 0.0001], [0.02, 0.8, 'lin'], [0.7, 0.0001]]);
  thud.connect(tg).connect(out);
  grind.start(t);
  grind.stop(t + 3.3);
  lfo.start(t);
  lfo.stop(t + 3.3);
  thud.start(t + 3);
  thud.stop(t + 3.8);
  return 3.8;
}

// One beat of the drums in the deep: a huge, slow skin.
function drumRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const out = bus(ac, dest, 0.55, 0.8);
  const o = ac.createOscillator();
  o.type = 'sine';
  env(o.frequency, t, [[0, 92], [0.5, 44]]);
  const g = ac.createGain();
  env(g.gain, t, [[0, 0.0001], [0.01, 0.9, 'lin'], [1.1, 0.0001]]);
  o.connect(g).connect(out);
  const skin = noiseSource(ac, 'brown', 1);
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 300;
  const sg = ac.createGain();
  env(sg.gain, t, [[0, 0.0001], [0.01, 0.5, 'lin'], [0.3, 0.0001]]);
  skin.connect(lp).connect(sg).connect(out);
  o.start(t);
  o.stop(t + 1.2);
  skin.start(t);
  skin.stop(t + 0.35);
  return 1.2;
}

// The Balrog: a growl of fire and shadow.
function roarRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const out = bus(ac, dest, 0.4, 0.6);
  const growl = ac.createOscillator();
  growl.type = 'sawtooth';
  env(growl.frequency, t, [[0, 48], [0.6, 62, 'lin'], [2, 40, 'lin']]);
  const shaper = ac.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 4);
  }
  shaper.curve = curve;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  env(lp.frequency, t, [[0, 300], [0.5, 900, 'lin'], [2, 250, 'lin']]);
  const g = ac.createGain();
  env(g.gain, t, [[0, 0.0001], [0.25, 0.5, 'lin'], [1.4, 0.4, 'lin'], [2.1, 0.0001]]);
  growl.connect(shaper).connect(lp).connect(g).connect(out);
  const breath = noiseSource(ac, 'white', 3);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.2;
  env(bp.frequency, t, [[0, 500], [0.6, 1400, 'lin'], [2, 400, 'lin']]);
  const bg = ac.createGain();
  env(bg.gain, t, [[0, 0.0001], [0.3, 0.35, 'lin'], [2.1, 0.0001]]);
  breath.connect(bp).connect(bg).connect(out);
  growl.start(t);
  growl.stop(t + 2.2);
  breath.start(t);
  breath.stop(t + 2.2);
  return 2.2;
}

// Stone breaking and falling away into the dark.
function crumbleRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const out = bus(ac, dest, 0.5, 0.7);
  for (let i = 0; i < 9; i++) {
    const at = t + i * 0.09 + Math.random() * 0.05;
    const n = noiseSource(ac, 'white', 1);
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2400 - i * 200;
    const g = ac.createGain();
    env(g.gain, at, [[0, 0.0001], [0.005, 0.45 - i * 0.03, 'lin'], [0.16, 0.0001]]);
    n.connect(f).connect(g).connect(out);
    n.start(at);
    n.stop(at + 0.2);
  }
  const fall = noiseSource(ac, 'brown', 3);
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  env(lp.frequency, t, [[0, 700], [2.2, 120]]);
  const fg = ac.createGain();
  env(fg.gain, t, [[0, 0.0001], [0.1, 0.8, 'lin'], [2.4, 0.0001]]);
  fall.connect(lp).connect(fg).connect(out);
  fall.start(t);
  fall.stop(t + 2.5);
  return 2.5;
}

// The Ring meeting the fire: a hiss, then the mountain answering.
function sizzleRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const out = bus(ac, dest, 0.35, 0.6);
  const hiss = noiseSource(ac, 'white', 2);
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  env(hp.frequency, t, [[0, 5000], [1.4, 2200]]);
  const hg = ac.createGain();
  env(hg.gain, t, [[0, 0.0001], [0.04, 0.45, 'lin'], [1.6, 0.0001]]);
  hiss.connect(hp).connect(hg).connect(out);
  hiss.start(t);
  hiss.stop(t + 1.7);
  return Math.max(1.7, crumbleRaw(ac, dest, when + 0.5) + 0.5);
}

// Wearing the Ring: wind and whispering that last until it comes off.
// Returns stop(); nothing (a no-op stop) where sound can't play.
export function wraith() {
  const [ac, dest] = ready();
  if (!ac) return () => {};
  const t = ac.currentTime;
  const out = bus(ac, dest, 0.6, 0.5);
  const level = ac.createGain();
  env(level.gain, t, [[0, 0.0001], [1.2, 1, 'lin']]);
  level.connect(out);
  const wind = noiseSource(ac, 'brown', 4);
  wind.loop = true;
  const wl = ac.createBiquadFilter();
  wl.type = 'bandpass';
  wl.frequency.value = 420;
  wl.Q.value = 0.7;
  const wg = ac.createGain();
  wg.gain.value = 0.5;
  wind.connect(wl).connect(wg).connect(level);
  // whispers: sibilant noise, chopped into syllables by fast, uneven LFOs
  const hiss = noiseSource(ac, 'white', 4);
  hiss.loop = true;
  const hb = ac.createBiquadFilter();
  hb.type = 'bandpass';
  hb.frequency.value = 3200;
  hb.Q.value = 2.5;
  const hg = ac.createGain();
  hg.gain.value = 0;
  const chop = [ac.createOscillator(), ac.createOscillator()];
  chop[0].frequency.value = 5.3;
  chop[1].frequency.value = 3.1;
  const cg = ac.createGain();
  cg.gain.value = 0.06;
  chop.forEach((o) => o.connect(cg));
  cg.connect(hg.gain);
  const pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
  const sweep = ac.createOscillator();
  sweep.frequency.value = 0.13;
  if (pan) sweep.connect(pan.pan);
  hiss.connect(hb).connect(hg);
  (pan ? hg.connect(pan) : hg).connect(level);
  // a low, uneasy drone under it all
  const drone = [ac.createOscillator(), ac.createOscillator()];
  drone[0].type = drone[1].type = 'sawtooth';
  drone[0].frequency.value = 55;
  drone[1].frequency.value = 55 * 1.06;
  const dl = ac.createBiquadFilter();
  dl.type = 'lowpass';
  dl.frequency.value = 220;
  const dg = ac.createGain();
  dg.gain.value = 0.12;
  drone.forEach((o) => o.connect(dl));
  dl.connect(dg).connect(level);
  const all = [wind, hiss, ...chop, sweep, ...drone];
  all.forEach((n) => n.start(t));
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    const now = ac.currentTime;
    level.gain.cancelScheduledValues(now);
    level.gain.setTargetAtTime(0.0001, now, 0.25);
    all.forEach((n) => n.stop(now + 1.5));
  };
}

// ── The Office ─────────────────────────────────────────────────────────────
// A room applauding: a few hundred short claps, thick at first, then thinning.
function applauseRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const out = bus(ac, dest, 0.3, 0.55);
  const len = 3.2;
  const buf = noise(ac, 1, 'white');
  for (let i = 0; i < 240; i++) {
    const at = t + Math.pow(Math.random(), 1.6) * len;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900 + Math.random() * 2200;
    f.Q.value = 1.2;
    const g = ac.createGain();
    const level = (0.18 + Math.random() * 0.22) * (1 - (at - t) / (len * 1.15));
    env(g.gain, at, [[0, 0.0001], [0.002, level, 'lin'], [0.05, 0.0001]]);
    const pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
    if (pan) pan.pan.value = Math.random() * 1.6 - 0.8;
    src.connect(f).connect(g);
    (pan ? g.connect(pan) : g).connect(out);
    src.start(at, Math.random() * 0.9, 0.06);
  }
  return len;
}

// An office desk phone: two short rings of the two-tone bell.
function ringRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const out = bus(ac, dest, 0.12, 0.32);
  for (const at of [0, 0.62]) {
    const g = ac.createGain();
    g.gain.value = 0;
    // the bell's warble: on and off twenty times a second
    for (let k = 0; k < 9; k++) {
      g.gain.setValueAtTime(0.5, t + at + k * 0.05);
      g.gain.setValueAtTime(0.0001, t + at + k * 0.05 + 0.03);
    }
    for (const f of [440, 480]) {
      const o = ac.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f * 2;
      o.connect(g);
      o.start(t + at);
      o.stop(t + at + 0.46);
    }
    g.connect(out);
  }
  return 1.1;
}

// ── Avengers ────────────────────────────────────────────────────────────────
// Vibranium against a wall: a bright metallic clang that rings on.
function clangRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const out = bus(ac, dest, 0.35, 0.5);
  for (const [f, level, decay] of [
    [523, 0.35, 1.2],
    [1384, 0.22, 0.8],
    [2219, 0.14, 0.5],
    [3301, 0.08, 0.3],
  ]) {
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.value = f * (0.98 + Math.random() * 0.04);
    const g = ac.createGain();
    env(g.gain, t, [[0, 0.0001], [0.004, level, 'lin'], [decay, 0.0001]]);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + decay + 0.05);
  }
  const hit = noiseSource(ac, 'white', 1);
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 2500;
  const hg = ac.createGain();
  env(hg.gain, t, [[0, 0.0001], [0.002, 0.4, 'lin'], [0.06, 0.0001]]);
  hit.connect(hp).connect(hg).connect(out);
  hit.start(t);
  hit.stop(t + 0.08);
  return 1.25;
}

// An arrow leaving a bow: the string's twang and the shaft's hiss.
function twangRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const out = bus(ac, dest, 0.15, 0.5);
  const o = ac.createOscillator();
  o.type = 'triangle';
  env(o.frequency, t, [[0, 180], [0.25, 120]]);
  const g = ac.createGain();
  env(g.gain, t, [[0, 0.0001], [0.003, 0.5, 'lin'], [0.3, 0.0001]]);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.32);
  const whoosh = noiseSource(ac, 'white', 1);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  env(bp.frequency, t, [[0, 3000], [0.25, 1200]]);
  const wg = ac.createGain();
  env(wg.gain, t, [[0, 0.0001], [0.03, 0.25, 'lin'], [0.25, 0.0001]]);
  whoosh.connect(bp).connect(wg).connect(out);
  whoosh.start(t);
  whoosh.stop(t + 0.3);
  return 0.35;
}

// ── Cybertron ───────────────────────────────────────────────────────────────
// Megatron's fusion cannon: a charge that climbs, then a heavy blast.
function fusionRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const out = bus(ac, dest, 0.35, 0.6);
  for (const det of [-8, 8]) {
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.detune.value = det;
    env(o.frequency, t, [[0, 90], [0.42, 440]]);
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 8;
    env(f.frequency, t, [[0, 300], [0.42, 2600]]);
    const g = ac.createGain();
    env(g.gain, t, [[0, 0.0001], [0.38, 0.09, 'lin'], [0.44, 0.0001]]);
    o.connect(f).connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.46);
  }
  const at = t + 0.42;
  const low = ac.createOscillator();
  env(low.frequency, at, [[0, 160], [0.5, 38]]);
  const lg = ac.createGain();
  env(lg.gain, at, [[0, 0.0001], [0.01, 0.6, 'lin'], [0.7, 0.0001]]);
  low.connect(lg).connect(out);
  low.start(at);
  low.stop(at + 0.75);
  const n = noiseSource(ac, 'white', 2);
  const nf = ac.createBiquadFilter();
  nf.type = 'bandpass';
  nf.Q.value = 0.7;
  env(nf.frequency, at, [[0, 3200], [0.8, 300]]);
  const ng = ac.createGain();
  env(ng.gain, at, [[0, 0.0001], [0.01, 0.5, 'lin'], [0.9, 0.0001]]);
  n.connect(nf).connect(ng).connect(out);
  n.start(at);
  n.stop(at + 0.95);
  const zap = ac.createOscillator();
  zap.type = 'square';
  env(zap.frequency, at, [[0, 1400], [0.3, 220]]);
  const zg = ac.createGain();
  env(zg.gain, at, [[0, 0.0001], [0.01, 0.07, 'lin'], [0.32, 0.0001]]);
  zap.connect(zg).connect(out);
  zap.start(at);
  zap.stop(at + 0.35);
  return 1.4;
}

// A ground bridge opening: noise spun through a wobbling filter, over a hum.
function bridgeRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const out = bus(ac, dest, 0.4, 0.45);
  const n = noiseSource(ac, 'white', 2);
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 6;
  env(f.frequency, t, [[0, 300], [0.35, 1800], [0.9, 900]]);
  const lfo = ac.createOscillator();
  lfo.frequency.value = 9;
  const lfoG = ac.createGain();
  lfoG.gain.value = 260;
  lfo.connect(lfoG).connect(f.frequency);
  const g = ac.createGain();
  env(g.gain, t, [[0, 0.0001], [0.12, 0.5, 'lin'], [0.7, 0.25, 'lin'], [1, 0.0001]]);
  n.connect(f).connect(g).connect(out);
  n.start(t);
  n.stop(t + 1.05);
  lfo.start(t);
  lfo.stop(t + 1.05);
  const hum = ac.createOscillator();
  hum.type = 'triangle';
  env(hum.frequency, t, [[0, 110], [0.3, 220]]);
  const hg = ac.createGain();
  env(hg.gain, t, [[0, 0.0001], [0.2, 0.12, 'lin'], [1, 0.0001]]);
  hum.connect(hg).connect(out);
  hum.start(t);
  hum.stop(t + 1.05);
  return 1.05;
}

// Something going through the bridge: a short, bright whoosh.
function zipRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const out = bus(ac, dest, 0.25, 0.45);
  const n = noiseSource(ac, 'white', 1);
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 2.5;
  env(f.frequency, t, [[0, 900], [0.22, 5200]]);
  const g = ac.createGain();
  env(g.gain, t, [[0, 0.0001], [0.03, 0.35, 'lin'], [0.26, 0.0001]]);
  n.connect(f).connect(g).connect(out);
  n.start(t);
  n.stop(t + 0.3);
  return 0.3;
}

// An X-wing's cannons: a short falling chirp. Fired several times a second,
// so it skips the reverb bus and goes straight out.
function laserRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const o = ac.createOscillator();
  o.type = 'square';
  env(o.frequency, t, [[0, 1500], [0.11, 260]]);
  const g = ac.createGain();
  env(g.gain, t, [[0, 0.0001], [0.006, 0.07, 'lin'], [0.12, 0.0001]]);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + 0.13);
  return 0.13;
}

// A TIE fighter going up: a short crack of filtered noise.
function popRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const n = noiseSource(ac, 'white', 0.5);
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  env(f.frequency, t, [[0, 3200], [0.4, 180]]);
  const g = ac.createGain();
  env(g.gain, t, [[0, 0.0001], [0.01, 0.4, 'lin'], [0.42, 0.0001]]);
  n.connect(f).connect(g).connect(dest);
  n.start(t);
  n.stop(t + 0.45);
  return 0.45;
}

// The base's alarm: two tones, three times.
function alarmRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  for (let i = 0; i < 6; i++) {
    const o = ac.createOscillator();
    o.type = 'square';
    o.frequency.value = i % 2 ? 620 : 880;
    const g = ac.createGain();
    const at = t + i * 0.16;
    env(g.gain, at, [[0, 0.0001], [0.01, 0.06, 'lin'], [0.15, 0.0001]]);
    o.connect(g).connect(dest);
    o.start(at);
    o.stop(at + 0.16);
  }
  return 1;
}

// A wrong answer: a short low buzz.
function buzzRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const o = ac.createOscillator();
  o.type = 'sawtooth';
  o.frequency.value = 110;
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 900;
  const g = ac.createGain();
  env(g.gain, t, [[0, 0.0001], [0.01, 0.16, 'lin'], [0.22, 0.12, 'lin'], [0.3, 0.0001]]);
  o.connect(f).connect(g).connect(dest);
  o.start(t);
  o.stop(t + 0.32);
  return 0.32;
}

// A record decoded: four quick notes going up.
function decodeRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const out = bus(ac, dest, 0.2, 0.45);
  [523.25, 783.99, 1046.5, 1567.98].forEach((hz, i) => {
    const o = ac.createOscillator();
    o.type = 'triangle';
    o.frequency.value = hz;
    const g = ac.createGain();
    const at = t + i * 0.06;
    env(g.gain, at, [[0, 0.0001], [0.005, 0.18, 'lin'], [0.18, 0.0001]]);
    o.connect(g).connect(out);
    o.start(at);
    o.stop(at + 0.2);
  });
  return 0.45;
}

// ── Heritage ────────────────────────────────────────────────────────────────
// A temple bell (ghanta): bright metal, partials that aren't quite harmonic,
// two close tones beating against each other, and a long ring.
function ghantaRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const out = bus(ac, dest, 0.35, 0.5);
  const f0 = 587;
  [
    [1, 0.3, 3.2],
    [1.006, 0.22, 3.0],
    [2.32, 0.12, 2.1],
    [3.86, 0.07, 1.4],
    [5.43, 0.04, 0.9],
  ].forEach(([mul, level, decay]) => {
    const o = ac.createOscillator();
    o.frequency.value = f0 * mul;
    const g = ac.createGain();
    env(g.gain, t, [[0, 0.0001], [0.004, level, 'lin'], [decay, 0.0001]]);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + decay + 0.05);
  });
  const strike = noiseSource(ac, 'white', 1);
  const sf = ac.createBiquadFilter();
  sf.type = 'highpass';
  sf.frequency.value = 3000;
  const sg = ac.createGain();
  env(sg.gain, t, [[0, 0.0001], [0.002, 0.18, 'lin'], [0.04, 0.0001]]);
  strike.connect(sf).connect(sg).connect(out);
  strike.start(t);
  strike.stop(t + 0.05);
  return 3.2;
}

// ── The HQ games ───────────────────────────────────────────────────────────
// A single repulsor shot: a quick whine up, then the blast.
function repulseRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const out = bus(ac, dest, 0.18, 0.4);
  const whine = ac.createOscillator();
  whine.type = 'sawtooth';
  env(whine.frequency, t, [[0, 900], [0.06, 2600]]);
  const wf = ac.createBiquadFilter();
  wf.type = 'bandpass';
  wf.frequency.value = 2200;
  wf.Q.value = 2;
  const wg = ac.createGain();
  env(wg.gain, t, [[0, 0.0001], [0.03, 0.06, 'lin'], [0.08, 0.0001]]);
  whine.connect(wf).connect(wg).connect(out);
  whine.start(t);
  whine.stop(t + 0.09);
  const at = t + 0.05;
  const blast = noiseSource(ac, 'white', 0.5);
  const bf = ac.createBiquadFilter();
  bf.type = 'bandpass';
  bf.Q.value = 0.8;
  env(bf.frequency, at, [[0, 3200], [0.18, 700]]);
  const bg = ac.createGain();
  env(bg.gain, at, [[0, 0.0001], [0.006, 0.32, 'lin'], [0.2, 0.0001]]);
  blast.connect(bf).connect(bg).connect(out);
  blast.start(at);
  blast.stop(at + 0.22);
  const thump = ac.createOscillator();
  env(thump.frequency, at, [[0, 160], [0.12, 70]]);
  const tg = ac.createGain();
  env(tg.gain, at, [[0, 0.0001], [0.005, 0.22, 'lin'], [0.14, 0.0001]]);
  thump.connect(tg).connect(out);
  thump.start(at);
  thump.stop(at + 0.16);
  return 0.3;
}

// A drone going up: a crack, a short roar, a low thump.
function blastRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const out = bus(ac, dest, 0.3, 0.6);
  const n = noiseSource(ac, 'white', 1);
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  env(f.frequency, t, [[0, 5200], [0.5, 260]]);
  const g = ac.createGain();
  env(g.gain, t, [[0, 0.0001], [0.004, 0.55, 'lin'], [0.55, 0.0001]]);
  n.connect(f).connect(g).connect(out);
  n.start(t);
  n.stop(t + 0.6);
  const sub = ac.createOscillator();
  env(sub.frequency, t, [[0, 110], [0.4, 38]]);
  const sg = ac.createGain();
  env(sg.gain, t, [[0, 0.0001], [0.01, 0.5, 'lin'], [0.45, 0.0001]]);
  sub.connect(sg).connect(out);
  sub.start(t);
  sub.stop(t + 0.5);
  return 0.6;
}

// The unibeam: the chest reactor spinning up, then the beam for a second.
function unibeamRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const out = bus(ac, dest, 0.35, 0.55);
  const spin = ac.createOscillator();
  spin.type = 'triangle';
  env(spin.frequency, t, [[0, 300], [0.22, 1400]]);
  const sg = ac.createGain();
  env(sg.gain, t, [[0, 0.0001], [0.2, 0.12, 'lin'], [0.26, 0.0001]]);
  spin.connect(sg).connect(out);
  spin.start(t);
  spin.stop(t + 0.28);
  const at = t + 0.2;
  for (const [type, hz, lvl] of [
    ['sawtooth', 110, 0.16],
    ['sawtooth', 165, 0.1],
    ['square', 55, 0.12],
  ]) {
    const o = ac.createOscillator();
    o.type = type;
    env(o.frequency, at, [[0, hz * 1.4], [0.15, hz], [1.1, hz * 0.8]]);
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1800;
    const og = ac.createGain();
    env(og.gain, at, [[0, 0.0001], [0.04, lvl, 'lin'], [0.95, lvl * 0.8, 'lin'], [1.25, 0.0001]]);
    o.connect(lp).connect(og).connect(out);
    o.start(at);
    o.stop(at + 1.3);
  }
  const roar = noiseSource(ac, 'white', 2);
  const rf = ac.createBiquadFilter();
  rf.type = 'bandpass';
  rf.Q.value = 0.7;
  env(rf.frequency, at, [[0, 2400], [1.1, 900]]);
  const rg = ac.createGain();
  env(rg.gain, at, [[0, 0.0001], [0.03, 0.3, 'lin'], [0.95, 0.22, 'lin'], [1.25, 0.0001]]);
  roar.connect(rf).connect(rg).connect(out);
  roar.start(at);
  roar.stop(at + 1.3);
  return 1.5;
}

// Glass going: a bright crack, then shards ringing as they fall.
function shatterRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const out = bus(ac, dest, 0.3, 0.5);
  const crack = noiseSource(ac, 'white', 0.4);
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 2500;
  const cg = ac.createGain();
  env(cg.gain, t, [[0, 0.0001], [0.003, 0.5, 'lin'], [0.18, 0.0001]]);
  crack.connect(hp).connect(cg).connect(out);
  crack.start(t);
  crack.stop(t + 0.2);
  for (let i = 0; i < 9; i++) {
    const at = t + 0.03 + Math.random() * 0.45;
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.value = 3000 + Math.random() * 4500;
    const g = ac.createGain();
    env(g.gain, at, [[0, 0.0001], [0.002, 0.05 + Math.random() * 0.05, 'lin'], [0.12 + Math.random() * 0.2, 0.0001]]);
    o.connect(g).connect(out);
    o.start(at);
    o.stop(at + 0.35);
  }
  return 0.6;
}

// Two quick high chirps: something is charging up.
function warnRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  for (const k of [0, 0.11]) {
    const o = ac.createOscillator();
    o.type = 'square';
    o.frequency.value = 1760;
    const g = ac.createGain();
    env(g.gain, t + k, [[0, 0.0001], [0.005, 0.05, 'lin'], [0.07, 0.0001]]);
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 4000;
    o.connect(f).connect(g).connect(dest);
    o.start(t + k);
    o.stop(t + k + 0.08);
  }
  return 0.2;
}

// A bow coming to full draw: the limbs and string creaking under load.
function creakRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const out = bus(ac, dest, 0.08, 0.35);
  const n = noiseSource(ac, 'brown', 1);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 9;
  env(bp.frequency, t, [[0, 260], [0.6, 520]]);
  const g = ac.createGain();
  env(g.gain, t, [[0, 0.0001], [0.12, 0.5, 'lin'], [0.55, 0.32, 'lin'], [0.7, 0.0001]]);
  // the creak's grain: a slow tremolo
  const lfo = ac.createOscillator();
  lfo.frequency.value = 23;
  const depth = ac.createGain();
  depth.gain.value = 0.18;
  lfo.connect(depth).connect(g.gain);
  n.connect(bp).connect(g).connect(out);
  n.start(t);
  n.stop(t + 0.72);
  lfo.start(t);
  lfo.stop(t + 0.72);
  return 0.72;
}

// An arrow into a straw boss: a dull thud with a rustle on top.
function thunkRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const out = bus(ac, dest, 0.12, 0.6);
  const o = ac.createOscillator();
  env(o.frequency, t, [[0, 150], [0.09, 70]]);
  const og = ac.createGain();
  env(og.gain, t, [[0, 0.0001], [0.002, 0.6, 'lin'], [0.14, 0.0001]]);
  o.connect(og).connect(out);
  o.start(t);
  o.stop(t + 0.16);
  const n = noiseSource(ac, 'white', 1);
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 2400;
  f.Q.value = 0.8;
  const g = ac.createGain();
  env(g.gain, t, [[0, 0.0001], [0.004, 0.28, 'lin'], [0.12, 0.0001]]);
  n.connect(f).connect(g).connect(out);
  n.start(t);
  n.stop(t + 0.14);
  return 0.18;
}

// ── the Minecraft tribute’s blocks (minecraft/sounds.js) ──
// A block broken: a dry crunch, a few grains of noise through a falling
// band, the gravel in it.
function crunchRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const out = bus(ac, dest, 0.08, 0.7);
  for (let i = 0; i < 4; i++) {
    const at = t + i * 0.035 + Math.random() * 0.015;
    const n = noiseSource(ac, 'white', 1);
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1400 - i * 220;
    f.Q.value = 1.4;
    const g = ac.createGain();
    env(g.gain, at, [[0, 0.0001], [0.003, 0.5 - i * 0.08, 'lin'], [0.07, 0.0001]]);
    n.connect(f).connect(g).connect(out);
    n.start(at, Math.random() * 0.5);
    n.stop(at + 0.09);
  }
  return 0.25;
}

// Into the water: a rush of noise under a lowpass opening and closing, and
// a bubble rising.
function splashRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const out = bus(ac, dest, 0.15, 0.6);
  const n = noiseSource(ac, 'white', 1);
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  env(lp.frequency, t, [[0, 600], [0.08, 3200], [0.5, 400]]);
  const g = ac.createGain();
  env(g.gain, t, [[0, 0.0001], [0.03, 0.5, 'lin'], [0.55, 0.0001]]);
  n.connect(lp).connect(g).connect(out);
  n.start(t);
  n.stop(t + 0.6);
  const o = ac.createOscillator();
  o.type = 'sine';
  env(o.frequency, t + 0.05, [[0, 320], [0.12, 760]]);
  const og = ac.createGain();
  env(og.gain, t + 0.05, [[0, 0.0001], [0.01, 0.12, 'lin'], [0.14, 0.0001]]);
  o.connect(og).connect(out);
  o.start(t + 0.05);
  o.stop(t + 0.22);
  return 0.6;
}

// Hurt: a short low grunt, a square falling a fifth.
function oofRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const out = bus(ac, dest, 0.05, 0.5);
  const o = ac.createOscillator();
  o.type = 'square';
  env(o.frequency, t, [[0, 220], [0.16, 147]]);
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  const g = ac.createGain();
  env(g.gain, t, [[0, 0.0001], [0.01, 0.35, 'lin'], [0.18, 0.0001]]);
  o.connect(lp).connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.2);
  return 0.2;
}

export const boom = once('boom', boomRaw);
export const superlaser = once('superlaser', superlaserRaw);
export const hyperspace = once('hyperspace', hyperspaceRaw);
export const fanfare = once('fanfare', fanfareRaw);
export const torpedo = once('torpedo', torpedoRaw);
const hitSound = once('hit', hitRaw);
export const flyby = once('flyby', flybyRaw);
export const imperial = once('imperial', imperialRaw);
export const victory = once('victory', victoryRaw);
export const saber = once('saber', saberRaw);
export const coin = once('coin', coinRaw);
export const repulsor = once('repulsor', repulsorRaw);
export const ding = once('ding', dingRaw);
export const knock = once('knock', knockRaw);
export const transform = once('transform', transformRaw);
export const thunder = once('thunder', thunderRaw);
export const beeps = once('beeps', beepsRaw);
export const oneUp = once('oneUp', oneUpRaw);
export const stone = once('stone', stoneRaw);
export const drum = once('drum', drumRaw);
export const roar = once('roar', roarRaw);
export const crumble = once('crumble', crumbleRaw);
export const sizzle = once('sizzle', sizzleRaw);
export const applause = once('applause', applauseRaw);
export const ring = once('ring', ringRaw);
export const clang = once('clang', clangRaw);
export const twang = once('twang', twangRaw);
export const fusion = once('fusion', fusionRaw);
export const bridge = once('bridge', bridgeRaw);
export const zip = once('zip', zipRaw);
export const alarm = once('alarm', alarmRaw);
export const buzz = once('buzz', buzzRaw);
export const decode = once('decode', decodeRaw);
export const ghanta = once('ghanta', ghantaRaw);
// these two fire faster than once()'s quarter second allows
// ── a mission's stinger: two low brass notes, the second a fourth up, over a
// timpani thud (the Invincible world: an episode starts, or ends) ──
function stingerRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const out = bus(ac, dest, 0.4, 0.8);
  const timp = ac.createOscillator();
  env(timp.frequency, t, [[0, 92], [0.35, 70]]);
  const timpG = ac.createGain();
  env(timpG.gain, t, [[0, 0.0001], [0.008, 0.6, 'lin'], [1.1, 0.0001]]);
  timp.connect(timpG).connect(out);
  timp.start(t);
  timp.stop(t + 1.2);
  for (const [at, hz, len] of [[t, 87.31, 0.42], [t + 0.38, 116.54, 1.3]]) {
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 1.1;
    env(f.frequency, at, [[0, 300], [0.25, 1800], [len, 400]]);
    const g = ac.createGain();
    env(g.gain, at, [[0, 0.0001], [0.06, 0.3, 'lin'], [len * 0.7, 0.26, 'lin'], [len, 0.0001]]);
    f.connect(g).connect(out);
    for (const det of [-7, 0, 7]) {
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz;
      o.detune.value = det;
      o.connect(f);
      o.start(at);
      o.stop(at + len + 0.05);
    }
  }
  return 1.8;
}
// ── the radio's crackle before a call: a few bursts of band-passed static,
// then a short tone ──
function crackleRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const out = bus(ac, dest, 0.1, 0.5);
  let at = t;
  for (let i = 0; i < 4; i++) {
    const len = 0.04 + Math.random() * 0.08;
    const n = noiseSource(ac, 'white', 1);
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1400 + Math.random() * 1200;
    f.Q.value = 2.5;
    const g = ac.createGain();
    env(g.gain, at, [[0, 0.0001], [0.004, 0.35, 'lin'], [len, 0.0001]]);
    n.connect(f).connect(g).connect(out);
    n.start(at);
    n.stop(at + len + 0.01);
    at += len + 0.03 + Math.random() * 0.06;
  }
  const o = ac.createOscillator();
  o.frequency.value = 1760;
  const og = ac.createGain();
  env(og.gain, at, [[0, 0.0001], [0.005, 0.18, 'lin'], [0.12, 0.0001]]);
  o.connect(og).connect(out);
  o.start(at);
  o.stop(at + 0.15);
  return at + 0.15 - t;
}
// ── a camera's shutter: a click, the blades, a second click ──
function shutterRaw(acIn, destIn, when = 0) {
  const [ac, dest] = ready(acIn, destIn);
  if (!ac) return 0;
  const t = ac.currentTime + when;
  const out = bus(ac, dest, 0.05, 0.6);
  for (const [at, hz, lvl] of [[t, 3200, 0.5], [t + 0.07, 2100, 0.35]]) {
    const n = noiseSource(ac, 'white', 1);
    const f = ac.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = hz;
    const g = ac.createGain();
    env(g.gain, at, [[0, 0.0001], [0.002, lvl, 'lin'], [0.03, 0.0001]]);
    n.connect(f).connect(g).connect(out);
    n.start(at);
    n.stop(at + 0.04);
  }
  const w = noiseSource(ac, 'white', 1);
  const wf = ac.createBiquadFilter();
  wf.type = 'bandpass';
  wf.frequency.value = 900;
  wf.Q.value = 4;
  const wg = ac.createGain();
  env(wg.gain, t + 0.01, [[0, 0.0001], [0.01, 0.12, 'lin'], [0.06, 0.0001]]);
  w.connect(wf).connect(wg).connect(out);
  w.start(t + 0.01);
  w.stop(t + 0.08);
  return 0.15;
}

// ── a thing knocked: a knock scaled by how hard (lib/impact.js’s gain, taken
// as given) and placed round the listener, so a crate behind you is behind
// you. The room is turned into the listener’s own frame here, rather than
// moving the context’s one listener, which other sounds share. False when
// there’s no sound to make (sound off, or before the first gesture). ──
const PLACED = { panningModel: 'equalpower', distanceModel: 'linear', maxDistance: 60 };

// `at` relative to the listener, as x right, y up, z behind
function heardFrom(at, { position, forward, up = [0, 1, 0] }) {
  const d = [0, 1, 2].map((i) => at[i] - position[i]);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const f = forward.map((a) => a / (Math.hypot(...forward) || 1));
  const r = cross(f, up);
  const rl = Math.hypot(...r);
  // (looking straight up or down: no right to speak of)
  if (!(rl > 1e-6)) return d;
  const right = r.map((a) => a / rl);
  return [dot(d, right), dot(d, cross(right, f)), -dot(d, f)];
}

export function thud({ gain, pitch = 1, at = null, listener = null, context = audioContext, destination = output } = {}) {
  const ac = context();
  const dest = ac ? destination() : null;
  if (!ac || !dest || !(gain > 0)) return false;
  const t = ac.currentTime + 0.005;
  let out = dest;
  if (at && listener) {
    const p = ac.createPanner();
    Object.assign(p, PLACED);
    const [x, y, z] = heardFrom(at, listener);
    if (p.positionX) [p.positionX.value, p.positionY.value, p.positionZ.value] = [x, y, z];
    else p.setPosition?.(x, y, z);
    p.connect(dest);
    out = p;
  }
  // the knock: noise through a band, sharp in and quickly gone
  const n = noiseSource(ac, 'white', 1);
  const band = ac.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 1800 * pitch;
  band.Q.value = 1.2;
  const ng = ac.createGain();
  env(ng.gain, t, [[0, 0.0001], [0.004, 0.3 * gain, 'lin'], [0.09, 0.0001]]);
  n.connect(band).connect(ng).connect(out);
  n.start(t, Math.random() * 0.5);
  n.stop(t + 0.1);
  // the body: a low sine falling to half
  const o = ac.createOscillator();
  o.type = 'sine';
  env(o.frequency, t, [[0, 90 * pitch], [0.12, 45 * pitch]]);
  const og = ac.createGain();
  env(og.gain, t, [[0, 0.0001], [0.01, 0.18 * gain, 'lin'], [0.12, 0.0001]]);
  o.connect(og).connect(out);
  o.start(t);
  o.stop(t + 0.15);
  return true;
}

const every = (ms, fn) => {
  let last = -1e9;
  return (...args) => {
    const voice = voiceOf(args);
    if (voice && gainOf(voice) <= 0) return 0;
    const now = performance.now();
    if (!args[0] && now - last < ms) return 0;
    last = now;
    return voiced(fn, args, voice);
  };
};
export const laser = every(70, laserRaw);
export const stinger = once('stinger', stingerRaw);
export const crackle = once('crackle', crackleRaw);
export const shutter = once('shutter', shutterRaw);
export const pop = every(60, popRaw);
export const repulse = every(75, repulseRaw);
export const blast = every(90, blastRaw);
export const unibeam = once('unibeam', unibeamRaw);
export const warn = every(300, warnRaw);
export const shatter = once('shatter', shatterRaw);
export const creak = once('creak', creakRaw);
export const thunk = every(60, thunkRaw);
export const crunch = every(50, crunchRaw);
export const splash = once('splash', splashRaw);
export const oof = every(200, oofRaw);

// ── a sound by name, and a sound by force ──
// play(name, { gain, pitch }) → what the sound returns (its length), 0 for
// none. hit(name, force, rules) plays it at the hit law’s gain and pitch
// (lib/impact.js) and says whether it did; under the law’s threshold, or
// within its gap, nothing. `hit` with anything but a name first is still the
// heavy hit it always was (the Death Star inside, Cybertron).
const SOUNDS = {
  boom,
  superlaser,
  hyperspace,
  fanfare,
  torpedo,
  hit: hitSound,
  flyby,
  imperial,
  victory,
  saber,
  coin,
  repulsor,
  ding,
  knock,
  transform,
  thunder,
  beeps,
  oneUp,
  stone,
  drum,
  roar,
  crumble,
  sizzle,
  applause,
  ring,
  clang,
  twang,
  fusion,
  bridge,
  zip,
  alarm,
  buzz,
  decode,
  ghanta,
  laser,
  stinger,
  crackle,
  shutter,
  pop,
  repulse,
  blast,
  unibeam,
  warn,
  shatter,
  creak,
  thunk,
  crunch,
  splash,
  oof,
};

export function play(name, voice) {
  const sound = Object.hasOwn(SOUNDS, name) ? SOUNDS[name] : null;
  if (!sound) return 0;
  return voice ? sound(voice) : sound();
}

export function hit(...args) {
  if (typeof args[0] !== 'string') return hitSound(...args);
  const [name, force, rules = createImpacts()] = args;
  const r = rules.hit(force, name);
  if (!r) return false;
  return play(name, { gain: r.gain, pitch: r.pitch }) > 0;
}
