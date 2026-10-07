// A battle that never ends, as plain numbers (a site's `skirmish`:
// Kashyyyk's beach, the clones and the Wookiees behind the barricades and
// the droid army coming out of the lagoon). Every soldier thinks for
// itself, on a timer of its own:
//
// - it knows of the enemies in range, and sees the ones with a clear line
//   to them (the world's solids, with their heights: a 1.25 m barricade
//   hides a soldier kneeling behind it and lets one standing fire over it);
// - it picks one to fire at: near, hurt, and above all whoever is shooting
//   at it;
// - it runs to cover that's between it and the threat (spots along the
//   low walls, round the rocks and the crates, made once), kneels there,
//   and pops up to fire a burst; it reloads after a magazine, down out of
//   sight;
// - being shot at shakes it (suppression): its aim's worse, it stays down
//   longer, and in the open it goes for cover;
// - clones go round an enemy who won't come out of cover; Wookiees charge
//   what comes close and tear it apart, and pound their chests after a
//   kill; battle droids stop to shoot; super battle droids walk on into
//   the fire, shooting; a hurt soldier falls back, if it isn't brave.
//
// Each kind has its own numbers (UNITS). A soldier goes down the way the
// shot pushed it (the clip: thrown back, pitched forward, blown off its
// feet), and comes back: the side holding the front one at a time at its
// spawn, the side coming at it (a side with a `wave`) together in waves.
// You fight for either (`spec.you`; galaxy/allegiance.js says which): the
// other side shoots at you (three at most at once; the scene's bolts decide
// whether they hit) and your bolts bring them down (hitUnit). Pure and
// seeded, so it's tested; skirmishScene.js draws it.
//
// spec: { sides: { id: { kinds: [[kind, n]…], spawn: { at, spread },
//   respawn (seconds) | wave (seconds between waves) } }, hold (the side
//   that holds the front: the first, if not said), you (your side: the
//   holders, if not said), front: [x, z], field: { min, max } }
//
// newSkirmish(spec, { size, seed, env: { solids, ground, water (its level) } }) → battle
// stepSkirmish(b, dt, you: { x, y, z } | null) → events: shot { id, side,
//   target (an id, or 'you'), hit, at: [x, z], atY }, melee, hurt { id },
//   down { id, clip, push, by }, kill { victim, side, kind, by }, spawn,
//   wave { side, n }, taunt, flank, fallback
// hitUnit(b, id, damage, push: [dx, dz], by = 'you', { blown }) → events
// lineOfSight(solids, a: [x, y, z], b, ground?) → clear?
// coverSpots(solids, field, ground?) → [{ x, z, n: [nx, nz], low, solid, by }]

import { pushOut, turnToward } from './walker';
import { rng } from './noise';

// heights above the ground (metres): the eyes a shot leaves from, the chest it's aimed at
export const EYE = { stand: 1.55, kneel: 0.95 };
export const CHEST = { stand: 1.25, kneel: 0.72 };
export const RULES = {
  step: 0.1, // the longest step the rules take at once
  think: [0.35, 0.7], // seconds between a soldier's looks round
  radius: 0.45, // a soldier's, against what's solid
  spacing: 1.2, // metres between soldiers
  turn: 6, // rad/s
  sight: 1.25, // of its range: how far off it knows of an enemy
  atYouMax: 3, // enemies firing at you at once, at most
  calm: 0.35, // suppression lost a second
  coverReach: 26, // metres: the furthest cover it runs for
  flankers: 1, // of a side going round at once
  hidden: 3, // seconds its target's been out of sight before a clone goes round
  yours: 45, // hp a point of your weapon's damage takes off
  corpse: 3, // seconds down before a droid can come back in a wave
};
// how many soldiers, by the device's tier (lib/device): shares of the site's numbers
export const SIZE = { high: 1, mid: 0.75, low: 0.5 };

