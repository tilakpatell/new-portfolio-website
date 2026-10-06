// On foot: out of the ship and walking about on a planet, as plain numbers
// (no three.js), so it's tested in Node; footScene.js draws it and the
// scene drives it.
//
// Everything here is in the planet's own space: its middle at the origin,
// its surface R out. A person is where they stand (n, a unit vector out
// from the middle), which way they face (f, a unit vector along the ground)
// and how high they are off it (h, jumping). They walk and run where they
// face, turn on the spot, step sideways, jump, and go round any obstacle
// (the parked ship); the ground curves away under them, so a walk in a
// straight line goes round the planet.
//
// A planet with a trench round its middle (the Death Star's) has its rim
// to walk up to and no further: the ship comes down beside it, its door
// toward it, and a squad comes from your side of it.
//
// The planets are huge against a person (a few hundred of them tall at the
// smallest), so a squad of the Galactic Federation (who are after every crew
// that lands anywhere) comes over the horizon now and then: they walk at
// you, stop at a distance, and shoot, not very well. Your bolts and theirs
// fly straight (the ground hardly curves over a shot's length) and hit
// whoever they pass close enough to.

export const METRE = 0.027; // map units (the ship's 0.26 long is about an RV's ten metres)

export const FOOT = {
  walk: 1.8 * METRE, // a second
  run: 6 * METRE,
  back: 1.2 * METRE,
  side: 1.5 * METRE,
  accel: 12 * METRE, // a second, a second
  turn: 2.6, // radians a second
  gravity: 9.8 * METRE, // a second, a second
  jump: 4.2 * METRE, // up, a second (a metre high, near enough)
  radius: 0.35 * METRE, // a person, for bumping into things
  board: 6 * METRE, // how close to the ship's middle to get back in
  bolt: 60 * METRE, // a second
  boltLife: 1.6, // seconds
  hit: 0.55 * METRE, // how close a bolt must pass a person's middle
  health: 100,
  heal: 9, // health a second, once out of trouble a while
};

// who comes after a crew on the ground: the Federation's troops (which
// side's come is sides.js's `squads`)
export const TROOPS = {
  gromflomite: { tall: 1.95 * METRE, hp: 2, speed: 2.2 * METRE, fire: [1.3, 2.4], range: [9, 14], spread: 0.09, damage: 9 },
  cop: { tall: 1.9 * METRE, hp: 3, speed: 2.6 * METRE, fire: [1.1, 2.0], range: [8, 12], spread: 0.07, damage: 11 },
  gazorpian: { tall: 2.6 * METRE, hp: 6, speed: 3.4 * METRE, fire: null, range: [0, 1.2], spread: 0, damage: 18 }, // no gun: it charges, and hits
  // and Albuquerque's (sides.js): DEA agents, steady, and the cartel's gunmen, who come close
  dea: { tall: 1.85 * METRE, hp: 3, speed: 2.5 * METRE, fire: [1.0, 1.9], range: [9, 13], spread: 0.06, damage: 11 },
  cartel: { tall: 1.8 * METRE, hp: 2, speed: 2.9 * METRE, fire: [0.9, 1.6], range: [6, 10], spread: 0.11, damage: 9 },
};

// how big each ship is parked, against the people who fly it (in flight
// they're all drawn the same size): a scale on the flying model
export const PARKED = { rv: 1.1, cruiser: 0.55, xwing: 1.35, falcon: 3.2 };

// ── vectors (arrays of three) ──
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
// v turned by `angle` about the unit axis k (Rodrigues)
export function rotate(v, k, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const kv = cross(k, v);
  const d = dot(k, v) * (1 - c);
  return [v[0] * c + kv[0] * s + k[0] * d, v[1] * c + kv[1] * s + k[1] * d, v[2] * c + kv[2] * s + k[2] * d];
}
// a along the ground at n: what's left of it once its part out from the middle is gone
export const flat = (a, n) => unit(add(a, n, -dot(a, n)));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const vec = { dot, cross, add, scale, len, unit };

