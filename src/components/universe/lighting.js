// Which star lights a thing on the universe map, from where, in what colour
// and how strongly: plain numbers, no drawing (the scene moves its lights
// to the answer, the planets take their sun from it).
//
// - STARS: every star that lights what's near it, each { id, at, colour,
//   strength, reach }: the home sun, and deep space's (deep.js's WONDERS:
//   Ember, Halcyon, the Twins' two suns, the Lantern, the Graveyard's white
//   dwarf). A binary's two suns carry `binary` and `part` ('a' or 'b') and
//   are where binaryAt puts them at the scene's clock.
// - weightOf(star, point, now): how much a star counts at a point: its
//   strength over the distance squared, no nearer than its own radius, cut
//   softly to nothing between its reach and half as far again.
// - lightAt(point, { now, nova }) → { star, source, key, fill, ambient }: the
//   heaviest star is the key (`dir` the way its light travels, from the star
//   toward the point; `colour` linear rgb; `strength`), the second the fill
//   where it counts for a tenth of the first, else the sky's cool fill
//   (`sky: true`, a fixed direction the scene keeps on the screen, not the
//   map). The key's colour is mixed by the two stars' weights, so flying
//   from one star to the next turns the light over rather than snapping it.
//   `nova` ({ at, colour, strength }) is one more star while it burns.
//   `source` is the key's star itself ({ id, at, r, colour }: where its
//   glare goes in the lens), null out past every star's reach.
// - sunFor(planetId) → the unit direction from a planet toward the star
//   that lights it (the fandoms' worlds all go round the home sun).
// - daySideApproach(at, sunDir, radius, from) → where to arrive at a
//   planet: on its sunlit side, nearest the way you came.
//
// Everything is in the map's own space (the scene turns it with the map).
import { POSITIONS, SUN } from './layout';
import { WONDERS, binaryAt } from './deep';

const KEY = 2.35; // the key's strength in the home sun's full light (the scene's key before)
const FLOOR = 0.9; // and never less: deep space is dark, never black
const SKY_FILL = { dir: norm([-0.7, 0.4, 0.3]), colour: '#8ea2ff', strength: 0.45 }; // from below right, as before
const AMBIENT = { colour: '#b8c4ff', strength: 0.4 };
const WHITE_MIX = 0.6; // a star's light is its colour most of the way to white (deepspace.js's own stars do much the same)

const wonder = (id) => WONDERS.find((w) => w.id === id);
const starsOf = (kind) => WONDERS.filter((w) => w.kind === kind);

// The home sun reaches every fandom's world (the furthest is under 5,700
// out) and fades past the rim of the map; deep space's stars light their own
// planets (out to 520) and fade well before the nearest fandom's world, so
// each of those is lit by the home sun alone.
export const STARS = [
  { id: 'sun', at: SUN.at, r: SUN.r, colour: '#ffd6a8', strength: 1, reach: 6000 },
  ...starsOf('star').map((w) => ({ id: w.id, at: w.at, r: w.r, colour: w.color, strength: 0.8, reach: 1000 })),
  ...starsOf('binary').flatMap((w) => [
    { id: w.id, at: w.at, r: w.r, colour: w.color, strength: 0.5, reach: 1000, binary: w.id, part: 'a' },
    { id: `${w.id}-2`, at: w.at, r: w.pair.r, colour: w.pair.color, strength: 0.5, reach: 1000, binary: w.id, part: 'b' },
  ]),
  ...starsOf('pulsar').map((w) => ({ id: w.id, at: w.at, r: w.r, colour: '#cfe6ff', strength: 0.3, reach: 900 })),
  ...starsOf('graveyard').map((w) => ({ id: w.id, at: w.at, r: w.r, colour: w.color, strength: 0.25, reach: 700 })),
];
const NEBULAE = starsOf('nebula');

// the home sun's weight where its light is full: at the furthest fandom's world
const FULL = 5800;

function norm(a) {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
// '#rrggbb' → linear rgb (the renderer's working space)
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function linear(hex, mix = 0) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => toLinear(v / 255 + (1 - v / 255) * mix));
}

const starAt = (s, now) => (s.binary ? binaryAt(wonder(s.binary), now)[s.part] : s.at);

export function weightOf(star, point, now = 0) {
  const at = starAt(star, now);
  const d2 = (point[0] - at[0]) ** 2 + (point[1] - at[1]) ** 2 + (point[2] - at[2]) ** 2;
  const r = star.r ?? 1;
  return (star.strength / Math.max(d2, r * r)) * smoothstep(star.reach * 1.5, star.reach, Math.sqrt(d2));
}
const REF = weightOf(STARS[0], [FULL, 0, 0]);

