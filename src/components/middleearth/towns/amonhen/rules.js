// Amon Hen's games, as rules with no drawing, so they can be tested: wood
// for the fire, getting away from Boromir with the Ring on, taking it off
// on the Seat before the Eye finds you, running past the Uruk-hai (the
// watching is ../watchers.js), and Sam in the water. ./AmonHenWorld.jsx
// steps them; ./scene.js draws them.

// ── Wood for the fire ──
export const newWood = (n) => ({ got: [], need: n });
export function pickStick(w, i) {
  if (w.got.includes(i) || i < 0 || i >= w.need) return null;
  w.got.push(i);
  return w.got.length >= w.need ? 'all' : 'got';
}

// ── None of us should wander alone ──
// With the Ring on, Boromir can't see you, but he hears you if you run
// near, and runs into you if you're close enough to touch (the watching
// is ../watchers.js with BOROMIR). Meanwhile the Ring pulls: faster when
// you run. Get to the stair before it's too much.
export const BOROMIR = { sight: 0, cone: 0, smell: 1.3, hear: 4.5, ringSight: 0, alert: 0.25, chase: 3.8, patrol: 2.4, giveUp: 2.6, leash: 16, catch: 1.25, look: 0.7 };
export const UNSEEN = { rise: 0.022, running: 1.8, reach: 2.6 };

export const newUnseen = () => ({ t: 0, pull: 0, state: 'on' });
// One step. `hero` { x, z, running }, `goal` { x, z }. Events: 'away' at
// the goal, 'found' if the Ring's pull gets too much.
export function stepUnseen(u, dt, hero, goal) {
  const ev = [];
  if (u.state !== 'on') return ev;
  u.t += dt;
  u.pull += UNSEEN.rise * (hero.running ? UNSEEN.running : 1) * dt;
  if (Math.hypot(hero.x - goal.x, hero.z - goal.z) < UNSEEN.reach) {
    u.state = 'away';
    ev.push({ type: 'away' });
  } else if (u.pull >= 1) {
    u.state = 'found';
    ev.push({ type: 'found' });
  }
  return ev;
}

// ── The Seat of Seeing ──
// The Eye's gaze sweeps across the land, and over you every `period`
// seconds, for `on` of them. Pull the Ring off: hold for `off` seconds,
// but while the gaze is on you the Ring won't come, and each pass that
// finds you still wearing it brings it closer. Three, and it has you.
export const SEAT_GAZE = { first: 1.6, period: 3, on: 0.8, off: 1.25, slip: 2, passes: 3 };

export const newSeat = () => ({ t: 0, pulling: 0, heat: 0, state: 'on', wasOn: false });
export const gazeOn = (st) => st.t >= SEAT_GAZE.first && (st.t - SEAT_GAZE.first) % SEAT_GAZE.period < SEAT_GAZE.on;
// how long till the gaze comes round again (0 while it's on you)
export const gazeIn = (st) => {
  if (st.t < SEAT_GAZE.first) return SEAT_GAZE.first - st.t;
  if (gazeOn(st)) return 0;
  return SEAT_GAZE.period - ((st.t - SEAT_GAZE.first) % SEAT_GAZE.period);
};
// One step; `hold` true while pulling at the Ring. Events: 'gaze' as it
// comes over you, 'burn' when it finds you still wearing it, 'off' when
// the Ring's off, 'seen' when it has you.
export function stepSeat(st, dt, hold) {
  const ev = [];
  if (st.state !== 'on') return ev;
  st.t += dt;
  const on = gazeOn(st);
  if (on && !st.wasOn) {
    ev.push({ type: 'gaze' });
    st.heat += 1;
    st.pulling = 0;
    ev.push({ type: 'burn' });
    if (st.heat >= SEAT_GAZE.passes) {
      st.state = 'seen';
      ev.push({ type: 'seen' });
      st.wasOn = on;
      return ev;
    }
  }
  st.wasOn = on;
  if (on) st.pulling = 0;
  else if (hold) st.pulling += dt;
  else st.pulling = Math.max(0, st.pulling - dt * SEAT_GAZE.slip);
  if (st.pulling >= SEAT_GAZE.off) {
    st.state = 'off';
    ev.push({ type: 'off' });
  }
  return ev;
}

