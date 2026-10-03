// "Block Drop" — a falling-blocks puzzle on a 10×18 board.
// ← → move (hold to repeat), ↓ soft drop, ↑ hard drop, A/B rotate.
import { DMG, H, W, rng, text } from './font';

const COLS = 10;
const ROWS = 18;
const CELL = 8;
const BX = 8;

const SHAPES = {
  I: [[0, 1], [1, 1], [2, 1], [3, 1]],
  O: [[1, 0], [2, 0], [1, 1], [2, 1]],
  T: [[1, 0], [0, 1], [1, 1], [2, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
  J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]],
};
const KINDS = Object.keys(SHAPES);
const COLORS = {
  color: { I: '#00c8f0', O: '#f8d000', T: '#b048f8', S: '#40c040', Z: '#f83800', J: '#2058f8', L: '#fc9838', bg: '#0e1626', board: '#000000', frame: '#5c6b85', hud: '#fcfcfc', flash: '#fcfcfc' },
  dmg: { I: DMG[2], O: DMG[1], T: DMG[3], S: DMG[2], Z: DMG[3], J: DMG[2], L: DMG[1], bg: DMG[0], board: DMG[0], frame: DMG[3], hud: DMG[3], flash: DMG[0] },
};

const rotate = (cells, kind, turns) => {
  if (kind === 'O') return cells;
  const size = kind === 'I' ? 4 : 3;
  let out = cells;
  for (let i = 0; i < ((turns % 4) + 4) % 4; i++) out = out.map(([x, y]) => [size - 1 - y, x]);
  return out;
};

export function newBlocks(seed = Date.now()) {
  const g = { rand: rng(seed), board: Array.from({ length: ROWS }, () => Array(COLS).fill(null)), score: 0, lines: 0, level: 0, t: 0, mode: 'play', modeT: 0, palette: 'color', drop: 0, das: 0, flash: null };
  g.next = KINDS[Math.floor(g.rand() * 7)];
  spawn(g);
  return g;
}

function spawn(g) {
  g.kind = g.next;
  g.next = KINDS[Math.floor(g.rand() * 7)];
  g.rot = 0;
  g.x = 3;
  g.y = 0;
  if (collides(g, g.x, g.y, g.rot)) {
    g.mode = 'over';
    g.modeT = 0;
  }
}

const cellsOf = (g, rot = g.rot) => rotate(SHAPES[g.kind], g.kind, rot);
function collides(g, x, y, rot) {
  return cellsOf(g, rot).some(([cx, cy]) => {
    const bx = x + cx;
    const by = y + cy;
    return bx < 0 || bx >= COLS || by >= ROWS || (by >= 0 && g.board[by][bx]);
  });
}

function lock(g, events) {
  for (const [cx, cy] of cellsOf(g)) if (g.y + cy >= 0) g.board[g.y + cy][g.x + cx] = g.kind;
  const full = [];
  g.board.forEach((row, r) => row.every(Boolean) && full.push(r));
  if (full.length) {
    g.flash = { rows: full, t: 0 };
    g.score += [0, 40, 100, 300, 1200][full.length] * (g.level + 1);
    g.lines += full.length;
    g.level = Math.floor(g.lines / 10);
    events?.lines?.(g.lines);
  } else spawn(g);
}

const tryMove = (g, dx, dy, drot = 0) => {
  const rot = g.rot + drot;
  for (const kick of drot ? [0, -1, 1, -2, 2] : [0]) {
    if (!collides(g, g.x + dx + kick, g.y + dy, rot)) {
      g.x += dx + kick;
      g.y += dy;
      g.rot = rot;
      return true;
    }
  }
  return false;
};

