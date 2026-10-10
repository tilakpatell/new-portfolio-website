// The rules of close combat on the galaxy's worlds, pure (tested in Node;
// scene.js and saber.js run them): the lightsaber stances and their
// strokes, the guard that blocking spends, the parry window, the lunge
// that closes on a target, the dodge, the Force, and the moment a hit
// holds the frame. Drawn from how the films' games do it: Battlefront II's
// block stamina and 5.5 m dodge with its moment of safety, Jedi: Survivor's
// stances and its small parry window, Movie Battles II's fast / medium /
// strong triangle.
//
//   STANCES              by id: { name, about, strokes: [{ clip, speed, damage }] (the combo, in turn: each a sword clip from the
//                        clip library, played full-body at `speed`), reach, block (how much of a hit the guard takes), cost (guard spent a block),
//                        lunge (metres a stroke's step may grow to, to reach the one you're locked on) }
//   HEAVY                the charged strokes: { hold (seconds F is held to make one), clips (in turn, while they chain), speed, damage, breaks (shields and guards) }
//   DIRS                 a stroke with a way held: up (W, overhead), left and right (A, D: a cut from that side), rise (S): { clip, damage }
//   BLOCK_CLIP, DASH_CLIP   the raised blade and the dash's lunge
//   STRIKE               metres from the one you're locked on that a stroke's step ends
//   GUARD                { max, regen (a second), wait (seconds after a hit before it regrows), broken (seconds staggered when it's gone) }
//   PARRY                { window }: seconds before their blade's contact in which a block begun is a parry
//   DODGE                { dist, dur, safe (seconds of it nothing lands), cool }
//   FORCE                push / pull: { range, cone, force, cool, damage }
//   stanceOf(id)         the stance, 'single' when unknown (a hero on the 2017 game's rig: gameStance.js's stanceFor)
//   strokeFor(stance, { last, now, dir, heavy, combo })   the stroke to make now: { clip, speed, damage, lunge, heavy, kind, i };
//                        a way held (dir) its own (the stance's `dirs`, else DIRS), a heavy one the next of the stance's
//                        `heavies` (else HEAVY's) while they chain, else the next of the combo
//                        within `combo` seconds of the last ending (`last`: the stroke before, with its endedAt)
//   rootScale(travel, dist, lunge)   how much of a clip's step (`travel` metres ahead) to take: to land STRIKE short of the
//                        one you're locked on (`dist` away; null with no lock: the clip's own), never more than `lunge`
//   lungeTo(me, t, stance)       metres to step toward t for a stroke to land (0 if it already does, or t's too far)
//   guardHit(g, cost, now)       the guard after a block: { value, brokenAt } (brokenAt set when it's spent)
//   guardStep(g, dt, now, max?)  the guard a frame on: regrowing after GUARD.wait toward `max` (GUARD.max), back from broken after GUARD.broken
//   blockOutcome({ shown, blockAt, contactAt, now, window })   their blade's contact on you now, met by your block:
//                        'parry' (shown, begun within `window` (PARRY.window) before their contact began, or since),
//                        'block' (shown, up from before) or 'hit' (not up); a swipe that lands as it's decided has contactAt now
//   dodgeStep(k)                 the dodge `k` (0…1) of the way: { d (metres along), safe }
//   forceAt(me, t, kind)         whether t is in the Force's reach: { hit, k (1 close … 0 at range) }
//   pushVelocity(me, t, k)       the shove a push gives t: { vx, vz, vy }
//   hitStop(damage, killed)      seconds the frame holds on a hit

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export const STANCES = {
  single: {
    name: 'Single blade',
    about: 'Luke’s, Obi-Wan’s: balanced, four strokes that chain.',
    reach: 2.6,
    block: 1,
    cost: 1,
    lunge: 3.5,
    strokes: [
      { clip: 'sword.light.a', speed: 1.1, damage: 2 },
      { clip: 'sword.light.b', speed: 1.1, damage: 2 },
      { clip: 'sword.light.c', speed: 1.15, damage: 2 },
      { clip: 'sword.a', speed: 1, damage: 3 },
    ],
  },
  double: {
    name: 'Double blade',
    about: 'Maul’s staff: fast, wide, light; it clears a crowd.',
    reach: 3,
    block: 0.8,
    cost: 1.1,
    lunge: 3,
    strokes: [
      { clip: 'sword.light.a', speed: 1.3, damage: 1 },
      { clip: 'sword.light.b', speed: 1.3, damage: 1 },
      { clip: 'sword.b', speed: 1.25, damage: 1 },
      { clip: 'sword.a', speed: 1.2, damage: 2 },
    ],
  },
  dual: {
    name: 'Dual wield',
    about: 'Ahsoka’s pair: quick strokes, a parry built in.',
    reach: 2.4,
    block: 1.2,
    cost: 0.8,
    lunge: 4,
    strokes: [
      { clip: 'sword.light.a', speed: 1.4, damage: 1 },
      { clip: 'sword.light.b', speed: 1.4, damage: 1 },
      { clip: 'sword.light.c', speed: 1.35, damage: 1 },
      { clip: 'sword.b', speed: 1.3, damage: 2 },
    ],
  },
  heavy: {
    name: 'Crossguard',
    about: 'Slow and heavy: each stroke lands hard and breaks a guard.',
    reach: 2.8,
    block: 1,
    cost: 1.2,
    lunge: 3,
    strokes: [
      { clip: 'sword.heavy.b', speed: 0.9, damage: 4 },
      { clip: 'sword.heavy.c', speed: 0.9, damage: 5 },
    ],
  },
};
export const STANCE_IDS = Object.keys(STANCES);
export const stanceOf = (id) => STANCES[id] ?? STANCES.single;

