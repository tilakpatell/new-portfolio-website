// Lothlórien's games, as rules with no drawing, so they can be tested:
// following Haldir through the wood, the Mirror's pull, Galadriel's gifts
// handed out, and the boats down the Anduin to the Argonath.
// ./LorienWorld.jsx steps them; ./scene.js draws them.

export function seeded(seed = 1) {
  let s = seed % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── Haldir leads ──
// He walks the path ahead of you while you keep up, and stops and waits
// when you fall behind.
export const LEADS = { speed: 2.1, near: 6, wait: 10 };

export function newLead(path) {
  const [x, z] = path[0];
  return { i: 1, x, z, face: 0, state: 'on', waiting: false, moving: false };
}
// One step. `hero` is { x, z }. Events: 'wait' when you've fallen behind,
// 'go' when you've caught up, 'there' at the end.
export function stepLead(l, dt, hero, path) {
  const ev = [];
  if (l.state !== 'on') return ev;
  const gap = Math.hypot(hero.x - l.x, hero.z - l.z);
  if (!l.waiting && gap > LEADS.wait) {
    l.waiting = true;
    ev.push({ type: 'wait' });
  } else if (l.waiting && gap < LEADS.near) {
    l.waiting = false;
    ev.push({ type: 'go' });
  }
  l.moving = !l.waiting;
  if (l.waiting) {
    // he turns to look for you
    l.face = Math.atan2(-(hero.z - l.z), hero.x - l.x);
    return ev;
  }
  let step = LEADS.speed * dt;
  while (step > 0 && l.i < path.length) {
    const [tx, tz] = path[l.i];
    const d = Math.hypot(tx - l.x, tz - l.z);
    l.face = Math.atan2(-(tz - l.z), tx - l.x);
    if (d <= step) {
      l.x = tx;
      l.z = tz;
      step -= d;
      l.i += 1;
    } else {
      l.x += ((tx - l.x) / d) * step;
      l.z += ((tz - l.z) / d) * step;
      step = 0;
    }
  }
  if (l.i >= path.length) {
    l.state = 'there';
    l.moving = false;
    ev.push({ type: 'there' });
  }
  return ev;
}

// ── The Mirror ──
// The Ring pulls you towards the water. Every so often the Eye looks for
// you (with a moment's warning): hold back then, or the pull grows fast.
// Holding back costs strength, and it comes back while you rest (spend it
// all, and it has to come back some way before you can hold again). Get
// through the vision without the pull reaching the water.
export const MIRROR_PULL = { length: 15, first: 1.6, every: 3.3, jitter: 0.5, warn: 0.8, look: 1.4, rise: 0.5, idle: 0.02, fall: 0.06, tire: 0.45, rest: 0.34, again: 0.6 };

export function newPull(seed = 5) {
  const rand = seeded(seed);
  return { t: 0, pull: 0, strength: 1, spent: false, next: MIRROR_PULL.first, looking: 0, warned: false, state: 'on', rand, holding: false };
}
// is the Eye looking now, or about to?
export const eyeOn = (p) => p.looking > 0;
export const eyeSoon = (p) => !eyeOn(p) && p.next - p.t <= MIRROR_PULL.warn;

// One step; `hold` true while holding back. Events: 'warn' (the Eye's
// about to look), 'look', 'away', 'touched' (the pull reached the water),
// 'done' (through the vision).
export function stepPull(p, dt, hold) {
  const ev = [];
  if (p.state !== 'on') return ev;
  const M = MIRROR_PULL;
  p.t += dt;
  if (!p.warned && !eyeOn(p) && p.next - p.t <= M.warn) {
    p.warned = true;
    ev.push({ type: 'warn' });
  }
  if (!eyeOn(p) && p.t >= p.next) {
    p.looking = M.look;
    ev.push({ type: 'look' });
  }
  // run out of strength and you can't hold back till you've got some back
  if (p.spent && p.strength >= M.again) p.spent = false;
  const resisting = hold && !p.spent;
  p.holding = resisting;
  p.strength = Math.max(0, Math.min(1, p.strength + (resisting ? -M.tire : M.rest) * dt));
  if (p.strength <= 0) p.spent = true;
  if (eyeOn(p)) {
    if (!resisting) p.pull += M.rise * dt;
    p.looking -= dt;
    if (p.looking <= 0) {
      p.looking = 0;
      p.warned = false;
      p.next = p.t + M.every + (p.rand() - 0.5) * 2 * M.jitter;
      ev.push({ type: 'away' });
    }
  } else p.pull += (resisting ? -M.fall : M.idle) * dt;
  p.pull = Math.max(0, p.pull);
  if (p.pull >= 1) {
    p.state = 'touched';
    ev.push({ type: 'touched' });
    return ev;
  }
  if (p.t >= M.length) {
    p.state = 'done';
    ev.push({ type: 'done' });
  }
  return ev;
}

// ── The gifts ──
// Four of Galadriel's gifts on the table, each for its own: pick one up,
// carry it to the one it's for.
export const GIFTS = [
  { id: 'bow', name: 'the bow of the Galadhrim', to: ['legolas'] },
  { id: 'daggers', name: 'two elven daggers', to: ['merry', 'pippin'] },
  { id: 'rope', name: 'a coil of elven rope', to: ['sam'] },
  { id: 'hairs', name: 'three golden hairs, in a little casket', to: ['gimli'] },
];

export const newGifts = () => ({ left: GIFTS.map((g) => g.id), carrying: null, given: {}, tries: 0 });

// Take one off the table (putting back the one you had): 'took', or null
// if it's not there.
export function takeGift(g, id) {
  if (!g.left.includes(id)) return null;
  if (g.carrying) g.left.push(g.carrying);
  g.left = g.left.filter((x) => x !== id);
  g.carrying = id;
  return 'took';
}
// Hand what you're carrying to `who` (their look: 'legolas', 'sam'…):
// 'right', 'wrong', or null if you've nothing.
export function giveGift(g, who) {
  if (!g.carrying) return null;
  const gift = GIFTS.find((x) => x.id === g.carrying);
  g.tries += 1;
  if (!gift.to.includes(who)) return 'wrong';
  g.given[gift.id] = who;
  g.carrying = null;
  return 'right';
}
export const allGiven = (g) => !g.carrying && g.left.length === 0;

// ── Down the Anduin ──
// The river as distance along it (`s`) and how far across (`lat`): the
// channel's half-width changes along it, rocks stand in the rapids, and
// eddies push the boat sideways. Hit a rock and the boat slows and ships
// water: three, and it's too much, and you start the stretch again. The
// Argonath stand near the end.
export const RIVER = {
  len: 320,
  speed: 6,
  paddle: 1.6,
  steer: 3.6,
  slow: 3,
  slowFor: 0.9,
  r: 1.45,
  hits: 3,
  argonath: 262,
  rocks: [
    { s: 42, lat: -1.8 },
    { s: 56, lat: 2.4 },
    { s: 68, lat: -0.6 },
    { s: 80, lat: 2 },
    { s: 91, lat: -2.4 },
    { s: 103, lat: 0.6 },
    { s: 115, lat: 2.6 },
    { s: 127, lat: -1.4 },
    { s: 139, lat: 1.2 },
    { s: 151, lat: -0.8 },
    { s: 178, lat: 3.4 },
    { s: 198, lat: -3.6 },
  ],
  eddies: [
    { s0: 62, s1: 84, push: 1.3 },
    { s0: 108, s1: 132, push: -1.5 },
  ],
};
// the channel's half-width at `s`: open water, narrowing through the
// rapids, then wide and slow to the Argonath
export function riverWide(s) {
  const k = (a, b, x) => Math.max(0, Math.min(1, (x - a) / (b - a)));
  const narrow = k(30, 50, s) * (1 - k(150, 175, s));
  return 9 - narrow * 4.5 + k(175, 230, s) * 5;
}
// how the river bends, as the centre line's sideways offset (for drawing):
// winding, then straight to the Argonath
export const riverBend = (s) => (16 * Math.sin(s * 0.013) + 6 * Math.sin(s * 0.031 + 1)) * (1 - Math.max(0, Math.min(1, (s - 190) / 50)));

export const newBoat = () => ({ t: 0, s: 0, lat: 0, slowT: 0, hits: 0, state: 'on', passed: false, steer: 0 });

// One step: `steer` -1..1 across, `paddle` true to dig in. Events: { type:
// 'hit', s }, 'swamped', 'argonath' (passing between the Kings), 'end'.
export function stepBoat(b, dt, { steer = 0, paddle = false } = {}) {
  const ev = [];
  if (b.state !== 'on') return ev;
  const R = RIVER;
  b.t += dt;
  b.slowT = Math.max(0, b.slowT - dt);
  b.steer = Math.max(-1, Math.min(1, steer));
  let push = 0;
  for (const e of R.eddies) if (b.s >= e.s0 && b.s <= e.s1) push += e.push;
  const w = riverWide(b.s) - 0.8;
  b.lat = Math.max(-w, Math.min(w, b.lat + (b.steer * R.steer + push) * dt));
  const v = b.slowT > 0 ? R.slow : R.speed + (paddle ? R.paddle : 0);
  const s0 = b.s;
  b.s += v * dt;
  for (const r of R.rocks) {
    if (r.s > s0 && r.s <= b.s && Math.abs(b.lat - r.lat) < R.r) {
      b.hits += 1;
      b.slowT = R.slowFor;
      ev.push({ type: 'hit', s: r.s });
      if (b.hits >= R.hits) {
        b.state = 'swamped';
        ev.push({ type: 'swamped' });
        return ev;
      }
    }
  }
  if (!b.passed && b.s >= R.argonath) {
    b.passed = true;
    ev.push({ type: 'argonath' });
  }
  if (b.s >= R.len) {
    b.state = 'end';
    ev.push({ type: 'end' });
  }
  return ev;
}

// ── On the side: Legolas's targets ──
// Five painted boards among the mallorns, and seven arrows to strike them
// all. Hold to draw: the bow comes to full in a moment, and held there too
// long your arms begin to shake. Aim, and let go. The arrow flies as fast
// as the bow was drawn, it falls as it goes (aim above the far ones), the
// breeze in the wood carries it a little, and a trunk in the way stops it.
//
// The world is { from: { x, y, z }, targets: [{ x, y, z, r }], trunks:
// [{ x, z, r }], ground(x, z) } (./layout.js RANGE). The aim is a yaw, the
// way the towns turn things (0 east, π/2 north), and a pitch, up.
export const BOW = {
  arrows: 7,
  draw: 0.7, // seconds to full draw
  steady: 1.5, // seconds at full draw before the arms tire
  tire: 0.6, // how fast the shake grows after that
  sway: 0.0035, // the aim's wander, drawn and steady (radians)
  shake: 0.03, // and at its worst, tired out
  speed: [8, 58], // the arrow's speed, from a slack bow to a full one (m/s; by the draw squared)
  g: 9.8,
  wind: 2.4, // the most the breeze pushes, sideways (m/s²)
  turn: 0.55, // aiming with the keys (radians a second)
  fine: 0.3, // and with the bow drawn
  gold: 0.35, // the gold, as a part of a board's radius
  pause: 0.9, // seconds after an arrow lands, before the next
  reach: 90, // lost in the wood past this
};

// yaw and pitch straight at a point
export function aimAt(from, at) {
  const dx = at.x - from.x;
  const dz = at.z - from.z;
  return { yaw: Math.atan2(-dz, dx), pitch: Math.atan2(at.y - from.y, Math.hypot(dx, dz)) };
}
// the way an aim points, as a unit vector
export const aimDir = (yaw, pitch) => ({ x: Math.cos(pitch) * Math.cos(yaw), y: Math.sin(pitch), z: -Math.cos(pitch) * Math.sin(yaw) });

// a breath of wind across the wood, for the next arrow: { x, z } (m/s²)
const breeze = (rand) => {
  const a = rand() * Math.PI * 2;
  const k = BOW.wind * (0.2 + rand() * 0.8);
  return { x: Math.cos(a) * k, z: Math.sin(a) * k };
};

// A round at the targets, aimed at first at board `first`.
export function newRange(world, seed = 1, first = 1) {
  const rand = seeded(seed);
  const { yaw, pitch } = aimAt(world.from, world.targets[first] ?? world.targets[0]);
  return { world, rand, t: 0, phase: rand() * 10, arrows: BOW.arrows, shot: 0, struck: [], golds: 0, yaw, pitch, draw: 0, held: 0, drawing: false, ready: true, arrow: null, stuck: [], wind: breeze(rand), state: 'aim', wait: 0, last: null };
}

// how tired your arms are, 0..1
export const tiredOf = (r) => Math.max(0, Math.min(1, (r.held - BOW.steady) * BOW.tire));
// the aim as it really is, wandering a little (and shaking, tired)
export function aimOf(r) {
  const tired = tiredOf(r);
  const amp = (r.drawing ? 1 : 0.6) * BOW.sway + BOW.shake * tired;
  const t = r.t;
  const p = r.phase;
  const tremble = tired > 0 ? 0.6 : 0;
  return {
    yaw: r.yaw + amp * (Math.sin(t * 1.7 + p) + 0.5 * Math.sin(t * 4.3 + p * 2) + tremble * Math.sin(t * 11 + p)),
    pitch: r.pitch + amp * (Math.sin(t * 1.3 + p * 1.3) + 0.5 * Math.sin(t * 3.7 + p) + tremble * Math.sin(t * 13 + p * 3)),
  };
}
// turn the aim (by the keys, or a finger dragged), within reason
export function turnAim(r, dyaw, dpitch) {
  r.yaw += dyaw;
  r.pitch = Math.max(-0.35, Math.min(0.5, r.pitch + dpitch));
}

// let the arrow go, as the aim and the draw are now
function loose(r, ev) {
  const { yaw, pitch } = aimOf(r);
  const d = aimDir(yaw, pitch);
  const v = BOW.speed[0] + (BOW.speed[1] - BOW.speed[0]) * r.draw * r.draw;
  const { x, y, z } = r.world.from;
  r.arrow = { x, y, z, vx: d.x * v, vy: d.y * v, vz: d.z * v, t: 0, run: 0 };
  r.arrows -= 1;
  r.shot += 1;
  r.state = 'flying';
  ev.push({ type: 'loose', draw: r.draw });
  r.draw = 0;
  r.held = 0;
  r.ready = false;
}

// where the arrow ends: in a board (`i`), a trunk, the ground, or lost
function land(r, ev, into, at, i = -1, gold = false) {
  const a = r.arrow;
  if (into !== 'away') r.stuck.push({ x: at.x, y: at.y, z: at.z, vx: a.vx, vy: a.vy, vz: a.vz, into, i });
  r.arrow = null;
  r.state = 'wait';
  r.wait = BOW.pause;
  if (into === 'board') {
    const fresh = !r.struck.includes(i);
    if (fresh) r.struck.push(i);
    if (gold) r.golds += 1;
    r.last = { into, i, gold, fresh };
    ev.push({ type: 'hit', i, gold, fresh });
  } else {
    r.last = { into };
    ev.push({ type: 'miss', into });
  }
}

function fly(r, dt, ev) {
  const a = r.arrow;
  const { from, targets, trunks, ground } = r.world;
  const n = Math.max(1, Math.ceil(dt * 240));
  const h = dt / n;
  for (let k = 0; k < n; k++) {
    const p0 = { x: a.x, y: a.y, z: a.z };
    a.vx += r.wind.x * h;
    a.vz += r.wind.z * h;
    a.vy -= BOW.g * h;
    a.x += a.vx * h;
    a.y += a.vy * h;
    a.z += a.vz * h;
    a.t += h;
    a.run += Math.hypot(a.x - p0.x, a.y - p0.y, a.z - p0.z);
    // the boards stand face on to the mark: did it cross a face, inside it?
    for (let i = 0; i < targets.length; i++) {
      const c = targets[i];
      const nx = from.x - c.x;
      const nz = from.z - c.z;
      const nl = Math.hypot(nx, nz) || 1;
      const s0 = ((p0.x - c.x) * nx + (p0.z - c.z) * nz) / nl;
      const s1 = ((a.x - c.x) * nx + (a.z - c.z) * nz) / nl;
      if (s0 > 0 && s1 <= 0) {
        const f = s0 / (s0 - s1);
        const q = { x: p0.x + (a.x - p0.x) * f, y: p0.y + (a.y - p0.y) * f, z: p0.z + (a.z - p0.z) * f };
        const off = Math.hypot(q.x - c.x, q.y - c.y, q.z - c.z);
        if (off < c.r) return land(r, ev, 'board', q, i, off < c.r * BOW.gold);
      }
    }
    for (const tr of trunks) if (Math.hypot(a.x - tr.x, a.z - tr.z) < tr.r && a.y < 40) return land(r, ev, 'trunk', a);
    const gy = ground(a.x, a.z);
    if (a.y <= gy) return land(r, ev, 'ground', { x: a.x, y: gy, z: a.z });
    if (a.run > BOW.reach || a.t > 4) return land(r, ev, 'away', a);
  }
  return undefined;
}

// One step. `draw` true while the bow's held drawn; `x` and `y` turn the
// aim (-1..1: right, and up). Events: 'draw', 'loose' { draw }, 'hit' { i,
// gold, fresh }, 'miss' { into: 'trunk' | 'ground' | 'away' }, then 'won'
// (every board struck) or 'out' (no arrows left).
export function stepRange(r, dt, { draw = false, x = 0, y = 0 } = {}) {
  const ev = [];
  if (r.state === 'won' || r.state === 'out') return ev;
  r.t += dt;
  const k = (r.drawing ? BOW.fine : BOW.turn) * dt;
  turnAim(r, -x * k, y * k);
  if (r.state === 'flying') {
    fly(r, dt, ev);
    return ev;
  }
  if (r.state === 'wait') {
    r.wait -= dt;
    if (r.wait > 0) return ev;
    if (r.struck.length >= r.world.targets.length) {
      r.state = 'won';
      ev.push({ type: 'won' });
    } else if (r.arrows <= 0) {
      r.state = 'out';
      ev.push({ type: 'out' });
    } else {
      r.state = 'aim';
      r.wind = breeze(r.rand);
    }
    return ev;
  }
  // aiming: a fresh draw needs the last one let go of first
  if (!draw) r.ready = true;
  if (draw && r.ready && r.arrows > 0) {
    if (!r.drawing) {
      r.drawing = true;
      r.draw = 0;
      r.held = 0;
      ev.push({ type: 'draw' });
    }
    r.draw = Math.min(1, r.draw + dt / BOW.draw);
    if (r.draw >= 1) r.held += dt;
  } else if (r.drawing) {
    r.drawing = false;
    loose(r, ev);
  }
  return ev;
}
