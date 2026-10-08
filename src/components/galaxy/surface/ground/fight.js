// The fight: a soldier of any side senses everyone round it, picks its
// threat among them by the war's sides, and fights it on hostiles.js's head
// (hold, strafe, close, back, cover, flank, look, search), with the gates the
// ground war adds: no shot without a line, none till it faces the target
// within 25°, a target seen beyond range closed on, aim that misses more at
// range, across, suppressed and on a burst's first shot, the squad's nerve
// choosing what it may do, and shot tokens per target. With nobody to fight
// it walks its beat or holds its post. Pure, tested. The design:
// docs/superpowers/specs/2026-10-08-ground-factions-design.md, section 6.
//
// world: { t (seconds), war, bodies: [{ id, x, z, vel, side, kind, squad?,
//   firingAt?, you? }], seesThrough(a, b), tokens (lib/ai/squad's), squads? }
// senseAll(s, world, dt); threatOf(s, world) → { id, x, z, vel, side,
//   visible, seenAt } | null; aimError(s, target, dist, { first, now });
// fightStep(s, world, dt, rand) → { x, z, yaw, mode, moving, aim, fire,
//   suppressive, guessed, target }; squadsOf(soldiers, { reach, war }) →
//   { update(dt), of(id), membersOf(id), postureOf(id), confidenceOf(id),
//   isFlanker(id) }; suppress(s, now); grudge(s, squads, now).

import { belief, createSenses, sense } from '../../../../lib/ai/perception';
import { confidence, createSquads, frontline, flankers as flankersOf, morale, posture } from '../../../../lib/ai/squad';
import { hostileStep, turnToward, walkTo } from '../hostiles';
import { weaponOf } from '../weaponRules';
import { relation, standingOf } from './standing';
import { TROOPS } from './troops';

export const GRUDGE = 90; // seconds a squad you shot at counts you its enemy
export const FACING = Math.PI / 7.2; // 25°: no shot till it faces its target this near
export const SUPPRESS = { near: 2, for: 1.5 };
export const LOST = 2; // seconds after losing sight it may send one burst at the last place
export const SENSE = 0.1; // seconds between a soldier's looks round
export const ENGAGED = 20; // seconds a fight stretches the leash after the last sight
const WALK = 0.42; // of its run, on a beat or going home

const P = (x, z) => ({ x, y: 0, z });
const velOf = (v) => (Array.isArray(v) ? { x: v[0], y: 0, z: v[1] } : v ? { x: v.x ?? 0, y: 0, z: v.z ?? 0 } : null);
const troopOf = (s) => TROOPS[s.kind] ?? TROOPS.stormtrooper;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// is this body one the soldier fights? (you and your mate by your oath, or a grudge)
const enemyTo = (s, b, world) => {
  if (b.id === s.id || !b.side && !b.you) return false;
  if (b.you) return standingOf(s.side, { side: b.side, war: world.war }) === 'enemy' || (s.grudge ?? 0) > world.t;
  return relation(s.side, b.side, world.war) === 'enemy';
};

export function senseAll(s, world, dt) {
  const t = troopOf(s);
  s.senses ??= createSenses({ sight: { range: t.range * 1.3, cone: t.cone, far: 1.6 }, hearing: { range: t.range }, memory: 7, intuition: 2.5 });
  s.me ??= { pos: P(s.b.x, s.b.z), dir: null, beliefs: {}, now: 0 };
  s.me.pos.x = s.b.x;
  s.me.pos.z = s.b.z;
  s.me.dir = { x: Math.sin(s.b.yaw), y: 0, z: Math.cos(s.b.yaw) };
  const reach = t.range * 1.3;
  const targets = [];
  for (const b of world.bodies) {
    if (b.id === s.id || Math.abs(b.x - s.b.x) > reach || Math.abs(b.z - s.b.z) > reach) continue;
    targets.push({ id: b.id, at: P(b.x, b.z), vel: velOf(b.vel), hostile: enemyTo(s, b, world), faction: b.side ?? null });
  }
  sense(s.senses, s.me, { targets }, dt, { seesThrough: world.seesThrough ?? null });
}

