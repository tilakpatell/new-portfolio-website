// The trench run's rules, apart from the drawing, so they can be tested.
//
// Over the Death Star's surface first: TIE fighters come in weaving and
// shooting, and turbolaser towers stand up off the plating. Then Red Five
// dives into the trench: catwalks, walls, turbolaser bolts and wall turrets,
// Vader on your tail, Han to clear him, and two proton torpedoes for a
// thermal exhaust port. Lasers (held fire) take out TIEs, towers and turrets;
// a near miss pays; R2 patches one shield. Everything random comes from the
// run's seed, so a run replays the same way.
//
// World units: x across the trench (its walls at ±1), y up (the floor at -1,
// the surface at +1), z along it. The ship is at `z`, and everything ahead
// has a larger z.

export const TRENCH = {
  near: 0.7,
  far: 46,
  surfaceLen: 100,
  diveLen: 12,
  trenchLen: 150,
  portPast: 18,
  step: 1 / 120, // the simulation runs in steps no longer than this
  levels: {
    rookie: { label: 'Rookie', speed: 6.3, shields: 4, density: 0.8, ties: 5, tieFire: 2.8, towerFire: 3.4 },
    red5: { label: 'Red Five', speed: 7.2, shields: 3, density: 1, ties: 7, tieFire: 2.1, towerFire: 2.6 },
    jedi: { label: 'Jedi', speed: 8.4, shields: 2, density: 1.25, ties: 9, tieFire: 1.6, towerFire: 2 },
  },
  bounds: { surface: { x: 2.4, y: [1.35, 2.5] }, trench: { x: 0.88, y: [-0.85, 0.85] } },
  steer: 1.9, // how fast the keys move where the ship is heading
  ease: 7, // how fast the ship follows
  laser: { speed: 60, cooldown: 0.15, life: 0.9, spread: 0.22, reach: 0.7 },
  tie: { closing: 5, weave: 0.6, hit: 0.38, ram: 0.32, start: 36 },
  boltSpeed: 18,
  boltHit: 0.3,
  points: { tie: 150, turret: 75, tower: 50, port: 1000, shield: 250, near: 25 },
  comboWindow: 2.2,
  r2Delay: 9,
  torpedoRange: 26,
  window: [2.5, 9], // how far from the port a torpedo can go in
  lined: { x: 0.45, y: 0.1 }, // and how centred and low the ship must be
  forceBonus: 1.5,
  vaderAt: 46, // Vader joins this far from the port
  hanAt: 15, // and Han clears him off here
};

export const trenchStart = () => TRENCH.surfaceLen + TRENCH.diveLen;
export const portZ = () => trenchStart() + TRENCH.trenchLen + TRENCH.portPast;
export const zoneAt = (z) => (z < TRENCH.surfaceLen ? 'surface' : z < trenchStart() ? 'dive' : 'trench');

const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// How far the ship can go at a point in the run: wide and high over the
// surface, narrowing down into the trench on the dive.
export function boundsAt(z) {
  const k = clamp((z - TRENCH.surfaceLen) / TRENCH.diveLen, 0, 1);
  const { surface: s, trench: t } = TRENCH.bounds;
  return { x: lerp(s.x, t.x, k), y0: lerp(s.y[0], t.y[0], k), y1: lerp(s.y[1], t.y[1], k) };
}

function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The trench: catwalks, walls, bolts already on their way, and wall turrets.
function trenchCourse(rand, L) {
  const items = [];
  const z0 = trenchStart();
  for (let z = z0 + 14; z < z0 + TRENCH.trenchLen - 4; z += (6.5 + rand() * 3) / L.density) {
    const r = rand();
    if (r < 0.36) items.push({ kind: 'catwalk', z, y: -0.55 + rand() * 1.1 });
    else if (r < 0.66) items.push({ kind: 'wall', z, side: rand() < 0.5 ? -1 : 1 });
    else if (r < 0.84) items.push({ kind: 'bolt', z: z + 10, x: rand() * 1.6 - 0.8, y: rand() * 1.4 - 0.7, speed: 9 + rand() * 4 });
    else items.push({ kind: 'turret', z, side: rand() < 0.5 ? -1 : 1, y: rand() * 1.2 - 0.6, fired: false, alive: true });
  }
  return items;
}

