// Portal panic: the rules, with no drawing in them. A twin-stick arena game
// across four dimensions: move with one stick (or WASD), aim with the other
// (or the mouse; with neither, the gun finds the nearest enemy), fire, and
// portal-dash out of trouble. Enemies pour out of portals in three waves per
// dimension; after each wave you pick one of three gadgets from Rick's
// workbench; a boss closes each dimension, and beating it carries you
// through a portal to the next.
//
// The arena is a disc of radius PANIC.arena on the ground plane: x to the
// right, y toward the camera. Everything is seeded and runs in fixed steps,
// so a seed and a list of inputs always play out the same; the host drains
// g.events for sounds and callouts, and the drawing for the bodies: an
// event about an enemy carries its `id` (kill, hit, windup, a bolt it
// fired, a punch it took, a hurt it gave), one about a Meeseeks from the
// box its `ally` (its index in g.allies as it happened), and a boss's says
// `boss`.

import { createCooldownPress } from '../../../lib/press';

export const PANIC = {
  step: 1 / 120,
  arena: 15.5,
  travel: 2.6, // seconds through the portal between dimensions
  heroes: {
    rick: { name: 'Rick', hp: 4, speed: 6.2, fire: 5.5, dmg: 1, shotSpeed: 24, dashes: 2, recharge: 2.4, r: 0.5 },
    morty: { name: 'Morty', hp: 5, speed: 6.0, fire: 4.6, dmg: 1, shotSpeed: 22, dashes: 2, recharge: 2.0, r: 0.45 },
    pickle: { name: 'Pickle Rick', hp: 3, speed: 7.0, fire: 6.5, dmg: 1.25, shotSpeed: 26, dashes: 3, recharge: 2.6, r: 0.42 },
  },
  levels: {
    easy: { name: 'Morty', hp: 1, enemyHp: 0.75, count: 0.75, bolt: 0.82, fire: 0.8, boss: 0.8 },
    normal: { name: 'Rick', hp: 0, enemyHp: 1, count: 1, bolt: 1, fire: 1, boss: 1 },
    hard: { name: 'Rickest Rick', hp: -1, enemyHp: 1.35, count: 1.3, bolt: 1.18, fire: 1.35, boss: 1.4 },
  },
  dash: { dist: 5, time: 0.12, inv: 0.38 },
  hitInv: 1.1,
  shot: { life: 0.9, r: 0.16 },
  magnet: 2.4,
  enemies: {
    meeseeks: { name: 'Mr. Meeseeks', hp: 2, r: 0.42, speed: 4.3, score: 20, seeds: 1 },
    gromflomite: { name: 'Gromflomite', hp: 3, r: 0.5, speed: 3.4, score: 30, seeds: 1, keep: [6, 10], fire: 1.8, bolt: 9.5 },
    cronenberg: { name: 'Cronenberg', hp: 5, r: 0.72, speed: 2.5, score: 40, seeds: 2, split: 2 },
    blob: { name: 'Cronenblob', hp: 1, r: 0.38, speed: 4.8, score: 10, seeds: 0 },
    gazorpian: { name: 'Gazorpian', hp: 10, r: 0.85, speed: 2.1, score: 80, seeds: 3, windup: 0.75, charge: 13, chargeTime: 0.55, cooldown: 2.6, reach: 11 },
    cop: { name: 'Cop Rick', hp: 4, r: 0.5, speed: 3.1, score: 50, seeds: 2, keep: [7, 11], fire: 2.5, bolt: 9, burst: 3 },
    morty: { name: 'Morty clone', hp: 1.5, r: 0.42, speed: 5.0, score: 15, seeds: 1 },
  },
  bosses: {
    snowball: { name: 'Snowball', hp: 120, r: 1.5, speed: 3.0, seeds: 14 },
    cronenberg: { name: 'The big Cronenberg', hp: 160, r: 2.1, speed: 1.7, seeds: 16 },
    cromulon: { name: 'The Cromulon', hp: 170, r: 3, speed: 0, seeds: 18 },
    evilmorty: { name: 'Evil Morty', hp: 180, r: 0.6, speed: 4.2, seeds: 20 },
  },
  dims: [
    {
      id: 'backyard',
      name: 'The Smiths’ backyard',
      where: 'Earth, dimension C-137',
      props: ['tree', 'tree', 'bush', 'rock', 'bush'],
      waves: [[['meeseeks', 6]], [['meeseeks', 5], ['gromflomite', 4]], [['gromflomite', 5], ['meeseeks', 8]]],
      boss: 'snowball',
    },
    {
      id: 'cronenberg',
      name: 'Cronenberg World',
      where: 'Earth, the dimension Rick ruined',
      props: ['flesh', 'flesh', 'stump', 'rock', 'mushroom'],
      waves: [[['cronenberg', 5], ['meeseeks', 3]], [['cronenberg', 6], ['gromflomite', 3]], [['cronenberg', 7], ['meeseeks', 6], ['gromflomite', 2]]],
      boss: 'cronenberg',
    },
    {
      id: 'gazorpazorp',
      name: 'Gazorpazorp',
      where: 'Gazorpazorp, where the Gazorpians live',
      props: ['spire', 'spire', 'crystal', 'rock', 'cactus'],
      waves: [[['gazorpian', 3], ['meeseeks', 5]], [['gazorpian', 4], ['gromflomite', 4]], [['gazorpian', 5], ['cronenberg', 4], ['gromflomite', 2]]],
      boss: 'cromulon',
    },
    {
      id: 'citadel',
      name: 'The Citadel of Ricks',
      where: 'The Citadel, between dimensions',
      props: ['console', 'console', 'pillar', 'crate', 'pillar'],
      waves: [[['cop', 4], ['morty', 8]], [['cop', 6], ['morty', 9]], [['cop', 7], ['gazorpian', 3], ['morty', 10]]],
      boss: 'evilmorty',
    },
  ],
  upgrades: {
    overclock: { name: 'Overclocked portal gun', note: 'Fires 25% faster.', max: 3 },
    darkmatter: { name: 'Concentrated dark matter', note: 'Shots go through one more.', max: 2 },
    fluid: { name: 'Portal fluid spread', note: 'One more shot per trigger.', max: 2 },
    battery: { name: 'Microverse battery', note: 'One more heart, and heals you.', max: 2 },
    freeze: { name: 'Freeze ray', note: 'Shots slow what they hit.', max: 1 },
    meeseeks: { name: 'Meeseeks box', note: 'A Meeseeks joins the fight every few seconds.', max: 2 },
    butter: { name: 'Butter robot', note: 'Circles you and stops shots. Oh my god.', max: 2 },
    plumbus: { name: 'Plumbus', note: 'Heals a heart every 25 seconds.', max: 1 },
    squanch: { name: 'Squanchy sneakers', note: 'Move 12% faster.', max: 2 },
    recharge: { name: 'Portal gun battery', note: 'One more dash, and it recharges faster.', max: 2 },
    poopy: { name: 'Mr. Poopybutthole', note: 'Ooo-wee! Seeds come to you from further away.', max: 2 },
  },
};

