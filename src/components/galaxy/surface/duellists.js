// The quests' duellists: a spawn with a blade (`hostile.blade`) fences. Its
// mind is lib/combat/duel.js's (close, circle, stroke, recover; block or
// parry your stroke; reel); its body activity.js's rigged crew figure, the
// saber in its own hand (heldBlade.js's bladeInHand, on saber.js), so its
// strokes are the same clips as yours and what lands is what its blade
// sweeps, inside the clip's contact window. Wiring beside activity.js,
// kept apart so that file doesn't grow.
//
//   duelFor(spec, seed, hero?) → its mind (createDuellist), from the spawn's
//     hostile: reach, parry (the share of your strokes it blocks, as ever),
//     riposte (the share of those it parries), the blade's stance; hero (its
//     crew row, by the spawn's kind): on the 2017 game's rig, the game's
//     strikes at the game's cadence (gameStance.js's stanceFor)
//   asTarget() → you as their blades see you ({ holder, fig, you: true },
//     what blaster.js's capsuleOf and saber.js's lock read); .at(st) moves it
//   engaged(t, dist) → whether it fences its mark now (within ENGAGE once it
//     has it, until LEAVE)
//   stepDuel(t, mark, dt, time, world) → whether its feet are going: its
//     mind's step, its stroke begun (or dropped: its mark gone), its block
//     (t.blocking, and t.blockSide: the side of it your stroke comes in on,
//     blockSide.js's), its feet. mark: { x, z, target (what its blade may
//     hit), swinging (yours, swingingOf's, when the mark is you), dead }
//   fence(t, aim, { you, swinging }, dt, time, world) → whether its feet are
//     going, while it fences its mark (aim: activity.js's hostileAim; you:
//     asTarget's); null when it doesn't, its mind stood down (it hunts then)
//   swingingOf(saber, now, yaw?) → your stroke as its mind reads it ({ contact,
//     t, speed, cut (the way it cuts: blockSide.js's cutOf), yaw (where you
//     face) }, `t` seconds into the clip) or null
//   incomingAt(targets, you) → the side of you ('left' | 'right' | null) the
//     nearest duellist's stroke at you comes in on (your block's: scene.js);
//     you: { x, z, yaw }
//   landed(t, target, damage, at, { heavy }) → the contact's record for the
//     scene, when the target is you ({ melee, blade, damage, point, from,
//     contactAt (when its blade's contact began), who }); null for anyone else
//   stun(t, secs, next) → it reels: its mind staggered (then `next`), its
//     stroke dropped, its block let down; reeling(t, dt) while the body reels
//     (activity.js's t.stagger), its mind's clock with it
//   met(c, { saber, blockAt, now, window, guard, cost }) → their contact (or
//     a brawler's swipe) on you, met by your block: { how ('parry' | 'block'
//     | 'hit'), damage (what lands), guard (yours after: a block spends it) }
//   turnOf(t, { heavy }) → your stroke on a duellist, met by its blade:
//     { parried (turned), broke (its guard gone: it reels), perfect (its
//     parry: you reel) }, its guard counted down
//   clashes(saber, targets, now) → [{ at, who }]: your blade crossing a
//     duellist's while either strokes, a pair at most every CLASH_EVERY

import { createDuellist, duelStep, guarding, onStagger, swung } from '../../../lib/combat/duel';
import { cutOf, incomingSide } from './blockSide';
import { blockOutcome, guardHit } from './combatRules';
import { CREW } from './crewList';
import { stanceFor } from './gameStance';
import { shoreStep, turnToward } from './walker';

export const ENGAGE = 10; // m: within this of the mark it has, it fences
export const LEAVE = 14; // m: past this it hunts you as the others do (hostiles.js)
const CLASH_EVERY = 0.3; // s
const TURN = 6; // rad/s it squares up to you between strokes

export function duelFor(spec, seed = 1, hero = CREW[spec.kind] ?? null) {
  const h = spec.hostile;
  const stance = h.blade?.stance ?? 'single';
  // (a hero on the 2017 game's rig fences with the game's strikes, at their cadence: stanceFromTable.js)
  const st = stanceFor(stance, hero);
  return createDuellist({ reach: h.reach ?? 2.4, guard: h.parry ?? 0.6, parry: h.riposte ?? 0.35, stance, strokes: st.strokes.map((k) => k.clip), cadence: st.cadence ?? null, seed });
}

export function asTarget() {
  const position = { x: 0, y: 0, z: 0 };
  return {
    holder: { position },
    fig: { tall: 1.8 },
    spec: {},
    you: true,
    down: false,
    at(st) {
      position.x = st.x;
      position.y = st.y ?? 0;
      position.z = st.z;
      return this;
    },
  };
}

export function engaged(t, dist) {
  t.engaged = t.engaged ? dist <= LEAVE : Boolean(t.aim) && dist <= ENGAGE;
  return t.engaged;
}

