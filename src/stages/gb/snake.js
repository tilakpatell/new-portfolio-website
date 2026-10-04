// Snake on a 20×16 grid. Arrows steer; eat to grow; walls and your own tail end it.
// Hold B to sprint. Every fifth meal a golden apple turns up for a few seconds,
// worth five. Fill the whole board and you win.
import { DMG, H, W, rng, text } from './font';

const CELL = 8;
export const GW = 20;
export const GH = 16;
const TOP = 16;
const BONUS_EVERY = 5;
const BONUS_TIME = 6; // seconds the golden apple stays out
const BONUS_POINTS = 5;
const GRACE = 0.5; // seconds after a game over before a button restarts

const COLORS = {
  color: { bg: '#0f2a1a', grid: '#12331f', body: '#58d854', bodyDark: '#2f9e30', head: '#a0f070', food: '#f83800', leaf: '#58d854', gold: '#fce000', goldHi: '#fcfcfc', hud: '#fcfcfc', bar: '#08170e' },
  dmg: { bg: DMG[0], grid: DMG[0], body: DMG[2], bodyDark: DMG[3], head: DMG[3], food: DMG[3], leaf: DMG[2], gold: DMG[3], goldHi: DMG[1], hud: DMG[3], bar: DMG[1] },
};

export function newSnake(seed = Date.now(), best = 0) {
  const g = { rand: rng(seed), body: [[6, 8], [5, 8], [4, 8]], dir: [1, 0], queue: [], t: 0, acc: 0, moves: 0, score: 0, eaten: 0, best, mode: 'play', modeT: 0, palette: 'color', bonus: null };
  g.food = freeCell(g);
  return g;
}

// A random empty cell, or null when the snake covers the board. Tries random
// cells first, then scans, so it can never spin forever.
function freeCell(g, avoid = null) {
  const taken = new Set(g.body.map(([x, y]) => y * GW + x));
  if (avoid) taken.add(avoid[1] * GW + avoid[0]);
  if (taken.size >= GW * GH) return null;
  for (let i = 0; i < 64; i++) {
    const n = Math.floor(g.rand() * GW * GH);
    if (!taken.has(n)) return [n % GW, Math.floor(n / GW)];
  }
  const free = [];
  for (let n = 0; n < GW * GH; n++) if (!taken.has(n)) free.push(n);
  const n = free[Math.floor(g.rand() * free.length)];
  return [n % GW, Math.floor(n / GW)];
}

const same = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1];

function end(g, mode, events) {
  g.mode = mode;
  g.modeT = 0;
  g.best = Math.max(g.best, g.score);
  events?.snake?.(g.score);
}

export function stepSnake(g, dt, input, events) {
  g.t += dt;
  g.modeT += dt;
  if (g.mode !== 'play') return g.modeT > GRACE && (input.pressed.has('start') || input.pressed.has('a')) ? 'restart' : null;
  const turns = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  for (const k of ['up', 'down', 'left', 'right']) {
    if (input.pressed.has(k) && g.queue.length < 2) {
      const last = g.queue[g.queue.length - 1] || g.dir;
      const d = turns[k];
      if (d[0] !== -last[0] || d[1] !== -last[1]) g.queue.push(d);
    }
  }
  if (g.bonus) {
    g.bonus.left -= dt;
    if (g.bonus.left <= 0) g.bonus = null;
  }
  g.sprint = !!input.b;
  const speed = Math.min(15, 7 + g.score * 0.25) * (g.sprint ? 1.7 : 1);
  g.acc += dt;
  while (g.acc >= 1 / speed) {
    g.acc -= 1 / speed;
    if (g.queue.length) g.dir = g.queue.shift();
    const [hx, hy] = g.body[0];
    const nx = hx + g.dir[0];
    const ny = hy + g.dir[1];
    const eats = nx === g.food?.[0] && ny === g.food?.[1];
    const tail = eats ? g.body : g.body.slice(0, -1);
    if (nx < 0 || ny < 0 || nx >= GW || ny >= GH || tail.some(([x, y]) => x === nx && y === ny)) {
      end(g, 'over', events);
      return null;
    }
    g.body = [[nx, ny], ...tail];
    g.moves += 1;
    if (g.bonus && same(g.bonus.at, [nx, ny])) {
      g.score += BONUS_POINTS;
      g.bonus = null;
      g.flash = 0.3;
    }
    if (eats) {
      g.score += 1;
      g.eaten += 1;
      g.food = freeCell(g, g.bonus?.at);
      if (!g.food) {
        end(g, 'won', events);
        return null;
      }
      if (g.eaten % BONUS_EVERY === 0 && !g.bonus) {
        const at = freeCell(g, g.food);
        if (at) g.bonus = { at, left: BONUS_TIME };
      }
    }
  }
  if (g.flash > 0) g.flash -= dt;
  return null;
}

