// Roll out: the rules, apart from the drawing, so they can be tested.
//
// A highway run in the two forms every Transformer has. In vehicle mode you
// are fast: steer through traffic, boost (it burns energon and smashes
// debris), pick up energon cubes and take the ramp over a broken bridge. In
// robot mode you fight: the blaster fires on its own at whatever is ahead,
// you can jump a barricade or a floor beam, and you burn energon just
// standing up. Out of energon, you fold back into the vehicle. Each obstacle
// is answered by one form, and transforming takes half a second, so the game
// is reading the road and changing in time.
//
// Three stages, each closed by a boss: Starscream over Jasper, Nevada;
// Shockwave in Mission City; Megatron in Kaon. A ground bridge takes you
// between them.
//
// World units: x across the road (lanes at ±1.5 and ±4.5), y up, z along the
// road; the player is at z and everything ahead has a larger z. Everything
// random comes from the run's seed, so a run replays the same way.

export const ROLL = {
  step: 1 / 120,
  lanes: [-4.5, -1.5, 1.5, 4.5],
  bounds: 5.2,
  steerRate: { vehicle: 16, robot: 12 }, // how fast the steering target moves, units/s
  follow: { vehicle: 9, robot: 12 }, // how fast the body follows it
  gravity: 24,
  jumpV: 10,
  rampV: 7,
  coyote: 0.1,
  jumpBuffer: 0.14,
  transformTime: 0.5,
  invuln: 1.5,
  accel: 26,
  decel: 42,
  speed: { vehicle: 30, robot: 0.567, boost: 1.45 }, // robot and boost are shares of vehicle speed
  energon: { max: 100, start: 60, cube: 14, drain: 4.5, charge: 2.5, boost: 24, toStand: 8, spark: 30 },
  body: { vehicle: { hw: 0.85, hl: 1.75, h: 1.4 }, robot: { hw: 0.6, hl: 0.5, h: 2.7 } },
  ramp: { len: 7, h: 0.9 },
  gapK: 0.6, // a broken bridge is this many seconds of vehicle speed long
  barricade: { l: 1, h: 1.1 },
  bomb: { r: 1.35, blast: 0.25, fuse: 1.1 },
  wave: { h: 0.9, d: 0.6, speed: 20 },
  shot: { speed: 78, life: 1.1, r: 0.3, range: 72 },
  vehicon: { hp: 3, w: 1.7, l: 3.6, standW: 1.3, standL: 1.0, standH: 2.6, fire: 1.7, bolt: 26, ahead: [16, 26] },
  jet: { hp: 2, y: 6.5, speed: 26, w: 2.6, l: 2.6, bombs: 3 },
  car: { w: 1.8, l: 3.8, h: 1.5 },
  bolt: { r: 0.35, y: 1.1 },
  spark: { time: 6, w: 1.2 },
  spacing: { min: 24, wall: 80 },
  bridgeTime: 2.2,
  outro: 2,
  comboWindow: 2.5,
  nearGap: 0.9,
  points: { meter: 1, cube: 20, vehicon: 150, jet: 200, debris: 30, near: 40, boss: 2500, stage: 1000, shield: 250, spark: 100 },
  levels: {
    recruit: { label: 'Recruit', speed: 0.88, shields: 1, density: 0.75, fire: 1.35, fuse: 1.25, bossHp: 0.75 },
    autobot: { label: 'Autobot', speed: 1, shields: 0, density: 1, fire: 1, fuse: 1, bossHp: 1 },
    prime: { label: 'Prime', speed: 1.12, shields: 0, density: 1.3, fire: 0.78, fuse: 0.9, bossHp: 1.25 },
  },
  bots: {
    optimus: { name: 'Optimus Prime', shields: 4, fire: 0.24, dmg: 2, speed: 0.96 },
    bumblebee: { name: 'Bumblebee', shields: 3, fire: 0.12, dmg: 1, speed: 1.05 },
  },
  stages: [
    { id: 'jasper', name: 'Jasper, Nevada', len: 1300, boss: 'starscream', speed: 1, mix: { traffic: 3, debris: 2, cubes: 3, barricade: 1, gap: 1, vehicons: 1.2, jets: 0.6, spark: 0.15 } },
    { id: 'mission', name: 'Mission City', len: 1400, boss: 'shockwave', speed: 1.05, mix: { traffic: 3.4, debris: 2, cubes: 3, barricade: 1.2, gap: 1, vehicons: 1.7, jets: 1, spark: 0.15 } },
    { id: 'kaon', name: 'Kaon, Cybertron', len: 1500, boss: 'megatron', speed: 1.1, mix: { traffic: 1.6, debris: 3, cubes: 3, barricade: 1.3, gap: 1.3, vehicons: 2.3, jets: 1.3, spark: 0.2 } },
  ],
  bosses: {
    starscream: { name: 'Starscream', hp: 60, dz: 32, y: 4.5, r: 2.2, cool: 2.2, attacks: ['missiles', 'strafe', 'dive'] },
    shockwave: { name: 'Shockwave', hp: 80, dz: 27, y: 0, r: 1.9, cool: 2.3, attacks: ['beam', 'cannon', 'drones'] },
    megatron: { name: 'Megatron', hp: 100, dz: 28, y: 0, r: 1.9, cool: 2.1, attacks: ['fusion', 'wave', 'reinforce'] },
  },
};

const { lanes: LANES } = ROLL;

export function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];

function emit(g, type, data = {}) {
  g.events.push({ type, ...data });
  if (g.events.length > 400) g.events.splice(0, g.events.length - 400);
  const tag = data.log ?? type;
  g.log.push(tag);
  if (g.log.length > 600) g.log.splice(0, g.log.length - 600);
}

export const boostSpeed = (g) => g.vehicleSpeed * ROLL.speed.boost;
export const bodyOf = (g) => {
  const v = ROLL.body.vehicle;
  const r = ROLL.body.robot;
  const k = g.morph;
  return { hw: v.hw + (r.hw - v.hw) * k, hl: v.hl + (r.hl - v.hl) * k, h: v.h + (r.h - v.h) * k };
};
export const armed = (g) => g.mode === 'robot' && g.morph > 0.95;

// ── the road for one stage ──

function setSpeeds(g) {
  const lv = ROLL.levels[g.level];
  const st = ROLL.stages[g.stage];
  g.vehicleSpeed = ROLL.speed.vehicle * lv.speed * st.speed * ROLL.bots[g.bot].speed;
  g.robotSpeed = g.vehicleSpeed * ROLL.speed.robot;
  g.gapLen = ROLL.gapK * g.vehicleSpeed;
}