// ── The Uruk-hai ──
export const URUKS = { sight: 11, cone: 0.68, smell: 1.4, hear: 3.6, ringSight: 0, alert: 0.4, chase: 4.7, patrol: 1.7, giveUp: 4, leash: 26, catch: 1.4, look: 1.2 };

// ── I made a promise ──
// Sam's in the water, going under and coming up. Paddle back to him (he's
// `gap` metres off and the boat drifts away), and reach for his hand while
// he's up. Reach while he's under and you miss him.
export const RESCUE = { gap: 7, drift: 0.55, paddle: 2.4, near: 1.6, up: 0.9, every: 2.3, first: 1.4 };

export const newRescue = () => ({ t: 0, gap: RESCUE.gap, state: 'on', misses: 0 });
export const samUp = (r) => r.t >= RESCUE.first && (r.t - RESCUE.first) % RESCUE.every < RESCUE.up;
// One step; `paddle` true while paddling back. Events: 'up' as he comes up,
// 'under' as he goes down.
export function stepRescue(r, dt, paddle) {
  const ev = [];
  if (r.state !== 'on') return ev;
  const was = samUp(r);
  r.t += dt;
  r.gap = Math.max(0.6, Math.min(RESCUE.gap + 3, r.gap + (RESCUE.drift - (paddle ? RESCUE.paddle : 0)) * dt));
  const now = samUp(r);
  if (now && !was) ev.push({ type: 'up' });
  if (!now && was) ev.push({ type: 'under' });
  return ev;
}
// Reach down for him: 'got', 'far' (too far off), 'under' (he's under).
export function reach(r) {
  if (r.state !== 'on') return null;
  if (r.gap > RESCUE.near) return 'far';
  if (!samUp(r)) {
    r.misses += 1;
    return 'under';
  }
  r.state = 'got';
  return 'got';
}

// ── On the side: ducks and drakes ──
// Skipping stones on Nen Hithoel with Merry and Pippin. Each stone is
// thrown in two goes: catch the tilt first (a needle swinging from flat to
// steep and back: low is best, but not quite flat), then the strength (a
// bar rising and falling: the top is best). Each time the stone meets the
// water it keeps some of its speed, more the nearer the best tilt and the
// flatter the stone; it skips while it's quick enough, then sinks. Too
// steep, and it goes straight in.
export const SKIP = {
  swing: 2.2, // seconds for the needle to swing up and back
  steep: 40, // the most it tilts (degrees)
  best: 14, // the tilt that skips best
  sink: 32, // steeper than this and it goes straight in
  rise: 0.9, // seconds for the strength to fill (and as long to fall)
  speed: [5, 21], // m/s, from a feeble throw to a strong one
  keep: 0.87, // the speed a perfect touch keeps
  lose: 0.005, // less kept for each degree off the best tilt
  rough: 0.3, // and for a rounder stone (by 1 - how flat it is)
  least: 5, // too slow to skip, under this (m/s)
  hop: 0.018, // a hop's length per (m/s)²
  g: 9.8,
  pause: 1.6, // seconds after it sinks, before the next stone
  pippin: 7, // Pippin's best (he says)
  merry: 5,
};

// the needle's tilt (degrees) and the strength (0..1), `t` seconds in
export const tiltAt = (t) => SKIP.steep * (0.5 - 0.5 * Math.cos((2 * Math.PI * t) / SKIP.swing));
export const strengthAt = (t) => {
  const k = (t / SKIP.rise) % 2;
  return k <= 1 ? k : 2 - k;
};

// A stone thrown so: where it meets the water (`d` metres out, `t` seconds
// after it leaves your hand), and how many times it skips. The last touch
// is where it sinks.
export function skipsFor(tilt, strength, flat = 1) {
  const v0 = SKIP.speed[0] + (SKIP.speed[1] - SKIP.speed[0]) * Math.max(0, Math.min(1, strength));
  // out of the hand to the water first
  let d = 2 + v0 * 0.4;
  let t = d / v0 + 0.15;
  const touches = [{ d, t, v: v0 }];
  if (tilt <= SKIP.sink) {
    const keep = SKIP.keep - Math.abs(tilt - SKIP.best) * SKIP.lose - (1 - Math.max(0, Math.min(1, flat))) * SKIP.rough;
    let v = v0;
    for (let n = 0; n < 40; n++) {
      v *= keep;
      if (v < SKIP.least) break;
      const len = v * v * SKIP.hop;
      d += len;
      t += len / v;
      touches.push({ d, t, v });
    }
  }
  return { skips: touches.length - 1, touches };
}

