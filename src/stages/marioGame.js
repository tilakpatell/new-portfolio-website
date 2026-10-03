// "Super Tilak Land" — a tiny Mario-style side-scroller at the Game Boy's real
// 160×144 resolution. Pure functions over a plain state object so the React
// component only has to call step() and render() each frame.

export const W = 160;
export const H = 144;
const GROUND = 128;
const SPEED = 62;
const GRAVITY = 900;
const JUMP_V = -322;
const LEVEL_LEN = 1500;

// ─── Palettes: full colour, and the original four-shade DMG green ──────────
const DMG = ['#9bbc0f', '#8bac0f', '#306230', '#0f380f'];
export const PALETTES = {
  color: {
    R: '#e52521', O: '#2840e8', S: '#ffc890', H: '#6b3a1e', Y: '#fce000', K: '#101010', W: '#fcfcfc',
    B: '#a0522d', T: '#fcc890', G: '#fc9838', D: '#7c3c00', L: '#fcfcfc', P: '#80d010', Q: '#00a800', N: '#005800',
    sky: '#5c94fc', cloud: '#fcfcfc', cloudShade: '#bcd4fc', hill: '#00a800', hillDark: '#005800', bush: '#80d010',
    ground: '#c84c0c', groundLight: '#fcbcb0', groundDark: '#000000', hud: '#fcfcfc', castle: '#c84c0c',
  },
  dmg: {
    R: DMG[3], O: DMG[2], S: DMG[1], H: DMG[3], Y: DMG[0], K: DMG[3], W: DMG[0],
    B: DMG[2], T: DMG[1], G: DMG[1], D: DMG[3], L: DMG[0], P: DMG[1], Q: DMG[2], N: DMG[3],
    sky: DMG[0], cloud: DMG[1], cloudShade: DMG[1], hill: DMG[1], hillDark: DMG[2], bush: DMG[1],
    ground: DMG[2], groundLight: DMG[1], groundDark: DMG[3], hud: DMG[3], castle: DMG[2],
  },
};

// ─── Sprites (my own pixel art) ─────────────────────────────────────────────
const fit = (rows, w) => rows.map((r) => r.padEnd(w, '.').slice(0, w));
const HEAD = [
  '....RRRRR...',
  '...RRRRRRRRR',
  '...HHHSSKS..',
  '..HSHSSSKSSS',
  '..HSHHSSSHSS',
  '..HHSSSSHHHH',
  '....SSSSSS..',
];
const PLUMBER = {
  run0: fit([...HEAD,
    '...RROORR...',
    '..RRROORRR..',
    '.RRRROOOORRR',
    '.WWROYOOYOWW',
    '.WWWOOOOOOWW',
    '.WWOOOOOOOOW',
    '...OOO..OOO.',
    '..HHH....HHH',
    '.HHHH....HHH',
  ], 12),
  run1: fit([...HEAD,
    '...RROORR...',
    '..RRROORRWW.',
    '..RRROOOOWW.',
    '..RRYOOYOO..',
    '...OOOOOOO..',
    '...OOOOOO...',
    '....OOHHH...',
    '....HHHHH...',
    '.....HHH....',
  ], 12),
  run2: fit([...HEAD,
    '...RROORR...',
    '.WWRRROORR..',
    '.WWRROOOOORR',
    '...OOYOOYOOO',
    '..OOOOOOOOOO',
    '.HHOOO..OOO.',
    '.HHH.....HHH',
    '..........HH',
    '............',
  ], 12),
  jump: fit([...HEAD.slice(0, 6), '....SSSSSSWW',
    '..RROORRRRWW',
    '.RRRROORRR..',
    'WWRRROOOORR.',
    'WW.OYOOYOO..',
    '...OOOOOOOO.',
    '..OOOOOOOOOH',
    '.HHHOO..OOHH',
    '.HHH........',
    '.HH.........',
  ], 12),
};
const WALKER = [
  fit(['...BBBB...', '..BBBBBB..', '.BKWBBWKB.', '.BKKBBKKB.', 'BBBBBBBBBB', 'BBBTTTTBBB', '..TTTTTT..', '.KKK..KK..'], 10),
  fit(['...BBBB...', '..BBBBBB..', '.BKWBBWKB.', '.BKKBBKKB.', 'BBBBBBBBBB', 'BBBTTTTBBB', '..TTTTTT..', '..KK..KKK.'], 10),
];
const COIN = [
  fit(['.DDD.', 'DGGLD', 'DGLGD', 'DGLGD', 'DGLGD', 'DGLGD', 'DGGGD', '.DDD.'], 5),
  fit(['.D.', 'DGD', 'DLD', 'DLD', 'DLD', 'DLD', 'DGD', '.D.'], 3),
];
const QBLOCK = fit(['DDDDDDDD', 'DGGGGGGD', 'DGGKKGGD', 'DGGGGKGD', 'DGGGKGGD', 'DGGGGGGD', 'DGGGKGGD', 'DDDDDDDD'], 8);
const USED = fit(['DDDDDDDD', 'DBBBBBBD', 'DBDBBDBD', 'DBBBBBBD', 'DBBBBBBD', 'DBDBBDBD', 'DBBBBBBD', 'DDDDDDDD'], 8);