// A kind's numbers: hp; range (m); burst (shots, [least, most]); rate
// (shots a second in a burst); pause (seconds between bursts); mag; reload
// (seconds); acc (chance to hit, point blank and at the edge of range);
// damage; cover (how likely it is to go for cover); bravery (how likely it
// is to hold on when hurt, and to charge); speed (running, m/s); walk;
// and its habits: flank (clones: the chance a look round sends it round a
// hidden target), charge (Wookiees: metres within which it charges), melee
// ({ reach, every, damage }), taunt (seconds of chest-pounding after a
// kill), stopToShoot (B1s), advanceFiring (B2s), stand (metres short of
// its target a B2 stops)
export const UNITS = {
  clone: { hp: 100, range: 52, burst: [3, 5], rate: 6, pause: [0.8, 1.6], mag: 30, reload: 2.2, acc: [0.5, 0.1], damage: 20, cover: 0.85, bravery: 0.7, speed: 4.2, walk: 1.6, flank: 0.35 },
  wookiee: { hp: 170, range: 34, burst: [1, 2], rate: 1.6, pause: [0.6, 1.2], mag: 8, reload: 2.4, acc: [0.6, 0.18], damage: 48, cover: 0.4, bravery: 0.95, speed: 4.8, walk: 1.5, charge: 15, melee: { reach: 2.1, every: 1.1, damage: 70 }, taunt: 2.4 },
  battledroid: { hp: 40, range: 46, burst: [2, 3], rate: 4, pause: [1.0, 2.0], mag: 20, reload: 2.8, acc: [0.42, 0.08], damage: 14, cover: 0.25, bravery: 0.5, speed: 2.8, walk: 1.4, stopToShoot: true },
  // the Empire's troopers and the Rebellion's: soldiers like the clones, a
  // little less sure of their aim, the troopers slower to go to ground
  hothtrooper: { hp: 100, range: 50, burst: [2, 4], rate: 5, pause: [0.8, 1.6], mag: 25, reload: 2.4, acc: [0.48, 0.1], damage: 20, cover: 0.9, bravery: 0.65, speed: 4.0, walk: 1.5, flank: 0.25 },
  snowtrooper: { hp: 100, range: 50, burst: [3, 5], rate: 6, pause: [0.9, 1.7], mag: 30, reload: 2.4, acc: [0.44, 0.09], damage: 20, cover: 0.55, bravery: 0.75, speed: 3.6, walk: 1.5, flank: 0.2 },
  stormtrooper: { hp: 100, range: 50, burst: [3, 5], rate: 6, pause: [0.9, 1.7], mag: 30, reload: 2.4, acc: [0.42, 0.08], damage: 20, cover: 0.55, bravery: 0.75, speed: 3.8, walk: 1.5, flank: 0.2 },
  deathtrooper: { hp: 140, range: 54, burst: [3, 4], rate: 5, pause: [0.7, 1.3], mag: 30, reload: 2.0, acc: [0.6, 0.18], damage: 24, cover: 0.7, bravery: 0.95, speed: 4.0, walk: 1.6, flank: 0.4 },
  superdroid: { hp: 170, range: 38, burst: [4, 6], rate: 5, pause: [0.8, 1.4], mag: 40, reload: 2.0, acc: [0.4, 0.1], damage: 16, cover: 0, bravery: 1, speed: 1.7, walk: 1.7, advanceFiring: true, stand: 10 },
};
const unitOf = (kind) => UNITS[kind] ?? UNITS.clone;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const between = (r, [a, b]) => a + (b - a) * r();
const count = (r, [a, b]) => a + Math.floor(r() * (b - a + 1));

// ── Seeing ──

// where a segment from a (2D, along d) crosses a circle: [t0, t1] in 0…1, or null
function segCircle(ax, az, dx, dz, s) {
  const fx = ax - s.x;
  const fz = az - s.z;
  const A = dx * dx + dz * dz;
  const B = 2 * (fx * dx + fz * dz);
  const C = fx * fx + fz * fz - s.r * s.r;
  const D = B * B - 4 * A * C;
  if (D < 0) return null;
  const q = Math.sqrt(D);
  const t0 = (-B - q) / (2 * A);
  const t1 = (-B + q) / (2 * A);
  if (t1 < 0 || t0 > 1) return null;
  return [Math.max(0, t0), Math.min(1, t1)];
}
// and a box turned about the vertical (into its frame, as pushOut does)
function segBox(ax, az, dx, dz, s) {
  const px = ax - s.x;
  const pz = az - s.z;
  const l = [px * s.c - pz * s.s, px * s.s + pz * s.c];
  const v = [dx * s.c - dz * s.s, dx * s.s + dz * s.c];
  const h = [s.hw, s.hd];
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 2; i++) {
    if (Math.abs(v[i]) < 1e-9) {
      if (Math.abs(l[i]) > h[i]) return null;
      continue;
    }
    let a = (-h[i] - l[i]) / v[i];
    let b = (h[i] - l[i]) / v[i];
    if (a > b) [a, b] = [b, a];
    lo = Math.max(lo, a);
    hi = Math.min(hi, b);
    if (lo > hi) return null;
  }
  return [lo, hi];
}

// Whether a line from a to b ([x, y, z], heights in the world's) is clear
// of what's solid (anything that stands lower than the line where it
// crosses lets it by; a floor overhead or a gate that's up doesn't stop
// it) and, given `ground(x, z)`, of the ground.
export function lineOfSight(solids, a, b, ground = null) {
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dz);
  if (len < 1e-6) return true;
  for (const s of solids.near((a[0] + b[0]) / 2, (a[2] + b[2]) / 2, len / 2 + 2)) {
    if (s.off || s.base != null) continue;
    const span = s.type === 'circle' ? segCircle(a[0], a[2], dx, dz, s) : segBox(a[0], a[2], dx, dz, s);
    if (!span) continue;
    if (s.top == null) return false;
    const y0 = a[1] + (b[1] - a[1]) * span[0];
    const y1 = a[1] + (b[1] - a[1]) * span[1];
    if (Math.min(y0, y1) < s.top) return false;
  }
  if (ground) {
    const n = Math.max(2, Math.ceil(len / 6));
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (ground(a[0] + dx * t, a[2] + dz * t) + 0.1 > a[1] + (b[1] - a[1]) * t) return false;
    }
  }
  return true;
}

// ── Cover ──

