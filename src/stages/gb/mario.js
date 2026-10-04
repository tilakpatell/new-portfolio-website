// "Super Tilak Land" — a Mario-style platformer at the Game Boy's 160×144.
// Four hand-designed courses (overground, underground, sky, castle) with
// mushrooms, fire flowers, stars, stompable walkers, kickable turtle shells,
// coin blocks, pits, lava, firebars, a flagpole finish, and a fire-breathing
// king on the castle bridge before the axe.
// In attract mode a simple pilot plays until someone presses a button.
import { DMG, H, W, centerText, text } from './font';
import { COURSES, ROWS, buildCourse } from './levels';

const T = 8;
// Physics runs in fixed steps no longer than this, so a slow frame can't carry
// anything through a one-tile ledge or wall.
const STEP = 1 / 120;
const STAR_TIME = 10;
const CHAIN = [100, 200, 400, 800, 1000, 2000, 4000, 8000]; // stomps before landing; then 1-UPs
const KING_HP = 5;

// ─── Colours ────────────────────────────────────────────────────────────────
const BASE = {
  color: {
    R: '#e52521', O: '#2840e8', S: '#ffc890', H: '#6b3a1e', Y: '#fce000', K: '#101010', W: '#fcfcfc',
    B: '#a0522d', T: '#fcc890', G: '#fc9838', D: '#7c3c00', L: '#fcfcfc', P: '#80d010', Q: '#00a800', N: '#005800',
    E: '#00a800', F: '#d8f878', V: '#fcfcfc', A: '#e52521',
  },
  dmg: {
    R: DMG[3], O: DMG[2], S: DMG[1], H: DMG[3], Y: DMG[0], K: DMG[3], W: DMG[0],
    B: DMG[2], T: DMG[1], G: DMG[1], D: DMG[3], L: DMG[0], P: DMG[1], Q: DMG[2], N: DMG[3],
    E: DMG[2], F: DMG[1], V: DMG[0], A: DMG[3],
  },
};
// the plumber's other outfits: white and red with a fire flower, and the
// colours a star cycles him through
const SPRITE = {
  ...BASE,
  'color-fire': { ...BASE.color, R: '#fcfcfc', O: '#e52521' },
  'color-star': { ...BASE.color, R: '#00a800', O: '#fc9838', H: '#7c3c00' },
  'dmg-fire': { ...BASE.dmg, R: DMG[1], O: DMG[3] },
  'dmg-star': { ...BASE.dmg, R: DMG[0], O: DMG[1], H: DMG[2] },
};
const LOOKS = {
  color: {
    over: { sky: '#5c94fc', g: '#c84c0c', gl: '#fcbcb0', gd: '#000000', hills: true, clouds: true },
    sky: { sky: '#7cc4fc', g: '#c84c0c', gl: '#fcbcb0', gd: '#000000', clouds: true, puffs: true },
    under: { sky: '#000000', g: '#1c5cb8', gl: '#8cc0fc', gd: '#000000' },
    castle: { sky: '#000000', g: '#8c8c8c', gl: '#d8d8d8', gd: '#3c3c3c', lava: '#f83800', lavaHi: '#fca044' },
  },
  dmg: {
    over: { sky: DMG[0], g: DMG[2], gl: DMG[1], gd: DMG[3], hills: true, clouds: true },
    sky: { sky: DMG[0], g: DMG[2], gl: DMG[1], gd: DMG[3], clouds: true, puffs: true },
    under: { sky: DMG[3], g: DMG[1], gl: DMG[0], gd: DMG[2] },
    castle: { sky: DMG[3], g: DMG[1], gl: DMG[0], gd: DMG[2], lava: DMG[0], lavaHi: DMG[1] },
  },
};
const HUD = { color: { ink: '#fcfcfc', shadow: '#0f1111' }, dmg: { ink: DMG[3], shadow: null } };
const hudFor = (pal, look) => (pal === 'dmg' && (look === 'under' || look === 'castle') ? { ink: DMG[0], shadow: null } : HUD[pal]);