// Where a thrown stone is, `t` seconds after it left your hand: `d` out
// and `y` above the water (hand height `hand`), or null once it's sunk.
export function stoneAt(touches, t, hand = 1) {
  if (!touches.length || t > touches[touches.length - 1].t) return null;
  let t0 = 0;
  let d0 = 0;
  for (let i = 0; i < touches.length; i++) {
    const p = touches[i];
    if (t <= p.t) {
      const span = p.t - t0;
      const k = span > 0 ? (t - t0) / span : 1;
      // the first flight drops from the hand; the skips are little arcs
      const arc = (SKIP.g * span * span) / 8;
      const y = i === 0 ? hand * (1 - k * k) + arc * 0.8 * k * (1 - k) * 4 : arc * 4 * k * (1 - k);
      return { d: d0 + (p.d - d0) * k, y };
    }
    t0 = p.t;
    d0 = p.d;
  }
  return null;
}

// a stone from the shore: how flat it is, 0.55 (lumpy) to 1 (a biscuit)
const pickStone = (rand) => 0.55 + rand() * 0.45;

export function newSkipping(seed = 1) {
  let s = seed % 2147483647 || 1;
  const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  return { rand, phase: 'tilt', clock: 0, tilt: 0, strength: 0, flat: pickStone(rand), throws: 0, best: 0, last: null, fly: null, wait: 0 };
}
// look for another stone (only before it's thrown)
export function newStone(sk) {
  if (sk.phase !== 'tilt' && sk.phase !== 'strength') return false;
  sk.flat = pickStone(sk.rand);
  sk.phase = 'tilt';
  sk.clock = 0;
  return true;
}
// Space, or the button: catch the tilt, then the strength (and throw).
// Returns 'tilt', 'throw', or null if it's not the time.
export function pressSkip(sk) {
  if (sk.phase === 'tilt') {
    sk.tilt = tiltAt(sk.clock);
    sk.phase = 'strength';
    sk.clock = 0;
    return 'tilt';
  }
  if (sk.phase === 'strength') {
    sk.strength = strengthAt(sk.clock);
    const r = skipsFor(sk.tilt, sk.strength, sk.flat);
    sk.fly = { t: 0, touches: r.touches, i: 0, skips: r.skips };
    sk.phase = 'flying';
    sk.throws += 1;
    return 'throw';
  }
  return null;
}
// One step. Events: 'touch' { i, d, skip } each time the stone meets the
// water, 'sank' { skips, best, why } ('steep', 'weak' or null), and 'ready'
// when there's a new stone in your hand.
export function stepSkipping(sk, dt) {
  const ev = [];
  sk.clock += dt;
  if (sk.phase === 'flying' && sk.fly) {
    const f = sk.fly;
    f.t += dt;
    while (f.i < f.touches.length && f.touches[f.i].t <= f.t) {
      ev.push({ type: 'touch', i: f.i, d: f.touches[f.i].d, skip: f.i < f.touches.length - 1 });
      f.i += 1;
    }
    if (f.i >= f.touches.length && f.t > f.touches[f.touches.length - 1].t + 0.3) {
      const why = f.skips > 0 ? null : sk.tilt > SKIP.sink ? 'steep' : 'weak';
      const better = f.skips > sk.best;
      sk.best = Math.max(sk.best, f.skips);
      sk.last = { skips: f.skips, why, better };
      sk.phase = 'done';
      sk.wait = SKIP.pause;
      ev.push({ type: 'sank', skips: f.skips, best: sk.best, why });
    }
  } else if (sk.phase === 'done') {
    sk.wait -= dt;
    if (sk.wait <= 0) {
      sk.fly = null;
      sk.flat = pickStone(sk.rand);
      sk.phase = 'tilt';
      sk.clock = 0;
      ev.push({ type: 'ready' });
    }
  }
  return ev;
}
