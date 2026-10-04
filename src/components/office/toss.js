// Paper toss, Office Olympics: the rules, apart from the drawing. A crumpled
// sheet of Dunder Mifflin paper is thrown from Jim's desk at a wastebasket
// across the bullpen. Ten balls a round. Every basket moves the bin somewhere
// harder; after two, the desk fan comes on and its wind pushes the paper.
//
// Metres and seconds. x runs to the right, y up, z away from the thrower.
// Everything random comes from the round's seeded source, so a round can be
// replayed exactly (toss.test.js does).

export const TOSS = {
  balls: 10,
  dt: 1 / 240, // physics step: the ball moves well under its own radius per step
  g: 9.81,
  r: 0.036, // the paper ball's radius
  drag: 0.11, // ½ρC·A/m for two sheets crumpled tight: it still slows a lot
  release: { x: 0, y: 1.02, z: 0.28 }, // the hand, over the desk's front edge
  elevation: (40 * Math.PI) / 180, // the throw's launch angle
  speed: [3.4, 12.6], // launch speed at no power and full power, m/s
  maxYaw: 0.5, // radians either side of straight ahead
  bin: { rim: 0.15, base: 0.115, height: 0.34, wire: 0.006 },
  room: { x: 3.6, z: 9.2 }, // side walls at ±x, the far wall at z
  restitution: { floor: 0.28, rim: 0.42, wall: 0.3, desk: 0.3 },
  maxFlight: 7, // seconds before a ball is given up on
};

// ── Seeded randomness ──────────────────────────────────────────────────────
export function rng(seed = 1) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;

// ── Where the bin goes ─────────────────────────────────────────────────────
// Close and still to start; further, wider and windier with every basket.
// From the fourth basket a desk may stand between you and the bin.
export function layout(rand, made) {
  const k = clamp(made / 7, 0, 1);
  const z = clamp(lerp(2.6, 6.9, k) + (rand() - 0.5) * 0.8, 2.4, 7.3);
  const x = (rand() * 2 - 1) * lerp(0.25, 1.9, clamp(made / 6, 0, 1));
  let wind = { x: 0, z: 0 };
  if (made >= 2) {
    const speed = Math.min(2.4, 0.55 + 0.32 * (made - 2)) * lerp(0.75, 1.1, rand());
    const a = (rand() * 2 - 1) * (Math.PI / 6) + (rand() < 0.5 ? 0 : Math.PI); // mostly across the room
    wind = { x: Math.cos(a) * speed, z: Math.sin(a) * speed * 0.6 };
  }
  let desk = null;
  if (made >= 4 && z > 4.2 && rand() < 0.45) {
    // Dwight's desk, square across the line about halfway out
    const dz = z * lerp(0.42, 0.58, rand());
    desk = { x0: x * (dz / z) - 0.75, x1: x * (dz / z) + 0.75, z0: dz - 0.38, z1: dz + 0.38, top: 0.76 };
  }
  return { bin: { x, z }, wind, desk };
}

// ── A round ────────────────────────────────────────────────────────────────
export function newRound({ seed = 1, rand = rng(seed) } = {}) {
  const s = {
    rand,
    phase: 'aim', // aim | flying | over
    ball: null,
    throws: 0,
    made: 0,
    streak: 0,
    bestStreak: 0,
    score: 0,
    swishes: 0,
    last: null, // the last throw's outcome
    events: [],
    t: 0,
  };
  Object.assign(s, layout(rand, 0));
  return s;
}

// The launch velocity for an aim (radians, + is right) and power (0 to 1).
export function velocityFor(yaw, power) {
  const sp = lerp(TOSS.speed[0], TOSS.speed[1], clamp(power, 0, 1));
  const y = clamp(yaw, -TOSS.maxYaw, TOSS.maxYaw);
  const h = Math.cos(TOSS.elevation) * sp;
  return { x: Math.sin(y) * h, y: Math.sin(TOSS.elevation) * sp, z: Math.cos(y) * h };
}