// Spots to take cover at, from the solids on the field: along both faces
// of a wall or a crate (every 1.7 m), round a rock or a trunk; `n` points
// out from what it's behind, `low` where a soldier has to kneel to be hidden
// (it stands to fire over it). Too low to hide behind, it's no cover.
export function coverSpots(solids, { min, max }, ground = null) {
  const g = ground ?? (() => 0);
  const spots = [];
  const inField = (x, z) => x >= min[0] && x <= max[0] && z >= min[1] && z <= max[1];
  const free = (x, z, own) => {
    for (const s of solids.near(x, z, 2)) if (s !== own && pushOut(s, x, z, RULES.radius)) return false;
    return true;
  };
  const add = (s, x, z, nx, nz, low) => {
    if (inField(x, z) && free(x, z, s)) spots.push({ x, z, n: [nx, nz], low, solid: s, by: null });
  };
  for (const s of [...solids.all]) {
    if (s.off || s.base != null) continue;
    if (s.x < min[0] - 3 || s.x > max[0] + 3 || s.z < min[1] - 3 || s.z > max[1] + 3) continue;
    const h = s.top == null ? Infinity : s.top - g(s.x, s.z);
    if (h < 0.95) continue;
    const low = h < 1.9;
    if (s.type === 'circle') {
      const n = clamp(Math.round((2 * Math.PI * (s.r + 0.6)) / 2.4), 5, 14);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        add(s, s.x + Math.cos(a) * (s.r + 0.6), s.z + Math.sin(a) * (s.r + 0.6), Math.cos(a), Math.sin(a), low);
      }
    } else {
      // (the box's own x along (c, −s), its z along (s, c): as pushOut has it)
      const ax = [s.c, -s.s];
      const az = [s.s, s.c];
      const [along, normal, half, off] = s.hw >= s.hd ? [ax, az, s.hw, s.hd] : [az, ax, s.hd, s.hw];
      const n = Math.max(1, Math.floor((2 * half) / 1.7));
      for (const side of [-1, 1])
        for (let i = 0; i < n; i++) {
          const u = -half + ((i + 0.5) * 2 * half) / n;
          const o = off + 0.65;
          add(s, s.x + along[0] * u + normal[0] * o * side, s.z + along[1] * u + normal[1] * o * side, normal[0] * side, normal[1] * side, low);
        }
    }
  }
  return spots;
}

// ── The battle ──

function makeUnit(id, side, kind) {
  const u = unitOf(kind);
  return { id, side, kind, u, x: 0, z: 0, yaw: 0, hp: u.hp, up: false, down: 0, mode: 'hold', dest: null, spot: null, atSpot: false, coverAt: 0, stance: 'stand', target: null, seen: false, hiddenFor: 0, hiddenSince: null, threat: null, suppress: 0, think: 0, cool: 0, burst: 0, ammo: u.mag, reloading: 0, pop: 0, duck: false, move: 0, running: false, aim: false, swing: 0, taunt: 0, fled: false, flankAt: 0, holdUntil: 0, brave: null, hold: false, detour: 0, stuck: 0 };
}

// how far a point is past the front, toward the droids' side (negative: behind it)
const progress = (b, x, z) => (x - b.spec.front[0]) * b.axis[0] + (z - b.spec.front[1]) * b.axis[1];
const groundOf = (b, x, z) => b.env.ground?.(x, z) ?? 0;
const eyeOf = (b, u, stance = 'stand') => [u.x, groundOf(b, u.x, u.z) + EYE[stance], u.z];
const chestOf = (b, o) => (o.id === 'you' ? [o.x, (o.y ?? groundOf(b, o.x, o.z)) + 1.1, o.z] : [o.x, groundOf(b, o.x, o.z) + CHEST[o.stance], o.z]);
const sees = (b, from, to) => lineOfSight(b.env.solids, from, to, b.env.ground ?? null);
// still wading in, the water over its chest: it can't see out, or shoot
const under = (b, u) => b.env.water != null && groundOf(b, u.x, u.z) + CHEST.stand < b.env.water;
const release = (u) => {
  if (u.spot?.by === u) u.spot.by = null;
  u.spot = null;
  u.atSpot = false;
};
const claim = (u, s) => {
  if (u.spot === s) return;
  release(u);
  s.by = u;
  u.spot = s;
  u.dest = [s.x, s.z];
};
const inField = (b, x, z) => {
  const { min, max } = b.spec.field;
  return [clamp(x, min[0], max[0]), clamp(z, min[1], max[1])];
};

// where a side comes onto the field: round its spawn (the side holding the
// front, the first time, along the cover there, facing the other)
function spawn(b, u, first = false) {
  const sp = b.spec.sides[u.side].spawn;
  const r = b.r;
  const a = r() * Math.PI * 2;
  const d = Math.sqrt(r()) * (sp.spread ?? 4);
  [u.x, u.z] = inField(b, sp.at[0] + Math.cos(a) * d, sp.at[1] + Math.sin(a) * d);
  Object.assign(u, { hp: u.u.hp, up: true, down: 0, mode: 'hold', dest: null, stance: 'stand', target: null, seen: false, hiddenFor: 0, hiddenSince: null, threat: null, suppress: 0, think: r() * 0.5, cool: 0.5 + r(), burst: 0, ammo: u.u.mag, reloading: 0, pop: 0, duck: false, move: 0, aim: false, swing: 0, taunt: 0, fled: false, holdUntil: 0 });
  release(u);
  if (first && u.side !== b.spec.hold) u.mode = 'advance';
  if (first && u.side === b.spec.hold) {
    // (behind the barricades, each at a spot of its own)
    const free = b.spots.filter((s) => !s.by && progress(b, s.x, s.z) < 0 && progress(b, s.x, s.z) > -10).sort((p, q) => dist(p.x, p.z, b.spec.front[0], b.spec.front[1]) - dist(q.x, q.z, b.spec.front[0], b.spec.front[1]));
    const s = free[Math.floor(r() * Math.min(free.length, 6))];
    if (s) {
      claim(u, s);
      u.x = s.x;
      u.z = s.z;
      u.dest = null;
      u.atSpot = true;
      u.mode = 'cover';
    }
  }
  // (each facing the other side)
  u.yaw = u.side === b.spec.hold ? Math.atan2(b.axis[0], b.axis[1]) : Math.atan2(-b.axis[0], -b.axis[1]);
}

