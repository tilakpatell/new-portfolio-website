// The fighting aboard, as the game runs it: your shots and the crew’s go
// into the same bolts (rules/combat.js), which fly, stop at walls and doors,
// hit whoever is in the way and are sent back by a saber guard. A hit hurts
// a person through combat.hurt and the crew’s minds take it from there (a
// stagger, a fall, a death they report); a hit on you hurts you, and at
// none left you are down: in a story it goes back to the beat’s
// checkpoint, in free roam you come to at your side’s start. A blade
// swung at someone close in front of you cuts. Guns cool every step,
// yours and everyone’s. A bolt into a thing a story counts (AA-23’s
// cameras) breaks it. Pure apart from the game it changes.
//
//   fireYou(g, input) → bool          your shot (or swing) this step, if you fired and could
//   stepBattle(g, dt, open) → void    the bolts flown, the hits dealt, the guns cooled, you healed
//   youDown(g) → void                 what being put down does
//   BLADE                             the swing’s reach, arc and hurt

import { COMBAT, fire, gunOf, heatStep, hurt, regen, stepCombat } from '../combat';
import { furnish } from '../furnish';
import { feedPlot } from './plot';

export const BLADE = { reach: 2.2, cos: 0.5, hurt: 60, gap: 0.45 };
const EYE = 1.45; // metres above your feet a shot leaves from
const BREAK = 0.9; // metres from a counted thing a bolt must land to break it
const BREAKS = /^aa23-camera-\d+$|^aa23-intercom$/;

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function fireYou(g, input) {
  const you = g.you;
  if (!input.fire || you.hp <= 0) return false;
  const yaw = Number.isFinite(input.yaw) ? input.yaw : you.yaw;
  const pitch = Number.isFinite(input.pitch) ? input.pitch : 0;
  if (!you.gun && you.blade) return swing(g, yaw);
  if (!you.gun) return false;
  const dir = { x: Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) };
  const from = { x: you.x + dir.x * 0.5, y: you.y + (you.crouch ? 1 : EYE), z: you.z + dir.z * 0.5 };
  const bolt = fire(g.combat, { from, dir, owner: 'you', side: you.side, weapon: you.gun, npc: false }, g.rand);
  if (!bolt) return false;
  g.fired = true;
  g.events.push({ type: 'shot', by: 'you', weapon: you.gun, at: from });
  return true;
}

// a blade swung where you face: the nearest person close in front takes it
function swing(g, yaw) {
  const you = g.you;
  if (g.time - (g.swungAt ?? -Infinity) < BLADE.gap) return false;
  g.swungAt = g.time;
  g.events.push({ type: 'swing', by: 'you', colour: you.blade });
  const fx = Math.sin(yaw);
  const fz = -Math.cos(yaw);
  let best = null;
  for (const p of g.crew.people) {
    if (p.hp <= 0 || p.side === you.side || Math.abs(p.y - you.y) > 1.2) continue;
    const d = flat(p, you);
    if (d > BLADE.reach || ((p.x - you.x) * fx + (p.z - you.z) * fz) / (d || 1) < BLADE.cos) continue;
    if (!best || d < best.d) best = { p, d };
  }
  if (!best) return true;
  const p = best.p;
  p.hurtBy = 'you';
  hurt(p, BLADE.hurt, g.time);
  g.events.push({ type: 'hit', target: p.id, x: p.x, y: p.y + 1.2, z: p.z, damage: BLADE.hurt, by: 'blade' });
  return true;
}

function bodiesOf(g, guard) {
  const you = g.you;
  const out = [{ id: 'you', x: you.x, y: you.y, z: you.z, r: you.r, h: you.h, side: you.side, hp: you.hp, deflect: guard ? { yaw: you.yaw, active: true } : undefined }];
  for (const p of g.crew.people) if (p.hp > 0) out.push({ id: p.id, x: p.x, y: p.y, z: p.z, r: p.r, h: p.h, side: p.side, hp: p.hp, deflect: p.guard ? { yaw: p.yaw, active: true } : undefined });
  return out;
}

// a counted thing (a camera, the intercom) within reach of where a bolt struck
function breakAt(g, e) {
  g.furnished ??= new Map();
  const room = g.layout.rooms.get(e.room);
  if (!room) return;
  if (!g.furnished.has(room.id)) g.furnished.set(room.id, furnish(room, g.layout.station));
  for (const t of g.furnished.get(room.id).props) {
    if (!t.tag || !BREAKS.test(t.tag) || g.broken?.has(t.tag)) continue;
    if (Math.hypot(t.x - e.x, (t.y + (t.h ?? 0) / 2) - e.y, t.z - e.z) > BREAK + Math.max(t.w ?? 0, t.d ?? 0) / 2) continue;
    g.broken ??= new Set();
    g.broken.add(t.tag);
    g.events.push({ type: 'broke', tag: t.tag, x: t.x, y: t.y, z: t.z });
    feedPlot(g, { type: 'killed', kind: t.kind, tag: t.tag });
  }
}

export function youDown(g) {
  const you = g.you;
  g.events.push({ type: 'down', x: you.x, z: you.z });
  if (g.plot && !g.plot.done) {
    feedPlot(g, { type: 'died' });
    you.hp = you.max ?? COMBAT.health;
    return;
  }
  const start = g.layout.station.starts[g.side];
  g.teleport(start.room, start.x, start.z, start.yaw);
  you.hp = you.max ?? COMBAT.health;
  you.hurtAt = -Infinity;
}

export function stepBattle(g, dt, open, { guard = false } = {}) {
  const you = g.you;
  for (const gun of g.combat.guns.values()) {
    if (heatStep(gun, dt) === 'vented' && gun.owner === 'you') g.events.push({ type: 'vented' });
  }
  const own = you.gun ? gunOf(g.combat, 'you', you.gun) : null;
  you.heat = own?.heat ?? 0;
  you.venting = (own?.vent ?? 0) > 0;
  for (const e of stepCombat(g.combat, dt, { layout: g.layout, open, bodies: bodiesOf(g, guard) })) {
    if (e.type === 'hit') {
      if (e.target === 'you') {
        const shooter = g.crew.byId.get(e.owner);
        const what = hurt(you, e.damage, g.time);
        g.events.push({ type: 'hurt', amount: e.damage, from: shooter ? { x: shooter.x, z: shooter.z } : null, what });
        if (what === 'dead') youDown(g);
      } else {
        const p = g.crew.byId.get(e.target);
        if (p) {
          p.hurtBy = e.owner;
          hurt(p, e.damage, g.time);
        }
        g.events.push({ type: 'hit', target: e.target, x: e.x, y: e.y, z: e.z, damage: e.damage, by: e.owner });
      }
    } else if (e.type === 'wall') {
      g.events.push({ type: 'impact', x: e.x, y: e.y, z: e.z, normal: e.normal });
      breakAt(g, e);
    } else if (e.type === 'deflect') {
      g.events.push({ type: 'deflect', x: e.x, y: e.y, z: e.z, by: e.by });
    }
  }
  regen(you, dt, g.time);
}