// ── helpers ──

export function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const len = (x, y) => Math.hypot(x, y);
function emit(g, type, data = {}) {
  g.events.push({ type, ...data });
  if (g.events.length > 240) g.events.splice(0, g.events.length - 240);
}
const lv = (g) => PANIC.levels[g.level];
const up = (g, id) => g.ups[id] ?? 0;

// what the upgrades make of the hero
export const stats = (g) => {
  const h = PANIC.heroes[g.hero];
  return {
    speed: h.speed * (1 + 0.12 * up(g, 'squanch')),
    fire: h.fire * (1 + 0.25 * up(g, 'overclock')),
    dmg: h.dmg,
    pierce: up(g, 'darkmatter'),
    spread: up(g, 'fluid'),
    dashes: h.dashes + up(g, 'recharge'),
    recharge: h.recharge * 0.75 ** up(g, 'recharge'),
    magnet: PANIC.magnet * (1 + 0.6 * up(g, 'poopy')),
  };
};

// ── a game ──

export function newGame({ seed = 1, hero = 'rick', level = 'normal' } = {}) {
  const h = PANIC.heroes[hero] ?? PANIC.heroes.rick;
  const hp = h.hp + (PANIC.levels[level] ?? PANIC.levels.normal).hp;
  const g = {
    seed,
    rand: rng(seed),
    hero: PANIC.heroes[hero] ? hero : 'rick',
    level: PANIC.levels[level] ? level : 'normal',
    t: 0,
    acc: 0,
    status: 'play',
    dim: 0,
    wave: 0,
    calm: 1.6, // a moment before the first wave
    p: { x: 0, y: 0, vx: 0, vy: 0, r: h.r, hp, max: hp, inv: 0, cool: 0, aim: { x: 0, y: -1 }, dashes: h.dashes, recharge: 0, dashT: 0, dashVx: 0, dashVy: 0 },
    input: { mx: 0, my: 0, ax: 0, ay: 0, aiming: false, fire: false },
    dashPress: createCooldownPress(),
    enemies: [],
    shots: [],
    bolts: [],
    pickups: [],
    portals: [],
    allies: [],
    hazards: [],
    boss: null,
    obstacles: [],
    ups: {},
    offer: [],
    seeds: 0,
    points: 0,
    score: 0,
    kills: 0,
    combo: 0,
    comboT: 0,
    blocked: 0,
    allyT: 0,
    plumbusT: 0,
    travelT: 0,
    nextId: 1,
    events: [],
  };
  layout(g);
  return g;
}

// Each dimension's props: a few big things to hide behind, clear of the
// middle and of each other.
function layout(g) {
  const r = rng(g.seed * 31 + g.dim * 977 + 5);
  const d = PANIC.dims[g.dim];
  g.obstacles = [];
  let guard = 0;
  while (g.obstacles.length < 6 && guard++ < 200) {
    const a = r() * Math.PI * 2;
    const dist = 5 + r() * (PANIC.arena - 7.5);
    const rad = 0.8 + r() * 0.8;
    const o = { x: Math.cos(a) * dist, y: Math.sin(a) * dist, r: rad, kind: d.props[g.obstacles.length % d.props.length] };
    if (g.obstacles.some((q) => len(q.x - o.x, q.y - o.y) < q.r + o.r + 2.4)) continue;
    g.obstacles.push(o);
  }
}

// push a circle out of obstacles and back inside the arena
function settle(g, c, r) {
  for (const o of g.obstacles) {
    const dx = c.x - o.x;
    const dy = c.y - o.y;
    const d = len(dx, dy);
    const min = o.r + r;
    if (d < min) {
      const k = d > 1e-6 ? min / d : 0;
      if (k) {
        c.x = o.x + dx * k;
        c.y = o.y + dy * k;
      } else c.x = o.x + min;
    }
  }
  const d = len(c.x, c.y);
  const max = PANIC.arena - r;
  if (d > max) {
    c.x *= max / d;
    c.y *= max / d;
  }
}

export function spawnEnemy(g, kind, x, y) {
  const k = PANIC.enemies[kind];
  const hp = k.hp * lv(g).enemyHp;
  const e = { id: g.nextId++, kind, x, y, vx: 0, vy: 0, r: k.r, hp, max: hp, speed: k.speed, alive: true, t: 0, cool: 0.8 + g.rand() * 1.2, state: 'walk', st: 0, slow: 0, flash: 0, strafe: g.rand() < 0.5 ? -1 : 1 };
  g.enemies.push(e);
  return e;
}