// ─── Sprites (my own pixel art) ─────────────────────────────────────────────
const fit = (rows, w) => rows.map((r) => r.padEnd(w, '.').slice(0, w));
const HEAD = ['....RRRRR...', '...RRRRRRRRR', '...HHHSSKS..', '..HSHSSSKSSS', '..HSHHSSSHSS', '..HHSSSSHHHH', '....SSSSSS..'];
const SMALL = {
  stand: fit([...HEAD, '...RROORR...', '..RRROORRR..', '.RRRROOOORRR', '.WWROYOOYOWW', '.WWWOOOOOOWW', '.WWOOOOOOOOW', '...OOO..OOO.', '..HHH....HHH', '.HHHH....HHH'], 12),
  run1: fit([...HEAD, '...RROORR...', '..RRROORRWW.', '..RRROOOOWW.', '..RRYOOYOO..', '...OOOOOOO..', '...OOOOOO...', '....OOHHH...', '....HHHHH...', '.....HHH....'], 12),
  run2: fit([...HEAD, '...RROORR...', '.WWRRROORR..', '.WWRROOOOORR', '...OOYOOYOOO', '..OOOOOOOOOO', '.HHOOO..OOO.', '.HHH.....HHH', '..........HH', '............'], 12),
  jump: fit([...HEAD.slice(0, 6), '....SSSSSSWW', '..RROORRRRWW', '.RRRROORRR..', 'WWRRROOOORR.', 'WW.OYOOYOO..', '...OOOOOOOO.', '..OOOOOOOOOH', '.HHHOO..OOHH', '.HHH........', '.HH.........'], 12),
  dead: fit(['....RRRRR...', '..WRRRRRRRW.', '.WWHHSSKSSWW', '.WWSHSSSKSWW', '..HSHHSSSHS.', '..HHSSSSHHH.', '....SSSSSS..', '..RRROORRR..', '.RRRROOOORRR', '..ROYOOYOR..', '..OOOOOOOO..', '.OOOOOOOOOO.', '..OOO..OOO..', '..HHH..HHH..', '.HHHH..HHHH.', '............'], 12),
};
// Big frames: the same plumber with a taller body.
const tall = (rows) => [...rows.slice(0, 7), ...rows.slice(7, 15).flatMap((r) => [r, r]), rows[15]];
const BIG = Object.fromEntries(Object.entries(SMALL).filter(([k]) => k !== 'dead').map(([k, v]) => [k, tall(v)]));
// throwing a fireball: the arm out front
BIG.throw = BIG.stand.map((r, i) => (i === 9 || i === 10 ? `${r.slice(0, 10)}WW` : r));
const WALKER = [
  fit(['...BBBB...', '..BBBBBB..', '.BKWBBWKB.', '.BKKBBKKB.', 'BBBBBBBBBB', 'BBBTTTTBBB', '..TTTTTT..', '.KKK..KK..'], 10),
  fit(['...BBBB...', '..BBBBBB..', '.BKWBBWKB.', '.BKKBBKKB.', 'BBBBBBBBBB', 'BBBTTTTBBB', '..TTTTTT..', '..KK..KKK.'], 10),
];
const FLAT = fit(['..BBBBBB..', 'BKWBBBBWKB', 'BBBBBBBBBB', '.KKK..KKK.'], 10);
const TURTLE = [
  fit(['.......FF.', '......FKFF', '......FFFF', '..EEEE.FF.', '.EFEEFE.F.', 'EEFEEFEEF.', 'EFEEEEFEF.', 'EEEEEEEE..', '.VVVVVVV..', '.FF...FF..', 'FF.....FF.', '..........'], 10),
  fit(['.......FF.', '......FKFF', '......FFFF', '..EEEE.FF.', '.EFEEFE.F.', 'EEFEEFEEF.', 'EFEEEEFEF.', 'EEEEEEEE..', '.VVVVVVV..', '..FF.FF...', '..FF.FF...', '..........'], 10),
];
const SHELL = fit(['...EEEE...', '..EFEEFE..', '.EEFEEFEE.', 'EFEEEEEEFE', 'EEEEEEEEEE', '.VVVVVVVV.', '..VVVVVV..'], 10);
const MUSHROOM = fit(['...AAAA...', '..AVVAAA..', '.AVVAAVVA.', 'AAAAAVVVAA', 'AVVAAAAAAA', '.VVTTTTVV.', '..TKTTKT..', '..TTTTTT..'], 10);
const FLOWER = fit(['...RRRR...', '..RYYYYR..', '.RYWWWWYR.', '..RYYYYR..', '...RRRR...', '.P..QQ..P.', '.PP.QQ.PP.', '..PPQQPP..'], 10);
const STAR = fit(['....YY....', '....YY....', '...YYYY...', 'YYYYYYYYYY', '.YYKYYKYY.', '..YYYYYY..', '..YYYYYY..', '.YYY..YYY.', '.YY....YY.'], 10);
const COIN = [fit(['.DDD.', 'DGGLD', 'DGLGD', 'DGLGD', 'DGLGD', 'DGLGD', 'DGGGD', '.DDD.'], 5), fit(['.D.', 'DGD', 'DLD', 'DLD', 'DLD', 'DLD', 'DGD', '.D.'], 3)];
const QBLOCK = fit(['DDDDDDDD', 'DGGGGGGD', 'DGGKKGGD', 'DGGGGKGD', 'DGGGKGGD', 'DGGGGGGD', 'DGGGKGGD', 'DDDDDDDD'], 8);
const USED = fit(['DDDDDDDD', 'DBBBBBBD', 'DBDBBDBD', 'DBBBBBBD', 'DBBBBBBD', 'DBDBBDBD', 'DBBBBBBD', 'DDDDDDDD'], 8);
// The king of the castle, facing left: horns, a red mane, a spiked shell.
const KING = [
  fit(['......RR.R......', '.....RRRRRR.....', '...WEEEEEERR....', '..WEEKWEEEEERW..', '.EEEEKKEEEEERWW.', 'EEEEEEEEEEWWWWE.', 'WWEEEEEEEWEEEWW.', '.EEEEEEEEEEWEEE.', '..EFFFEEEEEEEWW.', '..FFFFFFEEEEEEE.', '.YFFFFFFFEEEEWW.', '.YYFFFFFFEEEEE..', '..FFFFFFFEEEE...', '..EEE..EEEEE....', '.EEEE...EEEE....', 'YYYY....YYYY....'], 16),
  fit(['......RR.R......', '.....RRRRRR.....', '...WEEEEEERR....', '..WEEKWEEEEERW..', '.EEEEKKEEEEERWW.', 'EEEEEEEEEEWWWWE.', 'WWEEEEEEEWEEEWW.', '.EEEEEEEEEEWEEE.', '..EFFFEEEEEEEWW.', '..FFFFFFEEEEEEE.', '.YFFFFFFFEEEEWW.', '.YYFFFFFFEEEEE..', '..FFFFFFFEEEE...', '...EEE.EEEEE....', '..EEEE..EEEE....', '.YYYY..YYYY.....'], 16),
];

const cache = {};
function sprite(rows, pal, key) {
  const id = `${pal}:${key}`;
  if (cache[id]) return cache[id];
  const c = document.createElement('canvas');
  c.width = rows[0].length;
  c.height = rows.length;
  const g = c.getContext('2d');
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === '.') continue;
      g.fillStyle = SPRITE[pal][row[x]];
      g.fillRect(x, y, 1, 1);
    }
  });
  cache[id] = c;
  return c;
}
const flipH = (rows) => rows.map((r) => [...r].reverse().join(''));

// ─── Tiles ──────────────────────────────────────────────────────────────────
const SOLID = new Set(['#', 'B', '?', 'M', 'U', 'H', '[', ']', '(', ')', '=', '*']);

function tileAt(g, px, py) {
  const c = Math.floor(px / T);
  const r = Math.floor(py / T);
  if (c < 0) return '#';
  if (c >= g.cols) return '#';
  if (r < 0 || r >= ROWS) return '.';
  return g.grid[r][c];
}
const solid = (g, px, py) => SOLID.has(tileAt(g, px, py));

// ─── State ──────────────────────────────────────────────────────────────────
export function newMario({ attract = false, course = 0, best = 0 } = {}) {
  const g = { course, score: 0, coins: 0, lives: 3, t: 0, attract, palette: 'color', mode: 'card', modeT: 0, big: false, fire: false, best };
  startCourse(g, course);
  if (attract) g.mode = 'play';
  return g;
}

function startCourse(g, index) {
  const c = buildCourse(index);
  g.course = index;
  g.name = c.name;
  g.look = c.look;
  g.cols = c.cols;
  g.grid = c.grid.map((row) => [...row]);
  const s = c.spawns;
  g.coinsOnMap = s.coins.map(({ c: cc, r }) => ({ x: cc * T + 1, y: r * T, taken: false }));
  g.walkers = s.walkers.map(({ c: cc, r }) => ({ x: cc * T, y: r * T, vx: -22, vy: 0, alive: true, flat: 0 }));
  g.turtles = s.turtles.map(({ c: cc, r }) => ({ x: cc * T, y: r * T - 4, vx: -20, vy: 0, alive: true, state: 'walk', wake: 0 }));
  g.firebars = s.firebars.map(({ c: cc, r }, i) => ({ cx: cc * T + 4, cy: r * T + 4, ang: i * 1.3, speed: i % 2 ? -1.7 : 1.7 }));
  g.items = [];
  g.fireballs = [];
  g.flames = [];
  g.flamesFired = 0;
  g.star = 0;
  g.chain = 0;
  g.throwT = 0;
  g.flagX = s.flag ? s.flag.c * T + 3 : null;
  g.flagCol = s.flag ? s.flag.c : null;
  g.castleX = s.castle ? s.castle.c * T : null;
  g.axe = s.axe ? { x: s.axe.c * T, y: s.axe.r * T } : null;
  // the king stands on the bridge, his feet on its planks
  g.boss = s.boss ? { x: s.boss.c * T, y: (s.boss.r + 2) * T - 30, w: 26, h: 30, homeX: s.boss.c * T, vx: 0, vy: 0, hp: KING_HP, dead: false, hurt: 0, face: -1, fireT: 1.2, jumpT: 2.6, onGround: false, t: 0 } : null;
  g.fx = [];
  g.bumps = {};
  g.cam = 0;
  g.time = g.look === 'castle' ? 300 : 400;
  g.timeAcc = 0;
  g.flagY = 40;
  g.p = { x: 24, y: 0, w: 10, h: g.big ? 23 : 15, vx: 0, vy: 0, onGround: false, face: 1, dead: false, deathT: 0, inv: 0, jumpT: 0 };
  g.p.y = 16 * T - g.p.h;
  g.mode = 'card';
  g.modeT = 0;
}

