// The globe's data for the WebGL version: the land points of the Fibonacci
// lattice (scripts/build-globe.mjs), which country each belongs to, and the
// routes from home. The same decode as the 2D Globe.jsx, kept here so that
// file can change on its own.

import { GLOBE } from '../../../data/globe';
import { CODE_ALPHABET, fibonacciPoint } from '../../../data/globe-lattice';
import { HOME, PLACES } from '../../../data/places';

export const RAD = Math.PI / 180;
export const ARC_STEPS = 128;

// [longitude, latitude] in degrees -> unit vector (y up, lon 0 facing +z)
export const toVec = (lon, lat) => {
  const l = lon * RAD;
  const p = lat * RAD;
  return [Math.cos(p) * Math.sin(l), Math.sin(p), Math.cos(p) * Math.cos(l)];
};

// Points along the great circle from a to b, lifted off the surface in the
// middle so long routes read as flights. The ends sit a hair above the
// surface so the sphere's depth never flickers through them.
function arc(a, b, steps = ARC_STEPS) {
  const d = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const omega = Math.acos(d);
  const s = Math.sin(omega) || 1;
  const lift = 0.03 + 0.2 * (omega / Math.PI);
  const pts = new Float32Array((steps + 1) * 3);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const wa = Math.sin((1 - t) * omega) / s;
    const wb = Math.sin(t * omega) / s;
    const h = 1.004 + lift * Math.sin(Math.PI * t);
    pts[i * 3] = (wa * a[0] + wb * b[0]) * h;
    pts[i * 3 + 1] = (wa * a[1] + wb * b[1]) * h;
    pts[i * 3 + 2] = (wa * a[2] + wb * b[2]) * h;
  }
  return pts;
}

let cache = null;
export function globeData() {
  if (cache) return cache;
  const lookup = new Uint8Array(128);
  for (let i = 0; i < CODE_ALPHABET.length; i++) lookup[CODE_ALPHABET.charCodeAt(i)] = i;
  const bits = atob(GLOBE.land);
  const count = GLOBE.owner.length / 2;
  const xyz = new Float32Array(count * 3);
  const owner = new Int16Array(count);
  let k = 0;
  for (let i = 0; i < GLOBE.n && k < count; i++) {
    if (!(bits.charCodeAt(i >> 3) & (1 << (i & 7)))) continue;
    const v = toVec(...fibonacciPoint(i, GLOBE.n));
    xyz[k * 3] = v[0];
    xyz[k * 3 + 1] = v[1];
    xyz[k * 3 + 2] = v[2];
    owner[k] = lookup[GLOBE.owner.charCodeAt(2 * k)] * 64 + lookup[GLOBE.owner.charCodeAt(2 * k + 1)];
    k++;
  }
  // Country index -> place index, for the countries that are lit.
  const placeOf = new Int16Array(GLOBE.names.length).fill(-1);
  PLACES.forEach((p, i) => {
    const c = GLOBE.placeCountry[p.id];
    if (c != null) placeOf[c] = i;
  });
  const home = toVec(...HOME.at);
  const markers = PLACES.map((p) => toVec(...p.at));
  const arcs = PLACES.map((p, i) => (p.home ? null : arc(home, markers[i])));
  cache = { count, xyz, owner, placeOf, markers, arcs };
  return cache;
}

// The country a place lights (-1 for a region such as the Caribbean).
export const countryOf = (placeIndex) => (placeIndex >= 0 ? (GLOBE.placeCountry[PLACES[placeIndex].id] ?? -1) : -1);
export const countryName = (c) => GLOBE.names[c];
