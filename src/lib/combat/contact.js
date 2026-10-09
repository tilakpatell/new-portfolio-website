// Ship contact: what happens when your ship flies into another ship. The law
// is shared by every map you fly (the universe and the galaxy), so it knows
// no world and no three.js; a scene reads its numbers, never copies them.
//
// CONTACT: every number of the law (closing speeds in units a second).
// bodyRadius(size) → a ship's body for contact, from its size (its length).
// sweptSpheres(a0, a1, b0, b1, r) → how far through the frame (0 to 1) two
//   spheres moving at once came within `r` of each other, or null. Points
//   are { x, y, z } or [x, y, z].
// closingSpeed(vYou, vThem, normal) → how fast the two close along `normal`
//   (pointing from them toward you), 0 when they part.
// contact(into, size) → { kind: 'glance' | 'ram', damage, punch, keep }:
//   under `soft` a glance (no harm, most of your speed kept); else a ram
//   (shields lost by the other ship's size and the closing speed, capped;
//   `punch` hits on the other ship; `keep` the share of your speed kept).
//
// A ship too big to move (a capital, a battleship) is not a body for this
// law: it is a solid, and ship.js's step bumps or crashes you on it as on a
// planet. Pure: no three.js.

export const CONTACT = {
  soft: 1.3, // closing speed under which it's a glance (SHIP.crash's 2.4 × 0.55, as a planet's soft bump)
  crash: 2.4, // and over which a big ship is a crash (SHIP.crash; a small ship is never a crash)
  base: 6, // shields a ram takes, at least
  perSize: 7, // and for each unit of the other ship's size (its length, as the fleets give it)
  perSpeed: 0.5, // and for each unit a second of closing speed past `soft`
  most: 45, // at most (ROCK_HIT.most)
  cool: 0.35, // seconds after a contact before another with the same ship counts
  slow: 0.3, // the share of your speed kept after a ram (ROCK_HIT.slow)
  glance: 0.85, // and after a glance
  punchEvery: 5, // a ram is one hit on the other ship, and one more for each of these units a second past `soft`
  punchMost: 4,
};

// tighter than hunterRules' hitRadius, which forgives a laser
export const bodyRadius = (size) => size * 0.5 + 0.08;

const X = (p) => (Array.isArray(p) ? p[0] : p.x);
const Y = (p) => (Array.isArray(p) ? p[1] : p.y);
const Z = (p) => (Array.isArray(p) ? p[2] : p.z);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// (targeting.js's sweptHit, moved here; it re-exports this.) Tested against
// where the other is only at the end of the frame, a quick one crossing the
// way would be missed, so both move at once.
export function sweptSpheres(a0, a1, b0, b1, r) {
  const rx = X(a0) - X(b0);
  const ry = Y(a0) - Y(b0);
  const rz = Z(a0) - Z(b0);
  const dx = X(a1) - X(b1) - rx;
  const dy = Y(a1) - Y(b1) - ry;
  const dz = Z(a1) - Z(b1) - rz;
  const dd = dx * dx + dy * dy + dz * dz;
  const k = dd > 1e-12 ? clamp(-(rx * dx + ry * dy + rz * dz) / dd, 0, 1) : 0;
  const px = rx + dx * k;
  const py = ry + dy * k;
  const pz = rz + dz * k;
  return px * px + py * py + pz * pz <= r * r ? k : null;
}

export function closingSpeed(vYou, vThem, normal) {
  return Math.max(
    0,
    (vThem.x - vYou.x) * normal.x + (vThem.y - vYou.y) * normal.y + (vThem.z - vYou.z) * normal.z,
  );
}

export function contact(into, size) {
  if (into < CONTACT.soft) return { kind: 'glance', damage: 0, punch: 0, keep: CONTACT.glance };
  const past = into - CONTACT.soft;
  return {
    kind: 'ram',
    damage: Math.min(CONTACT.most, CONTACT.base + CONTACT.perSize * size + CONTACT.perSpeed * past),
    punch: Math.min(CONTACT.punchMost, 1 + Math.floor(past / CONTACT.punchEvery)),
    keep: CONTACT.slow,
  };
}
