// The music room's tuning: one Sa for every instrument, the raga, the
// tanpura's first string and how the sitar is set up, kept between visits. Pitches are just intonation
// against Sa. Nothing here makes a sound.

// ── Sa ─────────────────────────────────────────────────────────────────────
// Sa can be any note from C3 to B3. The tanpura's middle strings sound it.
export const SA_NOTES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const saHz = (i) => 440 * 2 ** ((48 + i - 69) / 12);

// The tanpura's first string: Pa for most ragas, Ma where Pa is left out
// (Malkauns), Ni for ragas built around it (Marwa, Puriya). All in the lower octave.
export const FIRST_STRING = {
  Pa: { ratio: 3 / 4, label: 'Pa', note: 'mandra Pa' },
  Ma: { ratio: 2 / 3, label: 'Ma', note: 'mandra Ma' },
  Ni: { ratio: 15 / 16, label: 'Ni', note: 'mandra Ni' },
};

// ── Swaras ─────────────────────────────────────────────────────────────────
// Swaras in just intonation. Lowercase r g d n are komal (flat); M is tivra (sharp) Ma.
export const SWARA = { S: 1, r: 16 / 15, R: 9 / 8, g: 6 / 5, G: 5 / 4, m: 4 / 3, M: 45 / 32, P: 3 / 2, d: 8 / 5, D: 5 / 3, n: 9 / 5, N: 15 / 8 };
export const SWARA_NAME = { S: 'Sa', r: 'Re', R: 'Re', g: 'Ga', G: 'Ga', m: 'Ma', M: 'Ma', P: 'Pa', d: 'Dha', D: 'Dha', n: 'Ni', N: 'Ni' };
// all twelve, in order up the octave
export const CHROMATIC = ['S', 'r', 'R', 'g', 'G', 'm', 'M', 'P', 'd', 'D', 'n', 'N'];
// komal notes are written underlined, tivra Ma with a tick
export const swaraMark = (s) => (s === 'r' || s === 'g' || s === 'd' || s === 'n' ? 'komal' : s === 'M' ? 'tivra' : null);

// ── Ragas ──────────────────────────────────────────────────────────────────
// A phrase is written in sargam: N. is mandra Ni, S' is taar Sa, X>Y is a meend
// from X to Y, X~ is an andolan (a slow sway on the note), X^Y a krintan (the
// left hand pulls off to Y without a new stroke), - holds, | strikes the chikari.
export const RAGAS = {
  yaman: { name: 'Yaman', time: 'Evening', notes: 'SRGMPDN', first: 'Pa', phrase: "N. R G - R G M>P - | M G R - N. R S - -", beat: 0.42 },
  bhairav: { name: 'Bhairav', time: 'Dawn', notes: 'SrGmPdN', first: 'Pa', phrase: "S G m d~ - P - | G m r~ - S - -", beat: 0.45 },
  kafi: { name: 'Kafi', time: 'Night', notes: 'SRgmPDn', first: 'Pa', phrase: "S R g m P - | m g R g>R S - -", beat: 0.4 },
  bhupali: { name: 'Bhupali', time: 'Evening', notes: 'SRGPD', first: 'Pa', phrase: "S R G - P G - | D P G R S - -", beat: 0.4 },
  malkauns: { name: 'Malkauns', time: 'Late night', notes: 'Sgmdn', first: 'Ma', phrase: "n. S g m - | g m d n d m - | g m g S - -", beat: 0.42 },
  darbari: { name: 'Darbari', time: 'Late night', notes: 'SRgmPdn', first: 'Pa', phrase: "S R g~ - R S - | n. S R g~ - m P - | d~ - n P - -", beat: 0.5 },
};

// ── The sitar's frets ──────────────────────────────────────────────────────
// The neck runs from mandra Pa to taar Ga, as a sitar's twenty-odd frets do
// above its open Ma string. With `all`, every one of the twelve swaras has a
// fret (a sitar with its moveable frets set chromatically); otherwise only
// the raga's notes do, the way a player sets the frets for a raga. Each fret
// says whether its note is in the raga.
export const NECK_LOW = 0.74; // mandra Pa (3/4), with room for just intonation
export const NECK_HIGH = 2.51; // taar Ga (5/2)

export function frets(ragaId, { all = false } = {}) {
  const raga = new Set(RAGAS[ragaId].notes);
  const out = [];
  for (const oct of [-1, 0, 1]) {
    for (const s of CHROMATIC) {
      const ratio = SWARA[s] * 2 ** oct;
      if (ratio < NECK_LOW || ratio > NECK_HIGH) continue;
      const inRaga = raga.has(s);
      if (all || inRaga) out.push({ s, oct, ratio, inRaga });
    }
  }
  return out;
}

// The tarab are tuned to the raga's notes, eleven of them from Sa up.
export function tarabRatios(ragaId) {
  const notes = [...RAGAS[ragaId].notes].map((s) => SWARA[s]);
  const out = [];
  for (let oct = 1; out.length < 11; oct *= 2) for (const r of notes) if (out.length < 11) out.push(r * oct);
  return out;
}

// ── The shared tuning ──────────────────────────────────────────────────────
const KEY = 'tp-music';
const DEFAULT_TUNING = { sa: 2, first: 'Pa', raga: 'yaman', allFrets: true, autoChikari: true }; // Sa = D
let tuning = (() => {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) || 'null');
    if (saved && saved.sa >= 0 && saved.sa < 12 && FIRST_STRING[saved.first] && RAGAS[saved.raga]) return { ...DEFAULT_TUNING, ...saved, allFrets: saved.allFrets !== false, autoChikari: saved.autoChikari !== false };
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_TUNING;
})();
const tuningListeners = new Set();
export const getTuning = () => tuning;
export const onTuning = (fn) => {
  tuningListeners.add(fn);
  return () => tuningListeners.delete(fn);
};
export function setTuning(next) {
  tuning = { ...tuning, ...next };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(tuning));
  } catch {
    /* storage unavailable */
  }
  tuningListeners.forEach((fn) => fn(tuning));
}
export const sa = () => saHz(tuning.sa);