const restart = (g) => {
  g.big = false;
  g.fire = false;
  startCourse(g, g.course);
};

const pts = (g, n, x, y) => {
  g.score += n;
  g.fx.push({ kind: 'pts', text: String(n), x, y, t: 0, life: 0.7 });
};

function oneUp(g, x, y) {
  g.lives += 1;
  g.fx.push({ kind: 'pts', text: '1UP', x, y, t: 0, life: 0.9 });
}

function die(g) {
  const p = g.p;
  if (p.dead) return;
  p.dead = true;
  p.deathT = 0;
  p.vy = -300;
  p.vx = 0;
  g.big = false;
  g.fire = false;
  g.star = 0;
}

function hurt(g) {
  const p = g.p;
  if (p.inv > 0 || p.dead || g.attract || g.star > 0) return; // the demo pilot shrugs off hits
  if (g.fire) {
    g.fire = false;
    p.inv = 1.6;
  } else if (g.big) {
    g.big = false;
    p.h = 15;
    p.y += 8;
    p.inv = 1.6;
  } else die(g);
}

function grow(g, kind) {
  const p = g.p;
  g.score += 1000;
  if (kind === 'star') {
    g.star = STAR_TIME;
    return;
  }
  if (kind === 'flower') {
    g.fire = true;
    g.fireAt = g.t;
  }
  if (g.big) return;
  g.big = true;
  p.h = 23;
  p.y -= 8;
  p.inv = Math.max(p.inv, 0.6);
}

// A stomp or a star hit: points that climb while the plumber stays in the air.
function chainPoints(g, x, y) {
  if (g.chain >= CHAIN.length) oneUp(g, x, y);
  else pts(g, CHAIN[g.chain], x, y);
  g.chain += 1;
}

function hitBlock(g, c, r, events) {
  const t = g.grid[r][c];
  if (t === '?' || t === 'M' || t === '*') {
    g.grid[r][c] = 'U';
    g.bumps[`${c},${r}`] = 0.16;
    if (t === '?') {
      g.coins += 1;
      g.fx.push({ kind: 'coin', x: c * T + 1, y: r * T - 8, t: 0, life: 0.45 });
      pts(g, 200, c * T - 2, r * T - 12);
      events?.coin?.(g.coins);
      if (g.coins % 100 === 0) oneUp(g, c * T, r * T - 16);
    } else {
      // a mushroom for a small plumber, a flower for a big one; or a star
      const kind = t === '*' ? 'star' : g.big ? 'flower' : 'mushroom';
      g.items.push({ kind, x: c * T - 1, y: r * T, vx: 0, vy: 0, rise: 0.5, alive: true });
    }
  } else if (t === 'B') {
    if (g.big) {
      g.grid[r][c] = '.';
      g.score += 50;
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 0], [1, 0]]) g.fx.push({ kind: 'debris', x: c * T + 4, y: r * T + 4, vx: dx * 40, vy: dy * 120 - 60, t: 0, life: 0.8 });
    } else g.bumps[`${c},${r}`] = 0.16;
  } else return;
  for (const w of [...g.walkers, ...g.turtles]) {
    if (w.alive && Math.abs(w.x + 5 - (c * T + 4)) < 9 && Math.abs(w.y + (w.state ? 12 : 8) - r * T) < 3) {
      w.alive = false;
      g.score += 100;
    }
  }
}

// Simple pilot for the demo: run right, jump at walls, ledges and enemies.
function pilot(g) {
  const p = g.p;
  const front = p.x + p.w + 2;
  const feet = p.y + p.h;
  const ctl = { right: true, b: true, a: false };
  const wall = solid(g, front + 6, feet - 4) || solid(g, front + 6, feet - 12);
  const ledge = !solid(g, front + 2, feet + 3) || tileAt(g, front + 6, feet + 3) === 'L';
  const foe = [...g.walkers, ...g.turtles].some((w) => w.alive && !w.flat && w.state !== 'shell' && w.x - front > -2 && w.x - front < 30 && Math.abs(w.y - p.y) < 14);
  if (p.onGround && (wall || ledge || foe)) ctl.a = true;
  if (!p.onGround && p.vy < 0) ctl.a = true;
  return ctl;
}

// Move a body with tile collisions. Returns { wall, ground }.
function moveBody(g, b, w, h, dt) {
  let wall = false;
  b.x += b.vx * dt;
  for (const yy of [b.y + 1, b.y + h / 2, b.y + h - 1]) {
    if (b.vx > 0 && solid(g, b.x + w, yy)) {
      b.x = Math.floor((b.x + w) / T) * T - w - 0.01;
      wall = true;
    } else if (b.vx < 0 && solid(g, b.x, yy)) {
      b.x = Math.floor(b.x / T + 1) * T + 0.01;
      wall = true;
    }
  }
  b.vy = Math.min(320, b.vy + 950 * dt);
  b.y += b.vy * dt;
  let ground = false;
  if (b.vy >= 0 && (solid(g, b.x + 1, b.y + h) || solid(g, b.x + w - 1, b.y + h))) {
    b.y = Math.floor((b.y + h) / T) * T - h;
    b.vy = 0;
    ground = true;
  }
  return { wall, ground };
}

const overlap = (a, aw, ah, b, bw, bh) => a.x < b.x + bw && a.x + aw > b.x && a.y < b.y + bh && a.y + ah > b.y;

export function stepMario(g, dt, input, events) {
  // fixed small steps; a button press counts once, on the first of them
  let left = dt;
  let first = true;
  let r = null;
  do {
    const h = Math.min(left, STEP);
    r = stepOnce(g, h, input, events, first);
    first = false;
    left -= h;
  } while (left > 1e-9 && r == null);
  return r;
}

function finishGame(g, mode) {
  g.mode = mode;
  g.modeT = 0;
  g.best = Math.max(g.best || 0, g.score);
}

