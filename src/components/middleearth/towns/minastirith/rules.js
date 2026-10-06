// Minas Tirith's games, as rules with no drawing, so they can be tested:
// the ride up through the seven gates, creeping along the ledge to the
// beacon, and the trebuchets against the siege-towers.
// ./MinasTirithWorld.jsx steps them; ./scene.js draws them.

import { COVERS, PILE, inCover } from './layout';

export function seeded(seed = 1) {
  let s = seed % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
const between = (rand, [a, b]) => a + rand() * (b - a);

// ── The seven gates ──
// Shadowfax goes up the road on his own; you steer him across it (`lane`,
// -1 left to 1 right) round what's in the way, and can spur him on. A
// knock slows him for a moment. `slots` are the stretches of road where
// things can stand ([s0, s1] each), `gates` how far along each gate is,
// `len` the whole way.
export const RIDE = { canter: 9, gallop: 15, steer: 2.4, lanes: 2.3, slow: 3.5, recover: 1.3, hitS: 1.6, hitLane: 0.55, every: [7, 12] };
export const KINDS = ['cart', 'barrels', 'crates', 'folk', 'hens'];

export function newRide(seed = 3, { slots = [], gates = [], len = 100 } = {}) {
  const rand = seeded(seed);
  const things = [];
  for (const [s0, s1] of slots) {
    for (let s = s0 + rand() * 3; s < s1; s += between(rand, RIDE.every)) {
      const lane = [-1, 0, 1][Math.floor(rand() * 3)] * 0.85 + (rand() - 0.5) * 0.2;
      things.push({ s, lane, kind: KINDS[Math.floor(rand() * KINDS.length)], hit: false });
    }
  }
  return { t: 0, s: 0, lane: 0, v: 0, slow: 0, knocks: 0, gate: 0, gates, len, things, state: 'on', spur: false };
}

// One step: `steer` -1..1, `spur` to gallop. Events: 'gate' { i } as each
// is passed, 'knock' { kind }, 'top' at the end of the road.
export function stepRide(r, dt, { steer = 0, spur = false } = {}) {
  const ev = [];
  if (r.state !== 'on') return ev;
  r.t += dt;
  r.spur = Boolean(spur);
  r.lane = Math.max(-1, Math.min(1, r.lane + Math.max(-1, Math.min(1, steer)) * RIDE.steer * dt));
  r.slow = Math.max(0, r.slow - dt);
  const want = r.slow > 0 ? RIDE.slow : spur ? RIDE.gallop : RIDE.canter;
  r.v += (want - r.v) * Math.min(1, dt * (want < r.v ? 6 : 1.6));
  r.s = Math.min(r.len, r.s + r.v * dt);
  for (const o of r.things) {
    if (o.hit || Math.abs(o.s - r.s) > RIDE.hitS || Math.abs(o.lane - r.lane) > RIDE.hitLane) continue;
    o.hit = true;
    r.knocks += 1;
    r.slow = RIDE.recover;
    r.v = Math.min(r.v, RIDE.slow);
    ev.push({ type: 'knock', kind: o.kind });
  }
  while (r.gate < r.gates.length && r.s >= r.gates[r.gate]) {
    ev.push({ type: 'gate', i: r.gate });
    r.gate += 1;
  }
  if (r.s >= r.len) {
    r.state = 'done';
    ev.push({ type: 'top' });
  }
  return ev;
}

// ── The beacon ──
// Along the ledge (`s`, metres) to the pile at PILE.s, up it (`climb`,
// 0..1), and light it. The guard at the far end eats, then stirs (the
// warning), then looks up along the ledge for a while, then eats again.
// While he looks, anyone moving is seen; so is anyone standing in the open
// close to him (past the last rock, short of the pile). Up on the pile,
// above his eyes, only moving is seen. Seen, and he sends you back to the
// last rock you passed (or the start), and the pile's climb is lost.
export const SNEAK = { creep: 2.2, back: 1.6, climb: 0.42, eat: [2.6, 4.6], stir: 0.75, look: [1.6, 2.4], first: 2.4, near: 18.6 };

export function newSneak(seed = 7) {
  const rand = seeded(seed);
  return { t: 0, s: 0, climb: 0, moving: false, phase: 'eat', phaseT: SNEAK.first, state: 'on', caught: 0, rand, covered: true };
}
const lastCover = (s) => COVERS.filter((c) => c.s <= s).reduce((a, c) => Math.max(a, c.s), 0);
// in danger, right now, if he's looking
export const exposed = (n) => n.moving || (n.climb <= 0 && n.s >= SNEAK.near && n.s < PILE.s && !inCover(n.s));
// One step; `move` 1 to go on (or up the pile), -1 to go back, 0 to keep
// still. Events: 'stir', 'look', 'eat', 'cover' (into a rock's shelter),
// 'caught', 'pile' (at the foot of it), 'top' (up it, ready to light).
export function stepSneak(n, dt, move = 0) {
  const ev = [];
  if (n.state !== 'on' && n.state !== 'ready') return ev;
  n.t += dt;
  n.phaseT -= dt;
  if (n.phaseT <= 0) {
    if (n.phase === 'eat') {
      n.phase = 'stir';
      n.phaseT = SNEAK.stir;
      ev.push({ type: 'stir' });
    } else if (n.phase === 'stir') {
      n.phase = 'look';
      n.phaseT = between(n.rand, SNEAK.look);
      ev.push({ type: 'look' });
    } else {
      n.phase = 'eat';
      n.phaseT = between(n.rand, SNEAK.eat);
      ev.push({ type: 'eat' });
    }
  }
  const was = n.s;
  const climbWas = n.climb;
  if (n.state === 'on') {
    if (n.s < PILE.s) {
      n.s = Math.max(0, Math.min(PILE.s, n.s + (move > 0 ? SNEAK.creep : move < 0 ? -SNEAK.back : 0) * dt));
      if (n.s >= PILE.s) ev.push({ type: 'pile' });
    } else if (move > 0) {
      n.climb = Math.min(1, n.climb + SNEAK.climb * dt);
      if (n.climb >= 1) {
        n.state = 'ready';
        ev.push({ type: 'top' });
      }
    } else if (move < 0 && n.climb <= 0) n.s = Math.max(0, n.s - SNEAK.back * dt);
  }
  n.moving = n.s !== was || n.climb !== climbWas;
  const covered = inCover(n.s) && n.s < PILE.s;
  if (covered && !n.covered) ev.push({ type: 'cover' });
  n.covered = covered;
  if (n.phase === 'look' && exposed(n)) {
    n.caught += 1;
    n.s = lastCover(Math.min(n.s, PILE.s - 0.01));
    n.climb = 0;
    n.moving = false;
    n.state = 'on';
    n.covered = n.s > 0;
    // he goes back to his supper, grumbling
    n.phase = 'eat';
    n.phaseT = between(n.rand, SNEAK.eat);
    ev.push({ type: 'caught' });
  }
  return ev;
}
// Light it: only from the top of the pile.
export function lightBeacon(n) {
  if (n.state === 'lit') return 'lit';
  if (n.state !== 'ready') return 'notyet';
  n.state = 'lit';
  return 'lit';
}

// ── The siege ──
// The range of the trebuchets swings out and back across the field
// (`aim`, 0 near to 1 far). Loose, and the stone flies for `flight`
// seconds and comes down at the range it was loosed at; a tower within
// `hit` metres of it then falls. The engine takes `reload` seconds to wind
// again. Towers come on one after another, each at its own pace; bring
// down `need` before any reaches the wall. Now and then a fell beast
// screams over, and the hands on the ropes shake: the range swings wild.
export const SIEGE = { sweep: 3.2, near: 40, far: 290, reload: 2, flight: 1.8, hit: 10, need: 4, gap: [8, 11], first: 1.5, start: [250, 285], speed: [5.4, 7], dread: [8, 13], dreadFor: 1.6, wild: 2.2, lanes: 5 };
export const rangeOf = (aim) => SIEGE.near + Math.max(0, Math.min(1, aim)) * (SIEGE.far - SIEGE.near);
const tri = (u) => {
  const f = u - Math.floor(u);
  return f < 0.5 ? f * 2 : 2 - f * 2;
};

export function newSiege(seed = 11) {
  const rand = seeded(seed);
  return { t: 0, sweepT: SIEGE.sweep * 0.25, aim: 0.5, loaded: true, reloadT: 0, shots: [], towers: [], made: 0, felled: 0, nextT: SIEGE.first, dreadT: between(rand, SIEGE.dread), dread: 0, state: 'on', rand, lane: Math.floor(rand() * SIEGE.lanes) };
}
// One step. Events: 'tower' { i }, 'loaded', 'land' { d, hit, i? },
// 'fall' { i }, 'dread', 'calm', 'breach' { i } (lost), 'won'.
export function stepSiege(g, dt) {
  const ev = [];
  if (g.state !== 'on') return ev;
  const S = SIEGE;
  g.t += dt;
  g.sweepT += dt * (g.dread > 0 ? S.wild : 1);
  g.aim = tri(g.sweepT / S.sweep);
  if (!g.loaded) {
    g.reloadT -= dt;
    if (g.reloadT <= 0) {
      g.loaded = true;
      ev.push({ type: 'loaded' });
    }
  }
  g.nextT -= dt;
  if (g.nextT <= 0) {
    g.lane = (g.lane + 1 + Math.floor(g.rand() * (S.lanes - 1))) % S.lanes;
    g.towers.push({ i: g.made, d: between(g.rand, S.start), v: between(g.rand, S.speed), lane: g.lane, state: 'on' });
    ev.push({ type: 'tower', i: g.made });
    g.made += 1;
    g.nextT = between(g.rand, S.gap);
  }
  for (const w of g.towers) {
    if (w.state !== 'on') continue;
    w.d -= w.v * dt;
    if (w.d <= 0) {
      w.d = 0;
      w.state = 'breach';
      g.state = 'lost';
      ev.push({ type: 'breach', i: w.i });
      return ev;
    }
  }
  for (const sh of g.shots) {
    if (sh.done) continue;
    sh.t -= dt;
    if (sh.t > 0) continue;
    sh.done = true;
    let best = null;
    for (const w of g.towers) {
      if (w.state !== 'on') continue;
      const off = Math.abs(w.d - sh.d);
      if (off <= S.hit && (!best || off < Math.abs(best.d - sh.d))) best = w;
    }
    if (best) {
      best.state = 'fall';
      g.felled += 1;
      ev.push({ type: 'land', d: sh.d, hit: true, i: best.i }, { type: 'fall', i: best.i });
      if (g.felled >= S.need) {
        g.state = 'won';
        ev.push({ type: 'won' });
        return ev;
      }
    } else ev.push({ type: 'land', d: sh.d, hit: false });
  }
  g.shots = g.shots.filter((sh) => !sh.done);
  if (g.dread > 0) {
    g.dread -= dt;
    if (g.dread <= 0) {
      g.dread = 0;
      ev.push({ type: 'calm' });
    }
  } else {
    g.dreadT -= dt;
    if (g.dreadT <= 0) {
      g.dread = S.dreadFor;
      g.dreadT = between(g.rand, S.dread);
      ev.push({ type: 'dread' });
    }
  }
  return ev;
}
// Loose: 'loosed', or 'loading' if the engine isn't wound yet.
export function loose(g) {
  if (g.state !== 'on') return 'over';
  if (!g.loaded) return 'loading';
  g.loaded = false;
  g.reloadT = SIEGE.reload;
  const d = rangeOf(g.aim);
  g.shots.push({ d, t: SIEGE.flight, k: g.aim });
  return 'loosed';
}
// how far through its flight a stone is (0 loosed, 1 landing)
export const flightOf = (sh) => 1 - Math.max(0, sh.t) / SIEGE.flight;
