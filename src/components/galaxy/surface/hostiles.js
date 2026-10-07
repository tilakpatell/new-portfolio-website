// How the worlds' enemies fight, beyond standing and shooting (activity.js
// runs these on its targets each frame; the site's spawn says which, in
// `hostile`): bursts of fire, strafing round you, a shield that soaks hits
// before any land, and a blade that parries yours. Pure, so it's tested in
// Node.
//
//   hostile.burst   { n, gap }: n shots, `gap` seconds apart, each time it fires
//   hostile.strafe  { speed, every, keep }: it circles you at `speed` m/s, turning about every `every` seconds, holding about `keep` metres off
//   hostile.shield  n: hits it soaks before it's hurt (a droideka's bubble)
//   hostile.parry   0…1: the share of your swings its blade turns away
//
//   startBurst(hostile) → the shots left and the wait: { left, wait }
//   stepBurst(burst, dt) → how many shots fall due this frame (the burst
//     counted down; 0 once it's spent)
//   strafeStep(b, you, hostile, dt, time) → the new { x, z, yaw } (yaw: facing you)
//   absorb(t, damage) → { shield, hp } after a hit: the shield first, then the body
//   parries(hostile, roll) → whether a swing is turned away, `roll` 0…1

export const startBurst = (hostile) => ({ left: Math.max(1, hostile?.burst?.n ?? 1), wait: 0 });

export function stepBurst(burst, dt, gap = 0.12) {
  if (!burst || burst.left <= 0) return 0;
  burst.wait -= dt;
  let n = 0;
  while (burst.wait <= 0 && burst.left > 0) {
    n++;
    burst.left--;
    burst.wait += gap;
  }
  return n;
}

export function strafeStep(b, you, hostile, dt, time) {
  const s = hostile.strafe;
  const dx = you.x - b.x;
  const dz = you.z - b.z;
  const d = Math.hypot(dx, dz) || 1e-6;
  const yaw = Math.atan2(dx, dz);
  // across the line to you, one way then the other
  const side = Math.floor(time / (s.every ?? 2.2)) % 2 === 0 ? 1 : -1;
  const tx = -dz / d;
  const tz = dx / d;
  // and in or out, to hold the distance it likes
  const keep = s.keep ?? 10;
  const radial = d > keep * 1.25 ? 1 : d < keep * 0.75 ? -1 : 0;
  const step = (s.speed ?? 2.5) * dt;
  return { x: b.x + (tx * side + (dx / d) * radial * 0.6) * step, z: b.z + (tz * side + (dz / d) * radial * 0.6) * step, yaw };
}

export function absorb(t, damage) {
  const shield = Math.max(0, (t.shield ?? 0) - damage);
  const through = Math.max(0, damage - (t.shield ?? 0));
  return { shield, hp: t.hp - through };
}

export const parries = (hostile, roll) => Boolean(hostile?.parry) && roll < hostile.parry;

// ── An enemy's head (lib/ai) ──
//
// What an enemy knows of you is what it perceives (lib/ai/perception): a
// cone and a range from its spawn's `hostile` (range × 1.3 to see, the
// range to hear a shot), a detection timer quick up close and slow at the
// edge, the truth kept a couple of seconds after it loses sight of you,
// then a guess that fades. It weighs what to do (lib/ai/utility) every
// STEP.rethink seconds: with you in sight and in range, a shooter holds
// its ground and fires, strafes if its spawn says so, backs off if you're
// too close, and, when it has no shot token (world.tokens: so many fire at
// once, the rest move) or it's hurt, takes cover from your line of fire
// (lib/ai/spatial) or flanks round to a spot off your side; one that comes
// for you (chase: a rancor, a duellist) closes to arm's reach, and a
// duellist stays where you can see it. Lost sight of you, it goes to look
// where it last had you; its guess gone, it joins the group's search
// (world.search, lib/ai/search's coordinator: spots that could hide you,
// shared), and gives up back to its wander. Never further from its home
// than its leash. Pure.
//
//   sensesFor(hostile) → lib/ai/perception's senses
//   hostileStep(t, world, dt, r) → { x, z, yaw, mode, moving, aim: { x, z } | null }
//     t: { b: { x, z, yaw, to, wait }, hostile, spec, home: [x, z], hp, hpMax, flinch, me?, mind?, belief?, sees? }
//     world: { you: { x, z } | null, allies: [{ x, z }], seesThrough(a, b) | null, tokens?, who?, search?, stims? }
//     (who: this one's id for the tokens and the search)