function kingDown(g) {
  const b = g.boss;
  if (!b || b.dead) return;
  b.dead = true;
  b.vy = -160;
  pts(g, 5000, b.x, b.y - 8);
  g.flames = [];
}

function stepKing(g, dt, awake) {
  const b = g.boss;
  if (!b) return;
  if (b.hurt > 0) b.hurt -= dt;
  if (b.dead) {
    b.vy = Math.min(320, b.vy + 900 * dt);
    b.y += b.vy * dt;
    return;
  }
  if (!awake(b.x)) return;
  const p = g.p;
  b.t += dt;
  b.face = p.x + p.w / 2 < b.x + b.w / 2 ? -1 : 1;
  // pace back and forth near home, hop now and then, breathe fire on a beat
  const goal = b.homeX + Math.sin(b.t * 0.9) * 22;
  b.vx = Math.max(-28, Math.min(28, (goal - b.x) * 2));
  b.jumpT -= dt;
  if (b.jumpT <= 0 && b.onGround) {
    b.vy = -230;
    b.jumpT = 3.1;
  }
  const { ground } = moveBody(g, b, b.w, b.h, dt);
  b.onGround = ground;
  b.fireT -= dt;
  if (b.fireT <= 0) {
    b.fireT = 2.3;
    g.flamesFired += 1;
    g.flames.push({ x: b.face < 0 ? b.x - 8 : b.x + b.w, y: b.y + 10, vx: b.face * 78, ty: Math.max(40, p.y + p.h - 12), life: 4 });
  }
  if (b.y > H) b.dead = true;
  if (!p.dead && overlap(p, p.w, p.h, b, b.w, b.h)) hurt(g);
}

