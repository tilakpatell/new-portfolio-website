// Rapier, Bruno Simon's way (folio-2025's Physics.js; the numbers are in
// docs/research/2026-10-08-folio-2025-physics-terrain-streaming.md §1), as
// data: a body is a description, added and removed, and a world steps.
//
// Where ours differs from his: a fixed 1/60 s step with an accumulator
// (times the time scale), at most maxSubsteps a call and the rest dropped,
// so the car is the same at 30 and 120 fps and a tab coming back doesn't
// launch it; and a floating origin (onOrigin) for an endless land.
//
// The engine is the -compat build (its wasm inlined: no bundler plugin, and
// it loads in Node for the tests), imported here only, and only when
// createPhysics is first called, so no page but the one driving pays for it.
// A load that fails (offline) isn't kept: the next call tries again.
// No three.js, no DOM.
//
// Round planets: gravity { centre, g } pulls every awake body toward the
// centre (the world's own gravity off, an impulse a substep), so a landing
// on a sphere (a fixed ball the planet's size) keeps its props on it
// wherever they roll; sleepers aren't touched, so they stay asleep.
//
// What it does about things going wrong, so a world never has to: a frame
// time that isn't a number steps nothing; a body whose numbers go bad (NaN)
// or that `lost` says is lost (fallen through, flown off) is put back where
// it began; no awake body goes faster than maxSpeed; a throwing onHit is
// handed to onError and the rest of the hits still come (as is a throwing
// substep hook, or a throwing `lost`: the step goes on); a body removed in
// the middle of a step (from an onHit) goes once the step's done; a body
// described wrong throws before anything is added; a removed body answers
// with where it last was; dispose twice is nothing, and a disposed world
// steps nothing.
//
//   GROUPS: floor (meets everything), object (meets everything and bumpers),
//     bumper (meets objects only), as Rapier's (memberships << 16) | filter
//   createPhysics({ gravity = -9.81 | { centre: [x, y, z], g = 9.81 },
//     timeScale = 1, maxSubsteps = 4, maxSpeed = 200, lost(position) → bool,
//     onError(err) })
//     → Promise<{ RAPIER, world, step(dt) → substeps taken, add(desc) → Body,
//       remove(body), onSubstep(fn(dt)) → off, awake(fn(Body)) (every awake
//       body), onOrigin([x, y, z]) (every body, and the planet's centre,
//       moved by −shift, velocities kept), sleepOutside([x, y, z], r) (r
//       along the ground; on a round planet, straight-line), disposed,
//       dispose() }>
//   desc: { type: 'dynamic' | 'fixed' | 'kinematicPositionBased' |
//     'kinematicVelocityBased', position, rotation ([x, y, z, w]), canSleep,
//     sleeping, enabled, linearDamping = 0.1, angularDamping = 0.1, mass,
//     friction = 0.2, restitution = 0.15, group = 'object', onHit(force, at),
//     hitThreshold = 15, colliders: [{ shape: 'cuboid' | 'ball' | 'cylinder'
//     | 'capsule' (args [half height, radius]) | 'hull' | 'trimesh' |
//     'heightfield', args, position, rotation, mass,
//     centreOfMass, friction, restitution, group }] }
//   Body: { body, colliders, desc, initial, reset(), resets (how many times
//     it's been put back), enable(on) (off on purpose: the sweep leaves it),
//     push([x, y, z], at?) → false for a push that isn't numbers (an impulse,
//     at a point if given, waking it),
//     removed, sleeping, position(out) → [x, y, z], quaternion(out) → [x, y,
//     z, w], onHit }
//
// (Rapier itself turns off a body whose velocity goes NaN in a step, and it
// drops out of the awake set; so the numbers are looked at before each
// substep, and every SWEEP substeps a body the engine turned off, not one
// turned off on purpose, is put back.)

export const STEP = 1 / 60;
const SWEEP = 60; // substeps between looks for bodies the engine turned off
const ALL = 1;
const OBJECT = 2;
const BUMPER = 4;
const group = (member, filter) => ((member << 16) | filter) >>> 0;
export const GROUPS = {
  floor: group(ALL, ALL),
  object: group(ALL | OBJECT, ALL | BUMPER),
  bumper: group(BUMPER, OBJECT),
};

const TYPES = new Set(['dynamic', 'fixed', 'kinematicPositionBased', 'kinematicVelocityBased']);

let engine = null;
async function load() {
  engine ??= import('@dimforge/rapier3d-compat')
    .then(async (m) => {
      const RAPIER = m.default ?? m;
      await RAPIER.init();
      return RAPIER;
    })
    .catch((err) => {
      engine = null;
      throw err;
    });
  return engine;
}

