// Kamino's storm on Tipoca City's static discharge towers (Wookieepedia:
// "several static discharge towers to secure the city during electrical
// storms"): when lightning strikes a tower, how bright the bolt is, and the
// bolt's jagged path down from the cloud. Pure: props/core/kamino.js's
// `kdischarge` draws it.

import { hash2 } from './noise';

const DUR = 0.45; // seconds a strike lasts, flickering

// how bright the bolt on a tower is at time t (0 most of the time; a
// flickering 0–1 for a moment about once every `every` seconds). Each
// tower's `seed` gives it its own times.
export function strikeAt(t, { seed = 1, every = 12 } = {}) {
  // (time cut into slots of `every`; in each, a strike at a time the slot's
  // hash picks, or, one slot in four, none)
  const slot = Math.floor(t / every);
  const roll = hash2(slot, seed * 7.31);
  if (roll < 0.25) return 0;
  const at = slot * every + hash2(slot, seed * 3.17 + 11) * (every - DUR);
  const u = (t - at) / DUR;
  if (u < 0 || u >= 1) return 0;
  // (three pulses, fading)
  const pulse = 0.5 + 0.5 * Math.cos(u * Math.PI * 6);
  return Math.max(0.05, pulse) * (1 - u * 0.6);
}

// the bolt's points from `from` (in the cloud) to `to` (the tip), `n`
// steps, each kicked sideways by up to `jag` metres (less near the ends)
export function boltPath(from, to, seed = 1, n = 12, jag = 6) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const k = Math.sin(u * Math.PI) * jag;
    const dx = i === 0 || i === n ? 0 : (hash2(i, seed) - 0.5) * 2 * k;
    const dz = i === 0 || i === n ? 0 : (hash2(i + 50, seed) - 0.5) * 2 * k;
    out.push([from[0] + (to[0] - from[0]) * u + dx, from[1] + (to[1] - from[1]) * u, from[2] + (to[2] - from[2]) * u + dz]);
  }
  return out;
}