export function spawnBoss(g, id) {
  const k = PANIC.bosses[id];
  const hp = Math.round(k.hp * lv(g).boss);
  const b = { id, name: k.name, x: 0, y: -9, vx: 0, vy: 0, r: k.r, hp, max: hp, speed: k.speed, t: 0, state: 'enter', st: 0, phase: 1, flash: 0, alive: true, cool: 1.5, aim: 0 };
  if (id === 'cromulon') b.y = -(PANIC.arena + 4.5);
  g.boss = b;
  emit(g, 'boss', { id, name: k.name });
  return b;
}

// Where the gun points: your aim, or the nearest enemy, or wherever it last was.
export function aimAt(g) {
  const p = g.p;
  if (g.input.aiming && len(g.input.ax, g.input.ay) > 0.2) {
    const l = len(g.input.ax, g.input.ay);
    return { x: g.input.ax / l, y: g.input.ay / l };
  }
  let best = null;
  let bd = 20;
  for (const e of g.enemies) {
    if (!e.alive) continue;
    const d = len(e.x - p.x, e.y - p.y);
    if (d < bd) [best, bd] = [e, d];
  }
  if (g.boss?.alive) {
    const d = len(g.boss.x - p.x, g.boss.y - p.y) - g.boss.r;
    if (d < bd || !best) [best, bd] = [g.boss, d];
  }
  if (best) {
    const l = Math.max(1e-6, len(best.x - p.x, best.y - p.y));
    return { x: (best.x - p.x) / l, y: (best.y - p.y) / l };
  }
  return { ...p.aim };
}

// The portal dash: a short jump the way you're moving (or aiming), through
// anything but walls, untouchable for a moment. Pressed while one's going or
// with no charge, it waits a moment (lib/press.js's createCooldownPress, its
// buffer) and fires as the last one ends or a charge comes back: step() asks.
const canDash = (g) => (g.status === 'play' || g.status === 'travel') && g.p.dashes >= 1 && !(g.p.dashT > 0);
export function dash(g) {
  const p = g.p;
  if (g.status !== 'play' && g.status !== 'travel') return false;
  if (!canDash(g)) {
    g.dashPress?.press();
    return false;
  }
  let dx = g.input.mx;
  let dy = g.input.my;
  if (len(dx, dy) < 0.2) [dx, dy] = [p.aim.x, p.aim.y];
  const l = Math.max(1e-6, len(dx, dy));
  p.dashes -= 1;
  p.dashT = PANIC.dash.time;
  p.dashVx = (dx / l) * (PANIC.dash.dist / PANIC.dash.time);
  p.dashVy = (dy / l) * (PANIC.dash.dist / PANIC.dash.time);
  p.inv = Math.max(p.inv, PANIC.dash.inv);
  emit(g, 'dash', { x: p.x, y: p.y, tx: p.x + (dx / l) * PANIC.dash.dist, ty: p.y + (dy / l) * PANIC.dash.dist });
  return true;
}

// Pick a gadget from the workbench.
export function choose(g, id) {
  if (g.status !== 'pick' || !g.offer.includes(id)) return false;
  const u = PANIC.upgrades[id];
  if (!u || up(g, id) >= u.max) return false;
  g.ups[id] = up(g, id) + 1;
  if (id === 'battery') {
    g.p.max += 1;
    g.p.hp = g.p.max;
  }
  if (id === 'recharge') g.p.dashes = stats(g).dashes;
  g.offer = [];
  g.status = 'play';
  g.calm = 1.4;
  emit(g, 'picked', { id, level: g.ups[id] });
  return true;
}

function offer(g) {
  const open = Object.keys(PANIC.upgrades).filter((id) => up(g, id) < PANIC.upgrades[id].max);
  const pick = [];
  while (pick.length < 3 && open.length) pick.push(open.splice(Math.floor(g.rand() * open.length), 1)[0]);
  g.offer = pick;
  g.status = pick.length ? 'pick' : 'play';
  if (!pick.length) g.calm = 1.4;
  emit(g, 'offer', { ids: [...pick] });
}

// (id: the enemy that walked into you, when one did)
function hurt(g, n = 1, from = null, id = null) {
  const p = g.p;
  if (p.inv > 0 || p.dashT > 0 || g.status !== 'play') return false;
  p.hp -= n;
  p.inv = PANIC.hitInv;
  g.combo = 0;
  emit(g, 'hurt', { hp: p.hp, x: p.x, y: p.y, from, ...(id != null ? { id } : {}) });
  if (p.hp <= 0) {
    p.hp = 0;
    g.status = 'lost';
    emit(g, 'lost', { score: g.score });
  }
  return true;
}

// (by: who fired it, for its event: { id } an enemy's, BOSS the boss's)
const BOSS = { boss: true };
function bolt(g, x, y, ax, ay, speed, r = 0.24, by = null) {
  const l = Math.max(1e-6, len(ax, ay));
  const s = speed * lv(g).bolt;
  g.bolts.push({ x, y, vx: (ax / l) * s, vy: (ay / l) * s, r, life: 3.2, dmg: 1 });
  emit(g, 'bolt', { x, y, ...by });
}

