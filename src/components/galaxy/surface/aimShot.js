// Where your shot goes on a galaxy surface (lib/combat/aim.js on this
// world's things), beside scene.js, which is past its size. The camera's
// ray through the crosshair finds the aim point: the first target or
// solid, bent a little toward a target by the input's assist cone; the
// bolt then flies from the muzzle to that point, so what the crosshair is
// on is what's hit, even with the gun off to the side of the camera.
//
//   aimDir({ cam, dir, from, targets, world, cone, range }) → [x, y, z]
//     the unit direction from `from` (the muzzle's side of the figure) to
//     the aim point; `cam` the camera's place and `dir` its forward ({ x,
//     y, z }s), `targets` the shootables (activity.js's: a holder, a
//     figure's height), `world` the surface's (heightAt, solids), `cone`
//     aim.js's ASSIST row (touch's snaps all the way, aim.js's snapped).
//   lookFriction({ cam, dir, targets, cone }) → 1, or less over a target.
//
// What stops the aim is what stops a bolt (./solids.js's boltSolids: the
// walls and props you walk into, and the ground), so the crosshair on a
// trooper behind a wall aims at the wall.

import { aimPoint, assist, friction, snapped } from '../../../lib/combat/aim';
import { boltSolids } from './solids';

const arr = (v) => [v.x, v.y, v.z];

// A target as aim.js's capsule: from a little over its feet to a little
// under its head, as wide as blaster.js's sphere is round its middle.
export function capsuleOf(t) {
  const tall = (t.fig?.tall ?? 1.6) * (t.spec?.scale ?? 1);
  const p = t.holder.position;
  const r = Math.max(0.35, tall * 0.25);
  return { id: t.id ?? t, a: [p.x, p.y + Math.min(r, tall / 2), p.z], b: [p.x, p.y + Math.max(tall - r, tall / 2), p.z], r, ref: t };
}
const live = (targets) => targets.filter((t) => t?.holder && !(t.hp <= 0) && !t.down && t.holder.visible !== false).map(capsuleOf);

// The ray starts level with the figure, not at the camera: what's between
// the camera and your back is never aimed at, and `min` counts from you.
function rayFrom(cam, dir, from) {
  const c = arr(cam);
  const d = arr(dir);
  const s = Math.max(0, (from.x - c[0]) * d[0] + (from.y - c[1]) * d[1] + (from.z - c[2]) * d[2]);
  return { from: [c[0] + d[0] * s, c[1] + d[1] * s, c[2] + d[2] * s], dir: d };
}

export function aimDir({ cam, dir, from, targets, world, cone, range = 90 }) {
  const ray = rayFrom(cam, dir, from);
  const caps = live(targets);
  const solids = boltSolids(world);
  // (touch's cone snaps: a tap of the fire button goes onto whoever's in it)
  const bent = cone ? assist(ray.dir, ray.from, caps, snapped(cone)) : ray.dir;
  const { at } = aimPoint({ from: ray.from, dir: bent }, solids, caps, { max: range });
  const v = [at[0] - from.x, at[1] - from.y, at[2] - from.z];
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

export function lookFriction({ cam, dir, targets, cone }) {
  return friction(arr(dir), arr(cam), live(targets), cone);
}
