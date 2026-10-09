// Smash Run: the rules, apart from the drawing, so they can be tested.
//
// Hulk charges down a Midtown street in 2012, the portal open over Stark
// Tower, through the Chitauri. Three lanes; he runs on his own and keeps
// getting faster. In his way: soldiers and barricades (smash them in time, or
// leap them), wrecked cars (the same, for more), craters (leap them), the
// Chitauri's energy walls (go round), and chariots, which paint a lane red
// before they strafe it (get out of it, or be in the air when it goes up).
// Every smash feeds his rage; full rage is HULK SMASH: eight seconds where
// nothing stops him. Three hits and Banner is back. The Time Stone is at
// 2,000 m; the run goes on after it, for distance.
//
// Metres: `d` is how far he's run; an obstacle sits at `at` (its near edge)
// and is `len` long; lanes are -1, 0 and 1, LANE metres apart.

import { createCooldownPress } from '../../../lib/press';
import { rng } from '../hq/rng';

export const LANE = 3.2;
export const STONE_AT = 2000;
export const RUN = {
  hearts: 3,
  buffer: 0.12, // s: a leap or a smash pressed this soon before he can still goes
  speed: [14, 30], // m/s at the start and as it levels off
  ramp: 1500, // metres for most of the rise
  laneSpeed: 15, // m/s sideways
  halfWidth: 0.75, // his half-width, for what he runs into
  leapTime: 0.85,
  leapHeight: 3.2,
  smashTime: 0.32, // a swing: fists come down over this long
  smashReach: 4.2, // how far ahead a swing reaches
  perfect: 2.6, // this close when it breaks is a perfect smash (a late swing)
  whiff: 0.45, // winded after a swing that hit nothing
  invulnerable: 1.3, // after a hit
  stagger: 0.35, // the speed lost to a hit (recovers)
  rage: 8,
  safe: 150, // the opening: soldiers and barricades only
  healEvery: 500, // a heart back every so often, if one's missing
};

// What can be in the way. smash: a swing breaks it; leap: he can clear it in
// the air; w: across the lane; len: along the street; h: its height, for the
// drawing; rage and score for smashing it.
export const KINDS = {
  soldier: { smash: true, leap: true, w: 1, len: 0.8, h: 1.9, rage: 12, score: 50, walk: 2.2 },
  barricade: { smash: true, leap: true, w: 3, len: 0.6, h: 1.1, rage: 10, score: 40 },
  car: { smash: true, leap: true, w: 2, len: 4.4, h: 1.5, rage: 20, score: 120 },
  crater: { smash: false, leap: true, w: 3.2, len: 4.2, h: 0, rage: 0, score: 0 },
  barrier: { smash: false, leap: false, w: 3, len: 0.5, h: 4, rage: 0, score: 0 },
};

// The order things come in, and the distance each first appears.
export const UNLOCK = [
  ['soldier', 0],
  ['barricade', 60],
  ['car', 280],
  ['crater', 440],
  ['barrier', 620],
  ['chariot', 820],
];

// Chariot runs: the lane glows red for `warn` seconds, then burns for `burn`.
export const CHARIOT = { warn: 1.5, burn: 0.55, reach: [-2, 30] };

export const speedAt = (d) => RUN.speed[0] + (RUN.speed[1] - RUN.speed[0]) * (1 - Math.exp(-d / RUN.ramp));

export function newRun({ seed = 1 } = {}) {
  const g = { seed, phase: 'ready', queue: [] };
  reset(g);
  return g;
}

function reset(g) {
  g.rand = rng(g.seed);
  g.t = 0;
  g.d = 0;
  g.speed = RUN.speed[0];
  g.score = 0;
  g.smashes = 0;
  g.perfects = 0;
  g.hulk = { lane: 0, x: 0, y: 0, air: 0, smash: -1, smashHit: false, winded: 0, hp: RUN.hearts, hurt: 0, stagger: 0, rage: 0, raging: 0 };
  g.obstacles = [];
  g.chariots = [];
  g.nextId = 1;
  g.built = 0; // the course is laid out up to here
  g.section = -1;
  g.sectionEnd = 0;
  g.sections = [];
  g.cur = null;
  g.seen = new Set();
  g.stone = false;
  g.healed = 0;
  g.bestStreak = 0;
  g.streak = 0;
  g.held = { leap: createCooldownPress({ buffer: RUN.buffer }), smash: createCooldownPress({ buffer: RUN.buffer }) };
}