export function stepDuel(t, mark, dt, time, world) {
  const d = t.duel;
  const b = t.b;
  d.at[0] = b.x;
  d.at[1] = b.z;
  const o = duelStep(d, mark && { pos: [mark.x, mark.z], swinging: mark.swinging ?? null, dead: Boolean(mark.dead) }, dt);
  const saber = t.blade.saber;
  if (o.begin) {
    const sw = t.blade.swing(time, { clip: o.stroke, lock: mark?.target ?? null });
    if (sw) swung(d, sw.dur / sw.speed);
  } else if (!o.stroke && saber.swinging) saber.cancel(); // (its mark gone mid-stroke: not at air for the rest of the clip)
  t.blocking = o.block;
  // (on the side of it your stroke comes in on: a 2017 hero lays the game's block for it, saber.js)
  t.blockSide = o.block ? incomingSide(mark?.swinging?.cut, { from: mark?.swinging?.yaw, to: b.yaw }) : null;
  // (no mark: its feet and its facing are the hunt's, hostiles.js's)
  if (!mark) return false;
  const pace = t.hostile.chase ?? 2;
  const x = b.x + o.move[0] * pace * dt;
  const z = b.z + o.move[1] * pace * dt;
  const held = shoreStep(world, b, x, z);
  b.x = held ? held[0] : x;
  b.z = held ? held[1] : z;
  // (through a stroke the saber turns it to its lock, over the wind-up)
  if (o.state !== 'attack') b.yaw = turnToward(b.yaw, o.face, dt * TURN);
  return Math.hypot(o.move[0], o.move[1]) > 0.05;
}

export function stun(t, secs, next = null) {
  if (!t.duel) return;
  onStagger(t.duel, secs, next);
  t.blade?.saber.cancel();
  t.blocking = false;
}
export function reeling(t, dt) {
  if (t.duel?.state === 'stagger') t.duel.timer -= dt;
}

export function fence(t, aim, { you, swinging = null }, dt, time, world) {
  if (!t.duel) return null;
  if (aim && engaged(t, Math.hypot(aim.x - t.b.x, aim.z - t.b.z))) {
    t.duelMark = t.victim ?? you;
    const moving = stepDuel(t, { x: aim.x, z: aim.z, target: t.duelMark, swinging: t.victim ? null : swinging }, dt, time, world);
    t.aim = { x: aim.x, z: aim.z };
    t.guessed = false;
    return moving ? 1 : 0;
  }
  t.engaged = false;
  t.duelMark = null;
  stepDuel(t, null, dt, time, world); // (stood down: its stroke dropped, its block let go)
  return null;
}

export function swingingOf(saber, now, yaw = null) {
  const sw = saber?.swinging;
  return sw ? { contact: sw.contact, t: (now - sw.t0) * sw.speed, speed: sw.speed, cut: cutOf(saber.stance, sw.name), yaw } : null;
}

export function incomingAt(targets, you) {
  let near = null;
  let best = Infinity;
  for (const t of targets) {
    if (t.down || !t.duelMark?.you || !t.blade?.saber.swinging) continue;
    const d = Math.hypot(t.b.x - you.x, t.b.z - you.z);
    if (d < best) [near, best] = [t, d];
  }
  if (!near) return null;
  const s = near.blade.saber;
  return incomingSide(cutOf(s.stance, s.swinging.name), { from: near.b.yaw, to: you.yaw });
}

export function landed(t, target, damage, at, { heavy = false } = {}) {
  if (!target?.you) return null;
  const sw = t.blade.saber.swinging;
  return {
    melee: true,
    blade: true,
    // (your health counts in its own numbers: the spawn's damage, as its swipe dealt)
    damage: t.hostile.damage ?? 16,
    heavy,
    point: [at.x, at.y, at.z],
    from: [t.b.x, t.holder.position.y, t.b.z],
    contactAt: sw ? sw.t0 + sw.contact[0] / sw.speed : null,
    who: t,
  };
}

export function met(c, { saber, blockAt = null, now, window, guard, cost = 1 }) {
  const how = blockOutcome({ shown: Boolean(saber?.guard()), blockAt, contactAt: c.contactAt ?? now, now, window });
  return { how, damage: how === 'hit' ? c.damage : 0, guard: how === 'block' ? guardHit(guard, (c.damage ?? 20) * 1.4 * cost, now) : guard };
}

const NONE = { parried: false, broke: false, perfect: false };
export function turnOf(t, { heavy = false } = {}) {
  const h = t.hostile;
  const how = t.duel && !t.down && !(t.stagger > 0) && !t.knock ? guarding(t.duel) : null;
  // (not up, or its guard's down: everything lands)
  if (!how || (h.guard && t.guard <= 0)) return NONE;
  if (heavy) {
    if (!h.guard) return NONE;
    t.guard = 0;
    t.guardAt = -99;
    return { parried: false, broke: true, perfect: false };
  }
  if (h.guard && --t.guard <= 0) return { parried: true, broke: true, perfect: false };
  return { parried: true, broke: false, perfect: how === 'parry' };
}

export function clashes(saber, targets, now) {
  const out = [];
  if (!saber?.lit || !saber.blades[0]) return out;
  for (const t of targets) {
    const theirs = t.blade?.saber;
    if (!t.duel || t.down || !theirs?.lit || !theirs.blades[0]) continue;
    if (!saber.swinging && !theirs.swinging) continue;
    if (now - (t.clashAt ?? -99) < CLASH_EVERY) continue;
    const c = saber.blades[0].clash(theirs.blades[0]);
    if (!c) continue;
    t.clashAt = now;
    out.push({ at: c.at, who: t });
  }
  return out;
}
