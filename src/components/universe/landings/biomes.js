// Which part of a planet you've come down on: Mordor's ash or the Shire's
// grass, White Sands or Albuquerque's grid, Tortuga or a reef flat. Each
// planet's landing (landings.js) may list `biomes`, read off the colour of
// the planet's own map under the spot: the first whose test holds is the
// place, the last (no test) the fallback, which is the landing as it was.
// Pure rules, tested in Node; footScene.js samples the map and furnishes
// the place.
//
//   biomes  [{ id, match?(c, at), near?: [lat, lon, deg], sea?, title?,
//            sub?, ground?, sky?, things?, models?, scatter? }]
//            match: on the map's colour there as classify gives it ({ h
//            0…360, s, l 0…1 }) and where it is ([lat, lon] degrees, or
//            null); near: within deg of a place, whatever its colour (a
//            town too small to see from orbit); sea: no landing there, so
//            the spot moves on toward land (towardLand). Anything left out
//            is the landing's own.

import { facingAlong, rotate, vec } from '../foot';

const { cross, dot, unit } = vec;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const DEG = Math.PI / 180;

// a colour ([r, g, b], 0…1) as hue (degrees), saturation and lightness
export function classify([r, g, b]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d < 1e-9) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s: clamp(s, 0, 1), l };
}

// Where a unit vector out from the planet's middle (its own frame, the
// body's, unturned) is on its colour map: the same as
// scripts/planets/sphere.mjs's toUv, which the bakes lay the maps by (and
// three's SphereGeometry: u from −x round toward +z, v 0 at the north pole,
// the image's top row)
export function uvOf([x, y, z]) {
  let phi = Math.atan2(z, -x);
  if (phi < 0) phi += Math.PI * 2;
  return [phi / (Math.PI * 2), Math.acos(clamp(y, -1, 1)) / Math.PI];
}

// latitude and longitude in degrees (longitude 0 the map's middle, u 0.5;
// east toward larger u), for a spot and back: what ?spot=lat,lon takes
export function latLonOf(n) {
  const [u, v] = uvOf(unit(n));
  return [90 - v * 180, u * 360 - 180];
}
export function fromLatLon(lat, lon) {
  const theta = (90 - lat) * DEG;
  const phi = (lon + 180) * DEG;
  return [-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta)];
}

// the great-circle angle between two places, degrees
const apart = ([a1, o1], [a2, o2]) => Math.acos(clamp(dot(fromLatLon(a1, o1), fromLatLon(a2, o2)), -1, 1)) / DEG;

const holds = (b, c, at) => {
  if (b.near) return Boolean(at) && apart(at, b.near) <= b.near[2];
  return b.match ? b.match(c, at) : true;
};

// The biome for a landing at a spot whose map colour is `rgb` (and which is
// `at`, [lat, lon], if known): its id and sea, and the landing's own
// fields where it leaves them out. A landing with no biomes is its own,
// 'default'.
export function biomeAt(landing, rgb, at = null) {
  const own = { title: landing.title, sub: landing.sub, ground: landing.ground, sky: landing.sky, things: landing.things, scatter: landing.scatter, models: landing.models };
  const list = landing.biomes ?? [];
  if (!list.length) return { id: 'default', sea: false, ...own };
  const c = classify(rgb);
  const b = list.find((x) => holds(x, c, at)) ?? list.at(-1);
  const pick = (k) => b[k] ?? own[k];
  return {
    id: b.id,
    sea: Boolean(b.sea),
    title: pick('title'),
    sub: pick('sub'),
    ground: pick('ground'),
    sky: pick('sky'),
    things: pick('things'),
    scatter: pick('scatter'),
    models: b.models ? { ...own.models, ...b.models } : own.models,
  };
}

// A spot over the sea, moved to the nearest land: out along the great
// circle the way it was heading (`track`, any direction along the ground
// there), and should that find none as soon, the other ways round too, a
// `stride` (radians) at a time for `steps`; the first that isn't sea
// (`isSea(sample(uv))`) wins, the way it was heading first at each reach.
// Land already, or no land in reach: `n` as it was.
export function towardLand(n, sample, isSea, { track = null, steps = 24, stride = 0.02, ways = 8 } = {}) {
  const from = unit(n);
  const seaAt = (p) => isSea(sample(uvOf(p)));
  if (!seaAt(from)) return n;
  const ahead = facingAlong(from, track ?? [0, 1, 0]);
  const dirs = [];
  for (let i = 0; i < ways; i++) dirs.push(rotate(ahead, from, (i % 2 ? -1 : 1) * Math.ceil(i / 2) * ((Math.PI * 2) / ways)));
  for (let k = 1; k <= steps; k++) {
    for (const d of dirs) {
      const p = unit(rotate(from, unit(cross(from, d)), k * stride));
      if (!seaAt(p)) return p;
    }
  }
  return n;
}

// The colour of an image at a uv, through a 256 × 128 copy made once per
// image (browser only). `flip`: the image is upside down (an ImageBitmap
// decoded flipped, lib/three/textures.js's, with the texture's flipY off).
// Null when it can't be read (a compressed texture's, say).
const COPIES = new WeakMap();
export function sampleMap(image, [u, v], { flip = false } = {}) {
  if (!image || typeof document === 'undefined') return null;
  let copy = COPIES.get(image);
  if (copy === undefined) {
    copy = null;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 128;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(image, 0, 0, 256, 128);
      copy = ctx.getImageData(0, 0, 256, 128).data;
    } catch {
      copy = null;
    }
    COPIES.set(image, copy);
  }
  if (!copy) return null;
  const x = Math.min(255, Math.floor((((u % 1) + 1) % 1) * 256));
  const y = Math.min(127, Math.floor(clamp(flip ? 1 - v : v, 0, 1) * 128));
  const i = (y * 256 + x) * 4;
  return [copy[i] / 255, copy[i + 1] / 255, copy[i + 2] / 255];
}
