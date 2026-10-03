// Snake on a 20×16 grid. Arrows steer; eat to grow; walls and your own tail end it.
import { DMG, H, W, rng, text } from './font';

const CELL = 8;
const GW = 20;
const GH = 16;
const TOP = 16;

const COLORS = {
  color: { bg: '#0f2a1a', grid: '#12331f', body: '#58d854', bodyDark: '#2f9e30', head: '#a0f070', food: '#f83800', leaf: '#58d854', hud: '#fcfcfc', bar: '#08170e' },
  dmg: { bg: DMG[0], grid: DMG[0], body: DMG[2], bodyDark: DMG[3], head: DMG[3], food: DMG[3], leaf: DMG[2], hud: DMG[3], bar: DMG[1] },
};

export function newSnake(seed = Date.now(), best = 0) {
  const g = { rand: rng(seed), body: [[6, 8], [5, 8], [4, 8]], dir: [1, 0], queue: [], t: 0, acc: 0, score: 0, best, mode: 'play', modeT: 0, palette: 'color' };
  placeFood(g);
  return g;
}

function placeFood(g) {
  for (;;) {
    const f = [Math.floor(g.rand() * GW), Math.floor(g.rand() * GH)];
    if (!g.body.some(([x, y]) => x === f[0] && y === f[1])) {
      g.food = f;
      return;
    }
  }
}

export function stepSnake(g, dt, input, events) {
  g.t += dt;
  g.modeT += dt;
  if (g.mode === 'over') return input.pressed.has('start') || input.pressed.has('a') ? 'restart' : null;
  const turns = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  for (const k of ['up', 'down', 'left', 'right']) {
    if (input.pressed.has(k) && g.queue.length < 2) {
      const last = g.queue[g.queue.length - 1] || g.dir;
      const d = turns[k];
      if (d[0] !== -last[0] || d[1] !== -last[1]) g.queue.push(d);
    }
  }
  const speed = Math.min(15, 7 + g.score * 0.25);
  g.acc += dt;
  while (g.acc >= 1 / speed) {
    g.acc -= 1 / speed;
    if (g.queue.length) g.dir = g.queue.shift();
    const [hx, hy] = g.body[0];
    const nx = hx + g.dir[0];
    const ny = hy + g.dir[1];
    const eats = nx === g.food[0] && ny === g.food[1];
    const tail = eats ? g.body : g.body.slice(0, -1);
    if (nx < 0 || ny < 0 || nx >= GW || ny >= GH || tail.some(([x, y]) => x === nx && y === ny)) {
      g.mode = 'over';
      g.modeT = 0;
      g.best = Math.max(g.best, g.score);
      events?.snake?.(g.score);
      return null;
    }
    g.body = [[nx, ny], ...tail];
    if (eats) {
      g.score += 1;
      placeFood(g);
    }
  }
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
  text(ctx, `SCORE ${String(g.score).padStart(3, '0')}`, 52, 5, c.hud);
  text(ctx, `BEST ${String(Math.max(g.best, g.score)).padStart(3, '0')}`, 110, 5, c.hud);

  const [fx, fy] = g.food;
  ctx.fillStyle = c.food;
  ctx.fillRect(fx * CELL + 1, TOP + fy * CELL + 2, 6, 5);
  ctx.fillRect(fx * CELL + 2, TOP + fy * CELL + 1, 4, 7);
  ctx.fillStyle = c.leaf;
  ctx.fillRect(fx * CELL + 4, TOP + fy * CELL, 2, 2);

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

  if (g.mode === 'over') {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(30, 58, 100, 30);
    text(ctx, 'GAME OVER', 62, 64, '#fcfcfc');
    if (Math.floor(g.t * 2) % 2 === 0) text(ctx, 'PRESS START', 58, 76, '#fcfcfc');
  }
  if (paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, W, H);
    text(ctx, 'PAUSE', 60, 66, '#fcfcfc', 2);
  }
}