function kill(g, e, how = 'shot') {
  if (!e.alive) return;
  e.alive = false;
  const k = PANIC.enemies[e.kind];
  g.kills += 1;
  g.combo += 1;
  g.comboT = 2.2;
  const mult = 1 + Math.min(4, Math.floor(g.combo / 6));
  g.points += k.score * mult;
  emit(g, 'kill', { id: e.id, kind: e.kind, x: e.x, y: e.y, how, mult });
  if (g.combo > 0 && g.combo % 12 === 0) emit(g, 'combo', { n: g.combo, mult });
  for (let i = 0; i < k.seeds; i++) if (i === 0 || g.rand() < 0.6) g.pickups.push({ kind: 'seed', x: e.x + (g.rand() - 0.5) * 0.8, y: e.y + (g.rand() - 0.5) * 0.8, t: 0 });
  if (g.p.hp < g.p.max && g.rand() < 0.045) g.pickups.push({ kind: 'sauce', x: e.x, y: e.y, t: 0 });
  if (e.kind === 'cronenberg') {
    for (let i = 0; i < k.split; i++) {
      const s = i ? 1 : -1;
      const b = spawnEnemy(g, 'blob', e.x + s * 0.8, e.y);
      b.cool = 0;
      b.vx = s * 3;
    }
    emit(g, 'split', { x: e.x, y: e.y });
  }
}

function damage(g, e, n, slow = false) {
  e.hp -= n;
  e.flash = 0.12;
  if (slow) e.slow = 1.5;
  if (e.hp <= 0) kill(g, e);
}

function damageBoss(g, n) {
  const b = g.boss;
  if (!b?.alive || b.state === 'enter') return;
  b.hp -= n;
  b.flash = 0.1;
  g.points += n * 2;
}

// ── waves ──

function startWave(g) {
  const d = PANIC.dims[g.dim];
  if (g.wave >= 3) {
    // the boss comes through a big portal
    g.portals.push({ x: 0, y: g.dim === 2 ? -(PANIC.arena - 1) : -9, t: 0, open: 1.4, queue: [], boss: d.boss, next: 0, big: true });
    emit(g, 'portal', { x: 0, y: -9, big: true });
    return;
  }
  const queue = [];
  for (const [kind, n] of d.waves[g.wave]) for (let i = 0; i < Math.max(1, Math.round(n * lv(g).count)); i++) queue.push(kind);
  // mix them up
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(g.rand() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  const n = Math.min(3, 1 + g.wave);
  for (let i = 0; i < n; i++) {
    let x = 0;
    let y = 0;
    for (let k = 0; k < 30; k++) {
      const a = g.rand() * Math.PI * 2;
      const dist = 6 + g.rand() * (PANIC.arena - 8);
      x = Math.cos(a) * dist;
      y = Math.sin(a) * dist;
      if (len(x - g.p.x, y - g.p.y) > 7 && !g.obstacles.some((o) => len(o.x - x, o.y - y) < o.r + 1.5)) break;
    }
    g.portals.push({ x, y, t: 0, open: 0.8, queue: queue.filter((_, j) => j % n === i), next: 0, big: false });
    emit(g, 'portal', { x, y });
  }
  emit(g, 'wave', { dim: g.dim, wave: g.wave });
}

function stepPortals(g, dt) {
  for (const q of g.portals) {
    q.t += dt;
    if (q.t < q.open) continue;
    if (q.boss) {
      if (!g.boss) {
        spawnBoss(g, q.boss);
        g.boss.x = q.x;
        g.boss.y = q.y;
        q.queue = [];
        q.close = q.t + 1;
      }
      continue;
    }
    q.next -= dt;
    if (q.queue.length && q.next <= 0) {
      const e = spawnEnemy(g, q.queue.shift(), q.x + (g.rand() - 0.5) * 0.6, q.y + (g.rand() - 0.5) * 0.6);
      e.cool += 0.6;
      q.next = 0.45;
      if (!q.queue.length) q.close = q.t + 0.7;
    }
  }
  g.portals = g.portals.filter((q) => q.close == null || q.t < q.close);
}

// ── the enemies ──

function stepEnemy(g, e, dt) {
  if (e.hp <= 0) {
    kill(g, e);
    return;
  }
  const k = PANIC.enemies[e.kind];
  const p = g.p;
  e.t += dt;
  e.flash = Math.max(0, e.flash - dt);
  e.slow = Math.max(0, e.slow - dt);
  const sp = e.speed * (e.slow > 0 ? 0.55 : 1);
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const d = Math.max(1e-6, len(dx, dy));
  let wx = 0;
  let wy = 0;
  if (e.kind === 'gromflomite' || e.kind === 'cop') {
    // keep a distance, circle, and shoot
    const [near, far] = k.keep;
    const toward = d > far ? 1 : d < near ? -1 : 0;
    wx = (dx / d) * toward + (-dy / d) * e.strafe * 0.6;
    wy = (dy / d) * toward + (dx / d) * e.strafe * 0.6;
    e.cool -= dt * lv(g).fire;
    if (e.cool <= 0 && d < 16) {
      e.cool = k.fire * (0.8 + g.rand() * 0.4);
      const n = k.burst ?? 1;
      for (let i = 0; i < n; i++) {
        const a = Math.atan2(dy, dx) + (i - (n - 1) / 2) * 0.22;
        bolt(g, e.x, e.y, Math.cos(a), Math.sin(a), k.bolt, undefined, { id: e.id });
      }
    }
    if (g.rand() < dt * 0.3) e.strafe = -e.strafe;
  } else if (e.kind === 'gazorpian') {
    e.st += dt;
    if (e.state === 'walk') {
      wx = dx / d;
      wy = dy / d;
      e.cool -= dt;
      if (e.cool <= 0 && d < k.reach) {
        e.state = 'windup';
        e.st = 0;
        e.cx = dx / d;
        e.cy = dy / d;
        emit(g, 'windup', { id: e.id, x: e.x, y: e.y });
      }
    } else if (e.state === 'windup') {
      e.vx *= 0.8;
      e.vy *= 0.8;
      if (e.st >= k.windup) {
        e.state = 'charge';
        e.st = 0;
        e.vx = e.cx * k.charge;
        e.vy = e.cy * k.charge;
      }
    } else if (e.state === 'charge') {
      if (e.st >= k.chargeTime) {
        e.state = 'walk';
        e.cool = k.cooldown;
      }
    }
  } else {
    // rushers: straight for you, a little wobble
    wx = dx / d + Math.sin(e.t * 3 + e.id) * 0.25;
    wy = dy / d + Math.cos(e.t * 3 + e.id) * 0.25;
  }
  if (e.state !== 'charge' && e.state !== 'windup') {
    [wx, wy] = around(g, e.x, e.y, e.r, wx, wy);
    const wl = len(wx, wy);
    const tx = wl > 1e-6 ? (wx / wl) * sp * Math.min(1, wl) : 0;
    const ty = wl > 1e-6 ? (wy / wl) * sp * Math.min(1, wl) : 0;
    const k2 = Math.min(1, dt * 6);
    e.vx += (tx - e.vx) * k2;
    e.vy += (ty - e.vy) * k2;
  }
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  settle(g, e, e.r);
  // touching you hurts
  if (len(p.x - e.x, p.y - e.y) < e.r + p.r) {
    if (hurt(g, 1, e.kind, e.id)) {
      e.vx -= (dx / d) * 6;
      e.vy -= (dy / d) * 6;
      if (e.state === 'charge') e.state = 'walk';
    }
  }
}

// Steer round a prop in the way rather than pressing into it: if one lies
// ahead within a couple of metres, turn along its edge, on the side that's
// already nearer.
function around(g, x, y, r, wx, wy) {
  const wl = len(wx, wy);
  if (wl < 1e-6) return [wx, wy];
  const ux = wx / wl;
  const uy = wy / wl;
  for (const o of g.obstacles) {
    const ox = o.x - x;
    const oy = o.y - y;
    const ahead = ox * ux + oy * uy;
    if (ahead < 0 || ahead > o.r + r + 2.2) continue;
    const side = ox * -uy + oy * ux; // the obstacle's offset across the path
    const clear = o.r + r + 0.25;
    if (Math.abs(side) >= clear) continue;
    const turn = side >= 0 ? 1 : -1; // turn away from it
    const k = (1 - Math.abs(side) / clear) * 1.6;
    return [ux + uy * turn * k, uy - ux * turn * k];
  }
  return [wx, wy];
}

// keep them from piling into one spot
function separate(g) {
  const list = g.enemies;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const min = a.r + b.r;
      const d2 = dx * dx + dy * dy;
      if (d2 < min * min && d2 > 1e-8) {
        const d = Math.sqrt(d2);
        const push = (min - d) / 2;
        a.x -= (dx / d) * push;
        a.y -= (dy / d) * push;
        b.x += (dx / d) * push;
        b.y += (dy / d) * push;
      }
    }
  }
}

