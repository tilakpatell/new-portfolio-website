// The Lakitu camera, as the original keeps it: behind Mario at one of three
// distances, turned a quarter of a half turn at a press (or freely by a drag
// or the right stick), swinging slowly round behind him when he runs and
// the player has left it alone, holding its height through a jump until he
// lands somewhere higher, and coming in front of any wall between it and
// him. It looks along (sin yaw, cos yaw), so the stick's up is the way it
// looks.
//
// newCam(m) → c; stepCam(c, m, { turn, drag, stick, zoomPress }, world), one
// frame at 30 a second; camYaw(c).

import { raycast } from './collide';
import { angleDiff } from './vec';

export const ZOOMS = [650, 1000, 1500];
const PITCH = 0.32;
const LOOK_UP = 120; // the focus, above his feet
const FOLLOW_AFTER = 45; // frames left alone before it swings behind him
const NEAREST = 150;

export function newCam(m) {
  const c = {
    yaw: m.yaw,
    yawTo: m.yaw,
    zoom: 1,
    dist: ZOOMS[1],
    pitch: PITCH,
    groundY: m.pos.y,
    focus: { x: m.pos.x, y: m.pos.y + LOOK_UP, z: m.pos.z },
    pos: { x: 0, y: 0, z: 0 },
    idle: 0,
  };
  place(c, null);
  return c;
}

export const camYaw = (c) => c.yaw;

function place(c, w) {
  const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
  const f = c.focus;
  const ideal = { x: f.x - Math.sin(c.yaw) * c.dist * cp, y: f.y + c.dist * sp, z: f.z - Math.cos(c.yaw) * c.dist * cp };
  let t = 1;
  const hit = w ? raycast(w, f, ideal) : null;
  if (hit) t = Math.max(NEAREST / c.dist, hit.t - 40 / c.dist);
  c.pos.x = f.x + (ideal.x - f.x) * t;
  c.pos.y = f.y + (ideal.y - f.y) * t;
  c.pos.z = f.z + (ideal.z - f.z) * t;
}

export function stepCam(c, m, inp, w) {
  if (inp.turn) {
    c.yawTo += (inp.turn * Math.PI) / 4;
    c.idle = 0;
  }
  if (inp.drag) {
    c.yawTo -= inp.drag * 0.008;
    c.idle = 0;
  }
  if (inp.stick) {
    c.yawTo -= inp.stick * 0.08;
    c.idle = 0;
  }
  if (inp.zoomPress) c.zoom = (c.zoom + 1) % ZOOMS.length;
  c.idle++;
  // left alone while he runs, it swings round behind him
  if (c.idle > FOLLOW_AFTER && m.fwd > 8 && !m.airborne && m.action !== 'swim') {
    c.yawTo += angleDiff(m.yaw, c.yawTo) * 0.02 * Math.min(1, m.fwd / 32);
  }
  c.yaw += angleDiff(c.yawTo, c.yaw) * 0.25;
  c.dist += (ZOOMS[c.zoom] - c.dist) * 0.15;
  if (Math.abs(ZOOMS[c.zoom] - c.dist) < 0.5) c.dist = ZOOMS[c.zoom];
  // its height: where he stands, not where he jumps (unless he falls lower,
  // or swims, or climbs far above it)
  if (!m.airborne || m.pos.y < c.groundY || m.pos.y > c.groundY + 600 || m.action === 'swim' || m.action === 'surface') c.groundY = m.pos.y;
  c.focus.x = m.pos.x;
  c.focus.z = m.pos.z;
  c.focus.y += (c.groundY + LOOK_UP - c.focus.y) * 0.2;
  if (Math.abs(c.groundY + LOOK_UP - c.focus.y) < 0.5) c.focus.y = c.groundY + LOOK_UP;
  place(c, w);
}
