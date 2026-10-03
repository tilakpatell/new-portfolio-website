// "Super Tilak Land" — a playable Mario-style platformer at 160×144.
// Tile-based levels, run and variable-height jump, stompable walkers, coin
// blocks, pits, a timer, lives, and a flagpole at the end of every course.
// In attract mode a simple pilot plays it until someone presses a button.
import { DMG, H, W, rng, text } from './font';

const T = 8;
const ROWS = 18;
const COLS = 224;
const GROUND_ROW = 16;

export const PALETTES = {
  color: {
    R: '#e52521', O: '#2840e8', S: '#ffc890', H: '#6b3a1e', Y: '#fce000', K: '#101010', W: '#fcfcfc',
    B: '#a0522d', T: '#fcc890', G: '#fc9838', D: '#7c3c00', L: '#fcfcfc', P: '#80d010', Q: '#00a800', N: '#005800',
    sky: '#5c94fc', cloud: '#fcfcfc', cloudShade: '#bcd4fc', hill: '#00a800', hillDark: '#005800', bush: '#80d010',
    ground: '#c84c0c', groundLight: '#fcbcb0', groundDark: '#000000', hud: '#fcfcfc', shadow: '#0f1111', castle: '#c84c0c',
  },
  dmg: {
    R: DMG[3], O: DMG[2], S: DMG[1], H: DMG[3], Y: DMG[0], K: DMG[3], W: DMG[0],
    B: DMG[2], T: DMG[1], G: DMG[1], D: DMG[3], L: DMG[0], P: DMG[1], Q: DMG[2], N: DMG[3],
    sky: DMG[0], cloud: DMG[1], cloudShade: DMG[1], hill: DMG[1], hillDark: DMG[2], bush: DMG[1],
    ground: DMG[2], groundLight: DMG[1], groundDark: DMG[3], hud: DMG[3], shadow: null, castle: DMG[2],
  },
};

// ─── Sprites (my own pixel art) ─────────────────────────────────────────────
const fit = (rows, w) => rows.map((r) => r.padEnd(w, '.').slice(0, w));
const HEAD = ['....RRRRR...', '...RRRRRRRRR', '...HHHSSKS..', '..HSHSSSKSSS', '..HSHHSSSHSS', '..HHSSSSHHHH', '....SSSSSS..'];
const PLUMBER = {
  stand: fit([...HEAD, '...RROORR...', '..RRROORRR..', '.RRRROOOORRR', '.WWROYOOYOWW', '.WWWOOOOOOWW', '.WWOOOOOOOOW', '...OOO..OOO.', '..HHH....HHH', '.HHHH....HHH'], 12),
  run1: fit([...HEAD, '...RROORR...', '..RRROORRWW.', '..RRROOOOWW.', '..RRYOOYOO..', '...OOOOOOO..', '...OOOOOO...', '....OOHHH...', '....HHHHH...', '.....HHH....'], 12),
  run2: fit([...HEAD, '...RROORR...', '.WWRRROORR..', '.WWRROOOOORR', '...OOYOOYOOO', '..OOOOOOOOOO', '.HHOOO..OOO.', '.HHH.....HHH', '..........HH', '............'], 12),
  jump: fit([...HEAD.slice(0, 6), '....SSSSSSWW', '..RROORRRRWW', '.RRRROORRR..', 'WWRRROOOORR.', 'WW.OYOOYOO..', '...OOOOOOOO.', '..OOOOOOOOOH', '.HHHOO..OOHH', '.HHH........', '.HH.........'], 12),
  dead: fit(['....RRRRR...', '..WRRRRRRRW.', '.WWHHSSKSSWW', '.WWSHSSSKSWW', '..HSHHSSSHS.', '..HHSSSSHHH.', '....SSSSSS..', '..RRROORRR..', '.RRRROOOORRR', '..ROYOOYOR..', '..OOOOOOOO..', '.OOOOOOOOOO.', '..OOO..OOO..', '..HHH..HHH..', '.HHHH..HHHH.', '............'], 12),
};
const WALKER = [
  fit(['...BBBB...', '..BBBBBB..', '.BKWBBWKB.', '.BKKBBKKB.', 'BBBBBBBBBB', 'BBBTTTTBBB', '..TTTTTT..', '.KKK..KK..'], 10),
  fit(['...BBBB...', '..BBBBBB..', '.BKWBBWKB.', '.BKKBBKKB.', 'BBBBBBBBBB', 'BBBTTTTBBB', '..TTTTTT..', '..KK..KKK.'], 10),
];
const FLAT = fit(['..BBBBBB..', 'BKWBBBBWKB', 'BBBBBBBBBB', '.KKK..KKK.'], 10);
const COIN = [fit(['.DDD.', 'DGGLD', 'DGLGD', 'DGLGD', 'DGLGD', 'DGLGD', 'DGGGD', '.DDD.'], 5), fit(['.D.', 'DGD', 'DLD', 'DLD', 'DLD', 'DLD', 'DGD', '.D.'], 3)];
const QBLOCK = fit(['DDDDDDDD', 'DGGGGGGD', 'DGGKKGGD', 'DGGGGKGD', 'DGGGKGGD', 'DGGGGGGD', 'DGGGKGGD', 'DDDDDDDD'], 8);
const USED = fit(['DDDDDDDD', 'DBBBBBBD', 'DBDBBDBD', 'DBBBBBBD', 'DBBBBBBD', 'DBDBBDBD', 'DBBBBBBD', 'DDDDDDDD'], 8);

