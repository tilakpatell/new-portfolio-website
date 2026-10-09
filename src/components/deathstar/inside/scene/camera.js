// Where the eye is aboard the Death Star. Third person stands over the
// right shoulder, so the disguise shows and the corridor ahead is still
// in view; first person (V) sits at the eyes, which suits the corridors.
// The camera never passes through a wall: the shoulder is pulled in from a
// wall close on the right, then the eye in along the line behind it, each
// to 0.2 m short of whatever it would meet, so the near plane never cuts
// a wall open. The walls are the layout’s own segments, met by plain line
// maths (no raycaster, no meshes), so it is tested in Node and costs a
// few hundred sums a frame. Pure.
//
//   CAMERA                    the numbers: how far behind, how far right, how high, how far in
//   cameraPose(body, { view: 'third' | 'first', yaw, pitch, aim, reach }, hits) → { pos, look, dist }
//     body: { x, y, z, yaw, crouch } (y the feet); yaw and pitch default to the body’s and level;
//     pitch up is positive, so the eye drops behind to look up. pos and look are { x, y, z } (look
//     a metre ahead of pos, the way yaw and pitch face); dist how far behind the shoulder it stands.
//     third: 2.6 m behind, 0.55 m right, at 1.7 m (crouched, as much lower as the eyes are);
//     aiming 1.4 m behind; never further than `reach` (the scene eases out from a wall with it)
//   wallHits(layout, open, solidsOf?) → hits(from, to) → metres along from → to to the first wall, or Infinity
//     open(doorId): whether a doorway is clear to see through (a shut door is wall); the ceiling
//     and the floor of the room the line starts in stop it too, and so does whatever stands in the
//     rooms it starts and ends in (solidsOf(roomId): rules/furnish.js's boxes, with their heights,
//     and round solids, as tall as the room), so a ship on the deck or a console behind you is
//     never looked out of from inside

import { BODY } from '../rules/walker';

export const CAMERA = Object.freeze({
  back: 2.6,
  right: 0.55,
  up: 1.7,
  aimBack: 1.4,
  // how far short of a wall the eye (or the shoulder) stops
  clear: 0.2,
});

const EPS = 1e-9;

// the way yaw and pitch face: yaw 0 is north (−z), turning towards +x
const ahead = (yaw, pitch) => ({ x: Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) });
const plus = (p, d, k) => ({ x: p.x + d.x * k, y: p.y + d.y * k, z: p.z + d.z * k });

// How far out along `dir` from `from` the eye may go, up to `len`: the line
// is looked along `clear` further, so whatever stops it is that far off.
function reachable(from, dir, len, hits) {
  if (!(len > 0)) return 0;
  const hit = hits(from, plus(from, dir, len + CAMERA.clear));
  return Math.max(0, Math.min(len, hit - CAMERA.clear));
}

export function cameraPose(body, { view = 'third', yaw = body.yaw ?? 0, pitch = 0, aim = false, reach = Infinity } = {}, hits = () => Infinity) {
  const face = ahead(yaw, pitch);
  if (view === 'first') {
    const pos = { x: body.x, y: body.y + (body.crouch ? BODY.crouchEyes : BODY.eyes), z: body.z };
    return { pos, look: plus(pos, face, 1), dist: 0 };
  }
  const drop = body.crouch ? BODY.eyes - BODY.crouchEyes : 0;
  const pivot = { x: body.x, y: body.y + CAMERA.up - drop, z: body.z };
  const right = { x: Math.cos(yaw), y: 0, z: Math.sin(yaw) };
  const shoulder = plus(pivot, right, reachable(pivot, right, CAMERA.right, hits));
  const behind = { x: -face.x, y: -face.y, z: -face.z };
  const dist = reachable(shoulder, behind, Math.min(aim ? CAMERA.aimBack : CAMERA.back, reach), hits);
  const pos = plus(shoulder, behind, dist);
  return { pos, look: plus(pos, face, 1), dist };
}