function buildStage(g, z0) {
  const r = g.rand;
  const st = ROLL.stages[g.stage];
  const lv = ROLL.levels[g.level];
  setSpeeds(g);
  g.cars = [];
  g.debris = [];
  g.barricades = [];
  g.gaps = [];
  g.cubes = [];
  g.sparks = [];
  g.triggers = [];
  g.stageStart = z0;
  g.stageLen = z0 + st.len; // where the boss comes out (an absolute z)
  const end = g.stageLen - 50;
  const dense = lv.density;
  const weights = Object.entries(st.mix);
  const total = weights.reduce((s, [, w]) => s + w, 0);
  const choose = () => {
    let x = r() * total;
    for (const [k, w] of weights) {
      x -= w;
      if (x <= 0) return k;
    }
    return 'cubes';
  };
  let z = z0 + 80;
  let lastWall = -Infinity;
  let guard = 0;
  while (z < end && guard++ < 400) {
    let kind = choose();
    const wall = kind === 'barricade' || kind === 'gap';
    if (wall && (z - lastWall < ROLL.spacing.wall || z + 40 > end)) kind = r() < 0.5 ? 'traffic' : 'cubes';
    let len = 8;
    if (kind === 'traffic') {
      const n = Math.min(3, 1 + Math.floor(r() * (1.6 + dense)));
      const lanes = shuffle(r, [0, 1, 2, 3]).slice(0, n);
      const cruise = g.vehicleSpeed * (0.3 + r() * 0.14);
      lanes.forEach((li, i) => {
        g.cars.push({ x: LANES[li], lane: li, z: z + i * (2 + r() * 5), cruise: cruise * (0.9 + r() * 0.2), speed: 0, w: ROLL.car.w, l: ROLL.car.l, h: ROLL.car.h, alive: true, hit: false, look: Math.floor(r() * 6), shift: n < 3 && r() < 0.3 ? { at: 26 + r() * 14, to: li < 2 ? li + 1 : li - 1, done: false } : null });
      });
      len = 14;
    } else if (kind === 'debris') {
      const n = 1 + (r() < 0.35 * dense ? 1 : 0);
      const lanes = shuffle(r, [0, 1, 2, 3]).slice(0, n);
      lanes.forEach((li, i) => g.debris.push({ x: LANES[li] + (r() - 0.5) * 0.6, lane: li, z: z + i * 3, w: 1.5 + r() * 0.5, l: 1.3 + r() * 0.5, h: 0.9 + r() * 0.35, hp: 2, alive: true, look: Math.floor(r() * 4) }));
      len = 8;
    } else if (kind === 'cubes') {
      let li = Math.floor(r() * 4);
      const n = 5 + Math.floor(r() * 3);
      const zig = r() < 0.4;
      for (let i = 0; i < n; i++) {
        if (zig && i === Math.floor(n / 2)) li = clamp(li + (r() < 0.5 ? -1 : 1), 0, 3);
        g.cubes.push({ x: LANES[li], z: z + i * 3.4, y: 0.9, taken: false });
      }
      len = n * 3.4;
    } else if (kind === 'barricade') {
      g.barricades.push({ z: z + 30, l: ROLL.barricade.l, h: ROLL.barricade.h, broken: false });
      // a reward over the top for a good jump
      const li = Math.floor(r() * 4);
      for (let i = -1; i <= 1; i++) g.cubes.push({ x: LANES[li], z: z + 30 + i * 2.2, y: 2.2 - Math.abs(i) * 0.45, taken: false });
      lastWall = z + 30;
      len = 40;
    } else if (kind === 'gap') {
      const lip = z + ROLL.ramp.len;
      g.gaps.push({ z: lip, len: g.gapLen });
      const li = Math.floor(r() * 4);
      for (let i = 1; i <= 3; i++) g.cubes.push({ x: LANES[li], z: lip + (g.gapLen * i) / 4, y: 2 + Math.sin((i / 4) * Math.PI) * 0.8, taken: false });
      lastWall = z;
      len = ROLL.ramp.len + g.gapLen + 12;
    } else if (kind === 'vehicons') {
      g.triggers.push({ z, kind: 'vehicons', n: 1 + (r() < 0.45 * dense ? 1 : 0) });
      len = 6;
    } else if (kind === 'jets') {
      g.triggers.push({ z, kind: 'jet', n: dense > 1.1 && r() < 0.4 ? 2 : 1 });
      len = 6;
    } else if (kind === 'spark') {
      g.sparks.push({ x: LANES[Math.floor(r() * 4)], z, y: 1.2, taken: false });
      len = 4;
    }
    z += len + (ROLL.spacing.min * (1 + r() * 0.9)) / dense;
  }
  // cars stop short of a roadblock or a broken bridge, one behind another
  const walls = [...g.barricades.map((b) => b.z - b.l), ...g.gaps.map((p) => p.z - ROLL.ramp.len)].sort((a, b) => a - b);
  for (const c of g.cars) {
    const w = walls.find((wz) => wz > c.z);
    c.stopZ = (w ?? Infinity) - 8;
  }
  for (const list of [g.cars, g.debris, g.cubes, g.barricades, g.gaps, g.triggers, g.sparks]) list.sort((a, b) => a.z - b.z);
}

