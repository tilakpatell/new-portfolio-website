// Lothlórien's sounds, synthesised so nothing is downloaded: leaves and
// birdsong in the golden wood by day, the elves' high singing at night,
// the river under the boat; bows drawn, a chime for the Lady's things,
// the Eye in the water and her temptation, a rock under the hull, and a
// horn for the Kings; and at Legolas's targets, the bow drawn and let go,
// and where the arrow ends. All through the site's master volume.

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
function tone(ac, out, t, { type = 'sine', f = 440, to = null, gain = 0.2, attack = 0.005, length = 0.3, vibrato = 0 }) {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + length);
  let lfo = null;
  if (vibrato) {
    lfo = ac.createOscillator();
    lfo.frequency.value = 5.2;
    const depth = ac.createGain();
    depth.gain.value = f * vibrato;
    lfo.connect(depth).connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + length + 0.05);
  }
  const g = ac.createGain();
  env(g.gain, t, [[0, 0.0001], [attack, gain], [length, 0.0001]]);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + length + 0.05);
}
// the elves' lament: a slow line in D minor, high and far off
const LAMENT = [587, 659, 698, 659, 587, 523, 587, 440, 466, 523, 587, 0, 698, 659, 587, 554, 587];

// The wood's air. By day, leaves stirring and birds; night(1) brings the
// elves' singing in the trees; river(1) the water under the boat.
// { night, river, stop }.
export function air() {
  const [ac, out] = ready();
  if (!ac) return { night() {}, river() {}, stop() {} };
  const master = ac.createGain();
  master.gain.value = 0.0001;
  master.gain.setTargetAtTime(0.4, ac.currentTime, 1.5);
  master.connect(out);
  // leaves
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  src.loop = true;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2400;
  bp.Q.value = 0.5;
  const leaves = ac.createGain();
  leaves.gain.value = 0.035;
  src.connect(bp).connect(leaves).connect(master);
  // the river, low and running
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 700;
  const water = ac.createGain();
  water.gain.value = 0.0001;
  src.connect(lp).connect(water).connect(master);
  src.start();
  // the singing
  const voice = ac.createGain();
  voice.gain.value = 0.0001;
  const verb = ac.createDelay(1);
  verb.delayTime.value = 0.31;
  const back = ac.createGain();
  back.gain.value = 0.42;
  voice.connect(master);
  voice.connect(verb).connect(back).connect(verb);
  back.connect(master);
  let isNight = 0;
  let onRiver = 0;
  let on = true;
  let note = 0;
  const tick = () => {
    if (!on) return;
    const t = ac.currentTime + 0.05;
    if (onRiver < 0.5) {
      if (isNight < 0.5) {
        // a bird, somewhere up in the gold
        if (Math.random() < 0.55) {
          const f = 2600 + Math.random() * 1600;
          for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) tone(ac, master, t + i * 0.11, { f: f * (1 + (i % 2) * 0.12), to: f * 1.2, gain: 0.025, attack: 0.01, length: 0.08 });
        }
        bp.frequency.setTargetAtTime(1800 + Math.random() * 1600, t, 1.2);
      } else {
        // the lament, a note at a time
        const f = LAMENT[note % LAMENT.length];
        note += 1;
        if (f) {
          tone(ac, voice, t, { f, gain: 0.05, attack: 0.35, length: 1.6, vibrato: 0.006 });
          tone(ac, voice, t, { f: f / 2, gain: 0.02, attack: 0.5, length: 1.6 });
        }
      }
    }
    timer = setTimeout(tick, isNight > 0.5 && onRiver < 0.5 ? 1100 : 1400 + Math.random() * 2400);
  };
  let timer = setTimeout(tick, 700);
  return {
    night(k) {
      isNight = k;
      voice.gain.setTargetAtTime(0.9 * k + 0.0001, ac.currentTime, 1.5);
    },
    river(k) {
      onRiver = k;
      water.gain.setTargetAtTime(0.16 * k + 0.0001, ac.currentTime, 0.8);
      leaves.gain.setTargetAtTime(0.035 * (1 - k) + 0.0001, ac.currentTime, 0.8);
    },
    stop() {
      on = false;
      clearTimeout(timer);
      master.gain.setTargetAtTime(0.0001, ac.currentTime, 0.3);
      src.stop(ac.currentTime + 1);
    },
  };
}

