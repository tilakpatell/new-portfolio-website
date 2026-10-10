// The Force as plain numbers, and the two minds that duel with it. Who
// may do what is canon: anyone strong in the Force pushes and pulls; only
// Vader chokes, only the Emperor throws lightning; Obi-Wan and Luke play
// the mind trick, and Obi-Wan alone makes a noise down a corridor to draw
// the guards off. Each power has its own cooldown, started when it is
// used; a power with nothing to work on (no one to grip, no guard near)
// isn’t spent. The choke and the lightning are held, one at a time, and
// forceStep runs them: the choke lifts its target and holds it helpless
// for 2 s but never kills on its own (Vader’s grip is a warning as often
// as not); lightning burns until it runs out or is stopped, and a saber
// guard facing the Emperor takes half of it at the cost of stamina, until
// the stamina gives and the guard breaks. This module writes the
// fighter’s own fields (hp, stamina, guard, stagger) on its targets and
// returns events for everything else (a shove, a lift, a stood-down
// guard, a noise), for whoever owns the body or the brain to act on.
//
// The minds are utility brains on src/lib/ai/utility. Vader reads a
// stroke a beat after it starts and times his guard to meet its blow (his
// rand says how well), brings a heavy down on a held guard, cuts at an
// open foe, pushes him off when short of breath, and from beyond his reach
// closes in or chokes, the rand choosing between near-equals. The Emperor throws
// lightning when it is ready and his foe is in front of him, and between
// times taunts, never more than once in 6 s. The caller turns each to
// face its foe and moves it as `move` asks.
//
//   POWERS: { push, pull, choke, lightning, trick, distract } → their numbers and `who` may use them
//   createForce(who) → force        { who, cool: { [power]: s }, channel: { power, id, t } | null }
//   canUse(force, power) → bool      allowed, cooled and not holding another
//   useForce(force, power, caster, targets, { at, line } = {}) → events | null (null: not used, nothing spent)
//     caster and targets: { id, x, z, yaw?, hp?, stamina?, guard?, stagger? } (fighters, or a thing to pull)
//     push → [{ type: 'push', id, dir: { x, z }, speed }] everyone in a 50° cone out to 8 m (none is still a push)
//     pull → [{ type: 'pull', id, dir, speed }] the one nearest the aim
//     choke → [{ type: 'choke', id, lift: 0 }]   lightning → [{ type: 'lightning', id, damage: 0, drain: 0, guarded }]
//     trick → [{ type: 'trick', id, s: 8, line }] the one or two nearest within 4 m; they stand down and say the line
//     distract → [{ type: 'noise', at: { x, y, z }, heard: [id] }] at the point aimed at, brought to 6…14 m away
//   forceStep(force, caster, targets, dt) → events  cools, and runs a held choke or lightning:
//     { type: 'choke', id, lift } | { type: 'lightning', id, damage, drain, guarded } | { type: 'end', power, id }
//   stopForce(force) → events       lets go of a held power
//   vaderMind(state, foe, rand) → input   state: { me: fighter, force, last, read }; call it every step
//     input: { strike, guard, dodge, force: 'push' | 'choke' | null, move: 'in' | null }
//   emperorMind(state, foe, rand) → input & { say }   state: { me, force, now: s, saidAt: s, last }
//   TAUNTS: the Emperor’s lines

import { consider, pick } from '../../../../lib/ai/utility';
import { DEFLECT, facing, GUARD, PARRY, STROKES } from './saber';

const ADEPTS = ['vader', 'emperor', 'luke', 'obiwan'];

