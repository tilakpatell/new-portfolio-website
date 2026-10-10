// An eclipse (director.js's 'eclipse'): a dark moon drifts across the sun
// that lights you, from where you are; its light dims as the moon covers
// the sun's disc and comes back as it goes, the lens's glare with it. The
// map's own bodies never move (layout.js), so the director brings one: a
// moon a little bigger than the sun looks from here, crossing it on a
// straight line a way out from you, total in the middle, and held across
// the sun's line from wherever you fly meanwhile (as a far body would be:
// no parallax against the stars). Pure (no
// three.js), so it's tested in Node; the scene draws the moon and dims the
// key light by the cover (1 − ECLIPSE.dim × k).
//
// canEclipse({ eye, sun }) → whether the sun looks small enough from eye
//   for one (close by a star, a moon over it would fill the sky)
// cover(a, b, d) → 0…1: how much of a disc of angular radius a another of
//   angular radius b hides, their middles d apart (radians)
// eclipseAt({ eye, sun: { at, r }, bodies: [{ at, r }] }) → { body, k } |
//   null: the body in front of the sun that hides the most of it from eye,
//   and how much (none in front, or hiding none: null)
// eclipsePlan({ eye, sun, rand }) → { turn, off, half, dist, r, time }: the
//   moon's way across the sun's line, ECLIPSE.dist out, clear of the sun at
//   both ends; bodyAt(plan, t, eye, sun) → where it is t seconds in, from
//   wherever eye is by then

export const ECLIPSE = {
  dist: 70, // map units out from you, toward the sun, the moon crosses at
  r: 4, // its radius, at the least (bigger for a sun that looks big: ECLIPSE.bigger)
  time: 22, // seconds from one side of the sun to the other
  over: 1.15, // how far past touching the sun's disc it starts and ends
  bigger: 1.5, // the least it looks, against how big the sun looks
  most: 0.07, // radians: a sun that looks bigger than this (you're close by it) has no eclipse
  dim: 0.85, // of the key light gone at totality
};

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (v) => Math.hypot(v[0], v[1], v[2]);
const unit = (v) => {
  const l = len(v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function cover(a, b, d) {
  if (d >= a + b) return 0;
  if (d <= b - a) return 1;
  if (d <= a - b) return (b * b) / (a * a);
  // (the lens where the two discs overlap)
  const a2 = a * a;
  const b2 = b * b;
  const alpha = Math.acos(clamp((d * d + a2 - b2) / (2 * d * a), -1, 1));
  const beta = Math.acos(clamp((d * d + b2 - a2) / (2 * d * b), -1, 1));
  const lens = a2 * alpha + b2 * beta - 0.5 * Math.sqrt(Math.max(0, (-d + a + b) * (d + a - b) * (d - a + b) * (d + a + b)));
  return clamp(lens / (Math.PI * a2), 0, 1);
}

export function eclipseAt({ eye, sun, bodies }) {
  const toSun = sub(sun.at, eye);
  const ds = len(toSun);
  const us = unit(toSun);
  const as = Math.asin(Math.min(1, sun.r / ds));
  let best = null;
  for (const body of bodies) {
    const tb = sub(body.at, eye);
    const db = len(tb);
    if (db >= ds || dot(tb, us) <= 0) continue;
    const ab = Math.asin(Math.min(1, body.r / db));
    const k = cover(as, ab, Math.acos(clamp(dot(unit(tb), us), -1, 1)));
    if (k > 0 && (!best || k > best.k)) best = { body, k };
  }
  return best;
}

// the sun's line from `eye` and two ways across it (a basis round it)
function across(eye, sun) {
  const u = unit(sub(sun.at, eye));
  const p1 = unit(cross(u, Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
  return { u, p1, p2: cross(u, p1), as: Math.asin(Math.min(1, sun.r / len(sub(sun.at, eye)))) };
}

export const canEclipse = ({ eye, sun }) => across(eye, sun).as < ECLIPSE.most;

export function eclipsePlan({ eye, sun, rand = Math.random, dist = ECLIPSE.dist, r: least = ECLIPSE.r, time = ECLIPSE.time }) {
  const { as } = across(eye, sun);
  // (at least `least`, and always half as wide again as the sun looks: a big
  // star close by needs a big moon)
  const r = Math.max(least, dist * Math.sin(Math.min(1.2, as * ECLIPSE.bigger)));
  const ab = Math.asin(Math.min(1, r / dist));
  // across the sun's line at some angle round it, a little off its middle
  // (never so far off that it isn't total)
  return {
    turn: rand() * Math.PI * 2,
    off: (rand() * 2 - 1) * 0.25 * Math.max(0, ab - as) * dist,
    half: (ab + as) * dist * ECLIPSE.over,
    dist,
    r,
    time,
  };
}

// where the moon is t seconds in, seen from `eye` (wherever you've flown to
// since: it's held across the sun's line from you, as a far body is, not
// left behind beside where you were)
export function bodyAt(plan, t, eye, sun) {
  const { u, p1, p2 } = across(eye, sun);
  const k = clamp(t / plan.time, 0, 1);
  const s = (k * 2 - 1) * plan.half;
  const [c, d] = [Math.cos(plan.turn), Math.sin(plan.turn)];
  return [0, 1, 2].map((i) => eye[i] + u[i] * plan.dist + (p1[i] * c + p2[i] * d) * s + (-p1[i] * d + p2[i] * c) * plan.off);
}