export function stepBlocks(g, dt, input, events) {
  g.t += dt;
  g.modeT += dt;
  if (g.mode === 'over') return input.pressed.has('start') ? 'restart' : null;
  if (g.flash) {
    g.flash.t += dt;
    if (g.flash.t > 0.3) {
      const keep = g.board.filter((_, r) => !g.flash.rows.includes(r));
      while (keep.length < ROWS) keep.unshift(Array(COLS).fill(null));
      g.board = keep;
      g.flash = null;
      spawn(g);
    }
    return null;
  }
  const p = input.pressed;
  if (p.has('a')) tryMove(g, 0, 0, 1);
  if (p.has('b')) tryMove(g, 0, 0, -1);
  if (p.has('up')) {
    while (tryMove(g, 0, 1)) g.score += 2;
    lock(g, events);
    return null;
  }
  // horizontal with auto-repeat
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (p.has('left') || p.has('right')) {
    tryMove(g, p.has('left') ? -1 : 1, 0);
    g.das = -0.17;
  } else if (dir) {
    g.das += dt;
    while (g.das > 0.05) {
      g.das -= 0.05;
      tryMove(g, dir, 0);
    }
  }
  const interval = input.down ? 0.04 : Math.max(0.08, 0.8 - g.level * 0.065);
  g.drop += dt;
  while (g.drop >= interval) {
    g.drop -= interval;
    if (!tryMove(g, 0, 1)) {
      lock(g, events);
      break;
    } else if (input.down) g.score += 1;
  }
  return null;
}

function block(ctx, x, y, color, pal) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, CELL, CELL);
  if (pal === 'color') {
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillRect(x, y, CELL - 1, 1);
    ctx.fillRect(x, y, 1, CELL - 1);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x + CELL - 1, y, 1, CELL);
    ctx.fillRect(x, y + CELL - 1, CELL, 1);
  } else {
    ctx.fillStyle = DMG[3];
    ctx.fillRect(x + CELL - 1, y, 1, CELL);
    ctx.fillRect(x, y + CELL - 1, CELL, 1);
    ctx.fillStyle = DMG[0];
    ctx.fillRect(x + 2, y + 2, 2, 2);
  }
}

export function renderBlocks(ctx, g, { paused } = {}) {
  const pal = g.palette;
  const c = COLORS[pal];
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = c.frame;
  ctx.fillRect(BX - 2, 0, COLS * CELL + 4, H);
  ctx.fillStyle = c.board;
  ctx.fillRect(BX, 0, COLS * CELL, H);

  g.board.forEach((row, r) =>
    row.forEach((k, col) => {
      if (!k) return;
      const flashing = g.flash?.rows.includes(r) && Math.floor(g.flash.t * 20) % 2 === 0;
      block(ctx, BX + col * CELL, r * CELL, flashing ? c.flash : c[k], pal);
    }),
  );
  if (g.mode !== 'over' && !g.flash) {
    // ghost
    let gy = g.y;
    while (!collides(g, g.x, gy + 1, g.rot)) gy++;
    ctx.fillStyle = pal === 'color' ? 'rgba(255,255,255,0.14)' : DMG[1];
    for (const [cx, cy] of cellsOf(g)) if (gy + cy >= 0) ctx.fillRect(BX + (g.x + cx) * CELL + 1, (gy + cy) * CELL + 1, CELL - 2, CELL - 2);
    for (const [cx, cy] of cellsOf(g)) if (g.y + cy >= 0) block(ctx, BX + (g.x + cx) * CELL, (g.y + cy) * CELL, c[g.kind], pal);
  }

  const px = 98;
  text(ctx, 'SCORE', px, 8, c.hud);
  text(ctx, String(g.score).padStart(6, '0'), px, 16, c.hud);
  text(ctx, 'LINES', px, 32, c.hud);
  text(ctx, String(g.lines), px, 40, c.hud);
  text(ctx, 'LEVEL', px, 56, c.hud);
  text(ctx, String(g.level), px, 64, c.hud);
  text(ctx, 'NEXT', px, 82, c.hud);
  ctx.fillStyle = c.board;
  ctx.fillRect(px - 2, 90, 40, 26);
  for (const [cx, cy] of rotate(SHAPES[g.next], g.next, 0)) block(ctx, px + 2 + cx * CELL, 94 + cy * CELL, c[g.next], pal);
  text(ctx, 'A ROTATE', px, 124, c.hud);
  text(ctx, 'UP DROP', px, 132, c.hud);

  if (g.mode === 'over') {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(BX, 52, COLS * CELL, 34);
    text(ctx, 'GAME OVER', BX + 22, 60, '#fcfcfc');
    if (Math.floor(g.t * 2) % 2 === 0) text(ctx, 'PRESS START', BX + 18, 72, '#fcfcfc');
  }
  if (paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, W, H);
    text(ctx, 'PAUSE', 60, 66, '#fcfcfc', 2);
  }
}