// range: metres; cone: degrees either side of the caster’s facing; cool: s
export const POWERS = {
  push: { range: 8, cone: 50, cool: 3, reel: 1, fast: 10, slow: 4, who: ADEPTS },
  pull: { range: 10, cone: 30, cool: 3, reel: 1, speed: 7, who: ADEPTS },
  // lift: how high the target rises, at `rise` m/s; dps: what it costs a target that still has more than 1 to lose
  choke: { range: 10, cone: 25, cool: 10, s: 2, lift: 0.6, rise: 1.2, dps: 6, who: ['vader'] },
  // dps unguarded (half through a guard facing him); drain: guard stamina a second
  lightning: { range: 12, cone: 30, cool: 5, s: 3, dps: 20, drain: 15, who: ['emperor'] },
  trick: { range: 4, most: 2, s: 8, cool: 12, who: ['obiwan', 'luke'] },
  // near…far: how far off the noise lands; hear: how far from it a guard turns to it
  distract: { near: 6, far: 14, hear: 10, cool: 15, who: ['obiwan'] },
};

const TRICKED = 'These aren’t the droids we’re looking for.';
const QUIET = 6; // seconds the Emperor leaves between taunts

export const TAUNTS = [
  'Your friends are out there in the dark, and you are up here with me.',
  'Every guard you raise tires you a little more.',
  'Look out of the window. That is your fleet, and this is my station.',
  'You came here of your own will. You’ll stay by mine.',
  'Anger holds a blade up longer than hope does.',
];

const flat = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);

function away(from, to) {
  const d = flat(from, to) || 1;
  return { x: (to.x - from.x) / d, z: (to.z - from.z) / d };
}

// the target closest to where the caster looks, within range and cone
function aimed(caster, targets, range, cone) {
  let best = null;
  let bestCos = -Infinity;
  for (const t of targets) {
    const d = flat(caster, t);
    if (t.id === caster.id || d > range || !facing(caster, t, cone)) continue;
    const c = d < 1e-6 ? 1 : (Math.sin(caster.yaw) * (t.x - caster.x) - Math.cos(caster.yaw) * (t.z - caster.z)) / d;
    if (c > bestCos) {
      bestCos = c;
      best = t;
    }
  }
  return best;
}

// a thing to pull has no stagger to set; a fighter does, and a fighter
// thrown or gripped is neither swinging nor dodging any more
function reel(t, s) {
  if (typeof t.stagger !== 'number') return;
  t.stagger = Math.max(t.stagger, s);
  t.guard = false;
  t.stroke = null;
  t.dodge = 0;
}

export function createForce(who) {
  return { who, cool: {}, channel: null };
}

export function canUse(force, power) {
  const p = POWERS[power];
  return !!p && p.who.includes(force.who) && !force.channel && (force.cool[power] ?? 0) <= 0;
}

export function useForce(force, power, caster, targets, opts = {}) {
  if (!canUse(force, power)) return null;
  const p = POWERS[power];
  const others = targets.filter((t) => t.id !== caster.id);
  let events;
  if (power === 'push') {
    events = others
      .filter((t) => flat(caster, t) <= p.range && facing(caster, t, p.cone))
      .map((t) => {
        reel(t, p.reel);
        return { type: 'push', id: t.id, dir: away(caster, t), speed: p.fast - ((p.fast - p.slow) * flat(caster, t)) / p.range };
      });
  } else if (power === 'pull') {
    const t = aimed(caster, others, p.range, p.cone);
    if (!t) return null;
    reel(t, p.reel);
    events = [{ type: 'pull', id: t.id, dir: away(t, caster), speed: p.speed }];
  } else if (power === 'choke' || power === 'lightning') {
    // only someone with health to lose can be gripped or burned
    const t = aimed(caster, others.filter((o) => typeof o.hp === 'number'), p.range, p.cone);
    if (!t) return null;
    force.channel = { power, id: t.id, t: 0 };
    events = [power === 'choke' ? { type: 'choke', id: t.id, lift: 0 } : { type: 'lightning', id: t.id, damage: 0, drain: 0, guarded: shielded(t, caster) }];
  } else if (power === 'trick') {
    const near = others
      .map((t) => ({ t, d: flat(caster, t) }))
      .filter((n) => n.d <= p.range)
      .sort((a, b) => a.d - b.d)
      .slice(0, p.most);
    if (!near.length) return null;
    events = near.map(({ t }) => ({ type: 'trick', id: t.id, s: p.s, line: opts.line ?? TRICKED }));
  } else {
    const aim = opts.at && flat(caster, opts.at) > 1e-6 ? away(caster, opts.at) : { x: Math.sin(caster.yaw), z: -Math.cos(caster.yaw) };
    const d = Math.min(p.far, Math.max(p.near, opts.at ? flat(caster, opts.at) : p.near));
    const at = { x: caster.x + aim.x * d, y: opts.at?.y ?? caster.y ?? 0, z: caster.z + aim.z * d };
    events = [{ type: 'noise', at, heard: others.filter((t) => flat(at, t) <= p.hear).map((t) => t.id) }];
  }
  force.cool[power] = p.cool;
  return events;
}

