// Cinema sound effects, synthesised with Web Audio: nothing to download.
// Every function takes an optional context and destination so the same code can
// be rendered offline for testing; by default it plays through the site's
// master volume (which respects the sound setting).
//
// All of these are original sounds, built from noise, oscillators and filters.

import { audioContext, output } from './audio';

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
  let per = noiseCache.get(ac);
  if (!per) noiseCache.set(ac, (per = new Map()));
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
function hall(ac, seconds = 3) {
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

// The same sound asked for twice within a quarter second plays once (React's
// development mode runs effects twice; a double-click shouldn't double a boom).
const lastPlayed = new Map();
const once = (name, fn) =>
  function play(ac, ...rest) {
    if (!ac) {
      const now = performance.now();
      if (now - (lastPlayed.get(name) ?? -1e9) < 250) return 0;
      lastPlayed.set(name, now);
    }
    return fn(ac, ...rest);
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

export const boom = once('boom', boomRaw);
export const superlaser = once('superlaser', superlaserRaw);
export const hyperspace = once('hyperspace', hyperspaceRaw);
export const fanfare = once('fanfare', fanfareRaw);
export const torpedo = once('torpedo', torpedoRaw);
export const hit = once('hit', hitRaw);
export const flyby = once('flyby', flybyRaw);
export const imperial = once('imperial', imperialRaw);
export const victory = once('victory', victoryRaw);
