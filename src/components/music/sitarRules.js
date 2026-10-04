// The sitar's rules, apart from the sound: which recording plays a note and
// how far it is retuned, the keys for the frets, where a meend goes, and how
// a phrase written in sargam falls in time. Tested in sitarRules.test.js.

import { SITAR_VARIANTS } from './sitarSamples';
import { RAGAS, SWARA } from './tuning';

// ── Which recording ────────────────────────────────────────────────────────
// The recording nearest in pitch (there is one every fourth semitone), and the
// playback rate that brings it to the note: never more than two semitones.
export function sampleFor(freq, stroke = 0) {
  let best = 0;
  let dist = Infinity;
  SITAR_VARIANTS.forEach((v, i) => {
    const d = Math.abs(Math.log2(freq / v.takes[0][2]));
    if (d < dist) {
      dist = d;
      best = i;
    }
  });
  const v = SITAR_VARIANTS[best];
  const take = v.takes[stroke % v.takes.length];
  return { variant: best, take: stroke % v.takes.length, rate: freq / take[2], at: take[0], dur: take[1] };
}

// The sitar plays an octave above the tanpura's Sa while that keeps it close
// to its recordings' middle, so it sounds where a sitar's melody sits.
export const sitarSaFor = (saHz) => (saHz * 2 <= 330 ? saHz * 2 : saHz);

// ── Keys ───────────────────────────────────────────────────────────────────
// The frets in order along the number row, then the row below it.
export const FRET_KEYS = '1234567890-=qwertyuiop[]';
export const fretForKey = (key) => FRET_KEYS.indexOf(key.toLowerCase());
export const keyForFret = (i) => FRET_KEYS[i] ?? '';

// ── Meend ──────────────────────────────────────────────────────────────────
// The next note of the raga above a ratio (in any octave): where a meend from
// that note naturally pulls to. Returns semitones above the ratio, 1 to 5.
export function meendTarget(ratio, ragaId) {
  const notes = [...RAGAS[ragaId].notes].map((s) => SWARA[s]);
  let best = Infinity;
  for (const r of notes)
    for (const k of [-2, -1, 0, 1, 2, 3]) {
      const st = 12 * Math.log2((r * 2 ** k) / ratio);
      if (st > 0.5 && st < best) best = st;
    }
  return Math.max(1, Math.min(5, best === Infinity ? 2 : best));
}

// The same note in any octave, within a quarter of a semitone.
export const sameNote = (a, b) => {
  const c = (((1200 * Math.log2(a / b)) % 1200) + 1200) % 1200;
  return c < 25 || c > 1175;
};

// The fret a ratio sounds on (for lighting it as a phrase plays), or -1.
export const fretOf = (ratio, list) => list.findIndex((f) => Math.abs(1200 * Math.log2(f.ratio / ratio)) < 30);

// ── Phrases ────────────────────────────────────────────────────────────────
// A phrase in sargam: N. is mandra Ni, S' is taar Sa, X>Y a meend from X to Y,
// X~ an andolan (a slow sway on the note), X^Y a krintan (the left hand pulls
// off to Y with no new stroke), - holds, | strikes the chikari.
export function ratioOf(tok) {
  const m = /^([SrRgGmMPdDnN])([.']?)$/.exec(tok);
  if (!m) return null;
  return SWARA[m[1]] * (m[2] === '.' ? 0.5 : m[2] === "'" ? 2 : 1);
}

export function parsePhrase(text, beat) {
  const events = [];
  let t = 0;
  for (const tok of text.trim().split(/\s+/)) {
    if (tok === '|') events.push({ t, kind: 'chikari' });
    else if (tok === '-') t += beat;
    else if (tok.includes('>')) {
      const [a, b] = tok.split('>').map(ratioOf);
      if (a) events.push({ t, kind: 'pluck', ratio: a });
      if (a && b) events.push({ t: t + beat * 0.45, kind: 'glide', ratio: b, tau: 0.07 });
      t += beat;
    } else if (tok.includes('^')) {
      const [a, b] = tok.split('^').map(ratioOf);
      if (a) events.push({ t, kind: 'pluck', ratio: a });
      // a pull-off is quick and sharp: the string jumps to the lower fret
      if (a && b) events.push({ t: t + beat * 0.5, kind: 'glide', ratio: b, tau: 0.008 });
      t += beat;
    } else if (tok.endsWith('~')) {
      const r = ratioOf(tok.slice(0, -1));
      if (r) {
        events.push({ t, kind: 'pluck', ratio: r });
        // andolan: a slow sway a little below the note and back, twice
        for (let k = 1; k <= 4; k++) events.push({ t: t + (k * beat) / 2, kind: 'glide', ratio: k % 2 ? r * 2 ** (-30 / 1200) : r, tau: 0.12 });
      }
      t += beat;
    } else {
      const r = ratioOf(tok);
      if (r) events.push({ t, kind: 'pluck', ratio: r });
      t += beat;
    }
  }
  return { events, seconds: t };
}

// ── Tarab ──────────────────────────────────────────────────────────────────
// The eleven sympathetic strings, in Hz: the raga's notes from the sitar's Sa
// upwards, the way they are tuned for the raga before a performance.
export function tarabHz(ragaId, sitarSa) {
  const notes = [...RAGAS[ragaId].notes].map((s) => SWARA[s]);
  const out = [];
  for (let oct = 1; out.length < 11; oct *= 2) for (const r of notes) if (out.length < 11) out.push(r * oct * sitarSa);
  return out;
}