function shuffle(r, a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function newRun({ seed = 1, level = 'autobot', bot = 'optimus', stage = 0 } = {}) {
  const lv = ROLL.levels[level] ? level : 'autobot';
  const who = ROLL.bots[bot] ? bot : 'optimus';
  const shields = Math.max(1, ROLL.bots[who].shields + ROLL.levels[lv].shields);
  const g = {
    seed,
    level: lv,
    bot: who,
    stage: clamp(stage | 0, 0, ROLL.stages.length - 1),
    rand: rng(seed),
    status: 'running',
    t: 0,
    acc: 0,
    z: 0,
    x: -1.5,
    tx: -1.5,
    y: 0,
    vy: 0,
    grounded: true,
    air: 0,
    jumpBuf: 0,
    mode: 'vehicle',
    morph: 0,
    morphFrom: 0,
    morphT: -1,
    speed: 0,
    boosting: false,
    shields,
    maxShields: shields,
    invuln: 0,
    energon: ROLL.energon.start,
    spark: 0,
    fire: 0.4,
    score: 0,
    points: 0,
    combo: { n: 0, t: -9 },
    kills: { vehicon: 0, jet: 0, debris: 0, boss: 0 },
    taken: 0,
    nears: 0,
    shots: [],
    bolts: [],
    bombs: [],
    waves: [],
    beams: [],
    enemies: [],
    fx: [],
    boss: null,
    outro: 0,
    bridge: 0,
    warn: null,
    shake: 0,
    flash: 0,
    input: { steer: 0, boost: false },
    events: [],
    log: [],
  };
  buildStage(g, 0);
  g.speed = g.vehicleSpeed * 0.55; // pulling away
  emit(g, 'stage', { index: g.stage, name: ROLL.stages[g.stage].name, log: `stage:${g.stage}` });
  return g;
}

// ── the controls ──

export function transform(g) {
  if (g.status !== 'running' || g.bridge > 0 || g.morphT >= 0) return false;
  const to = g.mode === 'vehicle' ? 'robot' : 'vehicle';
  if (to === 'robot' && g.energon < ROLL.energon.toStand && g.spark <= 0) {
    emit(g, 'say', { text: 'Not enough energon to stand up.', log: 'low' });
    return false;
  }
  g.mode = to;
  g.morphFrom = g.morph;
  g.morphT = 0;
  emit(g, 'transform', { to, log: `transform:${to}` });
  return true;
}

export function jump(g) {
  if (g.status !== 'running' || g.mode !== 'robot' || g.morph < 0.6) return false;
  if (g.grounded || g.air < ROLL.coyote) {
    if (!g.grounded && g.vy > 0) return false; // already going up
    g.vy = ROLL.jumpV;
    g.grounded = false;
    g.air = ROLL.coyote;
    g.jumpBuf = 0;
    emit(g, 'jump');
    return true;
  }
  g.jumpBuf = ROLL.jumpBuffer; // pressed just before landing: jump as it lands
  return false;
}

// ── scoring and damage ──

// Points arrive in fractions (a step's worth of road), so they add up
// unrounded and the score shows the whole part.
function score(g, pts) {
  g.points += pts * (g.spark > 0 ? 2 : 1);
  g.score = Math.floor(g.points);
}

function kill(g, kind, at) {
  const now = g.t;
  g.combo = now - g.combo.t < ROLL.comboWindow ? { n: g.combo.n + 1, t: now } : { n: 1, t: now };
  g.kills[kind] = (g.kills[kind] ?? 0) + 1;
  score(g, ROLL.points[kind] * Math.min(5, g.combo.n));
  g.fx.push({ kind: 'boom', x: at.x, y: at.y ?? 1, z: at.z, t: 0, life: kind === 'debris' ? 0.5 : 0.9, big: kind !== 'debris' });
  emit(g, 'kill', { kind, combo: g.combo.n, x: at.x, y: at.y ?? 1, z: at.z, log: `kill:${kind}` });
}

function hurt(g, why) {
  if (g.invuln > 0 || g.spark > 0 || g.bridge > 0 || g.status !== 'running') return false;
  g.shields -= 1;
  g.invuln = ROLL.invuln;
  g.shake = 1;
  g.flash = 0.6;
  g.combo = { n: 0, t: -9 };
  if (g.mode === 'vehicle') g.speed *= 0.55;
  emit(g, 'hit', { why, shields: g.shields, log: `hit:${why}` });
  if (g.shields <= 0) {
    g.status = 'lost';
    emit(g, 'lost', { text: lostLine(g, why) });
  }
  return true;
}

const lostLine = (g, why) =>
  ({
    barricade: 'Straight into the roadblock. Ratchet will have words.',
    gap: 'Down through the broken bridge.',
    car: 'Autobots protect the humans, not run into them.',
    bomb: 'Caught in a bombing run.',
    beam: 'The beam took your legs out.',
    fusion: 'Megatron’s fusion cannon. One shall stand.',
    vehicon: 'The Vehicons ran you off the road.',
  })[why] ?? 'Autobot down.';

// ── the ground under you: the road, a ramp, or nothing over a broken bridge ──

export function floorAt(g, z) {
  for (const p of g.gaps) {
    if (p.z - ROLL.ramp.len > z + 1) break;
    if (z >= p.z - ROLL.ramp.len && z < p.z) return (ROLL.ramp.h * (z - (p.z - ROLL.ramp.len))) / ROLL.ramp.len;
    if (z >= p.z && z < p.z + p.len) return -Infinity;
  }
  return 0;
}

const overlap = (g, b, ox, oz, hw, hl) => Math.abs(ox - g.x) < hw + b.hw && Math.abs(oz - g.z) < hl + b.hl;

// ── one step ──

function spawnVehicons(g, n) {
  const r = g.rand;
  const order = shuffle(r, [0, 1, 2, 3]).sort((a, b) => Math.abs(LANES[b] - g.x) - Math.abs(LANES[a] - g.x));
  for (let i = 0; i < n; i++) {
    const li = order[i % order.length];
    const [a, b] = ROLL.vehicon.ahead;
    g.enemies.push({ kind: 'vehicon', state: 'pass', x: LANES[li], z: g.z - 26 - i * 7, speed: g.speed + 10, hp: ROLL.vehicon.hp, alive: true, t: 0, cool: 1 + r(), ahead: a + r() * (b - a), swerve: r() < 0.35 ? { at: 0, done: false } : null, lane: li });
  }
  emit(g, 'vehicons', { n });
}

function spawnJet(g, i = 0) {
  const r = g.rand;
  g.enemies.push({ kind: 'jet', x: (r() - 0.5) * 8, y: ROLL.jet.y, z: g.z + 130 + i * 14, hp: ROLL.jet.hp, alive: true, t: 0, dropped: 0, next: 0 });
  emit(g, 'jet');
}

function dropBomb(g, x) {
  const fuse = ROLL.bomb.fuse * ROLL.levels[g.level].fuse;
  g.bombs.push({ x: clamp(x, -ROLL.bounds, ROLL.bounds), z: g.z + g.speed * fuse + (g.rand() - 0.5) * 3, t: 0, fuse, r: ROLL.bomb.r, done: false });
}

function fireBolt(g, from, { speed = ROLL.vehicon.bolt, big = false, lead = true } = {}) {
  // aim where the player will be, roughly
  const dz = from.z - g.z;
  const time = dz / (speed + g.speed);
  const tx = lead ? g.x + (g.tx - g.x) * Math.min(1, time * 2) : g.x;
  const vx = (tx - from.x) / Math.max(0.2, time);
  g.bolts.push({ x: from.x, y: from.y ?? ROLL.bolt.y, z: from.z, vx: clamp(vx, -12, 12), vz: -speed, life: 3, big, r: big ? 0.9 : ROLL.bolt.r });
}

function startBoss(g) {
  const kind = ROLL.stages[g.stage].boss;
  const B = ROLL.bosses[kind];
  const hp = Math.round(B.hp * ROLL.levels[g.level].bossHp);
  g.boss = { kind, name: B.name, hp, max: hp, x: 0, tx: 0, y: B.y, dz: B.dz + 30, t: 0, cool: 2.5, phase: 1, attack: null, alive: true, dying: 0, flash: 0, next: 0, cubeT: 4 };
  g.enemies = g.enemies.filter((e) => e.z < g.z + 20);
  // the road clears for the fight
  for (const c of g.cars) {
    if (c.z > g.z + 25 && !c.pull) {
      c.pull = true;
      c.toX = c.x >= 0 ? 7.9 : -7.9;
      c.blink = 0.3;
    }
  }
  emit(g, 'boss', { kind, name: B.name });
}

function bossAttack(g, B) {
  const b = g.boss;
  const list = B.attacks;
  const type = list[b.next % list.length];
  b.next += 1 + (g.rand() < 0.3 ? 1 : 0);
  const p = b.phase;
  if (type === 'missiles') b.attack = { type, t: 0, n: 2 + p, every: 0.32 - p * 0.04, fired: 0 };
  else if (type === 'strafe') b.attack = { type, t: 0, dur: 3.2, bombs: 3 + p, dropped: 0 };
  else if (type === 'dive') {
    const x = LANES.reduce((best, l) => (Math.abs(l - g.x) < Math.abs(best - g.x) ? l : best), LANES[0]);
    b.attack = { type, t: 0, x, charge: 1.05 - p * 0.1, done: false };
    g.warn = { x, w: 1.4, t: 0, kind: 'dive' };
  } else if (type === 'beam' || type === 'wave') b.attack = { type, t: 0, n: type === 'beam' ? p : Math.min(2, p), every: 0.75, fired: 0, charge: 0.9 };
  else if (type === 'cannon') b.attack = { type, t: 0, n: 3, every: 0.35, fired: 0 };
  else if (type === 'drones') {
    spawnJet(g, 0);
    if (p > 1) spawnJet(g, 1);
    b.attack = { type, t: 0, dur: 0.8 };
  } else if (type === 'reinforce') {
    spawnVehicons(g, p > 2 ? 3 : 2);
    b.attack = { type, t: 0, dur: 0.8 };
  } else if (type === 'fusion') {
    b.attack = { type, t: 0, x: clamp(g.x, -3, 3), charge: 1.15 - p * 0.08, shots: p > 2 ? 2 : 1, fired: 0, active: 0 };
    g.warn = { x: b.attack.x, w: 1.7, t: 0, kind: 'fusion' };
  }
  emit(g, 'bossAttack', { attack: type, log: `attack:${type}` });
}

function stepBoss(g, dt) {
  const b = g.boss;
  const B = ROLL.bosses[b.kind];
  b.t += dt;
  b.flash = Math.max(0, b.flash - dt * 4);
  if (!b.alive) {
    b.dying += dt;
    b.y -= dt * 2;
    return;
  }
  const frac = b.hp / b.max;
  const phase = frac > 0.6 ? 1 : frac > 0.3 ? 2 : 3;
  if (phase !== b.phase) {
    b.phase = phase;
    emit(g, 'bossPhase', { phase, name: b.name, log: `phase:${phase}` });
  }
  // keep station ahead, weaving across the road
  const strafing = b.attack?.type === 'strafe';
  if (!strafing) {
    b.dz += (B.dz - b.dz) * Math.min(1, dt * 1.6);
    const sway = b.kind === 'starscream' ? Math.sin(b.t * (0.8 + phase * 0.25)) * 3.6 : clamp(g.x, -3.5, 3.5) * 0.7 + Math.sin(b.t * 0.7) * 1.2;
    b.tx = sway;
  }
  b.x += (b.tx - b.x) * Math.min(1, dt * 2.2);
  const bz = g.z + b.dz;
  // a line of energon cubes now and then, to keep fighting
  b.cubeT -= dt;
  if (b.cubeT <= 0) {
    b.cubeT = 6 + g.rand() * 3;
    const li = Math.floor(g.rand() * 4);
    for (let i = 0; i < 5; i++) g.cubes.push({ x: LANES[li], z: g.z + 40 + i * 3.4, y: 0.9, taken: false });
  }
  const a = b.attack;
  if (!a) {
    b.cool -= dt;
    if (b.cool <= 0) {
      bossAttack(g, B);
      b.cool = B.cool * (phase === 3 ? 0.62 : phase === 2 ? 0.8 : 1) * ROLL.levels[g.level].fire;
    }
    return;
  }
  a.t += dt;
  switch (a.type) {
    case 'missiles':
      if (a.fired < a.n && a.t >= a.fired * a.every) {
        a.fired += 1;
        fireBolt(g, { x: b.x, y: b.y, z: bz }, { speed: 30 });
        emit(g, 'missile');
      }
      if (a.t > a.n * a.every + 0.4) b.attack = null;
      break;
    case 'strafe': {
      // flies back over you dropping bombs down your lane, then comes round again
      const k = a.t / a.dur;
      b.dz = k < 0.5 ? B.dz - (B.dz + 26) * ease(k * 2) : -26 + (B.dz + 26) * ease((k - 0.5) * 2);
      b.y = B.y + 1.5;
      if (k < 0.5 && a.dropped < a.bombs && k > (a.dropped / a.bombs) * 0.42) {
        a.dropped += 1;
        dropBomb(g, g.x + (g.rand() - 0.5) * 1.5);
        emit(g, 'bomb');
      }
      if (k >= 1) {
        b.attack = null;
        b.y = B.y;
      }
      break;
    }
    case 'dive':
      g.warn.t = a.t;
      if (!a.done && a.t >= a.charge) {
        a.done = true;
        g.bolts.push({ x: a.x, y: 1, z: bz, vx: 0, vz: -62, life: 2, big: true, r: 1.1, dive: true });
        emit(g, 'dive');
      }
      if (a.t > a.charge + 0.4) {
        b.attack = null;
        g.warn = null;
      }
      break;
    case 'beam':
    case 'wave':
      if (a.fired < a.n && a.t >= a.charge + a.fired * a.every) {
        a.fired += 1;
        g.waves.push({ z: bz - 2, vz: -ROLL.wave.speed, h: ROLL.wave.h, life: 4, kind: a.type });
        emit(g, 'wave', { kind: a.type });
      }
      if (a.t > a.charge + a.n * a.every + 0.3) b.attack = null;
      break;
    case 'cannon':
      if (a.fired < a.n && a.t >= 0.4 + a.fired * a.every) {
        a.fired += 1;
        fireBolt(g, { x: b.x, y: 1.6, z: bz }, { speed: 30, big: true });
        emit(g, 'cannon');
      }
      if (a.t > 0.4 + a.n * a.every + 0.3) b.attack = null;
      break;
    case 'fusion': {
      g.warn = g.warn ?? { x: a.x, w: 1.7, t: 0, kind: 'fusion' };
      g.warn.t = a.t;
      if (a.active > 0) {
        a.active -= dt;
        const body = bodyOf(g);
        if (Math.abs(g.x - a.x) < 1.7 + body.hw) hurt(g, 'fusion');
        if (a.active <= 0) {
          if (a.fired < a.shots) {
            // the second shot follows you
            a.t = 0;
            a.x = clamp(g.x, -3, 3);
            g.warn = { x: a.x, w: 1.7, t: 0, kind: 'fusion' };
          } else {
            b.attack = null;
            g.warn = null;
          }
        }
      } else if (a.t >= a.charge) {
        a.fired += 1;
        a.active = 0.3;
        g.beams.push({ x: a.x, z: bz, t: 0, life: 0.45 });
        emit(g, 'fusion');
      }
      break;
    }
    default:
      if (a.t > (a.dur ?? 0.5)) b.attack = null;
  }
}

function stepPlayer(g, dt) {
  const inp = g.input ?? {};
  const kind = g.mode === 'robot' ? 'robot' : 'vehicle';
  // steering: keys or a stick move the target; a finger sets it directly
  if (inp.steer) g.tx = clamp(g.tx + inp.steer * ROLL.steerRate[kind] * dt, -ROLL.bounds, ROLL.bounds);
  g.tx = clamp(g.tx, -ROLL.bounds, ROLL.bounds);
  g.x += (g.tx - g.x) * (1 - Math.exp(-ROLL.follow[kind] * dt));
  g.x = clamp(g.x, -ROLL.bounds, ROLL.bounds);

  // transforming
  if (g.morphT >= 0) {
    g.morphT += dt;
    const k = Math.min(1, g.morphT / ROLL.transformTime);
    const to = g.mode === 'robot' ? 1 : 0;
    g.morph = g.morphFrom + (to - g.morphFrom) * ease(k);
    if (k >= 1) {
      g.morph = to;
      g.morphT = -1;
    }
  }

  // energon: standing up burns it, driving charges it, boosting burns it fast
  const E = ROLL.energon;
  g.boosting = g.mode === 'vehicle' && g.morph < 0.05 && Boolean(inp.boost) && g.energon > 0 && g.bridge <= 0;
  if (g.spark > 0) {
    // the shard runs everything
  } else if (g.mode === 'robot') g.energon -= E.drain * dt;
  else if (g.boosting) g.energon -= E.boost * dt;
  else g.energon += E.charge * dt;
  g.energon = clamp(g.energon, 0, E.max);
  if (g.mode === 'robot' && g.energon <= 0 && g.morphT < 0) {
    emit(g, 'empty', { text: 'Out of energon. Folding back up.' });
    g.mode = 'vehicle';
    g.morphFrom = g.morph;
    g.morphT = 0;
    emit(g, 'transform', { to: 'vehicle', log: 'transform:vehicle' });
  }

  // speed eases toward the form's speed, only with wheels (or feet) on the ground
  const target = g.mode === 'robot' ? g.robotSpeed : g.boosting ? boostSpeed(g) : g.vehicleSpeed;
  if (g.grounded) {
    if (g.speed < target) g.speed = Math.min(target, g.speed + ROLL.accel * (g.boosting ? 1.4 : 1) * dt);
    else g.speed = Math.max(target, g.speed - ROLL.decel * dt);
  }
  g.z += g.speed * dt;

  // up and down: the road, a ramp, or the drop through a broken bridge
  const floor = floorAt(g, g.z);
  if (g.grounded) {
    if (floor === -Infinity) {
      g.grounded = false;
      g.air = 0;
      // off the end of the ramp: a car flies, a robot just steps off
      if (g.morph < 0.5) {
        g.vy = ROLL.rampV;
        emit(g, 'launch');
      } else g.vy = 0;
    } else g.y = floor;
  }
  if (!g.grounded) {
    g.air += dt;
    g.vy -= ROLL.gravity * dt;
    g.y += g.vy * dt;
    // below the road's edge when the far side comes: that's the wall of the gap, not a landing
    const intoWall = floor !== -Infinity && g.y < floor - 0.5;
    if (floor !== -Infinity && g.y <= floor && !intoWall) {
      g.y = floor;
      const hard = g.vy < -8;
      g.vy = 0;
      g.grounded = true;
      g.air = 0;
      emit(g, 'land', { hard });
      if (g.jumpBuf > 0) jump(g);
    } else if (intoWall || (floor === -Infinity && g.y < -5)) {
      // fell through: Ratchet bridges you out on the far side
      const gap = g.gaps.find((p) => g.z >= p.z - 2 && g.z < p.z + p.len + 4) ?? g.gaps.find((p) => p.z + p.len > g.z - 20);
      hurt(g, 'gap');
      emit(g, 'fell', { text: 'Fell through the bridge. Ratchet bridged you out.' });
      g.z = (gap ? gap.z + gap.len : g.z) + 3;
      g.y = 0;
      g.vy = 0;
      g.grounded = true;
      g.air = 0;
      g.speed = Math.min(g.speed, g.robotSpeed);
      g.invuln = Math.max(g.invuln, ROLL.invuln);
    }
  }
  g.jumpBuf = Math.max(0, g.jumpBuf - dt);
}

function stepShots(g, dt) {
  const bot = ROLL.bots[g.bot];
  g.fire -= dt;
  if (armed(g) && g.fire <= 0 && g.bridge <= 0 && g.y > -1) {
    const target = aimAt(g);
    const from = { x: g.x + 0.35, y: g.y + 1.9, z: g.z + 0.6 };
    let dx = 0;
    let dy = 0;
    let dz = 1;
    if (target) {
      dx = target.x - from.x;
      dy = (target.y ?? 1.2) - from.y;
      dz = Math.max(1, target.z - from.z);
    }
    const len = Math.hypot(dx, dy, dz);
    const sp = ROLL.shot.speed;
    g.shots.push({ x: from.x, y: from.y, z: from.z, vx: (dx / len) * sp, vy: (dy / len) * sp, vz: (dz / len) * sp + g.speed, life: ROLL.shot.life, dmg: bot.dmg });
    g.fire = bot.fire;
    emit(g, 'shot');
  }
  for (const s of g.shots) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.z += s.vz * dt;
    s.life -= dt;
    if (s.life <= 0) continue;
    // what it hits: Decepticons, debris, the boss
    for (const e of g.enemies) {
      if (!e.alive) continue;
      const stand = e.kind === 'vehicon' && e.state !== 'pass';
      const hw = e.kind === 'jet' ? ROLL.jet.w / 2 : stand ? ROLL.vehicon.standW / 2 : ROLL.vehicon.w / 2;
      const hl = e.kind === 'jet' ? ROLL.jet.l / 2 : stand ? ROLL.vehicon.standL / 2 + 0.3 : ROLL.vehicon.l / 2;
      const ey = e.kind === 'jet' ? e.y : 0;
      const eh = e.kind === 'jet' ? 1.6 : stand ? ROLL.vehicon.standH : 1.6;
      if (Math.abs(s.x - e.x) < hw + ROLL.shot.r && Math.abs(s.z - e.z) < hl + ROLL.shot.r && s.y > ey - 0.6 && s.y < ey + eh + 0.4) {
        s.life = 0;
        e.hp -= s.dmg;
        e.flash = 1;
        g.fx.push({ kind: 'spark', x: s.x, y: s.y, z: s.z, t: 0, life: 0.25 });
        if (e.hp <= 0) {
          e.alive = false;
          kill(g, e.kind, e);
        }
        break;
      }
    }
    if (s.life <= 0) continue;
    for (const d of g.debris) {
      if (!d.alive || d.z < g.z - 2) continue;
      if (d.z > s.z + 3) break;
      if (Math.abs(s.x - d.x) < d.w / 2 + ROLL.shot.r && Math.abs(s.z - d.z) < d.l / 2 + ROLL.shot.r && s.y < d.h + 0.4) {
        s.life = 0;
        d.hp -= s.dmg;
        g.fx.push({ kind: 'spark', x: s.x, y: s.y, z: s.z, t: 0, life: 0.25 });
        if (d.hp <= 0) {
          d.alive = false;
          kill(g, 'debris', { x: d.x, y: 0.5, z: d.z });
        }
        break;
      }
    }
    if (s.life <= 0) continue;
    const b = g.boss;
    if (b && b.alive) {
      const bz = g.z + b.dz;
      const B = ROLL.bosses[b.kind];
      const by = b.kind === 'starscream' ? b.y : 2.4;
      const shielded = b.attack?.type === 'strafe' && b.dz < 8;
      if (!shielded && Math.abs(s.x - b.x) < B.r + ROLL.shot.r && Math.abs(s.z - bz) < 1.6 && Math.abs(s.y - by) < 2.6) {
        s.life = 0;
        b.hp -= s.dmg;
        b.flash = 1;
        g.fx.push({ kind: 'spark', x: s.x, y: s.y, z: s.z, t: 0, life: 0.25 });
        emit(g, 'bossHit');
        if (b.hp <= 0) {
          b.hp = 0;
          b.alive = false;
          g.kills.boss += 1;
          score(g, ROLL.points.boss);
          g.fx.push({ kind: 'boom', x: b.x, y: by, z: bz, t: 0, life: 1.8, big: true, huge: true });
          g.outro = ROLL.outro;
          g.bolts = [];
          g.waves = [];
          g.bombs = [];
          g.warn = null;
          emit(g, 'bossDown', { name: b.name });
        }
      }
    }
  }
  g.shots = g.shots.filter((s) => s.life > 0);
}