const v3 = (a) => ({ x: a?.[0] ?? 0, y: a?.[1] ?? 0, z: a?.[2] ?? 0 });
const finite = (a) => !a || (a.length >= 3 && a.every(Number.isFinite));
const q4 = (a) => (a ? { x: a[0], y: a[1], z: a[2], w: a[3] } : { x: 0, y: 0, z: 0, w: 1 });

function shapeOf(RAPIER, c) {
  const a = c.args ?? [];
  switch (c.shape) {
    case 'cuboid':
      return RAPIER.ColliderDesc.cuboid(a[0], a[1], a[2]);
    case 'ball':
      return RAPIER.ColliderDesc.ball(a[0]);
    case 'cylinder':
      return RAPIER.ColliderDesc.cylinder(a[0], a[1]);
    case 'capsule':
      return RAPIER.ColliderDesc.capsule(a[0], a[1]);
    case 'hull': {
      const cd = RAPIER.ColliderDesc.convexHull(a[0]);
      if (!cd) throw new Error('physics: no hull through those points');
      return cd;
    }
    case 'trimesh':
      return RAPIER.ColliderDesc.trimesh(a[0], a[1]);
    case 'heightfield':
      return RAPIER.ColliderDesc.heightfield(a[0], a[1], a[2], v3(a[3]));
    default:
      throw new Error(`physics: no shape '${c.shape}'`);
  }
}