export function renderSnake(ctx, g, { paused } = {}) {
  const c = COLORS[g.palette];
  ctx.fillStyle = c.bar;
  ctx.fillRect(0, 0, W, TOP);
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, TOP, W, H - TOP);
  ctx.fillStyle = c.grid;
  for (let x = 0; x < GW; x++) for (let y = 0; y < GH; y++) if ((x + y) % 2 === 0) ctx.fillRect(x * CELL, TOP + y * CELL, CELL, CELL);
  text(ctx, 'SNAKE', 6, 5, c.hud);
  text(ctx, `SCORE ${String(g.score).padStart(3, '0')}`, 52, 5, g.flash > 0 && Math.floor(g.t * 20) % 2 ? c.gold : c.hud);
  text(ctx, `BEST ${String(Math.max(g.best, g.score)).padStart(3, '0')}`, 110, 5, c.hud);

  if (g.food) {
    const [fx, fy] = g.food;
    ctx.fillStyle = c.food;
    ctx.fillRect(fx * CELL + 1, TOP + fy * CELL + 2, 6, 5);
    ctx.fillRect(fx * CELL + 2, TOP + fy * CELL + 1, 4, 7);
    ctx.fillStyle = c.leaf;
    ctx.fillRect(fx * CELL + 4, TOP + fy * CELL, 2, 2);
  }
  // the golden apple blinks in its last two seconds
  if (g.bonus && (g.bonus.left > 2 || Math.floor(g.t * 8) % 2 === 0)) {
    const [bx, by] = g.bonus.at;
    ctx.fillStyle = c.gold;
    ctx.fillRect(bx * CELL + 1, TOP + by * CELL + 2, 6, 5);
    ctx.fillRect(bx * CELL + 2, TOP + by * CELL + 1, 4, 7);
    ctx.fillStyle = c.goldHi;
    ctx.fillRect(bx * CELL + 2, TOP + by * CELL + 2, 1, 2);
    // how long it has left, as a bar under the score
    ctx.fillStyle = c.gold;
    ctx.fillRect(52, 12, Math.round((g.bonus.left / BONUS_TIME) * 48), 1);
  }

  g.body.forEach(([x, y], i) => {
    ctx.fillStyle = i === 0 ? c.head : i % 2 ? c.body : c.bodyDark;
    ctx.fillRect(x * CELL + 1, TOP + y * CELL + 1, CELL - 2, CELL - 2);
  });
  const [hx, hy] = g.body[0];
  ctx.fillStyle = g.palette === 'color' ? '#101010' : DMG[0];
  const ex = g.dir[0] === 0 ? [2, 5] : [g.dir[0] > 0 ? 5 : 2, g.dir[0] > 0 ? 5 : 2];
  const ey = g.dir[1] === 0 ? [2, 5] : [g.dir[1] > 0 ? 5 : 2, g.dir[1] > 0 ? 5 : 2];
  ctx.fillRect(hx * CELL + ex[0], TOP + hy * CELL + ey[0], 1, 1);
  ctx.fillRect(hx * CELL + ex[1], TOP + hy * CELL + ey[1], 1, 1);
  if (g.sprint && g.mode === 'play') {
    // a speed line behind the head
    ctx.fillStyle = c.hud;
    ctx.fillRect(hx * CELL + 3 - g.dir[0] * 6, TOP + hy * CELL + 3 - g.dir[1] * 6, 2, 2);
  }

  if (g.mode === 'over' || g.mode === 'won') {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(30, 58, 100, 30);
    text(ctx, g.mode === 'won' ? 'YOU WIN!' : 'GAME OVER', g.mode === 'won' ? 64 : 62, 64, '#fcfcfc');
    if (g.modeT > GRACE && Math.floor(g.t * 2) % 2 === 0) text(ctx, 'PRESS START', 58, 76, '#fcfcfc');
  }
  if (paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, W, H);
    text(ctx, 'PAUSE', 60, 66, '#fcfcfc', 2);
  }
}
