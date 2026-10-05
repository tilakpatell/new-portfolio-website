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
