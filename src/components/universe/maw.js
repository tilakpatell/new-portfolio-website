// The Maw, the black hole out in deep space (deep.js): its pull, and the fall
// into it. Pure numbers, so it's tested in Node: the scene adds the pull to
// the ship's flight and plays the fall from these, deepspace.js tips its
// disk by TILT.
//
// Come within MAW.reach and it starts to pull you in, harder the closer you
// get (as the square of how close), and carries you round with its disk as
// it does. Out at the edge of it you can fly away; nearer in it takes the
// boost; past MAW.capture there's no getting out, and the fall begins. The
// fall is in three parts, timed from the moment it has you:
// - the spiral (0 … MAW.spiral): round and down, up over its pole (in the
//   plane through its pole and where the ship was), a turn and a quarter,
//   faster and faster as it closes on the shadow, the ship stretched out
//   along the way it's going (spaghetti). The camera watches from well off,
//   facing that plane and nearly level with the disk: the disk edge-on, a
//   bright band with its far side bent up over the shadow and under it, and
//   the ship's whole way down against the dark round it;
// - the horizon (… MAW.horizon): seen from outside, a thing falling in never
//   quite gets there. It slows, reddens and fades, held at the edge of the
//   shadow, and its last light runs round the ring;
// - the plunge (MAW.plunge … MAW.through): the camera goes in after it, and
//   the shadow fills everything. Then the page goes on through (Universe.jsx).

import { WONDERS } from './deep';

const HOLE = WONDERS.find((w) => w.kind === 'black-hole');

// how the Maw's disk is tipped (an Euler turn, XYZ, of the plane y = 0)
export const TILT = [0.36, 0.5, -0.18];

export const MAW = {
  id: HOLE.id,
  at: HOLE.at,
  shadow: HOLE.r, // the radius of its shadow (the black sphere that draws it)
  reach: 120, // where its pull starts, from its middle
  capture: 56, // the point of no return
  pull: 8, // how fast it draws you in at the point of no return, map units a second
  swirl: 0.6, // and carries you round with the disk, as a share of that
  turns: 1.25, // round it on the way down
  edge: 1.14, // where the spiral ends, in shadows: at the light ring
  spiral: 2.7, // seconds, from the point of no return to the edge of the shadow
  horizon: 3.8, // held there, fading, till this
  plunge: 3.5, // the camera goes in after it from here
  through: 4.9, // and it's through: the page takes over
  witness: 105, // how far off the camera watches the fall from
  above: 0.14, // and how far above (or below) the disk's plane, radians
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, v) => {
  const k = clamp01((v - a) / (b - a));
  return k * k * (3 - 2 * k);
};
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const norm = (a) => {
  const l = len(a);
  return l > 1e-9 ? scale(a, 1 / l) : [0, 0, 0];
};

// the disk's normal: up, turned by TILT (three.js's XYZ order: Rx·Ry·Rz).
// The disk goes round it the right-handed way (counterclockwise seen from
// the side it points to), as deepspace.js draws it
export const DISK_N = (() => {
  const [x, y, z] = TILT;
  const [a, b] = [Math.cos(x), Math.sin(x)];
  const [c, d] = [Math.cos(y), Math.sin(y)];
  const [e, f] = [Math.cos(z), Math.sin(z)];
  return norm([-c * f, a * e - b * f * d, b * e + a * f * d]);
})();

// The pull at (x, y, z): { v: [vx, vy, vz], the drift it adds to the ship's
// flight, in map units a second; k: how hard it has you, 0 out past its
// reach … 1 at the point of no return; d: how far from its middle }, or
// null out of its reach.
export function pullAt(x, y, z) {
  const rel = sub([x, y, z], MAW.at);
  const d = len(rel);
  if (d >= MAW.reach || d < 1e-6) return null;
  const s = MAW.pull * (MAW.capture / Math.max(d, MAW.capture)) ** 2 * (1 - smooth(MAW.reach * 0.62, MAW.reach, d));
  const inward = scale(rel, -1 / d);
  // round with the disk, in its plane (nothing about its poles)
  const round = cross(DISK_N, rel);
  const r = len(round);
  const swirl = r > 1e-6 ? scale(round, (s * MAW.swirl * Math.min(1, r / d)) / r) : [0, 0, 0];
  return { v: [inward[0] * s + swirl[0], inward[1] * s + swirl[1], inward[2] * s + swirl[2]], k: s / MAW.pull, d };
}