function stepOnce(g, dt, input, events, first) {
  g.t += dt;
  g.modeT += dt;
  const p = g.p;

  switch (g.mode) {
    case 'card':
      if (g.modeT > 2.2) {
        g.mode = 'play';
        g.modeT = 0;
      }
      return null;
    case 'over':
      return g.modeT > 3.5 ? 'exit' : null;
    case 'win':
      return g.modeT > 6 ? 'exit' : null;
    case 'clear':
      if (g.modeT > 2.2) {
        if (g.course + 1 >= COURSES.length) {
          finishGame(g, 'win');
          events?.win?.(g);
        } else startCourse(g, g.course + 1);
      }
      return null;
    case 'flag':
      p.y = Math.min(16 * T - p.h - T, p.y + 80 * dt);
      g.flagY = Math.min(16 * T - 30, g.flagY + 80 * dt);
      if (g.modeT > 1.1) {
        // hop down on the far side of the pole's base, then walk in
        g.mode = 'walk';
        g.modeT = 0;
        p.x = (g.flagCol + 1) * T + 1;
        p.y = 16 * T - p.h;
        p.face = 1;
      }
      return null;
    case 'walk':
      p.x += 42 * dt;
      p.face = 1;
      if (p.x > g.castleX + 18) {
        g.mode = 'clear';
        g.modeT = 0;
        g.score += Math.ceil(g.time) * 10;
      }
      return null;
    case 'bridge': {
      // the bridge falls away beneath the lava's rising heat, right to left
      const k = Math.floor(g.modeT / 0.05);
      let removed = 0;
      for (let c = g.cols - 1; c >= 0 && removed <= k; c--) {
        if (g.grid[13][c] === '=' || g.grid[13][c] === '_') {
          if (removed === k) g.grid[13][c] = '_';
          removed++;
        }
      }
      stepKing(g, dt, () => true);
      if (g.modeT > 1.6) {
        g.mode = 'clear';
        g.modeT = 0;
        g.score += Math.ceil(g.time) * 10;
      }
      return null;
    }
    default:
  }

  if (p.dead) {
    p.deathT += dt;
    if (p.deathT > 0.45) {
      p.vy += 900 * dt;
      p.y += p.vy * dt;
    }
    if (p.deathT > 2.4) {
      if (g.attract) {
        restart(g);
        g.mode = 'play';
        return null;
      }
      g.lives -= 1;
      if (g.lives <= 0) finishGame(g, 'over');
      else restart(g);
    }
    return null;
  }

  const ctl = g.attract ? pilot(g) : input;
  if (p.inv > 0) p.inv -= dt;
  if (g.star > 0) g.star = Math.max(0, g.star - dt);
  if (g.throwT > 0) g.throwT -= dt;

  g.timeAcc += dt;
  if (g.timeAcc > 0.4) {
    g.timeAcc -= 0.4;
    g.time = Math.max(0, g.time - 1);
    if (g.time === 0) die(g);
  }

  // run / walk
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

  // B throws a fireball while the flower's power lasts (two in the air at most)
  if (first && g.fire && !g.attract && input.pressed?.has('b') && g.fireballs.length < 2) {
    g.fireballs.push({ x: p.face > 0 ? p.x + p.w : p.x - 4, y: p.y + 8, vx: p.face * 165, vy: 40, life: 2.5 });
    g.throwT = 0.15;
  }

  // jump — hold for height
  if (ctl.a && p.onGround && !p.jumpLatch) {
    p.vy = Math.abs(p.vx) > 90 ? -255 : -240;
    p.onGround = false;
    p.jumpT = 0;
    p.jumpLatch = true;
  }
  if (!ctl.a) p.jumpLatch = false;
  // holding A keeps the jump going a little longer: ~5 tiles held, ~1.5 tapped
  const holding = ctl.a && p.vy < 0 && p.jumpT < 0.2;
  p.jumpT += dt;
  p.vy = Math.min(300, p.vy + (holding ? 600 : 1100) * dt);
  if (!ctl.a && p.vy < -170) p.vy = -170;

  // X
  p.x += p.vx * dt;
  if (p.x < g.cam) {
    p.x = g.cam;
    p.vx = Math.max(0, p.vx);
  }
  const ys = g.big ? [p.y + 1, p.y + 8, p.y + 16, p.y + p.h - 1] : [p.y + 1, p.y + p.h / 2, p.y + p.h - 1];
  for (const yy of ys) {
    if (p.vx >= 0 && solid(g, p.x + p.w, yy)) {
      p.x = Math.floor((p.x + p.w) / T) * T - p.w - 0.01;
      p.vx = Math.min(0, p.vx);
    } else if (p.vx <= 0 && solid(g, p.x, yy)) {
      p.x = Math.floor(p.x / T + 1) * T + 0.01;
      p.vx = Math.max(0, p.vx);
    }
  }

  // Y
  p.y += p.vy * dt;
  p.onGround = false;
  if (p.vy >= 0) {
    for (const xx of [p.x + 1, p.x + p.w - 1]) {
      if (solid(g, xx, p.y + p.h)) {
        p.y = Math.floor((p.y + p.h) / T) * T - p.h;
        p.vy = 0;
        p.onGround = true;
      }
    }
  } else {
    for (const xx of [p.x + p.w / 2, p.x + 2, p.x + p.w - 2]) {
      if (solid(g, xx, p.y)) {
        const c = Math.floor(xx / T);
        const r = Math.floor(p.y / T);
        p.y = (r + 1) * T;
        p.vy = 40;
        hitBlock(g, c, r, events);
        break;
      }
    }
  }
  if (p.onGround) g.chain = 0;
  if (tileAt(g, p.x + p.w / 2, p.y + p.h - 1) === 'L' || p.y > H + 10) die(g);

  g.cam = Math.max(g.cam, Math.min(g.cols * T - W, p.x - 64));
  const awake = (x) => x < g.cam + W + 24 && x > g.cam - 40;

  // mushrooms, flowers and stars
  for (const m of g.items) {
    if (!m.alive) continue;
    if (m.rise > 0) {
      m.rise -= dt;
      m.y -= 16 * dt;
      if (m.rise <= 0) {
        if (m.kind === 'mushroom') m.vx = 40;
        if (m.kind === 'star') {
          m.vx = 60;
          m.vy = -200;
        }
      }
    } else if (m.kind !== 'flower') {
      const { wall, ground } = moveBody(g, m, 10, 8, dt);
      if (wall) m.vx = -m.vx;
      if (ground && m.kind === 'star') m.vy = -230;
      if (m.y > H) m.alive = false;
    }
    if (m.alive && overlap(p, p.w, p.h, m, 10, 8)) {
      m.alive = false;
      grow(g, m.kind);
      g.fx.push({ kind: 'pts', text: '1000', x: m.x - 2, y: m.y - 8, t: 0, life: 0.8 });
    }
  }
  g.items = g.items.filter((m) => m.alive);

  // walkers
  for (const w of g.walkers) {
    if (!w.alive) continue;
    if (w.flat) {
      w.flat -= dt;
      if (w.flat <= 0) w.alive = false;
      continue;
    }
    if (!awake(w.x)) continue;
    const { wall } = moveBody(g, w, 10, 8, dt);
    if (wall) w.vx = -w.vx;
    if (w.y > H || tileAt(g, w.x + 5, w.y + 7) === 'L') w.alive = false;
    if (overlap(p, p.w, p.h, w, 10, 8)) {
      if (p.vy > 30 && p.y + p.h - w.y < 7) {
        w.flat = 0.4;
        p.vy = ctl.a ? -250 : -180;
        chainPoints(g, w.x, w.y - 8);
      } else if (g.star > 0) {
        w.alive = false;
        chainPoints(g, w.x, w.y - 8);
      } else if (g.attract) w.flat = 0.4;
      else hurt(g);
    }
  }

  // turtles and shells
  for (const k of g.turtles) {
    if (!k.alive || !awake(k.x)) continue;
    const h = k.state === 'walk' ? 12 : 7;
    const oy = k.state === 'walk' ? 0 : 5;
    const box = { x: k.x, y: k.y + oy };
    if (k.state === 'shell') {
      k.wake += dt;
      if (k.wake > 6) {
        k.state = 'walk';
        k.vx = -20;
      }
    }
    const body = { x: k.x, y: k.y + oy, vx: k.state === 'shell' ? 0 : k.vx, vy: k.vy };
    const { wall } = moveBody(g, body, 10, h, dt);
    k.x = body.x;
    k.y = body.y - oy;
    k.vy = body.vy;
    if (wall) k.vx = -k.vx;
    if (k.y > H || tileAt(g, k.x + 5, k.y + 11) === 'L') k.alive = false;
    if (k.state === 'spin') {
      for (const o of [...g.walkers, ...g.turtles]) {
        if (o !== k && o.alive && !o.flat && Math.abs(o.x - k.x) < 9 && Math.abs(o.y + (o.state ? 6 : 4) - (k.y + 9)) < 9) {
          o.alive = false;
          pts(g, 200, o.x, o.y - 6);
        }
      }
    }
    if (overlap(p, p.w, p.h, box, 10, h)) {
      const stomp = p.vy > 30 && p.y + p.h - box.y < 7;
      if (stomp) {
        p.vy = ctl.a ? -250 : -180;
        chainPoints(g, k.x, k.y - 6);
        if (k.state === 'walk' || k.state === 'spin') {
          k.state = 'shell';
          k.wake = 0;
          k.vx = 0;
        } else {
          k.state = 'spin';
          k.vx = p.x + p.w / 2 < k.x + 5 ? 150 : -150;
        }
      } else if (g.star > 0) {
        k.alive = false;
        chainPoints(g, k.x, k.y - 6);
      } else if (k.state === 'shell') {
        k.state = 'spin';
        k.vx = p.x + p.w / 2 < k.x + 5 ? 150 : -150;
        k.x += Math.sign(k.vx) * 4;
        p.inv = Math.max(p.inv, 0.25);
      } else if (g.attract) k.alive = false;
      else hurt(g);
    }
  }

  // fireballs: bounce along the ground, burn whatever they touch
  for (const f of g.fireballs) {
    f.life -= dt;
    f.vy = Math.min(320, f.vy + 900 * dt);
    f.x += f.vx * dt;
    if (solid(g, f.x + (f.vx > 0 ? 4 : 0), f.y + 2)) f.life = 0;
    f.y += f.vy * dt;
    // a low bounce, so it skims along at the height of whatever walks there
    if (f.vy > 0 && solid(g, f.x + 2, f.y + 4)) {
      f.y = Math.floor((f.y + 4) / T) * T - 4;
      f.vy = -110;
    }
    if (f.x < g.cam - 8 || f.x > g.cam + W + 8 || f.y > H) f.life = 0;
    if (f.life <= 0) continue;
    const ball = { x: f.x, y: f.y };
    for (const o of [...g.walkers, ...g.turtles]) {
      if (!o.alive || o.flat) continue;
      const oh = o.state && o.state !== 'walk' ? 7 : o.state ? 12 : 8;
      const oy = o.state && o.state !== 'walk' ? 5 : 0;
      if (overlap(ball, 4, 4, { x: o.x, y: o.y + oy }, 10, oh)) {
        o.alive = false;
        pts(g, 200, o.x, o.y - 6);
        f.life = 0;
        break;
      }
    }
    const b = g.boss;
    if (f.life > 0 && b && !b.dead && overlap(ball, 4, 4, b, b.w, b.h)) {
      f.life = 0;
      b.hp -= 1;
      b.hurt = 0.3;
      if (b.hp <= 0) kingDown(g);
    }
    if (f.life <= 0) g.fx.push({ kind: 'puff', x: f.x, y: f.y, t: 0, life: 0.2 });
  }
  g.fireballs = g.fireballs.filter((f) => f.life > 0);

  // the king and his fire
  stepKing(g, dt, awake);
  for (const fl of g.flames) {
    fl.life -= dt;
    fl.x += fl.vx * dt;
    fl.y += Math.sign(fl.ty - fl.y) * Math.min(Math.abs(fl.ty - fl.y), 18 * dt);
    if (fl.x < g.cam - 16 || fl.x > g.cam + W + 16) fl.life = 0;
    if (fl.life > 0 && overlap(p, p.w, p.h, { x: fl.x, y: fl.y }, 8, 3)) hurt(g);
  }
  g.flames = g.flames.filter((fl) => fl.life > 0);

  // firebars
  for (const f of g.firebars) {
    f.ang += f.speed * dt;
    for (let i = 0; i < 5; i++) {
      const bx = f.cx + Math.cos(f.ang) * i * 6;
      const by = f.cy + Math.sin(f.ang) * i * 6;
      if (bx > p.x - 2 && bx < p.x + p.w + 2 && by > p.y - 2 && by < p.y + p.h + 2) hurt(g);
    }
  }

  // coins
  for (const c of g.coinsOnMap) {
    if (!c.taken && overlap(p, p.w, p.h, c, 5, 8)) {
      c.taken = true;
      g.coins += 1;
      g.score += 200;
      events?.coin?.(g.coins);
      if (g.coins % 100 === 0) oneUp(g, c.x, c.y - 8);
    }
  }

  for (const k of Object.keys(g.bumps)) {
    g.bumps[k] -= dt;
    if (g.bumps[k] <= 0) delete g.bumps[k];
  }
  for (const f of g.fx) {
    f.t += dt;
    if (f.kind === 'debris') {
      f.vy += 600 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
    }
  }
  g.fx = g.fx.filter((f) => f.t < f.life);

  // finishes
  if (g.flagX != null && p.x + p.w >= g.flagX) {
    g.mode = 'flag';
    g.modeT = 0;
    p.x = g.flagX - p.w + 1;
    p.vx = 0;
    p.vy = 0;
    g.score += Math.max(100, Math.round((16 * T - p.y) * 20));
  }
  if (g.axe && overlap(p, p.w, p.h, g.axe, 8, 8)) {
    g.mode = 'bridge';
    g.modeT = 0;
    g.axe = null;
    p.vx = 0;
    g.flames = [];
    // the king goes down with the bridge
    kingDown(g);
  }
  return null;
}

