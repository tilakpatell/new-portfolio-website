// Falling leaves, Bruno Simon's (folio-2025's Leaves.js; research note
// Part 2 §4), on the CPU in typed arrays (his are a compute shader; a few
// hundred are nothing here): each leaf has a weight (0.1 to 0.2), falls by
// it, is blown by the wind, kicked up by the car passing within 2 m (his
// push: 20 sideways, 100 along, by the car's speed), lifted a little by its
// own speed near the ground, damped on land (1.5), on water (0.75, floating
// at its level) and in the air (1.5), and wrapped round the focus so they
// are always about you. Drawn as one InstancedMesh of skewed quads.
//
//   makeLeaves(count, { focus, half, seed }) → state (pure)
//   stepLeaves(state, dt, { focus, half, wind: { x, z, strength }, car:
//     { x, z, vx, vz } | null, floorAt(x, z) → { y, water } }) (pure, in place)
//   createLeaves({ count, wind, floorAt, half = 20, colours }) → { mesh,
//     state, update(dt, focus, car), shift(sx, sz), dispose() }
//
// `count` the device level's budget unless given (lib/budgets' `leaves`:
// low none, mid 256, high 1024, ultra 2048; the Expanse gives its own by
// tier). None makes no mesh (`mesh` null), and its calls do nothing.

import * as THREE from 'three';
import { budget } from '../budgets';
import { detailLevel } from '../detail';
import { seeded } from '../seeded';

const clamp01 = (v) => Math.min(1, Math.max(0, v));

export function makeLeaves(count, { focus = { x: 0, z: 0 }, half = 20, seed = 1 } = {}) {
  const rand = seeded(seed);
  const pos = new Float32Array(count * 3);
  const vel = new Float32Array(count * 3);
  const weight = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = focus.x + (rand() * 2 - 1) * half;
    pos[i * 3 + 1] = rand() * 6;
    pos[i * 3 + 2] = focus.z + (rand() * 2 - 1) * half;
    weight[i] = 0.1 + 0.1 * rand();
  }
  return { count, pos, vel, weight };
}

const wrap = (v, c, h) => c + ((((v - c + h) % (2 * h)) + 2 * h) % (2 * h)) - h;

export function stepLeaves(s, dt, { focus, half, wind, car = null, floorAt }) {
  const { pos, vel, weight } = s;
  const carSpeed = car ? Math.hypot(car.vx, car.vz) : 0;
  for (let i = 0; i < s.count; i++) {
    const o = i * 3;
    let x = pos[o];
    let y = pos[o + 1];
    let z = pos[o + 2];
    let vx = vel[o];
    let vy = vel[o + 1];
    let vz = vel[o + 2];
    const w = weight[i];
    // the car's push: within 0.5…2 m, sideways from its way and along it
    if (car && carSpeed > 0.1) {
      const dx = x - car.x;
      const dz = z - car.z;
      const d = Math.hypot(dx, dz);
      const k = 1 - clamp01((d - 0.5) / 1.5);
      if (k > 0) {
        const ax = car.vx / carSpeed;
        const az = car.vz / carSpeed;
        const side = Math.sign(dx * az - dz * ax) || 1;
        const push = k * Math.min(1, carSpeed / 10) * dt;
        vx += (az * side * 20 + ax * 100) * push * 0.3;
        vz += (-ax * side * 20 + az * 100) * push * 0.3;
        vy += 4 * push;
      }
    }
    // the wind, by weight
    vx += wind.x * wind.strength * w * 5 * dt;
    vz += wind.z * wind.strength * w * 5 * dt;
    const floor = floorAt(x, z);
    const above = y - floor.y;
    // a little lift from its own speed, near the ground
    vy += Math.min(Math.hypot(vx, vz), 2) * (1 - clamp01(above / 6)) * dt;
    vy -= 9.807 * w * dt;
    const onFloor = above <= 0.03;
    const damp = onFloor ? (floor.water ? 0.75 : 1.5) : 1.5;
    const keep = Math.max(0, 1 - damp * dt);
    vx *= keep;
    vy *= keep;
    vz *= keep;
    x += vx * dt;
    y += vy * dt;
    z += vz * dt;
    x = wrap(x, focus.x, half);
    z = wrap(z, focus.z, half);
    const f = floorAt(x, z);
    if (y < f.y + 0.02) {
      y = f.y + 0.02;
      if (vy < 0) vy = 0;
    }
    pos[o] = x;
    pos[o + 1] = y;
    pos[o + 2] = z;
    vel[o] = vx;
    vel[o + 1] = vy;
    vel[o + 2] = vz;
  }
}

export function createLeaves({ count = budget(detailLevel()).leaves, wind, floorAt, half = 20, colours = [0x95513a, 0xf56a3a], seed = 1 } = {}) {
  const state = makeLeaves(count, { half, seed });
  if (!count) return { mesh: null, state, update() {}, shift() {}, dispose() {} };
  // his skewed quad, 0.25 × (0.5…1)
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.15, 0, -0.1, 0.15, 0, -0.15, 0.15, 0, 0.1, -0.15, 0, 0.15]), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
  geometry.setIndex([0, 2, 1, 0, 3, 2]);
  const material = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.name = 'leaves';
  mesh.frustumCulled = false;
  const rand = seeded(seed + 1);
  const a = new THREE.Color(colours[0]);
  const b = new THREE.Color(colours[1]);
  const c = new THREE.Color();
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    mesh.setColorAt(i, c.copy(a).lerp(b, rand()));
    sizes[i] = 0.25 * (0.5 + 0.5 * rand()) * 4;
  }
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  let t = 0;
  const focusNow = { x: 0, z: 0 };
  return {
    mesh,
    state,
    update(dt, focus, car = null) {
      t += dt;
      focusNow.x = focus.x;
      focusNow.z = focus.z;
      const d = wind.uniforms.uWindDir.value;
      stepLeaves(state, dt, { focus, half, wind: { x: d.x, z: d.y, strength: wind.uniforms.uWindStrength.value }, car, floorAt });
      for (let i = 0; i < count; i++) {
        const o = i * 3;
        // his flutter: a tilt each way by where it is
        const f = Math.min(1, state.pos[o + 1]);
        e.set(Math.sin(state.pos[o] * 3 + t) * f, i, Math.sin(state.pos[o + 2] * 3 + t) * f);
        mesh.setMatrixAt(i, m.compose(p.set(state.pos[o], state.pos[o + 1], state.pos[o + 2]), q.setFromEuler(e), s.setScalar(sizes[i])));
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
    shift(sx, sz) {
      for (let i = 0; i < count; i++) {
        state.pos[i * 3] -= sx;
        state.pos[i * 3 + 2] -= sz;
      }
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