// 3×5 pixel font
const FONT = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111',
  9: '111101111001110', '-': '000000111000000', x: '000101010101000', '.': '000000000000010', '!': '010010010000010',
  ':': '000010000010000', '?': '110001010000010', ' ': '000000000000000',
};

export function text(ctx, str, x, y, color, s = 1, shadow = null) {
  if (shadow) text(ctx, str, x + s, y + s, shadow, s);
  ctx.fillStyle = color;
  let cx = x;
  for (const ch of String(str)) {
    const g = FONT[ch] || FONT[ch.toUpperCase()] || FONT[' '];
    for (let i = 0; i < 15; i++) if (g[i] === '1') ctx.fillRect(cx + (i % 3) * s, y + Math.floor(i / 3) * s, s, s);
    cx += 4 * s;
  }
}

// Sprites are pre-rendered once per palette into small canvases.
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
      const k = row[x];
      if (k === '.') continue;
      g.fillStyle = colors[k];
      g.fillRect(x, y, 1, 1);
    }
  });
  cache[id] = c;
  return c;
}
const flip = (rows) => rows.map((r) => [...r].reverse().join(''));

// ─── State ──────────────────────────────────────────────────────────────────
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newGame(seed = 1989) {
  const g = { seed, world: [1, 1], score: 0, coins: 0, t: 0, mode: 'boot', modeT: 0, palette: 'color' };
  startLevel(g);
  return g;
}

function startLevel(g) {
  g.rand = rng(g.seed + g.world[0] * 31 + g.world[1] * 7);
  g.cam = 0;
  g.nextX = 120;
  g.pipes = [];
  g.gaps = [];
  g.blocks = [];
  g.coinsOnMap = [];
  g.walkers = [];
  g.fx = [];
  g.time = 300;
  g.timeAcc = 0;
  g.flagY = 44;
  g.p = { x: 30, y: GROUND - 16, vy: 0, grounded: true, blink: 0, face: 1 };
  g.want = false;
  g.levelEnd = LEVEL_LEN;
}

function generate(g) {
  const r = g.rand;
  while (g.nextX < Math.min(g.cam + W + 48, g.levelEnd - 80)) {
    const x = g.nextX;
    const roll = r();
    if (roll < 0.26) {
      g.pipes.push({ x, h: r() < 0.5 ? 16 : 24 });
      g.nextX += 16 + 56 + Math.floor(r() * 44);
    } else if (roll < 0.42) {
      const w = r() < 0.5 ? 16 : 24;
      g.gaps.push({ x, w });
      g.nextX += w + 56 + Math.floor(r() * 44);
    } else if (roll < 0.72) {
      const n = 3 + Math.floor(r() * 3);
      const q = Math.floor(r() * n);
      for (let i = 0; i < n; i++) g.blocks.push({ x: x + i * 8, y: 84, q: i === q || (n > 4 && i === n - 1), used: false, bump: 0, ai: r() < 0.85 });
      g.nextX += n * 8 + 52 + Math.floor(r() * 40);
    } else {
      for (let i = 0; i < 4; i++) g.coinsOnMap.push({ x: x + i * 11, y: 96 - Math.round(Math.sin((i / 3) * Math.PI) * 16) });
      if (r() < 0.7) g.walkers.push({ x: x + 64, alive: true });
      g.nextX += 44 + 56 + Math.floor(r() * 40);
    }
  }
  const behind = g.cam - 40;
  g.pipes = g.pipes.filter((o) => o.x + 18 > behind);
  g.gaps = g.gaps.filter((o) => o.x + o.w > behind);
  g.blocks = g.blocks.filter((o) => o.x + 8 > behind);
  g.coinsOnMap = g.coinsOnMap.filter((o) => o.x + 6 > behind && !o.taken);
  g.walkers = g.walkers.filter((o) => o.x + 10 > behind && o.alive);
  g.fx = g.fx.filter((f) => f.t < f.life);
}