export const HEAVY = { hold: 0.35, clips: ['sword.heavy.a', 'sword.heavy.b', 'sword.heavy.c', 'sword.heavy.d'], speed: 1, damage: 5, breaks: true };
export const DIRS = {
  up: { clip: 'sword.heavy.a', damage: 3 },
  left: { clip: 'sword.b', damage: 2 },
  right: { clip: 'sword.a', damage: 2 },
  rise: { clip: 'sword.uppercut', damage: 3 },
};
export const BLOCK_CLIP = 'sword.block';
export const DASH_CLIP = 'sword.dash';
export const STRIKE = 1; // (a light cut passes about a metre ahead of the chest)
const COMBO = 0.45;
export const GUARD = { max: 100, regen: 28, wait: 1.1, broken: 1.6 };
export const PARRY = { window: 0.25, stagger: 2.2 };
export const DODGE = { dist: 5.5, dur: 0.42, safe: 0.3, cool: 0.9 };
export const FORCE = {
  push: { range: 9, cone: 0.75, force: 11, lift: 3.5, cool: 9, damage: 1 },
  pull: { range: 14, cone: 0.5, force: 9, lift: 2, cool: 7, damage: 0 },
};

// last: the stroke before ({ kind, i, endedAt }) or null
export function strokeFor(stance, { last = null, now = 0, dir = null, heavy = false, combo = COMBO } = {}) {
  const chain = (kind) => last?.kind === kind && now - last.endedAt <= combo;
  const base = { lunge: stance.lunge, heavy: false };
  if (heavy) {
    // (a stance of its own heavies, the game's, plays those: stanceFromTable.js)
    const own = stance.heavies;
    const i = chain('heavy') ? (last.i + 1) % (own?.length ?? HEAVY.clips.length) : 0;
    if (own) return { ...base, kind: 'heavy', i, clip: own[i].clip, speed: own[i].speed, damage: own[i].damage, heavy: true };
    return { ...base, kind: 'heavy', i, clip: HEAVY.clips[i], speed: HEAVY.speed, damage: HEAVY.damage, heavy: true };
  }
  const way = (stance.dirs ?? DIRS)[dir];
  if (way) return { ...base, kind: 'dir', i: 0, clip: way.clip, speed: stance.strokes[0].speed, damage: way.damage };
  const i = chain('combo') ? (last.i + 1) % stance.strokes.length : 0;
  return { ...base, kind: 'combo', i, ...stance.strokes[i] };
}

export function rootScale(travel, dist, lunge) {
  if (!(travel > 1e-3)) return 0;
  const most = lunge / travel;
  if (dist == null) return Math.min(1, most);
  return clamp((dist - STRIKE) / travel, 0, most);
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

// (anchored to their contact, not their stroke's start: the research's §2)
export function blockOutcome({ shown, blockAt = null, contactAt, now, window = PARRY.window }) {
  if (!shown) return 'hit';
  return blockAt != null && blockAt >= contactAt - window && blockAt <= now ? 'parry' : 'block';
}

export function dodgeStep(k) {
  const x = clamp(k, 0, 1);
  // quick out of the blocks, slowing at the end
  return { d: DODGE.dist * (1 - (1 - x) * (1 - x)), safe: x * DODGE.dur <= DODGE.safe };
}

// (`f` is the push's own numbers where it isn't the Force's: a roar, say)
export function forceAt(me, t, kind = 'push', f = FORCE[kind]) {
  const dx = t.x - me.x;
  const dz = t.z - me.z;
  const d = Math.hypot(dx, dz);
  if (d > f.range) return { hit: false, k: 0 };
  if (d > 1e-6 && Math.abs(wrap(Math.atan2(dx, dz) - me.yaw)) > f.cone) return { hit: false, k: 0 };
  return { hit: true, k: 1 - (d / f.range) * 0.6 };
}

export function pushVelocity(me, t, k, kind = 'push', f = FORCE[kind]) {
  const dx = t.x - me.x;
  const dz = t.z - me.z;
  const d = Math.hypot(dx, dz) || 1e-6;
  const sign = kind === 'pull' ? -1 : 1;
  return { vx: (dx / d) * f.force * k * sign, vz: (dz / d) * f.force * k * sign, vy: f.lift * k };
}

export const hitStop = (damage, killed = false) => (killed ? 0.09 : damage >= 4 ? 0.06 : 0.04);