// past the point of no return
export const captured = (x, y, z) => len(sub([x, y, z], MAW.at)) <= MAW.capture;

// The fall, from where it had the ship (and where the camera was, `cam`, to
// keep the camera's swing round to watch it short): { from, r0, u, v, view }.
// The ship goes round in the plane of u (out toward where it started) and v
// (up over the pole from there); view is the way from the hole to where the
// camera watches from, facing that plane, a little above the disk's
export function startFall(from, cam = from) {
  const rel = sub(from, MAW.at);
  const r0 = Math.max(len(rel), MAW.shadow * MAW.edge);
  let u = norm(rel);
  if (len(u) === 0) u = norm(cross(DISK_N, [1, 0, 0]));
  // straight down a pole: over any side will do
  let v = sub(DISK_N, scale(u, dot(DISK_N, u)));
  v = len(v) > 1e-6 ? norm(v) : norm(cross(u, Math.abs(u[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1]));
  // facing the plane, from the camera's side of it and of the disk
  const toCam = sub(cam, MAW.at);
  let m = norm(cross(u, v));
  if (dot(m, toCam) < 0) m = scale(m, -1);
  const b = MAW.above * (dot(toCam, DISK_N) < 0 ? -1 : 1);
  const view = norm([0, 1, 2].map((i) => m[i] * Math.cos(b) + DISK_N[i] * Math.sin(b)));
  return { from: [...from], r0, u, v, view };
}

// where it is along the spiral at k (0 … 1): radius and angle. The angle
// runs faster as the radius closes (the inner disk goes round faster too)
const spiralAt = (f, k) => {
  const end = MAW.shadow * MAW.edge;
  return { r: end + (f.r0 - end) * (1 - k) ** 1.8, a: Math.PI * 2 * MAW.turns * k ** 1.8 };
};
// the same, held at the edge of the shadow (t: 0 … 1 through the horizon):
// slower and slower, closing on the shadow but never through it
const heldAt = (f, t) => {
  const edge = MAW.shadow * MAW.edge;
  const last = MAW.shadow * 1.03;
  // the angle's rate where the spiral left off (radians per unit of k, over its seconds)
  const rate = (Math.PI * 2 * MAW.turns * 1.8) / MAW.spiral;
  const span = MAW.horizon - MAW.spiral;
  return { r: edge - (edge - last) * (1 - (1 - t) ** 3), a: Math.PI * 2 * MAW.turns + ((rate * span) / 3.2) * (1 - Math.exp(-3.2 * t)) };
};
const place = (f, { r, a }) => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [0, 1, 2].map((i) => MAW.at[i] + (f.u[i] * c + f.v[i] * s) * r);
};

// The ship at `age` seconds into the fall: { at: [x, y, z], dir (the way it's
// going), stretch (how drawn out, 0 … 1), glow (its light, 1 … 0 as it
// fades at the horizon), red (how reddened, 0 … 1), held (at the horizon),
// gone (faded out: from here it's the camera's turn) }
export function fallAt(f, age) {
  const pos = (t) => (t <= MAW.spiral ? place(f, spiralAt(f, clamp01(t / MAW.spiral))) : place(f, heldAt(f, clamp01((t - MAW.spiral) / (MAW.horizon - MAW.spiral)))));
  const t = Math.max(0, age);
  const at = pos(t);
  const dir = norm(sub(pos(t + 0.02), at));
  const k = clamp01(t / MAW.spiral);
  const held = clamp01((t - MAW.spiral) / (MAW.horizon - MAW.spiral));
  return {
    at,
    dir: len(dir) > 0 ? dir : norm(sub(MAW.at, at)),
    stretch: k * k,
    glow: 1 - held ** 1.5,
    red: smooth(0.55, 1, k) * 0.5 + held * 0.5,
    held: t > MAW.spiral,
    gone: t >= MAW.horizon,
  };
}

// 0 … 1, how far the camera has gone in after it
export const plungeAt = (age) => smooth(MAW.plunge, MAW.through, age);