export function newSkirmish(spec, { size = 1, seed = 1, env = {} } = {}) {
  const r = rng(seed);
  const units = [];
  // (the side that holds the front, and the one that comes at it; you fight for `you`, either)
  const [first, second] = Object.keys(spec.sides);
  const hold = spec.hold ?? first;
  const comes = hold === first ? second : first;
  for (const side of [hold, comes])
    for (const [kind, n] of spec.sides[side].kinds) {
      const c = Math.max(1, Math.round(n * size));
      for (let i = 0; i < c; i++) units.push(makeUnit(units.length, side, kind));
    }
  const solids = env.solids ?? { all: [], near: () => [] };
  const rs = spec.sides[hold].spawn.at;
  const ss = spec.sides[comes].spawn.at;
  const l = dist(rs[0], rs[1], ss[0], ss[1]) || 1;
  const b = {
    spec: { ...spec, hold, comes, you: spec.you ?? hold },
    r,
    t: 0,
    units,
    env: { solids, ground: env.ground ?? null, water: env.water ?? null },
    spots: coverSpots(solids, spec.field, env.ground ?? null),
    axis: [(ss[0] - rs[0]) / l, (ss[1] - rs[1]) / l], // from the Republic's side toward the droids'
    waveIn: spec.sides[comes].wave ?? 15,
    you: { kills: 0, on: false, x: 0, z: 0, y: 0 },
    kills: {},
  };
  for (const u of units) spawn(b, u, true);
  return b;
}

// put a soldier somewhere (a scene setting one down, or a test)
export function placeUnit(b, id, x, z, yaw = 0) {
  const u = b.units[id];
  if (!u) return;
  release(u);
  Object.assign(u, { x, z, yaw, dest: null, up: true, mode: 'hold', think: 0 });
}

// A shot's chance: the kind's aim at the distance, worse shaken or on the
// move, against someone down behind something or running
export function hitChance(s, d, t) {
  const U = s.u;
  let p = U.acc[0] + (U.acc[1] - U.acc[0]) * Math.min(1, d / U.range);
  p *= 1 - 0.5 * (s.suppress ?? 0);
  if ((s.move ?? 0) > 0.1) p *= U.advanceFiring ? 0.85 : 0.6;
  if (t.stance === 'kneel') p *= 0.6;
  if ((t.move ?? 0) > 0.5) p *= 0.8;
  return clamp(p, 0.02, 0.95);
}

// damage to a soldier: a flinch, or down (the way it was pushed) and a kill
function damage(b, T, amount, push, by, out, { blown = false } = {}) {
  if (!T.up) return;
  T.hp -= amount;
  if (T.hp > 0) {
    out.push({ type: 'hurt', id: T.id });
    return;
  }
  T.up = false;
  T.down = 0;
  T.dest = null;
  T.target = null;
  T.aim = false;
  T.move = 0;
  release(T);
  const l = Math.hypot(push[0], push[1]) || 1;
  const along = (push[0] / l) * Math.sin(T.yaw) + (push[1] / l) * Math.cos(T.yaw);
  const clip = blown ? 'dieBlown' : along > 0.3 ? 'dieFwd' : 'die';
  const who = by === 'you' ? 'you' : by.id;
  out.push({ type: 'down', id: T.id, clip, push: [push[0] / l, push[1] / l], by: who });
  out.push({ type: 'kill', victim: T.id, side: T.side, kind: T.kind, by: who });
  if (by === 'you') b.you.kills += 1;
  else {
    b.kills[by.side] = (b.kills[by.side] ?? 0) + 1;
    // a Wookiee who's brought one down lets the whole beach know
    if (by.u.taunt && by.up) {
      by.mode = 'taunt';
      by.taunt = by.u.taunt;
      by.dest = null;
      by.aim = false;
      out.push({ type: 'taunt', id: by.id });
    }
  }
}

// One of your bolts lands: `damage` hp (RULES.yours a point of your
// weapon's), pushed along `push`; returns what happened
export function hitUnit(b, id, amount, push = [0, 1], by = 'you', opts = {}) {
  const out = [];
  const T = b.units[id];
  if (!T?.up) return out;
  T.suppress = Math.min(1, T.suppress + 0.3);
  if (by === 'you') {
    T.threat = { id: 'you', x: b.you.x, z: b.you.z, t: b.t };
    T.think = Math.min(T.think, 0.15);
  }
  damage(b, T, amount, push, by, out, opts);
  return out;
}

// ── Thinking ──