import { belief, createSenses, sense } from '../../../lib/ai/perception';
import { consider, pick, runtime } from '../../../lib/ai/utility';
import { apart as awayFromAll, candidates, cover, nearTo, offLine, pickPlace, visible } from '../../../lib/ai/spatial';

export const STEP = {
  rethink: 0.4, // seconds between an enemy's choices
  keep: 10, // metres a shooter likes to keep, with no strafe to say otherwise
  pace: 1.6, // of its walk, moving to cover or round a flank
  look: 1.5, // metres from where it last had you: looked
  ring: 7, // metres out, the spots it weighs for cover or a flank
};

// (a shooter looks ahead, a wide cone; one that comes for you, a rancor, a duellist, smells and hears you all round)
export const sensesFor = (h = {}) => createSenses({ sight: { range: (h.range ?? 20) * 1.3, cone: h.cone ?? (h.chase || h.melee ? -1 : 0.3), far: h.far ?? 1.6 }, hearing: { range: h.range ?? 20 }, smell: { range: h.smell ?? 0 }, memory: h.memory ?? 7, intuition: 2.5 });

const P = (x, z) => ({ x, y: 0, z });
const OPTIONS = [
  { id: 'hold', weight: 0.5, considerations: [(c) => (c.near ? 1 : 0)] },
  { id: 'strafe', weight: 1.0, considerations: [(c) => (c.near && c.strafe ? 1 : 0)] },
  { id: 'close', weight: 1.2, considerations: [(c) => (c.chase && c.has ? 1 : 0), (c) => (c.d > c.reach * 0.8 ? 1 : 0)] },
  { id: 'back', weight: 0.9, considerations: [(c) => (c.near && !c.chase ? 1 : 0), (c) => consider(c.d, [c.keep * 0.6, c.keep * 0.3])] },
  { id: 'cover', weight: 1.3, considerations: [(c) => (c.near && !c.chase && !c.blade ? 1 : 0), (c) => (c.noShot ? 1 : 0.25) * (0.6 + 0.4 * consider(c.hp, [1, 0.4]))] },
  { id: 'flank', weight: 0.7, considerations: [(c) => (c.near && !c.chase && !c.blade ? 1 : 0), (c) => (c.noShot ? 0.9 : 0.15)] },
  { id: 'look', weight: 1.4, considerations: [(c) => (c.lost ? 1 : 0)] },
  { id: 'search', weight: 1.3, considerations: [(c) => (c.searching ? 1 : 0)] },
];

const leashed = (t, x, z) => {
  const leash = t.spec?.leash ?? (t.spec?.roam ?? 8) + (t.hostile?.strafe ? 10 : 0);
  return Math.hypot(x - t.home[0], z - t.home[1]) <= leash;
};
const walkTo = (b, goal, pace, dt, turn = 4) => {
  const dx = goal.x - b.x;
  const dz = goal.z - b.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.3) return { x: b.x, z: b.z, yaw: b.yaw, moving: 0, there: true };
  const yaw = turnToward(b.yaw, Math.atan2(dx, dz), turn * dt);
  const step = Math.min(d, pace * dt);
  return { x: b.x + (dx / d) * step, z: b.z + (dz / d) * step, yaw, moving: 1, there: false };
};
const turnToward = (from, to, max) => {
  let d = to - from;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return from + Math.max(-max, Math.min(max, d));
};

