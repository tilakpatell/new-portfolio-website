// Orthanc's games, as rules with no drawing, so they can be tested: looking
// into the palantír without being seen, the duel of the wizards, the long
// stair, the moth on the pinnacle, and Gwaihir's pass under it.
// ./OrthancWorld.jsx steps them; ./scene.js draws them.

export function seeded(seed = 1) {
  let s = seed % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
const between = (rand, [a, b]) => a + rand() * (b - a);

// ── The palantír ──
// Looking into the stone, the vision comes (`seen`, to 1). But something
// looks back: while you look, the Eye's `notice` grows, slowly at first and
// faster the longer you hold your gaze. Now and then it stirs (a warning),
// then turns to search the stone, and to be looking then is to be found.
// Look away and its notice fades, and your held gaze with it. See it all
// before it finds you.
export const STONE = { see: 0.1, notice: 0.035, held: 0.22, turnNotice: 0.7, fade: 0.32, gap: [3.2, 4.8], turnFor: [1.6, 2.2], warn: 0.9, first: 2.4 };

export function newGaze(seed = 3) {
  const rand = seeded(seed);
  return { t: 0, seen: 0, notice: 0, held: 0, looking: false, phase: 'still', phaseT: STONE.first, state: 'on', rand, stage: 'eye' };
}
// what the vision shows by now: the Eye, then the armies under Isengard
export const stageOf = (seen) => (seen < 0.5 ? 'eye' : 'army');
// One step; `look` true while you look into it. Events: 'stir' (it's about
// to turn), 'turn' (it searches: look away!), 'still' (it's turned away),
// 'stage' (the vision moves on), 'seen' (you've seen it all), 'found'.
export function stepGaze(g, dt, look) {
  const ev = [];
  if (g.state !== 'on') return ev;
  const S = STONE;
  g.t += dt;
  g.looking = Boolean(look);
  g.phaseT -= dt;
  if (g.phaseT <= 0) {
    if (g.phase === 'still') {
      g.phase = 'stir';
      g.phaseT = S.warn;
      ev.push({ type: 'stir' });
    } else if (g.phase === 'stir') {
      g.phase = 'turn';
      g.phaseT = between(g.rand, S.turnFor);
      ev.push({ type: 'turn' });
    } else {
      g.phase = 'still';
      g.phaseT = between(g.rand, S.gap);
      ev.push({ type: 'still' });
    }
  }
  if (look) {
    g.held += dt;
    g.seen = Math.min(1, g.seen + S.see * dt);
    g.notice += (S.notice * (1 + g.held * S.held) + (g.phase === 'turn' ? S.turnNotice : 0)) * dt;
  } else {
    g.held = Math.max(0, g.held - dt * 2);
    g.notice = Math.max(0, g.notice - S.fade * dt);
  }
  const stage = stageOf(g.seen);
  if (stage !== g.stage) {
    g.stage = stage;
    ev.push({ type: 'stage', stage });
  }
  if (g.notice >= 1) {
    g.notice = 1;
    g.state = 'found';
    ev.push({ type: 'found' });
  } else if (g.seen >= 1) {
    g.state = 'seen';
    ev.push({ type: 'seen' });
  }
  return ev;
}

// ── The duel of the wizards ──
// Saruman circles, then raises his staff (the tell) and strikes with it
// (the cast). Raise yours to turn the blow, late in the tell or as it
// falls, and he's thrown off balance for a moment (open): push him back
// then. An unturned blow costs you will; three and you're down. A block or a
// push at nothing leaves you fumbling for a moment, so it can't be mashed.
// Once you've pushed him back, he sometimes comes again straight away.
// Push him back three times to win the exchange.
export const DUEL = { idle: [0.9, 1.6], tell: 0.8, again: 0.55, cast: 0.3, open: 1.1, recover: 0.6, will: 3, pushes: 3, blockBefore: 0.3, fumble: 0.5, twice: 0.35 };

export function newDuel(seed = 5) {
  const rand = seeded(seed);
  return { t: 0, phase: 'idle', phaseT: between(rand, DUEL.idle), blocked: false, will: DUEL.will, pushes: 0, state: 'on', rand, fumble: 0, tellFor: DUEL.tell };
}
const toPhase = (d, phase, time) => {
  d.phase = phase;
  d.phaseT = time;
};
// One step. Events: 'tell', 'cast', 'hit', 'down', 'open', 'shut' (the
// opening passed, unused).
export function stepDuel(d, dt) {
  const ev = [];
  if (d.state !== 'on') return ev;
  d.t += dt;
  d.fumble = Math.max(0, d.fumble - dt);
  d.phaseT -= dt;
  if (d.phaseT > 0) return ev;
  if (d.phase === 'idle') {
    d.blocked = false;
    toPhase(d, 'tell', d.tellFor);
    d.tellFor = DUEL.tell;
    ev.push({ type: 'tell' });
  } else if (d.phase === 'tell') {
    toPhase(d, 'cast', DUEL.cast);
    ev.push({ type: 'cast' });
  } else if (d.phase === 'cast') {
    // it lands
    d.will -= 1;
    ev.push({ type: 'hit', will: d.will });
    if (d.will <= 0) {
      d.state = 'down';
      ev.push({ type: 'down' });
      return ev;
    }
    toPhase(d, 'recover', DUEL.recover);
  } else if (d.phase === 'open') {
    toPhase(d, 'idle', between(d.rand, DUEL.idle));
    ev.push({ type: 'shut' });
  } else toPhase(d, 'idle', between(d.rand, DUEL.idle));
  return ev;
}
// can the staff turn the blow now?
export const blockable = (d) => (d.phase === 'tell' && d.phaseT <= DUEL.blockBefore) || d.phase === 'cast';
// Raise the staff: 'blocked', 'early' (at nothing: you fumble), or null.
export function block(d) {
  if (d.state !== 'on' || d.fumble > 0) return null;
  if (!d.blocked && blockable(d)) {
    d.blocked = true;
    // once you've pushed him, he may come again at once rather than reel
    if (d.pushes > 0 && d.rand() < DUEL.twice) {
      d.tellFor = DUEL.again;
      toPhase(d, 'idle', 0.25);
    } else toPhase(d, 'open', DUEL.open);
    return 'blocked';
  }
  d.fumble = DUEL.fumble;
  return 'early';
}
// Push him back: 'pushed', 'won' with the last, 'miss' (you fumble), or null.
export function push(d) {
  if (d.state !== 'on' || d.fumble > 0) return null;
  if (d.phase === 'open') {
    d.pushes += 1;
    if (d.pushes >= DUEL.pushes) {
      d.state = 'won';
      return 'won';
    }
    toPhase(d, 'idle', between(d.rand, DUEL.idle));
    return 'pushed';
  }
  d.fumble = DUEL.fumble;
  return 'miss';
}

// ── The long stair ──
// On rails, up (or down) `len` metres of stair; Saruman a few steps behind.
// Each window, the first time you come to it, says so; the top ends it.
export const CLIMB = { speed: 2.6, back: 2, reach: 1.6 };

export const newStair = (s = 0) => ({ s, seen: [], state: 'on' });
// `dir` 1 up, -1 down, 0 still; `len` the stair's length, `windows` the s of
// each window. Events: 'window' (with its index), 'top'.
export function stepStair(c, dt, dir, len, windows = []) {
  const ev = [];
  if (c.state !== 'on') return ev;
  c.s = Math.max(0, Math.min(len, c.s + (dir > 0 ? CLIMB.speed : dir < 0 ? -CLIMB.back : 0) * dt));
  windows.forEach((w, i) => {
    if (!c.seen.includes(i) && Math.abs(c.s - w) < CLIMB.reach) {
      c.seen.push(i);
      ev.push({ type: 'window', i });
    }
  });
  if (c.s >= len) {
    c.state = 'top';
    ev.push({ type: 'top' });
  }
  return ev;
}
// the window you're at, if any
export const atWindow = (s, windows) => windows.findIndex((w) => Math.abs(s - w) < CLIMB.reach);

// ── The moth ──
// It flutters in the wind across the front of the pinnacle (`x`, -1..1).
// Keep your hand under it (A and D) and it slows, drawn to you, and settles
// at last. Gusts come (with a moment's warning) and throw it about. Leave
// your hand far from it too long and it flutters away, and comes back.
export const MOTH = { speed: 0.55, hand: 1.3, near: 0.17, settle: 2.4, lose: 0.45, gust: [4.5, 7], warn: 0.8, blow: 1.6, far: 0.5, away: 5 };

export function newMoth(seed = 7) {
  const rand = seeded(seed);
  return { t: 0, x: -0.7, vx: 0, goal: 0.6, hand: 0, settle: 0, far: 0, gust: 0, gustT: between(rand, MOTH.gust), warned: false, state: 'on', rand };
}
// One step; `steer` -1..1 moves your hand. Events: 'rising' (a gust is
// coming), 'gust', 'landed', 'gone'.
export function stepMoth(m, dt, steer = 0) {
  const ev = [];
  if (m.state !== 'on') return ev;
  const M = MOTH;
  m.t += dt;
  m.hand = Math.max(-1, Math.min(1, m.hand + Math.max(-1, Math.min(1, steer)) * M.hand * dt));
  // its wandering: towards a goal, a new one when it gets there; slower
  // over your hand
  const over = Math.abs(m.hand - m.x) < M.near;
  if (Math.abs(m.goal - m.x) < 0.05) m.goal = (m.rand() * 2 - 1) * 0.85;
  const want = Math.sign(m.goal - m.x) * M.speed * (over ? 0.25 : 1);
  m.vx += (want - m.vx) * Math.min(1, dt * 3);
  // the wind
  m.gustT -= dt;
  if (!m.warned && m.gustT <= M.warn) {
    m.warned = true;
    ev.push({ type: 'rising' });
  }
  if (m.gustT <= 0) {
    m.gust = (m.rand() < 0.5 ? -1 : 1) * M.blow;
    m.gustT = between(m.rand, M.gust);
    m.warned = false;
    ev.push({ type: 'gust' });
  }
  m.gust *= Math.max(0, 1 - dt * 2.2);
  m.x += (m.vx + m.gust) * dt;
  if (Math.abs(m.x) > 1) {
    m.x = Math.sign(m.x);
    m.goal = -m.goal;
    m.gust = 0;
  }
  // settling on your hand, or giving up on it
  if (Math.abs(m.hand - m.x) < M.near) m.settle = Math.min(1, m.settle + dt / M.settle);
  else m.settle = Math.max(0, m.settle - M.lose * dt);
  m.far = Math.abs(m.hand - m.x) > M.far ? m.far + dt : 0;
  if (m.settle >= 1) {
    m.state = 'landed';
    ev.push({ type: 'landed' });
  } else if (m.far >= M.away) {
    m.state = 'gone';
    ev.push({ type: 'gone' });
  }
  return ev;
}

// ── Gwaihir ──
// The Windlord sweeps round the tower and passes under the pinnacle's edge
// every `lap` seconds; jump while he's beneath you. Too soon, or too late,
// and you hold back on the edge (no harm done): he comes round again.
export const WIND = { first: 3.2, lap: 6.5, under: 1, coming: 1.4 };

export const newLeap = () => ({ t: 0, next: WIND.first, under: false, warned: false, state: 'on', passes: 0 });
// One step. Events: 'coming' (he's on his way in), 'under', 'past'.
export function stepLeap(l, dt) {
  const ev = [];
  if (l.state !== 'on') return ev;
  l.t += dt;
  if (!l.warned && l.t >= l.next - WIND.coming) {
    l.warned = true;
    ev.push({ type: 'coming' });
  }
  const under = l.t >= l.next && l.t < l.next + WIND.under;
  if (under && !l.under) ev.push({ type: 'under' });
  if (!under && l.under) {
    ev.push({ type: 'past' });
    l.passes += 1;
    l.next += WIND.lap;
    l.warned = false;
  }
  l.under = under;
  return ev;
}
// Jump: 'caught' while he's beneath you, 'wait' otherwise.
export function leap(l) {
  if (l.state !== 'on') return null;
  if (l.under) {
    l.state = 'caught';
    return 'caught';
  }
  return 'wait';
}
// where he is on his lap, 0..1, going round and round (0.5 is under the
// edge, in the middle of the time to jump)
export const lapOf = (l) => {
  const k = (l.t - (l.next + WIND.under / 2)) / WIND.lap + 0.5;
  return k - Math.floor(k);
};