// The blaster's aim assist: the nearest thing worth shooting in a cone ahead.
export function aimAt(g) {
  let best = null;
  let bestScore = Infinity;
  const consider = (x, y, z, w = 0) => {
    const dz = z - g.z;
    if (dz < 2 || dz > ROLL.shot.range) return;
    const dx = Math.abs(x - g.x);
    if (dx > 2.4 + w + dz * 0.2) return;
    const s = dz + dx * 6;
    if (s < bestScore) {
      bestScore = s;
      best = { x, y, z };
    }
  };
  for (const e of g.enemies) if (e.alive) consider(e.x, e.kind === 'jet' ? e.y + 0.4 : 1.3, e.z, 0.8);
  for (const d of g.debris) {
    if (d.z > g.z + ROLL.shot.range) break;
    if (d.alive && Math.abs(d.x - g.x) < 1.6) consider(d.x, 0.6, d.z);
  }
  const b = g.boss;
  if (b && b.alive && !(b.attack?.type === 'strafe' && b.dz < 8)) {
    const bz = g.z + b.dz;
    const dz = bz - g.z;
    const dx = Math.abs(b.x - g.x);
    if (dz > 2 && dx < 4 + dz * 0.25) {
      const s = dz + dx * 6;
      if (s < bestScore) best = { x: b.x, y: b.kind === 'starscream' ? b.y : 2.4, z: bz };
    }
  }
  return best;
}