// Turbolaser towers on the surface, either side of the trench's groove.
function towersFor(rand, L) {
  const out = [];
  for (let z = 22; z < TRENCH.surfaceLen - 8; z += (8 + rand() * 5) / L.density) {
    const side = rand() < 0.5 ? -1 : 1;
    out.push({ z, x: side * (1.25 + rand() * 1.05), h: 0.45 + rand() * 0.4, alive: true, fire: 1 + rand() * L.towerFire });
  }
  return out;
}

// When (by the ship's z) each TIE fighter turns up over the surface.
function tieTimes(rand, L) {
  const out = [];
  const a = 8;
  const b = TRENCH.surfaceLen - 24;
  for (let i = 0; i < L.ties; i++) out.push(a + ((b - a) * (i + rand() * 0.8)) / L.ties);
  return out.sort((x, y) => x - y);
}

export function newRun({ seed = 1, level = 'red5' } = {}) {
  const L = TRENCH.levels[level] ?? TRENCH.levels.red5;
  const rand = rng(seed);
  const items = trenchCourse(rand, L);
  const towers = towersFor(rand, L);
  const tieAt = tieTimes(rand, L);
  return {
    level: TRENCH.levels[level] ? level : 'red5',
    L,
    seed,
    rand,
    speed: L.speed,
    t: 0,
    z: 0,
    px: 0,
    py: 1.9,
    tx: 0,
    ty: 1.9,
    keys: {},
    shields: L.shields,
    maxShields: L.shields,
    torpedoes: 2,
    computer: true,
    status: 'running', // running | winning | won | lost
    message: '',
    items,
    towers,
    tieAt,
    ties: [],
    bolts: [],
    lasers: [],
    rear: [],
    shots: [],
    fx: [],
    vader: { on: false, gone: false, cooldown: 1.2, spin: 0, away: 0 },
    laserCool: 0,
    score: 0,
    kills: { tie: 0, turret: 0, tower: 0 },
    combo: { n: 0, last: -99 },
    nearMisses: 0,
    r2: { used: false, at: null },
    said: {},
    events: [],
    flash: 0,
    shake: 0,
    win: null,
  };
}

const emit = (g, type, extra = {}) => g.events.push({ type, ...extra });
const say = (g, key, text) => {
  if (g.said[key]) return;
  g.said[key] = true;
  emit(g, 'say', { text });
};

function lose(g, message) {
  if (g.status !== 'running') return;
  g.status = 'lost';
  g.message = message;
  emit(g, 'lost', { text: message });
}

function damage(g, why) {
  if (g.status !== 'running' || g.shields <= 0) return;
  g.shields -= 1;
  g.flash = 0.35;
  g.shake = 0.3;
  if (g.r2.at == null) g.r2.at = g.t + TRENCH.r2Delay;
  emit(g, 'hit', { why, shields: g.shields });
  if (g.shields <= 0) lose(g, why === 'vader' ? 'Vader got you. Pull up, and try again.' : why === 'tie' ? 'The TIEs got you. Pull up, and try again.' : 'Shields are gone. Pull up, and try again.');
}

function kill(g, what, x, y, z) {
  const n = g.t - g.combo.last < TRENCH.comboWindow ? g.combo.n + 1 : 1;
  g.combo = { n, last: g.t };
  const points = TRENCH.points[what] * n;
  g.score += points;
  g.kills[what] += 1;
  emit(g, 'kill', { what, points, combo: n });
  for (let i = 0; i < 14 && g.fx.length < 90; i++) {
    const a = g.rand() * Math.PI * 2;
    const v = 0.6 + g.rand() * 1.6;
    g.fx.push({ x, y, z, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: (g.rand() - 0.5) * 2, life: 0.5 + g.rand() * 0.5, t: 0 });
  }
}

// A bolt from (x, y, z) aimed at where the ship is now.
function aimBolt(g, x, y, z, from) {
  const dx = g.px - x;
  const dy = g.py - y;
  const dz = g.z - z;
  const d = Math.hypot(dx, dy, dz) || 1;
  const v = TRENCH.boltSpeed;
  g.bolts.push({ x, y, z, vx: (dx / d) * v, vy: (dy / d) * v, vz: (dz / d) * v, from });
}