const YOU = { id: 'you', stance: 'stand', move: 0 };
// the threat's place: who shot at it lately, else its target, else the enemy's side of the field
function threatAt(b, u) {
  if (u.threat && b.t - u.threat.t < 6) return [u.threat.x, u.threat.z];
  const T = targetOf(b, u);
  if (T) return [T.x, T.z];
  const s = u.side === b.spec.hold ? 1 : -1;
  return [u.x + b.axis[0] * 30 * s, u.z + b.axis[1] * 30 * s];
}
function targetOf(b, u) {
  if (u.target === 'you') return b.you.on ? { ...YOU, x: b.you.x, z: b.you.z, y: b.you.y } : null;
  if (u.target == null) return null;
  const T = b.units[u.target];
  return T?.up ? T : null;
}
// whether a spot hides a soldier from a threat at `from` (kneeling, if it's low cover)
const protects = (b, s, from) => !sees(b, [from[0], groundOf(b, from[0], from[1]) + EYE.stand, from[1]], [s.x, groundOf(b, s.x, s.z) + (s.low ? CHEST.kneel : CHEST.stand), s.z]);

// The cover to run for: near, between it and the threat, where its side
// wants to be (the Republic at the barricades, not out past them; the
// droids further on, not back), or (falling back) away from the threat
function chooseCover(b, u, from, { back = false } = {}) {
  let best = null;
  let bestS = Infinity;
  const here = progress(b, u.x, u.z);
  const mine = u.side === b.spec.hold;
  const away = dist(u.x, u.z, from[0], from[1]);
  for (const s of b.spots) {
    if (s.by && s.by !== u) continue;
    const d = dist(u.x, u.z, s.x, s.z);
    if (d > RULES.coverReach) continue;
    // (the threat has to be on the far side of what it's behind)
    if ((from[0] - s.x) * s.n[0] + (from[1] - s.z) * s.n[1] > 0) continue;
    const p = progress(b, s.x, s.z);
    let score = d;
    if (back) {
      if (dist(s.x, s.z, from[0], from[1]) < away + 6) continue;
      score -= dist(s.x, s.z, from[0], from[1]) * 0.5;
    } else if (mine) score += Math.max(0, p + 1) * 4 + Math.max(0, -p - 14) * 1.5;
    else score += Math.max(0, p - here + 2) * 2;
    if (score >= bestS) continue;
    if (!protects(b, s, from)) continue;
    best = s;
    bestS = score;
  }
  return best;
}

// Round a target that's hidden behind something: a spot off to its side,
// clear of the solids, from which it can be seen down where it is
function flankPoint(b, u, T) {
  const tx = u.x - T.x;
  const tz = u.z - T.z;
  const l = Math.hypot(tx, tz) || 1;
  const first = b.r() < 0.5 ? 1 : -1;
  const chest = chestOf(b, T);
  for (const sg of [first, -first])
    for (const ang of [1.6, 1.35, 1.9, 1.05])
      for (const R of [14, 18, 10]) {
        const c = Math.cos(ang * sg);
        const sn = Math.sin(ang * sg);
        const dx = ((tx * c - tz * sn) / l) * R;
        const dz = ((tx * sn + tz * c) / l) * R;
        const [x, z] = inField(b, T.x + dx, T.z + dz);
        if (dist(x, z, T.x, T.z) < R * 0.7) continue;
        let blocked = false;
        for (const s of b.env.solids.near(x, z, 2)) if (pushOut(s, x, z, RULES.radius + 0.1)) blocked = true;
        if (blocked) continue;
        if (sees(b, [x, groundOf(b, x, z) + EYE.stand, z], chest)) return [x, z];
      }
  return null;
}

// a point further on toward the front (the droids' way in), a little to one side
function onward(b, u, metres) {
  const s = u.side === b.spec.hold ? 1 : -1;
  const side = (b.r() - 0.5) * metres * 0.6;
  return inField(b, u.x + b.axis[0] * metres * s - b.axis[1] * side, u.z + b.axis[1] * metres * s + b.axis[0] * side);
}