const cache = {};
function sprite(rows, pal, key) {
  const id = `${pal}:${key}`;
  if (cache[id]) return cache[id];
  const c = document.createElement('canvas');
  c.width = rows[0].length;
  c.height = rows.length;
  const g = c.getContext('2d');
  const colors = PALETTES[pal];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === '.') continue;
      g.fillStyle = colors[row[x]];
      g.fillRect(x, y, 1, 1);
    }
  });
  cache[id] = c;
  return c;
}
const flipH = (rows) => rows.map((r) => [...r].reverse().join(''));

// ─── Level generation ───────────────────────────────────────────────────────
// 0 empty · 1 ground · 2 brick · 3 coin block · 4 used · 5 hard block · 6–9 pipe
const SOLID = (t) => t > 0;

function buildLevel(seed) {
  const r = rng(seed);
  const g = Array.from({ length: ROWS }, () => new Uint8Array(COLS));
  for (let c = 0; c < COLS; c++) {
    g[GROUND_ROW][c] = 1;
    g[GROUND_ROW + 1][c] = 1;
  }
  const coins = [];
  const walkers = [];
  const gap = (c, w) => {
    for (let k = 0; k < w; k++) {
      g[GROUND_ROW][c + k] = 0;
      g[GROUND_ROW + 1][c + k] = 0;
    }
  };
  let c = 18;
  const end = COLS - 34;
  while (c < end) {
    const roll = r();
    if (roll < 0.17) {
      const w = 2 + Math.floor(r() * 2);
      gap(c, w);
      c += w + 6 + Math.floor(r() * 5);
    } else if (roll < 0.37) {
      const h = 2 + Math.floor(r() * 2);
      for (let k = 0; k < h; k++) {
        const row = GROUND_ROW - 1 - k;
        const top = k === h - 1;
        g[row][c] = top ? 6 : 8;
        g[row][c + 1] = top ? 7 : 9;
      }
      if (r() < 0.6) walkers.push({ x: (c + 5) * T, y: (GROUND_ROW - 1) * T });
      c += 2 + 6 + Math.floor(r() * 5);
    } else if (roll < 0.63) {
      const n = 3 + Math.floor(r() * 3);
      const q = Math.floor(r() * n);
      for (let k = 0; k < n; k++) g[11][c + k] = k === q || (n > 4 && k === n - 2) ? 3 : 2;
      if (r() < 0.45) g[7][c + Math.floor(n / 2)] = 3;
      if (r() < 0.7) walkers.push({ x: (c + n + 1) * T, y: (GROUND_ROW - 1) * T });
      c += n + 5 + Math.floor(r() * 4);
    } else if (roll < 0.78) {
      const s = 3 + Math.floor(r() * 2);
      for (let k = 0; k < s; k++) for (let h = 0; h <= k; h++) g[GROUND_ROW - 1 - h][c + k] = 5;
      if (r() < 0.5) {
        for (let k = 0; k < s; k++) for (let h = 0; h < s - k; h++) g[GROUND_ROW - 1 - h][c + s + 2 + k] = 5;
        c += s * 2 + 2 + 6;
      } else c += s + 6;
    } else {
      for (let k = 0; k < 4; k++) coins.push({ x: (c + k) * T + 1, y: (11 - (k === 1 || k === 2 ? 1 : 0)) * T });
      walkers.push({ x: (c + 7) * T, y: (GROUND_ROW - 1) * T });
      c += 11;
    }
  }
  const flagCol = COLS - 26;
  for (let k = flagCol - 6; k < COLS; k++) {
    g[GROUND_ROW][k] = 1;
    g[GROUND_ROW + 1][k] = 1;
  }
  g[GROUND_ROW - 1][flagCol] = 5;
  return {
    g,
    coins,
    walkers: walkers.map((w) => ({ ...w, vx: -22, vy: 0, alive: true, flat: 0 })),
    flagX: flagCol * T + 3,
    castleX: (flagCol + 6) * T,
  };
}