// ── the bosses ──

function zone(g, x, y, r, fuse) {
  g.hazards.push({ kind: 'zone', x, y, r, fuse, t: 0 });
}

function stepBoss(g, b, dt) {
  const p = g.p;
  b.t += dt;
  b.st += dt;
  b.flash = Math.max(0, b.flash - dt);
  if (b.state === 'enter') {
    if (b.st > 1.2) {
      b.state = 'idle';
      b.st = 0;
    }
    return;
  }
  if (b.phase === 1 && b.hp <= b.max / 2) {
    b.phase = 2;
    emit(g, 'bossPhase', { id: b.id });
  }
  const fast = b.phase === 2 ? 1.35 : 1;
  const dx = p.x - b.x;
  const dy = p.y - b.y;
  const d = Math.max(1e-6, len(dx, dy));
  b.aim = Math.atan2(dy, dx);
  b.cool -= dt * fast;
  const move = (s) => {
    const k = Math.min(1, dt * 3);
    const [wx, wy] = around(g, b.x, b.y, b.r, dx / d, dy / d);
    const wl = Math.max(1e-6, len(wx, wy));
    b.vx += ((wx / wl) * s - b.vx) * k;
    b.vy += ((wy / wl) * s - b.vy) * k;
  };
  if (b.id === 'snowball') {
    // stalk, wind up and charge; missiles; in the second phase, a rain of them
    if (b.state === 'idle') {
      move(b.speed * fast);
      if (b.cool <= 0) {
        const r = g.rand();
        if (r < 0.45) {
          b.state = 'windup';
          b.cx = dx / d;
          b.cy = dy / d;
          emit(g, 'windup', { x: b.x, y: b.y, boss: true });
        } else if (r < 0.8 || b.phase === 1) {
          b.state = 'volley';
        } else b.state = 'rain';
        b.st = 0;
      }
    } else if (b.state === 'windup') {
      b.vx *= 0.85;
      b.vy *= 0.85;
      if (b.st > 0.8 / fast) {
        b.state = 'charge';
        b.st = 0;
        b.vx = b.cx * 15;
        b.vy = b.cy * 15;
      }
    } else if (b.state === 'charge') {
      if (b.st > 0.75 || len(b.x, b.y) > PANIC.arena - b.r - 0.1) {
        b.state = 'idle';
        b.cool = 1.6;
        emit(g, 'slam', { x: b.x, y: b.y });
      }
    } else if (b.state === 'volley') {
      b.vx *= 0.9;
      b.vy *= 0.9;
      const n = b.phase === 2 ? 7 : 5;
      for (let i = 0; i < n; i++) {
        const a = b.aim + (i - (n - 1) / 2) * 0.16;
        bolt(g, b.x + Math.cos(a) * b.r, b.y + Math.sin(a) * b.r, Math.cos(a), Math.sin(a), 9.5, 0.32, BOSS);
      }
      b.state = 'idle';
      b.cool = 2.2;
    } else if (b.state === 'rain') {
      for (let i = 0; i < 5; i++) zone(g, p.x + (g.rand() - 0.5) * 7, p.y + (g.rand() - 0.5) * 7, 1.6, 1.15 + i * 0.12);
      b.state = 'idle';
      b.cool = 2.4;
    }
  } else if (b.id === 'cronenberg') {
    // lumbers after you, spits rings, buds off blobs
    move(b.speed * fast);
    if (b.cool <= 0) {
      if (g.rand() < 0.6) {
        const n = b.phase === 2 ? 16 : 10;
        const off = g.rand() * Math.PI;
        for (let i = 0; i < n; i++) {
          const a = off + (i / n) * Math.PI * 2;
          bolt(g, b.x + Math.cos(a) * b.r, b.y + Math.sin(a) * b.r, Math.cos(a), Math.sin(a), 7.5, 0.34, BOSS);
        }
        emit(g, 'spit', { x: b.x, y: b.y });
      } else {
        for (let i = 0; i < (b.phase === 2 ? 3 : 2); i++) {
          const a = g.rand() * Math.PI * 2;
          spawnEnemy(g, 'blob', b.x + Math.cos(a) * (b.r + 0.5), b.y + Math.sin(a) * (b.r + 0.5));
        }
        emit(g, 'split', { x: b.x, y: b.y });
      }
      b.cool = 2.6;
    }
  } else if (b.id === 'cromulon') {
    // a head the size of a building, at the edge of the arena: sweeping
    // beams, and notes that come down where you stand
    b.vx = 0;
    b.vy = 0;
    if (b.cool <= 0) {
      if (g.rand() < 0.5) {
        const base = Math.atan2(-b.y, -b.x);
        const s = g.rand() < 0.5 ? -1 : 1;
        const beams = b.phase === 2 ? 2 : 1;
        for (let i = 0; i < beams; i++) g.hazards.push({ kind: 'beam', x: b.x, y: b.y, a0: base + s * (0.75 - i * 0.2), a1: base - s * (0.75 + i * 0.2), len: PANIC.arena * 2.6, w: 1.4, warn: 0.9, dur: 2.0, t: 0 });
        emit(g, 'beam', {});
        b.cool = 4;
      } else {
        const n = b.phase === 2 ? 7 : 5;
        for (let i = 0; i < n; i++) zone(g, p.x + (g.rand() - 0.5) * 8, p.y + (g.rand() - 0.5) * 8, 1.7, 1.0 + i * 0.18);
        if (b.phase === 2) spawnEnemy(g, 'meeseeks', (g.rand() - 0.5) * 10, -PANIC.arena + 2);
        emit(g, 'notes', {});
        b.cool = 3.2;
      }
    }
  } else if (b.id === 'evilmorty') {
    // portals away, comes out shooting; in the second phase, sends clones
    if (b.state === 'idle') {
      move(b.speed * 0.4);
      if (b.cool <= 0) {
        b.state = 'vanish';
        b.st = 0;
        let x = 0;
        let y = 0;
        for (let k = 0; k < 30; k++) {
          const a = g.rand() * Math.PI * 2;
          const r = 4 + g.rand() * (PANIC.arena - 6);
          x = Math.cos(a) * r;
          y = Math.sin(a) * r;
          if (len(x - p.x, y - p.y) > 6 && !g.obstacles.some((o) => len(o.x - x, o.y - y) < o.r + 1.5)) break;
        }
        b.tx = x;
        b.ty = y;
        emit(g, 'portal', { x, y });
      }
    } else if (b.state === 'vanish' && b.st > 0.55) {
      b.x = b.tx;
      b.y = b.ty;
      b.vx = 0;
      b.vy = 0;
      b.state = 'idle';
      b.cool = 3.2;
      const aim = Math.atan2(p.y - b.y, p.x - b.x);
      for (let i = -1; i <= 1; i++) bolt(g, b.x, b.y, Math.cos(aim + i * 0.18), Math.sin(aim + i * 0.18), 11, undefined, BOSS);
      if (b.phase === 2) {
        const n = 12;
        for (let i = 0; i < n; i++) bolt(g, b.x, b.y, Math.cos((i / n) * Math.PI * 2), Math.sin((i / n) * Math.PI * 2), 6.5, undefined, BOSS);
        if (g.enemies.filter((e) => e.alive && e.kind === 'morty').length < 4) for (let i = 0; i < 2; i++) spawnEnemy(g, 'morty', b.x + (i ? 1 : -1), b.y);
      }
    }
  }
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  if (b.id !== 'cromulon') settle(g, b, b.r);
  if (b.id !== 'cromulon' && b.state !== 'vanish' && len(p.x - b.x, p.y - b.y) < b.r + p.r) hurt(g, 1, b.id);
}

