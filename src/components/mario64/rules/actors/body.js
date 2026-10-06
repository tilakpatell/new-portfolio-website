// How the cast move: walking on the ground without walking off it, falling,
// flying when thrown, solid boxes made of triangles for the ones Mario can
// stand on or can't walk through, and Mario's bounce off a stomp.

import { findFloor, pushWalls } from '../collide';
import { setAction } from '../physics';

// gravity and the floor under an actor
export function fall(a, g, grav = 4) {
  a.vel.y = Math.max(-75, a.vel.y - grav);
  a.pos.y += a.vel.y;
  const f = findFloor(g.world, a.pos.x, a.pos.y + 60, a.pos.z);
  if (f && a.pos.y <= f.y) {
    a.pos.y = f.y;
    a.vel.y = 0;
    a.grounded = true;
    a.floorY = f.y;
  } else a.grounded = false;
  if (a.pos.y < g.world.deathY) a.alive = false;
}

// a step along its facing; at an edge or a wall it turns back and says so
export function walk(a, g, speed) {
  const s = Math.sin(a.yaw), c = Math.cos(a.yaw);
  const ahead = findFloor(g.world, a.pos.x + s * (speed + a.r), a.pos.y + 60, a.pos.z + c * (speed + a.r));
  if (!ahead || ahead.y < a.pos.y - 100 || ahead.y > a.pos.y + 60) {
    a.yaw += Math.PI;
    return false;
  }
  const p = { x: a.pos.x + s * speed, y: a.pos.y, z: a.pos.z + c * speed };
  const hit = pushWalls(g.world, p, 40, Math.min(a.r, 80), 78);
  a.pos.x = p.x;
  a.pos.z = p.z;
  if (hit) {
    a.yaw += Math.PI * 0.75;
    return false;
  }
  return true;
}

export const toward = (a, x, z) => Math.atan2(x - a.pos.x, z - a.pos.z);
export const distTo = (a, x, z) => Math.hypot(x - a.pos.x, z - a.pos.z);

// thrown or knocked flying: along its velocity, stopped by walls, until it
// lands → true on the frame it lands
export function fly(a, g) {
  const p = { x: a.pos.x + a.vel.x, y: a.pos.y, z: a.pos.z + a.vel.z };
  if (pushWalls(g.world, p, 40, Math.min(a.r, 80))) {
    a.vel.x *= -0.3;
    a.vel.z *= -0.3;
  }
  a.pos.x = p.x;
  a.pos.z = p.z;
  a.vel.y = Math.max(-75, a.vel.y - 4);
  const ny = a.pos.y + a.vel.y;
  const f = findFloor(g.world, a.pos.x, a.pos.y + 60, a.pos.z);
  if (f && ny <= f.y) {
    a.pos.y = f.y;
    a.vel.x = a.vel.y = a.vel.z = 0;
    a.floorY = f.y;
    return true;
  }
  a.pos.y = ny;
  if (a.pos.y < g.world.deathY) a.alive = false;
  return false;
}

// the 12 triangles of a box, its walls facing out (y is its bottom)
export function boxTris(x, y, z, w, h, d, yaw = 0) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const P = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
  const hw = w / 2, hd = d / 2;
  const v = [P(-hw, 0, -hd), P(hw, 0, -hd), P(hw, 0, hd), P(-hw, 0, hd), P(-hw, h, -hd), P(hw, h, -hd), P(hw, h, hd), P(-hw, h, hd)];
  const quads = [
    [4, 7, 6, 5],
    [3, 2, 1, 0],
    [0, 4, 5, 1],
    [1, 5, 6, 2],
    [2, 6, 7, 3],
    [3, 7, 4, 0],
  ];
  const out = [];
  for (const [p, q, r, t] of quads) out.push(...v[p], ...v[q], ...v[r], ...v[p], ...v[r], ...v[t]);
  return out;
}

// Mario off the top of something he stomped: up, as a jump (holding A
// bounces higher, as letting go cuts it)
export function bounce(m, vy = 40) {
  m.airborne = true;
  m.vel.y = vy;
  m.peakY = m.pos.y;
  setAction(m, 'jump');
  m.cutJump = true;
}