const tileAt = (lv, px, py) => {
  const c = Math.floor(px / T);
  const r = Math.floor(py / T);
  if (c < 0 || c >= COLS) return 5;
  if (r < 0 || r >= ROWS) return 0;
  return lv.g[r][c];
};

// ─── Game state ─────────────────────────────────────────────────────────────
export function newMario({ attract = false, seed = 1989 } = {}) {
  const g = { seed, world: [1, 1], score: 0, coins: 0, lives: 3, t: 0, attract, mode: 'play', modeT: 0, palette: 'color', fx: [], bumps: {} };
  startLevel(g);
  return g;
}

function startLevel(g) {
  g.level = buildLevel(g.seed + g.world[0] * 97 + g.world[1] * 13);
  g.cam = 0;
  g.time = 300;
  g.timeAcc = 0;
  g.flagY = 40;
  g.p = { x: 28, y: (GROUND_ROW - 2) * T, w: 10, h: 15, vx: 0, vy: 0, onGround: false, face: 1, dead: false, deathT: 0, jumpT: 0 };
  g.fx = [];
  g.bumps = {};
  g.mode = 'play';
  g.modeT = 0;
}

function die(g) {
  if (g.p.dead) return;
  g.p.dead = true;
  g.p.deathT = 0;
  g.p.vy = -300;
  g.p.vx = 0;
}

function hitBlock(g, c, r, events) {
  const t = g.level.g[r][c];
  if (t !== 2 && t !== 3) return;
  g.bumps[`${c},${r}`] = 0.16;
  if (t === 3) {
    g.level.g[r][c] = 4;
    g.coins += 1;
    g.score += 200;
    g.fx.push({ kind: 'coin', x: c * T + 1, y: r * T - 8, t: 0, life: 0.45 });
    g.fx.push({ kind: 'pts', text: '200', x: c * T - 2, y: r * T - 12, t: 0, life: 0.7 });
    events?.coin?.(g.coins);
    if (g.coins % 100 === 0) g.lives += 1;
  }
  for (const w of g.level.walkers) {
    if (w.alive && !w.flat && Math.abs(w.x + 5 - (c * T + 4)) < 9 && Math.abs(w.y + 8 - r * T) < 3) {
      w.alive = false;
      g.score += 100;
      g.fx.push({ kind: 'pts', text: '100', x: w.x, y: w.y - 6, t: 0, life: 0.6 });
    }
  }
}

// AI pilot for attract mode
function pilot(g) {
  const p = g.p;
  const front = p.x + p.w + 2;
  const feet = p.y + p.h;
  const input = { right: true, b: true, a: false };
  const wall = SOLID(tileAt(g.level, front + 6, feet - 4)) || SOLID(tileAt(g.level, front + 6, feet - 12));
  const pit = !SOLID(tileAt(g.level, front + 4, GROUND_ROW * T + 2));
  const foe = g.level.walkers.some((w) => w.alive && !w.flat && w.x - front > -2 && w.x - front < 30 && Math.abs(w.y - p.y) < 12);
  if (p.onGround && (wall || pit || foe)) input.a = true;
  if (!p.onGround && p.vy < 0) input.a = true;
  return input;
}