// ─── Rendering ──────────────────────────────────────────────────────────────
function cloud(ctx, x, y, color, shade) {
  ctx.fillStyle = color;
  ctx.fillRect(x + 4, y, 10, 3);
  ctx.fillRect(x + 1, y + 3, 22, 4);
  ctx.fillRect(x, y + 6, 26, 4);
  ctx.fillStyle = shade;
  ctx.fillRect(x + 2, y + 9, 22, 1);
}

function drawTile(ctx, g, L, t, x, y) {
  const pal = g.palette;
  switch (t) {
    case '#':
    case 'H':
      ctx.fillStyle = L.g;
      ctx.fillRect(x, y, 8, 8);
      ctx.fillStyle = L.gl;
      ctx.fillRect(x, y, 7, 1);
      ctx.fillRect(x, y, 1, 7);
      ctx.fillStyle = L.gd;
      ctx.fillRect(x + 7, y, 1, 8);
      ctx.fillRect(x, y + 7, 8, 1);
      if (t === 'H') ctx.fillRect(x + 2, y + 2, 4, 4);
      return;
    case 'B':
    case '*': // a star hides in what looks like any other brick
      ctx.fillStyle = L.g;
      ctx.fillRect(x, y, 8, 8);
      ctx.fillStyle = L.gd;
      ctx.fillRect(x, y + 3, 8, 1);
      ctx.fillRect(x, y + 7, 8, 1);
      ctx.fillRect(x + 7, y, 1, 3);
      ctx.fillRect(x + 3, y + 4, 1, 3);
      ctx.fillStyle = L.gl;
      ctx.fillRect(x, y, 7, 1);
      return;
    case '?':
    case 'M':
      ctx.drawImage(sprite(QBLOCK, pal, 'q'), x, y);
      return;
    case 'U':
      ctx.drawImage(sprite(USED, pal, 'used'), x, y);
      return;
    case '=':
      ctx.fillStyle = pal === 'color' ? '#c84c0c' : DMG[1];
      ctx.fillRect(x, y, 8, 5);
      ctx.fillStyle = pal === 'color' ? '#fca044' : DMG[0];
      ctx.fillRect(x, y, 8, 1);
      ctx.fillRect(x + 3, y + 2, 2, 1);
      return;
    case 'L': {
      const top = Math.round(Math.sin(g.t * 3 + x * 0.3) * 1.5);
      ctx.fillStyle = L.lava;
      ctx.fillRect(x, y + 2 + top, 8, 8);
      ctx.fillStyle = L.lavaHi;
      ctx.fillRect(x, y + 2 + top, 8, 1);
      return;
    }
    case '[':
    case ']':
    case '(':
    case ')': {
      const top = t === '[' || t === ']';
      const left = t === '[' || t === '(';
      const S = SPRITE[pal];
      ctx.fillStyle = pal === 'color' ? '#000000' : DMG[3];
      ctx.fillRect(x, y, 8, 8);
      ctx.fillStyle = S.Q;
      if (top) ctx.fillRect(left ? x + 1 : x, y + 1, 7, 6);
      else ctx.fillRect(left ? x + 2 : x, y, 6, 8);
      ctx.fillStyle = S.P;
      if (left) ctx.fillRect(x + (top ? 2 : 3), y + (top ? 1 : 0), 2, top ? 6 : 8);
      ctx.fillStyle = S.N;
      if (!left) ctx.fillRect(x + (top ? 4 : 3), y + (top ? 1 : 0), 2, top ? 6 : 8);
      return;
    }
    default:
  }
}

function drawCastle(ctx, L, cx, base) {
  ctx.fillStyle = L.g;
  ctx.fillRect(cx, base - 32, 40, 32);
  ctx.fillRect(cx + 8, base - 46, 24, 14);
  ctx.fillStyle = L.gd;
  ctx.fillRect(cx + 16, base - 14, 8, 14);
  for (let i = 0; i < 5; i++) ctx.fillRect(cx + i * 9, base - 35, 5, 3);
  for (let i = 0; i < 3; i++) ctx.fillRect(cx + 9 + i * 9, base - 49, 5, 3);
  ctx.fillRect(cx + 17, base - 40, 6, 6);
}

// Which outfit the plumber wears this frame.
function outfit(g) {
  const pal = g.palette;
  if (g.star > 0 && !(g.star < 2 && Math.floor(g.t * 8) % 2)) return [pal, `${pal}-fire`, `${pal}-star`][Math.floor(g.t * 14) % 3];
  return g.fire ? `${pal}-fire` : pal;
}

