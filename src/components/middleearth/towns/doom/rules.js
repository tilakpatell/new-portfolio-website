// Mordor's games, as rules with no drawing, so they can be tested: in
// step in the orc column, across Gorgoroth under the Eye, carrying Frodo
// up the mountain, Frodo hanging over the fire, and the eagles out of the
// eruption. ./DoomWorld.jsx steps them; ./scene.js draws them.

export function seeded(seed = 1) {
  let s = seed % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── Get in line ──
// In the column, in orc-gear. It marches at its own pace, quicker and
// slower as the drums say; keep to your place in the line (hurry or hang
// back). Out of it too long and the slaver's whip finds you; three times
// and they look at you properly. At the camp it halts, and you slip away.
export const MARCH = { length: 34, pace: 1.8, step: 1.3, slack: 1.1, hold: 1.1, lashes: 3, beats: [[0, 1], [5, 1.4], [10, 0.7], [15, 1.3], [20, 0.6], [25, 1.45], [30, 0.8]] };

export const newMarch = () => ({ t: 0, s: 0, off: 0, out: 0, lashes: 0, pace: 1, state: 'on' });
// the column's pace now, as a share of MARCH.pace
export const paceAt = (t) => MARCH.beats.reduce((p, [at, k]) => (t >= at ? k : p), 1);
// One step; `push` -1..1 (hang back, hurry). Events: 'beat' (the pace
// changes), 'drift' (you're out of your place), 'lash', 'caught', 'halt'.
export function stepMarch(m, dt, push = 0) {
  const ev = [];
  if (m.state !== 'on') return ev;
  m.t += dt;
  const pace = paceAt(m.t);
  if (pace !== m.pace) ev.push({ type: 'beat', pace });
  m.pace = pace;
  const theirs = MARCH.pace * pace;
  const yours = MARCH.pace + Math.max(-1, Math.min(1, push)) * MARCH.step;
  m.s += theirs * dt;
  m.off += (yours - theirs) * dt;
  if (Math.abs(m.off) > MARCH.slack) {
    if (m.out === 0) ev.push({ type: 'drift', ahead: m.off > 0 });
    m.out += dt;
    if (m.out >= MARCH.hold) {
      m.lashes += 1;
      m.out = 0;
      m.off = 0;
      ev.push({ type: 'lash' });
      if (m.lashes >= MARCH.lashes) {
        m.state = 'caught';
        ev.push({ type: 'caught' });
        return ev;
      }
    }
  } else m.out = 0;
  if (m.t >= MARCH.length) {
    m.state = 'halt';
    ev.push({ type: 'halt' });
  }
  return ev;
}

// ── Under the Eye ──
// Its searchlight sweeps to and fro across the plain, along a line that
// creeps towards wherever you are. In it and not in a rock's shadow, it
// starts to find you; long enough, and it has.
export const EYE = { sweep: 10, band: [-40, 70], hunt: 2.4, r: 9, found: 0.7, cool: 1.5 };

export const newSearch = (x = -700) => ({ t: 0, x, z: EYE.band[0], dir: 1, seen: 0, near: false, state: 'on' });
// One step; `hero` { x, z }, `hidden` true in a rock's shadow. Events:
// 'near' (the light's coming), 'seen' (it's on you), 'lost', 'found'.
export function stepSearch(e, dt, hero, hidden) {
  const ev = [];
  if (e.state !== 'on') return ev;
  e.t += dt;
  const [z0, z1] = EYE.band;
  e.z += e.dir * EYE.sweep * dt;
  if (e.z > z1) {
    e.z = z1;
    e.dir = -1;
  } else if (e.z < z0) {
    e.z = z0;
    e.dir = 1;
  }
  const dx = hero.x - e.x;
  e.x += Math.sign(dx) * Math.min(Math.abs(dx), EYE.hunt * dt);
  const d = Math.hypot(hero.x - e.x, hero.z - e.z);
  const near = d < EYE.r * 2.5;
  if (near && !e.near) ev.push({ type: 'near' });
  e.near = near;
  const lit = d < EYE.r && !hidden;
  if (lit) {
    if (e.seen === 0) ev.push({ type: 'seen' });
    e.seen += dt;
    if (e.seen >= EYE.found) {
      e.state = 'found';
      ev.push({ type: 'found' });
    }
  } else if (e.seen > 0) {
    e.seen = Math.max(0, e.seen - EYE.cool * dt);
    if (e.seen === 0) ev.push({ type: 'lost' });
  }
  return ev;
}

// ── I can carry you ──
// As Sam, with Frodo on your back, up the last of the road: step left,
// right, left (the same foot twice and you stumble). When the mountain
// shakes, stand still till it stops, or you slide back.
export const CARRY = { len: 36, stride: 1.1, tire: 0.06, rest: 0.22, stumble: 0.8, back: 1, tremors: [9, 19, 28], shake: 1.6, slide: 4 };

export const newCarry = () => ({ t: 0, s: 0, last: null, stamina: 1, stumbleT: 0, tremorT: 0, next: 0, state: 'on' });
// One step of time. Events: 'tremor', 'still' (it's over), 'top'.
export function stepCarry(c, dt) {
  const ev = [];
  if (c.state !== 'on') return ev;
  c.t += dt;
  c.stumbleT = Math.max(0, c.stumbleT - dt);
  c.stamina = Math.min(1, c.stamina + CARRY.rest * dt);
  if (c.tremorT > 0) {
    c.tremorT -= dt;
    if (c.tremorT <= 0) {
      c.tremorT = 0;
      ev.push({ type: 'still' });
    }
  } else if (c.next < CARRY.tremors.length && c.s >= CARRY.tremors[c.next]) {
    c.next += 1;
    c.tremorT = CARRY.shake;
    ev.push({ type: 'tremor' });
  }
  return ev;
}
// A step with `foot` ('left' or 'right'): 'step', 'stumble' (same foot
// twice), 'slide' (in a tremor), 'top', or null if you can't now.
export function carryStep(c, foot) {
  if (c.state !== 'on' || c.stumbleT > 0) return null;
  if (c.tremorT > 0) {
    c.s = Math.max(0, c.s - CARRY.slide);
    c.stumbleT = CARRY.stumble;
    c.last = null;
    return 'slide';
  }
  if (foot === c.last) {
    c.s = Math.max(0, c.s - CARRY.back);
    c.stumbleT = CARRY.stumble;
    c.last = null;
    return 'stumble';
  }
  c.last = foot;
  c.s = Math.min(CARRY.len, c.s + CARRY.stride * (0.45 + 0.55 * c.stamina));
  c.stamina = Math.max(0, c.stamina - CARRY.tire);
  if (c.s >= CARRY.len) {
    c.state = 'top';
    return 'top';
  }
  return 'step';
}

// ── Reach! ──
// Frodo hangs from the edge over the fire, his grip going. He looks down
// at the Ring, then up at you and reaches: hold to reach down to him, and
// your hand has to be all the way there while his is up.
export const HANG = { grip: 0.09, look: [1.6, 2.6], reach: 1.4, arm: 0.9, back: 0.6 };

export function newHang(seed = 3) {
  const rand = seeded(seed);
  return { t: 0, grip: 1, arm: 0, phase: 'look', phaseT: HANG.look[0] + rand() * (HANG.look[1] - HANG.look[0]), state: 'on', rand };
}
// One step; `hold` true while reaching. Events: 'reach' (he reaches up),
// 'look' (he looks down at the fire again), 'caught', 'lost'.
export function stepHang(g, dt, hold) {
  const ev = [];
  if (g.state !== 'on') return ev;
  g.t += dt;
  g.grip = Math.max(0, g.grip - HANG.grip * dt);
  g.arm = Math.max(0, Math.min(1, g.arm + (hold ? HANG.arm : -HANG.back) * dt));
  if (g.phase === 'reach' && g.arm >= 1) {
    g.state = 'caught';
    ev.push({ type: 'caught' });
    return ev;
  }
  if (g.grip <= 0) {
    g.state = 'lost';
    ev.push({ type: 'lost' });
    return ev;
  }
  g.phaseT -= dt;
  if (g.phaseT <= 0) {
    if (g.phase === 'look') {
      g.phase = 'reach';
      g.phaseT = HANG.reach;
      ev.push({ type: 'reach' });
    } else {
      g.phase = 'look';
      g.phaseT = HANG.look[0] + g.rand() * (HANG.look[1] - HANG.look[0]);
      ev.push({ type: 'look' });
    }
  }
  return ev;
}

// ── The eagles ──
// Gwaihir, with Frodo in his talons, out of the eruption: steer through
// the fountains of fire and the falling rock. Three hits and he's down to
// the rocks, and up again from further back.
export const FLIGHT = { len: 240, speed: 15, steer: 9, wide: 9, hit: 2.4, hits: 3, back: 50 };
export const BURSTS = (() => {
  const rand = seeded(41);
  const out = [];
  for (let s = 30; s < FLIGHT.len - 10; s += 11 + rand() * 9) out.push({ s, lat: (rand() * 2 - 1) * (FLIGHT.wide - 1.5) });
  return out;
})();

export const newFlight = () => ({ t: 0, s: 0, lat: 0, hits: 0, stunT: 0, state: 'on' });
// One step; `steer` -1..1. Events: 'hit', 'down', 'clear'.
export function stepFlight(f, dt, steer = 0) {
  const ev = [];
  if (f.state !== 'on') return ev;
  f.t += dt;
  f.stunT = Math.max(0, f.stunT - dt);
  f.lat = Math.max(-FLIGHT.wide, Math.min(FLIGHT.wide, f.lat + Math.max(-1, Math.min(1, steer)) * FLIGHT.steer * dt * (f.stunT > 0 ? 0.3 : 1)));
  const s0 = f.s;
  f.s += FLIGHT.speed * dt * (f.stunT > 0 ? 0.6 : 1);
  for (const b of BURSTS) {
    if (b.s > s0 && b.s <= f.s && Math.abs(f.lat - b.lat) < FLIGHT.hit) {
      f.hits += 1;
      f.stunT = 0.8;
      ev.push({ type: 'hit', at: b });
      if (f.hits >= FLIGHT.hits) {
        f.state = 'down';
        ev.push({ type: 'down' });
        return ev;
      }
    }
  }
  if (f.s >= FLIGHT.len) {
    f.state = 'clear';
    ev.push({ type: 'clear' });
  }
  return ev;
}