export function stepMario(g, dt, input, events) {
  g.t += dt;
  g.modeT += dt;
  const p = g.p;
  const lv = g.level;

  if (g.mode === 'over') return g.modeT > 3 ? 'exit' : null;
  if (g.mode === 'clear') {
    if (g.modeT > 2) {
      g.world = g.world[1] === 4 ? [g.world[0] + 1, 1] : [g.world[0], g.world[1] + 1];
      startLevel(g);
    }
    return null;
  }
  if (g.mode === 'flag') {
    p.y = Math.min((GROUND_ROW - 1) * T - p.h, p.y + 80 * dt);
    g.flagY = Math.min(GROUND_ROW * T - 30, g.flagY + 80 * dt);
    if (g.modeT > 1.1) {
      g.mode = 'walk';
      g.modeT = 0;
      p.y = GROUND_ROW * T - p.h - 1;
    }
    return null;
  }
  if (g.mode === 'walk') {
    p.x += 42 * dt;
    p.face = 1;
    if (p.x > lv.castleX + 18) {
      g.mode = 'clear';
      g.modeT = 0;
      g.score += Math.ceil(g.time) * 10;
      events?.clear?.(g);
    }
    return null;
  }

  // death animation
  if (p.dead) {
    p.deathT += dt;
    if (p.deathT > 0.45) {
      p.vy += 900 * dt;
      p.y += p.vy * dt;
    }
    if (p.deathT > 2.2) {
      g.lives -= 1;
      if (g.lives <= 0 && !g.attract) {
        g.mode = 'over';
        g.modeT = 0;
      } else {
        if (g.attract) g.lives = 3;
        const keep = { world: g.world, score: g.score, coins: g.coins, lives: g.lives };
        startLevel(g);
        Object.assign(g, keep);
      }
    }
    return null;
  }

  const ctl = g.attract ? pilot(g) : input;

  // timer
  g.timeAcc += dt;
  if (g.timeAcc > 0.4) {
    g.timeAcc -= 0.4;
    g.time = Math.max(0, g.time - 1);
    if (g.time === 0) die(g);
  }

  // horizontal movement
  const run = !!ctl.b;
  const max = run ? 112 : 72;
  const acc = (run ? 480 : 380) * (p.onGround ? 1 : 0.8);
  const dir = (ctl.right ? 1 : 0) - (ctl.left ? 1 : 0);
  if (dir) {
    p.vx += dir * acc * dt;
    p.face = dir;
  } else if (p.onGround) {
    const f = 520 * dt;
    p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f;
  }
  p.vx = Math.max(-max, Math.min(max, p.vx));

  // jump (hold for higher)
  if (ctl.a && p.onGround && !p.jumpLatch) {
    p.vy = Math.abs(p.vx) > 90 ? -355 : -335;
    p.onGround = false;
    p.jumpT = 0;
    p.jumpLatch = true;
  }
  if (!ctl.a) p.jumpLatch = false;
  const holding = ctl.a && p.vy < 0 && p.jumpT < 0.28;
  p.jumpT += dt;
  p.vy = Math.min(320, p.vy + (holding ? 520 : 1000) * dt);
  if (!ctl.a && p.vy < -140) p.vy = -140;

  // move X and resolve
  p.x += p.vx * dt;
  if (p.x < g.cam) {
    p.x = g.cam;
    p.vx = Math.max(0, p.vx);
  }
  for (const yy of [p.y + 1, p.y + p.h / 2, p.y + p.h - 1]) {
    if (p.vx > 0 && SOLID(tileAt(lv, p.x + p.w, yy))) {
      p.x = Math.floor((p.x + p.w) / T) * T - p.w - 0.01;
      p.vx = 0;
    } else if (p.vx < 0 && SOLID(tileAt(lv, p.x, yy))) {
      p.x = Math.floor(p.x / T + 1) * T + 0.01;
      p.vx = 0;
    }
  }

  // move Y and resolve
  p.y += p.vy * dt;
  p.onGround = false;
  if (p.vy >= 0) {
    for (const xx of [p.x + 1, p.x + p.w - 1]) {
      if (SOLID(tileAt(lv, xx, p.y + p.h))) {
        p.y = Math.floor((p.y + p.h) / T) * T - p.h;
        p.vy = 0;
        p.onGround = true;
      }
    }
  } else {
    for (const xx of [p.x + 2, p.x + p.w - 2]) {
      if (SOLID(tileAt(lv, xx, p.y))) {
        const c = Math.floor(xx / T);
        const r = Math.floor(p.y / T);
        p.y = (r + 1) * T;
        p.vy = 40;
        hitBlock(g, c, r, events);
        break;
      }
    }
  }
  if (p.y > H + 10) die(g);

  // camera only scrolls forward
  g.cam = Math.max(g.cam, Math.min(COLS * T - W, p.x - 64));

  // walkers
  for (const w of lv.walkers) {
    if (!w.alive) continue;
    if (w.flat) {
      w.flat -= dt;
      if (w.flat <= 0) w.alive = false;
      continue;
    }
    if (w.x > g.cam + W + 24) continue; // asleep until on screen
    w.vy = Math.min(300, w.vy + 900 * dt);
    w.x += w.vx * dt;
    const ahead = w.vx < 0 ? w.x : w.x + 10;
    if (SOLID(tileAt(lv, ahead, w.y + 4))) {
      w.vx = -w.vx;
      w.x += w.vx * dt * 2;
    }
    w.y += w.vy * dt;
    if (SOLID(tileAt(lv, w.x + 2, w.y + 8)) || SOLID(tileAt(lv, w.x + 8, w.y + 8))) {
      w.y = Math.floor((w.y + 8) / T) * T - 8;
      w.vy = 0;
    }
    if (w.y > H + 8) w.alive = false;
    // player contact
    if (p.x + p.w > w.x + 1 && p.x < w.x + 9 && p.y + p.h > w.y + 1 && p.y < w.y + 8) {
      if (p.vy > 30 && p.y + p.h - w.y < 7) {
        w.flat = 0.4;
        p.vy = ctl.a ? -300 : -210;
        g.score += 100;
        g.fx.push({ kind: 'pts', text: '100', x: w.x, y: w.y - 8, t: 0, life: 0.6 });
      } else die(g);
    }
  }

  // coins
  for (const c of lv.coins) {
    if (!c.taken && p.x + p.w > c.x && p.x < c.x + 5 && p.y + p.h > c.y && p.y < c.y + 8) {
      c.taken = true;
      g.coins += 1;
      g.score += 200;
      events?.coin?.(g.coins);
      if (g.coins % 100 === 0) g.lives += 1;
    }
  }

  for (const k of Object.keys(g.bumps)) {
    g.bumps[k] -= dt;
    if (g.bumps[k] <= 0) delete g.bumps[k];
  }
  for (const f of g.fx) f.t += dt;
  g.fx = g.fx.filter((f) => f.t < f.life);

  // flagpole
  if (p.x + p.w >= lv.flagX) {
    g.mode = 'flag';
    g.modeT = 0;
    p.x = lv.flagX - p.w + 1;
    p.vx = 0;
    p.vy = 0;
    g.score += Math.max(100, Math.round((GROUND_ROW * T - p.y) * 20));
  }
  return null;
}