export function launch(s, { yaw = 0, power = 0.5 } = {}) {
  if (s.phase !== 'aim') return false;
  const v = velocityFor(yaw, power);
  s.ball = { x: TOSS.release.x, y: TOSS.release.y, z: TOSS.release.z, vx: v.x, vy: v.y, vz: v.z, t: 0, rest: 0, rim: false, bounced: false, inside: false, spin: (s.rand() - 0.5) * 12 };
  s.phase = 'flying';
  s.throws++;
  s.events.push({ type: 'throw', power });
  return true;
}

// ── Collisions ─────────────────────────────────────────────────────────────
// Reflect the part of the velocity going into a surface (normal n, unit),
// keep some of it (e), and take friction off the rest.
function bounce(b, n, e, friction = 0.12) {
  const vn = b.vx * n.x + b.vy * n.y + b.vz * n.z;
  if (vn >= 0) return 0;
  b.vx -= (1 + e) * vn * n.x;
  b.vy -= (1 + e) * vn * n.y;
  b.vz -= (1 + e) * vn * n.z;
  const f = 1 - friction;
  // friction acts on the tangential part only
  const vn2 = b.vx * n.x + b.vy * n.y + b.vz * n.z;
  b.vx = (b.vx - vn2 * n.x) * f + vn2 * n.x;
  b.vy = (b.vy - vn2 * n.y) * f + vn2 * n.y;
  b.vz = (b.vz - vn2 * n.z) * f + vn2 * n.z;
  return -vn;
}

const binRadiusAt = (y) => lerp(TOSS.bin.base, TOSS.bin.rim, clamp(y / TOSS.bin.height, 0, 1));

function collide(s, b, ev) {
  const { r } = TOSS;
  const B = TOSS.bin;
  // the floor
  if (b.y < r) {
    b.y = r;
    const hit = bounce(b, { x: 0, y: 1, z: 0 }, TOSS.restitution.floor, 0.35);
    if (hit > 0.6) ev.push({ type: 'floor', speed: hit });
    b.bounced = true;
  }
  // the room's walls
  if (Math.abs(b.x) > TOSS.room.x - r) {
    b.x = Math.sign(b.x) * (TOSS.room.x - r);
    if (bounce(b, { x: -Math.sign(b.x), y: 0, z: 0 }, TOSS.restitution.wall) > 0.5) ev.push({ type: 'wall' });
  }
  if (b.z > TOSS.room.z - r) {
    b.z = TOSS.room.z - r;
    if (bounce(b, { x: 0, y: 0, z: -1 }, TOSS.restitution.wall) > 0.5) ev.push({ type: 'wall' });
  }
  // a desk in the way: a box from the floor to its top
  const d = s.desk;
  if (d) {
    const cx = clamp(b.x, d.x0, d.x1);
    const cy = clamp(b.y, 0, d.top);
    const cz = clamp(b.z, d.z0, d.z1);
    const dx = b.x - cx;
    const dy = b.y - cy;
    const dz = b.z - cz;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < r) {
      const n = dist > 1e-6 ? { x: dx / dist, y: dy / dist, z: dz / dist } : { x: 0, y: 1, z: 0 };
      b.x = cx + n.x * r;
      b.y = cy + n.y * r;
      b.z = cz + n.z * r;
      if (bounce(b, n, TOSS.restitution.desk, n.y > 0.7 ? 0.3 : 0.12) > 0.5) ev.push({ type: 'desk' });
      b.bounced = true;
    }
  }
  // the bin
  const px = b.x - s.bin.x;
  const pz = b.z - s.bin.z;
  const rho = Math.hypot(px, pz);
  const ux = rho > 1e-6 ? px / rho : 1;
  const uz = rho > 1e-6 ? pz / rho : 0;
  // the rim: a wire ring at the top
  const ry = b.y - B.height;
  const rr = rho - B.rim;
  const toRim = Math.hypot(rr, ry);
  if (toRim < r + B.wire) {
    const n = { x: (rr / toRim) * ux, y: ry / toRim, z: (rr / toRim) * uz };
    const push = r + B.wire - toRim;
    b.x += n.x * push;
    b.y += n.y * push;
    b.z += n.z * push;
    const hit = bounce(b, n, TOSS.restitution.rim, 0.08);
    if (hit > 0.15) {
      b.rim = true;
      ev.push({ type: 'rim', speed: hit });
    }
  }
  if (b.y < B.height) {
    const wall = binRadiusAt(b.y);
    if (b.inside) {
      // inside: the walls keep it in, the bottom catches it
      if (rho > wall - r) {
        b.x = s.bin.x + ux * (wall - r);
        b.z = s.bin.z + uz * (wall - r);
        bounce(b, { x: -ux, y: 0, z: -uz }, 0.2, 0.3);
      }
      if (b.y < r + 0.01) {
        b.y = r + 0.01;
        bounce(b, { x: 0, y: 1, z: 0 }, 0.15, 0.5);
      }
    } else if (rho < wall + r && rho > wall - r) {
      // the outside of the basket
      b.x = s.bin.x + ux * (wall + r);
      b.z = s.bin.z + uz * (wall + r);
      if (bounce(b, { x: ux, y: 0, z: uz }, 0.3) > 0.4) ev.push({ type: 'bin' });
      b.bounced = true;
    }
  }
  // falling in through the opening
  if (!b.inside && b.vy < 0 && b.y < B.height && b.y > B.height - 0.12 && rho < B.rim - r * 0.5) b.inside = true;
}

