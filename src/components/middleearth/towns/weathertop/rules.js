// Weathertop's four games, as rules with no drawing, so they can be
// tested: stamping out the fire in the dell, holding the summit with a
// brand, Sam's search for the kingsfoil, and the ride to the Ford.
// ./WeathertopWorld.jsx steps them; ./scene.js draws them.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ── Put it out, you fools! ──
// Five patches of fire. Each burns hotter the longer it's left, and a hot
// one sets the patches beside it going again. A stamp knocks one down; it
// takes two or three to put one out. All out before the clock runs down,
// or the Nazgûl see it.
export const FIRE = { time: 20, stamp: 0.3, cool: 0.32, grow: 0.09, spread: 0.45, near: 2.6, hot: 0.8, catches: 0.4, reach: 1.05 };
const START_HEAT = [1, 0.85, 0.7, 0.6, 0.75];

export function newFire(patches) {
  const n = patches.length;
  const next = patches.map((a, i) => patches.map((b, j) => (i !== j && Math.hypot(a.x - b.x, a.z - b.z) < FIRE.near ? j : -1)).filter((j) => j >= 0));
  return { t: 0, left: FIRE.time, heat: patches.map((_, i) => START_HEAT[i % START_HEAT.length]), catching: new Array(n).fill(0), next, cool: 0, stamps: 0, state: 'on' };
}

// One step: the fire grows and spreads, the clock runs. Events: { type:
// 'caught', i } when a patch catches again, { type: 'seen' } when the time's
// up.
export function stepFire(f, dt) {
  const ev = [];
  if (f.state !== 'on') return ev;
  f.t += dt;
  f.left = Math.max(0, f.left - dt);
  f.cool = Math.max(0, f.cool - dt);
  const hot = f.heat.map((h) => h >= FIRE.hot);
  f.heat.forEach((h, i) => {
    if (h > 0) {
      f.heat[i] = Math.min(1, h + FIRE.grow * dt);
      f.catching[i] = 0;
      return;
    }
    // out: but a hot one beside it may set it going again
    const by = f.next[i].filter((j) => hot[j]).length;
    f.catching[i] = by ? f.catching[i] + by * FIRE.spread * dt : 0;
    if (f.catching[i] >= 1) {
      f.catching[i] = 0;
      f.heat[i] = FIRE.catches;
      ev.push({ type: 'caught', i });
    }
  });
  if (f.left <= 0) {
    f.state = 'seen';
    ev.push({ type: 'seen' });
  }
  return ev;
}

// The patch a hobbit at (x, z) can stamp on: the nearest one burning in
// reach, or -1.
export function stampable(f, patches, x, z) {
  let best = -1;
  let bd = FIRE.reach;
  patches.forEach((p, i) => {
    const d = Math.hypot(p.x - x, p.z - z);
    if (f.heat[i] > 0 && d < bd) {
      best = i;
      bd = d;
    }
  });
  return best;
}

// A stamp on patch i: 'out' if that put it out, 'won' if it was the last,
// 'hit' if it's still burning, null if it couldn't be stamped (cooling
// down, or not burning).
export function stamp(f, i) {
  if (f.state !== 'on' || f.cool > 0 || !(f.heat[i] > 0)) return null;
  f.cool = FIRE.cool;
  f.stamps += 1;
  f.heat[i] = Math.max(0, f.heat[i] - FIRE.stamp);
  if (f.heat[i] > 0) return 'hit';
  f.heat[i] = 0;
  if (f.heat.every((h) => h <= 0)) {
    f.state = 'won';
    return 'won';
  }
  return 'out';
}

// ── Fire against the dark ──
// Frodo on the summit, his back to the plinth, a burning brand in his
// hand. Five Nazgûl come in from round the ruin. One won't come on into
// the brand's light while it faces him: it stops, and edges round to get
// out of it. A thrust drives back those in reach. The Ring pulls harder the
// closer they are. Hold until Strider comes.
export const BRAND = {
  start: 12.5, // how far out they start
  creep: 0.95, // how fast they come on, out of the light
  circle: 0.22, // how fast they edge round, in it
  fear: 6.2, // how far out the brand's light holds them
  arc: 0.6, // half the brand's light, as an angle
  push: 0.5, // how fast the light pushes them back
  thrust: 3.6, // how far a thrust reaches
  thrustArc: 0.75, // and how wide
  thrustCool: 0.65,
  back: 8.5, // how far a thrust drives them
  backSpeed: 7,
  backTime: 1.1,
  turn: 3.2, // how fast the brand can be swung round, a second
  catch: 1.25, // close enough to strike
  hold: 40, // how long until Strider comes
  pull: 0.1, // how fast the Ring pulls, with one right on him
  near: 4.2, // how close before it pulls
  ease: 0.12, // how fast it lets go, with none near
  stagger: [0, 2, 5, 8.5, 12], // when each comes in
};