function think(b, u, onYou, out) {
  const U = u.u;
  if (under(b, u)) {
    // (on out of the water, toward the front)
    u.target = null;
    u.seen = false;
    if (!u.hold && !u.dest) {
      u.mode = 'advance';
      u.dest = onward(b, u, 8);
    }
    return;
  }
  // ── who's out there: everyone in range it knows of, and which it can see ──
  const eye = eyeOf(b, u);
  let best = null;
  let bestS = Infinity;
  let bestSeen = false;
  const consider = (o, d) => {
    const seen = sees(b, eye, chestOf(b, o));
    let s = d / U.range + 0.6 * (o.id === 'you' ? 0.8 : o.hp / o.u.hp);
    if (!seen) s += 1;
    if (u.threat && u.threat.id === o.id && b.t - u.threat.t < 4) s -= 0.6;
    if (u.target === o.id) s -= 0.2;
    if (o.stance === 'kneel') s += 0.3;
    if (s < bestS) {
      best = o;
      bestS = s;
      bestSeen = seen;
    }
  };
  for (const o of b.units) {
    if (!o.up || o.side === u.side) continue;
    const d = dist(u.x, u.z, o.x, o.z);
    if (d < U.range * RULES.sight) consider(o, d);
  }
  if (b.you.on && u.side !== b.spec.you && (u.target === 'you' || onYou < RULES.atYouMax)) {
    const d = dist(u.x, u.z, b.you.x, b.you.z);
    if (d < U.range * RULES.sight) consider({ ...YOU, x: b.you.x, z: b.you.z, y: b.you.y, hp: 100, u: { hp: 100 } }, d);
  }
  const had = u.target;
  u.target = best ? best.id : null;
  u.seen = bestSeen;
  // (how long the one it's after has been out of sight)
  if (u.target !== had || !best || bestSeen) u.hiddenSince = best && !bestSeen ? b.t : null;
  u.hiddenFor = u.hiddenSince == null ? 0 : b.t - u.hiddenSince;
  if (u.hold) return;

  // ── what to do about it ──
  const T = targetOf(b, u);
  const d = T ? dist(u.x, u.z, T.x, T.z) : Infinity;
  const mine = u.side === b.spec.hold;
  const brave = u.brave ?? U.bravery;
  if (u.mode === 'taunt' && u.taunt > 0) return;
  if (u.mode === 'charge' && T && T.id !== 'you' && d < U.charge * 1.6) return;
  // (going round, and then a while firing from there, while the one it went round for is still about)
  if (u.mode === 'flank' && T && T.id !== 'you' && b.t - u.flankAt < (u.dest ? 12 : 16)) return;
  if (u.mode === 'fallback' && u.dest) return;
  const threatened = u.suppress > 0.35 || (u.threat && b.t - u.threat.t < 3);
  // hurt: back out of it, unless it's brave
  if (u.hp < U.hp * 0.35 && !u.fled && (threatened || T) && b.r() > brave) {
    u.fled = true;
    const from = threatAt(b, u);
    const s = U.cover > 0 ? chooseCover(b, u, from, { back: true }) : null;
    if (s) claim(u, s);
    else {
      release(u);
      const ax = u.x - from[0];
      const az = u.z - from[1];
      const l = Math.hypot(ax, az) || 1;
      u.dest = inField(b, u.x + (ax / l) * 12, u.z + (az / l) * 12);
    }
    u.mode = 'fallback';
    out.push({ type: 'fallback', id: u.id });
    return;
  }
  // a Wookiee: at whatever's come close
  if (U.charge && T && T.id !== 'you' && d < U.charge && b.r() < brave + 0.05) {
    release(u);
    u.mode = 'charge';
    u.dest = [T.x, T.z];
    return;
  }
  // a super battle droid: on at it, shooting
  if (U.advanceFiring) {
    release(u);
    u.mode = 'advance';
    if (T && d > U.stand) {
      const k = (d - U.stand) / d;
      u.dest = inField(b, u.x + (T.x - u.x) * k, u.z + (T.z - u.z) * k);
    } else if (!T) u.dest = onward(b, u, 10);
    else u.dest = null;
    return;
  }
  // a clone: round a target that's kept out of sight
  if (U.flank && T && T.id !== 'you' && !u.seen && u.hiddenFor >= RULES.hidden && b.r() < U.flank && b.units.filter((o) => o.up && o.side === u.side && o.mode === 'flank').length < RULES.flankers) {
    const p = flankPoint(b, u, T);
    if (p) {
      release(u);
      u.mode = 'flank';
      u.flankAt = b.t;
      u.dest = p;
      out.push({ type: 'flank', id: u.id, target: T.id });
      return;
    }
  }
  // in cover that still hides it: it stays (a droid, only while it's
  // pinned there; then on toward the barricades)
  const pinned = mine || u.suppress > 0.3 || b.t - (u.coverAt ?? 0) < 6 + (u.id % 5);
  if (u.spot && (u.atSpot || u.dest) && pinned && protects(b, u.spot, threatAt(b, u))) {
    u.mode = 'cover';
    return;
  }
  // a battle droid: in bounds, stopping to shoot a while after each
  if (U.stopToShoot) {
    if (u.mode === 'hold' && u.holdUntil > b.t) return;
    if (u.mode === 'advance' && u.dest) return;
    if (T && u.seen && d < U.range && u.mode !== 'hold') {
      release(u);
      u.mode = 'hold';
      u.dest = null;
      u.holdUntil = b.t + 2.5 + b.r() * 3;
      return;
    }
    if (progress(b, u.x, u.z) > 2) {
      const s = b.r() < U.cover ? chooseCover(b, u, threatAt(b, u)) : null;
      if (s && progress(b, s.x, s.z) < progress(b, u.x, u.z) - 2) {
        claim(u, s);
        u.coverAt = b.t;
        u.mode = 'cover';
      } else {
        release(u);
        u.mode = 'advance';
        u.dest = onward(b, u, 5 + b.r() * 5);
      }
      return;
    }
    u.mode = 'hold';
    u.holdUntil = b.t + 3;
    return;
  }
  // into cover, under fire or with an enemy about
  if (U.cover > 0 && (threatened || T) && b.r() < U.cover + (threatened ? 0.15 : 0)) {
    const s = chooseCover(b, u, threatAt(b, u));
    if (s) {
      u.mode = 'cover';
      if (u.spot !== s) u.coverAt = b.t;
      claim(u, s);
      if (dist(u.x, u.z, s.x, s.z) < 0.4) {
        u.dest = null;
        u.atSpot = true;
      }
      return;
    }
  }
  if (mine) {
    // the Republic holds the barricades: back to them if it's strayed
    if (progress(b, u.x, u.z) > 2 && u.mode !== 'charge') {
      release(u);
      u.mode = 'hold';
      u.dest = inField(b, u.x - b.axis[0] * 8, u.z - b.axis[1] * 8);
    } else if (!T && !u.spot) {
      const s = chooseCover(b, u, threatAt(b, u));
      if (s) {
        u.mode = 'cover';
        claim(u, s);
      }
    } else if (u.mode !== 'cover') u.mode = 'hold';
    return;
  }
  // the droids come on toward the barricades in bounds, till they're at them
  if (progress(b, u.x, u.z) > 3 && (!T || !u.seen || d > U.range * 0.8)) {
    release(u);
    u.mode = 'advance';
    u.dest = onward(b, u, 6 + b.r() * 6);
    return;
  }
  u.mode = 'hold';
}

