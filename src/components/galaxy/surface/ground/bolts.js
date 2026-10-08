// Bolts that fly: a soldier's shot is a bolt, swept the whole of each step
// against every body in its way (blaster.js's sweptHit) and stopped by the
// first wall (the scene's line of sight), never a roll of the dice. A bolt
// at you isn't resolved here: it's handed to the scene for blaster.enemy, so
// your dodge, your saber and your shield have it as ever. Past 60 m from
// you a fight is settled without bolts, by the same aim and damage
// (farExchange), so it comes out the same watched or not. Pure, tested. The
// design: docs/superpowers/specs/2026-10-08-ground-factions-design.md,
// section 7.
//
// createBolts({ speed, life }) → { fire({ from: [x, y, z], dir, side, owner,
//   damage, range, target? }) → bolt, step(dt, { bodies: [{ id, x, y, z, r,
//   h, side }], seesThrough }) → events, bolts }
//   events: { type: 'hit', bolt, target, at, dir } | { type: 'wall', bolt,
//   at } | { type: 'near', bolt, target } | { type: 'atYou', bolt }
// farExchange(a, b, dt, rand, { aimError, damageOf }) → { hits: [{ from,
//   to, damage }] }

import { sweptHit } from '../blaster';
import { cadenceOf } from './troops';

export const NEAR = 2; // metres: a bolt this near a body suppresses it
export const SPREAD_MAX = 0.1; // radians of aim error past which a far shot hits one time in ten
const SPLIT = 4; // halvings to find where along a step a wall stopped a bolt

export function createBolts({ speed = 90, life = 2 } = {}) {
  let next = 1;
  const bolts = [];
  const api = {
    bolts,
    fire({ from, dir, side = null, owner = null, damage = 10, range = 100, target = null }) {
      const l = Math.hypot(dir[0], dir[1], dir[2]) || 1;
      const bolt = { id: next++, p: [...from], from: [...from], d: [dir[0] / l, dir[1] / l, dir[2] / l], side, owner, damage, range, target, gone: 0, life, near: new Set() };
      bolts.push(bolt);
      return bolt;
    },
    step(dt, { bodies = [], seesThrough = null } = {}) {
      const events = [];
      for (let i = bolts.length - 1; i >= 0; i--) {
        const b = bolts[i];
        // (at you: the scene's to fly, through your dodge and your blade)
        if (b.target === 'you') {
          bolts.splice(i, 1);
          events.push({ type: 'atYou', bolt: b });
          continue;
        }
        const len = Math.min(speed * dt, b.range - b.gone);
        const a = b.p;
        let e = [a[0] + b.d[0] * len, a[1] + b.d[1] * len, a[2] + b.d[2] * len];
        // the first wall: where along the step it stops (halved down to the spot)
        let wall = null;
        if (seesThrough && !seesThrough({ x: a[0], z: a[2] }, { x: e[0], z: e[2] })) {
          let lo = 0;
          let hi = 1;
          for (let k = 0; k < SPLIT; k++) {
            const m = (lo + hi) / 2;
            if (seesThrough({ x: a[0], z: a[2] }, { x: a[0] + b.d[0] * len * m, z: a[2] + b.d[2] * len * m })) lo = m;
            else hi = m;
          }
          wall = [a[0] + b.d[0] * len * hi, a[1] + b.d[1] * len * hi, a[2] + b.d[2] * len * hi];
          e = wall;
        }
        // the nearest body it passes through on the way
        let hit = null;
        let hitT = Infinity;
        const dx = e[0] - a[0];
        const dz = e[2] - a[2];
        const seg = dx * dx + dz * dz;
        for (const o of bodies) {
          if (o.id === b.owner) continue;
          const t = seg > 0 ? Math.max(0, Math.min(1, ((o.x - a[0]) * dx + (o.z - a[2]) * dz) / seg)) : 0;
          const h = (o.h ?? 1.8) / 2;
          if (sweptHit(a, e, [o.x, (o.y ?? 0) + h, o.z], o.r ?? 0.45, h)) {
            if (t < hitT) {
              hitT = t;
              hit = o;
            }
            continue;
          }
          // (passed close: suppressed, once a bolt)
          if (b.near.has(o.id)) continue;
          const px = a[0] + dx * t - o.x;
          const pz = a[2] + dz * t - o.z;
          if (px * px + pz * pz < NEAR * NEAR) {
            b.near.add(o.id);
            events.push({ type: 'near', bolt: b, target: o.id });
          }
        }
        if (hit) {
          bolts.splice(i, 1);
          events.push({ type: 'hit', bolt: b, target: hit.id, at: [a[0] + (e[0] - a[0]) * hitT, a[1] + (e[1] - a[1]) * hitT, a[2] + (e[2] - a[2]) * hitT], dir: [...b.d] });
          continue;
        }
        if (wall) {
          bolts.splice(i, 1);
          events.push({ type: 'wall', bolt: b, at: wall });
          continue;
        }
        b.p = e;
        b.gone += len;
        b.life -= dt;
        if (b.gone >= b.range - 1e-6 || b.life <= 0) bolts.splice(i, 1);
      }
      return events;
    },
  };
  return api;
}

// two squads settling a fight out of your sight: each soldier's shots fall
// due by its gun's cadence, each at someone of the other side still up,
// landing as often as its aim error says
export function farExchange(a, b, dt, rand, { aimError, damageOf }) {
  const hits = [];
  const side = (mine, theirs) => {
    const up = theirs.filter((s) => s.alive);
    for (const s of mine) {
      if (!s.alive || !s.weapon || !up.length) continue;
      s.farCool = (s.farCool ?? rand() * cadenceOf(s.weapon)) - dt;
      while (s.farCool <= 0) {
        s.farCool += cadenceOf(s.weapon);
        const v = up[Math.floor(rand() * up.length) % up.length];
        const dist = Math.hypot(v.b.x - s.b.x, v.b.z - s.b.z);
        const err = aimError(s, { x: v.b.x, z: v.b.z, vel: null }, dist, {});
        if (rand() < 1 - Math.min(0.9, Math.max(0, err / SPREAD_MAX))) hits.push({ from: s.id, to: v.id, damage: damageOf(s.weapon, dist) });
      }
    }
  };
  side(a, b);
  side(b, a);
  return { hits };
}