// a guard counts against lightning only when it faces the caster, as against a bolt
const shielded = (t, caster) => !!t.guard && facing(t, caster, DEFLECT);

function end(force) {
  const { power, id } = force.channel;
  force.channel = null;
  return [{ type: 'end', power, id }];
}

export function stopForce(force) {
  return force.channel ? end(force) : [];
}

export function forceStep(force, caster, targets, dt) {
  for (const k of Object.keys(force.cool)) force.cool[k] = Math.max(0, force.cool[k] - dt);
  const c = force.channel;
  if (!c) return [];
  const p = POWERS[c.power];
  const t = targets.find((o) => o.id === c.id);
  if (!t || flat(caster, t) > p.range || t.hp <= 0) return end(force);
  c.t += dt;
  const events = [];
  if (c.power === 'choke') {
    t.hp = Math.max(Math.min(t.hp, 1), t.hp - p.dps * dt);
    reel(t, p.s - c.t);
    events.push({ type: 'choke', id: t.id, lift: Math.min(p.lift, p.rise * c.t) });
  } else {
    const guarded = shielded(t, caster);
    let damage = p.dps * dt;
    let drain = 0;
    if (guarded) {
      damage /= 2;
      drain = p.drain * dt;
      t.stamina = Math.max(0, t.stamina - drain);
      if (t.stamina <= 0) {
        t.guard = false;
        t.stagger = Math.max(t.stagger ?? 0, GUARD.broken);
      }
    }
    t.hp = Math.max(0, t.hp - damage);
    events.push({ type: 'lightning', id: t.id, damage, drain, guarded });
  }
  if (c.t >= p.s) events.push(...end(force));
  return events;
}

const NONE = { strike: null, guard: false, dodge: false, force: null, move: null };

const VADER = [
  { id: 'guard', weight: 1.2, considerations: [(c) => (c.coming ? 1 : 0)] },
  { id: 'heavy', weight: 1, considerations: [(c) => (c.d <= STROKES.heavy.reach ? 1 : 0), (c) => (c.me.stamina >= STROKES.heavy.cost ? 1 : 0), (c) => (c.foe.guard || c.foe.stagger > 0 ? 1 : 0.35)] },
  { id: 'light', weight: 0.9, considerations: [(c) => (c.d <= STROKES.light.reach ? 1 : 0), (c) => (c.me.stamina >= STROKES.light.cost ? 1 : 0), (c) => (c.foe.guard ? 0.2 : 1)] },
  // a push buys room to get his breath back
  { id: 'push', weight: 1.1, considerations: [(c) => (c.me.stamina < STROKES.heavy.cost ? 1 : 0), (c) => (c.d <= 3 ? 1 : 0), (c) => (canUse(c.force, 'push') && facing(c.me, c.foe, POWERS.push.cone) ? 1 : 0)] },
  { id: 'choke', weight: 0.7, considerations: [(c) => (c.d > STROKES.heavy.reach && c.d <= POWERS.choke.range ? 1 : 0), (c) => (canUse(c.force, 'choke') && facing(c.me, c.foe, POWERS.choke.cone) ? 1 : 0)] },
  // beyond a light stroke’s reach he always does better to step in than to
  // stand: the floor keeps him coming from just outside it, where a heavy
  // could still poke at him, and `wait` sits below the floor
  { id: 'close', weight: 0.6, considerations: [(c) => (c.d > STROKES.light.reach ? 1 : 0), (c) => Math.max(0.5, consider(c.d, [STROKES.light.reach, STROKES.light.reach + 2]))] },
  { id: 'wait', weight: 0.1 },
];