// a soft elven chime: n notes, rising
export function chime(n = 1) {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  [880, 1109, 1319, 1760].slice(0, 1 + Math.min(3, n)).forEach((f, i) => tone(ac, out, t + i * 0.12, { f, gain: 0.06, attack: 0.01, length: 1.4 }));
}
// bows drawn, all round you
export function bows() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  for (let i = 0; i < 6; i++) hiss(ac, out, t + i * 0.07 + Math.random() * 0.05, { type: 'bandpass', f: 900 + Math.random() * 600, q: 6, gain: 0.07, attack: 0.15, length: 0.35, sweep: 1600 });
  tone(ac, out, t + 0.5, { type: 'triangle', f: 196, gain: 0.04, attack: 0.3, length: 1.6 });
}
// the Eye in the water: a low rush, and a hiss (k: 0.4 a stirring, 1 it's looking)
export function eye(k = 1) {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  hiss(ac, out, t, { type: 'lowpass', f: 180, q: 0.8, gain: 0.3 * k, attack: 0.2, length: 1.2 * k + 0.3, sweep: 600 });
  if (k > 0.5) {
    tone(ac, out, t, { type: 'sawtooth', f: 55, to: 46, gain: 0.06, attack: 0.2, length: 1.4 });
    hiss(ac, out, t + 0.1, { type: 'bandpass', f: 3000, q: 3, gain: 0.05, attack: 0.3, length: 1.2, sweep: 1400 });
  }
}
// Galadriel, terrible as the dawn: a great dark swell
export function tempt() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  for (const f of [73, 110, 147, 155]) tone(ac, out, t, { type: 'sawtooth', f, gain: 0.04, attack: 1.2, length: 4.5 });
  hiss(ac, out, t, { type: 'lowpass', f: 200, gain: 0.3, attack: 1.4, length: 4.5, sweep: 2400 });
}
// the boats pushing off
export function oars() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  for (let i = 0; i < 3; i++) hiss(ac, out, t + i * 0.7, { type: 'bandpass', f: 600, q: 0.8, gain: 0.12, attack: 0.08, length: 0.5, sweep: 300 });
}
// a rock under the hull
export function bump() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  tone(ac, out, t, { f: 90, to: 50, gain: 0.45, attack: 0.003, length: 0.3 });
  hiss(ac, out, t, { type: 'lowpass', f: 900, gain: 0.3, attack: 0.003, length: 0.25 });
  hiss(ac, out, t + 0.05, { type: 'bandpass', f: 1400, q: 0.7, gain: 0.15, attack: 0.02, length: 0.6 });
}
// the Kings: a long low horn, and the river's echo of it
export function horn() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.05;
  for (const [f, at] of [[147, 0], [220, 0.05], [196, 1.6], [294, 1.65]]) tone(ac, out, t + at, { type: 'triangle', f, gain: 0.06, attack: 0.5, length: 3 });
}

// ── Legolas's targets ──
// the bow drawn: a creak of wood and string
export function creak() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  hiss(ac, out, t, { type: 'bandpass', f: 420, q: 9, gain: 0.07, attack: 0.25, length: 0.6, sweep: 760 });
  tone(ac, out, t, { type: 'triangle', f: 140, to: 190, gain: 0.025, attack: 0.3, length: 0.6 });
}
// let go: the string's twang and the arrow's hiss away (k: how full the draw)
export function twang(k = 1) {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.005;
  tone(ac, out, t, { type: 'triangle', f: 98 + k * 40, to: 70, gain: 0.12 * (0.4 + k * 0.6), attack: 0.002, length: 0.35 });
  hiss(ac, out, t, { type: 'highpass', f: 2600, q: 0.7, gain: 0.08 * k, attack: 0.01, length: 0.4, sweep: 900 });
}
// where it ends: 'board' (and in the gold), 'trunk' or 'ground'
export function thock(into = 'board', gold = false) {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  if (into === 'ground') {
    hiss(ac, out, t, { type: 'lowpass', f: 500, gain: 0.12, attack: 0.002, length: 0.15 });
    return;
  }
  const f = into === 'trunk' ? 150 : 230;
  tone(ac, out, t, { f, to: f * 0.6, gain: 0.3, attack: 0.001, length: 0.18 });
  hiss(ac, out, t, { type: 'bandpass', f: into === 'trunk' ? 700 : 1300, q: 1.4, gain: 0.18, attack: 0.001, length: 0.12 });
  // and a ring of the string's quiver after it, in the board
  if (into === 'board') tone(ac, out, t + 0.02, { type: 'triangle', f: 330, gain: 0.03, attack: 0.005, length: 0.4, vibrato: 0.05 });
  if (gold) chime(2);
}
