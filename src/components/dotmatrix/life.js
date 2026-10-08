// The island's box people, alive, and still all boxes. Their legs used to
// swing on a clock (the hero's stepped about a third of the ground he
// covered, so he skated, and every villager started on the same foot);
// here a stride is paced to the ground covered and lengthens as they speed
// up, and while a foot is down it goes back under them at an even pace,
// so it stays where it landed. A villager turns its head to the hero as he
// comes near and waves the first time he comes up; a walker comes round
// at the end of its beat instead of flipping; and the other islanders
// online strike their emotes in boxes.
//
// LEG: a figure's leg (hip to sole) at scale 1, in metres.
// strideAt(speed, leg), swingFor(stride, leg): the ground a stride covers
//   at a speed (metres a second), and how far each leg swings for it.
// stepAt(phase) → where a foot is along its stride, −1 behind … 1 ahead:
//   down from π/2 to 3π/2 at an even pace, then up and forward again.
// legAngle(phase, swing) → a box leg's rotation.x (+ is back) for a foot
//   there, its leg swinging `swing` either way.
// createStride({ leg, seed }) → { step(dt, speed) → { phase, amount, swing,
//   run } }: the phase from the ground covered (lib/three/gait.js), amount
//   eased from standing to walking, the swing for the stride it's on.
// createNotice({ look, greet, part }) → { step(dt, dist, rel) → { look,
//   wave, waving } }: dist the hero's distance, rel his bearing from where
//   it faces; look the head's turn (eased, ±1.1); wave 0…1 while it waves
//   hello (once each time he comes within `greet`, again only after he's
//   gone beyond `part`), waving its hand side to side (−1…1).
// walkerStride(w, t) → { phase, face, stride }: a walker (rules.js's
//   WALKERS) at time t: its feet's phase by the ground it's covered, and
//   the way it faces, coming round over the last and first steps of each
//   end of its beat.
// boxEmote(id, t) → { armL: [x, z], armR: [x, z], legL, legR, lift, head }
//   | null: a box figure's limbs `t` seconds into one of lib/emote.js's
//   emotes; BOX_EMOTES, the ones it knows.
//
// Pure: no three.js.

import { createGait, turn } from '../../lib/three/gait';

export const LEG = 0.32;
const MAX_SWING = 0.95;
const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const ease = (v) => {
  const t = clamp(v, 0, 1);
  return t * t * (3 - 2 * t);
};

export const strideAt = (speed, leg) => clamp(leg * (1.6 + 0.55 * Math.abs(speed)), leg * 0.8, 4 * leg * Math.sin(MAX_SWING));
export const swingFor = (stride, leg) => Math.asin(clamp(stride / (4 * leg), 0, Math.sin(MAX_SWING)));

// (the same foot as Mario 64's: ../mario64/pose.js)
export function stepAt(phase) {
  let a = (phase - Math.PI / 2) % TAU;
  if (a < 0) a += TAU;
  if (a <= Math.PI) return 1 - (2 * a) / Math.PI;
  const s = (a - Math.PI) / Math.PI;
  return ((-8 * s + 12) * s - 2) * s - 1;
}

export const legAngle = (phase, swing) => -Math.asin(clamp(stepAt(phase) * Math.sin(Math.min(1.15, swing)), -1, 1));

export function createStride({ leg = LEG, seed = 0 } = {}) {
  const gait = createGait({ stride: 1, cadence: [1.4, 3.2], seed });
  return {
    step(dt, speed) {
      const v = Number.isFinite(speed) ? Math.abs(speed) : 0;
      const stride = strideAt(v, leg);
      const st = gait.step(dt, v / stride);
      return { phase: st.phase, amount: st.amount, run: st.run, swing: swingFor(stride, leg) };
    },
  };
}

const WAVE = 1.6; // seconds a wave hello lasts
export function createNotice({ look = 5, greet = 3, part = 6 } = {}) {
  let head = 0;
  let greeted = false;
  let waveT = Infinity;
  return {
    step(dt, dist, rel) {
      const d = dt > 0 ? Math.min(dt, 0.1) : 0;
      const sees = dist < look;
      head = turn(head, sees ? clamp(Number.isFinite(rel) ? rel : 0, -1.1, 1.1) : 0, d, 5);
      if (dist > part) greeted = false;
      if (dist < greet && !greeted) {
        greeted = true;
        waveT = 0;
      } else waveT += d;
      const wave = waveT < WAVE ? ease(waveT / 0.25) * ease((WAVE - waveT) / 0.3) : 0;
      return { look: head, wave, waving: Math.sin(waveT * 11) };
    },
  };
}

// walkers: their beat's ends turned round over this much ground either side
const WALKER_TURN = 0.35;
export const WALKER_STRIDE = 0.48;
export function walkerStride(w, t) {
  const [ax, az] = w.from;
  const [bx, bz] = w.to;
  const len = Math.hypot(bx - ax, bz - az);
  const s = Math.max(0, t) * w.speed;
  const out = Math.atan2(bx - ax, bz - az);
  const u = s % (2 * len);
  // half a turn round each end, all the way round once a beat
  let k = 0;
  if (u > len - WALKER_TURN && u < len + WALKER_TURN) k = ease((u - (len - WALKER_TURN)) / (2 * WALKER_TURN));
  else if (u >= len + WALKER_TURN) k = 1;
  if (u > 2 * len - WALKER_TURN) k = 1 + ease((u - (2 * len - WALKER_TURN)) / (2 * WALKER_TURN));
  else if (u < WALKER_TURN) k = 1 + ease((u + WALKER_TURN) / (2 * WALKER_TURN));
  return { phase: ((s / WALKER_STRIDE) * TAU) % TAU, face: out + Math.PI * k, stride: WALKER_STRIDE };
}

// lib/emote.js's five, in boxes (arm [x, z]: x − forward and up, z out to the side)
const EMOTE_BODY = {
  wave: (t) => ({ armL: [0, 0], armR: [-2.7, -0.25 + Math.sin(t * 11) * 0.35], legL: 0, legR: 0, lift: 0, head: Math.sin(t * 2) * 0.05 }),
  cheer: (t) => {
    const pump = Math.abs(Math.sin(t * 7));
    return { armL: [-2.6 - pump * 0.3, 0.3], armR: [-2.6 - pump * 0.3, -0.3], legL: 0, legR: 0, lift: pump * 0.08, head: -0.1 };
  },
  dance: (t) => {
    const s = Math.sin(t * 6);
    return { armL: [-1.4 + s * 0.8, 0.6], armR: [-1.4 - s * 0.8, -0.6], legL: s * 0.35, legR: -s * 0.35, lift: Math.abs(s) * 0.05, head: s * 0.2 };
  },
  taunt: (t) => ({ armL: [0.3, 1.0], armR: [0.3, -1.0], legL: -0.1, legR: 0.1, lift: 0, head: Math.sin(t * 5) * 0.3 }),
  sit: (t) => {
    const k = ease(t / 0.5);
    return { armL: [-0.4 * k, 0.2 * k], armR: [-0.4 * k, -0.2 * k], legL: -1.45 * k, legR: -1.45 * k, lift: -0.3 * k, head: 0 };
  },
};
export const BOX_EMOTES = Object.keys(EMOTE_BODY);
export function boxEmote(id, t) {
  const f = EMOTE_BODY[id];
  return f ? f(Math.max(0, Number.isFinite(t) ? t : 0)) : null;
}
