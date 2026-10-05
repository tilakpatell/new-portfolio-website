// The sitar's rules, apart from the sound: which recording plays a note and
// how far it is retuned, the keys for the frets, where a meend goes, and how
// a phrase written in sargam falls in time. Tested in sitarRules.test.js.

import { SITAR_VARIANTS } from './sitarSamples';
import { SWARA, ragaOf, swaraIn } from './tuning';

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
  const raga = ragaOf(ragaId);
  const notes = [...raga.notes].map((s) => swaraIn(raga, s));
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
// off to Y with no new stroke), - holds, | strikes the chikari. `tune` puts a
// raga's notes where it plays them (Darbari's ati komal Ga, say).
export function ratioOf(tok, tune = null) {
  const m = /^([SrRgGmMPdDnN])([.']?)$/.exec(tok);
  if (!m) return null;
  return (tune?.[m[1]] ?? SWARA[m[1]]) * (m[2] === '.' ? 0.5 : m[2] === "'" ? 2 : 1);
}

export function parsePhrase(text, beat, tune = null) {
  const pitch = (tok) => ratioOf(tok, tune);
  const events = [];
  let t = 0;
  for (const tok of text.trim().split(/\s+/)) {
    if (tok === '|') events.push({ t, kind: 'chikari' });
    else if (tok === '-') t += beat;
    else if (tok.includes('>')) {
      const [a, b] = tok.split('>').map(pitch);
      if (a) events.push({ t, kind: 'pluck', ratio: a });
      if (a && b) events.push({ t: t + beat * 0.45, kind: 'glide', ratio: b, tau: 0.07 });
      t += beat;
    } else if (tok.includes('^')) {
      const [a, b] = tok.split('^').map(pitch);
      if (a) events.push({ t, kind: 'pluck', ratio: a });
      // a pull-off is quick and sharp: the string jumps to the lower fret
      if (a && b) events.push({ t: t + beat * 0.5, kind: 'glide', ratio: b, tau: 0.008 });
      t += beat;
    } else if (tok.endsWith('~')) {
      const r = pitch(tok.slice(0, -1));
      if (r) {
        events.push({ t, kind: 'pluck', ratio: r });
        // andolan: a slow sway a little below the note and back, twice
        for (let k = 1; k <= 4; k++) events.push({ t: t + (k * beat) / 2, kind: 'glide', ratio: k % 2 ? r * 2 ** (-30 / 1200) : r, tau: 0.12 });
      }
      t += beat;
    } else {
      const r = pitch(tok);
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
  const raga = ragaOf(ragaId);
  const notes = [...raga.notes].map((s) => swaraIn(raga, s));
  const out = [];
  for (let oct = 1; out.length < 11; oct *= 2) for (const r of notes) if (out.length < 11) out.push(r * oct * sitarSa);
  return out;
}

// ── Auto chikari ───────────────────────────────────────────────────────────
// A sitarist's right hand fills the rests in the melody with the chikari: a
// note is struck, and while it rings the two drone strings keep the pulse
// (Da chik chik chik) until the next note. With the tabla playing, the pulse
// is the taal's, sam struck hardest and khali lightest; alone, it is the
// player's own, heard in their last few notes, or a speed the player sets.
// Held down, the chikari rolls on at that speed for as long as it is held, and
// notes played over it make a jhala. It never crowds a note: it waits a
// moment after a stroke or a slide, and when the notes have been coming
// evenly, it leaves the beat the next one is due on to the player.
// Times are seconds on the audio clock; speeds are strokes a minute.
export const CHIKARI = {
  ring: 2.8, // how long a note rings, so how long the chikari fills after it
  fills: 3, // alone, the most strokes after a note…
  restFills: 4, // …or after Sa or Pa, the notes a phrase rests on
  pulse: 0.5, // the pulse alone, before the player's own is known
  roll: 0.25, // a held chikari's, before the player's own is known
  lo: 0.28, // a pulse heard in the notes is folded into lo…hi
  hi: 0.75,
  fastest: 0.2, // a faster laya may halve the pulse, down to this
  near: 0.45, // of a pulse: too soon after a note or a slide to strike
  gap: 0.6, // of a pulse: too soon after the last chikari
  speeds: [40, 600], // the speeds a player can set
  level: [0.3, 1.4], // and how hard it is struck, 1 as it comes
};

// How many chikari strokes to a beat of the taal. Following the music: one,
// or more when the beat is slow (so the rests never fall silent too long) or
// the laya is quick. At a set speed: whichever keeps the beat and comes
// nearest it, from eight strokes to a beat to one every four beats.
const SUBS = [0.25, 0.5, 1, 2, 4, 8];
export function chikariSub(beat, laya = 1, speed = 0) {
  if (speed > 0) {
    const want = 60 / speed;
    const off = (sub) => Math.abs(Math.log(beat / sub / want));
    return SUBS.reduce((best, sub) => (off(sub) < off(best) - 1e-9 ? sub : best));
  }
  let sub = 1;
  while (beat / sub > CHIKARI.hi && sub < 8) sub *= 2;
  if (laya > 1 && beat / (sub * 2) >= CHIKARI.fastest) sub *= 2;
  return sub;
}

// A set speed or strength kept in range, whatever was stored.
export const chikariSpeed = (v) => Math.round(Math.max(CHIKARI.speeds[0], Math.min(CHIKARI.speeds[1], Number(v) || 240)));
export const chikariLevel = (v) => Math.max(CHIKARI.level[0], Math.min(CHIKARI.level[1], Number.isFinite(Number(v)) ? Number(v) : 1));

// The player's rhythm, from the times of their last notes: the usual gap
// between them (since the last pause), whether it has been even, and the
// chikari's pulse, folded into a comfortable range.
export function playerRhythm(onsets) {
  const gaps = [];
  for (let i = onsets.length - 1; i > 0 && gaps.length < 5; i--) {
    const g = onsets[i] - onsets[i - 1];
    if (g > 1.6) break; // a pause: what came before it was another phrase
    if (g >= 0.1) gaps.push(g); // closer than that is a slip, not a rhythm
  }
  if (!gaps.length) return { ioi: 0, steady: false, pulse: CHIKARI.pulse };
  const sorted = [...gaps].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const ioi = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const steady = gaps.length >= 2 && gaps.every((g) => Math.abs(g / ioi - 1) <= 0.25);
  let pulse = ioi;
  while (pulse > CHIKARI.hi) pulse /= 2;
  while (pulse < CHIKARI.lo) pulse *= 2;
  return { ioi, steady, pulse };
}

// Sa and Pa, in any octave: where a phrase rests, and the chikari rings longest.
export const restsOn = (ratio) => sameNote(ratio, 1) || sameNote(ratio, 1.5);

const mod = (a, n) => ((a % n) + n) % n;

// How hard the chikari falls on a beat of the taal: sam hardest, the start of
// each vibhag firmer, khali lighter, and the strokes between beats lightest.
export function chikariAccent(taal, beat, onBeat = true) {
  if (!onBeat) return 0.36;
  if (!taal) return 0.48;
  const i = mod(beat, taal.theka.length);
  if (i === 0) return 0.72;
  let at = 0;
  for (let v = 0; v < taal.vibhag.length; v++) {
    const len = taal.vibhag[v];
    if (i < at + len) {
      const khali = taal.marks[v] === '0';
      return (i === at ? 0.58 : 0.48) * (khali ? 0.82 : 1);
    }
    at += len;
  }
  return 0.48;
}

// The chikari strokes due in (from, to], as [{ t, vel }], given what the hand
// has done: `onsets` (the times of the player's notes, oldest first), `ratio`
// (the last note), `moved` (when the left hand last slid or bent the note),
// `chik` (the last chikari), `grid` (the tabla's beat while a theka plays:
// { at, beat, len, laya, taal }, beat number `beat` sounding at `at`, or
// null), `speed` (strokes a minute, or 0 to follow the music), `roll` (when
// the chikari was taken up and held, or null) and `auto` (whether it fills
// the rests by itself; a held roll plays either way). Called again for the
// next stretch, it carries on where it left off: nothing twice, nothing missed.
export function chikariPlan(from, to, { onsets = [], ratio = 1, moved = -Infinity, chik = -Infinity, grid = null, speed = 0, roll = null, auto = true } = {}) {
  const out = [];
  speed = speed > 0 ? chikariSpeed(speed) : 0; // in range, so the pulse is never zero
  const rolling = roll !== null && Number.isFinite(roll);
  if (!(to > from) || (!rolling && (!auto || !onsets.length))) return out;
  const last = onsets.length ? onsets[onsets.length - 1] : -Infinity;
  const rhythm = playerRhythm(onsets);
  const due = rhythm.steady ? last + rhythm.ioi : null; // when the next note is expected, rolling or not
  const start = rolling ? Math.max(from, roll) : from; // a roll strikes nothing from before it was taken up
  let prev = chik;
  // the guards scale with the pulse, but a slow set speed doesn't stretch them
  const fits = (t, pulse, gap) => {
    const p = Math.min(pulse, CHIKARI.hi);
    return (
      (rolling || t - last <= CHIKARI.ring) &&
      t - last >= Math.max(0.14, CHIKARI.near * p) &&
      t - moved >= Math.max(0.14, CHIKARI.near * p) &&
      t - prev >= CHIKARI.gap * gap &&
      !(due !== null && Math.abs(t - due) < Math.max(0.06, 0.3 * p))
    );
  };
  if (grid && grid.len > 0 && Number.isFinite(grid.at) && Number.isFinite(grid.beat)) {
    const sub = chikariSub(grid.len, grid.laya, speed);
    const per = Math.max(1, sub); // strokes in a beat
    const every = Math.round(Math.max(1, 1 / sub)); // beats from one stroke to the next
    const cycle = grid.taal?.theka?.length || every;
    const pulse = grid.len / sub;
    const gap = Math.min(pulse, grid.len); // a cycle's last stroke may come a beat before sam
    for (let b = grid.beat + Math.floor((Math.max(start, rolling ? start : last) - grid.at) / grid.len) - 1; ; b++) {
      const tb = grid.at + (b - grid.beat) * grid.len;
      if (tb > to || (!rolling && tb - last > CHIKARI.ring)) break;
      // a stroke every few beats counts them from sam, so sam always has one
      if (every > 1 && mod(mod(b, cycle), every) !== 0) continue;
      for (let s = 0; s < per; s++) {
        const t = tb + (s / per) * grid.len;
        if (t > to) break;
        if (t <= start || !fits(t, pulse, gap)) continue;
        out.push({ t, vel: chikariAccent(grid.taal, b, s === 0) });
        prev = t;
      }
    }
    return out;
  }
  // alone: the pulse counts from the last stroke, or from where the left hand
  // last moved the note, or from when the chikari was taken up
  const pulse = speed > 0 ? 60 / speed : rolling && !rhythm.ioi ? CHIKARI.roll : rhythm.pulse;
  const anchor = Math.max(last, moved, rolling ? roll : -Infinity);
  const fills = restsOn(ratio) ? CHIKARI.restFills : CHIKARI.fills;
  // at a set speed, the rest lasts as long as it would at the usual pulse
  const most = rolling ? Infinity : speed > 0 ? Math.max(1, Math.round((fills * CHIKARI.pulse) / pulse)) : fills;
  for (let k = Math.max(1, Math.floor((start - anchor) / pulse)); k <= most; k++) {
    const t = anchor + k * pulse;
    if (t > to || (!rolling && t - last > CHIKARI.ring)) break;
    if (t <= start || !fits(t, pulse, pulse)) continue;
    out.push({ t, vel: rolling ? 0.55 : 0.6 * 0.86 ** ((k - 1) * Math.min(1, pulse / CHIKARI.pulse)) });
    prev = t;
  }
  return out;
}