// ── Time ───────────────────────────────────────────────────────────────────
// Advance the round by dt seconds (any size; it steps in fixed slices).
// Returns the events since the last call.
export function step(s, dt) {
  const ev = s.events;
  s.events = [];
  if (s.phase !== 'flying') return ev;
  let left = Math.min(dt, 0.25);
  while (left > 1e-9 && s.phase === 'flying') {
    const h = Math.min(TOSS.dt, left);
    left -= h;
    advance(s, s.ball, h, ev);
    settle(s, ev);
  }
  s.t += dt;
  return ev;
}

function advance(s, b, h, ev) {
  // air drag against the ball's motion through the (moving) air
  const rx = b.vx - s.wind.x;
  const ry = b.vy;
  const rz = b.vz - s.wind.z;
  const sp = Math.hypot(rx, ry, rz);
  const k = TOSS.drag * sp;
  b.vx -= k * rx * h;
  b.vy -= (k * ry + TOSS.g) * h;
  b.vz -= k * rz * h;
  b.x += b.vx * h;
  b.y += b.vy * h;
  b.z += b.vz * h;
  b.t += h;
  collide(s, b, ev);
}

// Has this throw finished: in the bin, at rest, or gone?
function settle(s, ev) {
  const b = s.ball;
  const B = TOSS.bin;
  const rho = Math.hypot(b.x - s.bin.x, b.z - s.bin.z);
  if (b.inside && b.y < B.height - TOSS.r && rho < B.rim) return finish(s, true, ev);
  const speed = Math.hypot(b.vx, b.vy, b.vz);
  b.rest = speed < 0.08 && b.y < 0.2 ? b.rest + TOSS.dt : 0;
  if (b.rest > 0.25 || b.t > TOSS.maxFlight) return finish(s, false, ev);
  return null;
}