const jump = (g) => {
  if (g.p.grounded) {
    g.p.vy = JUMP_V;
    g.p.grounded = false;
  }
};

export function press(g) {
  if (g.mode === 'title') {
    g.mode = 'play';
    g.modeT = 0;
  }
  g.want = true;
}

export function step(g, dt, events) {
  g.t += dt;
  g.modeT += dt;
  if (g.mode === 'boot') {
    if (g.modeT > 1.3) {
      g.mode = 'title';
      g.modeT = 0;
    }
    return;
  }
  if (g.mode === 'title') {
    if (g.modeT > 2.2) {
      g.mode = 'play';
      g.modeT = 0;
    }
    return;
  }
  const p = g.p;
  if (g.mode === 'flag') {
    p.y = Math.min(GROUND - 16, p.y + 70 * dt);
    g.flagY = Math.min(GROUND - 22, g.flagY + 70 * dt);
    if (p.y >= GROUND - 16 && g.flagY >= GROUND - 22) {
      g.mode = 'walk';
      g.modeT = 0;
    }
    return;
  }
  if (g.mode === 'walk') {
    p.x += 40 * dt;
    if (p.x > g.levelEnd + 44) {
      g.mode = 'clear';
      g.modeT = 0;
      g.score += Math.floor(g.time) * 10;
      events?.clear?.(g);
    }
    return;
  }
  if (g.mode === 'clear') {
    if (g.modeT > 1.8) {
      g.world = g.world[1] === 4 ? [g.world[0] + 1, 1] : [g.world[0], g.world[1] + 1];
      startLevel(g);
      g.mode = 'play';
      g.modeT = 0;
    }
    return;
  }

  // play
  g.timeAcc += dt;
  if (g.timeAcc > 0.4) {
    g.timeAcc -= 0.4;
    g.time = Math.max(0, g.time - 1);
  }
  p.x += SPEED * dt;
  g.cam = Math.min(g.levelEnd - 60, p.x - 30);
  generate(g);
  const front = p.x + 12;

  if (g.want) {
    jump(g);
    g.want = false;
  }
  if (p.grounded) {
    if (g.pipes.some((o) => o.x - front >= 4 && o.x - front <= 10)) jump(g);
    else if (g.gaps.some((o) => o.x - front >= -2 && o.x - front <= 2)) jump(g);
    else if (g.walkers.some((o) => o.alive && o.x - front >= 0 && o.x - front <= 30)) jump(g);
    else if (g.blocks.some((o) => o.q && !o.used && o.ai && Math.abs(o.x + 4 - (p.x + 6)) <= 1)) jump(g);
  }

  p.vy += GRAVITY * dt;
  const prevFeet = p.y + 16;
  p.y += p.vy * dt;
  p.grounded = false;
  let feet = p.y + 16;

  const landOn = (top) => {
    p.y = top - 16;
    p.vy = 0;
    p.grounded = true;
    feet = top;
  };
  for (const o of g.pipes) {
    if (p.x + 11 > o.x && p.x + 1 < o.x + 16) {
      const top = GROUND - o.h;
      if (feet >= top && (prevFeet <= top + 1 || feet - top < 7)) landOn(top);
    }
  }
  for (const b of g.blocks) {
    if (p.x + 10 > b.x && p.x + 2 < b.x + 8 && p.vy >= 0 && feet >= b.y && prevFeet <= b.y + 1) landOn(b.y);
  }
  const overGap = g.gaps.some((o) => p.x + 3 >= o.x && p.x + 9 <= o.x + o.w);
  if (!overGap && feet >= GROUND && prevFeet <= GROUND + 3) landOn(GROUND);
  if (p.y > H + 8) {
    p.y = 4;
    p.vy = 0;
    p.blink = 1.2;
  }
  if (p.blink > 0) p.blink -= dt;

  if (p.vy < 0) {
    for (const b of g.blocks) {
      if (p.x + 10 > b.x && p.x + 2 < b.x + 8 && p.y <= b.y + 8 && p.y > b.y - 2) {
        p.y = b.y + 8;
        p.vy = 40;
        b.bump = 0.18;
        if (b.q && !b.used) {
          b.used = true;
          g.coins += 1;
          g.score += 200;
          g.fx.push({ kind: 'coin', x: b.x + 1, y: b.y - 10, t: 0, life: 0.45 });
          g.fx.push({ kind: 'pts', text: '200', x: b.x - 2, y: b.y - 14, t: 0, life: 0.7 });
          events?.coin?.(g.coins);
        }
        break;
      }
    }
  }
  for (const b of g.blocks) if (b.bump > 0) b.bump -= dt;

  for (const c of g.coinsOnMap) {
    if (!c.taken && p.x + 11 > c.x && p.x + 1 < c.x + 5 && p.y < c.y + 8 && p.y + 16 > c.y) {
      c.taken = true;
      g.coins += 1;
      g.score += 200;
      events?.coin?.(g.coins);
    }
  }
  for (const w of g.walkers) {
    w.x -= 18 * dt;
    if (w.alive && p.x + 11 > w.x && p.x + 1 < w.x + 10 && p.y + 16 > GROUND - 8 && p.y < GROUND) {
      w.alive = false;
      if (p.vy > 0) {
        g.score += 100;
        p.vy = -200;
        g.fx.push({ kind: 'flat', x: w.x, y: GROUND - 4, t: 0, life: 0.4 });
        g.fx.push({ kind: 'pts', text: '100', x: w.x, y: GROUND - 20, t: 0, life: 0.7 });
      } else g.fx.push({ kind: 'puff', x: w.x, y: GROUND - 6, t: 0, life: 0.3 });
    }
  }
  for (const f of g.fx) f.t += dt;

  if (p.x + 12 >= g.levelEnd - 4) {
    g.mode = 'flag';
    g.modeT = 0;
    p.x = g.levelEnd - 10;
    p.vy = 0;
  }
  if (g.time <= 0) startLevel(g);
}