export function threatOf(s, world) {
  if (!s.me) return null;
  const mates = new Set([s.id]);
  if (world.squads?.membersOf) for (const id of world.squads.membersOf(s.id)) mates.add(id);
  if (s.squad) for (const b of world.bodies) if (b.squad === s.squad && b.side === s.side) mates.add(b.id);
  let best = null;
  let bestScore = -Infinity;
  for (const b of world.bodies) {
    if (!enemyTo(s, b, world)) continue;
    const bel = belief(s.me, b.id);
    // (detected: the meter full, or seen and lost only a moment ago)
    if (!bel || bel.confidence < 1) continue;
    const d = Math.hypot(bel.at.x - s.b.x, bel.at.z - s.b.z);
    let score = -d;
    if (b.firingAt && mates.has(b.firingAt)) score += 1000;
    if (bel.visible) score += 5;
    if (b.id === s.target) score += 8;
    if (score > bestScore) {
      bestScore = score;
      best = { id: b.id, x: bel.visible ? b.x : bel.at.x, z: bel.visible ? b.z : bel.at.z, vel: bel.visible ? velOf(b.vel) : bel.vel, side: b.side, visible: bel.visible, seenAt: bel.seenAt, you: Boolean(b.you) };
    }
  }
  return best;
}

export function aimError(s, target, dist, { first = false, now = s.now ?? 0 } = {}) {
  const w = weaponOf(s.weapon);
  const range = troopOf(s).range;
  const byRange = 1 + 1.2 * Math.min(1, Math.max(0, (dist - 1) / Math.max(1, range - 1)));
  const v = velOf(target?.vel) ?? { x: 0, z: 0 };
  let across = Math.hypot(v.x, v.z);
  if (Number.isFinite(target?.x) && Number.isFinite(target?.z)) {
    const dx = target.x - s.b.x;
    const dz = target.z - s.b.z;
    const l = Math.hypot(dx, dz);
    if (l > 1e-6) across = Math.abs((v.x * dz - v.z * dx) / l);
  }
  const suppressed = (s.suppressed ?? 0) > now ? 2 : 1;
  return w.spread * byRange * (1 + across / 6) * suppressed * (first ? 1.5 : 1);
}

export const suppress = (s, now) => {
  s.suppressed = now + SUPPRESS.for;
};

export function grudge(s, squads, now) {
  const ids = squads?.membersOf ? squads.membersOf(s.id) : [s.id];
  for (const m of squads?.soldiersOf ? squads.soldiersOf(ids) : [s]) m.grudge = now + GRUDGE;
  s.grudge = now + GRUDGE;
}

// with nobody to fight: the beat, or the post
function about(s, dt) {
  const t = troopOf(s);
  const pace = t.speed * WALK;
  if (s.beat?.length) {
    s.beatAt ??= 0;
    const p = s.beat[s.beatAt % s.beat.length];
    const w = walkTo(s.b, { x: p[0], z: p[1] }, pace, dt);
    if (w.there) s.beatAt = (s.beatAt + 1) % s.beat.length;
    return { x: w.x, z: w.z, yaw: w.yaw, mode: 'patrol', moving: w.moving };
  }
  s.postYaw ??= s.b.yaw;
  const w = walkTo(s.b, { x: s.home[0], z: s.home[1] }, pace, dt);
  if (!w.there) return { x: w.x, z: w.z, yaw: w.yaw, mode: 'post', moving: w.moving };
  return { x: s.b.x, z: s.b.z, yaw: turnToward(s.b.yaw, s.postYaw, 2 * dt), mode: 'post', moving: 0 };
}

const OPTIONS_BY = { retreat: ['back', 'cover'] };