function stepWorld(g, dt, body) {
  const smash = g.boosting || g.spark > 0;
  const low = g.y; // the bottom of the player
  // traffic: cruising, braking for what's ahead, changing lanes
  for (const c of g.cars) {
    if (c.z > g.z + 230) break;
    if (!c.alive) continue;
    if (c.hit) {
      c.x += c.vx * dt;
      c.spin += dt * 6;
      c.speed = Math.max(0, c.speed - 20 * dt);
      c.z += c.speed * dt;
      continue;
    }
    c.cruise ??= c.speed;
    c.h ??= ROLL.car.h;
    // what's in its lane ahead: a roadblock, a broken bridge, a slower car, debris
    let ahead = c.stopZ ?? Infinity;
    if (!c.pull) {
      for (const o of g.cars) {
        if (o !== c && o.alive && !o.hit && !o.pull && o.z > c.z && Math.abs(o.x - c.x) < 1.6 && o.z - o.l - 2 < ahead) ahead = o.z - o.l - 2;
      }
      for (const d of g.debris) {
        if (d.z > ahead) break;
        if (d.alive && d.z > c.z && Math.abs(d.x - c.x) < 1.6) ahead = d.z - d.l - 3;
      }
    }
    const room = ahead - c.z;
    // blocked: indicate, and pull over onto the shoulder, clear of the road
    if (!c.pull && room < 20 && c.z - g.z < 160) {
      c.pull = true;
      c.toX = c.x >= 0 ? 7.9 : -7.9;
      c.blink = 0.45;
      c.shift = null;
    }
    const want = c.pull ? (c.blink > 0 ? c.cruise * 0.6 : Math.max(0, c.cruise * 0.5 - Math.abs(c.toX - c.x) * 0.2)) : c.cruise;
    c.speed += (want - c.speed) * Math.min(1, dt * 2.5);
    c.z += c.speed * dt;
    if (c.shift && !c.shift.done && c.z - g.z < c.shift.at && c.z > g.z) {
      c.shift.done = true;
      c.toX = LANES[c.shift.to];
      c.blink = 0.8;
    }
    if (c.blink > 0) c.blink -= dt;
    else if (c.toX != null) c.x += (c.toX - c.x) * Math.min(1, dt * 1.6);
    // the player
    if (g.y > -1 && overlap(g, body, c.x, c.z, c.w / 2, c.l / 2)) {
      if (low > c.h) continue; // jumped clean over it
      if (g.spark > 0) {
        // the shard phases you through
      } else if (hurt(g, 'car')) {
        c.hit = true;
        c.vx = (c.x >= g.x ? 1 : -1) * 6;
        c.spin = 0;
        g.fx.push({ kind: 'spark', x: (c.x + g.x) / 2, y: 0.8, z: c.z - c.l / 2, t: 0, life: 0.4 });
      }
    } else if (!c.passed && c.z + c.l / 2 < g.z - body.hl) {
      c.passed = true;
      const gap = Math.abs(c.x - g.x) - c.w / 2 - body.hw;
      if (gap < ROLL.nearGap && gap > -0.01 && g.invuln <= 0) {
        g.nears += 1;
        score(g, ROLL.points.near);
        emit(g, 'near', { x: c.x, z: c.z });
      }
    }
  }
  // debris
  for (const d of g.debris) {
    if (d.z > g.z + 4) break;
    if (!d.alive || d.z < g.z - 4) continue;
    if (g.y > -1 && overlap(g, body, d.x, d.z, d.w / 2, d.l / 2) && low < d.h) {
      if (smash) {
        d.alive = false;
        kill(g, 'debris', { x: d.x, y: 0.5, z: d.z });
      } else if (hurt(g, 'debris')) {
        d.alive = false;
        g.fx.push({ kind: 'boom', x: d.x, y: 0.5, z: d.z, t: 0, life: 0.5 });
      }
    }
  }
  // roadblocks
  for (const b of g.barricades) {
    if (b.z > g.z + 4) break;
    if (b.broken || b.z < g.z - 4) continue;
    if (g.y > -1 && Math.abs(b.z - g.z) < b.l / 2 + body.hl && low < b.h) {
      b.broken = true;
      if (g.spark > 0) kill(g, 'debris', { x: g.x, y: 0.6, z: b.z });
      else {
        hurt(g, 'barricade');
        g.speed = Math.min(g.speed, g.robotSpeed * 0.7);
        g.fx.push({ kind: 'boom', x: g.x, y: 0.6, z: b.z, t: 0, life: 0.6 });
      }
    }
  }
  // energon cubes and the Allspark shard
  for (const c of g.cubes) {
    if (c.z > g.z + 3) break;
    if (c.taken || c.z < g.z - 3) continue;
    if (Math.abs(c.x - g.x) < 1.3 && Math.abs(c.z - g.z) < body.hl + 0.6 && c.y > g.y - 0.4 && c.y < g.y + body.h + 0.5) {
      c.taken = true;
      g.taken += 1;
      g.energon = Math.min(ROLL.energon.max, g.energon + ROLL.energon.cube);
      score(g, ROLL.points.cube);
      emit(g, 'cube');
    }
  }
  for (const s of g.sparks) {
    if (s.taken || Math.abs(s.z - g.z) > body.hl + 0.6) continue;
    if (Math.abs(s.x - g.x) < ROLL.spark.w + body.hw && s.y > g.y - 0.6 && s.y < g.y + body.h + 0.6) {
      s.taken = true;
      g.spark = ROLL.spark.time;
      g.energon = Math.min(ROLL.energon.max, g.energon + ROLL.energon.spark);
      score(g, ROLL.points.spark);
      emit(g, 'spark', { text: 'An Allspark shard. Nothing can touch you.' });
    }
  }
  // triggers: Decepticons coming up behind, jets ahead
  while (g.triggers.length && g.triggers[0].z <= g.z) {
    const tr = g.triggers.shift();
    if (g.boss) continue;
    if (tr.kind === 'vehicons') spawnVehicons(g, tr.n);
    else for (let i = 0; i < tr.n; i++) spawnJet(g, i);
  }
  // Decepticons
  const lv = ROLL.levels[g.level];
  for (const e of g.enemies) {
    if (!e.alive) continue;
    e.t += dt;
    e.flash = Math.max(0, (e.flash ?? 0) - dt * 5);
    if (e.kind === 'vehicon') {
      if (e.state === 'pass') {
        e.speed = Math.max(e.speed, g.speed + 6);
        e.z += e.speed * dt;
        // some swerve at you as they come alongside
        if (e.swerve && !e.swerve.done && Math.abs(e.z - g.z) < 6) {
          e.swerve.at += dt;
          if (e.swerve.at > 0.45) {
            e.swerve.done = true;
            e.toX = clamp(g.x, -ROLL.bounds, ROLL.bounds);
          }
        }
        if (e.toX != null) e.x += (e.toX - e.x) * Math.min(1, dt * 3);
        if (e.z > g.z + e.ahead) {
          e.state = 'turn';
          e.t = 0;
          e.toX = null;
          emit(g, 'transformFoe');
        }
        if (g.y > -1 && overlap(g, body, e.x, e.z, ROLL.vehicon.w / 2, ROLL.vehicon.l / 2) && low < 1.5) {
          if (g.spark > 0) {
            e.alive = false;
            kill(g, 'vehicon', e);
          } else if (hurt(g, 'vehicon')) e.x += e.x >= g.x ? 1.5 : -1.5;
        }
      } else {
        // brakes, stands up and fights; edges toward your lane
        if (e.state === 'turn') {
          e.speed = Math.max(0, e.speed - 60 * dt);
          e.z += e.speed * dt;
          if (e.t > 0.7) {
            e.state = 'stand';
            e.speed = 0;
            e.t = 0;
          }
        } else {
          e.x += clamp(g.x - e.x, -1, 1) * 1.1 * dt;
          e.cool -= dt;
          if (e.cool <= 0 && e.z - g.z > 6 && e.z - g.z < 60) {
            fireBolt(g, { x: e.x, y: 1.6, z: e.z - 0.6 });
            e.cool = ROLL.vehicon.fire * lv.fire * (0.8 + g.rand() * 0.4);
            emit(g, 'foeShot');
          }
        }
        if (g.y > -1 && overlap(g, body, e.x, e.z, ROLL.vehicon.standW / 2, ROLL.vehicon.standL / 2) && low < ROLL.vehicon.standH) {
          if (smash) {
            e.alive = false;
            kill(g, 'vehicon', e);
          } else if (hurt(g, 'vehicon')) {
            e.alive = false;
            g.fx.push({ kind: 'boom', x: e.x, y: 1, z: e.z, t: 0, life: 0.6 });
          }
        }
      }
      if (e.z < g.z - 40) e.alive = false;
    } else if (e.kind === 'jet') {
      e.z -= ROLL.jet.speed * dt;
      e.x += Math.sin(e.t * 1.7) * dt * 1.5;
      // over the road ahead of you: a stick of bombs
      const dz = e.z - g.z;
      // the stick falls along one line, where you were when it started
      if (e.dropped < ROLL.jet.bombs && dz < 48 && dz > 8) {
        e.next -= dt;
        if (e.next <= 0) {
          e.bombX ??= g.x + (g.rand() - 0.5) * 0.8;
          e.dropped += 1;
          e.next = 0.24;
          dropBomb(g, e.bombX);
          emit(g, 'bomb');
        }
      }
      if (e.z < g.z - 30) e.alive = false;
    }
  }
  g.enemies = g.enemies.filter((e) => e.alive);

  // bolts: blaster fire, missiles and Starscream's dive
  for (const b of g.bolts) {
    b.r ??= ROLL.bolt.r;
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    b.y += (ROLL.bolt.y - b.y) * Math.min(1, dt * 3.5);
    b.life -= dt;
    if (g.y > -1 && Math.abs(b.x - g.x) < b.r + body.hw && Math.abs(b.z - g.z) < body.hl + 0.4 && b.y > g.y - 0.3 && b.y < g.y + body.h + 0.2) {
      if (hurt(g, b.dive ? 'dive' : 'bolt') || g.spark > 0) b.life = 0;
    }
  }
  g.bolts = g.bolts.filter((b) => b.life > 0 && b.z > g.z - 20);

  // bombs: a marker, then the blast
  for (const m of g.bombs) {
    if (m.done) continue;
    m.t += dt;
    if (m.t >= m.fuse) {
      if (!m.blew) {
        m.blew = true;
        g.fx.push({ kind: 'boom', x: m.x, y: 0.3, z: m.z, t: 0, life: 0.7, big: true });
        emit(g, 'boom');
      }
      if (Math.hypot(m.x - g.x, m.z - g.z) < m.r + body.hw && g.y < 1.6 && g.y > -1) hurt(g, 'bomb');
      if (m.t >= m.fuse + ROLL.bomb.blast) m.done = true;
    }
  }
  g.bombs = g.bombs.filter((m) => !m.done || m.t < m.fuse + 0.8);

  // floor beams and shockwaves: a wall of energy across the road, jump it
  for (const w of g.waves) {
    w.z += w.vz * dt;
    w.life -= dt;
    if (!w.passed && Math.abs(w.z - g.z) < ROLL.wave.d / 2 + body.hl && g.y > -1) {
      if (g.y < w.h) {
        if (hurt(g, 'beam')) w.passed = true;
      }
    }
    if (w.z < g.z - body.hl - 1) w.passed = true;
  }
  g.waves = g.waves.filter((w) => w.life > 0 && w.z > g.z - 10);
  for (const bm of g.beams) bm.t += dt;
  g.beams = g.beams.filter((bm) => bm.t < bm.life);

  // effects age
  for (const f of g.fx) f.t += dt;
  g.fx = g.fx.filter((f) => f.t < f.life);

  // tidy what's behind
  if (g.cars.length && g.cars[0].z < g.z - 60) g.cars = g.cars.filter((c) => c.z > g.z - 60);
  if (g.debris.length && g.debris[0].z < g.z - 30) g.debris = g.debris.filter((d) => d.z > g.z - 30);
  if (g.cubes.length && g.cubes[0].z < g.z - 30) g.cubes = g.cubes.filter((c) => c.z > g.z - 30);
  if (g.barricades.length && g.barricades[0].z < g.z - 30) g.barricades = g.barricades.filter((b) => b.z > g.z - 30);
  if (g.gaps.length && g.gaps[0].z + g.gaps[0].len < g.z - 40) g.gaps = g.gaps.filter((p) => p.z + p.len > g.z - 40);
  g.sparks = g.sparks.filter((s) => !s.taken && s.z > g.z - 20);
}

