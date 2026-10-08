// A landing's things that can be knocked about, in Rapier (lib/physics):
// the planet a fixed ball its own size, pulling toward its middle; each
// thing ./bodies.js names a body standing where furnish stood it, asleep
// till something comes; the people walking about (foot.js still walks
// them) as capsules that shove what they walk into; and the shots, as rays
// along each bolt's flight that stop at the first thing and knock it.
//
// Everything is in the planet's own space (footScene's root: its middle at
// the origin), in and out in map units; inside, the world is in metres
// (map units / METRE), Rapier's own scale for a person and a barrel. The
// layout is every pilot's (seeded), but what's been knocked about isn't
// sent: each pilot's props are their own.
//
// createLandingPhysics({ R, metre = METRE, g = 9.81, onHit({ entry, force,
//   at }) }) → Promise<{ add({ position, quaternion, scale, box (metres,
//   its own frame), body, awake?, user }) → entry | null, people([{ key,
//   at, up }], dt), shot(from, to) → { entry, at } | null, step(dt) (from
//   the frame), sync(write(entry, position, quaternion)) (those that moved),
//   settle(at, metres) (the far ones to sleep), pushers, size, dispose() }>
//   (onHit only for a hit over three times the thing's own weight, and not
//   again within HIT_GAP s; position and at in map units)

import { createPhysics } from '../../../lib/physics/world';
import { addPusher } from '../../../lib/physics/pusher';
import { METRE } from '../foot';
import { shapeFor } from './bodies';

const HIT_GAP = 0.25; // seconds between one thing's hits told
const SHOT = 4; // a bolt's push (N·s), at most
const SHOT_KICK = 10; // m/s it gives anything light, at most
const PERSON = { radius: 0.35, half: 0.55 }; // (a capsule 1.8 m tall)

// the turn taking +y to the unit vector u
function upTurn(u) {
  const [x, y, z] = u;
  if (y < -0.999999) return [1, 0, 0, 0];
  const q = [z, 0, -x, 1 + y];
  const n = Math.hypot(q[0], q[1], q[2], q[3]);
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}

export async function createLandingPhysics({ R, metre = METRE, g = 9.81, onHit = null } = {}) {
  const Rm = R / metre;
  const physics = await createPhysics({
    gravity: { centre: [0, 0, 0], g },
    maxSpeed: 30,
    // (fallen into the planet, or flown off it: put back)
    lost: ([x, y, z]) => {
      const d = Math.hypot(x, y, z);
      return d < Rm - 4 || d > Rm + 200;
    },
    onError: (err) => {
      if (import.meta.env?.DEV) console.warn('landing physics:', err);
    },
  });
  const { RAPIER, world } = physics;
  physics.add({ type: 'fixed', group: 'floor', friction: 0.8, colliders: [{ shape: 'ball', args: [Rm] }] });
  const entries = new Map(); // Body → entry
  const pushers = new Map(); // key → pusher
  let clock = 0;
  let gone = false;

  function add({ position, quaternion, scale = 1, box, body, awake = false, user = null }) {
    if (gone) return null;
    const shape = shapeFor(body, box, scale);
    if (!shape || !position?.every?.(Number.isFinite)) return null;
    const entry = { user, handle: null, scale, told: -Infinity };
    try {
      entry.handle = physics.add({
        type: shape.type,
        position: position.map((a) => a / metre),
        rotation: quaternion,
        sleeping: !awake,
        mass: shape.mass,
        friction: 0.6,
        restitution: 0.2,
        linearDamping: 0.3,
        angularDamping: 0.6,
        colliders: shape.colliders,
        // (three times its own weight: a knock or a fall, not lying there)
        hitThreshold: (shape.mass ?? 1) * g * 3,
        onHit: onHit
          ? (force, at) => {
              if (clock - entry.told < HIT_GAP) return;
              entry.told = clock;
              onHit({ entry, force, at: at.map((a) => a * metre) });
            }
          : null,
      });
    } catch {
      return null;
    }
    entries.set(entry.handle, entry);
    return entry;
  }

  // the people about: a capsule each, where foot.js has put them
  function people(list, dt = 1 / 60) {
    if (gone) return;
    const seen = new Set();
    for (const p of list) {
      if (!p?.at?.every?.(Number.isFinite)) continue;
      seen.add(p.key);
      const up = p.up ?? [0, 1, 0];
      const centre = [0, 1, 2].map((i) => p.at[i] / metre + up[i] * (PERSON.half + PERSON.radius));
      let pusher = pushers.get(p.key);
      if (!pusher) {
        pusher = addPusher(physics, { ...PERSON, position: centre });
        pushers.set(p.key, pusher);
      }
      pusher.follow(centre, dt, upTurn(up));
    }
    for (const [key, pusher] of pushers) {
      if (seen.has(key)) continue;
      pusher.remove();
      pushers.delete(key);
    }
  }

  // a bolt's flight this frame, from → to: the first thing in its way, knocked
  function shot(from, to) {
    if (gone) return null;
    const o = from.map((a) => a / metre);
    const d = [0, 1, 2].map((i) => to[i] / metre - o[i]);
    const len = Math.hypot(...d);
    if (!(len > 1e-6)) return null;
    const dir = { x: d[0] / len, y: d[1] / len, z: d[2] / len };
    const hit = world.castRay(new RAPIER.Ray({ x: o[0], y: o[1], z: o[2] }, dir), len, true, RAPIER.QueryFilterFlags.EXCLUDE_FIXED | RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC);
    const entry = hit && entries.get(hit.collider.parent()?.userData);
    if (!entry) return null;
    const t = hit.timeOfImpact;
    const at = [o[0] + dir.x * t, o[1] + dir.y * t, o[2] + dir.z * t];
    const j = Math.min(SHOT, entry.handle.mass * SHOT_KICK);
    entry.handle.push([dir.x * j, dir.y * j, dir.z * j], at);
    return { entry, at: at.map((a) => a * metre) };
  }

  const pos = [0, 0, 0];
  const quat = [0, 0, 0, 1];
  const out = (h, entry, write) => {
    h.position(pos);
    for (let i = 0; i < 3; i++) pos[i] *= metre;
    write(entry, pos, h.quaternion(quat));
  };

  return {
    add,
    people,
    shot,
    step(dt) {
      if (gone) return 0;
      clock += Math.max(0, dt || 0);
      return physics.step(dt);
    },
    // (the ones awake, and once, any a reset has moved)
    sync(write) {
      if (gone) return;
      physics.awake((h) => {
        const entry = entries.get(h);
        if (!entry || !h.dynamic) return;
        h.dirty = false;
        out(h, entry, write);
      });
      for (const [h, entry] of entries) {
        if (!h.dirty) continue;
        h.dirty = false;
        out(h, entry, write);
      }
    },
    settle(at, metres) {
      if (!gone) physics.sleepOutside(at.map((a) => a / metre), metres);
    },
    get pushers() {
      return pushers.size;
    },
    get size() {
      return entries.size;
    },
    dispose() {
      if (gone) return;
      gone = true;
      entries.clear();
      pushers.clear();
      physics.dispose();
    },
  };
}