export function startRun(g) {
  reset(g);
  g.phase = 'run';
  g.queue.push({ type: 'start' });
  build(g, g.d + 260);
  return g.queue.splice(0);
}

// ── input ──
const live = (g) => g.phase === 'run';
export function moveLane(g, dir) {
  if (!live(g)) return false;
  const lane = Math.max(-1, Math.min(1, g.hulk.lane + Math.sign(dir)));
  if (lane === g.hulk.lane) return false;
  g.hulk.lane = lane;
  g.queue.push({ type: 'lane', lane });
  return true;
}
// A leap or a smash he can't do yet (in the air, mid-swing, winded) is
// held a moment (lib/press.js's buffer) and goes as soon as he can: pressed
// a hair before he lands, it isn't lost. stepRun fires a held one.
const canLeap = (H) => H.air <= 0 && H.smash < 0;
const canSmash = (H) => H.air <= 0 && H.smash < 0 && H.winded <= 0;
function doLeap(g) {
  g.hulk.air = RUN.leapTime;
  g.queue.push({ type: 'leap' });
}
function doSmash(g) {
  g.hulk.smash = 0;
  g.hulk.smashHit = false;
  g.queue.push({ type: 'swing' });
}
export function leap(g) {
  if (!live(g)) return false;
  if (!canLeap(g.hulk)) {
    g.held.leap.press();
    return false;
  }
  doLeap(g);
  return true;
}
export function smash(g) {
  if (!live(g)) return false;
  if (!canSmash(g.hulk)) {
    g.held.smash.press();
    return false;
  }
  doSmash(g);
  return true;
}

// ── the course ──
// Sections alternate busy and open; each new kind of obstacle comes in on
// its own, in an open section, before it's mixed with the rest.
const SECTION_TITLES = {
  soldier: 'Chitauri on foot',
  barricade: 'Barricades',
  car: 'Wrecked cars',
  crater: 'Craters',
  barrier: 'Energy walls',
  chariot: 'Chariots',
};

function add(g, kind, at, lane, extra = {}) {
  const K = KINDS[kind];
  const o = { id: g.nextId++, kind, at, lane, x: lane * LANE, w: K.w, len: K.len, broken: false, passed: false, ...extra };
  if (kind === 'crater' && extra.wide) {
    o.x = 0;
    o.w = LANE * 3;
  }
  g.obstacles.push(o);
  return o;
}

