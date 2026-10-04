// The universe map's sounds: each ship's engine, which follows its speed;
// a voice for each of the crew under the lines that have no recording of
// their own (Chewie's real roars and laughs; blips in the rhythm of the line
// for the rest, and Artoo's chirps); each ship's shot (Han's DL-44, the
// portal gun, the X-wing's laser); and a sound bite when you reach a world,
// from the site's own clips where it has one. All through the site's master
// volume, so the sound setting mutes them. Plain functions: the scene drives the engine each frame and the
// comms box calls the rest.

import { audioContext, output } from '../../lib/audio';
import { playClip } from '../../lib/clips';

let noiseBuf = null;
function noise(ac) {
  if (noiseBuf) return noiseBuf;
  const n = ac.sampleRate * 2;
  noiseBuf = ac.createBuffer(1, n, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

const ENGINES = {
  // a jet's whine over a low drone, both rising with the speed
  xwing: { waves: ['sawtooth', 'sawtooth'], base: 92, per: 15, detune: 1.013, filter: ['bandpass', 700, 70], air: [2600, 0.05], gain: 0.13 },
  // a deep rumble, brighter when she's pushed
  falcon: { waves: ['sawtooth', 'sine'], base: 46, per: 6, detune: 0.5, filter: ['lowpass', 260, 90], air: [420, 0.12], gain: 0.2 },
  // a warbling hum, as a garage-built spaceship would make
  cruiser: { waves: ['sine', 'triangle'], base: 150, per: 18, detune: 2.01, filter: ['lowpass', 1400, 120], air: [900, 0.025], gain: 0.12, wobble: 7 },
};

// A running engine: set({ speed, boost, on }) every frame, stop() at the end.
export function shipEngine(kind) {
  const spec = ENGINES[kind];
  const ac = audioContext();
  const out = ac ? output() : null;
  if (!spec || !ac || !out) return { set() {}, stop() {} };
  const t = ac.currentTime;
  const master = ac.createGain();
  master.gain.value = 0;
  master.connect(out);
  const filter = ac.createBiquadFilter();
  filter.type = spec.filter[0];
  filter.frequency.value = spec.filter[1];
  filter.Q.value = spec.filter[0] === 'bandpass' ? 0.9 : 1.2;
  filter.connect(master);
  const oscs = spec.waves.map((type, i) => {
    const o = ac.createOscillator();
    o.type = type;
    const g = ac.createGain();
    g.gain.value = i ? 0.5 : 0.8;
    o.connect(g).connect(filter);
    return o;
  });
  let lfo = null;
  if (spec.wobble) {
    lfo = ac.createOscillator();
    lfo.frequency.value = spec.wobble;
    const depth = ac.createGain();
    depth.gain.value = spec.base * 0.08;
    lfo.connect(depth);
    for (const o of oscs) depth.connect(o.frequency);
  }
  const air = ac.createBufferSource();
  air.buffer = noise(ac);
  air.loop = true;
  const airF = ac.createBiquadFilter();
  airF.type = 'bandpass';
  airF.frequency.value = spec.air[0];
  airF.Q.value = 0.7;
  const airG = ac.createGain();
  airG.gain.value = 0;
  air.connect(airF).connect(airG).connect(master);
  [...oscs, air, lfo].forEach((n) => n?.start(t));
  let alive = true;
  return {
    set({ speed = 0, boost = false, on = true }) {
      if (!alive) return;
      const now = ac.currentTime;
      const s = Math.abs(speed);
      const f = spec.base + s * spec.per + (boost ? spec.per * 3 : 0);
      oscs[0].frequency.setTargetAtTime(f, now, 0.12);
      oscs[1].frequency.setTargetAtTime(f * spec.detune, now, 0.12);
      filter.frequency.setTargetAtTime(spec.filter[1] + s * spec.filter[2] + (boost ? 600 : 0), now, 0.15);
      airG.gain.setTargetAtTime(spec.air[1] * Math.min(1.5, s / 3) * (boost ? 2 : 1), now, 0.15);
      // a low idle when parked, louder as she goes
      master.gain.setTargetAtTime(on ? spec.gain * (0.35 + 0.65 * Math.min(1, s / 3)) : 0, now, 0.2);
    },
    stop() {
      if (!alive) return;
      alive = false;
      const now = ac.currentTime;
      master.gain.setTargetAtTime(0, now, 0.08);
      [...oscs, air, lfo].forEach((n) => n?.stop(now + 0.5));
      setTimeout(() => master.disconnect(), 700);
    },
  };
}

function blip(ac, out, { type, f, at, dur, gain, glide = 1, filter = 0 }) {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, at);
  o.frequency.exponentialRampToValueAtTime(Math.max(30, f * glide), at + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + Math.min(0.015, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  let node = o.connect(g);
  if (filter) {
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = filter;
    node = node.connect(lp);
  }
  node.connect(out);
  o.start(at);
  o.stop(at + dur + 0.05);
}

const VOICES = {
  rick: { type: 'sawtooth', f: 125, spread: 0.3, syl: 0.075, gain: 0.05, filter: 900 },
  morty: { type: 'square', f: 255, spread: 0.4, syl: 0.06, gain: 0.03, filter: 1800 },
  luke: { type: 'triangle', f: 215, spread: 0.18, syl: 0.075, gain: 0.07 },
  han: { type: 'sawtooth', f: 150, spread: 0.16, syl: 0.085, gain: 0.045, filter: 1100 },
};

// Someone says a line. Returns about how long it takes, in ms.
export function speak(voice, text) {
  const ac = audioContext();
  const out = ac ? output() : null;
  const words = text.replace(/\[|\]/g, '').split(/\s+/).filter(Boolean).length;
  if (!ac || !out) return 600 + words * 260;
  const t = ac.currentTime + 0.02;
  if (voice === 'r2') {
    // Artoo: a run of whistles and chirps
    const n = 6 + Math.floor(Math.random() * 6);
    let at = t;
    for (let i = 0; i < n; i++) {
      const dur = 0.04 + Math.random() * 0.1;
      const f = 900 + Math.random() * 1900;
      blip(ac, out, { type: 'sine', f, at, dur, gain: 0.06, glide: 0.6 + Math.random() * 1.2 });
      at += dur + Math.random() * 0.05;
    }
    return (at - t) * 1000 + 300;
  }
  if (voice === 'chewie') {
    // Chewie himself: a laugh when it's a laugh, a roar the rest of the time
    const laugh = /laugh/i.test(text);
    playClip(laugh ? 'chewieLaugh' : 'chewieRoar').then((h) => h || growl(ac, out, t));
    return laugh ? 2700 : 1700;
  }
  const v = VOICES[voice];
  if (!v) return 600 + words * 260;
  // a blip a syllable (roughly), pitched up at a question
  const n = Math.min(22, Math.max(3, Math.round(text.length / 4)));
  const ask = /\?\s*$/.test(text);
  let at = t;
  for (let i = 0; i < n; i++) {
    const rise = ask && i > n - 3 ? 1.25 : 1;
    const f = v.f * rise * (1 + (Math.random() - 0.5) * v.spread);
    blip(ac, out, { type: v.type, f, at, dur: v.syl * (0.8 + Math.random() * 0.5), gain: v.gain, glide: 0.92, filter: v.filter });
    at += v.syl * (1 + Math.random() * 0.4) + (i % 4 === 3 ? 0.06 : 0);
  }
  return (at - t) * 1000 + 450;
}

// Chewie's growl, made up: in case his recording won't play
function growl(ac, out, t) {
  const dur = 0.9;
  const o = ac.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(120, t);
  o.frequency.linearRampToValueAtTime(190, t + dur * 0.35);
  o.frequency.linearRampToValueAtTime(95, t + dur);
  const vib = ac.createOscillator();
  vib.frequency.value = 22;
  const vibG = ac.createGain();
  vibG.gain.value = 14;
  vib.connect(vibG).connect(o.frequency);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 700;
  bp.Q.value = 1.6;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.16, t + 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const breath = ac.createBufferSource();
  breath.buffer = noise(ac);
  const bg = ac.createGain();
  bg.gain.value = 0.25;
  breath.connect(bg).connect(bp);
  o.connect(bp).connect(g).connect(out);
  [o, vib, breath].forEach((n) => {
    n.start(t);
    n.stop(t + dur + 0.05);
  });
}

function tones(list, { type = 'square', gain = 0.05 } = {}) {
  const ac = audioContext();
  const out = ac ? output() : null;
  if (!ac || !out) return;
  const t = ac.currentTime + 0.02;
  for (const [f, at, dur] of list) blip(ac, out, { type, f, at: t + at, dur, gain });
}

function whoosh(dur, from, to, gain) {
  const ac = audioContext();
  const out = ac ? output() : null;
  if (!ac || !out) return;
  const t = ac.currentTime;
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1.1;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t);
  src.stop(t + dur + 0.05);
}

// A portal opening: a rising swirl
export function portalSound() {
  whoosh(0.8, 250, 1800, 0.14);
  tones(
    [
      [220, 0, 0.6],
      [330, 0.08, 0.6],
    ],
    { type: 'sine', gain: 0.05 },
  );
}

// Reaching a world: its sound bite. The site's clip where there is one,
// otherwise something made for it. Resolves when it has played (roughly),
// so the crew can talk after it.
const ARRIVE = {
  starwars: { clip: 'vader' },
  music: { clip: 'tanpura', duration: 3 },
  middleearth: { clip: 'lotr', duration: 5 },
  transformers: { clip: 'transform' },
  marvel: { clip: 'snap' },
  breakingbad: { clip: 'sayMyName' },
  office: { clip: 'twss' },
  rickmorty: { clip: 'pickleRick' },
  gaming: {
    // the Game Boy's startup ding
    play: () =>
      tones([
        [1047, 0, 0.09],
        [2093, 0.09, 0.5],
      ]),
    ms: 700,
  },
  travel: {
    // an airport chime
    play: () =>
      tones(
        [
          [784, 0, 0.5],
          [988, 0.35, 0.5],
          [1175, 0.7, 0.8],
        ],
        { type: 'sine', gain: 0.07 },
      ),
    ms: 1400,
  },
  caribbean: { clip: 'pirates', duration: 6 },
};

// docking at one of the stations: two soft tones, up
const DOCK = {
  play: () =>
    tones(
      [
        [659, 0, 0.35],
        [988, 0.16, 0.6],
      ],
      { type: 'sine', gain: 0.06 },
    ),
  ms: 700,
};

export async function arrivalSound(id) {
  const a = ARRIVE[id] ?? DOCK;
  if (a.play) {
    a.play();
    await new Promise((r) => setTimeout(r, a.ms));
    return;
  }
  const h = await playClip(a.clip, a.duration ? { duration: a.duration } : undefined);
  if (h) await Promise.race([h.ended, new Promise((r) => setTimeout(r, (a.duration ?? 6) * 1000))]);
}

// A burst of speed, each ship its own way
export function boostSound(kind, first) {
  if (kind === 'falcon' && first) playClip('hyperspaceEnter', { duration: 2.6 });
  else if (kind === 'cruiser') whoosh(0.35, 2400, 500, 0.16);
  else whoosh(0.7, 200, 2600, 0.2);
}

// A shot: Han's DL-44 from the Falcon, the portal gun from the cruiser, a
// laser from the X-wing
export function fireSound(kind) {
  if (kind === 'falcon') playClip('dl44', { gain: 0.8 });
  else if (kind === 'cruiser') playClip('portalGun', { gain: 0.8, duration: 1.4 });
  else {
    const ac = audioContext();
    const out = ac ? output() : null;
    if (!ac || !out) return;
    const t = ac.currentTime + 0.01;
    blip(ac, out, { type: 'sawtooth', f: 1800, at: t, dur: 0.16, gain: 0.07, glide: 0.25, filter: 3000 });
    blip(ac, out, { type: 'square', f: 1200, at: t + 0.02, dur: 0.12, gain: 0.04, glide: 0.3, filter: 2500 });
  }
}

// Off the side of a planet
export const bumpSound = () => {
  tones([[140, 0, 0.18]], { type: 'sawtooth', gain: 0.08 });
  whoosh(0.2, 300, 120, 0.12);
};