export function hostileStep(t, world, dt, r = Math.random) {
  const b = t.b;
  const h = t.hostile ?? {};
  const s = t.spec ?? {};
  const m = (t.mind ??= { mode: 'wander', goal: null, thinkAt: 0, clock: 0 });
  m.clock += dt;
  // perceiving
  t.senses ??= sensesFor(h);
  t.me ??= { pos: P(b.x, b.z), dir: null, beliefs: {}, now: 0 };
  t.me.pos.x = b.x;
  t.me.pos.z = b.z;
  t.me.dir = { x: Math.sin(b.yaw), y: 0, z: Math.cos(b.yaw) };
  const you = world.you ?? null;
  sense(t.senses, t.me, { targets: you ? [{ id: 'you', at: P(you.x, you.z), vel: you.vel ? { x: you.vel.x, y: 0, z: you.vel.z } : null, hostile: true }] : [], stims: world.stims }, dt, { seesThrough: world.seesThrough ?? null });
  const bel = belief(t.me, 'you');
  t.belief = bel;
  t.sees = Boolean(bel?.visible);
  const sure = Boolean(bel && (bel.visible || t.me.now - bel.seenAt <= t.senses.intuition));
  const target = bel ? (sure && you ? { x: you.x, z: you.z } : { x: bel.at.x, z: bel.at.z }) : null;
  const lost = Boolean(bel && !sure);
  if (bel) m.last = { x: bel.at.x, z: bel.at.z };
  // the group's search: joined when the guess has gone, left when it's done
  const search = world.search ?? null;
  const who = world.who ?? t;
  if (!bel && m.hadBelief && search && !search.active && m.last) search.start({ at: P(m.last.x, m.last.z) }, { aggressive: true });
  m.hadBelief = Boolean(bel);
  const searching = Boolean(!bel && search?.active && !search.done(who));
  const d = target ? Math.hypot(target.x - b.x, target.z - b.z) : Infinity;
  const near = Boolean(target) && d < (h.range ?? 0) * (sure ? 1 : 1.1);
  const noShot = Boolean(world.tokens) && !world.tokens.held('shot', who);
  const ctx = { has: Boolean(target), near, d, strafe: Boolean(h.strafe), chase: Boolean(h.chase), reach: h.reach ?? 2, keep: h.strafe?.keep ?? STEP.keep, blade: Boolean(h.blade), noShot, hp: (t.hp ?? 1) / Math.max(1, t.hpMax ?? t.hp ?? 1), lost, searching };
  // a choice, every so often (sooner when what it was doing is done)
  if (m.clock >= m.thinkAt || m.done) {
    m.thinkAt = m.clock + STEP.rethink;
    m.done = false;
    const choice = pick(OPTIONS, ctx, { current: m.mode, momentum: 0.2, rand: r, spread: 0.1 });
    const mode = choice?.id ?? 'wander';
    if (mode !== m.mode) m.since = m.clock;
    m.mode = mode;
    const seesThrough = world.seesThrough ?? (() => true);
    const allies = (world.allies ?? []).map((a) => P(a.x, a.z));
    const home = P(t.home[0], t.home[1]);
    const leash = s.leash ?? (s.roam ?? 8) + 10;
    if (mode === 'cover' && target) {
      const pts = candidates(P(b.x, b.z), { ring: STEP.ring, n: 10, walkable: (x, z) => leashed(t, x, z) });
      const best = pickPlace(pts, [cover([P(target.x, target.z)], seesThrough, 2), nearTo(home, leash, 0.5), awayFromAll(allies, 1.5, 0.5), nearTo(P(b.x, b.z), STEP.ring * 2, 0.3)], { current: m.goal ? P(m.goal.x, m.goal.z) : null, hysteresis: 0.2 });
      m.goal = best && best.score > 1.2 ? { x: best.at.x, z: best.at.z } : null;
      if (!m.goal) m.mode = 'hold';
    } else if (mode === 'flank' && target) {
      const pts = candidates(P(target.x, target.z), { ring: ctx.keep, n: 12, walkable: (x, z) => leashed(t, x, z) });
      const best = pickPlace(pts, [visible(P(target.x, target.z), seesThrough, 1), offLine(allies, P(target.x, target.z), 1.5, 1), awayFromAll(allies, 2, 0.5), nearTo(P(b.x, b.z), ctx.keep * 2, 0.6)], { current: m.goal ? P(m.goal.x, m.goal.z) : null, hysteresis: 0.2, bias: (p) => (p.x > target.x ? 0.02 : 0) });
      m.goal = best ? { x: best.at.x, z: best.at.z } : null;
      if (!m.goal) m.mode = 'hold';
    } else if (mode === 'look') m.goal = { ...m.last };
    else if (mode === 'search') {
      const claim = search.claim(who, P(b.x, b.z));
      m.goal = claim ? { x: claim.at.x, z: claim.at.z } : null;
      if (!m.goal) m.mode = 'wander';
    } else m.goal = null;
  }
  const pace = (h.strafe?.speed ?? s.speed ?? 1.4) * STEP.pace;
  let out = { x: b.x, z: b.z, yaw: b.yaw, moving: 0 };
  const face = (p) => turnToward(b.yaw, Math.atan2(p.x - b.x, p.z - b.z), 3 * dt);
  switch (m.mode) {
    case 'hold':
      out.yaw = target ? face(target) : b.yaw;
      break;
    case 'strafe': {
      const next = strafeStep(b, target, h, dt, m.clock);
      if (leashed(t, next.x, next.z)) out = { x: next.x, z: next.z, yaw: turnToward(b.yaw, next.yaw, 4 * dt), moving: 1 };
      else out.yaw = face(target);
      break;
    }
    case 'close': {
      const yaw = turnToward(b.yaw, Math.atan2(target.x - b.x, target.z - b.z), 2.2 * dt);
      if (d > ctx.reach * 0.8) {
        const nx = b.x + Math.sin(yaw) * h.chase * dt;
        const nz = b.z + Math.cos(yaw) * h.chase * dt;
        if (leashed(t, nx, nz)) out = { x: nx, z: nz, yaw, moving: 1 };
        else out.yaw = yaw;
      } else {
        out.yaw = yaw;
        m.done = true;
      }
      break;
    }
    case 'back': {
      const ax = b.x - target.x;
      const az = b.z - target.z;
      const l = Math.hypot(ax, az) || 1;
      const nx = b.x + (ax / l) * pace * 0.7 * dt;
      const nz = b.z + (az / l) * pace * 0.7 * dt;
      if (leashed(t, nx, nz)) out = { x: nx, z: nz, yaw: face(target), moving: 1 };
      else out.yaw = face(target);
      if (d >= ctx.keep * 0.6) m.done = true;
      break;
    }
    case 'cover':
    case 'flank':
    case 'look':
    case 'search': {
      if (!m.goal) break;
      const w = walkTo(b, m.goal, pace, dt);
      out = { x: w.x, z: w.z, yaw: w.yaw, moving: w.moving };
      if (w.there || runtime(m.clock - (m.since ?? m.clock), [0, 12]) <= 0) {
        if (m.mode === 'search') search.arrive(who);
        m.done = true;
      }
      // (in cover, and the way to you clear again: that's the shot; walking, it still faces you when close)
      if (target && d < 6 && m.mode !== 'search' && m.mode !== 'look') out.yaw = face(target);
      if (m.mode === 'search') search.sweep(who, P(out.x, out.z), world.seesThrough ?? null);
      break;
    }
    default: {
      // about its business: a wander near its home (as actors.js's), or standing still
      if (s.still) break;
      if (!b.to) {
        b.wait = (b.wait ?? 0) - dt;
        if (b.wait <= 0) {
          const a = r() * Math.PI * 2;
          b.to = [t.home[0] + Math.cos(a) * (s.roam ?? 8) * r(), t.home[1] + Math.sin(a) * (s.roam ?? 8) * r()];
        }
      } else {
        const w = walkTo(b, { x: b.to[0], z: b.to[1] }, s.speed ?? 1.4, dt, 5);
        if (w.there) {
          b.to = null;
          b.wait = 0.5 + r() * 2;
        } else out = { x: w.x, z: w.z, yaw: w.yaw, moving: w.moving };
      }
    }
  }
  out.mode = m.mode;
  out.aim = target && near ? { x: target.x, z: target.z } : null;
  out.guessed = lost;
  return out;
}
