// The rules of close combat on the galaxy's worlds, pure (tested in Node;
// scene.js and saber.js run them): the lightsaber stances and their
// strokes, the guard that blocking spends, the parry window, the lunge
// that closes on a target, the dodge, the Force, and the moment a hit
// holds the frame. Drawn from how the films' games do it: Battlefront II's
// block stamina and 5.5 m dodge with its moment of safety, Jedi: Survivor's
// stances and its small parry window, Movie Battles II's fast / medium /
// strong triangle.
//
//   STANCES              by id: { name, about, swings: [{ dur, yaw: [a, b], pitch: [a, b], lead, damage }], reach, half, block (how much of a hit the guard takes), cost (guard spent a block), lunge (metres a stroke closes) }
//   HEAVY                the charged overhead: { hold (seconds F is held to make one), dur, damage, breaks (shields and guards) }
//   GUARD                { max, regen (a second), wait (seconds after a hit before it regrows), broken (seconds staggered when it's gone) }
//   PARRY                { window }: seconds after C goes down in which a swipe is parried outright
//   DODGE                { dist, dur, safe (seconds of it nothing lands), cool }
//   FORCE                push / pull: { range, cone, force, cool, damage }
//   stanceOf(id)         the stance, 'single' when unknown
//   swingPose(stance, i, k)   the arm `k` (0…1) through swing i: { yaw, pitch }, eased, exact at the ends
//   nextSwing(stance, last, now, combo)   the swing to make now: the next of the combo within `combo` seconds of the last ending
//   arcHit(me, t, reach, half)   whether t ({ x, z, r? }) is within reach and inside the arc
//   lungeTo(me, t, stance)       metres to step toward t for a stroke to land (0 if it already does, or t's too far)
//   guardHit(g, cost, now)       the guard after a block: { value, brokenAt } (brokenAt set when it's spent)
//   guardStep(g, dt, now, max?)  the guard a frame on: regrowing after GUARD.wait toward `max` (GUARD.max), back from broken after GUARD.broken
//   parried(blockAt, now, window?)   whether a swipe now meets a block begun within `window` (PARRY.window)
//   dodgeStep(k)                 the dodge `k` (0…1) of the way: { d (metres along), safe }
//   forceAt(me, t, kind)         whether t is in the Force's reach: { hit, k (1 close … 0 at range) }
//   pushVelocity(me, t, k)       the shove a push gives t: { vx, vz, vy }
//   hitStop(damage, killed)      seconds the frame holds on a hit

const ease = (k) => k * k * (3 - 2 * k);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export const STANCES = {
  single: {
    name: 'Single blade',
    about: 'Luke’s, Obi-Wan’s: balanced, three strokes that chain.',
    reach: 2.6,
    half: 1.1,
    block: 1,
    cost: 1,
    lunge: 3.5,
    swings: [
      { dur: 0.38, yaw: [-1.25, 1.15], pitch: [0.35, -0.25], lead: 0.5, damage: 2 },
      { dur: 0.38, yaw: [1.2, -1.2], pitch: [-0.15, 0.3], lead: 0.5, damage: 2 },
      { dur: 0.46, yaw: [0.25, -0.2], pitch: [1.25, -0.75], lead: 0.55, damage: 3 },
    ],
  },
  double: {
    name: 'Double blade',
    about: 'Maul’s staff: fast, wide, light; it clears a crowd.',
    reach: 3,
    half: 1.5,
    block: 0.8,
    cost: 1.1,
    lunge: 3,
    swings: [
      { dur: 0.3, yaw: [-1.6, 1.5], pitch: [0.1, 0], lead: 0.5, damage: 1 },
      { dur: 0.3, yaw: [1.5, -1.6], pitch: [0, 0.1], lead: 0.5, damage: 1 },
      { dur: 0.34, yaw: [-1.4, 1.4], pitch: [-0.3, 0.2], lead: 0.5, damage: 1 },
      { dur: 0.4, yaw: [0.2, -0.3], pitch: [1.1, -0.6], lead: 0.55, damage: 2 },
    ],
  },
  dual: {
    name: 'Dual wield',
    about: 'Ahsoka’s pair: quick strokes, a parry built in.',
    reach: 2.4,
    half: 1.2,
    block: 1.2,
    cost: 0.8,
    lunge: 4,
    swings: [
      { dur: 0.28, yaw: [-1.1, 0.9], pitch: [0.3, -0.2], lead: 0.5, damage: 1 },
      { dur: 0.28, yaw: [1.0, -1.0], pitch: [0.2, -0.3], lead: 0.5, damage: 1 },
      { dur: 0.28, yaw: [-0.9, 1.0], pitch: [-0.2, 0.4], lead: 0.5, damage: 1 },
      { dur: 0.34, yaw: [0.2, -0.2], pitch: [1.0, -0.6], lead: 0.55, damage: 2 },
    ],
  },
  heavy: {
    name: 'Crossguard',
    about: 'Slow and heavy: each stroke lands hard and breaks a guard.',
    reach: 2.8,
    half: 1.0,
    block: 1,
    cost: 1.2,
    lunge: 3,
    swings: [
      { dur: 0.6, yaw: [-1.3, 1.1], pitch: [0.5, -0.3], lead: 0.55, damage: 4 },
      { dur: 0.7, yaw: [0.3, -0.3], pitch: [1.3, -0.8], lead: 0.6, damage: 5 },
    ],
  },
};
export const STANCE_IDS = Object.keys(STANCES);
export const stanceOf = (id) => STANCES[id] ?? STANCES.single;

