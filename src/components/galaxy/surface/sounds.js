// A world's sound, made rather than recorded (Web Audio, through the site's
// one context and its sound setting, lib/audio): the air (wind over the
// sand or the snow, gusting; rain; the sea's swell; lava's low roar; a
// city's hum; frogs and insects in a swamp or a jungle), your footsteps on
// whatever's underfoot, and a speeder's whine rising with its speed.
//
// site.sound: { wind 0…1, rain, sea, lava, city, critters (0…1 each),
// ground: 'sand' | 'snow' | 'grass' | 'stone' | 'metal' | 'mud' }

import { audioContext, output } from '../../../lib/audio';

let noiseBuf = null;
function noise(ac) {
  if (noiseBuf) return noiseBuf;
  const len = ac.sampleRate * 2;
  noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  // (brown-ish: each sample a step from the last, so it rumbles rather than hisses)
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.04 * white) / 1.04;
    d[i] = last * 3.5 + white * 0.15;
  }
  return noiseBuf;
}

function loop(ac, out, { type = 'lowpass', freq = 500, q = 0.7, gain = 0.1 }) {
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  src.loop = true;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ac.createGain();
  g.gain.value = 0;
  src.connect(f).connect(g).connect(out);
  src.start();
  g.gain.setTargetAtTime(gain, ac.currentTime, 1.2);
  return { src, f, g, base: gain };
}

const STEP = { sand: [900, 0.06, 0.05], snow: [1800, 0.09, 0.07], grass: [1200, 0.05, 0.05], stone: [2500, 0.04, 0.03], metal: [3200, 0.05, 0.02], mud: [500, 0.07, 0.09] };

export function createSounds(site) {
  const s = site.sound ?? {};
  let ac = null;
  let out = null;
  let layers = [];
  let hum = null;
  let started = false;
  let t = 0;
  let nextCritter = 2;

  const start = () => {
    if (started) return;
    ac = audioContext();
    out = ac && output();
    if (!ac || !out) return;
    started = true;
    const bus = ac.createGain();
    bus.gain.value = 0.9;
    bus.connect(out);
    out = bus;
    if (s.wind) layers.push({ kind: 'wind', ...loop(ac, out, { type: 'bandpass', freq: 420, q: 0.6, gain: 0.07 * s.wind }) });
    if (s.rain) layers.push({ kind: 'rain', ...loop(ac, out, { type: 'highpass', freq: 2400, q: 0.3, gain: 0.05 * s.rain }) });
    if (s.sea) layers.push({ kind: 'sea', ...loop(ac, out, { type: 'lowpass', freq: 700, q: 0.4, gain: 0.08 * s.sea }) });
    if (s.lava) layers.push({ kind: 'lava', ...loop(ac, out, { type: 'lowpass', freq: 160, q: 1.2, gain: 0.16 * s.lava }) });
    if (s.city) layers.push({ kind: 'city', ...loop(ac, out, { type: 'bandpass', freq: 240, q: 2, gain: 0.05 * s.city }) });
  };

  // a footstep: a short burst of filtered noise, its colour the ground's
  const step = (loud = 1) => {
    if (!started) return;
    const [freq, len, gain] = STEP[s.ground ?? 'sand'] ?? STEP.sand;
    const now = ac.currentTime;
    const src = ac.createBufferSource();
    src.buffer = noise(ac);
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq * (0.85 + Math.random() * 0.3);
    f.Q.value = 1.2;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain * loud, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + len);
    src.connect(f).connect(g).connect(out);
    src.start(now, Math.random());
    src.stop(now + len + 0.05);
  };

  // a chirp or a croak (a jungle's, a swamp's), now and then
  const critter = () => {
    const now = ac.currentTime;
    const o = ac.createOscillator();
    const g = ac.createGain();
    const frog = Math.random() < 0.4;
    o.type = frog ? 'sawtooth' : 'sine';
    const f0 = frog ? 90 + Math.random() * 60 : 2200 + Math.random() * 2400;
    o.frequency.setValueAtTime(f0, now);
    o.frequency.exponentialRampToValueAtTime(f0 * (frog ? 0.8 : 1.4), now + (frog ? 0.25 : 0.08));
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.02 * s.critters, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + (frog ? 0.3 : 0.12));
    o.connect(g).connect(out);
    o.start(now);
    o.stop(now + 0.35);
  };

  // a blaster shot: a falling zap, with a crack of noise under it
  const blast = () => {
    if (!started) return;
    const now = ac.currentTime;
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(1800, now);
    o.frequency.exponentialRampToValueAtTime(140, now + 0.18);
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1200;
    f.Q.value = 0.8;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.09, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    o.connect(f).connect(g).connect(out);
    o.start(now);
    o.stop(now + 0.25);
  };

  return {
    start,
    step,
    blast,
    // each frame: the wind gusting, the sea swelling, the speeder's whine
    update(dt, { riding = 0, wind = 1 } = {}) {
      if (!started) return;
      t += dt;
      for (const l of layers) {
        if (l.kind === 'wind') {
          const gust = 0.55 + 0.45 * Math.sin(t * 0.21) * Math.sin(t * 0.13 + 1);
          l.g.gain.setTargetAtTime(l.base * gust * wind, ac.currentTime, 0.4);
          l.f.frequency.setTargetAtTime(300 + gust * 400, ac.currentTime, 0.5);
        } else if (l.kind === 'sea') l.g.gain.setTargetAtTime(l.base * (0.45 + 0.55 * Math.max(0, Math.sin(t * 0.5))), ac.currentTime, 0.6);
      }
      if (s.critters && t > nextCritter) {
        critter();
        nextCritter = t + 0.3 + Math.random() * 3;
      }
      // the speeder: a saw through a filter, up with the speed
      if (riding > 0.5 && !hum) {
        const o = ac.createOscillator();
        o.type = 'sawtooth';
        const f = ac.createBiquadFilter();
        f.type = 'lowpass';
        f.Q.value = 3;
        const g = ac.createGain();
        g.gain.value = 0;
        o.connect(f).connect(g).connect(out);
        o.start();
        hum = { o, f, g };
      }
      if (hum) {
        const k = Math.min(1, riding / 40);
        hum.o.frequency.setTargetAtTime(60 + k * 160, ac.currentTime, 0.1);
        hum.f.frequency.setTargetAtTime(400 + k * 1800, ac.currentTime, 0.1);
        hum.g.gain.setTargetAtTime(riding > 0.5 ? 0.03 + k * 0.04 : 0, ac.currentTime, 0.2);
      }
    },
    dispose() {
      for (const l of layers) {
        l.g.gain.setTargetAtTime(0, ac.currentTime, 0.2);
        l.src.stop(ac.currentTime + 1);
      }
      layers = [];
      if (hum) {
        hum.g.gain.setTargetAtTime(0, ac.currentTime, 0.1);
        hum.o.stop(ac.currentTime + 0.5);
        hum = null;
      }
    },
  };
}