export function newBrand(gaps, aim = 0) {
  return {
    t: 0,
    aim,
    cool: 0,
    pull: 0,
    state: 'on',
    wraiths: gaps.slice(0, 5).map((a, i) => ({ id: i, a, r: BRAND.start, mode: 'wait', wait: BRAND.stagger[i] ?? i * 3, back: 0, side: i % 2 ? 1 : -1 })),
  };
}

const inLight = (b, w, arc = BRAND.arc) => Math.abs(wrap(w.a - b.aim)) < arc;

// One step. `input` is { turn } (-1..1, keys or a stick) or { to } (the
// angle the pointer's at, which the brand swings towards). Angles in the
// ground's plane, round Frodo, as (cos a, sin a). Events: { type: 'held',
// id } as one stops in the light, { type: 'close', id } when one's within
// arm's reach of striking, 'stabbed' when one strikes, 'ring' when the Ring
// wins, 'strider' when he comes.
export function stepBrand(b, dt, input = {}) {
  const ev = [];
  if (b.state !== 'on') return ev;
  b.t += dt;
  b.cool = Math.max(0, b.cool - dt);
  // the brand swings round, no faster than an arm can
  const want = input.to != null ? wrap(input.to - b.aim) / Math.max(dt, 1e-6) : (input.turn ?? 0) * BRAND.turn;
  b.aim = wrap(b.aim + clamp(want, -BRAND.turn, BRAND.turn) * dt);
  let close = 0;
  for (const w of b.wraiths) {
    if (w.mode === 'wait') {
      w.wait -= dt;
      if (w.wait <= 0) w.mode = 'creep';
      continue;
    }
    if (w.mode === 'back') {
      w.back -= dt;
      w.r = Math.min(BRAND.back, w.r + BRAND.backSpeed * dt);
      if (w.back <= 0) w.mode = 'creep';
    } else if (inLight(b, w) && w.r < BRAND.fear + 0.5) {
      // held off by the fire: pushed back a little, and edging round to
      // get out of its light
      if (w.mode !== 'held') ev.push({ type: 'held', id: w.id });
      w.mode = 'held';
      w.r = Math.min(BRAND.fear + 0.4, w.r + BRAND.push * dt);
      const away = wrap(w.a - b.aim) >= 0 ? 1 : -1;
      w.a = wrap(w.a + away * BRAND.circle * dt);
    } else {
      w.mode = 'creep';
      w.r -= BRAND.creep * dt;
      w.a = wrap(w.a + w.side * 0.05 * dt);
    }
    if (w.r < BRAND.catch + 1 && w.mode === 'creep' && !w.warned) {
      w.warned = true;
      ev.push({ type: 'close', id: w.id });
    }
    if (w.r >= BRAND.catch + 1.5) w.warned = false;
    if (w.r <= BRAND.catch) {
      b.state = 'stabbed';
      ev.push({ type: 'stabbed', id: w.id });
      return ev;
    }
    close += Math.max(0, 1 - w.r / BRAND.near);
  }
  // the Ring
  b.pull = clamp(b.pull + (close * BRAND.pull - (close < 0.3 ? BRAND.ease : 0)) * dt, 0, 1);
  if (b.pull >= 1) {
    b.state = 'ring';
    ev.push({ type: 'ring' });
    return ev;
  }
  if (b.t >= BRAND.hold) {
    b.state = 'won';
    ev.push({ type: 'strider' });
  }
  return ev;
}

// A thrust with the brand: drives back every one in reach before it.
// Returns the ids driven back ([] for a miss), or null if the arm's not
// ready.
export function thrust(b) {
  if (b.state !== 'on' || b.cool > 0) return null;
  b.cool = BRAND.thrustCool;
  const hit = [];
  for (const w of b.wraiths) {
    if (w.mode === 'wait' || w.r > BRAND.thrust || !inLight(b, w, BRAND.thrustArc)) continue;
    w.mode = 'back';
    w.back = BRAND.backTime;
    hit.push(w.id);
  }
  return hit;
}

// ── Kingsfoil ──
// Sam searches round the hill's foot by lantern. The athelas glows when the
// lantern's near (the weeds don't); three are wanted, and Frodo grows
// colder all the while.
export const ATHELAS = { need: 3, glow: 6.5, reach: 1.6, cold: 160 };

export const newHunt = () => ({ found: [], cold: 0, state: 'on' });

// how brightly a plant shows to a lantern at (x, z): 0 to 1
export const glowOf = (plant, x, z) => (plant.athelas ? clamp(1 - (Math.hypot(plant.x - x, plant.z - z) - ATHELAS.reach) / (ATHELAS.glow - ATHELAS.reach), 0, 1) : 0);

export function stepHunt(h, dt) {
  if (h.state !== 'on') return [];
  h.cold = Math.min(1, h.cold + dt / ATHELAS.cold);
  if (h.cold >= 1) {
    h.state = 'cold';
    return [{ type: 'cold' }];
  }
  return [];
}

// The plant in reach of (x, z) that hasn't been picked, or null.
export function pickable(h, plants, x, z) {
  let best = null;
  let bd = ATHELAS.reach;
  for (const p of plants) {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bd && !h.found.includes(p.id)) {
      best = p;
      bd = d;
    }
  }
  return best;
}

