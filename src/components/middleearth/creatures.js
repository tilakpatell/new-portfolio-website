// How Middle-earth's beasts and monsters move: the creatures that stay
// procedural (Shelob, the Balrogs, the horses, Gollum, the cave troll, the
// Nazgûl's glide, the Shire's dogs and sheep, the flyers). Their pose code
// used to read `t × N` for its legs, so a creature that sped up slid its
// feet and one standing still marched; and it was told 'walking' or not by
// the scene, which often didn't know how fast it was really going. This
// gives each one what it needs to move on the ground it covers instead.
// (docs/superpowers/specs/2026-10-07-living-characters-design.md, W6)
//
// createTracker({ fastest, settle }) → track(t, x, z, yaw, scale) →
//   { dt, speed, fwd, side, turn }: how a creature is moving, read from
//   where the scene put it (its group's position and heading) each frame,
//   so its body follows what it does without the scene saying. speed is in
//   its own units a second (the scene's divided by its scale), fwd and
//   side the parts of it along its heading (+x turned by yaw: (cos, −sin))
//   and across it, to its right (+z facing +x), turn its yaw's rate. Smoothed over `settle` seconds;
//   a move faster than `fastest` is a jump (a respawn, a scene change), not
//   a sprint, and counts as standing still.
// createStride({ stride, hz, longest, stance, cadence, seed }) →
//   { step(dt, speed) → { cycle, phase, amount, run, stride, reach, travel,
//   hz }, at(speed) }: a gait's phase from the ground covered (on
//   lib/three/gait.js). `stride` is the ground one cycle covers at the
//   creature's easy pace, `hz` its cycles a second there; faster, its
//   stride lengthens (as a horse's or a dog's does) up to `longest` times
//   that and its cadence climbs the rest of the way, never capped; slower,
//   both shorten together, to nothing standing. cycle runs 0…1 (phase is
//   the same in radians), amount eases 0 standing to 1 moving, run eases
//   toward the top of `cadence` (cycles a second), reach is this stride
//   against the easy one (for scaling a leg's swing), travel how far a
//   planted foot goes back under the body while it's down (a `stance`
//   share of the stride), so a pose that sweeps a foot by that keeps it
//   still on the ground.
// footAt(cycle, stance) → { x, lift }: one foot through its cycle, x from
//   +1 (forward) back to −1 at an even pace on the ground for the `stance`
//   share of it, then lifted (lift 0…1) and brought through. A pose puts
//   the foot at x × travel / 2 ahead of its hip.
// legSwing(cycle, stance, travel, length, lean) → { angle, lift, rise }: a
//   leg held stiff on the ground (a toy's, or a beast's with its knee locked
//   while its foot is down) swung from its hip so its foot is footAt's x ×
//   travel / 2 ahead of the hip, passing straight beneath it mid-stride:
//   angle in radians from its rest pose, + swung forward. length is hip to
//   foot; lean the angle that line stands at, at rest (+ the foot ahead of
//   the hip: a bowed or a bent leg). rise is how much higher (+) or lower
//   (−) the hip stands than at rest with that foot on the ground: a body
//   carried over its planted legs rises and falls as they pass under it,
//   so set it (eased) by the least of its planted legs' rises and they
//   neither sink nor float.
// twoBone(x, y, upper, lower, bend) → [a1, a2]: a jointed limb (a thigh
//   and a shin, an arm and a forearm) from its root to (x, y) in the plane
//   it swings in (+x forward, +y up): each bone's angle from hanging
//   straight down, + swung forward. bend 1 bends the joint forward (a knee),
//   −1 back (an elbow, a hock). Out of reach it reaches as far as it can
//   toward the point. For a planted foot that stays put while the body goes
//   on over it, its knee taking up the rise and fall.
// legRig({ knee, foot, bend, rest }) → { home, reach(x, y), sink(travel) }:
//   a jointed leg on a figure's rig. knee is where the knee's pivot sits in
//   the thigh's frame, foot where the foot meets the ground in the shin's
//   (both [x, y]); bend as twoBone's; rest the thigh's and the shin's own
//   turns (rotation.z) standing. home is where the foot stands then, in the
//   hip's frame; reach(x, y) → [thigh, shin] the turns that put it at (x, y)
//   instead; sink(travel, centre) how far the hips must come down for a
//   stride that long (centred `centre` ahead of the hip: its home's, by
//   default) to stay in reach at either end (a lower body at a run).
// gaitOffsets(run, slow, fast) → each leg's place in the cycle, eased from
//   the `slow` gait's (a walk, a trot) to the `fast` one's (a gallop) as
//   run goes 0 → 1, so a horse changes gait without a leg jumping. WALK,
//   TROT and GALLOP are a four-legged animal's, its legs in the order
//   [fore right (+z), fore left, hind right, hind left] (facing +x, its
//   right is +z); STANCE the share of each a foot is down.
// ease(v, want, dt, rate): v eased toward want, by time.
// createShot(length) → { fire(), step(dt) → 0…1 through it, or −1 when it
//   isn't playing; active }: a one-shot (a roar, a shriek, a swing).
//
// Pure: no three.js. Every dt is clamped to a tenth of a second.