export async function createPhysics({ gravity = -9.81, timeScale = 1, maxSubsteps = 4, maxSpeed = 200, lost = null, onError = (err) => console.error('physics:', err) } = {}) {
  const RAPIER = await load();
  const round = typeof gravity === 'object' && gravity !== null;
  const centre = round ? [...(gravity.centre ?? [0, 0, 0])] : null;
  const g = round ? (gravity.g ?? 9.81) : 0;
  const world = new RAPIER.World({ x: 0, y: round ? 0 : gravity, z: 0 });
  world.timestep = STEP;
  const events = new RAPIER.EventQueue(true);
  const owners = new Map(); // collider handle → Body
  const bodies = new Set();
  const hooks = new Set();
  let pending = []; // bodies reset last step, re-enabled this one
  let doomed = []; // bodies removed mid-step, gone once it's done
  let backlog = 0;
  let stepping = false;
  let disposed = false;
  const report = (err) => {
    try {
      onError?.(err);
    } catch {
      // (a reporter that throws has nobody to tell)
    }
  };

  function add(desc) {
    if (disposed) throw new Error('physics: add after the world was disposed');
    const type = desc.type ?? 'dynamic';
    if (!TYPES.has(type)) throw new Error(`physics: no body type '${type}'`);
    if (!finite(desc.position)) throw new Error(`physics: a body's position must be three numbers, not ${JSON.stringify(desc.position)}`);
    if (desc.rotation && !(desc.rotation.length === 4 && desc.rotation.every(Number.isFinite))) throw new Error('physics: a rotation is four numbers');
    const list = desc.colliders ?? [];
    // (every collider's description first: one that's wrong throws before
    // anything is in the world)
    const descs = list.map((c) => {
      const name = c.group ?? desc.group ?? 'object';
      if (!(name in GROUPS)) throw new Error(`physics: no group '${name}'`);
      const cd = shapeOf(RAPIER, c);
      if (c.position) cd.setTranslation(c.position[0], c.position[1], c.position[2]);
      if (c.rotation) cd.setRotation(q4(c.rotation));
      cd.setDensity(0.1);
      if (c.mass !== undefined) {
        if (c.centreOfMass) cd.setMassProperties(c.mass, v3(c.centreOfMass), { x: 1, y: 1, z: 1 }, { x: 0, y: 0, z: 0, w: 1 });
        else cd.setMass(c.mass);
      } else if (desc.mass !== undefined) cd.setMass(desc.mass / list.length);
      cd.setFriction(c.friction ?? desc.friction ?? 0.2);
      cd.setRestitution(c.restitution ?? desc.restitution ?? 0.15);
      cd.setCollisionGroups(GROUPS[name]);
      if (desc.onHit) {
        cd.setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS);
        cd.setContactForceEventThreshold(desc.hitThreshold ?? 15);
      }
      return cd;
    });
    const bd =
      type === 'fixed'
        ? RAPIER.RigidBodyDesc.fixed()
        : type === 'kinematicPositionBased'
          ? RAPIER.RigidBodyDesc.kinematicPositionBased()
          : type === 'kinematicVelocityBased'
            ? RAPIER.RigidBodyDesc.kinematicVelocityBased()
            : RAPIER.RigidBodyDesc.dynamic();
    bd.setTranslation(desc.position?.[0] ?? 0, desc.position?.[1] ?? 0, desc.position?.[2] ?? 0);
    bd.setRotation(q4(desc.rotation));
    bd.setCanSleep(desc.canSleep ?? true);
    bd.setSleeping(!!desc.sleeping);
    bd.setEnabled(desc.enabled ?? true);
    bd.setLinearDamping(desc.linearDamping ?? 0.1);
    bd.setAngularDamping(desc.angularDamping ?? 0.1);
    const body = world.createRigidBody(bd);
    // (where it was when it went, for whoever still asks)
    const last = { position: [...(desc.position ?? [0, 0, 0])], rotation: [...(desc.rotation ?? [0, 0, 0, 1])] };
    const handle = {
      body,
      colliders: [],
      desc,
      onHit: desc.onHit ?? null,
      initial: { position: [...last.position], rotation: [...last.rotation], sleeping: !!desc.sleeping },
      resets: 0,
      removed: false,
      off: desc.enabled === false,
      get sleeping() {
        return handle.removed || body.isSleeping();
      },
      position(out = [0, 0, 0]) {
        if (handle.removed) {
          out[0] = last.position[0];
          out[1] = last.position[1];
          out[2] = last.position[2];
          return out;
        }
        const t = body.translation();
        out[0] = t.x;
        out[1] = t.y;
        out[2] = t.z;
        return out;
      },
      quaternion(out = [0, 0, 0, 1]) {
        if (handle.removed) {
          for (let i = 0; i < 4; i++) out[i] = last.rotation[i];
          return out;
        }
        const r = body.rotation();
        out[0] = r.x;
        out[1] = r.y;
        out[2] = r.z;
        out[3] = r.w;
        return out;
      },
      // his protocol: off, put back without waking, on again next step (and
      // back to sleep if it began asleep), so overlapping resets don't explode
      reset() {
        if (handle.removed) return;
        body.setEnabled(false);
        body.setTranslation(v3(handle.initial.position), false);
        body.setRotation(q4(handle.initial.rotation), false);
        body.setLinvel({ x: 0, y: 0, z: 0 }, false);
        body.setAngvel({ x: 0, y: 0, z: 0 }, false);
        body.resetForces(false);
        body.resetTorques(false);
        handle.resets++;
        handle.off = false;
        if (!pending.includes(handle)) pending.push(handle);
      },
      push(impulse, at = null) {
        if (handle.removed || !finite(impulse) || !finite(at) || !impulse) return false;
        if (at) body.applyImpulseAtPoint(v3(impulse), v3(at), true);
        else body.applyImpulse(v3(impulse), true);
        return true;
      },
      enable(on) {
        if (handle.removed) return;
        handle.off = !on;
        body.setEnabled(!!on);
      },
      // (before it goes: where it was)
      keep() {
        handle.position(last.position);
        handle.quaternion(last.rotation);
      },
    };
    body.userData = handle;
    // (some shapes are only made here, a hull among them: one that won't
    // build takes the body back out with it)
    list.forEach((c, i) => {
      let collider;
      try {
        collider = world.createCollider(descs[i], body);
      } catch (err) {
        for (const made of handle.colliders) owners.delete(made.handle);
        world.removeRigidBody(body);
        throw new Error(`physics: a '${c.shape}' collider wouldn't build (${err?.message ?? err})`);
      }
      owners.set(collider.handle, handle);
      handle.colliders.push(collider);
    });
    bodies.add(handle);
    return handle;
  }

  function drop(handle) {
    handle.keep();
    for (const c of handle.colliders) owners.delete(c.handle);
    world.removeRigidBody(handle.body);
    handle.removed = true;
    pending = pending.filter((p) => p !== handle);
  }

  function remove(handle) {
    if (disposed || !handle || !bodies.delete(handle)) return;
    if (stepping) doomed.push(handle);
    else drop(handle);
  }

  const hit = (e) => {
    const a = owners.get(e.collider1());
    const b = owners.get(e.collider2());
    if (!a?.onHit && !b?.onHit) return;
    const m = (a?.body.mass() ?? 0) + (b?.body.mass() ?? 0) || 1;
    const force = e.maxForceMagnitude() / m;
    // (where: the body that isn't the one hit, as his)
    for (const [self, other] of [
      [a, b],
      [b, a],
    ]) {
      if (!self?.onHit || doomed.includes(self)) continue;
      try {
        self.onHit(force, (other ?? self).position());
      } catch (err) {
        report(err);
      }
    }
  };

  const bad = (t, v) => !(Number.isFinite(t.x + t.y + t.z) && Number.isFinite(v.x + v.y + v.z));
  // before a substep: anything awake whose numbers have gone bad put back
  // (before Rapier turns it off), and a round planet's pull on the rest
  const before = (b) => {
    const h = b.userData;
    if (!b.isDynamic() || !h || h.removed) return;
    const t = b.translation();
    if (bad(t, b.linvel())) {
      h.reset();
      return;
    }
    if (!round) return;
    const dx = centre[0] - t.x;
    const dy = centre[1] - t.y;
    const dz = centre[2] - t.z;
    const d = Math.hypot(dx, dy, dz);
    if (!(d > 1e-6)) return;
    const k = (g * b.mass() * b.gravityScale() * STEP) / d;
    b.applyImpulse({ x: dx * k, y: dy * k, z: dz * k }, false);
  };
  // after it: anything gone bad or lost put back, anything too fast slowed
  const t3 = [0, 0, 0];
  const isLost = (at) => {
    try {
      return lost(at);
    } catch (err) {
      report(err);
      return false;
    }
  };
  const after = (b) => {
    const h = b.userData;
    if (!b.isDynamic() || !h || h.removed) return;
    const t = b.translation();
    const v = b.linvel();
    t3[0] = t.x;
    t3[1] = t.y;
    t3[2] = t.z;
    if (bad(t, v) || (lost && isLost(t3))) {
      h.reset();
      return;
    }
    const s = Math.hypot(v.x, v.y, v.z);
    if (s > maxSpeed) {
      const k = maxSpeed / s;
      b.setLinvel({ x: v.x * k, y: v.y * k, z: v.z * k }, false);
    }
  };
  // now and then: a body the engine turned off (not one turned off on purpose)
  let sweep = 0;
  const revive = () => {
    for (const h of bodies) {
      const b = h.body;
      if (!h.off && b.isDynamic() && !b.isEnabled() && !pending.includes(h)) h.reset();
    }
  };

  function step(dt) {
    if (disposed || stepping) return 0;
    if (!(dt > 0)) return 0; // (NaN, undefined, nothing or backwards: no time)
    backlog += dt * timeScale;
    let n = Math.floor(backlog / STEP + 1e-9);
    if (n > maxSubsteps) {
      n = maxSubsteps;
      backlog = 0;
    } else backlog = Math.max(0, backlog - n * STEP);
    stepping = true;
    try {
      for (let i = 0; i < n; i++) {
        if (pending.length) {
          for (const p of pending) {
            p.body.setEnabled(true);
            if (p.initial.sleeping) p.body.sleep();
          }
          pending = [];
        }
        for (const fn of hooks) {
          try {
            fn(STEP);
          } catch (err) {
            report(err);
          }
        }
        world.forEachActiveRigidBody(before);
        world.step(events);
        events.drainContactForceEvents(hit);
        world.forEachActiveRigidBody(after);
        if (++sweep >= SWEEP) {
          sweep = 0;
          revive();
        }
      }
    } finally {
      stepping = false;
      if (doomed.length) {
        const gone = doomed;
        doomed = [];
        for (const h of gone) drop(h);
      }
    }
    return n;
  }

  return {
    RAPIER,
    world,
    step,
    add,
    remove,
    get disposed() {
      return disposed;
    },
    onSubstep(fn) {
      hooks.add(fn);
      return () => hooks.delete(fn);
    },
    awake(fn) {
      if (disposed) return;
      world.forEachActiveRigidBody((b) => {
        const h = b.userData;
        if (h && !h.removed) fn(h);
      });
    },
    onOrigin(shift) {
      if (disposed) return;
      const [sx, sy, sz] = shift;
      for (const h of bodies) {
        const t = h.body.translation();
        const to = { x: t.x - sx, y: t.y - sy, z: t.z - sz };
        h.body.setTranslation(to, false);
        if (h.body.isKinematic()) h.body.setNextKinematicTranslation(to);
        const p = h.initial.position;
        h.initial.position = [p[0] - sx, p[1] - sy, p[2] - sz];
      }
      if (centre) {
        centre[0] -= sx;
        centre[1] -= sy;
        centre[2] -= sz;
      }
    },
    sleepOutside(at, radius) {
      if (disposed) return;
      const r2 = radius * radius;
      for (const h of bodies) {
        const b = h.body;
        if (!b.isDynamic() || b.isSleeping() || !b.isEnabled()) continue;
        const t = b.translation();
        const dx = t.x - at[0];
        const dy = round ? t.y - at[1] : 0;
        const dz = t.z - at[2];
        if (dx * dx + dy * dy + dz * dz > r2) b.sleep();
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const h of bodies) {
        h.keep();
        h.removed = true;
      }
      bodies.clear();
      owners.clear();
      hooks.clear();
      pending = [];
      doomed = [];
      events.free();
      world.free();
    },
  };
}
