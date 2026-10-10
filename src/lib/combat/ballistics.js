// A projectile's flight by the game's numbers: a row of
// src/data/bf2017/physics/projectiles.json (a ProjectileBlueprint's or a
// bolt's InitialSpeed, Gravity, Drag, MaxSpeed and TimeToLive) moves a bolt
// one step. The step is the exact solution of dv/dt = g − k·v over dt (drag
// a share of the velocity per second, gravity along y), so a flight lands
// in the same place at 30 and at 120 steps a second, and a bolt with no
// gravity and no drag moves exactly `speed · dt` along its line, as
// lib/combat/bolt.js flies without a row.
//
//   flight(row, bolt, dt) → { gone, from }: bolt { pos, vel, life } (plain
//     [x, y, z] arrays and seconds flown) moved over dt; its speed held
//     under row.maxSpeed when there is one; gone once life reaches row.ttl
//     (a ttl of 0 or none: it lives until something stops it)
//   launch(row, dir, speed = row.speed) → [vx, vy, vz]: the first velocity
//   arc(row, from, dir, { speed, step = 1 / 30, steps = 90, floor }) →
//     [[x, y, z]...]: where a thrown thing goes, closed form, for the aim
//     line (stopped below `floor`, a height, when given)
// Pure: plain arrays, no three.js.

const EPS = 1e-12;

// where a thing is after t seconds, and how fast it goes, under gravity g
// (y) and drag k (per second), from velocity v
function advance(v, g, k, t) {
  if (k > EPS) {
    const e = Math.exp(-k * t);
    const s = (1 - e) / k; // ∫ e^(−kτ) dτ over t
    const term = g / k; // the speed it falls at in the end (y)
    return {
      d: [v[0] * s, (v[1] - term) * s + term * t, v[2] * s],
      v: [v[0] * e, (v[1] - term) * e + term, v[2] * e],
    };
  }
  return { d: [v[0] * t, v[1] * t + 0.5 * g * t * t, v[2] * t], v: [v[0], v[1] + g * t, v[2]] };
}

export function launch(row, dir, speed = row.speed) {
  const l = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  const s = row.maxSpeed > 0 ? Math.min(speed, row.maxSpeed) : speed;
  return [(dir[0] / l) * s, (dir[1] / l) * s, (dir[2] / l) * s];
}

export function flight(row, bolt, dt) {
  const from = bolt.pos;
  if (!(dt > 0)) return { gone: false, from };
  const ttl = row.ttl > 0 ? row.ttl : Infinity;
  const t = Math.min(dt, Math.max(0, ttl - (bolt.life ?? 0)));
  const { d, v } = advance(bolt.vel, row.gravity ?? 0, row.drag ?? 0, t);
  const s = Math.hypot(v[0], v[1], v[2]);
  const most = row.maxSpeed > 0 ? row.maxSpeed : Infinity;
  bolt.vel = s > most ? [(v[0] / s) * most, (v[1] / s) * most, (v[2] / s) * most] : v;
  bolt.pos = [from[0] + d[0], from[1] + d[1], from[2] + d[2]];
  bolt.life = (bolt.life ?? 0) + t;
  return { gone: bolt.life >= ttl - 1e-9, from };
}

export function arc(row, from, dir, { speed = row.speed, step = 1 / 30, steps = 90, floor = -Infinity } = {}) {
  const v = launch(row, dir, speed);
  const out = [[from[0], from[1], from[2]]];
  for (let i = 1; i <= steps; i++) {
    const t = i * step;
    if (row.ttl > 0 && t > row.ttl) break;
    const { d } = advance(v, row.gravity ?? 0, row.drag ?? 0, t);
    const p = [from[0] + d[0], from[1] + d[1], from[2] + d[2]];
    out.push(p);
    if (p[1] < floor) break;
  }
  return out;
}