// where someone stands, in the planet's space
export const at = (w, R) => scale(w.n, R + (w.h ?? 0));
// their right, along the ground
export const rightOf = (w) => cross(w.f, w.n);

// where to come down on a planet (its middle `c`, radius R) from a ship at
// `from` (both in the map's space): on the near side, leaning toward the
// light (`light`, a unit direction toward it), so it's day where you land
export function landingSpot(from, c, light = null) {
  let n = unit([from[0] - c[0], from[1] - c[1], from[2] - c[2]]);
  if (light) {
    n = unit(add(n, light, 0.7));
    if (dot(n, unit([from[0] - c[0], from[1] - c[1], from[2] - c[2]])) < 0.3) n = unit([from[0] - c[0], from[1] - c[1], from[2] - c[2]]);
  }
  return n;
}

// a heading along the ground at n, as close as it can be to `toward`
export function facingAlong(n, toward) {
  const f = add(toward, n, -dot(toward, n));
  if (len(f) > 1e-6) return unit(f);
  const any = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  return flat(any, n);
}

// ── A trench round the middle ──
// `band`: a planet's trench, in its own space ({ half, home, arc }): its
// channel's half width either side of the planet's middle (y = 0: it runs
// round level), in map units, and the arc of it there is (round from the
// way `home`, an angle, either way: all the way round at π)
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const alongArc = (n, band, pad) => band.arc >= Math.PI || Math.abs(wrap(Math.atan2(n[2], n[0]) - band.home)) <= band.arc + pad;
// whether n is in the trench (or within `pad` of its rim, map units)
export const inTrench = (n, band, R, pad = 0) => Boolean(band) && Math.abs(n[1]) < Math.sin((band.half + pad) / R) && alongArc(n, band, pad / R);

// Where to come down by a trench, from `n` (where it'd come down anyway):
// `back` from the rim (map units) on the side of it n is on, as near n as
// that is, facing along it with the door (on the right) toward it.
export function byTrench(n, band, R, back) {
  const lat = (band.half + back) / R;
  const side = n[1] < 0 ? -1 : 1;
  let lon = Math.atan2(n[2], n[0]);
  if (band.arc < Math.PI) {
    // (in from the trench's ends, if it doesn't go all the way round)
    const most = Math.max(0, band.arc - back / R);
    lon = band.home + clamp(wrap(lon - band.home), -most, most);
  }
  const spot = [Math.cos(lon) * Math.cos(lat), side * Math.sin(lat), Math.sin(lon) * Math.cos(lat)];
  let f = flat([-Math.sin(lon), 0, Math.cos(lon)], spot);
  if (dot(cross(f, spot), [0, -side, 0]) < 0) f = scale(f, -1);
  return { n: spot, f };
}

// someone standing at n, facing f
export const person = (n, f, extra = {}) => ({ n: unit(n), f: flat(f, unit(n)), h: 0, vh: 0, speed: 0, side: 0, ...extra });

// somewhere along the ground from w: `d` (map units) ahead, `s` to the right
export function offset(w, d, s, R) {
  const dir = add(scale(w.f, d), rightOf(w), s);
  const dist = len(dir);
  if (dist < 1e-9) return { n: w.n, f: w.f };
  const axis = unit(cross(w.n, dir));
  const a = dist / R;
  return { n: unit(rotate(w.n, axis, a)), f: unit(flat(rotate(w.f, axis, a), unit(rotate(w.n, axis, a)))) };
}

// ── A landing's things (landings/), round where the ship comes down ──
// A thing at (x, z) metres on a flat frame laid at `frame` ({ n, f }: the
// spot, and the way it faces), three.js's way round (+z ahead, +x to its
// left, n × f, and up out of the ground), put on the sphere: where it
// stands, and which way its own +z faces (`yaw`, turned as three.js turns
// a thing about its up: +z round toward +x)
export function place(frame, x, z, R, yaw = 0) {
  const o = offset(frame, z * METRE, -x * METRE, R);
  return { n: o.n, f: yaw ? unit(rotate(o.f, o.n, yaw)) : o.f };
}