// ─── Rendering ──────────────────────────────────────────────────────────────
function cloud(ctx, pal, x, y) {
  const c = PALETTES[pal];
  ctx.fillStyle = c.cloud;
  ctx.fillRect(x + 4, y, 10, 3);
  ctx.fillRect(x + 1, y + 3, 22, 4);
  ctx.fillRect(x, y + 6, 26, 4);
  ctx.fillStyle = c.cloudShade;
  ctx.fillRect(x + 2, y + 9, 22, 1);
}
function hill(ctx, pal, x, h) {
  const c = PALETTES[pal];
  for (let s = 0; s < h; s += 2) {
    const w = Math.max(4, (h - s) * 2.2);
    ctx.fillStyle = s === h - 2 || s === h - 1 ? c.hillDark : c.hill;
    ctx.fillRect(Math.round(x - w / 2), GROUND - s - 2, Math.round(w), 2);
  }
  ctx.fillStyle = c.hillDark;
  ctx.fillRect(x - 2, GROUND - h + 6, 1, 3);
  ctx.fillRect(x + 2, GROUND - h + 6, 1, 3);
}
function bush(ctx, pal, x) {
  const c = PALETTES[pal];
  ctx.fillStyle = c.bush;
  ctx.fillRect(x + 3, GROUND - 7, 10, 3);
  ctx.fillRect(x, GROUND - 4, 16, 4);
  ctx.fillStyle = c.hill;
  ctx.fillRect(x + 1, GROUND - 1, 14, 1);
}

