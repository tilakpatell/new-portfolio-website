// Cirith Ungol's games, as rules with no drawing, so they can be tested:
// not looking at Minas Morgul while its host goes by, the endless stairs,
// the phial in Shelob's lair, Sam's fight with her, and the orcs in the
// Tower (../watchers.js). ./CirithUngolWorld.jsx steps them; ./scene.js
// draws them.

export function seeded(seed = 1) {
  let s = seed % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── Minas Morgul ──
// The Ring turns your eyes to the city. `gaze` is how far your eyes are
// from it (radians; 0 is looking straight at it): it drifts towards 0,
// faster while the Witch-king stops on the bridge and feels for you, and
// you steer it away. Looking at the city (inside `cone`), the pull grows;
// at 1, you stand up and walk out into the open. Keep it off till the
// host has passed.
export const MORGUL = { length: 24, drift: 0.55, pause: [8, 16.5], pauseFor: 2.6, pauseDrift: 1.5, steer: 1.6, cone: 0.35, rise: 0.75, fall: 0.25, wide: 1.4, jitter: 0.35 };

export function newMorgul(seed = 4) {
  return { t: 0, gaze: 0.9, pull: 0, pausing: false, state: 'on', rand: seeded(seed), wob: 0 };
}
// One step; `steer` -1..1 (either way turns your eyes from the city, the
// way you're already looking). Events: 'pause' (he stops and feels for
// you), 'on' (he rides on), 'stood', 'passed'.
export function stepMorgul(m, dt, steer = 0) {
  const ev = [];
  if (m.state !== 'on') return ev;
  const M = MORGUL;
  m.t += dt;
  const pausing = M.pause.some((p) => m.t >= p && m.t < p + M.pauseFor);
  if (pausing && !m.pausing) ev.push({ type: 'pause' });
  if (!pausing && m.pausing) ev.push({ type: 'on' });
  m.pausing = pausing;
  // a little wobble, so it's never quite still
  m.wob += (m.rand() - 0.5) * M.jitter * dt * 6;
  m.wob *= Math.max(0, 1 - dt * 2);
  const side = m.gaze >= 0 ? 1 : -1;
  const drift = (pausing ? M.pauseDrift : M.drift) * dt;
  m.gaze -= side * Math.min(Math.abs(m.gaze), drift);
  m.gaze += Math.max(-1, Math.min(1, steer)) * M.steer * dt + m.wob * dt;
  m.gaze = Math.max(-M.wide, Math.min(M.wide, m.gaze));
  if (Math.abs(m.gaze) < M.cone) m.pull += M.rise * (pausing ? 1.6 : 1) * dt;
  else m.pull = Math.max(0, m.pull - M.fall * dt);
  if (m.pull >= 1) {
    m.state = 'stood';
    ev.push({ type: 'stood' });
  } else if (m.t >= M.length) {
    m.state = 'passed';
    ev.push({ type: 'passed' });
  }
  return ev;
}

// ── The stairs ──
// Up `len` metres of stair. Climbing tires you; standing still rests you,
// best on the ledges. Spent, you have to stop. Stand still too long where
// it's crumbling and it goes, and you slide back to the ledge below.
export const STAIRS = { len: 96, speed: 1.7, tire: 0.05, rest: 0.12, ledgeRest: 0.45, ledges: [0, 24, 50, 76], crumble: [[34, 42], [60, 68], [82, 90]], hold: 0.7, again: 0.35 };

export const newClimb = () => ({ t: 0, s: 0, stamina: 1, spent: false, still: 0, state: 'on' });
export const onLedge = (s) => STAIRS.ledges.some((l) => Math.abs(s - l) < 2.5);
export const crumbling = (s) => STAIRS.crumble.some(([a, b]) => s >= a && s <= b);
// One step; `up` true while climbing. Events: 'spent', 'slip' (back to
// the ledge below), 'top'.
export function stepClimb(c, dt, up) {
  const ev = [];
  if (c.state !== 'on') return ev;
  const S = STAIRS;
  c.t += dt;
  if (c.spent && c.stamina >= S.again) c.spent = false;
  const climbing = up && !c.spent;
  if (climbing) {
    c.s = Math.min(S.len, c.s + S.speed * dt);
    c.stamina = Math.max(0, c.stamina - S.tire * dt);
    c.still = 0;
    if (c.stamina <= 0) {
      c.spent = true;
      ev.push({ type: 'spent' });
    }
  } else {
    c.stamina = Math.min(1, c.stamina + (onLedge(c.s) ? S.ledgeRest : S.rest) * dt);
    c.still += dt;
    if (crumbling(c.s) && c.still >= S.hold) {
      c.s = Math.max(...S.ledges.filter((l) => l <= c.s));
      c.still = 0;
      ev.push({ type: 'slip' });
    }
  }
  if (c.s >= S.len) {
    c.state = 'top';
    ev.push({ type: 'top' });
  }
  return ev;
}

// ── Shelob's lair ──
// She hunts you through the tunnels (../watchers.js with SHELOB). The
// phial drives her back while it shines and she's within `reach`, but its
// light fades while you hold it up, and comes back slowly.
export const SHELOB = { sight: 6, cone: 1.1, smell: 2.6, hear: 6, ringSight: 0, alert: 0.5, chase: 3.4, patrol: 1.4, giveUp: 6, leash: 40, catch: 1.5, look: 1.4 };
export const PHIAL = { use: 0.16, back: 0.05, again: 0.25, reach: 7 };

export const newPhial = () => ({ charge: 1, on: false, out: false });
// One step; `hold` true while raising it. Events: 'lit', 'dim' (it's run
// out), 'down'.
export function stepPhial(p, dt, hold) {
  const ev = [];
  if (p.out && p.charge >= PHIAL.again) p.out = false;
  const on = hold && !p.out;
  if (on && !p.on) ev.push({ type: 'lit' });
  if (!on && p.on) ev.push({ type: 'down' });
  p.on = on;
  p.charge = Math.max(0, Math.min(1, p.charge + (on ? -PHIAL.use : PHIAL.back) * dt));
  if (p.charge <= 0 && !p.out) {
    p.out = true;
    p.on = false;
    ev.push({ type: 'dim' });
  }
  return ev;
}
// does the light drive her back, `d` metres off?
export const recoils = (p, d) => p.on && d < PHIAL.reach;

// ── Samwise the Brave ──
// Shelob stalks, then either strikes (a tell first: dodge) or rears up
// (stab her then). Hit three times and you go down; stab her four times
// and she crawls away.
export const DUEL = { stalk: [1.1, 2], tell: 0.7, strike: 0.35, rear: 1.1, recover: 0.6, hearts: 3, wounds: 4, rearOdds: 0.45, tired: 0.4 };

export function newDuel(seed = 6) {
  const rand = seeded(seed);
  return { t: 0, phase: 'stalk', phaseT: DUEL.stalk[0] + rand() * (DUEL.stalk[1] - DUEL.stalk[0]), dodged: false, hearts: DUEL.hearts, wounds: 0, state: 'on', rand, lunges: 0, tired: 0 };
}
const nextPhase = (d) => {
  if (d.phase === 'stalk') {
    // she rears at least every third time
    const rear = d.lunges >= 2 || d.rand() < DUEL.rearOdds;
    d.phase = rear ? 'rear' : 'tell';
    d.phaseT = rear ? DUEL.rear : DUEL.tell;
    if (rear) d.lunges = 0;
    else d.lunges += 1;
  } else if (d.phase === 'tell') {
    d.phase = 'strike';
    d.phaseT = DUEL.strike;
  } else if (d.phase === 'strike' || d.phase === 'rear') {
    d.phase = 'recover';
    d.phaseT = DUEL.recover;
  } else {
    d.phase = 'stalk';
    d.phaseT = DUEL.stalk[0] + d.rand() * (DUEL.stalk[1] - DUEL.stalk[0]);
    d.dodged = false;
  }
};
// One step. Events: 'tell', 'strike', 'rear', 'hit' (she got you),
// 'down' (you're beaten), 'fled' (she's beaten).
export function stepDuel(d, dt) {
  const ev = [];
  if (d.state !== 'on') return ev;
  d.t += dt;
  d.tired = Math.max(0, d.tired - dt);
  d.phaseT -= dt;
  if (d.phaseT > 0) return ev;
  const was = d.phase;
  if (was === 'strike' && !d.dodged) {
    d.hearts -= 1;
    ev.push({ type: 'hit' });
    if (d.hearts <= 0) {
      d.state = 'down';
      ev.push({ type: 'down' });
      return ev;
    }
  }
  nextPhase(d);
  if (d.phase === 'tell' || d.phase === 'strike' || d.phase === 'rear') ev.push({ type: d.phase });
  return ev;
}
// Dodge: 'dodged' in the tell or the strike, 'early' otherwise (and you're
// off balance for a moment).
export function dodge(d) {
  if (d.state !== 'on' || d.tired > 0) return null;
  if (d.phase === 'tell' || d.phase === 'strike') {
    d.dodged = true;
    return 'dodged';
  }
  d.tired = DUEL.tired;
  return 'early';
}
// Stab: 'wound' while she rears, 'fled' with the last, 'miss' otherwise.
export function stab(d) {
  if (d.state !== 'on' || d.tired > 0) return null;
  if (d.phase === 'rear') {
    d.wounds += 1;
    d.phase = 'recover';
    d.phaseT = DUEL.recover * 1.6;
    if (d.wounds >= DUEL.wounds) {
      d.state = 'fled';
      return 'fled';
    }
    return 'wound';
  }
  d.tired = DUEL.tired;
  return 'miss';
}

// ── The Tower ──
export const ORCS = { sight: 9, cone: 0.7, smell: 1.3, hear: 3.2, ringSight: 0, alert: 0.45, chase: 4.4, patrol: 1.5, giveUp: 3.5, leash: 20, catch: 1.3, look: 1.2 };