// how far along from → to (0…1) the line first goes into a solid, or Infinity
function intoSolid(s, from, d) {
  if (s.box) {
    const b = s.box;
    let t0 = 0;
    let t1 = 1;
    for (const [o, v, lo, hi] of [
      [from.x, d.x, b.x0, b.x1],
      [from.y, d.y, b.y0 ?? -Infinity, b.y1 ?? Infinity],
      [from.z, d.z, b.z0, b.z1],
    ]) {
      if (Math.abs(v) < EPS) {
        if (o < lo || o > hi) return Infinity;
        continue;
      }
      const u = (lo - o) / v;
      const w = (hi - o) / v;
      t0 = Math.max(t0, Math.min(u, w));
      t1 = Math.min(t1, Math.max(u, w));
      if (t0 > t1) return Infinity;
    }
    // (one the line starts inside is not met: the eye starts where you are)
    return t0 > 0 ? t0 : Infinity;
  }
  const c = s.circle;
  const [ox, oz] = [from.x - c.x, from.z - c.z];
  const a = d.x * d.x + d.z * d.z;
  if (a < EPS) return Infinity;
  const b2 = ox * d.x + oz * d.z;
  const disc = b2 * b2 - a * (ox * ox + oz * oz - c.r * c.r);
  if (disc < 0) return Infinity;
  const t = (-b2 - Math.sqrt(disc)) / a;
  if (t <= 0 || t > 1) return Infinity;
  const y = from.y + d.y * t;
  return y >= (s.y0 ?? -Infinity) && y <= (s.y1 ?? Infinity) ? t : Infinity;
}

export function wallHits(layout, open = () => false, solidsOf = null) {
  const walls = layout.walls;
  return (from, to) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < EPS) return Infinity;
    const [lx, hx] = from.x < to.x ? [from.x, to.x] : [to.x, from.x];
    const [lz, hz] = from.z < to.z ? [from.z, to.z] : [to.z, from.z];
    let best = Infinity; // the share of the way along
    for (const w of walls) {
      if (Math.max(w.x0, w.x1) < lx - 1e-6 || Math.min(w.x0, w.x1) > hx + 1e-6 || Math.max(w.z0, w.z1) < lz - 1e-6 || Math.min(w.z0, w.z1) > hz + 1e-6) continue;
      if (w.door && open(w.door)) continue;
      // from + t·d meets the wall’s start + s·e, seen from above
      const ex = w.x1 - w.x0;
      const ez = w.z1 - w.z0;
      const den = dx * ez - dz * ex;
      if (Math.abs(den) < EPS) continue;
      const ax = w.x0 - from.x;
      const az = w.z0 - from.z;
      const t = (ax * ez - az * ex) / den;
      const s = (ax * dz - az * dx) / den;
      if (t < 0 || t >= best || s < -1e-6 || s > 1 + 1e-6) continue;
      const y = from.y + dy * t;
      if (y >= w.y0 && y <= w.y1) best = t;
    }
    const id = layout.roomAt(from.x, from.y, from.z);
    const room = id ? layout.rooms.get(id) : null;
    if (room) {
      const top = room.y + room.h;
      if (dy > EPS && from.y <= top && to.y > top) best = Math.min(best, (top - from.y) / dy);
      const floor = layout.floorAt(id, from.x, from.z);
      if (floor !== null && dy < -EPS && from.y >= floor && to.y < floor) best = Math.min(best, (floor - from.y) / dy);
    }
    if (solidsOf) {
      const d = { x: dx, y: dy, z: dz };
      const end = layout.roomAt(to.x, to.y, to.z);
      for (const r of new Set([id, end].filter(Boolean))) for (const s of solidsOf(r) ?? []) best = Math.min(best, intoSolid(s, from, d));
    }
    return best === Infinity ? Infinity : best * len;
  };
}