// the two heaviest stars at a point, each { star, at, w }
function heaviest(point, stars, now, nova) {
  let one = null;
  let two = null;
  const all = nova ? [...stars, { id: 'nova', at: nova.at, r: 1, colour: nova.colour, strength: nova.strength, reach: nova.reach ?? 2000 }] : stars;
  for (const star of all) {
    const w = weightOf(star, point, now);
    if (w <= 0) continue;
    const e = { star, at: starAt(star, now), w };
    if (!one || w > one.w) {
      two = one;
      one = e;
    } else if (!two || w > two.w) two = e;
  }
  return { one, two };
}

const from = (at, point) => norm([point[0] - at[0], point[1] - at[1], point[2] - at[2]]);

export function lightAt(point, { stars = STARS, now = 0, nova = null } = {}) {
  const { one, two } = heaviest(point, stars, now, nova);
  if (!one) {
    // out past every star's reach: the floor, from the home sun's side
    return { star: null, source: null, key: { dir: from(SUN.at, point), colour: linear(STARS[0].colour, WHITE_MIX), strength: FLOOR }, fill: sky(), ambient: ambientAt(point) };
  }
  // the key's colour mixed with the runner-up's by weight: equal where the
  // two weigh the same, all the heavier's where the other is nothing
  const share = two ? two.w / (one.w + two.w) : 0;
  const a = linear(one.star.colour, WHITE_MIX);
  const b = two ? linear(two.star.colour, WHITE_MIX) : a;
  const colour = a.map((v, i) => v + (b[i] - v) * share);
  const strength = Math.min(KEY, Math.max(FLOOR, (KEY * one.w) / REF));
  const key = { dir: from(one.at, point), colour, strength };
  const fill =
    two && two.w > one.w * 0.1
      ? { dir: from(two.at, point), colour: linear(two.star.colour, WHITE_MIX), strength: Math.min(strength, Math.max(SKY_FILL.strength, (strength * two.w) / one.w)), sky: false }
      : sky();
  return { star: one.star.id, source: { id: one.star.id, at: one.at, r: one.star.r, colour: one.star.colour }, key, fill, ambient: ambientAt(point) };
}

function sky() {
  return { dir: [...SKY_FILL.dir], colour: linear(SKY_FILL.colour), strength: SKY_FILL.strength, sky: true };
}

// the sky's own light, a quarter of the way to a nebula's colour inside it
function ambientAt(point) {
  const colour = linear(AMBIENT.colour);
  for (const n of NEBULAE) {
    const d = Math.hypot(point[0] - n.at[0], point[1] - n.at[1], point[2] - n.at[2]);
    const k = 0.25 * smoothstep(n.r * 2, n.r, d);
    if (k <= 0) continue;
    const tint = linear(n.colors[0]);
    for (let i = 0; i < 3; i++) colour[i] += (tint[i] - colour[i]) * k;
  }
  return { colour, strength: AMBIENT.strength };
}

export function sunFor(planetId, { positions = POSITIONS, stars = STARS, now = 0 } = {}) {
  const p = positions[planetId];
  const { one } = heaviest(p, stars, now, null);
  const at = one ? one.at : SUN.at;
  return norm([at[0] - p[0], at[1] - p[1], at[2] - p[2]]);
}

// The way in to a planet: `dist` radii out from its middle, the direction
// you came from if that's well onto the day side, else round past the
// terminator on the nearest side to a sun 30° up the sky (so the planet
// shows more than a half moon), never straight down the line from behind.
const DAY = 0.5; // sin 30°
export function daySideApproach(at, sunDir, radius, from, { dist = 2.2 } = {}) {
  const s = norm(sunDir);
  let d = norm([from[0] - at[0], from[1] - at[1], from[2] - at[2]]);
  const k = d[0] * s[0] + d[1] * s[1] + d[2] * s[2];
  if (k < DAY) {
    // the part of the way you came across the sun's line…
    let side = [d[0] - s[0] * k, d[1] - s[1] * k, d[2] - s[2] * k];
    if (Math.hypot(...side) < 1e-6) {
      // (straight behind: any way round, level if it can be)
      side = Math.abs(s[1]) < 0.9 ? [-s[2], 0, s[0]] : [1, 0, 0];
    }
    side = norm(side);
    const c = Math.sqrt(1 - DAY * DAY);
    // …turned 30° into the day
    d = norm([side[0] * c + s[0] * DAY, side[1] * c + s[1] * DAY, side[2] * c + s[2] * DAY]);
  }
  const r = radius * dist;
  return [at[0] + d[0] * r, at[1] + d[1] * r, at[2] + d[2] * r];
}