// A thing's solids, in its own frame in metres (a builder's: { circle: [x,
// z, r] } or { box: [x, z, hw, hd, yaw?] }), as circles along the ground
// round where it stands (`spot`, as place gives): what walk() goes round. A
// box is a row of circles down its length, each as wide as it is.
export function solidsOn(spot, solids, R) {
  const out = [];
  const at = (x, z, r) => out.push({ n: place(spot, x, z, R).n, r: r * METRE });
  for (const s of solids ?? []) {
    if (s.circle) at(...s.circle);
    else if (s.box) {
      const [x, z, hw, hd, yaw = 0] = s.box;
      const long = Math.max(hw, hd);
      const r = Math.max(Math.min(hw, hd), 0.3);
      const c = Math.cos(yaw);
      const sn = Math.sin(yaw);
      // down its long side (its x or its z, turned by its yaw)
      const [ax, az] = hw >= hd ? [c, -sn] : [sn, c];
      const reach = Math.max(0, long - r);
      const count = Math.min(24, Math.max(1, Math.ceil(reach / r) + 1));
      for (let i = 0; i < count; i++) {
        const t = count > 1 ? -reach + (2 * reach * i) / (count - 1) : 0;
        at(x + ax * t, z + az * t, r);
      }
    }
  }
  return out;
}

// the distance along the ground between two people (or spots), map units
export const apart = (a, b, R) => Math.acos(clamp(dot(a.n, b.n), -1, 1)) * R;

// the turn (radians, + to the left) from facing `f` at `n` to facing `to`
export function bearing(n, f, to) {
  const t = flat(to, n);
  return Math.atan2(dot(cross(f, t), n), dot(f, t));
}

// One step of `dt` seconds for someone on a planet of radius R.
// input: { move: −1…1 (forward +), strafe: −1…1 (right +), turn: −1…1
// (right +), run, jump, speed? (a top speed of their own) }; obstacles:
// [{ n, r }] they go round (r along the ground, map units), and a trench
// ({ band }, as byTrench's) they stop at the rim of.
export function walk(w, input, dt, R, obstacles = []) {
  dt = clamp(dt, 0, 0.05);
  const move = clamp(input.move || 0, -1, 1);
  const strafe = clamp(input.strafe || 0, -1, 1);
  const turn = clamp(input.turn || 0, -1, 1);
  // turning: on the spot, the right way round the way up is
  let f = turn ? unit(rotate(w.f, w.n, -turn * FOOT.turn * dt)) : w.f;
  let n = w.n;
  const top = input.speed ?? (move > 0 ? (input.run ? FOOT.run : FOOT.walk) : FOOT.back);
  const ease = (v, want) => v + clamp(want - v, -FOOT.accel * dt, FOOT.accel * dt);
  const speed = ease(w.speed || 0, move * top);
  const side = ease(w.side || 0, strafe * FOOT.side);
  // along the ground: a turn about the planet's middle, carrying the facing with it
  const dir = add(scale(f, speed), cross(f, n), side);
  const dist = len(dir) * dt;
  if (dist > 1e-9) {
    const axis = unit(cross(n, dir));
    const a = dist / (R + (w.h ?? 0));
    n = unit(rotate(n, axis, a));
    f = flat(rotate(f, axis, a), n);
  }
  // round anything in the way
  for (const o of obstacles) {
    if (o.band) {
      // back up onto the rim, on the side they were on
      if (!inTrench(n, o.band, R, FOOT.radius)) continue;
      const lim = Math.sin((o.band.half + FOOT.radius) / R);
      const side = Math.sign(w.n[1]) || Math.sign(n[1]) || 1;
      const k = Math.sqrt(1 - lim * lim) / (Math.hypot(n[0], n[2]) || 1);
      n = [n[0] * k, side * lim, n[2] * k];
      f = flat(f, n);
      continue;
    }
    const gap = Math.acos(clamp(dot(n, o.n), -1, 1)) * R;
    const min = o.r + FOOT.radius;
    if (gap >= min) continue;
    const away = len(add(n, o.n, -dot(n, o.n))) > 1e-9 ? flat(n, o.n) : flat(f, o.n);
    n = unit(add(scale(o.n, Math.cos(min / R)), away, Math.sin(min / R)));
    f = flat(f, n);
  }
  // up and down: a jump, and back to the ground
  let h = w.h ?? 0;
  let vh = w.vh ?? 0;
  if (input.jump && h <= 1e-6) vh = FOOT.jump;
  vh -= FOOT.gravity * dt;
  h += vh * dt;
  if (h <= 0) {
    h = 0;
    vh = 0;
  }
  return { ...w, n, f, h, vh, speed, side };
}