function stepOnce(g, dt) {
  g.t += dt;
  g.invuln = Math.max(0, g.invuln - dt);
  g.spark = Math.max(0, g.spark - dt);
  g.shake = Math.max(0, g.shake - dt * 2.5);
  g.flash = Math.max(0, g.flash - dt * 2);

  const z0 = g.z;
  stepPlayer(g, dt);
  const body = bodyOf(g);
  // distance pays: a car more than a robot, a boost more again
  if (g.bridge <= 0) score(g, (g.z - z0) * ROLL.points.meter * (g.mode === 'robot' ? 0.5 : g.boosting ? 1.5 : 1));

  // the boss, the end of the stage, the bridge to the next
  if (!g.boss && g.bridge <= 0 && g.outro <= 0 && g.z >= g.stageLen) startBoss(g);
  if (g.boss) stepBoss(g, dt);
  if (g.outro > 0) {
    g.outro -= dt;
    if (g.outro <= 0) {
      const bonus = ROLL.points.stage + g.shields * ROLL.points.shield;
      score(g, bonus);
      if (g.stage >= ROLL.stages.length - 1) {
        g.status = 'won';
        emit(g, 'won', { text: 'Till all are one. Megatron is down and Kaon is quiet.' });
        return;
      }
      g.bridge = ROLL.bridgeTime;
      g.bridgeHalf = false;
      emit(g, 'clear', { name: ROLL.stages[g.stage].name, bonus });
    }
  }
  if (g.bridge > 0) {
    g.bridge -= dt;
    if (!g.bridgeHalf && g.bridge <= ROLL.bridgeTime / 2) {
      g.bridgeHalf = true;
      g.stage += 1;
      g.boss = null;
      g.enemies = [];
      g.bolts = [];
      g.waves = [];
      g.bombs = [];
      g.shots = [];
      g.warn = null;
      g.shields = Math.min(g.maxShields, g.shields + 1);
      g.energon = Math.max(g.energon, ROLL.energon.start);
      buildStage(g, g.z);
      emit(g, 'stage', { index: g.stage, name: ROLL.stages[g.stage].name, log: `stage:${g.stage}` });
    }
    if (g.bridge <= 0) g.bridge = 0;
  }
  if (g.boss && !g.boss.alive && g.boss.dying > 3) g.boss = null;

  stepShots(g, dt);
  stepWorld(g, dt, body);
}

// Advance the run by dt seconds, in fixed steps so a slow frame can't carry
// you through a barricade.
export function stepRun(g, dt) {
  if (g.status !== 'running') return;
  g.acc = Math.min(g.acc + Math.max(0, dt), 0.25);
  while (g.acc >= ROLL.step && g.status === 'running') {
    g.acc -= ROLL.step;
    stepOnce(g, ROLL.step);
  }
}

// What's coming: the next roadblock or broken bridge ahead, for the HUD and
// the autopilot.
export function nextWall(g, within = 120) {
  const b = g.barricades.find((x) => !x.broken && x.z > g.z - 1 && x.z < g.z + within);
  const p = g.gaps.find((x) => x.z + x.len > g.z && x.z - ROLL.ramp.len < g.z + within);
  if (!b && !p) return null;
  if (b && (!p || b.z < p.z - ROLL.ramp.len)) return { kind: 'barricade', z: b.z, dist: b.z - g.z };
  return { kind: 'gap', z: p.z - ROLL.ramp.len, lip: p.z, len: p.len, dist: p.z - ROLL.ramp.len - g.z };
}

export { pick };
