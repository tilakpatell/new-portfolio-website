// "A day at Akshardham" as a clock: a plausible time for the light in each
// photo (they weren't all taken on one day), and the maths for the time
// track, where a position is a stop with a fraction (2.5 is halfway from the
// third photo to the fourth). No three.js here: the track imports it too.

export const CLOCK = {
  'h-rv-day': '12:30',
  'h-rv-golden': '18:05',
  'h-robbinsville': '18:40',
  'h-rv-dusk': '19:10',
  'h-rv-night': '20:45',
  'h-rv-fireworks': '21:30',
  'h-dl-lotus': '09:40',
  'h-dl-day': '13:10',
  'h-dl-golden': '17:45',
  'h-dl-dusk': '18:20',
  'h-dl-night': '19:15',
  'h-dl-watershow': '20:00',
};

// The cut between two photos, and how long letting go of the track takes to
// settle on the nearest photo (per stop of distance, so a small nudge is quick)
export const CUT_MS = 1400;
const SETTLE_MS = 900;
export const settleMs = (distance) => Math.max(180, Math.min(1, Math.abs(distance)) * SETTLE_MS);

// arrivals: exponential ease-out; settling back onto a stop: a gentler cubic
export const easeOut = (t) => (t >= 1 ? 1 : t <= 0 ? 0 : 1 - 2 ** (-10 * t));
export const settleEase = (t) => (t >= 1 ? 1 : t <= 0 ? 0 : 1 - (1 - t) ** 3);

// minutes after midnight for a photo, or null if it has no clock time
export function minutesOf(id) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(CLOCK[id] ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

const two = (v) => String(v).padStart(2, '0');
const hhmm = (min) => {
  const m = Math.round(min);
  return `${two(Math.floor(m / 60) % 24)}:${two(m % 60)}`;
};

// { time: '18:40', label: 'Sunset' } at position t on the track: the clock
// runs on between the stops either side, the label is the nearest stop's
export function clockAt(day, t) {
  const n = day.length;
  if (!n) return { time: '', label: '' };
  const v = Math.min(n - 1, Math.max(0, Number.isFinite(t) ? t : 0));
  const k0 = Math.floor(v);
  const k1 = Math.min(n - 1, k0 + 1);
  const m0 = minutesOf(day[k0].id);
  const m1 = minutesOf(day[k1].id);
  const label = day[Math.round(v)].time;
  if (m0 == null || m1 == null) return { time: '', label };
  return { time: hhmm(m0 + (m1 - m0) * (v - k0)), label };
}

// what a screen reader hears for that position: "Sunset, 18:40"
export function valueText(day, t) {
  const { time, label } = clockAt(day, t);
  return time ? `${label}, ${time}` : label;
}
