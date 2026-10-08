// Where your ship sets down: at the world's pad (site.land) on your own
// side's world, a Hutt one (they'd sooner sell you than shoot you) or one
// whose war you haven't sworn in; on a world the other side of your war
// holds, out of sight of the garrison it keeps at the pad (garrison.js's
// garrisonAt), at the site's own `covert` spot, or, where it has none, the
// best of a ring of spots round the pad. Pure: no three.js. The design:
// docs/superpowers/specs/2026-10-07-ground-sides-kashyyyk-look-ai-design.md §3.
//
// landingFor(site, effects, height) → { at, yaw, covert, line }: `effects`
// is the ground's (siteWar.js's groundEffects: owner, side…), `height` the
// land's (x, z) → y. covertFor(site, height) → [x, z], or null where the
// ring has nowhere dry and level to put a ship down.
import { SIDES, otherSide } from '../sides.js';
import { REACH } from './terrain';

const RINGS = [150, 185, 220];
const BEARINGS = 8; // on each ring: 24 spots in all
const SLOPE = 0.25; // (rise over run, sampled 3 m either side)
const EYE = 1.8; // a trooper's eyes, over the pad and over the ship

// Where the landing party stands, worked out as garrisonAt places it: posts
// on a 26 m ring round the pad, and the corners of the beats at 34 and 48 m.
function garrisonPoints([x, z]) {
  const out = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.6;
    out.push([x + Math.cos(a) * 26, z + Math.sin(a) * 26]);
  }
  for (const r of [34, 48]) out.push([x + r, z], [x, z + r], [x - r, z], [x, z - r]);
  return out;
}

// a site's id as a number, so its ties break the same way every time
function seedOf(id = '') {
  let s = 2166136261;
  for (let i = 0; i < id.length; i++) s = Math.imul(s ^ id.charCodeAt(i), 16777619);
  return (s >>> 0) / 4294967296;
}

// Does the land rise between the pad and the spot, over a trooper's line of sight?
function hidden(height, from, to) {
  const y0 = height(...from) + EYE;
  const y1 = height(...to) + EYE;
  for (let k = 1; k < 24; k++) {
    const t = k / 24;
    if (height(from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t) > y0 + (y1 - y0) * t) return true;
  }
  return false;
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// The spots on the rings that a ship can set down on: dry, level enough,
// well inside the world and clear of its places and their things. Of those,
// the one furthest from the garrison and flattest, and better still where
// the land hides it from the pad.
export function covertFor(site, height) {
  const pad = site.land.at;
  const posts = garrisonPoints(pad);
  const dry = (site.water?.level ?? -Infinity) + 0.3;
  const reach = (site.reach ?? REACH) - 40;
  const things = site.things_all ?? site.things ?? [];
  const seed = seedOf(site.id);
  let best = null;
  let bestScore = -Infinity;
  RINGS.forEach((r, ring) => {
    for (let i = 0; i < BEARINGS; i++) {
      const a = ((i + seed + ring / RINGS.length) / BEARINGS) * Math.PI * 2;
      const at = [pad[0] + Math.cos(a) * r, pad[1] + Math.sin(a) * r];
      if (Math.hypot(...at) > reach) continue;
      const y = height(...at);
      if (!(y > dry)) continue;
      const slope = Math.max(Math.abs(height(at[0] + 3, at[1]) - height(at[0] - 3, at[1])), Math.abs(height(at[0], at[1] + 3) - height(at[0], at[1] - 3))) / 6;
      if (slope > SLOPE) continue;
      if ((site.places ?? []).some((p) => dist(at, p.at) < p.r + 12)) continue;
      if (things.some((t) => t.at && dist(at, t.at) < 16)) continue;
      const far = Math.min(...posts.map((p) => dist(at, p)));
      const score = far / 100 - slope * 4 + (hidden(height, pad, at) ? 1 : 0) + ((seed * 997 + i * 0.618 + ring * 0.414) % 1) * 1e-3;
      if (score > bestScore) {
        bestScore = score;
        best = at.map((v) => +v.toFixed(1));
      }
    }
  });
  return best;
}

// side on to the pad: its right, where you climb out, towards the pad, so it
// comes in and goes out past the garrison rather than over it
const sideOn = (at, pad) => Math.atan2(-(pad[1] - at[1]), pad[0] - at[0]);

export function landingFor(site, effects, height) {
  const pad = { at: site.land.at, yaw: site.land.yaw, covert: false, line: null };
  const owner = effects?.owner;
  const side = effects?.side;
  if (!side || !owner || otherSide(side) !== owner) return pad;
  const at = site.covert?.at ?? covertFor(site, height);
  if (!at) return pad;
  return {
    at: [...at],
    yaw: site.covert?.yaw ?? sideOn(at, site.land.at),
    covert: true,
    line: `${SIDES[owner].short}-held. We set down out of sight of the garrison.`,
  };
}
