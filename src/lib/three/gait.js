// How a figure without clips walks: the toy figures, creatures and built
// people whose legs are turned by a pose function rather than played. A
// pose function used to read `t × 13` for its legs, so a figure that sped
// up or slowed down jumped to another place in its stride and one standing
// still kept marching; this gives it a phase from the ground it covers
// instead, and eases its start, its stop and its change into a run.
// (docs/superpowers/specs/2026-10-07-living-characters-design.md, gait.js)
//
// createGait({ stride, cadence: [lo, hi], seed }) → { step(dt, speed) →
//   { phase, amount, run } }
//   stride: the ground one full cycle covers (left foot down to left foot
//   down again), in the units `speed` is in a second. phase (0…2π) moves
//   on by 2π for every stride of ground, backward when speed is negative,
//   so a change of pace never moves a leg; amount (0…1) eases from 0
//   standing to 1 moving over a quarter second; run (0…1) eases toward
//   running as the cycles a second climb from lo to hi. seed (an integer:
//   a figure's index or id) picks where in its stride a figure starts, so
//   a crowd doesn't step in time.
// turn(current, want, dt, rate) → the yaw eased toward want the short way
//   round, by time (the same at 30 frames a second as at 144), never past.
// breathe(t, seed) → −1…1: an idle's rise and fall, a breath every three
//   to five seconds, its pace and place in it the figure's own.
// sway(phase, amount) → { bob, roll }: a step-in-time rise and lean for a
//   figure that can't move its legs (a statue until it's rigged): bob rises
//   0…amount, highest over each foot (phase 0 and π) and lowest with both
//   down between, so the feet hide in the dip; roll leans −amount…amount,
//   + at phase 0 and − at π, onto whichever foot the caller puts down at 0.
//   The caller scales both (metres, radians) to its figure.
//
// Pure: no three.js. Every dt is clamped to a tenth of a second, so a long
// frame (a tab come back from the background) is one ordinary step, and a
// dt of 0 or NaN moves nothing.

import { seeded } from '../seeded';

const TAU = Math.PI * 2;
const EASE = 0.25; // seconds for amount to go from standing to moving
const RUN_EASE = 0.4; // seconds for run to go from a walk to a run
const LONGEST = 0.1; // the most a frame is allowed to count for

const smooth = (k) => k * k * (3 - 2 * k);
const toward = (v, want, by) => (v < want ? Math.min(want, v + by) : Math.max(want, v - by));
const clampDt = (dt) => (dt > 0 ? Math.min(dt, LONGEST) : 0);

export function createGait({ stride = 1, cadence = [1, 1.6], seed = 0 } = {}) {
  const len = stride > 0 ? stride : 1;
  const [lo, hi] = cadence;
  const span = Math.max(1e-6, hi - lo);
  let phase = seeded(seed)() * TAU;
  // eased on a straight line, then smoothed on the way out, so each
  // reaches 0 and 1 exactly and doesn't lurch at either end
  let moving = 0;
  let running = 0;

  const step = (dt, speed) => {
    const d = clampDt(dt);
    const s = Number.isFinite(speed) ? speed : 0;
    phase += ((s * d) / len) * TAU;
    phase -= TAU * Math.floor(phase / TAU);
    const pace = Math.abs(s) / len; // cycles a second
    moving = toward(moving, pace > 0.02 ? 1 : 0, d / EASE);
    const runWant = Math.min(1, Math.max(0, (pace - lo) / span));
    running = toward(running, runWant, d / RUN_EASE);
    return { phase, amount: smooth(moving), run: smooth(running) };
  };

  return { step };
}

export function turn(current, want, dt, rate = 6) {
  const k = 1 - Math.exp(-rate * clampDt(dt));
  if (!(k > 0) || !Number.isFinite(want)) return current;
  let d = want - current;
  if (d > Math.PI || d < -Math.PI) d -= TAU * Math.round(d / TAU);
  return current + d * k;
}

export function breathe(t, seed = 0) {
  if (!Number.isFinite(t)) return 0;
  const r = seeded(seed);
  const period = 3.4 + r(); // 3.4 to 4.4 seconds a breath
  const a = (t / period) * TAU + r() * TAU;
  // the breath in comes a little quicker than the breath out
  return Math.sin(a + 0.3 * Math.sin(a));
}

export function sway(phase, amount) {
  if (!(amount > 0)) return { bob: 0, roll: 0 };
  return { bob: (amount * (1 + Math.cos(2 * phase))) / 2, roll: amount * Math.cos(phase) };
}
