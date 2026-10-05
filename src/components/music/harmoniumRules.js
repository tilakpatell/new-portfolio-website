// The harmonium's rules, apart from the sound: which recorded key plays a
// note and how far it is retuned, the reed banks a note sounds on, the air
// in the bellows, and which computer key or MIDI note plays which key.
// Tested in harmoniumRules.test.js.

// ── The recordings ─────────────────────────────────────────────────────────
// A recorded key (from ./harmoniumSamples.js) is retuned by at most this many
// semitones; past that, a modelled reed plays instead, so nothing sounds
// sped up or slowed down.
export const STRETCH = 4;

// The recorded key nearest a pitch, and the playback rate that brings it
// there; null if none is within STRETCH semitones. Keys are [midi, hz, …].
export function keyFor(hz, keys) {
  let best = null;
  let dist = Infinity;
  for (const k of keys) {
    const d = Math.abs(12 * Math.log2(hz / k[1]));
    if (d < dist) {
      dist = d;
      best = k;
    }
  }
  return best && dist <= STRETCH ? { key: best, rate: hz / best[1] } : null;
}

// ── Reeds ──────────────────────────────────────────────────────────────────
// A harmonium has a bank of reeds for each register, chosen with its stops:
// bass an octave below, male at pitch, female an octave above. Two banks
// sounding together are tuned a few cents apart, so they beat gently, the way
// a real harmonium's coupled reeds do.
export const REEDS = {
  bass: { octave: 0.5, level: 0.72, cents: -3 },
  male: { octave: 1, level: 1, cents: 0 },
  female: { octave: 2, level: 0.55, cents: 4 },
};
export const REED_NAMES = { bass: 'Bass', male: 'Male', female: 'Female' };

// The reeds a note at `hz` sounds on: [{ bank, hz, level }], always at least one.
export function reedsFor(hz, banks = { male: true }) {
  const on = Object.keys(REEDS).filter((b) => banks?.[b]);
  const use = on.length ? on : ['male'];
  // more banks, each a little quieter, so a full chord of stops doesn't jump out
  const share = 1 / Math.sqrt(use.length);
  return use.map((bank) => {
    const r = REEDS[bank];
    return { bank, hz: hz * r.octave * 2 ** (r.cents / 1200), level: r.level * share };
  });
}

// ── The bellows ────────────────────────────────────────────────────────────
// Air in the bellows, 0 (empty) to 1 (full). Pumping fills it; every reed
// sounding uses some, so a chord on three banks empties it far sooner than one
// note; a little leaks away. Its pressure sets how loud and how bright the reeds
// are: full until the bellows are nearly empty, then falling away to nothing.
export const BELLOWS = {
  perReed: 0.045, // air a sounding reed uses in a second
  leak: 0.012, // and what leaks away in a second
  stroke: 0.9, // air one full stroke (across the whole bellows) pushes in
  full: 0.3, // above this much air, the pressure is full
};

export function stepBellows(air, dt, reeds) {
  const used = (BELLOWS.perReed * Math.max(0, reeds) + BELLOWS.leak) * Math.max(0, dt);
  return Math.max(0, Math.min(1, air - used));
}

// Pumping: `amount` is how far the hand moved, as a fraction of the bellows' width.
export const pump = (air, amount) => Math.max(0, Math.min(1, air + Math.abs(amount) * BELLOWS.stroke));

export function pressure(air) {
  if (air >= BELLOWS.full) return 1;
  const u = Math.max(0, air) / BELLOWS.full;
  return u * u * (3 - 2 * u); // smooth, so the reeds fade rather than cut
}

// ── Keys ───────────────────────────────────────────────────────────────────
// The computer keyboard as two keyboards, the way most music software lays it
// out: the bottom row from Z is the lower octave (S D G H J its black keys),
// the top row from Q the upper (2 3 5 6 7 9 0 its black keys), running on
// past it. Each key's place is in semitones above the keyboard's first C.
const LOWER = 'zsxdcvgbhnjm,l.;/';
const UPPER = "q2w3er5t6y7ui9o0p[=]";
export function keyForComputer(key) {
  const k = String(key).toLowerCase();
  const lo = LOWER.indexOf(k);
  if (lo >= 0) return lo;
  const up = UPPER.indexOf(k);
  return up >= 0 ? 12 + up : -1;
}
export const computerKeyFor = (semis) => (semis < 12 ? LOWER[semis] : UPPER[semis - 12]) ?? '';

// A MIDI note as a place on the keyboard: semitones above C3 (MIDI 48).
export const C3 = 48;
export const keyForMidi = (note) => note - C3;