import { createGait } from '../../lib/three/gait';

const TAU = Math.PI * 2;
const LONGEST = 0.1;
const clampDt = (dt) => (dt > 0 ? Math.min(dt, LONGEST) : 0);
const wrap = (a) => a - TAU * Math.round(a / TAU);

export function createTracker({ fastest = 30, settle = 0.08 } = {}) {
  let last = null;
  let vx = 0;
  let vz = 0;
  let spin = 0;
  const out = { dt: 0, speed: 0, fwd: 0, side: 0, turn: 0 };
  const read = (yaw) => {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    out.speed = Math.hypot(vx, vz);
    out.fwd = vx * c - vz * s;
    out.side = vx * s + vz * c;
    out.turn = spin;
    return out;
  };
  return (t, x, z, yaw = 0, scale = 1) => {
    const ok = Number.isFinite(t) && Number.isFinite(x) && Number.isFinite(z);
    if (!ok) {
      out.dt = 0;
      return out;
    }
    const y = Number.isFinite(yaw) ? yaw : 0;
    if (!last || t < last.t || t - last.t > 1) {
      // the first look at it, or the clock went back or stopped a long
      // while: it starts from standing here
      last = { t, x, z, yaw: y };
      vx = vz = spin = 0;
      out.dt = 0;
      return read(y);
    }
    const span = t - last.t;
    if (!(span > 0)) {
      out.dt = 0;
      return out;
    }
    const dt = clampDt(span);
    const k = 1 - Math.exp(-dt / settle);
    const sc = scale > 0 ? scale : 1;
    let rx = (x - last.x) / span / sc;
    let rz = (z - last.z) / span / sc;
    if (Math.hypot(rx, rz) > fastest) rx = rz = 0;
    vx += (rx - vx) * k;
    vz += (rz - vz) * k;
    spin += (wrap(y - last.yaw) / span - spin) * k;
    last.t = t;
    last.x = x;
    last.z = z;
    last.yaw = y;
    out.dt = dt;
    return read(y);
  };
}

export function createStride({ stride = 1, hz = 1, longest = 1.4, stance = 0.5, cadence, seed = 0 } = {}) {
  const len = stride > 0 ? stride : 1;
  const rate = hz > 0 ? hz : 1;
  const easy = len * rate; // its easy pace, a stride at hz
  const most = Math.max(1, longest);
  const gait = createGait({ stride: 1, cadence: cadence ?? [rate, rate * 1.8], seed });
  const at = (speed) => {
    const v = Math.abs(Number.isFinite(speed) ? speed : 0);
    if (!(v > 1e-6)) return { stride: 0, reach: 0, hz: 0 };
    const reach = Math.min(most, Math.sqrt(v / easy));
    const s = len * reach;
    return { stride: s, reach, hz: v / s };
  };
  const out = { cycle: 0, phase: 0, amount: 0, run: 0, stride: 0, reach: 0, travel: 0, hz: 0 };
  const step = (dt, speed) => {
    const v = Number.isFinite(speed) ? speed : 0;
    const now = at(v);
    const g = gait.step(dt, now.stride > 0 ? v / now.stride : 0);
    out.phase = g.phase;
    out.cycle = g.phase / TAU;
    out.amount = g.amount;
    out.run = g.run;
    out.stride = now.stride;
    out.reach = now.reach;
    out.travel = stance * now.stride;
    out.hz = now.hz;
    return out;
  };
  return { step, at };
}

