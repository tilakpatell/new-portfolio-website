// Mario's body between the rules and the model. pose.js says what each of
// his actions looks like; this eases him from one into the next (stopping,
// landing, the end of a punch used to pop from one pose to the other in a
// frame), paces his legs to the ground he covers (a phase from distance,
// lib/three/gait.js, never from the clock, and a stride that lengthens as
// he speeds up, so his feet keep to the ground at a walk and flat out), runs
// his actions on between the rules' steps (a flip turns smoothly on a fast
// screen), and turns his head: a look round when he's stood a while, as he
// does in the game, and toward whatever's near and worth a look.
//
// createMarioBody({ leg, seed }) → { pose(m, { dt, alpha, live, look }) →
//   a pose for the model's apply(), phase }
//   m: the rules' Mario; dt: frames since the last call (the rules' 30 a
//   second); alpha: how far between the rules' last two steps; live: the
//   rules are stepping him (in play, at a star), so his action's time runs
//   on between steps, else it holds (a dialog, the pause) but for a death,
//   which plays through on its own clock; look: lookFor()'s turn, or null.
//   leg: his hip's height (metres); seed: where in his stride he starts.
// strideAt(speed, leg) → the ground a cycle of his legs covers at `speed`
//   metres a second; swingFor(stride, leg) → how far each leg swings either
//   way for it. MAX_SWING: as far as a leg goes.
// blendPose(from, to, k) → a pose k (0…1) of the way from one to the other:
//   the flips' spin the short way round, the offset (a ledge's hang, which
//   the rules' position needs) always the new one's.
// lookFor(m, actors, { range }) → the turn (radians, + to his left) toward
//   the nearest thing worth a look in front of him, or null.
// lookRound(t) → the idle's look round at `t` frames into standing still.
// faceFor(a, m, ruled), easeFace(drawn, a, want, dt) → the cast's yaw as
//   drawn: eased round at each one's own rate (TURNS), not snapped.
//
// Pure: no three.js.

import { createGait, turn } from '../../lib/three/gait';
import { JOINTS, SLEEP_AFTER, poseFor } from './pose';

export const MAX_SWING = 1.1; // radians: as far as a leg reaches either way
const STEP = 1 / 30; // the rules' frame, in seconds
const PER_FRAME = 30 * 0.01; // units a frame to metres a second
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const ease = (v) => {
  const t = clamp(v, 0, 1);
  return t * t * (3 - 2 * t);
};

export const strideAt = (speed, leg) => clamp(leg * (1.2 + 0.4 * Math.abs(speed)), leg * 0.6, 4 * leg * Math.sin(MAX_SWING));
export const swingFor = (stride, leg) => Math.asin(clamp(stride / (4 * leg), 0, Math.sin(MAX_SWING)));

// frames to blend into each action: his game's moves are quick, so a jump,
// a punch or a landing takes a frame or two, a stop a few
const BLEND = { idle: 5, walk: 3, stop: 3, skid: 3, crouch: 3, crawl: 3, land: 2, poundland: 1, jump: 2, double: 2, triple: 2, backflip: 2, sideflip: 2, longjump: 2, wallkick: 2, punch: 2, jumpkick: 2, dive: 2, knockback: 2, airhit: 2, ledge: 2, climb: 2, dead: 4 };
const BLEND_ELSE = 4;
// the actions he can look about in, and how far his head turns in each
const LOOKS = { idle: 1.1, stop: 0.8, crouch: 0.7, hold: 0.7, walk: 0.55, holdwalk: 0.55, crawl: 0.4 };

export function blendPose(from, to, k) {
  const out = { joints: {}, lift: from.lift + (to.lift - from.lift) * k, offset: [...to.offset], spin: [0, 0, 0], squash: from.squash + (to.squash - from.squash) * k };
  for (const j of JOINTS) {
    const a = from.joints[j];
    const b = to.joints[j];
    out.joints[j] = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  }
  for (let i = 0; i < 3; i++) out.spin[i] = to.spin[i] - wrap(to.spin[i] - from.spin[i]) * (1 - k);
  return out;
}