function stepHazards(g, dt) {
  const p = g.p;
  for (const h of g.hazards) {
    h.t += dt;
    if (h.kind === 'zone') {
      if (h.t >= h.fuse && !h.done) {
        h.done = true;
        emit(g, 'boom', { x: h.x, y: h.y, r: h.r });
        if (len(p.x - h.x, p.y - h.y) < h.r + p.r * 0.5) hurt(g, 1, 'zone');
      }
    } else if (h.kind === 'beam') {
      if (h.t >= h.warn && h.t <= h.warn + h.dur) {
        const k = (h.t - h.warn) / h.dur;
        const a = h.a0 + (h.a1 - h.a0) * k;
        h.a = a;
        // distance from you to the beam's segment
        const ux = Math.cos(a);
        const uy = Math.sin(a);
        const along = clamp((p.x - h.x) * ux + (p.y - h.y) * uy, 0, h.len);
        const off = len(p.x - (h.x + ux * along), p.y - (h.y + uy * along));
        if (off < h.w / 2 + p.r * 0.5) hurt(g, 1, 'beam');
      }
      if (h.t > h.warn + h.dur) h.done = true;
    }
  }
  g.hazards = g.hazards.filter((h) => !(h.done && (h.kind === 'beam' || h.t > h.fuse + 0.35)));
}