// Turning someone to face somewhere: the turn input (−1…1) that brings them round
export const turnToward = (w, to, gain = 3) => clamp(-bearing(w.n, w.f, to) * gain, -1, 1);

// ── The Federation's squads ──

let nextId = 1;

// A squad coming over the horizon at `w` (the player), from one side:
// `count` of them, spread out, `dist` away along the ground (and on a
// planet with a trench, `band`, from somewhere on the player's side of it)
export function squad(rand, w, R, { count = 3, dist = 46 * METRE, kinds = ['gromflomite', 'gromflomite', 'cop'], band = null } = {}) {
  let out = [];
  for (let tries = 0; tries < 12; tries++) {
    out = troopsFrom(rand, w, R, count, dist, kinds);
    if (!band || out.every((t) => !inTrench(t.n, band, R, 2 * METRE) && Math.sign(t.n[1]) === Math.sign(w.n[1]))) break;
  }
  return out;
}
function troopsFrom(rand, w, R, count, dist, kinds) {
  const from = rand() * Math.PI * 2;
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = from + (i - (count - 1) / 2) * (0.22 + rand() * 0.12);
    const d = dist * (0.9 + rand() * 0.25);
    const spot = offset(w, Math.cos(a) * d, Math.sin(a) * d, R);
    const kind = kinds[Math.floor(rand() * kinds.length)];
    const facing = facingAlong(spot.n, add(w.n, spot.n, -1)); // toward the player
    out.push({ id: nextId++, kind, ...person(spot.n, facing), hp: TROOPS[kind].hp, cool: 1 + rand() * 1.5, hold: TROOPS[kind].range[0] + rand() * (TROOPS[kind].range[1] - TROOPS[kind].range[0]), alive: true, dead: 0, swing: 0, aim: 0 });
  }
  return out;
}