export function renderMario(ctx, g, { paused, hint } = {}) {
  const pal = g.palette;
  const L = LOOKS[pal][g.look];
  const hud = hudFor(pal, g.look);
  const cam = Math.floor(g.cam);
  ctx.imageSmoothingEnabled = false; // the king is scaled up; keep his pixels square

  if (g.mode === 'card' && !g.attract) {
    ctx.fillStyle = pal === 'color' ? '#000000' : DMG[3];
    ctx.fillRect(0, 0, W, H);
    const ink = pal === 'color' ? '#fcfcfc' : DMG[0];
    centerText(ctx, `WORLD ${g.name}`, 52, ink, 2);
    ctx.drawImage(sprite(SMALL.stand, pal, 'stand'), 62, 74);
    text(ctx, `x ${g.lives}`, 80, 80, ink);
    centerText(ctx, ['OVERGROUND', 'UNDERGROUND', 'SKY', 'CASTLE'][g.course], 104, pal === 'color' ? '#8fa0bf' : DMG[1]);
    if (g.best) centerText(ctx, `TOP ${String(g.best).padStart(6, '0')}`, 120, pal === 'color' ? '#8fa0bf' : DMG[1]);
    return;
  }
  if (g.mode === 'win') {
    ctx.fillStyle = pal === 'color' ? '#000000' : DMG[3];
    ctx.fillRect(0, 0, W, H);
    const ink = pal === 'color' ? '#fcfcfc' : DMG[0];
    centerText(ctx, 'YOU WIN!', 34, pal === 'color' ? '#fc9838' : DMG[0], 2);
    centerText(ctx, 'THANKS FOR PLAYING', 58, ink);
    centerText(ctx, `SCORE ${String(g.score).padStart(6, '0')}`, 72, ink);
    centerText(ctx, `TOP   ${String(g.best).padStart(6, '0')}`, 81, ink);
    centerText(ctx, `COINS ${g.coins}`, 90, ink);
    ctx.drawImage(sprite(BIG.stand, outfit(g), 'big-stand'), 74, 104);
    return;
  }

  ctx.fillStyle = L.sky;
  ctx.fillRect(0, 0, W, H);
  if (L.clouds) {
    const cc = pal === 'color' ? '#fcfcfc' : DMG[1];
    const cs = pal === 'color' ? '#bcd4fc' : DMG[1];
    for (let i = -1; i < 4; i++) cloud(ctx, i * 72 - (Math.floor(cam * 0.25) % 72) + 12, 24 + (((i + 8) * 7) % 3) * 10, cc, cs);
    if (L.puffs) for (let i = -1; i < 5; i++) cloud(ctx, i * 48 - (Math.floor(cam * 0.5) % 48), 128, cc, cs);
  }
  if (L.hills) {
    const hc = pal === 'color' ? '#00a800' : DMG[1];
    for (let i = -1; i < 3; i++) {
      const hx = i * 110 - (Math.floor(cam * 0.5) % 110) + 40;
      const hh = i % 2 ? 20 : 30;
      ctx.fillStyle = hc;
      for (let s = 0; s < hh; s += 2) {
        const w = Math.max(4, (hh - s) * 2.2);
        ctx.fillRect(Math.round(hx - w / 2), 16 * T - s - 2, Math.round(w), 2);
      }
    }
  }

  // tiles
  const c0 = Math.floor(cam / T);
  for (let col = c0; col <= c0 + 21 && col < g.cols; col++) {
    for (let r = 0; r < ROWS; r++) {
      const t = g.grid[r][col];
      if (t === '.' || t === '_') continue;
      const bump = g.bumps[`${col},${r}`];
      const dy = bump ? -Math.round(Math.sin((bump / 0.16) * Math.PI) * 3) : 0;
      drawTile(ctx, g, L, t, col * T - cam, r * T + dy);
    }
  }

  // flag, castle, axe
  if (g.flagX != null) {
    const fx = g.flagX - cam;
    if (fx > -40 && fx < W + 60) {
      ctx.fillStyle = pal === 'color' ? '#00a800' : DMG[2];
      ctx.fillRect(fx, 38, 2, 15 * T - 38);
      ctx.fillStyle = pal === 'color' ? '#005800' : DMG[3];
      ctx.fillRect(fx - 1, 35, 4, 4);
      ctx.fillStyle = pal === 'color' ? '#fcfcfc' : DMG[1];
      for (let i = 0; i < 6; i++) ctx.fillRect(fx - 2 - (10 - i * 2), Math.round(g.flagY) + i, 10 - i * 2 + 1, 1);
      for (let i = 0; i < 5; i++) ctx.fillRect(fx - 2 - (10 - (5 - i) * 2), Math.round(g.flagY) + 6 + i, 10 - (5 - i) * 2 + 1, 1);
    }
  }
  if (g.castleX != null) {
    const cx = g.castleX - cam;
    if (cx > -50 && cx < W + 10) drawCastle(ctx, L, cx, 16 * T);
  }
  if (g.axe) {
    const ax = g.axe.x - cam;
    ctx.fillStyle = pal === 'color' ? '#6b3a1e' : DMG[1];
    ctx.fillRect(ax + 3, g.axe.y, 2, 8);
    ctx.fillStyle = pal === 'color' ? '#d8d8d8' : DMG[0];
    ctx.fillRect(ax, g.axe.y, 4, 5);
  }

  // coins, power-ups
  const spin = Math.floor(g.t * 8) % 4 === 2 ? 1 : 0;
  for (const coin of g.coinsOnMap) {
    if (coin.taken) continue;
    const x = Math.round(coin.x - cam);
    if (x > -8 && x < W) ctx.drawImage(sprite(COIN[spin], pal, `coin${spin}`), spin ? x + 1 : x, coin.y);
  }
  for (const m of g.items) {
    const x = Math.round(m.x - cam);
    const y = Math.round(m.y);
    if (m.kind === 'mushroom') ctx.drawImage(sprite(MUSHROOM, pal, 'mush'), x, y);
    else if (m.kind === 'flower') ctx.drawImage(sprite(FLOWER, Math.floor(g.t * 8) % 2 ? `${pal}-fire` : pal, 'flower'), x, y);
    else ctx.drawImage(sprite(STAR, pal, 'star'), x, y - 1);
  }

  // enemies
  for (const w of g.walkers) {
    if (!w.alive) continue;
    const x = Math.round(w.x - cam);
    if (x < -12 || x > W + 4) continue;
    if (w.flat) ctx.drawImage(sprite(FLAT, pal, 'flat'), x, Math.round(w.y) + 4);
    else ctx.drawImage(sprite(WALKER[Math.floor(g.t * 6) % 2], pal, `walker${Math.floor(g.t * 6) % 2}`), x, Math.round(w.y));
  }
  for (const k of g.turtles) {
    if (!k.alive) continue;
    const x = Math.round(k.x - cam);
    if (x < -12 || x > W + 4) continue;
    if (k.state === 'walk') {
      const f = Math.floor(g.t * 6) % 2;
      const rows = k.vx > 0 ? flipH(TURTLE[f]) : TURTLE[f];
      ctx.drawImage(sprite(rows, pal, `turtle${f}${k.vx > 0 ? 'r' : ''}`), x, Math.round(k.y));
    } else ctx.drawImage(sprite(SHELL, pal, 'shell'), x, Math.round(k.y) + 5);
  }
  for (const f of g.firebars) {
    for (let i = 0; i < 5; i++) {
      const bx = Math.round(f.cx + Math.cos(f.ang) * i * 6 - cam);
      const by = Math.round(f.cy + Math.sin(f.ang) * i * 6);
      ctx.fillStyle = pal === 'color' ? '#fca044' : DMG[0];
      ctx.fillRect(bx - 2, by - 2, 4, 4);
      ctx.fillStyle = pal === 'color' ? '#f83800' : DMG[1];
      ctx.fillRect(bx - 1, by - 1, 2, 2);
    }
  }

  // the king, drawn at twice the size: blinks when burnt, tumbles when he's down
  const b = g.boss;
  if (b && b.y < H + 4) {
    const x = Math.round(b.x - cam) - 3;
    if (x > -36 && x < W + 4 && !(b.hurt > 0 && Math.floor(g.t * 20) % 2)) {
      const f = b.dead ? 0 : Math.floor(g.t * 4) % 2;
      let rows = KING[f];
      if (b.face > 0) rows = flipH(rows);
      if (b.dead) rows = [...rows].reverse();
      ctx.drawImage(sprite(rows, pal, `king${f}${b.face > 0 ? 'r' : ''}${b.dead ? 'd' : ''}`), x, Math.round(b.y) - 2, 32, 32);
    }
  }
  for (const fl of g.flames) {
    const x = Math.round(fl.x - cam);
    const y = Math.round(fl.y);
    const flick = Math.floor(g.t * 16) % 2;
    ctx.fillStyle = pal === 'color' ? '#f83800' : DMG[1];
    ctx.fillRect(x, y, 8, 3);
    ctx.fillStyle = pal === 'color' ? '#fca044' : DMG[0];
    ctx.fillRect(fl.vx < 0 ? x : x + 3, y + flick, 5, 1);
  }
  for (const f of g.fireballs) {
    const x = Math.round(f.x - cam);
    const y = Math.round(f.y);
    const turn = Math.floor(g.t * 16) % 2;
    ctx.fillStyle = pal === 'color' ? '#f83800' : DMG[3];
    ctx.fillRect(x, y, 4, 4);
    ctx.fillStyle = pal === 'color' ? '#fce000' : DMG[1];
    ctx.fillRect(x + (turn ? 0 : 2), y + (turn ? 0 : 2), 2, 2);
  }

  // effects
  for (const f of g.fx) {
    const x = Math.round(f.x - cam);
    const k = f.t / f.life;
    if (f.kind === 'coin') ctx.drawImage(sprite(COIN[Math.floor(f.t * 16) % 2], pal, `coin${Math.floor(f.t * 16) % 2}`), x + 1, Math.round(f.y - Math.sin(k * Math.PI) * 14));
    else if (f.kind === 'pts') text(ctx, f.text, x, Math.round(f.y - k * 8), hud.ink, 1, hud.shadow);
    else if (f.kind === 'debris') {
      ctx.fillStyle = L.g;
      ctx.fillRect(x - 2, Math.round(f.y) - 2, 4, 4);
    } else if (f.kind === 'puff') {
      ctx.fillStyle = hud.ink;
      const r = Math.round(1 + k * 3);
      ctx.fillRect(x + 2 - r, Math.round(f.y) + 2, 1, 1);
      ctx.fillRect(x + 2 + r, Math.round(f.y) + 2, 1, 1);
      ctx.fillRect(x + 2, Math.round(f.y) + 2 - r, 1, 1);
      ctx.fillRect(x + 2, Math.round(f.y) + 2 + r, 1, 1);
    }
  }

  // player
  const p = g.p;
  if (!(p.inv > 0 && Math.floor(g.t * 16) % 2)) {
    const set = g.big && !p.dead ? BIG : SMALL;
    let frame = 'stand';
    if (p.dead) frame = 'dead';
    else if (g.mode === 'flag' || !p.onGround) frame = 'jump';
    else if (g.throwT > 0 && g.big) frame = 'throw';
    else if (Math.abs(p.vx) > 4 || g.mode === 'walk') frame = ['stand', 'run1', 'run2', 'run1'][Math.floor(g.t * (Math.abs(p.vx) > 90 ? 16 : 11)) % 4];
    const left = p.face < 0 && !p.dead;
    const rows = left ? flipH(set[frame]) : set[frame];
    ctx.drawImage(sprite(rows, p.dead ? pal : outfit(g), `${g.big && !p.dead ? 'big-' : ''}${frame}${left ? '-l' : ''}`), Math.round(p.x - cam) - 1, Math.round(p.y) - 1);
  }

  // HUD
  const { ink, shadow } = hud;
  text(ctx, 'TILAK', 6, 4, ink, 1, shadow);
  text(ctx, String(g.score).padStart(6, '0'), 6, 11, ink, 1, shadow);
  ctx.drawImage(sprite(COIN[0], pal, 'coin0'), 44, 9);
  text(ctx, `x${String(g.coins % 100).padStart(2, '0')}`, 51, 11, ink, 1, shadow);
  if (!g.attract) text(ctx, `x${g.lives}`, 66, 4, ink, 1, shadow);
  text(ctx, 'WORLD', 80, 4, ink, 1, shadow);
  text(ctx, g.name, 84, 11, ink, 1, shadow);
  text(ctx, 'TIME', 126, 4, ink, 1, shadow);
  // the clock blinks when it's running low
  if (!(g.time < 100 && g.mode === 'play' && Math.floor(g.t * 4) % 2)) text(ctx, String(Math.ceil(g.time)).padStart(3, '0'), 128, 11, ink, 1, shadow);

  if (g.mode === 'clear') text(ctx, 'COURSE CLEAR!', 30, 56, ink, 2, shadow);
  if (g.mode === 'over') {
    text(ctx, 'GAME OVER', 44, 58, ink, 2, shadow);
    centerText(ctx, `TOP ${String(g.best).padStart(6, '0')}`, 76, ink, 1, shadow);
  }
  if (g.attract && Math.floor(g.t * 2) % 2 === 0) text(ctx, 'DEMO - PRESS START', 44, 26, ink, 1, shadow);
  if (hint && !g.attract && g.mode === 'play' && g.modeT < 5 && g.course === 0) text(ctx, '<> MOVE  A JUMP  B RUN', 36, 26, ink, 1, shadow);
  if (hint && g.fire && g.mode === 'play' && g.fireAt != null && g.t - g.fireAt < 3) text(ctx, 'B THROWS FIRE', 54, 26, ink, 1, shadow);
  if (paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, W, H);
    text(ctx, 'PAUSE', 60, 66, '#fcfcfc', 2);
  }
}

export const WORLDS = COURSES.map((c) => c.name);

// Small plumber for the cartridge menu.
export function drawPlumberIcon(ctx, x, y, pal = 'color') {
  ctx.drawImage(sprite(SMALL.stand, pal, 'stand'), x, y);
}