// ── the player, shots, pickups ──

function stepPlayer(g, dt) {
  const p = g.p;
  const s = stats(g);
  const inp = g.input;
  p.inv = Math.max(0, p.inv - dt);
  // dashes come back one at a time
  if (p.dashes < s.dashes) {
    p.recharge += dt;
    if (p.recharge >= s.recharge) {
      p.recharge = 0;
      p.dashes += 1;
      emit(g, 'dashReady', { n: p.dashes });
    }
  } else p.recharge = 0;
  if (p.dashT > 0) {
    const k = Math.min(dt, p.dashT);
    p.dashT -= dt;
    p.x += p.dashVx * k;
    p.y += p.dashVy * k;
    p.vx = p.dashVx * 0.15;
    p.vy = p.dashVy * 0.15;
  } else {
    let mx = inp.mx;
    let my = inp.my;
    const ml = len(mx, my);
    if (ml > 1) {
      mx /= ml;
      my /= ml;
    }
    const k = Math.min(1, dt * 14);
    p.vx += (mx * s.speed - p.vx) * k;
    p.vy += (my * s.speed - p.vy) * k;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  settle(g, p, p.r);
  // the gun
  p.aim = aimAt(g);
  p.cool -= dt;
  if (inp.fire && p.cool <= 0 && g.status === 'play') {
    p.cool = 1 / s.fire;
    const n = 1 + s.spread;
    const base = Math.atan2(p.aim.y, p.aim.x);
    const h = PANIC.heroes[g.hero];
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.13;
      g.shots.push({ x: p.x + Math.cos(a) * 0.6, y: p.y + Math.sin(a) * 0.6, vx: Math.cos(a) * h.shotSpeed, vy: Math.sin(a) * h.shotSpeed, life: PANIC.shot.life, dmg: s.dmg, pierce: s.pierce, hit: [] });
    }
    emit(g, 'shot', { x: p.x, y: p.y, n });
  }
}

function stepShots(g, dt) {
  const r = PANIC.shot.r;
  const slow = up(g, 'freeze') > 0;
  for (const s of g.shots) {
    s.life -= dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (g.obstacles.some((o) => len(s.x - o.x, s.y - o.y) < o.r + r)) {
      s.life = 0;
      emit(g, 'spark', { x: s.x, y: s.y });
      continue;
    }
    for (const e of g.enemies) {
      if (!e.alive || s.life <= 0 || s.hit.includes(e.id)) continue;
      if (len(s.x - e.x, s.y - e.y) < e.r + r) {
        s.hit.push(e.id);
        damage(g, e, s.dmg, slow);
        emit(g, 'hit', { id: e.id, x: s.x, y: s.y });
        if (s.pierce-- <= 0) s.life = 0;
      }
    }
    const b = g.boss;
    if (b?.alive && s.life > 0 && b.state !== 'vanish' && !s.hit.includes('boss') && len(s.x - b.x, s.y - b.y) < b.r + r) {
      s.hit.push('boss');
      damageBoss(g, s.dmg);
      emit(g, 'hit', { x: s.x, y: s.y, boss: true });
      if (s.pierce-- <= 0) s.life = 0;
    }
  }
  g.shots = g.shots.filter((s) => s.life > 0);
  // enemy bolts: blocked by walls and butter robots, or they find you
  const p = g.p;
  const robots = butterRobots(g);
  for (const o of g.bolts) {
    o.life -= dt;
    o.x += o.vx * dt;
    o.y += o.vy * dt;
    if (len(o.x, o.y) > PANIC.arena + 6 || g.obstacles.some((q) => len(o.x - q.x, o.y - q.y) < q.r + o.r)) {
      o.life = 0;
      continue;
    }
    if (robots.some((rb) => len(o.x - rb.x, o.y - rb.y) < 0.55 + o.r)) {
      o.life = 0;
      g.blocked += 1;
      emit(g, 'block', { x: o.x, y: o.y });
      continue;
    }
    if (len(o.x - p.x, o.y - p.y) < o.r + p.r && hurt(g, o.dmg, 'bolt')) o.life = 0;
  }
  g.bolts = g.bolts.filter((o) => o.life > 0);
}

// where the butter robots are, circling you
export function butterRobots(g) {
  const n = up(g, 'butter');
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = g.t * 2.6 + (i / n) * Math.PI * 2;
    out.push({ x: g.p.x + Math.cos(a) * 1.7, y: g.p.y + Math.sin(a) * 1.7, a });
  }
  return out;
}

function stepAllies(g, dt) {
  const lvl = up(g, 'meeseeks');
  if (lvl && g.status === 'play') {
    g.allyT += dt;
    const every = lvl > 1 ? 8 : 11;
    if (g.allyT >= every) {
      g.allyT = 0;
      g.allies.push({ x: g.p.x + 1, y: g.p.y, t: 0, life: 8, cool: 0, vx: 0, vy: 0 });
      emit(g, 'meeseeks', { ally: g.allies.length - 1 });
    }
  }
  for (const [i, a] of g.allies.entries()) {
    a.t += dt;
    a.cool -= dt;
    let best = null;
    let bd = Infinity;
    for (const e of g.enemies) {
      if (!e.alive) continue;
      const d = len(e.x - a.x, e.y - a.y);
      if (d < bd) [best, bd] = [e, d];
    }
    if (best && bd > best.r + 0.6) {
      a.vx = ((best.x - a.x) / bd) * 5.2;
      a.vy = ((best.y - a.y) / bd) * 5.2;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
    } else {
      // stood still: punching, or nothing left to punch
      a.vx = 0;
      a.vy = 0;
      if (best && a.cool <= 0) {
        a.cool = 0.45;
        damage(g, best, 1.5);
        emit(g, 'punch', { id: best.id, ally: i, x: best.x, y: best.y });
      }
    }
    settle(g, a, 0.4);
    if (a.t >= a.life) emit(g, 'poof', { ally: i, x: a.x, y: a.y });
  }
  g.allies = g.allies.filter((a) => a.t < a.life);
}