export const HEAVY = { hold: 0.35, dur: 0.75, damage: 5, breaks: true, yaw: [0.1, -0.1], pitch: [1.4, -0.9], lead: 0.62 };
export const GUARD = { max: 100, regen: 28, wait: 1.1, broken: 1.6 };
export const PARRY = { window: 0.22, stagger: 2.2 };
export const DODGE = { dist: 5.5, dur: 0.42, safe: 0.3, cool: 0.9 };
export const FORCE = {
  push: { range: 9, cone: 0.75, force: 11, lift: 3.5, cool: 9, damage: 1 },
  pull: { range: 14, cone: 0.5, force: 9, lift: 2, cool: 7, damage: 0 },
};

export function swingPose(stance, i, k) {
  const sw = stance.swings[i % stance.swings.length];
  const e = ease(clamp(k, 0, 1));
  return { yaw: sw.yaw[0] * (1 - e) + sw.yaw[1] * e, pitch: sw.pitch[0] * (1 - e) + sw.pitch[1] * e };
}

// last: { i, endedAt } or null
export function nextSwing(stance, last, now, combo = 0.45) {
  if (!last || now - last.endedAt > combo) return 0;
  return (last.i + 1) % stance.swings.length;
}

export function arcHit(me, t, reach, half) {
  const dx = t.x - me.x;
  const dz = t.z - me.z;
  const d = Math.hypot(dx, dz);
  if (d > reach + (t.r ?? 0)) return false;
  if (d < 1e-6) return true;
  return Math.abs(wrap(Math.atan2(dx, dz) - me.yaw)) <= half;
}

// (a stroke steps you in to where it lands; past the stance's lunge it doesn't)
export function lungeTo(me, t, stance) {
  const d = Math.hypot(t.x - me.x, t.z - me.z) - (t.r ?? 0.5);
  const want = d - stance.reach * 0.7;
  if (want <= 0) return 0;
  return want <= stance.lunge ? want : 0;
}

export function guardHit(g, cost, now) {
  const value = Math.max(0, g.value - cost);
  return { value, hitAt: now, brokenAt: value <= 0 ? now : (g.brokenAt ?? null) };
}

export function guardStep(g, dt, now, max = GUARD.max) {
  if (g.brokenAt != null) {
    if (now - g.brokenAt < GUARD.broken) return g;
    return { value: max * 0.4, hitAt: g.hitAt, brokenAt: null };
  }
  if (g.value >= max || now - (g.hitAt ?? -99) < GUARD.wait) return g;
  return { ...g, value: Math.min(max, g.value + GUARD.regen * dt) };
}

export const parried = (blockAt, now, window = PARRY.window) => blockAt != null && now - blockAt >= 0 && now - blockAt <= window;

export function dodgeStep(k) {
  const x = clamp(k, 0, 1);
  // quick out of the blocks, slowing at the end
  return { d: DODGE.dist * (1 - (1 - x) * (1 - x)), safe: x * DODGE.dur <= DODGE.safe };
}

export function forceAt(me, t, kind = 'push') {
  const f = FORCE[kind];
  const dx = t.x - me.x;
  const dz = t.z - me.z;
  const d = Math.hypot(dx, dz);
  if (d > f.range) return { hit: false, k: 0 };
  if (d > 1e-6 && Math.abs(wrap(Math.atan2(dx, dz) - me.yaw)) > f.cone) return { hit: false, k: 0 };
  return { hit: true, k: 1 - (d / f.range) * 0.6 };
}

export function pushVelocity(me, t, k, kind = 'push') {
  const f = FORCE[kind];
  const dx = t.x - me.x;
  const dz = t.z - me.z;
  const d = Math.hypot(dx, dz) || 1e-6;
  const sign = kind === 'pull' ? -1 : 1;
  return { vx: (dx / d) * f.force * k * sign, vz: (dz / d) * f.force * k * sign, vy: f.lift * k };
}

export const hitStop = (damage, killed = false) => (killed ? 0.09 : damage >= 4 ? 0.06 : 0.04);