// ── Acting: moving, kneeling, shooting ──

function move(b, u, h, speed) {
  const [tx, tz] = u.dest;
  const d = dist(u.x, u.z, tx, tz);
  if (d < 0.4) {
    u.dest = null;
    u.move = 0;
    if (u.spot && dist(u.x, u.z, u.spot.x, u.spot.z) < 0.6) u.atSpot = true;
    if (u.mode === 'fallback' || u.mode === 'advance') u.think = Math.min(u.think, 0.1);
    return;
  }
  const step = Math.min(d, speed * h);
  let nx = u.x + ((tx - u.x) / d) * step;
  let nz = u.z + ((tz - u.z) / d) * step;
  // round what's solid: pushed out of it, and along its face while it's in the way
  let px = 0;
  let pz = 0;
  const settle = () => {
    for (const s of b.env.solids.near(nx, nz, 2)) {
      const p = pushOut(s, nx, nz, RULES.radius);
      if (!p) continue;
      nx += p[0];
      nz += p[1];
      px += p[0];
      pz += p[1];
    }
  };
  settle();
  const pl = Math.hypot(px, pz);
  if (pl > 1e-6) {
    // (along its face, the way that's nearer where it's going)
    if (!u.detour) u.detour = Math.sign(-pz * (tx - u.x) + px * (tz - u.z)) || (b.r() < 0.5 ? 1 : -1);
    u.stuck += h;
    if (u.stuck > 6) {
      u.detour = -u.detour;
      u.stuck = 0;
    }
    nx += (-pz / pl) * step * u.detour;
    nz += (px / pl) * step * u.detour;
    settle();
  } else {
    u.detour = 0;
    u.stuck = 0;
  }
  // not into each other
  for (const o of b.units) {
    if (o === u || !o.up) continue;
    const dd = dist(nx, nz, o.x, o.z);
    if (dd < RULES.spacing && dd > 1e-6) {
      const k = ((RULES.spacing - dd) / dd) * 0.5;
      nx += (nx - o.x) * k;
      nz += (nz - o.z) * k;
    }
  }
  [nx, nz] = inField(b, nx, nz);
  const moved = dist(u.x, u.z, nx, nz);
  u.x = nx;
  u.z = nz;
  u.move = clamp(moved / h / u.u.speed, 0, 1);
  if (u.atSpot && u.spot && dist(u.x, u.z, u.spot.x, u.spot.z) > 0.6) u.atSpot = false;
}

