// A planet of the Expanse, driven: the reference world of the natural-
// worlds design (docs/superpowers/specs/2026-10-08-natural-worlds-design.md
// §4). A seed and a type make the land (lib/land); its 64 m cells stream in
// round the car through the runtime's worker pool (./stream.js, ./worker.js),
// drawn by ./scene.js; the ones round the car are solid (a heightfield each
// and their props, lib/physics); the car is Bruno Simon's on Rapier
// (lib/physics/vehicle.js), driven by ./rules.js's respawn and drowning; the
// floating origin (rt.origin) keeps the numbers small however far it goes.
// The buggy is drawn in two halves: the chassis where the physics puts it,
// and its body squashing, leaning and whipping its antenna on top
// (lib/vehicleFeel.js), fed the chassis's acceleration, its landings and
// its hits.
//
// Keys: W/↑ throttle, S/↓ brake then reverse, A/D ←/→ steer, Shift boost,
// Space jump (all four springs high for a tap), R back to where it last
// stood dry. The touch stick and a pad do the same.
//
// It tells the page (rt.events):
//   'hud' { speed (km/h), water: { bearing, distance } | null, moment,
//           seed, kind, cells } (ten times a second at most)
//   'respawn' {}
// Dev hook: window.__EXPANSE__ = { vehicle, physics, stream, scene, feel, at() }.

import { STEP, createPhysics } from '../../../lib/physics/world.js';
import { addHeightfield } from '../../../lib/physics/heightfield.js';
import { addProps } from '../../../lib/physics/props.js';
import { addCatch } from '../../../lib/physics/catch.js';
import { CAR, addVehicle } from '../../../lib/physics/vehicle.js';
import { createVehicleFeel } from '../../../lib/vehicleFeel.js';
import { CELL, N, heightAt, makeCell, waterAt } from '../../../lib/land/cell.js';
import { landSpec } from '../../../lib/land/spec.js';
import { WORLD_MB } from '../../worlds/worlds.js';
import { WORKER, createStream } from './stream.js';
import { createDriver, spawnIn, stepDriver } from './rules.js';
import { createScene } from './scene.js';
import { createStore } from '../../../runtime/store.js';
import { createRegistry } from '../../worlds/registry.js';

export const KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  boost: ['ShiftLeft', 'ShiftRight'],
  jump: ['Space'],
  respawn: ['KeyR'],
};
// the cells drawn round the car, by tier; one round it is solid
export const RADIUS = { ultra: 7, high: 6, mid: 4, low: 3 };
export const PHYSICS_RADIUS = 1;
const JUMP = 0.1; // seconds the springs stay high for a jump
const HUD_EVERY = 0.1;
const WATER_EVERY = 1; // seconds between looks for the nearest water

// a hit's gain, his law (research note): nothing at the world's threshold, all at FULL
const HIT_FROM = 15;
const HIT_FULL = 120;
const hitGain = (force) => Math.min(1, Math.max(0, (force - HIT_FROM) / (HIT_FULL - HIT_FROM))) ** 2;

const quatYaw = (q) => Math.atan2(2 * (q[3] * q[1] + q[0] * q[2]), 1 - 2 * (q[1] * q[1] + q[2] * q[2]));

