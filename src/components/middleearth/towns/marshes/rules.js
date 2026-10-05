// The Emyn Muil, the Dead Marshes and the Black Gate: the games, as rules
// with no drawing, so they can be tested. Down the cliff on the elven
// rope, catching Gollum, the lights in the marsh, and the Nazgûl passing
// over. ./MarshesWorld.jsx steps them; ./scene.js draws them. (Following
// Gollum is ../lorien/rules.js newLead; the scouts at the Gate are
// ../watchers.js.)

export function seeded(seed = 1) {
  let s = seed % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── Real elvish rope ──
// Down the cliff, `y` metres from the top, `lat` across (swinging). Hold
// to let the rope out; steer to swing clear of the outcrops; gusts push
// you about. Pass an outcrop on its side and you knock it: three, and
// you fall.
export const ROPE = {
  len: 34,
  lower: 2.2,
  swing: 2.6,
  wide: 2.4,
  knocks: 3,
  stun: 0.7,
  outcrops: [
    { y: 6, side: 1 },
    { y: 11, side: -1 },
    { y: 15, side: 1 },
    { y: 19.5, side: -1 },
    { y: 24, side: 1 },
    { y: 29, side: -1 },
  ],
  // how far onto its side counts as on it
  clear: 0.35,
  gusts: [
    { y0: 8, y1: 13, push: 1.1 },
    { y0: 21, y1: 27, push: -1.2 },
  ],
};
export const newDescent = () => ({ t: 0, y: 0, lat: 0, knocks: 0, stunT: 0, state: 'on' });

// One step: `lower` true to let rope out, `steer` -1..1. Events: { type:
// 'knock', y }, 'fell', 'down'.
export function stepDescent(d, dt, { lower = false, steer = 0 } = {}) {
  const ev = [];
  if (d.state !== 'on') return ev;
  d.t += dt;
  d.stunT = Math.max(0, d.stunT - dt);
  let push = 0;
  for (const g of ROPE.gusts) if (d.y >= g.y0 && d.y <= g.y1) push += g.push;
  d.lat = Math.max(-ROPE.wide, Math.min(ROPE.wide, d.lat + (Math.max(-1, Math.min(1, steer)) * ROPE.swing + push) * dt));
  if (!lower || d.stunT > 0) return ev;
  const y0 = d.y;
  d.y += ROPE.lower * dt;
  for (const o of ROPE.outcrops) {
    if (o.y > y0 && o.y <= d.y && d.lat * o.side > -ROPE.clear) {
      d.knocks += 1;
      d.stunT = ROPE.stun;
      ev.push({ type: 'knock', y: o.y });
      if (d.knocks >= ROPE.knocks) {
        d.state = 'fell';
        ev.push({ type: 'fell' });
        return ev;
      }
    }
  }
  if (d.y >= ROPE.len) {
    d.state = 'down';
    ev.push({ type: 'down' });
  }
  return ev;
}

// ── Sméagol ──
// He creeps down the rock towards you in bursts, stopping to look. Move
// while he's looking and he scuttles back up. Once he's within reach (he's
// reaching for the Ring), grab him: too soon and he's away, too late and
// he's on Sam.
export const CREEP = { from: 12, speed: 1.4, burst: [1.4, 2.4], look: [1, 1.8], reach: 1.6, window: 1.6, back: 5 };

export function newCreep(seed = 9) {
  const rand = seeded(seed);
  return { t: 0, d: CREEP.from, phase: 'creep', phaseT: CREEP.burst[0] + rand() * (CREEP.burst[1] - CREEP.burst[0]), reachT: 0, state: 'on', rand };
}
// One step; `moving` true if you moved this step. Events: 'look' (he
// stops and looks), 'creep' (on he comes), 'spooked' (he saw you move),
// 'reach' (he's reaching: grab now), 'late'.
export function stepCreep(c, dt, moving) {
  const ev = [];
  if (c.state !== 'on') return ev;
  c.t += dt;
  if (c.phase === 'reach') {
    c.reachT += dt;
    if (c.reachT >= CREEP.window) {
      c.state = 'late';
      ev.push({ type: 'late' });
    }
    return ev;
  }
  if (c.phase === 'look' && moving) {
    c.d = Math.min(CREEP.from, c.d + CREEP.back);
    c.phase = 'creep';
    c.phaseT = CREEP.burst[0];
    ev.push({ type: 'spooked' });
    return ev;
  }
  c.phaseT -= dt;
  if (c.phase === 'creep') {
    c.d = Math.max(CREEP.reach, c.d - CREEP.speed * dt);
    if (c.d <= CREEP.reach) {
      c.phase = 'reach';
      c.reachT = 0;
      ev.push({ type: 'reach' });
      return ev;
    }
    if (c.phaseT <= 0) {
      c.phase = 'look';
      c.phaseT = CREEP.look[0] + c.rand() * (CREEP.look[1] - CREEP.look[0]);
      ev.push({ type: 'look' });
    }
  } else if (c.phaseT <= 0) {
    c.phase = 'creep';
    c.phaseT = CREEP.burst[0] + c.rand() * (CREEP.burst[1] - CREEP.burst[0]);
    ev.push({ type: 'creep' });
  }
  return ev;
}
// Grab him: 'caught' while he's reaching, 'early' before (he's away up
// the rock), null if it's over.
export function pounce(c) {
  if (c.state !== 'on') return null;
  if (c.phase === 'reach') {
    c.state = 'caught';
    return 'caught';
  }
  c.state = 'early';
  return 'early';
}

// ── The lights ──
// Linger near one of the candle-lights in the pools and it draws you in.
export const LURE = { r: 2.6, rise: 0.45, fall: 0.8, moving: 0.4, still: 1.4 };
export const newLure = () => ({ k: 0, near: -1, state: 'on' });
// One step. `lights` is [[x, z], …]. Events: 'near' as you come by one,
// 'drawn' when it has you.
export function stepLure(l, dt, hero, lights) {
  const ev = [];
  if (l.state !== 'on') return ev;
  let near = -1;
  lights.forEach(([x, z], i) => {
    if (near < 0 && Math.hypot(hero.x - x, hero.z - z) < LURE.r) near = i;
  });
  if (near >= 0 && near !== l.near) ev.push({ type: 'near', i: near });
  l.near = near;
  l.k = Math.max(0, l.k + (near >= 0 ? LURE.rise * (hero.speed > 0.3 ? LURE.moving : LURE.still) : -LURE.fall) * dt);
  if (l.k >= 1) {
    l.state = 'drawn';
    ev.push({ type: 'drawn', i: near });
  }
  return ev;
}

// ── The Nazgûl overhead ──
// A shriek, then `warn` seconds to get down in the reeds, then it passes
// over for `over` seconds: be down the whole time.
export const FELL = { at: [9, 26], warn: 1.8, over: 3.2 };
export const newFell = () => ({ t: 0, i: 0, phase: 'clear', phaseT: 0, state: 'on' });
// One step; `down` true while you're crouched. Events: 'shriek', 'over',
// 'spotted', 'gone'.
export function stepFell(f, dt, down) {
  const ev = [];
  if (f.state !== 'on') return ev;
  f.t += dt;
  if (f.phase === 'clear') {
    if (f.i < FELL.at.length && f.t >= FELL.at[f.i]) {
      f.phase = 'warn';
      f.phaseT = FELL.warn;
      ev.push({ type: 'shriek' });
    }
    return ev;
  }
  f.phaseT -= dt;
  if (f.phase === 'warn' && f.phaseT <= 0) {
    f.phase = 'over';
    f.phaseT = FELL.over;
    ev.push({ type: 'over' });
  } else if (f.phase === 'over') {
    if (!down) {
      f.state = 'spotted';
      ev.push({ type: 'spotted' });
      return ev;
    }
    if (f.phaseT <= 0) {
      f.phase = 'clear';
      f.i += 1;
      ev.push({ type: 'gone' });
    }
  }
  return ev;
}

// ── Before the Gate ──
// The Easterlings' scouts on the slope (../watchers.js): under the cloak
// they notice nothing, but you can't move.
export const SCOUTS = { sight: 10, cone: 0.7, smell: 1.2, hear: 3.2, ringSight: 0, alert: 0.6, chase: 4.2, patrol: 1.5, giveUp: 3.5, leash: 22, catch: 1.4, look: 1.6 };