// ─── Rendering ──────────────────────────────────────────────────────────────
function cloud(ctx, c, x, y) {
  ctx.fillStyle = c.cloud;
  ctx.fillRect(x + 4, y, 10, 3);
  ctx.fillRect(x + 1, y + 3, 22, 4);
  ctx.fillRect(x, y + 6, 26, 4);
  ctx.fillStyle = c.cloudShade;
  ctx.fillRect(x + 2, y + 9, 22, 1);
}
function hill(ctx, c, x, h) {
  const base = GROUND_ROW * T;
  for (let s = 0; s < h; s += 2) {
    const w = Math.max(4, (h - s) * 2.2);
    ctx.fillStyle = s >= h - 2 ? c.hillDark : c.hill;
    ctx.fillRect(Math.round(x - w / 2), base - s - 2, Math.round(w), 2);
  }
}

function drawTile(ctx, c, pal, t, x, y) {
  if (t === 1 || t === 2 || t === 5) {
    ctx.fillStyle = c.ground;
    ctx.fillRect(x, y, 8, 8);
    ctx.fillStyle = c.groundLight;
    ctx.fillRect(x, y, 7, 1);
    if (t !== 2) ctx.fillRect(x, y, 1, 7);
    ctx.fillStyle = c.groundDark;
    if (t === 2) {
      ctx.fillRect(x, y + 3, 8, 1);
      ctx.fillRect(x, y + 7, 8, 1);
      ctx.fillRect(x + 7, y, 1, 3);
      ctx.fillRect(x + 3, y + 4, 1, 3);
    } else {
      ctx.fillRect(x + 7, y, 1, 8);
      ctx.fillRect(x, y + 7, 8, 1);
      if (t === 5) ctx.fillRect(x + 2, y + 2, 3, 3);
    }
  } else if (t === 3) ctx.drawImage(sprite(QBLOCK, pal, 'q'), x, y);
  else if (t === 4) ctx.drawImage(sprite(USED, pal, 'used'), x, y);
  else if (t >= 6) {
    const top = t === 6 || t === 7;
    const left = t === 6 || t === 8;
    ctx.fillStyle = c.groundDark;
    ctx.fillRect(x, y, 8, 8);
    ctx.fillStyle = c.Q;
    if (top) ctx.fillRect(left ? x + 1 : x, y + 1, 7, 6);
    else ctx.fillRect(left ? x + 2 : x, y, left ? 6 : 6, 8);
    ctx.fillStyle = c.P;
    if (left) ctx.fillRect(x + (top ? 2 : 3), y + (top ? 1 : 0), 2, top ? 6 : 8);
    ctx.fillStyle = c.N;
    if (!left) ctx.fillRect(x + (top ? 4 : 3), y + (top ? 1 : 0), 2, top ? 6 : 8);
  }
}