export function fightStep(s, world, dt, rand = Math.random) {
  const now = world.t;
  s.now = now;
  const t = troopOf(s);
  s.senseAcc = (s.senseAcc ?? s.mind?.sense ?? 0) + dt;
  if (s.senseAcc >= SENSE || !s.me) {
    senseAll(s, world, s.senseAcc);
    s.senseAcc = 0;
  }
  const threat = threatOf(s, world);
  const quiet = { aim: null, fire: false, suppressive: false, guessed: false, target: null };
  if (!threat) {
    s.target = null;
    // (a fight just over: home first, then the beat or the post)
    if (s.engagedUntil > now && s.lost && now - s.lost.at <= LOST && !s.lost.shot && s.lost.line) {
      s.lost.shot = true;
      return { x: s.b.x, z: s.b.z, yaw: s.b.yaw, mode: 'look', moving: 0, ...quiet, aim: { x: s.lost.x, z: s.lost.z }, fire: true, suppressive: true, target: s.lost.id };
    }
    return { ...about(s, dt), ...quiet };
  }
  if (threat.visible) {
    s.engagedUntil = now + ENGAGED;
    s.lost = { id: threat.id, x: threat.x, z: threat.z, at: now, shot: false, line: false };
  }
  s.target = threat.id;
  const reach = s.leash + t.range;
  // the head hostiles.js's enemies think with, on this soldier's numbers
  const head = (s.head ??= { b: s.b, hostile: { range: t.range, cone: t.cone }, spec: { roam: 6, speed: t.speed * WALK }, home: s.home, mind: { mode: 'wander', goal: null, thinkAt: s.mind?.phase ?? 0, clock: 0 } });
  head.spec.leash = reach;
  head.hp = s.hp;
  head.hpMax = s.hpMax;
  const target = threat.id;
  const tokens = world.tokens ? { held: (kind, who) => world.tokens.held(kind, who, target) } : null;
  const posture = world.squads?.postureOf?.(s.id) ?? 'hold';
  const options = OPTIONS_BY[posture] ?? (posture === 'press' && world.squads?.isFlanker?.(s.id) ? ['flank', 'look', 'search'] : null);
  const allies = world.bodies.filter((b) => b.side === s.side && b.id !== s.id && Math.abs(b.x - s.b.x) < 30 && Math.abs(b.z - s.b.z) < 30);
  const you = { x: threat.x, z: threat.z, vel: threat.vel };
  let out = hostileStep(head, { you, allies, seesThrough: world.seesThrough ?? null, tokens, who: s.id, options }, dt, rand);
  const d = Math.hypot(threat.x - s.b.x, threat.z - s.b.z);
  const home = (x, z) => Math.hypot(x - s.home[0], z - s.home[1]) <= reach;
  // close to range: seen beyond it, it walks in (never past the stretched leash)
  if (d > t.range && posture !== 'retreat') {
    const w = walkTo(s.b, { x: threat.x, z: threat.z }, t.speed * 0.7, dt);
    out = home(w.x, w.z) ? { ...out, x: w.x, z: w.z, yaw: w.yaw, moving: w.moving, mode: 'advance' } : { ...out, x: s.b.x, z: s.b.z, yaw: w.yaw, moving: 0, mode: 'advance' };
  } else if (posture === 'retreat' && !['back', 'cover'].includes(out.mode)) {
    // (nowhere to hide: it gives ground, facing what it's backing from)
    const ax = s.b.x - threat.x;
    const az = s.b.z - threat.z;
    const l = Math.hypot(ax, az) || 1;
    const nx = s.b.x + (ax / l) * t.speed * 0.5 * dt;
    const nz = s.b.z + (az / l) * t.speed * 0.5 * dt;
    const yaw = turnToward(s.b.yaw, Math.atan2(-ax, -az), 3 * dt);
    out = home(nx, nz) ? { ...out, x: nx, z: nz, yaw, moving: 1, mode: 'back' } : { ...out, x: s.b.x, z: s.b.z, yaw, moving: 0, mode: 'back' };
  }
  if (!home(out.x, out.z)) out = { ...out, x: s.b.x, z: s.b.z, moving: 0 };
  // the gates: in range, a line to it, facing it, a token for this target
  const line = !world.seesThrough || world.seesThrough(P(s.b.x, s.b.z), P(threat.x, threat.z));
  if (s.lost && threat.visible) s.lost.line = line;
  const facing = Math.abs(wrap(Math.atan2(threat.x - out.x, threat.z - out.z) - out.yaw)) <= FACING;
  let fire = false;
  let suppressive = false;
  if (t.weapon && d <= t.range && facing) {
    if (threat.visible && line) fire = world.tokens ? world.tokens.claim('shot', s.id, { target }) : true;
    else if (s.lost && s.lost.line && !s.lost.shot && now - s.lost.at <= LOST) {
      // lost: one short burst where it last had it, which the cover between takes
      s.lost.shot = true;
      fire = true;
      suppressive = true;
    }
  } else if (world.tokens && !threat.visible) world.tokens.release('shot', s.id, target);
  const aim = suppressive ? { x: s.lost.x, z: s.lost.z } : { x: threat.x, z: threat.z };
  return { x: out.x, z: out.z, yaw: out.yaw, mode: out.mode, moving: out.moving, aim, fire, suppressive, guessed: !threat.visible, target };
}

