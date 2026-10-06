// The speakers' own voices for the lines nobody recorded: made by
// scripts/voices (its README says how) into public/audio/voiced, with a
// manifest of which lines have one (or served from VITE_VOICED_BASE). A line
// with none keeps its blips (universe/sounds.js), or its silence.

const BASE = (import.meta.env?.VITE_VOICED_BASE || '/audio/voiced').replace(/\/$/, '');

// A line's id: FNV-1a of who says it and what they say, so the same words
// from the same mouth find the same file wherever they appear (and an edited
// line gets a new one). scripts/voices/export-lines.mjs uses this too.
export function lineId(who, text) {
  let h = 0x811c9dc5;
  const s = `${who}|${text}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

let manifest = null;
function load() {
  if (!manifest)
    manifest = fetch(`${BASE}/manifest.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => (m && typeof m.lines === 'object' ? m.lines : {}))
      .catch(() => ({})); // not generated here (or not signed in): the blips it is
  return manifest;
}

// Start fetching the manifest, so the first line isn't kept waiting for it.
export const preloadVoiced = () => {
  load();
};

// Where a line's generated recording is, or null if it has none.
export async function voicedSrc(who, text) {
  const lines = await load();
  const file = lines[lineId(who, text)];
  return typeof file === 'string' ? `${BASE}/${file}` : null;
}

// ── the worlds' conversations ──
// Speakers whose lines are someone else's voice (Strider is Aragorn; the
// Council are Ricks; Evil Morty is a Morty), and the ones with no voice at
// all: whoever narrates, a caller, a voice on the wind, the beeps and roars.
const SAME_VOICE = { strider: 'aragorn', councila: 'rick', councilb: 'rick', councilc: 'rick', evilmorty: 'morty', president: 'morty' };
const NO_VOICE = new Set(['narrator', 'voice', 'caller', 'r2', 'artoo', 'chewie', 'nazgul', 'orc', 'comms', 'bot', 'bee', 'bumblebee']);

// The voice a speaker's lines are made in, or null.
export function voiceOf(who) {
  if (!who || NO_VOICE.has(who)) return null;
  return SAME_VOICE[who] ?? who;
}

// What of a line is said aloud: the parts in quotes, where a line mixes
// them with narration (“Frodo?” You back away.); otherwise all of it; never
// what's in brackets.
// scripts/voices/export-lines.mjs makes the line from this.
export function spoken(text) {
  const quoted = [...text.matchAll(/“([^”]+)”/g)].map((m) => m[1].trim());
  const said = quoted.length ? quoted.join(' ') : text;
  return said.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim(); // not the asides in brackets: (Beeps.)
}

let current = null;
let turn = 0;

// Say a line in its speaker's voice, if it's been made; one line at a time,
// so it stops whatever was being said. Resolves to the playing handle, or
// null (no voice, not made, not here, or already overtaken by the next line).
export async function sayVoiced(who, text) {
  stopVoiced();
  const mine = turn;
  const voice = voiceOf(who);
  if (!voice || !text) return null;
  const src = await voicedSrc(voice, text);
  if (!src || mine !== turn) return null;
  const { playFile } = await import('./clips');
  const h = await playFile(src, { voice: true });
  if (mine !== turn) {
    h?.stop();
    return null;
  }
  current = h;
  return h;
}

export function stopVoiced() {
  turn += 1;
  current?.stop();
  current = null;
}