// He reads a stroke a beat after it starts and means his guard to come up
// just before its blow lands, inside the parry window; how well he judges
// that is his rand, so he parries most, is caught by some, and meets a few
// with a guard up too long to parry. react: s before he can answer at all
// (never sooner, however he judges it); slop: s his timing is out by,
// either way.
const READ = { react: 0.1, slop: 0.12 };

// The moment (stroke.t) Vader answers the foe’s stroke, drawn once a stroke.
// A stroke is new when there was none, or its clock or kind went back.
function read(state, foe, rand) {
  const s = foe.stroke;
  if (!s) {
    state.read = null;
    return null;
  }
  if (!state.read || s.t < state.read.t || s.kind !== state.read.kind) {
    const k = STROKES[s.kind];
    state.read = { kind: s.kind, at: Math.max(READ.react, k.at - PARRY / 2 + (rand() * 2 - 1) * READ.slop) };
  }
  state.read.t = s.t;
  return state.read;
}

const VADER_DOES = {
  guard: { guard: true },
  heavy: { strike: 'heavy' },
  light: { strike: 'light' },
  push: { force: 'push' },
  choke: { force: 'choke' },
  close: { move: 'in', guard: true },
  wait: { guard: true },
};

export function vaderMind(state, foe, rand) {
  const { me, force } = state;
  // read every step, even when he can’t act on it, so each stroke is drawn for once
  const r = read(state, foe, rand);
  if (me.stagger > 0 || me.stroke || me.dodge > 0) return { ...NONE };
  const d = flat(me, foe);
  // a stroke is coming until it ends, not just until its blow, so his
  // guard is still up on the blow’s step whichever order the caller
  // steps the foe, runs this and resolves the blow in
  const coming = !!r && d <= STROKES[foe.stroke.kind].reach + 0.5;
  // not read yet: he is caught as he stands, neither cutting into it nor raising a guard
  if (coming && foe.stroke.t < r.at) return { ...NONE, guard: me.guard };
  const ctx = { me, foe, force, d, coming };
  const chosen = pick(VADER, ctx, { current: state.last, rand, spread: 0.15 });
  state.last = chosen.id;
  return { ...NONE, ...VADER_DOES[chosen.id] };
}

const EMPEROR = [
  { id: 'lightning', weight: 1, considerations: [(c) => (canUse(c.force, 'lightning') ? 1 : 0), (c) => (c.d <= POWERS.lightning.range && facing(c.me, c.foe, POWERS.lightning.cone) ? 1 : 0)] },
  { id: 'taunt', weight: 0.6, considerations: [(c) => (c.now - c.saidAt >= QUIET ? 1 : 0)] },
  { id: 'watch', weight: 0.1 },
];

export function emperorMind(state, foe, rand) {
  const ctx = { me: state.me, foe, force: state.force, d: flat(state.me, foe), now: state.now, saidAt: state.saidAt };
  const chosen = pick(EMPEROR, ctx, { current: state.last });
  state.last = chosen.id;
  if (chosen.id === 'lightning') return { ...NONE, force: 'lightning', say: null };
  if (chosen.id === 'watch') return { ...NONE, say: null };
  state.saidAt = state.now;
  return { ...NONE, say: TAUNTS[Math.floor(rand() * TAUNTS.length)] };
}
