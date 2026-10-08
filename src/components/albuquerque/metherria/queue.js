// The line outside the Metherria's hatch, walked rather than jumped: a
// customer new to it comes in from the side and walks up to their place,
// turning to it first and easing to a stop; when the one at the front's
// served the rest step up a place each; the one served turns and walks off
// the other way, and is gone once there. Each turns by time (no faster than
// a body does), and stands facing the hatch. The scene says where each is
// wanted every frame (the game's live.lobby, in order); this walks them
// there. Pure: no three.js, no Math.random.
//
//   QUEUE: the pace (m/s), how quick off and to a stop, how fast a turn
//     eases in and its most (rad/s), how far off the way a stood figure
//     turns before it sets off, and how near is there
//   createQueue({ enter, leave, pace }) → { step(dt, wanted) → [walker…], has(id) }
//     wanted: [{ id, x, z, face }] where each in the line is to stand, and
//     the way they face there (a yaw: 0 along +z, toward +x)
//     walker: { id, x, z, yaw, speed, leaving, arrived }

import { turn } from '../../../lib/three/gait';

export const QUEUE = { pace: 1.1, accel: 1.6, decel: 1.8, turnRate: 7, turnMax: 3.5, faceFirst: 0.9, near: 0.25 };

const TAU = Math.PI * 2;
const wrap = (a) => a - TAU * Math.round(a / TAU);

export function createQueue({ enter = { x: 0, z: 0 }, leave = { x: 0, z: 0 }, pace = QUEUE.pace } = {}) {
  const folk = new Map(); // id → { x, z, yaw, v, to, leaving }
  // a body turned toward `want` by time, no faster than turnMax
  const ease = (yaw, want, d) => {
    const next = turn(yaw, want, d, QUEUE.turnRate);
    const most = QUEUE.turnMax * d;
    const by = wrap(next - yaw);
    return Math.abs(by) <= most ? next : yaw + Math.sign(by) * most;
  };
  return {
    step(dt, wanted = []) {
      const d = dt > 0 ? Math.min(dt, 0.1) : 0;
      const ids = new Set();
      for (const w of wanted) {
        ids.add(w.id);
        let f = folk.get(w.id);
        if (!f) {
          f = { x: enter.x, z: enter.z, yaw: Math.atan2(w.x - enter.x, w.z - enter.z), v: 0, to: w, leaving: false };
          folk.set(w.id, f);
        }
        f.to = w;
        f.leaving = false;
      }
      for (const [id, f] of folk)
        if (!ids.has(id) && !f.leaving) {
          f.leaving = true;
          f.to = { x: leave.x, z: leave.z, face: null };
        }
      const out = [];
      for (const [id, f] of folk) {
        const dx = f.to.x - f.x;
        const dz = f.to.z - f.z;
        const dist = Math.hypot(dx, dz);
        const way = dist > 1e-9 ? Math.atan2(dx, dz) : f.yaw;
        // off once turned to the way (from a stand), easing up to pace and down into the end
        const off = Math.abs(wrap(way - f.yaw));
        const cap = dist < 1e-4 || (f.v < 0.15 && off > QUEUE.faceFirst && dist > QUEUE.near) ? 0 : Math.min(pace, Math.sqrt(2 * QUEUE.decel * dist));
        f.v = cap > f.v ? Math.min(cap, f.v + QUEUE.accel * d) : Math.max(cap, f.v - QUEUE.decel * 1.5 * d);
        const along = Math.min(f.v * d, dist);
        if (dist > 1e-9) {
          f.x += (dx / dist) * along;
          f.z += (dz / dist) * along;
        }
        // facing the way while there's a way to go, then the way they're to face there
        f.yaw = ease(f.yaw, dist > QUEUE.near || f.to.face == null ? way : f.to.face, d);
        const left = Math.hypot(f.to.x - f.x, f.to.z - f.z);
        if (f.leaving && left < 0.05) {
          folk.delete(id);
          continue;
        }
        out.push({ id, x: f.x, z: f.z, yaw: f.yaw, speed: f.v, leaving: f.leaving, arrived: !f.leaving && left < 0.02 && f.v < 0.05 });
      }
      return out;
    },
    has: (id) => folk.has(id),
  };
}