export function render(ctx, g, { paused, hint } = {}) {
  const pal = g.palette;
  const c = PALETTES[pal];
  ctx.fillStyle = c.sky;
  ctx.fillRect(0, 0, W, H);

  if (g.mode === 'boot') {
    const t = Math.min(1, g.modeT / 0.9);
    text(ctx, 'TILAK', 60, Math.round(-12 + t * 66), pal === 'color' ? '#fcfcfc' : c.hud, 2, pal === 'color' ? '#0f1111' : null);
    return;
  }

  const cam = Math.floor(g.cam);
  for (let i = -1; i < 4; i++) {
    const x = i * 72 - (Math.floor(cam * 0.25) % 72);
    cloud(ctx, pal, x + 12, 22 + (((i + 8) * 7) % 3) * 9);
  }
  for (let i = -1; i < 3; i++) {
    const x = i * 110 - (Math.floor(cam * 0.5) % 110);
    hill(ctx, pal, x + 40, i % 2 ? 20 : 30);
  }
  for (let i = -1; i < 4; i++) {
    const wx = Math.floor((cam + i * 64) / 64) * 64 + 24;
    if (!g.gaps.some((o) => wx + 16 > o.x && wx < o.x + o.w)) bush(ctx, pal, wx - cam);
  }

  // ground
  for (let x = -(cam % 8); x < W; x += 8) {
    const wx = cam + x;
    if (g.gaps.some((o) => wx + 4 > o.x && wx + 4 < o.x + o.w)) continue;
    for (let row = GROUND; row < H; row += 8) {
      ctx.fillStyle = c.ground;
      ctx.fillRect(x, row, 8, 8);
      ctx.fillStyle = c.groundLight;
      ctx.fillRect(x, row, 7, 1);
      ctx.fillRect(x, row, 1, 7);
      ctx.fillStyle = c.groundDark;
      ctx.fillRect(x + 7, row, 1, 8);
      ctx.fillRect(x, row + 7, 8, 1);
    }
  }

  // flag + castle
  const fx = g.levelEnd - Math.floor(g.cam);
  if (fx < W + 40) {
    ctx.fillStyle = c.Q;
    ctx.fillRect(fx, 40, 2, GROUND - 40);
    ctx.fillStyle = c.N;
    ctx.fillRect(fx - 1, 37, 4, 4);
    ctx.fillStyle = c.cloud;
    ctx.beginPath();
    ctx.moveTo(fx, g.flagY);
    ctx.lineTo(fx - 12, g.flagY + 5);
    ctx.lineTo(fx, g.flagY + 10);
    ctx.fill();
    ctx.fillStyle = c.Q;
    ctx.fillRect(fx - 6, g.flagY + 4, 3, 3);
    const cx = fx + 30;
    ctx.fillStyle = c.castle;
    ctx.fillRect(cx, GROUND - 32, 40, 32);
    ctx.fillRect(cx + 8, GROUND - 46, 24, 14);
    ctx.fillStyle = c.groundDark;
    ctx.fillRect(cx + 16, GROUND - 14, 8, 14);
    for (let i = 0; i < 5; i++) ctx.fillRect(cx + i * 9, GROUND - 35, 5, 3);
    for (let i = 0; i < 3; i++) ctx.fillRect(cx + 9 + i * 9, GROUND - 49, 5, 3);
    ctx.fillRect(cx + 17, GROUND - 40, 6, 6);
  }

  // pipes
  for (const o of g.pipes) {
    const x = Math.round(o.x - cam);
    const top = GROUND - o.h;
    ctx.fillStyle = c.groundDark;
    ctx.fillRect(x - 2, top, 20, 7);
    ctx.fillRect(x, top + 7, 16, o.h - 7);
    ctx.fillStyle = c.Q;
    ctx.fillRect(x - 1, top + 1, 18, 5);
    ctx.fillRect(x + 1, top + 7, 14, o.h - 7);
    ctx.fillStyle = c.P;
    ctx.fillRect(x + 1, top + 1, 4, 5);
    ctx.fillRect(x + 3, top + 7, 3, o.h - 7);
    ctx.fillStyle = c.N;
    ctx.fillRect(x + 13, top + 1, 3, 5);
    ctx.fillRect(x + 12, top + 7, 2, o.h - 7);
  }

  // blocks
  for (const b of g.blocks) {
    const x = Math.round(b.x - cam);
    const y = b.y - (b.bump > 0 ? Math.round(Math.sin((b.bump / 0.18) * Math.PI) * 3) : 0);
    if (b.q) {
      ctx.drawImage(sprite(b.used ? USED : QBLOCK, pal, b.used ? 'used' : 'q'), x, y);
    } else {
      ctx.fillStyle = c.ground;
      ctx.fillRect(x, y, 8, 8);
      ctx.fillStyle = c.groundDark;
      ctx.fillRect(x, y + 3, 8, 1);
      ctx.fillRect(x, y + 7, 8, 1);
      ctx.fillRect(x + 7, y, 1, 3);
      ctx.fillRect(x + 3, y + 4, 1, 3);
      ctx.fillStyle = c.groundLight;
      ctx.fillRect(x, y, 7, 1);
    }
  }

  // coins
  const spin = Math.floor(g.t * 8) % 4;
  for (const coin of g.coinsOnMap) {
    const x = Math.round(coin.x - cam);
    ctx.drawImage(sprite(COIN[spin === 2 ? 1 : 0], pal, `coin${spin === 2 ? 1 : 0}`), spin === 2 ? x + 1 : x, coin.y);
  }

  // walkers
  for (const w of g.walkers) {
    if (!w.alive) continue;
    const f = Math.floor(g.t * 6) % 2;
    ctx.drawImage(sprite(WALKER[f], pal, `walker${f}`), Math.round(w.x - cam), GROUND - 8);
  }

  // effects
  for (const f of g.fx) {
    const x = Math.round(f.x - cam);
    const k = f.t / f.life;
    if (f.kind === 'coin') ctx.drawImage(sprite(COIN[Math.floor(f.t * 16) % 2], pal, `coin${Math.floor(f.t * 16) % 2}`), x + 1, Math.round(f.y - Math.sin(k * Math.PI) * 14));
    else if (f.kind === 'pts') text(ctx, f.text, x, Math.round(f.y - k * 8), c.hud);
    else if (f.kind === 'flat') {
      ctx.fillStyle = c.B;
      ctx.fillRect(x, f.y, 10, 3);
    } else {
      ctx.fillStyle = c.hud;
      const r = Math.round(2 + k * 5);
      ctx.fillRect(x + 5 - r, f.y, 1, 1);
      ctx.fillRect(x + 5 + r, f.y, 1, 1);
      ctx.fillRect(x + 5, f.y - r, 1, 1);
    }
  }

  // player
  const p = g.p;
  if (!(p.blink > 0 && Math.floor(g.t * 12) % 2)) {
    let frame = 'run0';
    if (g.mode === 'flag') frame = 'jump';
    else if (!p.grounded) frame = 'jump';
    else if (g.mode === 'play' || g.mode === 'walk') frame = ['run0', 'run1', 'run2', 'run1'][Math.floor(g.t * 12) % 4];
    const rows = PLUMBER[frame];
    const flipFlag = g.mode === 'flag';
    ctx.drawImage(sprite(flipFlag ? flip(rows) : rows, pal, flipFlag ? `${frame}-f` : frame), Math.round(p.x - cam), Math.round(p.y));
  }

  // HUD
  const sh = pal === 'color' ? '#0f1111' : null;
  text(ctx, 'TILAK', 6, 4, c.hud, 1, sh);
  text(ctx, String(g.score).padStart(6, '0'), 6, 11, c.hud, 1, sh);
  ctx.drawImage(sprite(COIN[0], pal, 'coin0'), 46, 9);
  text(ctx, `x${String(g.coins).padStart(2, '0')}`, 53, 11, c.hud, 1, sh);
  text(ctx, 'WORLD', 84, 4, c.hud, 1, sh);
  text(ctx, `${g.world[0]}-${g.world[1]}`, 88, 11, c.hud, 1, sh);
  text(ctx, 'TIME', 128, 4, c.hud, 1, sh);
  text(ctx, String(Math.ceil(g.time)).padStart(3, '0'), 130, 11, c.hud, 1, sh);

  if (g.mode === 'title') {
    ctx.fillStyle = c.groundDark;
    ctx.fillRect(22, 34, 116, 40);
    ctx.fillStyle = c.ground;
    ctx.fillRect(24, 36, 112, 36);
    text(ctx, 'SUPER', 60, 40, c.hud, 2);
    text(ctx, 'TILAK LAND', 40, 53, c.hud, 2);
    if (Math.floor(g.t * 2) % 2 === 0) text(ctx, 'PRESS START', 58, 84, c.hud, 1, sh);
  }
  if (g.mode === 'clear') text(ctx, 'COURSE CLEAR!', 30, 56, c.hud, 2, sh);
  if (hint && g.mode === 'play' && Math.floor(g.t * 2) % 2 === 0) text(ctx, 'PRESS A TO JUMP', 50, 64, c.hud, 1, sh);
  if (paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, W, H);
    text(ctx, 'PAUSE', 60, 66, '#fcfcfc', 2);
  }
}
