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
// No three.js, no DOM.
//
//   GROUPS: floor (meets everything), object (meets everything and bumpers),
//     bumper (meets objects only), as Rapier's (memberships << 16) | filter
//   createPhysics({ gravity = -9.81, timeScale = 1, maxSubsteps = 4 })
//     → Promise<{ RAPIER, world, step(dt) → substeps taken, add(desc) → Body,
//       remove(body), onSubstep(fn(dt)) → off, onOrigin([x, y, z]) (every
//       body moved by −shift, velocities kept), sleepOutside([x, y, z], r),
//       dispose() }>
//   desc: { type: 'dynamic' | 'fixed' | 'kinematicPositionBased' |
//     'kinematicVelocityBased', position, rotation ([x, y, z, w]), canSleep,
//     sleeping, enabled, linearDamping = 0.1, angularDamping = 0.1, mass,
//     friction = 0.2, restitution = 0.15, group = 'object', onHit(force, at),
//     hitThreshold = 15, colliders: [{ shape: 'cuboid' | 'ball' | 'cylinder'
//     | 'hull' | 'trimesh' | 'heightfield', args, position, rotation, mass,
//     centreOfMass, friction, restitution, group }] }
//   Body: { body, colliders, desc, initial, reset(), sleeping, position(out)
//     → [x, y, z], quaternion(out) → [x, y, z, w], onHit }

export const STEP = 1 / 60;
const ALL = 1;
const OBJECT = 2;
const BUMPER = 4;
const group = (member, filter) => ((member << 16) | filter) >>> 0;
export const GROUPS = {
  floor: group(ALL, ALL),
  object: group(ALL | OBJECT, ALL | BUMPER),
  bumper: group(BUMPER, OBJECT),
};

let engine = null;
async function load() {
  engine ??= import('@dimforge/rapier3d-compat').then(async (m) => {
    const RAPIER = m.default ?? m;
    await RAPIER.init();
    return RAPIER;
  });
  return engine;
}

const v3 = (a) => ({ x: a?.[0] ?? 0, y: a?.[1] ?? 0, z: a?.[2] ?? 0 });
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
    case 'hull':
      return RAPIER.ColliderDesc.convexHull(a[0]);
    case 'trimesh':
      return RAPIER.ColliderDesc.trimesh(a[0], a[1]);
    case 'heightfield':
      return RAPIER.ColliderDesc.heightfield(a[0], a[1], a[2], v3(a[3]));
    default:
      throw new Error(`physics: no shape '${c.shape}'`);
  }
}

export async function createPhysics({ gravity = -9.81, timeScale = 1, maxSubsteps = 4 } = {}) {
  const RAPIER = await load();
  const world = new RAPIER.World({ x: 0, y: gravity, z: 0 });
  world.timestep = STEP;
  const events = new RAPIER.EventQueue(true);
  const owners = new Map(); // collider handle → Body
  const bodies = new Set();
  const hooks = new Set();
  let pending = []; // bodies reset last step, re-enabled this one
  let backlog = 0;

  function add(desc) {
    const type = desc.type ?? 'dynamic';
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
    const list = desc.colliders ?? [];
    const handle = {
      body,
      colliders: [],
      desc,
      onHit: desc.onHit ?? null,
      initial: { position: [...(desc.position ?? [0, 0, 0])], rotation: [...(desc.rotation ?? [0, 0, 0, 1])], sleeping: !!desc.sleeping },
      get sleeping() {
        return body.isSleeping();
      },
      position(out = [0, 0, 0]) {
        const t = body.translation();
        out[0] = t.x;
        out[1] = t.y;
        out[2] = t.z;
        return out;
      },
      quaternion(out = [0, 0, 0, 1]) {
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
        body.setEnabled(false);
        body.setTranslation(v3(handle.initial.position), false);
        body.setRotation(q4(handle.initial.rotation), false);
        body.setLinvel({ x: 0, y: 0, z: 0 }, false);
        body.setAngvel({ x: 0, y: 0, z: 0 }, false);
        body.resetForces(false);
        body.resetTorques(false);
        pending.push(handle);
      },
    };
    for (const c of list) {
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
      cd.setCollisionGroups(GROUPS[c.group ?? desc.group ?? 'object']);
      if (desc.onHit) {
        cd.setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS);
        cd.setContactForceEventThreshold(desc.hitThreshold ?? 15);
      }
      const collider = world.createCollider(cd, body);
      owners.set(collider.handle, handle);
      handle.colliders.push(collider);
    }
    bodies.add(handle);
    return handle;
  }

  function remove(handle) {
    if (!bodies.delete(handle)) return;
    for (const c of handle.colliders) owners.delete(c.handle);
    world.removeRigidBody(handle.body);
    pending = pending.filter((p) => p !== handle);
  }

  const hit = (e) => {
    const a = owners.get(e.collider1());
    const b = owners.get(e.collider2());
    if (!a?.onHit && !b?.onHit) return;
    const m = (a?.body.mass() ?? 0) + (b?.body.mass() ?? 0) || 1;
    const force = e.maxForceMagnitude() / m;
    // (where: the body that isn't the one hit, as his)
    for (const [self, other] of [[a, b], [b, a]]) if (self?.onHit) self.onHit(force, (other ?? self).position());
  };

  function step(dt) {
    backlog += Math.max(0, dt) * timeScale;
    let n = Math.floor(backlog / STEP + 1e-9);
    if (n > maxSubsteps) {
      n = maxSubsteps;
      backlog = 0;
    } else backlog = Math.max(0, backlog - n * STEP);
    for (let i = 0; i < n; i++) {
      if (pending.length) {
        for (const p of pending) {
          p.body.setEnabled(true);
          if (p.initial.sleeping) p.body.sleep();
        }
        pending = [];
      }
      for (const fn of hooks) fn(STEP);
      world.step(events);
      events.drainContactForceEvents(hit);
    }
    return n;
  }

  return {
    RAPIER,
    world,
    step,
    add,
    remove,
    onSubstep(fn) {
      hooks.add(fn);
      return () => hooks.delete(fn);
    },
    onOrigin(shift) {
      const [sx, sy, sz] = shift;
      for (const h of bodies) {
        const t = h.body.translation();
        const to = { x: t.x - sx, y: t.y - sy, z: t.z - sz };
        h.body.setTranslation(to, false);
        if (h.body.isKinematic()) h.body.setNextKinematicTranslation(to);
        const p = h.initial.position;
        h.initial.position = [p[0] - sx, p[1] - sy, p[2] - sz];
      }
    },
    sleepOutside(centre, radius) {
      const r2 = radius * radius;
      for (const h of bodies) {
        const b = h.body;
        if (!b.isDynamic() || b.isSleeping() || !b.isEnabled()) continue;
        const t = b.translation();
        const dx = t.x - centre[0];
        const dz = t.z - centre[2];
        if (dx * dx + dz * dz > r2) b.sleep();
      }
    },
    dispose() {
      bodies.clear();
      owners.clear();
      hooks.clear();
      events.free();
      world.free();
    },
  };
}