const smoothstep = (k) => k * k * (3 - 2 * k);

export function footAt(cycle, stance = 0.5) {
  const c = cycle - Math.floor(cycle);
  const s = Math.min(0.95, Math.max(0.05, stance));
  if (c < s) return { x: 1 - (2 * c) / s, lift: 0 };
  const k = (c - s) / (1 - s);
  return { x: -1 + 2 * smoothstep(k), lift: Math.sin(Math.PI * k) };
}

export function legSwing(cycle, stance, travel, length, lean = 0) {
  const f = footAt(cycle, stance);
  const L = length > 0 ? length : 1;
  const k = Math.max(-0.95, Math.min(0.95, (f.x * travel) / 2 / L));
  const a = Math.asin(k);
  return { angle: a - lean, lift: f.lift, rise: L * (Math.cos(a) - Math.cos(lean)) };
}

export function twoBone(x, y, upper, lower, bend = 1) {
  const L1 = upper > 0 ? upper : 1e-3;
  const L2 = lower > 0 ? lower : 1e-3;
  const d0 = Math.hypot(x, y) || 1e-6;
  const d = Math.min((L1 + L2) * 0.999, Math.max(Math.abs(L1 - L2) + 1e-3, d0));
  const tx = (x * d) / d0;
  const ty = (y * d) / d0;
  const a = Math.atan2(tx, -ty);
  const b = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
  const a1 = a + (bend < 0 ? -b : b);
  const kx = Math.sin(a1) * L1;
  const ky = -Math.cos(a1) * L1;
  return [a1, Math.atan2(tx - kx, -(ty - ky))];
}

export function legRig({ knee, foot, bend = 1, rest = [0, 0] }) {
  const L1 = Math.hypot(knee[0], knee[1]);
  const L2 = Math.hypot(foot[0], foot[1]);
  const t0 = Math.atan2(knee[0], -knee[1]);
  const s0 = Math.atan2(foot[0], -foot[1]);
  const a1 = t0 + rest[0];
  const a2 = s0 + rest[0] + rest[1];
  const home = [Math.sin(a1) * L1 + Math.sin(a2) * L2, -Math.cos(a1) * L1 - Math.cos(a2) * L2];
  const out = [0, 0];
  return {
    home,
    upper: L1,
    lower: L2,
    reach(x, y) {
      const [b1, b2] = twoBone(x, y, L1, L2, bend);
      out[0] = b1 - t0;
      out[1] = b2 - s0 - out[0];
      return out;
    },
    sink(travel, centre = home[0]) {
      const far = Math.abs(centre) + Math.max(0, travel) / 2;
      const most = (L1 + L2) * 0.97;
      return Math.max(0, -home[1] - Math.sqrt(Math.max(0, most * most - far * far)));
    },
  };
}

export const WALK = [0.75, 0.25, 0.5, 0]; // footfalls: hind left, fore left, hind right, fore right
export const TROT = [0.5, 0, 0, 0.5]; // the diagonals together
export const GALLOP = [0.55, 0.45, 0.1, 0]; // the hinds, then the fores, leading right
export const STANCE = { walk: 0.62, trot: 0.5, gallop: 0.38 };

export function gaitOffsets(run, slow = TROT, fast = GALLOP) {
  const k = Math.min(1, Math.max(0, Number.isFinite(run) ? run : 0));
  return slow.map((a, i) => a + (fast[i] - a) * k);
}

export function ease(v, want, dt, rate) {
  if (!Number.isFinite(want)) return v;
  return v + (want - v) * (1 - Math.exp(-rate * clampDt(dt)));
}

export function createShot(length = 1) {
  let t = null;
  const shot = {
    fire() {
      t = 0;
    },
    step(dt) {
      if (t == null) return -1;
      t += dt > 0 ? dt : 0;
      if (t > length) {
        t = null;
        return -1;
      }
      return t / length;
    },
    get active() {
      return t != null;
    },
  };
  return shot;
}
