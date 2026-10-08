// Mario's body for each action, made in code: the rotation of every joint
// ([x, y, z] radians in the joint's own frame; a limb hangs down, and a
// negative x swings it forward), how far the whole body is lifted and
// moved (metres, in his own frame: +z is the way he faces), its spin (the
// flips: a positive x tips him forward) and its squash. The game's moves
// need their own poses anyway (the triple jump's flip, the long jump's
// stretch, the pound's tuck, the swim), so this drives the stand-in and a
// loaded model alike.
//
// poseFor(action, t (frames in the action), { fwd, phase (the run cycle),
// swing, amount (./motion.js's stride: how far each leg reaches, and how
// far into walking he is), arg, pitch, vy }) → { joints, lift, offset,
// spin, squash }
// stepAt(phase) → where a foot is along its stride, −1 (behind) … 1 (ahead)

export const JOINTS = ['hips', 'spine', 'head', 'armL', 'foreL', 'armR', 'foreR', 'legL', 'shinL', 'legR', 'shinR'];
export const TRIPLE_FRAMES = 22; // the triple jump's flip, start to finish
export const SLEEP_AFTER = 600; // frames stood still before he sits down and nods off
const TAU = Math.PI * 2;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (v) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};

// A foot through one stride: planted ahead at phase π/2, it goes back under
// him at an even pace until 3π/2 (so, the stride paced to the ground, it
// keeps to the ground: a sine's foot hurries through the middle and dawdles
// at the ends, and slides), then up and forward again on a curve that
// leaves the ground and meets it at that same pace, swinging a touch past
// either end as a real foot does.
export function stepAt(phase) {
  let a = (phase - Math.PI / 2) % TAU;
  if (a < 0) a += TAU;
  if (a <= Math.PI) return 1 - (2 * a) / Math.PI;
  const s = (a - Math.PI) / Math.PI;
  return ((-8 * s + 12) * s - 2) * s - 1;
}

function rest() {
  const joints = {};
  for (const j of JOINTS) joints[j] = [0, 0, 0];
  // arms a little out from the sides
  joints.armL[2] = 0.18;
  joints.armR[2] = -0.18;
  return { joints, lift: 0, offset: [0, 0, 0], spin: [0, 0, 0], squash: 1 };
}

// the run: legs and arms swinging opposite, a lean, a bob, by speed. With a
// `swing` (./motion.js's, for the stride he's on), each leg reaches that
// far and each foot keeps to the ground while it's down (stepAt); without
// one, the legs swing by speed alone, as the stand-in's always did.
function run(p, { fwd = 0, phase = 0, swing = null, amount = 1 }) {
  const k = Math.min(1, Math.abs(fwd) / 32);
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  const reach = swing == null ? 0.95 * k : swing * amount; // how far a leg goes, either way
  if (swing == null) {
    p.joints.legL[0] = -s * reach;
    p.joints.legR[0] = s * reach;
  } else {
    // (a straight leg's foot is sin(angle) of a leg ahead of the hip)
    const r = Math.sin(Math.min(1.15, reach));
    const leg = (at) => -Math.asin(Math.max(-1, Math.min(1, stepAt(at) * r)));
    p.joints.legL[0] = leg(phase);
    p.joints.legR[0] = leg(phase + Math.PI);
  }
  const fold = Math.min(1, reach) * 1.15; // the knee folds as the foot comes through, more the further it reaches
  p.joints.shinL[0] = Math.max(0, c) * fold + 0.1;
  p.joints.shinR[0] = Math.max(0, -c) * fold + 0.1;
  p.joints.armL[0] = s * 0.9 * Math.min(1, reach);
  p.joints.armR[0] = -s * 0.9 * Math.min(1, reach);
  p.joints.foreL[0] = -0.6 * k - 0.2;
  p.joints.foreR[0] = -0.6 * k - 0.2;
  p.joints.spine[0] = 0.22 * k;
  p.joints.spine[1] = s * 0.15 * k;
  p.joints.head[0] = -0.12 * k;
  p.lift = Math.abs(c) * 0.06 * k;
}