export function fireTorpedo(g) {
  if (g.status !== 'running' || g.torpedoes <= 0) return;
  const dist = portZ() - g.z;
  if (dist > TRENCH.torpedoRange) {
    emit(g, 'hold', { text: 'Save your torpedoes for the exhaust port.' });
    return;
  }
  g.torpedoes -= 1;
  emit(g, 'torpedo');
  const [lo, hi] = TRENCH.window;
  const onTarget = Math.abs(g.px) < TRENCH.lined.x && g.py < TRENCH.lined.y;
  if (dist > lo && dist < hi && onTarget) {
    g.status = 'winning';
    g.win = { t: 0, boom: false };
    let score = g.score + TRENCH.points.port + g.shields * TRENCH.points.shield;
    if (!g.computer) score = Math.round(score * TRENCH.forceBonus);
    g.score = score;
    emit(g, 'away', { text: 'Torpedoes away…', force: !g.computer });
    return;
  }
  g.shots.push({ z: g.z + 1, x: g.px, y: g.py });
  emit(g, 'miss', { text: dist >= hi ? 'Too early. It just impacted on the surface.' : 'Negative. It just impacted on the surface.' });
  if (g.torpedoes <= 0) lose(g, 'Out of torpedoes. Pull up, and try again.');
}

export function toggleComputer(g) {
  if (g.status !== 'running') return g.computer;
  g.computer = !g.computer;
  emit(g, 'computer', { on: g.computer });
  return g.computer;
}

export function endRun(g, message) {
  lose(g, message);
}

export function stepRun(g, dt) {
  let left = dt;
  do {
    const h = Math.min(left, TRENCH.step);
    stepOnce(g, h);
    left -= h;
  } while (left > 1e-9);
}