// One step for a squad: each goes at the nearest of `targets` ([{ id, n,
// h }], the player and whoever's with them), stops at its distance and
// fires (or, without a gun, closes in and hits). One with a gun brings it
// up as a target comes within reach (`aim`, 0…1: up in a quarter of a
// second, down in half of one once they've gone), for the drawing to read.
// Returns { troops, shots, hits }: shots are new bolts ({ from, dir, owner:
// 'troop', kind, damage, by (the trooper), range (to what it's aimed at) }),
// hits are blows landed ({ target, damage }).
export function march(troops, targets, dt, R, rand, obstacles = []) {
  const shots = [];
  const hits = [];
  const out = troops.map((t) => {
    if (!t.alive) return { ...t, dead: t.dead + dt };
    const spec = TROOPS[t.kind];
    let best = null;
    let bd = Infinity;
    for (const g of targets) {
      const d = apart(t, g, R);
      if (d < bd) {
        bd = d;
        best = g;
      }
    }
    if (!best) return t;
    const toward = add(best.n, t.n, -1);
    const turn = turnToward(t, toward, 4);
    const aimed = Math.abs(bearing(t.n, t.f, toward)) < 0.25;
    const hold = t.hold * METRE;
    // close the gap (a little the other way if they're too close), and step
    // sideways a little while they shoot, so they're not sitting ducks
    const move = bd > hold ? 1 : bd < hold * 0.6 ? -0.6 : 0;
    const strafe = bd <= hold && spec.fire ? Math.sin(t.id * 1.7 + (t.swing += dt) * 0.9) * 0.8 : 0;
    const next = walk(t, { move, strafe, turn, speed: move > 0 ? spec.speed : FOOT.back }, dt, R, obstacles);
    const engaged = Boolean(spec.fire) && bd <= hold * 1.5;
    const aim = clamp((t.aim ?? 0) + (engaged ? dt / 0.25 : -dt / 0.6), 0, 1);
    let cool = t.cool - dt;
    if (cool <= 0 && aimed) {
      if (spec.fire && bd <= hold * 1.4) {
        cool = spec.fire[0] + rand() * (spec.fire[1] - spec.fire[0]);
        const from = add(at(next, R), next.n, spec.tall * 0.62);
        const to = add(at(best, R), best.n, METRE * 1.1);
        const dir = unit(add(add(to, from, -1), [rand() - 0.5, rand() - 0.5, rand() - 0.5], spec.spread * apart(t, best, R)));
        shots.push({ from, dir, owner: 'troop', kind: t.kind, damage: spec.damage, by: t.id, range: len(add(to, from, -1)) });
      } else if (!spec.fire && bd <= spec.range[1] * METRE + FOOT.radius) {
        cool = 1.1;
        hits.push({ target: best.id, damage: spec.damage, from: t.id });
      }
    }
    return { ...next, cool: Math.max(cool, -0.5), swing: t.swing, aim };
  });
  return { troops: out, shots, hits };
}

// ── Bolts ──

// a bolt fired from `from` along `dir` (unit): { p, v, life, owner, damage }
export const bolt = (from, dir, owner, damage = 1, speed = FOOT.bolt) => ({ p: [...from], v: scale(dir, speed), life: FOOT.boltLife, owner, damage });

// how close the segment a→b passes point p
export function pass(a, b, p) {
  const ab = add(b, a, -1);
  const l2 = dot(ab, ab);
  const t = l2 > 0 ? clamp(dot(add(p, a, -1), ab) / l2, 0, 1) : 0;
  return len(add(add(a, ab, t), p, -1));
}

// One step for a bolt: where it goes, and who it hits on the way (the
// first of `people`: [{ id, p (their middle), r }]), or the ground (R:
// it's gone into it). Returns { bolt, hit: id | 'ground' | null }.
export function fly(b, dt, R, people) {
  const p = add(b.p, b.v, dt);
  let hit = null;
  let hd = Infinity;
  for (const o of people) {
    const d = pass(b.p, p, o.p);
    if (d < (o.r ?? FOOT.hit) && d < hd) {
      hd = d;
      hit = o.id;
    }
  }
  if (!hit && len(p) < R) hit = 'ground';
  return { bolt: { ...b, p, life: b.life - dt }, hit };
}

// The nearest of `troops` round w's facing (within `cone` radians either
// side, and `range` along the ground): what a shot goes at
export function aimAt(w, troops, R, { cone = 0.45, range = 30 * METRE } = {}) {
  let best = null;
  let score = Infinity;
  for (const t of troops) {
    if (!t.alive) continue;
    const d = apart(w, t, R);
    if (d > range) continue;
    const b = Math.abs(bearing(w.n, w.f, add(t.n, w.n, -1)));
    if (b > cone) continue;
    const s = d * (1 + b * 2);
    if (s < score) {
      score = s;
      best = t;
    }
  }
  return best;
}