function finish(s, made, ev) {
  const b = s.ball;
  const dist = Math.hypot(s.bin.x - TOSS.release.x, s.bin.z - TOSS.release.z);
  const wind = Math.hypot(s.wind.x, s.wind.z);
  let points = 0;
  if (made) {
    s.made++;
    s.streak++;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
    const swish = !b.rim && !b.bounced;
    if (swish) s.swishes++;
    points = Math.round((10 + 5 * Math.max(0, dist - 2.5) + 5 * wind + (swish ? 10 : 0) + (s.desk ? 10 : 0)) * multiplier(s.streak));
    s.score += points;
    s.last = { made, swish, rim: b.rim, points, dist, streak: s.streak, at: { x: b.x, z: b.z } };
    ev.push({ type: 'in', swish, rim: b.rim, points, streak: s.streak });
  } else {
    s.streak = 0;
    s.last = { made, swish: false, rim: b.rim, points: 0, dist, streak: 0, at: { x: b.x, z: b.z }, short: b.z < s.bin.z - TOSS.bin.rim, long: b.z > s.bin.z + TOSS.bin.rim };
    ev.push({ type: 'miss', rim: b.rim, short: s.last.short, long: s.last.long });
  }
  if (s.throws >= TOSS.balls) {
    s.phase = 'over';
    ev.push({ type: 'over', score: s.score, made: s.made });
  } else {
    s.phase = 'aim';
    // a basket moves the bin; a miss leaves it where it is, to try again
    if (made) {
      const prev = s.wind;
      Object.assign(s, layout(s.rand, s.made));
      if (!(prev.x || prev.z) && (s.wind.x || s.wind.z)) ev.push({ type: 'fan' });
      ev.push({ type: 'moved' });
    }
  }
  return made;
}

// Streaks pay: ×1, ×1.5, ×2, ×2.5, ×3 at most.
export const multiplier = (streak) => Math.min(3, 1 + 0.5 * Math.max(0, streak - 1));

// ── Help ───────────────────────────────────────────────────────────────────
// Where a throw would go, through the air only (no bounces): the aim guide.
export function predict(s, aim, seconds = 2.5, every = 0.03) {
  const v = velocityFor(aim.yaw, aim.power);
  const b = { x: TOSS.release.x, y: TOSS.release.y, z: TOSS.release.z, vx: v.x, vy: v.y, vz: v.z, t: 0 };
  const pts = [];
  let next = 0;
  for (let t = 0; t < seconds && b.y > 0; t += TOSS.dt) {
    const rx = b.vx - s.wind.x;
    const rz = b.vz - s.wind.z;
    const k = TOSS.drag * Math.hypot(rx, b.vy, rz);
    b.vx -= k * rx * TOSS.dt;
    b.vy -= (k * b.vy + TOSS.g) * TOSS.dt;
    b.vz -= k * rz * TOSS.dt;
    b.x += b.vx * TOSS.dt;
    b.y += b.vy * TOSS.dt;
    b.z += b.vz * TOSS.dt;
    if (t >= next) {
      pts.push({ x: b.x, y: b.y, z: b.z });
      next += every;
    }
  }
  return pts;
}

// Would this throw go in? (Plays it out on a copy of the round, stopping as
// soon as it can't: on the floor outside the bin, or well past it.)
export function tryThrow(s, aim) {
  const c = { ...s, rand: rng(7), events: [], phase: 'aim', throws: 0, ball: null };
  launch(c, aim);
  const ev = [];
  for (let i = 0; i < 3000 && c.phase === 'flying'; i++) {
    const b = c.ball;
    advance(c, b, TOSS.dt, ev);
    if (settle(c, ev) !== null) break;
    if (!b.inside && (b.y < TOSS.r + 0.002 || b.z > c.bin.z + 1.2 || Math.abs(b.x - c.bin.x) > 2.5)) return false;
  }
  return c.made > s.made;
}

// A throw that goes in, if there is one: a coarse sweep, then a finer one
// around the first hit. Used by the tests (every bin can be made) and the demo.
export function solve(s) {
  const hits = [];
  for (let i = 0; i <= 40; i++)
    for (let j = 0; j <= 48; j++) {
      const aim = { yaw: lerp(-TOSS.maxYaw, TOSS.maxYaw, i / 40), power: j / 48 };
      if (tryThrow(s, aim)) hits.push(aim);
    }
  if (!hits.length) return null;
  // the middle of the biggest cluster is the most forgiving throw
  hits.sort((a, b) => a.power - b.power || a.yaw - b.yaw);
  return hits[Math.floor(hits.length / 2)];
}