// ── squads: lib/ai/squad's, per side, on the soldiers ──
export function squadsOf(soldiers, { reach = 18, war = 'gcw', near = 80 } = {}) {
  const list = () => (soldiers instanceof Map ? [...soldiers.values()] : soldiers);
  const sq = createSquads({ reach });
  const state = new Map(); // squad id → { level, losses, flank: Set, leader, known: Set }
  const byId = () => new Map(list().map((s) => [s.id, s]));
  const at = (s) => ({ x: s.b.x, y: 0, z: s.b.z });
  const api = {
    update(dt) {
      const all = list();
      const members = all.map((s) => ({ id: s.id, at: at(s), side: s.side, alive: s.alive }));
      const squads = sq.update(members);
      const ids = byId();
      for (const squad of squads) {
        const st = state.get(squad.id) ?? { level: 'neutral', losses: 0, flank: new Set(), leader: squad.members[0], known: new Set() };
        state.set(squad.id, st);
        // the members lost since (they were in it, and are down now)
        for (const id of st.known) if (ids.get(id) && ids.get(id).alive === false) {
          st.losses += 1;
          st.known.delete(id);
          if (id === st.leader) st.leaderDown = true;
        }
        for (const id of squad.members) st.known.add(id);
        st.losses *= Math.pow(0.5, dt / 60); // (losses fade over a minute or two)
        const mine = squad.members.map((id) => ids.get(id));
        const foes = all.filter((e) => e.alive && relation(squad.side, e.side, war) === 'enemy' && Math.hypot(e.b.x - squad.centre.x, e.b.z - squad.centre.z) < near);
        const value = (s) => (s.b ? s.hp / s.hpMax : 1);
        const c = confidence(squad, members, foes.map((e) => ({ id: e.id, at: at(e), alive: true, hp: e.hp, hpMax: e.hpMax, b: e.b })), { value, losses: st.losses });
        let level = c.level;
        if (st.leaderDown) level = morale(level, { type: 'leaderDown' });
        // (a droid never breaks)
        if (mine.every((s) => (TROOPS[s.kind]?.nerve ?? 1) === 0) && (level === 'panicked' || level === 'worried')) level = 'neutral';
        st.level = level;
        st.flank = new Set();
        if (posture(level) === 'press' && foes.length) {
          const front = frontline(squad, members, foes.map((e) => ({ id: e.id, at: at(e), alive: true })));
          for (const f of flankersOf(squad, members, front, foes.map((e) => ({ id: e.id, at: at(e), alive: true })))) st.flank.add(f.id);
        }
      }
    },
    of: (id) => sq.of(id),
    membersOf: (id) => sq.of(id)?.members ?? [id],
    soldiersOf: (ids) => {
      const m = byId();
      return ids.map((id) => m.get(id)).filter(Boolean);
    },
    confidenceOf: (id) => state.get(sq.of(id)?.id)?.level ?? 'neutral',
    postureOf: (id) => posture(api.confidenceOf(id)),
    isFlanker: (id) => Boolean(state.get(sq.of(id)?.id)?.flank.has(id)),
  };
  return api;
}
