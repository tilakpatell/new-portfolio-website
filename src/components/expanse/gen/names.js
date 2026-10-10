// Names for the expanse's stars, planets and factions, from a seeded rng:
// two or three syllables (three about two times in five) built from a
// culture's sounds, Title Case, drawn again if a rude word turns up inside.
// The core worlds near home sound soft and classical, the rim hard, the
// drift past it odd and full of vowels. Pure, so it runs in Node.
//
// CULTURES: ['core', 'rim', 'drift']; BLOCKLIST
// nameOf(rng, culture) → 'Velanor'
// designation(rng) → 'KX-417'

import { pick } from "./seed";

// a syllable is an onset, a vowel and now and then a coda; a culture's
// table is every onset with every vowel (90 and more), so names rarely repeat
const SOUNDS = {
  core: {
    onsets: [
      "",
      "b",
      "c",
      "d",
      "l",
      "m",
      "n",
      "r",
      "s",
      "t",
      "v",
      "th",
      "ph",
      "al",
      "cl",
      "sel",
      "ser",
    ],
    vowels: ["a", "e", "i", "o", "u", "ae", "ia"],
    codas: ["n", "r", "s", "l", "x", "m"],
    coda: 0.3,
  },
  rim: {
    onsets: [
      "k",
      "g",
      "t",
      "d",
      "kr",
      "gr",
      "dr",
      "tr",
      "br",
      "z",
      "v",
      "x",
      "st",
      "sk",
      "b",
      "h",
      "r",
    ],
    vowels: ["a", "o", "u", "e", "i", "y"],
    codas: ["k", "g", "rk", "th", "x", "z", "nd", "st", "r"],
    coda: 0.5,
  },
  drift: {
    onsets: [
      "",
      "",
      "y",
      "w",
      "q",
      "zh",
      "h",
      "l",
      "n",
      "oo",
      "ae",
      "v",
      "qu",
      "xi",
      "ny",
      "f",
      "m",
    ],
    vowels: ["a", "e", "i", "o", "u", "ou", "ei", "ua", "io", "ee", "ai"],
    codas: ["n", "l", "h", "y", "m"],
    coda: 0.2,
  },
};
export const CULTURES = Object.keys(SOUNDS);

// never inside a name, anywhere
export const BLOCKLIST = [
  "fuck",
  "shit",
  "cunt",
  "dick",
  "cock",
  "piss",
  "slut",
  "whore",
  "fag",
  "nig",
  "rape",
  "nazi",
  "twat",
  "tit",
  "ass",
  "cum",
  "poo",
  "butt",
  "anal",
  "porn",
  "sex",
  "damn",
  "hell",
  "puss",
  "kkk",
  "jizz",
  "wank",
  "turd",
  "homo",
  "spic",
  "kike",
  "dyke",
];
const rude = (s) => BLOCKLIST.some((w) => s.includes(w));

function syllable(rng, s) {
  return (
    pick(rng, s.onsets) +
    pick(rng, s.vowels) +
    (rng() < s.coda ? pick(rng, s.codas) : "")
  );
}

export function nameOf(rng, culture = "core") {
  const s = SOUNDS[culture] ?? SOUNDS.core;
  for (;;) {
    const n = rng() < 0.4 ? 3 : 2;
    let w = "";
    for (let i = 0; i < n; i++) w += syllable(rng, s);
    if (w.length < 3 || w.length > 12 || rude(w)) continue;
    return w[0].toUpperCase() + w.slice(1);
  }
}

const CAPS = "ABCDEFGHJKLMNPRSTVWXYZ";
export const designation = (rng) =>
  `${pick(rng, CAPS)}${pick(rng, CAPS)}-${String(Math.floor(rng() * 1000)).padStart(3, "0")}`;