const ACTIONS = {
  idle(p, t) {
    const b = Math.sin(t * 0.12);
    p.joints.spine[0] = 0.02 * b;
    p.joints.head[0] = -0.03 * b;
    p.joints.armL[2] = 0.2 + 0.03 * b;
    p.joints.armR[2] = -0.2 - 0.03 * b;
    p.lift = 0.005 * b;
    // left long enough, he sits down where he stands and nods off, his head
    // dropping and coming up with each slow breath (any move wakes him: it's
    // another action)
    const z = ease((t - SLEEP_AFTER) / 40);
    if (z <= 0) return;
    const snore = Math.sin(t * 0.06);
    p.lift += (-0.44 - p.lift) * z;
    p.joints.legL[0] = -1.35 * z;
    p.joints.legR[0] = -1.3 * z;
    p.joints.legL[2] = 0.18 * z;
    p.joints.legR[2] = -0.18 * z;
    p.joints.shinL[0] = p.joints.shinR[0] = 0.25 * z;
    p.joints.spine[0] += (0.28 + 0.03 * snore) * z;
    p.joints.head[0] += (0.42 + 0.08 * snore) * z;
    p.joints.armL[0] = p.joints.armR[0] = -0.55 * z;
    p.joints.foreL[0] = p.joints.foreR[0] = -0.5 * z;
  },
  walk: (p, t, o) => run(p, o),
  stop(p) {
    p.joints.spine[0] = -0.25;
    p.joints.legL[0] = -0.4;
    p.joints.legR[0] = -0.1;
    p.joints.armL[0] = -0.5;
    p.joints.armR[0] = -0.5;
  },
  skid(p) {
    p.joints.spine[0] = -0.45;
    p.joints.legL[0] = -0.7;
    p.joints.legR[0] = -0.4;
    p.joints.shinR[0] = 0.5;
    p.joints.armL[2] = 1.1;
    p.joints.armR[2] = -1.1;
    p.lift = -0.08;
  },
  crouch(p) {
    p.lift = -0.32;
    p.joints.legL[0] = p.joints.legR[0] = -1.2;
    p.joints.shinL[0] = p.joints.shinR[0] = 2.1;
    p.joints.spine[0] = 0.5;
    p.joints.armL[0] = p.joints.armR[0] = -0.6;
  },
  crawl(p, t, o) {
    ACTIONS.crouch(p);
    const s = Math.sin(o.phase ?? t * 0.3);
    p.joints.legL[0] += s * 0.25;
    p.joints.legR[0] -= s * 0.25;
    p.joints.armL[0] = -1.2 - s * 0.3;
    p.joints.armR[0] = -1.2 + s * 0.3;
    p.joints.spine[0] = 1.0;
    p.lift = -0.48;
  },
  crouchslide(p) {
    ACTIONS.crouch(p);
    p.joints.spine[0] = 0.7;
    p.lift = -0.36;
  },
  punch(p, t, { arg = 0 }) {
    const k = ease(t / 3) * (1 - ease((t - 6) / 4));
    if (arg === 2) {
      p.joints.legR[0] = -1.5 * k;
      p.joints.spine[0] = -0.3 * k;
      p.joints.armL[2] = 0.6;
      p.joints.armR[2] = -0.6;
      return;
    }
    const right = arg === 0;
    p.joints[right ? 'armR' : 'armL'][0] = -1.55 * k;
    p.joints[right ? 'foreR' : 'foreL'][0] = -0.1;
    p.joints[right ? 'armL' : 'armR'][0] = 0.4 * k;
    p.joints.spine[1] = (right ? -0.45 : 0.45) * k;
    p.joints.legL[0] = -0.3;
    p.joints.legR[0] = 0.25;
  },
  land(p, t) {
    const k = 1 - ease(t / 4);
    p.squash = 1 - 0.12 * k;
    p.lift = -0.1 * k;
    p.joints.legL[0] = p.joints.legR[0] = -0.5 * k;
    p.joints.shinL[0] = p.joints.shinR[0] = 0.9 * k;
  },
  jump(p, t, { vy = 0 }) {
    const up = vy > 0;
    p.joints.armL[0] = up ? -2.4 : -1.4;
    p.joints.armL[2] = 0.3;
    p.joints.armR[0] = up ? 0.5 : -0.4;
    p.joints.legL[0] = -0.7;
    p.joints.shinL[0] = 1.2;
    p.joints.legR[0] = 0.25;
    p.joints.shinR[0] = 0.5;
    p.joints.spine[0] = 0.1;
  },
  double(p, t) {
    // the "yahoo": arms flung wide, a turn about himself
    p.joints.armL[2] = 2.4;
    p.joints.armR[2] = -2.4;
    p.joints.legL[0] = -0.5;
    p.joints.shinL[0] = 1.0;
    p.joints.legR[0] = 0.3;
    p.spin[1] = ease(t / 16) * TAU;
  },
  triple(p, t) {
    const k = ease(t / TRIPLE_FRAMES);
    p.spin[0] = k * TAU;
    const tuck = Math.sin(Math.min(1, t / TRIPLE_FRAMES) * Math.PI);
    p.joints.legL[0] = p.joints.legR[0] = -1.4 * tuck;
    p.joints.shinL[0] = p.joints.shinR[0] = 2.0 * tuck;
    p.joints.armL[0] = p.joints.armR[0] = -1.2 * tuck;
    if (t > TRIPLE_FRAMES) {
      p.joints.armL[2] = 1.2;
      p.joints.armR[2] = -1.2;
    }
  },
  backflip(p, t) {
    const k = ease(t / 20);
    p.spin[0] = -k * TAU;
    const tuck = Math.sin(Math.min(1, t / 20) * Math.PI);
    p.joints.legL[0] = p.joints.legR[0] = -1.2 * tuck;
    p.joints.shinL[0] = p.joints.shinR[0] = 1.8 * tuck;
    p.joints.armL[0] = p.joints.armR[0] = -2.6 * (1 - tuck) - 0.6;
  },
  sideflip(p, t) {
    p.spin[2] = ease(t / 18) * TAU;
    p.joints.armL[2] = 1.6;
    p.joints.armR[2] = -1.6;
    p.joints.legL[0] = -0.4;
    p.joints.legR[0] = 0.3;
  },
  longjump(p) {
    p.spin[0] = 1.2;
    p.joints.armL[0] = p.joints.armR[0] = -2.9;
    p.joints.legL[0] = 0.3;
    p.joints.legR[0] = 0.5;
    p.joints.shinL[0] = p.joints.shinR[0] = 0.4;
  },
  wallkick(p, t) {
    ACTIONS.jump(p, t, { vy: 10 });
    p.joints.legR[0] = -1.1;
    p.joints.shinR[0] = 0.2;
    p.spin[1] = -ease(t / 10) * 0.5;
  },
  freefall(p, t) {
    const f = Math.sin(t * 0.6);
    p.joints.armL[0] = -2.2 + f * 0.3;
    p.joints.armR[0] = -2.2 - f * 0.3;
    p.joints.armL[2] = 0.5;
    p.joints.armR[2] = -0.5;
    p.joints.legL[0] = -0.3 + f * 0.2;
    p.joints.legR[0] = 0.1 - f * 0.2;
    p.joints.shinL[0] = p.joints.shinR[0] = 0.5;
  },
  rollout(p, t) {
    p.spin[0] = ease(t / 14) * TAU;
    p.joints.legL[0] = p.joints.legR[0] = -1.3;
    p.joints.shinL[0] = p.joints.shinR[0] = 1.9;
  },
  jumpkick(p, t) {
    const k = ease(t / 3) * (1 - ease((t - 9) / 4));
    p.joints.legR[0] = -1.6 * k;
    p.joints.legL[0] = 0.4 * k;
    p.joints.armL[2] = 0.9;
    p.joints.armR[2] = -0.9;
    p.joints.spine[0] = -0.2 * k;
  },
  dive(p) {
    p.spin[0] = 1.35;
    p.joints.armL[0] = p.joints.armR[0] = -3.0;
    p.joints.legL[0] = p.joints.legR[0] = 0.15;
    p.lift = 0.3;
  },
  bellyslide(p) {
    p.spin[0] = Math.PI / 2;
    p.joints.armL[0] = p.joints.armR[0] = -3.0;
    p.joints.legL[0] = 0.1;
    p.joints.legR[0] = 0.2;
    p.lift = -0.55;
    p.offset[2] = -0.6;
  },
  knockback(p) {
    p.spin[0] = -0.5;
    p.joints.armL[0] = p.joints.armR[0] = -1.8;
    p.joints.armL[2] = 0.8;
    p.joints.armR[2] = -0.8;
    p.joints.legL[0] = -0.8;
    p.joints.legR[0] = -0.4;
  },
  airhit(p) {
    p.joints.spine[0] = -0.3;
    p.joints.armL[2] = 1.5;
    p.joints.armR[2] = -1.5;
    p.joints.legL[0] = -0.6;
    p.joints.shinL[0] = 1.2;
  },
  pound(p, t) {
    if (t < 10) {
      p.spin[0] = ease(t / 10) * TAU;
      p.joints.legL[0] = p.joints.legR[0] = -1.5;
      p.joints.shinL[0] = p.joints.shinR[0] = 2.2;
      p.joints.armL[0] = p.joints.armR[0] = -1.0;
      return;
    }
    // straight down, sitting into it
    p.joints.legL[0] = p.joints.legR[0] = -1.2;
    p.joints.shinL[0] = p.joints.shinR[0] = 1.4;
    p.joints.armL[2] = 1.4;
    p.joints.armR[2] = -1.4;
  },
  poundland(p, t) {
    const k = 1 - ease(t / 10);
    p.squash = 1 - 0.18 * k;
    p.lift = -0.3 * k;
    p.joints.legL[0] = p.joints.legR[0] = -1.1 * k;
    p.joints.shinL[0] = p.joints.shinR[0] = 1.8 * k;
    p.joints.armL[2] = 1.0 * k + 0.2;
    p.joints.armR[2] = -1.0 * k - 0.2;
  },
  ledge(p, t) {
    // hanging: below the edge and back from it, arms up on it
    const sway = Math.sin(t * 0.1) * 0.04;
    p.offset[1] = -1.5;
    p.offset[2] = -0.55;
    p.joints.armL[0] = p.joints.armR[0] = -3.0;
    p.joints.armL[2] = 0.25;
    p.joints.armR[2] = -0.25;
    p.joints.legL[0] = 0.1 + sway;
    p.joints.legR[0] = -0.1 - sway;
  },
  climb(p, t) {
    const k = ease(t / 10);
    p.offset[1] = -1.5 * (1 - k);
    p.offset[2] = -0.55 * (1 - k);
    p.joints.armL[0] = p.joints.armR[0] = -3.0 * (1 - k);
    p.joints.legL[0] = -1.4 * Math.sin(k * Math.PI);
    p.joints.shinL[0] = 1.8 * Math.sin(k * Math.PI);
  },
  slide(p) {
    // on his seat, legs out front, leaning back
    p.lift = -0.5;
    p.joints.legL[0] = p.joints.legR[0] = -1.5;
    p.joints.shinL[0] = p.joints.shinR[0] = 0.2;
    p.joints.spine[0] = -0.4;
    p.joints.armL[2] = 0.9;
    p.joints.armR[2] = -0.9;
  },
  buttslide(p) {
    ACTIONS.slide(p);
  },
  swim(p, t, { pitch = 0 }) {
    const s = Math.sin(t * 0.25);
    p.spin[0] = Math.PI / 2 - pitch;
    p.joints.armL[0] = -2.6 + s * 0.9;
    p.joints.armR[0] = -2.6 + s * 0.9;
    p.joints.armL[2] = 0.6 + s * 0.4;
    p.joints.armR[2] = -0.6 - s * 0.4;
    p.joints.legL[0] = s * 0.4;
    p.joints.legR[0] = -s * 0.4;
    p.joints.head[0] = -0.8;
  },
  surface(p, t) {
    const s = Math.sin(t * 0.2);
    p.joints.armL[2] = 1.0 + s * 0.3;
    p.joints.armR[2] = -1.0 - s * 0.3;
    p.joints.legL[0] = -0.4 + s * 0.4;
    p.joints.legR[0] = -0.4 - s * 0.4;
    p.joints.shinL[0] = p.joints.shinR[0] = 0.6;
  },
  burn(p, t) {
    // hands on the seat of his overalls, kicking
    p.joints.armL[0] = p.joints.armR[0] = 1.0;
    p.joints.foreL[0] = p.joints.foreR[0] = -1.3;
    p.joints.legL[0] = -0.6 + Math.sin(t * 0.8) * 0.5;
    p.joints.legR[0] = -0.6 - Math.sin(t * 0.8) * 0.5;
    p.joints.spine[0] = 0.3;
    p.spin[1] = t * 0.4;
  },
  pickup(p, t) {
    const k = ease(t / 6);
    p.joints.spine[0] = 0.9 * (1 - k) + 0.1;
    p.joints.armL[0] = p.joints.armR[0] = -1.0 - 1.9 * k;
    p.lift = -0.15 * (1 - k);
  },
  hold(p) {
    p.joints.armL[0] = p.joints.armR[0] = -2.9;
    p.joints.armL[2] = 0.35;
    p.joints.armR[2] = -0.35;
    p.joints.foreL[0] = p.joints.foreR[0] = -0.4;
  },
  holdwalk(p, t, o) {
    run(p, { ...o, fwd: Math.min(o.fwd ?? 0, 16) });
    ACTIONS.hold(p);
  },
  holdjump(p) {
    ACTIONS.hold(p);
    p.joints.legL[0] = -0.7;
    p.joints.shinL[0] = 1.2;
  },
  throw(p, t) {
    const k = ease(t / 3);
    p.joints.armL[0] = p.joints.armR[0] = -2.9 + 1.6 * k;
    p.joints.spine[0] = 0.35 * k;
  },
  dance(p, t) {
    // the star held high
    p.joints.armR[0] = -3.0;
    p.joints.armR[2] = -0.2;
    p.joints.armL[2] = 0.9;
    p.joints.foreL[0] = -1.4;
    p.joints.legL[0] = -0.2;
    p.spin[1] = t < 20 ? ease(t / 20) * TAU : 0;
    p.lift = Math.max(0, Math.sin(Math.min(t, 20) / 20 * Math.PI)) * 0.5;
  },
  dead(p, t) {
    const k = ease(t / 18);
    p.spin[0] = -1.4 * k;
    p.joints.armL[2] = 1.3;
    p.joints.armR[2] = -1.3;
    p.joints.legL[0] = -0.3;
    p.lift = -0.5 * k;
  },
};

export function poseFor(action, t = 0, opts = {}) {
  const p = rest();
  const fn = ACTIONS[action] ?? ACTIONS.idle;
  fn(p, t, opts);
  return p;
}

export const POSED = Object.keys(ACTIONS);