// what's worth a look, and how much (a star more than a Goomba, near more than far)
const WORTH = { goomba: 3, bobomb: 3, king: 4, chomp: 4, star: 5, toad: 3, oneup: 2, ironball: 2 };
const GONE = new Set(['flat', 'knocked', 'gone', 'held', 'defeated']);
export function lookFor(m, actors = [], { range = 900 } = {}) {
  let best = null;
  let score = 0;
  for (const a of actors) {
    const w = WORTH[a.type];
    if (!w || a.alive === false || GONE.has(a.state)) continue;
    const dx = a.pos.x - m.pos.x;
    const dz = a.pos.z - m.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > range || d < 1 || Math.abs(a.pos.y - m.pos.y) > 600) continue;
    const rel = wrap(Math.atan2(dx, dz) - m.yaw);
    if (Math.abs(rel) > 2) continue; // behind him: he'd have to turn round
    const s = w / d;
    if (s > score) {
      score = s;
      best = rel;
    }
  }
  return best;
}

// the look round: after three seconds still, to his left, to his right and
// back, every eight seconds, until he nods off
const LOOK_AFTER = 90;
const LOOK_EVERY = 240;
const ROUND = [
  [0, 0],
  [0.1, 0.75],
  [0.3, 0.75],
  [0.45, -0.75],
  [0.65, -0.75],
  [0.78, 0],
  [1, 0],
];
export function lookRound(t) {
  if (!(t >= LOOK_AFTER) || t >= SLEEP_AFTER) return 0;
  const c = ((t - LOOK_AFTER) % LOOK_EVERY) / LOOK_EVERY;
  for (let i = 1; i < ROUND.length; i++) {
    const [b, vb] = ROUND[i];
    if (c > b) continue;
    const [a, va] = ROUND[i - 1];
    return va + (vb - va) * ease((c - a) / (b - a));
  }
  return 0;
}

// The cast's turns, drawn: the rules turn a Goomba about at a wall, a
// Bob-omb on its wander and Toad to Mario in a single step, and the Chain
// Chomp only when it bites; drawn, each comes round at its own rate (a
// Goomba's quick, Toad's unhurried), and the Chomp watches Mario while it
// waits on its chain, so its lunge comes from where it's been looking.
// Held, thrown, knocked flying or biting, each faces where the rules have it.
export const TURNS = { goomba: 12, bobomb: 10, toad: 6, chomp: 8 };
const AT_ONCE = new Set(['held', 'thrown', 'knocked', 'lunge', 'free', 'gone']);
// where a cast member looks, drawn: `ruled` is the rules' yaw
export function faceFor(a, m, ruled) {
  if (a.type === 'chomp' && a.state === 'idle' && m?.pos) return Math.atan2(m.pos.x - a.pos.x, m.pos.z - a.pos.z);
  return ruled;
}
// and the yaw drawn this frame, from the last one drawn (null: the first)
export function easeFace(drawn, a, want, dt) {
  const rate = TURNS[a.type];
  if (drawn == null || !rate || AT_ONCE.has(a.state)) return want;
  return turn(drawn, want, dt * STEP, rate);
}

export function createMarioBody({ leg = 0.56, seed = 0 } = {}) {
  const gait = createGait({ stride: 1, cadence: [1.6, 3.6], seed });
  let key = null;
  let from = null;
  let last = null;
  let since = 0; // frames since the action changed
  let span = 0;
  let head = 0;
  let phase = gait.step(0, 0).phase;
  return {
    get phase() {
      return phase;
    },
    pose(m, { dt = 1, alpha = 1, live = true, look = null } = {}) {
      const d = Number.isFinite(dt) && dt > 0 ? dt : 0;
      const now = m.action === 'punch' ? `punch${m.arg}` : m.action;
      if (now !== key) {
        from = last;
        key = now;
        since = 0;
        span = BLEND[m.action] ?? BLEND_ELSE;
      } else since += d;
      const t = m.action === 'dead' ? since : live ? Math.max(0, m.t - 1 + clamp(alpha, 0, 1)) : m.t;
      // the stride: the ground he covers this frame, in cycles of his legs
      const speed = Math.abs(m.fwd ?? 0) * PER_FRAME;
      const stride = strideAt(speed, leg);
      const step = gait.step(d * STEP, speed / stride);
      phase = step.phase;
      const p = poseFor(m.action, t, { fwd: m.fwd, phase: step.phase, swing: swingFor(stride, leg), amount: step.amount, arg: m.arg, pitch: m.pitch ?? 0, vy: m.vel?.y ?? 0 });
      // the head: what he's looking at, else his look round, eased
      const most = LOOKS[m.action];
      const want = most ? clamp(look ?? (m.action === 'idle' ? lookRound(t) : 0), -most, most) : 0;
      head = turn(head, want, d * STEP, 6);
      p.joints.head[1] += head;
      const out = from && since < span ? blendPose(from, p, ease(since / span)) : p;
      last = out;
      return out;
    },
  };
}