// Pick a plant: 'weed' if it's only a weed, 'found' for kingsfoil, 'won'
// for the last one wanted; null if it can't be picked.
export function pick(h, plant) {
  if (h.state !== 'on' || !plant || h.found.includes(plant.id)) return null;
  if (!plant.athelas) return 'weed';
  h.found.push(plant.id);
  if (h.found.length >= ATHELAS.need) {
    h.state = 'won';
    return 'won';
  }
  return 'found';
}

// ── The Flight to the Ford ──
// Arwen and Frodo on Asfaloth, down the road through the Trollshaws, with
// the Nine behind. The road runs on by itself; you steer across it
// (`lat`, metres from its middle), round fallen trees and stones, and spur
// on the straights. A hit slows you, and the Nine close in.
export const RIDE = { length: 660, lane: 4.4, base: 15.2, spur: 22, spurTime: 1.2, spurCool: 2.6, slow: 7, slowTime: 0.9, steer: 7.5, chase: 16.8, gap: 30, body: 0.7 };

// The road's middle, as it winds: how far across from a straight line,
// and which way it's heading, at `s` metres along.
export const roadBend = (s) => 22 * Math.sin(s * 0.0072) + 8 * Math.sin(s * 0.019 + 1.1);
export const roadTurn = (s) => Math.atan2(22 * 0.0072 * Math.cos(s * 0.0072) + 8 * 0.019 * Math.cos(s * 0.019 + 1.1), 1);

// What's on the road: fallen trees across part of it ({ lat0, lat1 }) and
// stones ({ lat, r }), with always a way past. The first stretch is clear.
export const OBSTACLES = (() => {
  const out = [];
  let s = 70;
  let i = 0;
  while (s < RIDE.length - 50) {
    const k = (i * 37) % 7;
    if (i % 3 === 2) {
      out.push({ id: `stone${i}`, kind: 'stone', s, lat: [-2.6, 1.4, -0.4, 2.8, -1.6, 0.6, 2][k], r: 0.9 + (k % 3) * 0.2 });
    } else {
      // a tree down across one side or the other, leaving a gap of three
      // metres or so at the other
      const left = (i * 5) % 2 === 0;
      const reach = 4.6 + (k % 3) * 0.7;
      out.push({ id: `tree${i}`, kind: 'tree', s, lat0: left ? -RIDE.lane - 1 : RIDE.lane + 1 - reach - 1, lat1: left ? -RIDE.lane - 1 + reach + 1 : RIDE.lane + 1 });
    }
    s += 34 + ((i * 13) % 5) * 7;
    i += 1;
  }
  return out;
})();

export const newRide = () => ({ s: 0, lat: 0, v: RIDE.base, spurT: 0, spurCool: 0, slowT: 0, gap: RIDE.gap, hits: 0, t: 0, state: 'on' });

const hits = (o, lat) => (o.kind === 'tree' ? lat > o.lat0 - RIDE.body && lat < o.lat1 + RIDE.body : Math.abs(lat - o.lat) < o.r + RIDE.body);

// One step: `steer` -1..1 (left is -), `spur` true to spur on. Events:
// 'spur', { type: 'hit', id }, 'close' (the Nine are near), 'caught', 'ford'
// (you've reached the river).
export function stepRide(r, dt, { steer = 0, spur = false } = {}) {
  const ev = [];
  if (r.state !== 'on') return ev;
  r.t += dt;
  r.spurCool = Math.max(0, r.spurCool - dt);
  r.spurT = Math.max(0, r.spurT - dt);
  r.slowT = Math.max(0, r.slowT - dt);
  if (spur && r.spurCool <= 0 && r.slowT <= 0) {
    r.spurT = RIDE.spurTime;
    r.spurCool = RIDE.spurTime + RIDE.spurCool;
    ev.push({ type: 'spur' });
  }
  const want = r.slowT > 0 ? RIDE.slow : r.spurT > 0 ? RIDE.spur : RIDE.base;
  r.v += (want - r.v) * Math.min(1, dt * (want < r.v ? 6 : 2.5));
  r.lat = clamp(r.lat + clamp(steer, -1, 1) * RIDE.steer * dt, -RIDE.lane, RIDE.lane);
  const s0 = r.s;
  r.s += r.v * dt;
  for (const o of OBSTACLES) {
    if (o.s > s0 && o.s <= r.s && hits(o, r.lat)) {
      r.slowT = RIDE.slowTime;
      r.spurT = 0;
      r.hits += 1;
      ev.push({ type: 'hit', id: o.id });
    }
  }
  const before = r.gap;
  r.gap += (r.v - RIDE.chase) * dt;
  if (r.gap < 12 && before >= 12) ev.push({ type: 'close' });
  if (r.gap <= 0) {
    r.state = 'caught';
    ev.push({ type: 'caught' });
    return ev;
  }
  if (r.s >= RIDE.length) {
    r.s = RIDE.length;
    r.state = 'ford';
    ev.push({ type: 'ford' });
  }
  return ev;
}