export function renderMario(ctx, g, { paused, hint } = {}) {
  const pal = g.palette;
  const c = PALETTES[pal];
  const sh = c.shadow;
  const lv = g.level;
  const cam = Math.floor(g.cam);
  ctx.fillStyle = c.sky;
  ctx.fillRect(0, 0, W, H);

  for (let i = -1; i < 4; i++) cloud(ctx, c, i * 72 - (Math.floor(cam * 0.25) % 72) + 12, 22 + (((i + 8) * 7) % 3) * 9);
  for (let i = -1; i < 3; i++) hill(ctx, c, i * 110 - (Math.floor(cam * 0.5) % 110) + 40, i % 2 ? 20 : 30);

  // tiles
  const c0 = Math.floor(cam / T);
  for (let col = c0; col <= c0 + 21 && col < COLS; col++) {
    for (let r = 0; r < ROWS; r++) {
      const t = lv.g[r][col];
      if (!t) continue;
      const bump = g.bumps[`${col},${r}`];
      const dy = bump ? -Math.round(Math.sin((bump / 0.16) * Math.PI) * 3) : 0;
      drawTile(ctx, c, pal, t, col * T - cam, r * T + dy);
    }
  }

  // flag + castle
  const fx = lv.flagX - cam;
  if (fx > -40 && fx < W + 60) {
    ctx.fillStyle = c.Q;
    ctx.fillRect(fx, 38, 2, GROUND_ROW * T - 46);
    ctx.fillStyle = c.N;
    ctx.fillRect(fx - 1, 35, 4, 4);
    ctx.fillStyle = c.cloud;
    for (let i = 0; i < 6; i++) ctx.fillRect(fx - 2 - (10 - i * 2), Math.round(g.flagY) + i, 10 - i * 2 + 1, 1);
    for (let i = 0; i < 5; i++) ctx.fillRect(fx - 2 - (10 - (5 - i) * 2), Math.round(g.flagY) + 6 + i, 10 - (5 - i) * 2 + 1, 1);
    const cx = lv.castleX - cam;
    const base = GROUND_ROW * T;
    ctx.fillStyle = c.castle;
    ctx.fillRect(cx, base - 32, 40, 32);
    ctx.fillRect(cx + 8, base - 46, 24, 14);
    ctx.fillStyle = c.groundDark;
    ctx.fillRect(cx + 16, base - 14, 8, 14);
    for (let i = 0; i < 5; i++) ctx.fillRect(cx + i * 9, base - 35, 5, 3);
    for (let i = 0; i < 3; i++) ctx.fillRect(cx + 9 + i * 9, base - 49, 5, 3);
    ctx.fillRect(cx + 17, base - 40, 6, 6);
  }

  // coins
  const spin = Math.floor(g.t * 8) % 4 === 2 ? 1 : 0;
  for (const coin of lv.coins) {
    if (coin.taken) continue;
    const x = Math.round(coin.x - cam);
    if (x > -8 && x < W) ctx.drawImage(sprite(COIN[spin], pal, `coin${spin}`), spin ? x + 1 : x, coin.y);
  }

  // walkers
  for (const w of lv.walkers) {
    if (!w.alive) continue;
    const x = Math.round(w.x - cam);
    if (x < -12 || x > W + 4) continue;
    if (w.flat) ctx.drawImage(sprite(FLAT, pal, 'flat'), x, Math.round(w.y) + 4);
    else {
      const f = Math.floor(g.t * 6) % 2;
      ctx.drawImage(sprite(WALKER[f], pal, `walker${f}`), x, Math.round(w.y));
    }
  }

  // effects
  for (const f of g.fx) {
    const x = Math.round(f.x - cam);
    const k = f.t / f.life;
    if (f.kind === 'coin') ctx.drawImage(sprite(COIN[Math.floor(f.t * 16) % 2], pal, `coin${Math.floor(f.t * 16) % 2}`), x + 1, Math.round(f.y - Math.sin(k * Math.PI) * 14));
    else if (f.kind === 'pts') text(ctx, f.text, x, Math.round(f.y - k * 8), c.hud, 1, sh);
  }

  // player
  const p = g.p;
  let frame = 'stand';
  if (p.dead) frame = 'dead';
  else if (g.mode === 'flag' || !p.onGround) frame = 'jump';
  else if (Math.abs(p.vx) > 4 || g.mode === 'walk') frame = ['stand', 'run1', 'run2', 'run1'][Math.floor(g.t * (Math.abs(p.vx) > 90 ? 16 : 11)) % 4];
  const rows = p.face < 0 && !p.dead ? flipH(PLUMBER[frame]) : PLUMBER[frame];
  ctx.drawImage(sprite(rows, pal, `${frame}${p.face < 0 && !p.dead ? '-l' : ''}`), Math.round(p.x - cam) - 1, Math.round(p.y) - 1);

  // HUD
  text(ctx, 'TILAK', 6, 4, c.hud, 1, sh);
  text(ctx, String(g.score).padStart(6, '0'), 6, 11, c.hud, 1, sh);
  ctx.drawImage(sprite(COIN[0], pal, 'coin0'), 44, 9);
  text(ctx, `x${String(g.coins % 100).padStart(2, '0')}`, 51, 11, c.hud, 1, sh);
  text(ctx, 'WORLD', 80, 4, c.hud, 1, sh);
  text(ctx, `${g.world[0]}-${g.world[1]}`, 84, 11, c.hud, 1, sh);
  text(ctx, 'TIME', 126, 4, c.hud, 1, sh);
  text(ctx, String(Math.ceil(g.time)).padStart(3, '0'), 128, 11, c.hud, 1, sh);
  if (!g.attract) text(ctx, `x${g.lives}`, 66, 4, c.hud, 1, sh);

  if (g.mode === 'clear') text(ctx, 'COURSE CLEAR!', 30, 56, c.hud, 2, sh);
  if (g.mode === 'over') text(ctx, 'GAME OVER', 44, 62, c.hud, 2, sh);
  if (g.attract && Math.floor(g.t * 2) % 2 === 0) text(ctx, 'DEMO - PRESS START', 44, 26, c.hud, 1, sh);
  if (hint && !g.attract && g.t < 6) text(ctx, '<> MOVE  A JUMP  B RUN', 36, 26, c.hud, 1, sh);
  if (paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, W, H);
    text(ctx, 'PAUSE', 60, 66, '#fcfcfc', 2);
  }
}

// Small plumber for the cartridge menu.
export function drawPlumberIcon(ctx, x, y, pal = 'color') {
  ctx.drawImage(sprite(PLUMBER.stand, pal, 'stand'), x, y);
}