function act(b, u, h, onYou, out) {
  const U = u.u;
  const T = targetOf(b, u);
  const d = T ? dist(u.x, u.z, T.x, T.z) : Infinity;
  // ── a Wookiee pounding his chest ──
  if (u.mode === 'taunt') {
    u.taunt -= h;
    u.move = 0;
    if (u.taunt <= 0) {
      u.mode = 'hold';
      u.think = 0;
    }
    return;
  }
  // ── a charge: on at it, and a swing when it's in reach ──
  if (u.mode === 'charge') {
    if (!T || T.id === 'you') {
      u.mode = 'hold';
      u.dest = null;
    } else if (d < U.melee.reach) {
      u.dest = null;
      u.move = 0;
      u.yaw = turnToward(u.yaw, Math.atan2(T.x - u.x, T.z - u.z), RULES.turn * h);
      u.swing -= h;
      if (u.swing <= 0) {
        u.swing = U.melee.every;
        out.push({ type: 'melee', id: u.id, target: T.id });
        damage(b, T, U.melee.damage, [T.x - u.x, T.z - u.z], u, out, { blown: true }); // (a Wookiee throws them)
      }
      return;
    } else {
      u.dest = [T.x, T.z];
      u.swing = Math.min(u.swing, 0.35);
    }
  }
  // ── moving ──
  const running = u.mode === 'cover' || u.mode === 'fallback' || u.mode === 'flank' || u.mode === 'charge' || (u.mode === 'hold' && u.dest);
  u.running = Boolean(running && u.dest);
  if (u.dest && !u.hold && !(U.stopToShoot && u.burst > 0)) {
    u.stance = 'stand';
    move(b, u, h, running ? U.speed : U.walk);
  } else u.move = 0;
  // ── facing: its target while it's shooting or still, else where it's going ──
  let want = u.yaw;
  if (T && (u.move < 0.5 || U.advanceFiring)) want = Math.atan2(T.x - u.x, T.z - u.z);
  else if (u.dest) want = Math.atan2(u.dest[0] - u.x, u.dest[1] - u.z);
  u.yaw = turnToward(u.yaw, want, RULES.turn * h);
  // ── the magazine ──
  if (u.reloading > 0) {
    u.reloading -= h;
    if (u.reloading <= 0) u.ammo = U.mag;
  }
  u.cool -= h;
  // ── down behind cover, and up to fire ──
  const low = u.atSpot && u.spot?.low && !u.dest;
  if (low) {
    if (u.stance === 'kneel') {
      u.pop -= h;
      if (u.pop <= 0 && u.reloading <= 0 && T && u.suppress < 0.85) {
        u.stance = 'stand';
        u.cool = Math.max(u.cool, 0.25); // (the gun coming up)
      }
    } else if (u.duck || u.reloading > 0 || !T || u.suppress >= 0.85) {
      u.stance = 'kneel';
      u.pop = (0.7 + b.r()) * (1 + 1.5 * u.suppress) * (u.hp < U.hp * 0.35 ? 1.6 : 1);
    }
  }
  u.duck = false;
  // ── a shot ──
  const facing = T ? Math.abs(Math.atan2(Math.sin(Math.atan2(T.x - u.x, T.z - u.z) - u.yaw), Math.cos(Math.atan2(T.x - u.x, T.z - u.z) - u.yaw))) < 0.5 : false;
  const steady = !(U.stopToShoot && u.move > 0) && !(u.running && !U.advanceFiring && u.move > 0.3);
  u.aim = Boolean(T && u.stance === 'stand' && u.reloading <= 0 && steady && d < U.range && u.mode !== 'charge' && !under(b, u));
  if (!u.aim || u.cool > 0 || !facing) return;
  if (!sees(b, eyeOf(b, u, u.stance), chestOf(b, T))) {
    // (it can't see it from here: a look round soon)
    u.cool = 0.3;
    u.seen = false;
    u.think = Math.min(u.think, 0.2);
    return;
  }
  u.seen = true;
  if (u.burst <= 0) u.burst = count(b.r, U.burst);
  u.burst -= 1;
  u.ammo -= 1;
  if (u.ammo <= 0) {
    u.reloading = U.reload;
    u.burst = 0;
    u.cool = U.reload;
    u.duck = true;
  } else if (u.burst <= 0) {
    u.cool = between(b.r, U.pause) * (1 + u.suppress);
    u.duck = true;
  } else u.cool = (1 / U.rate) * (0.85 + 0.3 * b.r());
  const atY = T.id === 'you' ? 1.1 : CHEST[T.stance];
  if (T.id === 'you') {
    out.push({ type: 'shot', id: u.id, side: u.side, target: 'you', hit: null, at: [T.x, T.z], atY });
    return;
  }
  const hit = b.r() < hitChance(u, d, T);
  out.push({ type: 'shot', id: u.id, side: u.side, target: T.id, hit, at: [T.x, T.z], atY });
  // the one shot at: shaken, and it knows who it was
  T.suppress = Math.min(1, T.suppress + (hit ? 0.15 : 0.3));
  if (!T.threat || T.threat.id !== u.id || b.t - T.threat.t > 1) T.think = Math.min(T.think, 0.25);
  T.threat = { id: u.id, x: u.x, z: u.z, t: b.t };
  if (hit) damage(b, T, U.damage, [T.x - u.x, T.z - u.z], u, out);
}

function step(b, h, you, out) {
  b.t += h;
  b.you.on = Boolean(you);
  if (you) Object.assign(b.you, { x: you.x, z: you.z, y: you.y ?? null });
  let onYou = 0;
  for (const u of b.units) if (u.up && u.target === 'you') onYou += 1;
  if (!you) for (const u of b.units) if (u.target === 'you') u.target = null;
  for (const u of b.units) {
    if (!u.up) {
      u.down += h;
      // (the Republic comes back one at a time; the droids wait for the next wave)
      if (!b.spec.sides[u.side].wave && u.down >= (b.spec.sides[u.side].respawn ?? 9)) {
        spawn(b, u);
        out.push({ type: 'spawn', id: u.id });
      }
      continue;
    }
    u.suppress = Math.max(0, u.suppress - RULES.calm * h);
    u.think -= h;
    if (u.think <= 0) {
      const was = u.target === 'you';
      think(b, u, onYou, out);
      if (was !== (u.target === 'you')) onYou += was ? -1 : 1;
      u.think = between(b.r, RULES.think);
    }
    act(b, u, h, onYou, out);
  }
  b.waveIn -= h;
  if (b.waveIn <= 0) {
    b.waveIn = b.spec.sides[b.spec.comes].wave ?? 15;
    let n = 0;
    for (const u of b.units)
      if (!u.up && b.spec.sides[u.side].wave && u.down >= RULES.corpse) {
        spawn(b, u);
        u.mode = 'advance';
        out.push({ type: 'spawn', id: u.id });
        n += 1;
      }
    if (n) out.push({ type: 'wave', side: b.spec.comes, n });
  }
}

// The battle moved on by dt seconds (in steps of RULES.step at most), with
// you at `you` ({ x, y, z }: your feet; null while you're not on the field)
export function stepSkirmish(b, dt, you = null) {
  const out = [];
  const n = Math.max(1, Math.ceil(dt / RULES.step - 1e-9));
  for (let i = 0; i < n; i++) step(b, dt / n, you, out);
  return out;
}

// how it stands, for the page
export function skirmishView(b) {
  const up = { rep: 0, sep: 0 };
  for (const u of b.units) if (u.up) up[u.side] += 1;
  return { t: b.t, up, kills: b.you.kills, wave: Math.max(0, b.waveIn), atYou: b.units.filter((u) => u.up && u.target === 'you').length };
}