export default {
  id: 'expanse-surface',
  shading: 'glsl',
  mb: WORLD_MB['/universe/expanse'],
  label: 'A planet of the Expanse, driven: hills, rivers, lakes and the sea, from a seed',
  async create(rt, props = {}) {
    const seed = props.seed ?? 7;
    const type = props.type ?? 'temperate';
    const spec = landSpec(seed, type);
    const tier = rt.quality?.tier ?? 'high';
    const radius = RADIUS[tier] ?? 4;
    const renderer = rt.gfx.renderer;
    rt.input?.bind?.(KEYS);
    // the planet in the visitor's worlds (/worlds lists it, worldUrl opens it again)
    const registered = createRegistry(rt.store ?? createStore())
      .add({ kind: 'planet', seed: String(seed), name: props.name ?? `Planet ${seed}` })
      .catch(() => null);
    rt.workers.define(WORKER, () => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }));

    // the floating origin: world metres minus this is the scene's (and physics') frame
    let origin = rt.origin?.at ?? [0, 0, 0];
    const toLocal = (x, y, z) => [x - origin[0], y - origin[1], z - origin[2]];

    const physics = await (props.createPhysics ?? createPhysics)({ gravity: spec.gravity, lost: (p) => p[1] < -500 });
    const scene = createScene({ renderer, spec, tier, radius, small: props.small });
    scene.setOrigin(origin);
    // (its own copy of his table, so tuning this car tunes no other)
    let hit = 0;
    const vehicle = addVehicle(physics, structuredClone(CAR), { onHit: (force) => (hit = Math.max(hit, hitGain(force))) });
    const feel = createVehicleFeel();
    const slab = addCatch(physics);

    // the first cell, made here (a twentieth of a second) so the car stands on a hill at once
    const first = makeCell(spec, 0, 0);
    const spawn = spawnIn(first);
    let home = [spawn.x, spawn.y, spawn.z];
    vehicle.moveTo(...toLocal(spawn.x, spawn.y, spawn.z), spawn.yaw);

    const solids = new Map(); // key → { ground: Body, props }
    const visuals = new Map(); // key → { trees: [slot], rocks: [slot], crates: [slot] }
    const stream = createStream({
      workers: rt.workers,
      seed,
      kind: type,
      radius,
      physicsRadius: PHYSICS_RADIUS,
      sink: {
        build(key, cell, mesh, step) {
          scene.build(key, cell, mesh, step);
          const v = { cell, trees: [], rocks: [], crates: [] };
          for (const p of cell.props) {
            const half = p.yaw / 2;
            const q = [0, Math.sin(half), 0, Math.cos(half)];
            if (p.kind === 'tree') {
              const i = scene.puffs.take();
              if (i >= 0) {
                scene.puffs.set(i, p.x, p.y, p.z, p.scale, p.yaw);
                v.trees.push(i);
              }
            } else if (p.kind === 'rock') {
              const i = scene.rocks.take();
              if (i >= 0) {
                scene.rocks.place(i, [p.x, p.y + 0.3 * p.scale, p.z], q, p.scale);
                v.rocks.push(i);
              }
            } else {
              const i = scene.crates.take();
              if (i >= 0) {
                scene.crates.place(i, [p.x, p.y + 0.5, p.z], q, 1);
                v.crates.push([i, p]);
              }
            }
          }
          visuals.set(key, v);
        },
        remesh: (key, mesh, step) => scene.remesh(key, mesh, step),
        unbuild(key) {
          const v = visuals.get(key);
          scene.unbuild(key, v?.cell);
          if (!v) return;
          for (const i of v.trees) scene.puffs.free(i);
          for (const i of v.rocks) scene.rocks.free(i);
          for (const [i] of v.crates) scene.crates.free(i);
          visuals.delete(key);
        },
        solid(key, cell) {
          const [x, , z] = toLocal(cell.cx * CELL, 0, cell.cz * CELL);
          const ground = addHeightfield(physics, { heights: cell.heights, x, z });
          const list = cell.props.map((p) => ({ ...p, x: p.x - origin[0], y: p.y - origin[1], z: p.z - origin[2] }));
          const bodies = addProps(physics, list);
          // (each crate's body writes into its crate's slot)
          const v = visuals.get(key);
          const slots = cell.props.map((p) => v?.crates.find(([, c]) => c === p)?.[0] ?? -1);
          solids.set(key, { ground, bodies, list, slots });
        },
        unsolid(key) {
          const s = solids.get(key);
          if (!s) return;
          physics.remove(s.ground);
          s.bodies.remove();
          solids.delete(key);
          // (its crates back where they were placed)
          const v = visuals.get(key);
          if (v) for (const [i, p] of v.crates) scene.crates.place(i, [p.x, p.y + 0.5, p.z], [0, Math.sin(p.yaw / 2), 0, Math.cos(p.yaw / 2)], 1);
        },
      },
    });

    // the ground and the water under a world point, from the cells kept
    const cellAt = (x, z) => stream.cell(Math.floor(x / CELL), Math.floor(z / CELL)) ?? (Math.floor(x / CELL) === 0 && Math.floor(z / CELL) === 0 ? first : null);
    const groundAt = (x, z) => {
      const c = cellAt(x, z);
      return c ? heightAt(c, x - c.cx * CELL, z - c.cz * CELL) : null;
    };
    const waterUnder = (x, z) => {
      const c = cellAt(x, z);
      if (!c) return null;
      const lx = x - c.cx * CELL;
      const lz = z - c.cz * CELL;
      const level = waterAt(c, lx, lz);
      if (Number.isNaN(level)) return null;
      const t = (Math.min(127, Math.floor(lz * 2)) * 128 + Math.min(127, Math.floor(lx * 2))) * 4;
      const kind = Number.isFinite(spec.sea) && Math.abs(level - spec.sea) < 0.05 ? 'sea' : c.mask[t + 3] > 0 ? 'river' : 'lake';
      return { level, kind };
    };
    scene.setFloor((lx, lz) => {
      const x = lx + origin[0];
      const z = lz + origin[2];
      const w = waterUnder(x, z);
      const g = groundAt(x, z);
      const ground = g === null ? -1e3 : g - origin[1];
      return w && w.level - origin[1] > ground ? { y: w.level - origin[1], water: true } : { y: ground, water: false };
    });

    // the nearest water, looked for over the cells kept, now and then
    function nearestWater(x, z) {
      let best = null;
      for (const [, b] of stream.cells()) {
        const c = b.cell;
        for (let iz = 0; iz < N; iz += 4)
          for (let ix = 0; ix < N; ix += 4) {
            const k = iz * N + ix;
            if (Number.isNaN(c.water[k]) || c.water[k] <= c.heights[k]) continue;
            const wx = c.cx * CELL + ix;
            const wz = c.cz * CELL + iz;
            const d = Math.hypot(wx - x, wz - z);
            if (!best || d < best.distance) best = { distance: d, bearing: Math.atan2(wz - z, wx - x) };
          }
      }
      return best;
    }

    const driver = createDriver();
    let jump = 0;
    let hudAt = 0;
    let waterAtT = -Infinity;
    let water = null;
    let clock = 0;
    let gone = false;
    const pos = [0, 0, 0];
    const quat = [0, 0, 0, 1];
    const wheelTracks = [0, 1, 2, 3].map(() => scene.tracks.track(0.5, 'r'));
    const bodyTrack = scene.tracks.track(1.5, 'g');
    // the feel's inputs: the chassis's velocity when the physics last stepped, and in the air
    const lastVel = [0, 0, 0];
    const accel = { forwardAccel: 0, lateralAccel: 0, airborne: false, landed: 0, hit: 0 };
    let fallSpeed = 0;
    let fresh = true;

    const offOrigin = rt.origin?.on?.((shift) => {
      origin = [origin[0] + shift[0], origin[1] + shift[1], origin[2] + shift[2]];
      physics.onOrigin(shift);
      scene.shift(shift);
      for (const t of [...wheelTracks, bodyTrack]) t.shift(shift[0], shift[2]);
      for (const s of solids.values()) for (const p of s.list) [p.x, p.z] = [p.x - shift[0], p.z - shift[2]];
    });

    const world = {
      ready: Promise.resolve(),
      registered,
      vehicle,
      physics,
      stream,
      scene,
      feel,
      // the car's world position, for the floating origin
      anchor() {
        const [x, y, z] = vehicle.chassis.position(pos);
        return [x + origin[0], y + origin[1], z + origin[2]];
      },
      resize(w, h) {
        scene.resize(w, h);
      },
      step(dt, input) {
        if (gone) return;
        clock += dt;
        const held = (name) => Boolean(input?.action?.(name));
        const stick = input?.stick ?? { x: 0, y: 0 };
        const pad = input?.pad;
        let throttle = (held('forward') ? 1 : 0) - (held('back') ? 1 : 0);
        let steer = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
        if (pad && (pad.lx || pad.ly || pad.rt || pad.lt)) {
          steer = pad.lx || steer;
          throttle = (pad.rt ?? 0) - (pad.lt ?? 0) || -pad.ly || throttle;
        }
        if (stick.x || stick.y) {
          steer = stick.x;
          throttle = -stick.y;
        }
        const pressed = (name) => KEYS[name].some((c) => input?.pressed?.has?.(c));
        if (pressed('jump')) jump = JUMP;
        jump -= dt;
        for (let i = 0; i < 4; i++) vehicle.suspension(i, jump > 0 ? 'high' : 'low');

        const [lx, ly, lz] = vehicle.chassis.position(pos);
        const wx = lx + origin[0];
        const wz = lz + origin[2];
        const rule = stepDriver(driver, vehicle.state, { respawn: pressed('respawn') }, dt, { position: [wx, ly + origin[1], wz], waterAt: waterUnder });
        if (rule.respawn) {
          const to = rule.to ?? home;
          const yaw = quatYaw(vehicle.chassis.quaternion(quat));
          vehicle.moveTo(...toLocal(to[0], to[1] + 1, to[2]), yaw);
          feel.reset();
          fresh = true;
          rt.events?.emit?.('respawn', {});
        }
        vehicle.chassis.body.setLinearDamping(rule.drag ? 1 : 0.1);
        vehicle.chassis.body.setAngularDamping(rule.drag ? 1 : 0.1);
        vehicle.drive({ throttle, steer, brake: 0, boost: held('boost') ? 1 : 0 }, dt);

        // the catch slab, while the cell under the car isn't solid yet
        const key = `${Math.floor(wx / CELL)},${Math.floor(wz / CELL)}`;
        const under = solids.has(key);
        slab.enable(!under);
        if (!under) {
          const g = groundAt(wx, wz);
          slab.follow(lx, lz, (g ?? home[1] - 1.5) - origin[1]);
        }
        const substeps = physics.step(dt);
        const v = vehicle.measure();

        // the streaming, ahead of the car
        vehicle.chassis.quaternion(quat);
        const yaw = quatYaw(quat);
        stream.update(wx, wz, [Math.cos(yaw), -Math.sin(yaw)]);
        scene.map.centre(Math.floor(wx / CELL), Math.floor(wz / CELL));
        for (const s of solids.values())
          s.bodies.sync((i, p, q) => {
            if (s.slots[i] >= 0) scene.crates.place(s.slots[i], [p[0] + origin[0], p[1] + origin[1], p[2] + origin[2]], q, 1);
          });
        physics.sleepOutside([lx, ly, lz], CELL * 1.5);

        // the visible half's inputs: the acceleration over the time simulated,
        // along the nose (+x) and to the right (+z); a landing's speed down
        const vel = vehicle.chassis.body.linvel();
        const grounded = v.wheels.some((w) => w.contact);
        accel.landed = grounded && accel.airborne ? fallSpeed : 0;
        accel.airborne = !grounded;
        if (substeps > 0) {
          const h = substeps * STEP;
          const ax = fresh ? 0 : (vel.x - lastVel[0]) / h;
          const ay = fresh ? 0 : (vel.y - lastVel[1]) / h;
          const az = fresh ? 0 : (vel.z - lastVel[2]) / h;
          const [qx, qy, qz, qw] = quat;
          // the nose and the right, the quaternion's first and third columns
          accel.forwardAccel = ax * (1 - 2 * (qy * qy + qz * qz)) + ay * 2 * (qx * qy + qw * qz) + az * 2 * (qx * qz - qw * qy);
          accel.lateralAccel = ax * 2 * (qx * qz + qw * qy) + ay * 2 * (qy * qz - qw * qx) + az * (1 - 2 * (qx * qx + qy * qy));
          [lastVel[0], lastVel[1], lastVel[2]] = [vel.x, vel.y, vel.z];
          fresh = false;
        }
        fallSpeed = accel.airborne ? Math.max(0, -vel.y) : 0;
        accel.hit = hit;
        hit = 0;

        // the look: the buggy on the chassis, its tracks, the camera and the rest
        const [cx, cy, cz] = vehicle.chassis.position(pos);
        scene.buggy.group.position.set(cx, cy, cz);
        scene.buggy.group.quaternion.set(quat[0], quat[1], quat[2], quat[3]);
        scene.buggy.update(v, steer, dt, feel.step(accel, dt));
        v.wheels.forEach((w, i) => wheelTracks[i].push(w.point[0], w.point[2], w.contact, clock));
        bodyTrack.push(cx, cz, grounded, clock);
        scene.follow({ x: cx, y: cy, z: cz }, v.speed, dt, { x: cx, z: cz, vx: vel.x, vz: vel.z });

        if (clock - waterAtT >= WATER_EVERY) {
          waterAtT = clock;
          water = nearestWater(wx, wz);
        }
        if (clock - hudAt >= HUD_EVERY) {
          hudAt = clock;
          rt.events?.emit?.('hud', { speed: Math.round(v.speed * 3.6), water, moment: rule.moment, seed: String(seed), kind: type, cells: stream.stats().built });
        }
      },
      draw() {
        if (!gone) scene.draw();
      },
      lowerQuality(level) {
        scene.lowerQuality(level);
      },
      dispose() {
        if (gone) return;
        gone = true;
        offOrigin?.();
        stream.dispose();
        for (const key of [...solids.keys()]) {
          const s = solids.get(key);
          physics.remove(s.ground);
          s.bodies.remove();
        }
        solids.clear();
        vehicle.remove();
        physics.dispose();
        scene.dispose();
        if (globalThis.window && globalThis.window.__EXPANSE__?.vehicle === vehicle) delete globalThis.window.__EXPANSE__;
      },
    };
    home = [spawn.x, spawn.y, spawn.z];
    if (globalThis.window) globalThis.window.__EXPANSE__ = { vehicle, physics, stream, scene, feel, at: () => world.anchor() };
    return world;
  },
};
