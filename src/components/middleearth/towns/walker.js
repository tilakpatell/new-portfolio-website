// Walking about a town: a body pushed out of everything in its way. The
// Shire's way of walking (../shire/rules.js), made to take any town's
// layout as data, so the next town only lists what stands where.
//
// Colliders are { kind: 'circle', x, z, r } and { kind: 'box', x, z, w, d,
// turn }, where `turn` is the turn the model is given (rotation.y), so a
// box's own +x points along (cos turn, -sin turn). Walls are [x0, z0, x1,
// z1, thick, low]: a stockade, a fence, a gate that's shut. `low` things
// (a well, a fence) are in the way of feet but not of eyes.

import { byFrame } from '../ease';

// The camera's two helpers, the Shire's (../shire/rules.js), copied so a town needn't load the Shire's rules for them.
// The camera sits at `yaw` round the walker (0 is due south of him, looking
// north). Forward on the keys is away from the camera.
export function cameraMove(yaw, forward, right) {
  return { x: -Math.sin(yaw) * forward + Math.cos(yaw) * right, z: -Math.cos(yaw) * forward - Math.sin(yaw) * right };
}
// the yaw that puts the camera behind a walker facing `face`
export const behindYaw = (face) => Math.atan2(-Math.cos(face), Math.sin(face));

export const HOBBIT = { radius: 0.4, walk: 3.4, run: 6.2, accel: 16, turn: 11 };

export const newWalker = (at) => ({ x: at.x, z: at.z, face: at.face ?? 0, vx: 0, vz: 0, speed: 0, running: false, edge: false });

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// a point into a box's own frame, and back
function toBox(c, x, z) {
  const t = c.turn || 0;
  const dx = x - c.x;
  const dz = z - c.z;
  return [dx * Math.cos(t) - dz * Math.sin(t), dx * Math.sin(t) + dz * Math.cos(t)];
}
function fromBox(c, lx, lz) {
  const t = c.turn || 0;
  return [c.x + lx * Math.cos(t) + lz * Math.sin(t), c.z - lx * Math.sin(t) + lz * Math.cos(t)];
}

// Push a circle at (x, z) out of everything; returns the new spot.
export function pushOut(x, z, rad, colliders = [], walls = []) {
  for (const c of colliders) {
    if (c.kind === 'circle') {
      const dx = x - c.x;
      const dz = z - c.z;
      const d = Math.hypot(dx, dz);
      const min = c.r + rad;
      if (d < min && d > 1e-6) {
        x = c.x + (dx / d) * min;
        z = c.z + (dz / d) * min;
      }
      continue;
    }
    const [lx, lz] = toBox(c, x, z);
    const hw = c.w / 2;
    const hd = c.d / 2;
    const px = clamp(lx, -hw, hw);
    const pz = clamp(lz, -hd, hd);
    const ex = lx - px;
    const ez = lz - pz;
    const d = Math.hypot(ex, ez);
    if (d >= rad) continue;
    let nx = lx;
    let nz = lz;
    if (d > 1e-6) {
      nx = px + (ex / d) * rad;
      nz = pz + (ez / d) * rad;
    } else {
      // inside it: out by the nearest side
      const out = [-hw - rad - lx, hw + rad - lx, -hd - rad - lz, hd + rad - lz];
      const abs = out.map(Math.abs);
      const i = abs.indexOf(Math.min(...abs));
      if (i < 2) nx += out[i];
      else nz += out[i];
    }
    [x, z] = fromBox(c, nx, nz);
  }
  for (const [x0, z0, x1, z1, thick = 0.08] of walls) {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const t = clamp(((x - x0) * dx + (z - z0) * dz) / (dx * dx + dz * dz || 1), 0, 1);
    const px = x0 + t * dx;
    const pz = z0 + t * dz;
    const ex = x - px;
    const ez = z - pz;
    const d = Math.hypot(ex, ez);
    const min = rad + thick;
    if (d < min && d > 1e-6) {
      x = px + (ex / d) * min;
      z = pz + (ez / d) * min;
    }
  }
  return [x, z];
}