const lanes = [-1, 0, 1];
function shuffle(r, list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// one row of things across the street at `at`, from the kinds open to it;
// at least one lane is always passable (smash, leap, or empty)
function row(g, at, pool, dense) {
  const r = g.rand;
  const kinds = pool.filter((k) => k !== 'chariot');
  const pickKind = () => kinds[Math.floor(r() * kinds.length)];
  const roll = r();
  // a crater across the whole street: leap it
  if (kinds.includes('crater') && roll < 0.12) {
    add(g, 'crater', at, 0, { wide: true });
    return 6;
  }
  // a wall of barricades: smash one, or leap
  if (kinds.includes('barricade') && roll < 0.24) {
    for (const l of lanes) add(g, 'barricade', at, l);
    return 3;
  }
  const n = dense ? (r() < 0.55 ? 2 : 1) : 1;
  const used = shuffle(r, lanes).slice(0, n);
  let walls = 0;
  let len = 1;
  for (const l of used) {
    let kind = pickKind();
    // never more than one wall in a row, so two lanes stay open
    if (kind === 'barrier' && walls >= 1) kind = kinds.includes('car') ? 'car' : 'soldier';
    if (kind === 'barrier') walls++;
    if (kind === 'soldier' && dense && r() < 0.4) {
      // a pair, one behind the other
      add(g, 'soldier', at, l);
      add(g, 'soldier', at + 3.5, l);
      len = Math.max(len, 4.5);
    } else {
      add(g, kind, at, l);
      len = Math.max(len, KINDS[kind].len);
    }
  }
  return len;
}

function newSection(g) {
  const r = g.rand;
  g.section++;
  const d = g.sectionEnd;
  const pool = UNLOCK.filter(([, at]) => d >= at).map(([k]) => k);
  // the first section a kind is open in introduces it
  const fresh = UNLOCK.find(([k, at]) => d >= at && !g.seen.has(k));
  let sec;
  if (d < RUN.safe) sec = { kind: 'safe', len: RUN.safe - d, pool: ['soldier', ...(d >= 60 ? ['barricade'] : [])], gap: [24, 30] };
  else if (fresh) sec = { kind: 'intro', len: 120, pool: [fresh[0]], also: pool.filter((k) => k === 'soldier'), gap: [22, 28], title: SECTION_TITLES[fresh[0]] };
  else if (g.section % 2) sec = { kind: 'open', len: 90 + r() * 50, pool: pool.filter((k) => KINDS[k]?.smash), gap: [18, 26], title: 'Open road' };
  else sec = { kind: 'busy', len: 140 + r() * 60, pool, gap: [11, 16], title: 'Midtown' };
  if (fresh) g.seen.add(fresh[0]);
  sec.start = d;
  sec.n = g.section;
  g.sectionEnd = d + sec.len;
  g.sections = g.sections ?? [];
  g.sections.push(sec);
  return sec;
}

// lay the course out ahead, to `to`
function build(g, to) {
  const r = g.rand;
  while (g.built < to) {
    if (g.built >= g.sectionEnd || !g.cur) {
      g.cur = newSection(g);
      // a breath at the start of each section
      g.built = Math.max(g.built, g.cur.start + (g.cur.kind === 'safe' ? 40 : 12));
      if (g.cur.title) g.cur.titleAt = g.built - 30;
      continue;
    }
    const sec = g.cur;
    const sp = speedAt(g.built);
    // gaps grow with speed, so there's always time to react
    const k = sp / RUN.speed[0];
    const gap = (sec.gap[0] + r() * (sec.gap[1] - sec.gap[0])) * (0.55 + 0.45 * k);
    let at = g.built;
    if (sec.kind === 'intro') {
      const kind = sec.pool[0];
      if (kind === 'chariot') {
        g.chariots.push({ id: g.nextId++, at, lane: lanes[Math.floor(r() * 3)], state: 'waiting', t: 0 });
        // and a soldier to deal with while it comes
        if (r() < 0.5) add(g, 'soldier', at - 10, lanes[Math.floor(r() * 3)]);
        g.built = at + gap * 2.4;
        continue;
      } else if (kind === 'crater') add(g, 'crater', at, r() < 0.5 ? 0 : lanes[Math.floor(r() * 3)], { wide: r() < 0.5 });
      else add(g, kind, at, lanes[Math.floor(r() * 3)]);
      g.built = at + gap * 1.15;
      continue;
    }
    if (sec.kind === 'busy' && sec.pool.includes('chariot') && r() < 0.18) {
      g.chariots.push({ id: g.nextId++, at, lane: lanes[Math.floor(r() * 3)], state: 'waiting', t: 0 });
      g.built = at + gap * 1.6;
      continue;
    }
    const extra = row(g, at, sec.pool, sec.kind === 'busy');
    g.built = at + Math.max(gap, extra + 6);
  }
}

// ── the run ──
const overlapX = (H, o) => Math.abs(H.x - o.x) < o.w / 2 + RUN.halfWidth;

function hurt(g, by, o, ev) {
  const H = g.hulk;
  if (H.raging > 0 || H.hurt > 0) return;
  H.hp = Math.max(0, H.hp - 1);
  H.hurt = RUN.invulnerable;
  H.stagger = 1;
  g.streak = 0;
  ev.push({ type: 'hit', by, id: o?.id, kind: o?.kind, hp: H.hp, x: H.x, at: g.d });
  if (H.hp <= 0) {
    g.phase = 'lost';
    ev.push({ type: 'lost', d: g.d, score: Math.round(g.score), stone: g.stone });
  }
}

function breakIt(g, o, ev, { perfect = false, rage = false } = {}) {
  const K = KINDS[o.kind];
  o.broken = true;
  const H = g.hulk;
  const mult = (perfect ? 1.5 : 1) * (rage ? 2 : 1);
  const score = Math.round(K.score * mult);
  g.score += score;
  g.smashes++;
  g.streak++;
  g.bestStreak = Math.max(g.bestStreak, g.streak);
  if (perfect) g.perfects++;
  ev.push({ type: 'smash', id: o.id, kind: o.kind, perfect, rage, score, x: o.x, at: o.at, ahead: o.at - g.d });
  if (H.raging <= 0) {
    const was = H.rage;
    H.rage = Math.min(100, H.rage + K.rage + (perfect ? 6 : 0));
    if (was < 100 && H.rage >= 100) {
      H.raging = RUN.rage;
      H.rage = 100;
      ev.push({ type: 'rage' });
    }
  }
}

export function stepRun(g, dt) {
  const ev = g.queue.splice(0);
  if (!live(g)) return ev;
  const H = g.hulk;
  g.t += dt;
  // a press held from a moment ago, now he can
  g.held.leap.ready(canLeap(H), dt);
  g.held.smash.ready(canSmash(H), dt);
  if (g.held.smash.take()) doSmash(g);
  else if (g.held.leap.take()) doLeap(g);
  ev.push(...g.queue.splice(0));

  // speed: the course's, less a stumble after a hit, more in a rage
  H.stagger = Math.max(0, H.stagger - dt / 1.4);
  g.speed = speedAt(g.d) * (1 - RUN.stagger * H.stagger) + (H.raging > 0 ? 4 : 0);
  const was = g.d;
  g.d += g.speed * dt;
  g.score += g.speed * dt;
  build(g, g.d + 260);

  // sideways to his lane
  const tx = H.lane * LANE;
  const step = RUN.laneSpeed * dt;
  H.x = Math.abs(tx - H.x) <= step ? tx : H.x + Math.sign(tx - H.x) * step;

  // the leap
  if (H.air > 0) {
    H.air = Math.max(0, H.air - dt);
    const k = 1 - H.air / RUN.leapTime;
    H.y = 4 * RUN.leapHeight * k * (1 - k);
    if (H.air <= 0) {
      H.y = 0;
      ev.push({ type: 'land', x: H.x });
    }
  }
  const airborne = H.air > 0.06 && H.air < RUN.leapTime - 0.04;

  // the swing
  H.winded = Math.max(0, H.winded - dt);
  if (H.smash >= 0) {
    H.smash += dt;
    const reach = RUN.smashReach;
    for (const o of g.obstacles) {
      if (o.broken || !KINDS[o.kind].smash || !overlapX(H, o)) continue;
      const ahead = o.at - g.d;
      if (ahead > reach || ahead + o.len < -0.4) continue;
      breakIt(g, o, ev, { perfect: ahead < RUN.perfect, rage: H.raging > 0 });
      H.smashHit = true;
    }
    if (H.smash >= RUN.smashTime) {
      if (!H.smashHit) {
        H.winded = RUN.whiff;
        ev.push({ type: 'whiff' });
      }
      H.smash = -1;
    }
  }

  // rage
  if (H.raging > 0) {
    H.raging = Math.max(0, H.raging - dt);
    H.rage = (H.raging / RUN.rage) * 100;
    if (H.raging <= 0) {
      H.rage = 0;
      ev.push({ type: 'calm' });
    }
  }
  H.hurt = Math.max(0, H.hurt - dt);

  // what he runs into
  for (const o of g.obstacles) {
    if (o.broken || o.passed) continue;
    const K = KINDS[o.kind];
    if (o.kind === 'soldier' && !o.passed) o.at -= K.walk * dt; // they come at him
    const ahead = o.at - g.d;
    if (ahead + o.len < -1) {
      o.passed = true;
      if (!o.hit) ev.push({ type: 'pass', id: o.id, kind: o.kind });
      continue;
    }
    if (ahead > 0.6 || ahead + o.len < -0.6 || !overlapX(H, o)) continue;
    if (H.raging > 0) {
      // nothing stops him: he goes through it, or over it
      if (K.smash || o.kind === 'barrier') breakIt(g, o, ev, { rage: true });
      else if (o.kind === 'crater' && !airborne && H.air <= 0) {
        H.air = RUN.leapTime * 0.7; // he bounds over
        ev.push({ type: 'leap', auto: true });
      }
      continue;
    }
    if (airborne && K.leap) continue;
    if (o.hit) continue;
    o.hit = true;
    if (K.smash) o.broken = true; // he goes through it, but it costs him
    hurt(g, o.kind, o, ev);
    if (!live(g)) return ev;
  }

  // chariots: wait out of sight, warn, burn the lane, go
  for (const c of g.chariots) {
    if (c.state === 'done') continue;
    if (c.state === 'waiting') {
      if (g.d >= c.at - 70) {
        c.state = 'warn';
        c.t = 0;
        // it comes down the lane he's in now, most of the time
        if (g.rand() < 0.65) c.lane = H.lane;
        ev.push({ type: 'warn', id: c.id, lane: c.lane });
      }
      continue;
    }
    c.t += dt;
    if (c.state === 'warn' && c.t >= CHARIOT.warn) {
      c.state = 'burn';
      c.t = 0;
      ev.push({ type: 'burn', id: c.id, lane: c.lane });
    }
    if (c.state === 'burn') {
      // it burns the ground: he's safe out of the lane, or off the ground
      if (Math.abs(H.x - c.lane * LANE) < 1.2 && H.air <= 0) {
        if (H.raging <= 0 && !c.hit) {
          c.hit = true;
          hurt(g, 'chariot', null, ev);
          if (!live(g)) return ev;
        }
      }
      if (c.t >= CHARIOT.burn) {
        c.state = 'done';
        ev.push({ type: 'gone', id: c.id, lane: c.lane, hit: !!c.hit });
      }
    }
  }

  // titles as sections come up
  for (const s of g.sections) {
    if (!s.announced && s.titleAt != null && g.d >= s.titleAt) {
      s.announced = true;
      ev.push({ type: 'section', title: s.title, kind: s.kind, fresh: s.kind === 'intro' ? s.pool[0] : null });
    }
  }

  // a heart back now and then
  const marks = Math.floor(g.d / RUN.healEvery);
  if (marks > g.healed) {
    g.healed = marks;
    if (H.hp < RUN.hearts) {
      H.hp++;
      ev.push({ type: 'heal', hp: H.hp });
    }
    ev.push({ type: 'mark', d: marks * RUN.healEvery });
  }

  // the Time Stone
  if (!g.stone && was < STONE_AT && g.d >= STONE_AT) {
    g.stone = true;
    ev.push({ type: 'stone', d: g.d, score: Math.round(g.score) });
  }

  // forget what's well behind
  if (g.obstacles.length > 80) g.obstacles = g.obstacles.filter((o) => o.at + o.len > g.d - 30);
  if (g.chariots.length > 12) g.chariots = g.chariots.filter((c) => c.state !== 'done');
  return ev;
}

// The things in the next `range` metres, nearest first (for a bot or the HUD).
export const upcoming = (g, range = 60) => g.obstacles.filter((o) => !o.broken && !o.passed && o.at + o.len > g.d - 0.5 && o.at - g.d < range).sort((a, b) => a.at - b.at);