function stepOnce(g, dt) {
  if (g.flash > 0) g.flash = Math.max(0, g.flash - dt * 0.8);
  if (g.shake > 0) g.shake = Math.max(0, g.shake - dt);
  for (const f of g.fx) {
    f.t += dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.z += f.vz * dt;
  }
  if (g.fx.length) g.fx = g.fx.filter((f) => f.t < f.life);

  if (g.status === 'winning') {
    const win = g.win;
    win.t += dt;
    g.t += dt;
    g.z += g.speed * 0.25 * dt;
    // Luke pulls up and out of the trench
    g.ty = Math.min(0.85, g.ty + dt * 1.4);
    g.py += (g.ty - g.py) * Math.min(1, dt * 4);
    if (!win.boom && win.t >= 0.6) {
      win.boom = true;
      g.flash = 1;
      emit(g, 'boom');
    }
    if (win.t >= 2.5) {
      g.status = 'won';
      emit(g, 'won', { text: g.computer ? 'Great shot, kid. That was one in a million.' : 'The Force is strong with this one. Great shot.' });
    }
    return;
  }
  if (g.status !== 'running') return;
  g.t += dt;

  // steering: keys nudge where the ship is heading, the ship eases after it
  const k = g.keys;
  const kx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
  const ky = (k.up ? 1 : 0) - (k.down ? 1 : 0);
  const b = boundsAt(g.z);
  g.tx = clamp(g.tx + kx * dt * TRENCH.steer, -b.x, b.x);
  g.ty = clamp(g.ty + ky * dt * TRENCH.steer, b.y0, b.y1);
  g.px = clamp(g.px + (g.tx - g.px) * Math.min(1, dt * TRENCH.ease), -b.x, b.x);
  g.py = clamp(g.py + (g.ty - g.py) * Math.min(1, dt * TRENCH.ease), b.y0, b.y1);
  const prevZ = g.z;
  g.z += g.speed * dt;
  const zone = zoneAt(g.z);

  // the radio
  if (g.t > 0.4) say(g, 'start', 'Red Leader: “This is it, boys. Stay tight, the TIEs are coming in.”');
  if (zone === 'dive') say(g, 'dive', 'Luke: “Red Five, going in.”');
  if (zone === 'trench' && g.z > trenchStart() + 6) say(g, 'trench', 'Gold Five: “Stay on target.”');
  if (portZ() - g.z < TRENCH.torpedoRange) say(g, 'range', 'In range. Torpedoes on F or Enter.');

  // lasers: held fire, two cannons at a time
  g.laserCool -= dt;
  if (k.fire && g.laserCool <= 0) {
    g.laserCool = TRENCH.laser.cooldown;
    const s = TRENCH.laser.spread;
    for (const side of [-1, 1]) g.lasers.push({ x: g.px + side * s, y: g.py - 0.05, z: g.z + 0.8, life: TRENCH.laser.life });
    emit(g, 'laser');
  }

  // TIE fighters over the surface: turn up ahead, weave, shoot, pass
  if (zone !== 'surface') g.tieAt.length = 0; // they only come in over the surface
  while (g.tieAt.length && g.z >= g.tieAt[0]) {
    g.tieAt.shift();
    const x0 = g.rand() * 3.4 - 1.7;
    g.ties.push({ x: x0, x0, y: 1.55 + g.rand() * 0.85, z: g.z + TRENCH.tie.start, phase: g.rand() * 6, fire: 1.2 + g.rand() * g.L.tieFire, alive: true });
    say(g, 'ties', 'Biggs: “TIE fighters, dead ahead!”');
  }
  for (const t of g.ties) {
    if (!t.alive) continue;
    const before = t.z - prevZ;
    t.z -= TRENCH.tie.closing * dt;
    t.phase = (t.phase ?? 0) + dt * 1.6;
    t.x = (t.x0 ?? t.x) + Math.sin(t.phase) * TRENCH.tie.weave * (t.x0 == null ? 0 : 1);
    t.fire = (t.fire ?? 99) - dt;
    const ahead = t.z - g.z;
    if (t.fire <= 0 && ahead > 6) {
      t.fire = g.L.tieFire * (0.7 + g.rand() * 0.6);
      aimBolt(g, t.x, t.y, t.z, 'tie');
    }
    if (before > 0 && ahead <= 0) {
      if (Math.hypot(t.x - g.px, t.y - g.py) < TRENCH.tie.ram) {
        t.alive = false;
        damage(g, 'tie');
      }
    }
    if (ahead < -3) t.alive = false;
  }

  // towers on the surface: they shoot, and they're in the way if you fly low
  for (const tw of g.towers) {
    if (!tw.alive) continue;
    const ahead = tw.z - g.z;
    const before = tw.z - prevZ;
    tw.fire -= dt;
    if (tw.fire <= 0 && ahead > 8 && ahead < 28) {
      tw.fire = g.L.towerFire * (0.8 + g.rand() * 0.4);
      aimBolt(g, tw.x, 1 + tw.h, tw.z, 'tower');
    }
    if (before > 0.6 && ahead <= 0.6 && Math.abs(g.px - tw.x) < 0.28 && g.py < 1 + tw.h) damage(g, 'tower');
  }

  // the trench: obstacles cross the ship one unit ahead of it
  for (const it of g.items) {
    if (it.kind === 'bolt') it.z -= it.speed * dt;
    if (it.done) continue;
    const before = it.z - prevZ + (it.kind === 'bolt' ? it.speed * dt : 0);
    const now = it.z - g.z;
    if (it.kind === 'turret') {
      if (it.alive && !it.fired && now < 22 && now > 4) {
        it.fired = true;
        aimBolt(g, it.side * 0.92, it.y, it.z, 'turret');
      }
      if (now < -2) it.done = true;
      continue;
    }
    if (before > 1 && now <= 1) {
      it.done = true;
      let hit = false;
      let near = false;
      if (it.kind === 'catwalk') {
        const d = Math.abs(g.py - it.y);
        hit = d < 0.26;
        near = d < 0.46;
      } else if (it.kind === 'wall') {
        const edge = it.side < 0 ? g.px - 0.17 : -0.17 - g.px; // how far clear of it
        hit = edge < 0;
        near = edge < 0.2;
      } else {
        const d = Math.hypot(g.px - it.x, g.py - it.y);
        hit = d < 0.3;
        near = d < 0.5;
      }
      if (hit) damage(g, it.kind);
      else if (near) {
        g.nearMisses += 1;
        g.score += TRENCH.points.near;
        emit(g, 'near', { points: TRENCH.points.near });
      }
    }
  }

  // lasers in flight: TIEs, towers and turrets
  for (const l of g.lasers) {
    l.life -= dt;
    l.z += TRENCH.laser.speed * dt;
    if (l.life <= 0) continue;
    const reach = TRENCH.laser.reach;
    for (const t of g.ties) {
      if (t.alive && Math.abs(l.z - t.z) < reach && Math.hypot(l.x - t.x, l.y - t.y) < TRENCH.tie.hit) {
        t.alive = false;
        l.life = 0;
        kill(g, 'tie', t.x, t.y, t.z);
        break;
      }
    }
    if (l.life <= 0) continue;
    for (const tw of g.towers) {
      if (tw.alive && Math.abs(l.z - tw.z) < reach && Math.abs(l.x - tw.x) < 0.3 && l.y > 0.95 && l.y < 1 + tw.h + 0.08) {
        tw.alive = false;
        l.life = 0;
        kill(g, 'tower', tw.x, 1 + tw.h / 2, tw.z);
        break;
      }
    }
    if (l.life <= 0) continue;
    for (const it of g.items) {
      if (it.kind === 'turret' && it.alive && Math.abs(l.z - it.z) < reach && Math.hypot(l.x - it.side * 0.92, l.y - it.y) < 0.42) {
        it.alive = false;
        l.life = 0;
        kill(g, 'turret', it.side * 0.92, it.y, it.z);
        break;
      }
    }
  }
  g.lasers = g.lasers.filter((l) => l.life > 0);
  if (g.ties.length > 12) g.ties = g.ties.filter((t) => t.alive);

  // bolts in flight: they land if they cross the ship close enough
  for (const bo of g.bolts) {
    const before = bo.z - prevZ;
    bo.x += bo.vx * dt;
    bo.y += bo.vy * dt;
    bo.z += bo.vz * dt;
    const now = bo.z - g.z;
    if (!bo.done && before > 0 && now <= 0) {
      bo.done = true;
      if (Math.hypot(bo.x - g.px, bo.y - g.py) < TRENCH.boltHit) damage(g, bo.from);
    }
    if (now < -4) bo.done = true;
  }
  g.bolts = g.bolts.filter((bo) => !bo.done || bo.z - g.z > -4);
  g.shots.forEach((s) => (s.z += g.speed * 3 * dt));

  // Vader, then Han
  const toPort = portZ() - g.z;
  const v = g.vader;
  if (!v.on && !v.gone && toPort < TRENCH.vaderAt) {
    v.on = true;
    emit(g, 'vader', { text: 'Vader: “The Force is strong with this one.”' });
  }
  if (v.on && !v.gone) {
    v.cooldown -= dt;
    if (v.cooldown <= 0) {
      v.cooldown = 0.9 + g.rand() * 0.6;
      g.rear.push({ z: g.z - 2.5, x: g.px + (g.rand() - 0.5) * 0.9, y: g.py + (g.rand() - 0.5) * 0.7, checked: false });
    }
    if (toPort < TRENCH.hanAt) {
      v.gone = true;
      v.on = false;
      v.away = 1;
      emit(g, 'han', { text: 'Han: “You’re all clear, kid. Now blow this thing.”' });
    }
  }
  if (v.gone && v.away > 0) {
    v.away = Math.max(0, v.away - dt * 0.6);
    v.spin += dt * 9;
  }
  for (const r of g.rear) {
    r.z += (g.speed + 16) * dt;
    if (!r.checked && r.z >= g.z) {
      r.checked = true;
      if (Math.hypot(r.x - g.px, r.y - g.py) < 0.18) damage(g, 'vader');
    }
  }
  if (g.rear.length) g.rear = g.rear.filter((r) => r.z - g.z < TRENCH.far);

  // R2 patches one shield, once, a while after the first hit
  if (!g.r2.used && g.r2.at != null && g.t >= g.r2.at && g.status === 'running') {
    g.r2.used = true;
    if (g.shields < g.maxShields && g.shields > 0) {
      g.shields += 1;
      emit(g, 'r2', { text: 'Luke: “I’m hit, but not bad. R2, see what you can do with it.” Shields up.' });
    }
  }

  if (toPort < TRENCH.near + 0.5) lose(g, 'You flew past the port. Pull up, and try again.');
}