// A town's walker. `radius` is the disc you can walk in (round `centre`),
// `blocked(x, z)` anywhere else you can't stand (water). The body is the
// Shire's hobbit unless told otherwise.
export function makeWalker({ radius, centre = [0, 0], colliders = [], walls = [], blocked = null, body = HOBBIT }) {
  const push = (x, z, rad = body.radius, closed = []) => {
    const all = closed.length ? [...walls, ...closed] : walls;
    // twice, so a push out of one thing into the next is caught
    [x, z] = pushOut(x, z, rad, colliders, all);
    return pushOut(x, z, rad, colliders, all);
  };

  // One step. `move` is where the visitor wants to go, already turned to the
  // world (the camera does that): { x, z } up to length 1, and `run`.
  // `closed` adds walls for this step only (a shut gate).
  const step = (h, { x: mx = 0, z: mz = 0, run = false } = {}, dt, { closed = [] } = {}) => {
    const len = Math.hypot(mx, mz);
    const k = len > 1 ? 1 / len : 1;
    const top = run ? body.run : body.walk;
    // by dt, as the old `min(1, accel·dt/top·2.2)` was at 60 Hz (../ease.js)
    const ease = byFrame((body.accel * 2.2) / Math.max(1, top), dt);
    let vx = h.vx + (mx * k * top - h.vx) * ease;
    let vz = h.vz + (mz * k * top - h.vz) * ease;
    if (len < 0.05 && Math.hypot(vx, vz) < 0.05) {
      vx = 0;
      vz = 0;
    }
    let x = h.x + vx * dt;
    let z = h.z + vz * dt;
    // what can't be stood in: slide along its edge rather than into it
    if (blocked?.(x, z)) {
      if (!blocked(x, h.z)) z = h.z;
      else if (!blocked(h.x, z)) x = h.x;
      else {
        x = h.x;
        z = h.z;
      }
    }
    [x, z] = push(x, z, body.radius, closed);
    if (blocked?.(x, z)) {
      x = h.x;
      z = h.z;
    }
    // the rim of the town
    let edge = false;
    const ox = x - centre[0];
    const oz = z - centre[1];
    const r = Math.hypot(ox, oz);
    if (r > radius) {
      x = centre[0] + (ox * radius) / r;
      z = centre[1] + (oz * radius) / r;
      edge = len > 0.05;
    }
    const moved = Math.hypot(x - h.x, z - h.z) / Math.max(dt, 1e-6);
    let face = h.face;
    if (len > 0.05) {
      let d = Math.atan2(-mz, mx) - face;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      face += d * byFrame(body.turn, dt);
    }
    return { x, z, face, vx: (x - h.x) / Math.max(dt, 1e-6), vz: (z - h.z) / Math.max(dt, 1e-6), speed: moved, running: run && moved > body.walk + 0.3, edge };
  };

  return { step, push };
}

// Can someone at (ax, az) see (bx, bz)? Not through a house, a tree's
// trunk or a wall; over low things.
export function sightClear(ax, az, bx, bz, colliders = [], walls = []) {
  for (const c of colliders) {
    if (c.low) continue;
    if (c.kind === 'circle') {
      if (segDist(c.x, c.z, ax, az, bx, bz) < c.r) return false;
      continue;
    }
    // the slab test, in the box's own frame
    const [x0, z0] = toBox(c, ax, az);
    const [x1, z1] = toBox(c, bx, bz);
    if (slabHit(x0, z0, x1 - x0, z1 - z0, c.w / 2, c.d / 2)) return false;
  }
  for (const [x0, z0, x1, z1, , low] of walls) {
    if (low) continue;
    if (segsCross(ax, az, bx, bz, x0, z0, x1, z1)) return false;
  }
  return true;
}

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1), 0, 1);
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}
function slabHit(ox, oz, dx, dz, hw, hd) {
  let t0 = 0;
  let t1 = 1;
  for (const [o, d, h] of [[ox, dx, hw], [oz, dz, hd]]) {
    if (Math.abs(d) < 1e-9) {
      if (o < -h || o > h) return false;
      continue;
    }
    let a = (-h - o) / d;
    let b = (h - o) / d;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);
    if (t0 > t1) return false;
  }
  return true;
}
function segsCross(ax, az, bx, bz, cx, cz, dx, dz) {
  const d1 = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
  const d2 = (bx - ax) * (dz - az) - (bz - az) * (dx - ax);
  const d3 = (dx - cx) * (az - cz) - (dz - cz) * (ax - cx);
  const d4 = (dx - cx) * (bz - cz) - (dz - cz) * (bx - cx);
  return d1 * d2 < 0 && d3 * d4 < 0;
}
