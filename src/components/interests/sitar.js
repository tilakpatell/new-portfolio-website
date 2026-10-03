// A small sitar, synthesised in the browser. Each note is a Karplus-Strong
// plucked string (a noise burst fed through a tuned, slightly lossy delay line)
// that starts a touch sharp and settles, the way the curved jawari bridge pulls
// a sitar's pitch. A gentle asymmetric saturation adds the bridge's buzz and an
// octave shimmer stands in for the sympathetic strings. Notes are rendered once,
// on first use, and cached.

// Sargam over Sa = C♯3, the way many sitars are tuned. Just intonation, Bilawal thaat.
export const NOTES = [
  { name: 'Sa', ratio: 1 },
  { name: 'Re', ratio: 9 / 8 },
  { name: 'Ga', ratio: 5 / 4 },
  { name: 'Ma', ratio: 4 / 3 },
  { name: 'Pa', ratio: 3 / 2 },
  { name: 'Dha', ratio: 5 / 3 },
  { name: 'Ni', ratio: 15 / 8 },
  { name: 'Sa’', ratio: 2 },
];
const SA = 138.59;

let ctx = null;
let out = null;
const cache = new Map();

function context() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    // A little nasal presence and a soft overall level.
    const presence = ctx.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.value = 2400;
    presence.Q.value = 0.9;
    presence.gain.value = 5;
    const level = ctx.createGain();
    level.gain.value = 0.55;
    presence.connect(level).connect(ctx.destination);
    out = presence;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function karplus(sr, freq, seconds, brightness, seed) {
  const n = Math.floor(sr * seconds);
  const y = new Float32Array(n);
  const period = sr / freq;
  const burst = Math.ceil(period);
  let s = seed;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s / 2147483647) * 2 - 1;
  };
  let lp = 0;
  for (let i = 0; i < burst && i < n; i++) {
    lp = lp * 0.4 + rand() * 0.6; // a plectrum (mizrab) is brighter than a finger
    y[i] = lp;
  }
  for (let i = burst; i < n; i++) {
    const t = i / sr;
    const p = period / (1 + 0.007 * Math.exp(-t * 6)); // starts sharp, settles
    const pos = i - p;
    const k = Math.floor(pos);
    const f = pos - k;
    if (k < 1) continue; // the delay line isn't full yet
    const a = y[k] * (1 - f) + y[k + 1] * f;
    const b = y[k - 1] * (1 - f) + y[k] * f;
    y[i] = 0.9985 * ((1 - brightness) * a + brightness * b);
  }
  return y;
}

function render(ac, freq) {
  const sr = ac.sampleRate;
  const seconds = 3.4;
  const main = karplus(sr, freq, seconds, 0.32, Math.round(freq * 97));
  const shimmer = karplus(sr, freq * 2, seconds, 0.45, Math.round(freq * 31));
  const buf = ac.createBuffer(1, main.length, sr);
  const data = buf.getChannelData(0);
  let peak = 0;
  let dc = 0;
  for (let i = 0; i < main.length; i++) {
    const delayed = i > 1300 ? shimmer[i - 1300] : 0;
    let v = main[i] + 0.14 * delayed;
    v = v + 0.22 * v * v; // the jawari buzz: even harmonics
    dc = dc * 0.999 + v * 0.001; // and take the offset that adds back out
    v -= dc;
    const fadeIn = Math.min(1, i / 64);
    data[i] = v * fadeIn;
    peak = Math.max(peak, Math.abs(data[i]));
  }
  const scale = peak ? 0.85 / peak : 1;
  for (let i = 0; i < data.length; i++) data[i] *= scale;
  return buf;
}

// Plays note i (0 to 7). Returns false where Web Audio isn't available.
export function pluck(i) {
  const ac = context();
  if (!ac) return false;
  const note = NOTES[i];
  if (!note) return false;
  let buf = cache.get(i);
  if (!buf) {
    buf = render(ac, SA * note.ratio);
    cache.set(i, buf);
  }
  const src = ac.createBufferSource();
  src.buffer = buf;
  const g = ac.createGain();
  g.gain.value = 0.9;
  src.connect(g).connect(out);
  src.start();
  return true;
}