function stepPickups(g, dt, all = false) {
  const p = g.p;
  const reach = all ? 99 : stats(g).magnet;
  for (const q of g.pickups) {
    q.t += dt;
    const dx = p.x - q.x;
    const dy = p.y - q.y;
    const d = len(dx, dy);
    if (d < reach) {
      const s = 8 + (reach - d) * 2 + (all ? 10 : 0);
      q.x += (dx / Math.max(d, 1e-6)) * Math.min(d, s * dt);
      q.y += (dy / Math.max(d, 1e-6)) * Math.min(d, s * dt);
    }
    if (len(p.x - q.x, p.y - q.y) < p.r + 0.45) {
      q.taken = true;
      if (q.kind === 'seed') {
        g.seeds += 1;
        g.points += 5;
        emit(g, 'seed', { x: q.x, y: q.y });
      } else if (q.kind === 'sauce') {
        p.hp = Math.min(p.max, p.hp + 1);
        emit(g, 'heal', { hp: p.hp });
      }
    }
  }
  g.pickups = g.pickups.filter((q) => !q.taken && q.t < 14);
}

// ── one step ──

function stepOnce(g, dt) {
  g.t += dt;
  const p = g.p;
  if (g.status === 'travel') {
    // through the portal: seeds come to you, nothing else moves
    stepPlayer(g, dt);
    stepPickups(g, dt, true);
    g.travelT -= dt;
    if (g.travelT <= 0) {
      if (g.dim >= PANIC.dims.length - 1) {
        g.status = 'won';
        emit(g, 'won', { score: g.score });
      } else {
        g.dim += 1;
        g.wave = 0;
        g.status = 'play';
        g.calm = 2;
        g.enemies = [];
        g.bolts = [];
        g.hazards = [];
        g.allies = [];
        p.x = 0;
        p.y = 0;
        p.vx = 0;
        p.vy = 0;
        p.inv = 1.5;
        layout(g);
        emit(g, 'dimension', { dim: g.dim, name: PANIC.dims[g.dim].name });
      }
    }
    return;
  }
  stepPlayer(g, dt);
  stepPortals(g, dt);
  for (const e of g.enemies) if (e.alive) stepEnemy(g, e, dt);
  separate(g);
  if (g.boss?.alive) stepBoss(g, g.boss, dt);
  stepHazards(g, dt);
  stepShots(g, dt);
  stepAllies(g, dt);
  stepPickups(g, dt);
  g.enemies = g.enemies.filter((e) => e.alive);
  // the plumbus
  if (up(g, 'plumbus')) {
    g.plumbusT += dt;
    if (g.plumbusT >= 25) {
      g.plumbusT = 0;
      if (p.hp < p.max) {
        p.hp += 1;
        emit(g, 'heal', { hp: p.hp, plumbus: true });
      }
    }
  }
  // combos fade
  if (g.comboT > 0) {
    g.comboT -= dt;
    if (g.comboT <= 0) g.combo = 0;
  }
  g.score = Math.floor(g.points);
  if (g.status !== 'play') return;
  // the boss down: through the portal
  const b = g.boss;
  if (b && b.alive && b.hp <= 0) {
    b.alive = false;
    g.points += 500 * (g.dim + 1);
    g.score = Math.floor(g.points);
    for (let i = 0; i < PANIC.bosses[b.id].seeds; i++) g.pickups.push({ kind: 'seed', x: clamp(b.x + (g.rand() - 0.5) * 4, -PANIC.arena + 1, PANIC.arena - 1), y: clamp(b.y + (g.rand() - 0.5) * 4, -PANIC.arena + 1, PANIC.arena - 1), t: 0 });
    emit(g, 'bossDown', { id: b.id, x: b.x, y: b.y });
    g.boss = null;
    for (const e of g.enemies) e.alive = false;
    g.enemies = [];
    g.bolts = [];
    g.hazards = [];
    g.status = 'travel';
    g.travelT = PANIC.travel;
    emit(g, 'travel', { to: g.dim + 1 });
    return;
  }
  // the next wave, once this one is cleared
  const busy = g.portals.length > 0 || g.enemies.length > 0 || g.boss;
  if (!busy) {
    if (g.calm > 0) {
      g.calm -= dt;
      if (g.calm <= 0) startWave(g);
    } else if (g.waveOn) {
      g.waveOn = false;
      emit(g, 'cleared', { dim: g.dim, wave: g.wave });
      g.wave += 1;
      offer(g);
    }
  } else if (g.portals.length) g.waveOn = true;
}

export function step(g, dt) {
  if (g.status !== 'play' && g.status !== 'travel') return;
  g.acc = Math.min(g.acc + Math.max(0, dt), 0.25);
  while (g.acc >= PANIC.step - 1e-9 && (g.status === 'play' || g.status === 'travel')) {
    g.acc -= PANIC.step;
    stepOnce(g, PANIC.step);
    // a dash pressed a moment before it could go, now it can
    if (g.dashPress) {
      g.dashPress.ready(canDash(g), PANIC.step);
      if (g.dashPress.take()) dash(g);
    }
  }
}
