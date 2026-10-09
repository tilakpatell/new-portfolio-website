// A hostile's body on Rapier: its character (lib/physics/character.js),
// its hurtboxes by region from its bones (lib/physics/hurtbox.js through
// lib/three/combat/hitboxRig.js; one capsule, `whole`, for a figure with
// no bones), and its mind (lib/ai/mind.js) over them. activity.js keeps
// its planner (hostiles.js's hostileStep, a duellist's fence): each frame
// it plans where the figure's feet go next, as before, and hands the plan
// here (`drive`) instead of writing it into the figure; the plan becomes
// an intent, the character moves on it a substep at a time, stopped by
// what's solid, and `sync` reads the body back into the figure's walk
// (`t.b`) for everything that draws from it. The mind decides only what
// the planner can't: stunned (a hit: no intent, the knock carries it),
// dead; and names the mode (patrol, chase, search, attack) from what the
// figure saw (`saw`). Thinking has a rate by distance (`rate`, the
// spec's rings). Wiring beside activity.js.
//
//   createHostileBody(sp, t, { root = null, tall = 1.8, radius = 0.38, seed, blade }) → hb
//     t: activity.js's target ({ b: { x, z, yaw }, spec, hostile, home })
//   hb: { c, rig, hurt, mind, y (its feet's height),
//     step(dt, w)            the rig's bones read, the mind ticked
//     drive(plan, from, dt)  plan: { x, z, yaw } (where the planner put its feet this frame), from: where they were
//     sync(b) → b            the body read back into the walk
//     saw(bool)              found / lost, on the change
//     struck({ dir, force, kind, stun }), knock({ vx, vy, vz }), stun(secs), dead(),
//     rate(dist), dispose() }
//   rateFor(dist) → Hz (10 within NEAR m, 4 within MID, else 1)

import { createCharacter } from '../../../lib/physics/character';
import { createHurtboxes } from '../../../lib/physics/hurtbox';
import { createHitboxRig } from '../../../lib/three/combat/hitboxRig';
import { IDLE, createMind, mindStep } from '../../../lib/ai/mind';
import { STATES } from '../../../lib/ai/states';
import { CHARACTER } from '../../../lib/physics/character';

const NEAR = 25;
const MID = 60;
const PACE = 12; // m/s: the most a plan may ask of the feet in a frame (a stroke's lunge)
const HALF_MIN = 0.1;
const KNOCK_STUN = 1.4; // s: off its feet (activity.js's knock)
const KNOCK_DONE = 0.8; // m/s: a knock spent

export const rateFor = (dist) => (dist < NEAR ? 10 : dist < MID ? 4 : 1);

// the planner's states: each holds the driven intent, under its own name
const driven = (mode) => ({ tick: (bb) => ({ ...(bb.intent ?? IDLE), mode }) });
const HOSTILE_STATES = { ...STATES, patrol: driven('patrol'), search: driven('search'), chase: driven('chase'), attack: driven('attack') };

export function createHostileBody(sp, t, { root = null, tall = 1.8, radius = 0.38, seed = 1, blade = null } = {}) {
  const { phys } = sp;
  const scale = t.spec?.scale ?? 1;
  const r = radius * scale;
  const half = Math.max(HALF_MIN, (tall * scale) / 2 - r);
  const stand = half + r + CHARACTER.offset;
  const ground = sp.world.heightAt(t.b.x, t.b.z);
  const c = createCharacter(phys, { position: [t.b.x, ground + stand, t.b.z], radius: r, halfHeight: half, turn: 8, tag: 'hostile' });
  c.teleport([t.b.x, ground + stand, t.b.z], t.b.yaw);
  const rig = createHitboxRig(root ?? { getObjectByName: () => null, getWorldPosition: (v) => v.set(t.b.x, ground, t.b.z) }, null, { tall: tall * scale, blade });
  const hurt = createHurtboxes(phys, c, { single: rig.single, tall: tall * scale });
  rig.attach(hurt);
  const mind = createMind(HOSTILE_STATES, { start: 'patrol', seed, rate: 10 });
  mind.bb.after = 'chase';
  mind.bb.intent = { ...IDLE, vel: { x: 0, z: 0 } };
  const intent = { vel: { x: 0, z: 0 }, face: null, jump: 0 }; // what the substeps move on
  const pos = [0, 0, 0];
  const prev = [0, 0, 0];
  let seen = false;
  let gone = false;
  const off = phys.onSubstep((dt) => {
    if (gone) return;
    c.move(intent, dt);
  });
  const still = () => {
    intent.vel.x = 0;
    intent.vel.z = 0;
    intent.face = null;
  };

  return {
    c,
    rig,
    hurt,
    mind,
    y: ground,
    step(dt, w) {
      if (!gone) rig.update();
      mindStep(mind, w, dt);
    },
    drive(plan, from, dt) {
      if (gone || !(dt > 0)) return;
      const s = mind.state;
      if (s === 'stunned' || s === 'dead') {
        still();
        return;
      }
      let vx = (plan.x - from.x) / dt;
      let vz = (plan.z - from.z) / dt;
      const v = Math.hypot(vx, vz);
      if (v > PACE) {
        vx *= PACE / v;
        vz *= PACE / v;
      }
      intent.vel.x = vx;
      intent.vel.z = vz;
      intent.face = Number.isFinite(plan.yaw) ? plan.yaw : null;
      mind.bb.intent = { ...IDLE, vel: { x: vx, z: vz }, face: intent.face, mode: s };
    },
    sync(b) {
      if (gone) return b;
      const a = phys.alpha;
      c.position(pos);
      c.prev(prev);
      b.x = prev[0] + (pos[0] - prev[0]) * a;
      b.z = prev[2] + (pos[2] - prev[2]) * a;
      b.yaw = c.yaw;
      this.y = prev[1] + (pos[1] - prev[1]) * a - stand;
      return b;
    },
    saw(on) {
      if (on === seen) return;
      seen = on;
      mind.on(on ? 'found' : 'lost');
    },
    struck({ dir, force, kind = 'light', stun = 0.3 }) {
      if (gone) return;
      if (dir && force) c.knock([dir[0] * force, dir[1] * force, dir[2] * force]);
      if (kind === 'lethal') mind.on('dead');
      else if (stun > 0) mind.on('struck', { stun, kind });
    },
    knock(v) {
      if (gone) return;
      c.knock([v.vx ?? 0, v.vy ?? 0, v.vz ?? 0]);
      mind.on('struck', { stun: KNOCK_STUN, kind: 'heavy' });
    },
    knocked: () => !gone && c.knockLeft() > KNOCK_DONE,
    stun(secs) {
      if (gone) return;
      mind.on('struck', { stun: secs, kind: 'light' });
    },
    dead() {
      if (gone) return;
      mind.on('dead');
      gone = true;
      still();
      hurt.remove();
      c.remove();
    },
    rate(dist) {
      mind.every = 1 / rateFor(dist);
    },
    dispose() {
      off();
      if (!gone) {
        gone = true;
        hurt.remove();
        c.remove();
      }
      rig.debug(null);
    },
  };
}
