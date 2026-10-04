// "Block Drop" — a falling-blocks puzzle on a 10×18 board.
// ← → move (hold to repeat), ↓ soft drop, ↑ hard drop, A/B rotate.
// Pieces come from a shuffled bag of all seven, a landed piece can still slide
// for half a second, rotations kick off walls and the floor, and clears in a
// row pay a combo bonus (four lines twice running pays half again).
import { DMG, H, W, rng, text } from './font';

export const COLS = 10;
export const ROWS = 18;
const CELL = 8;
const BX = 8;
const LOCK_DELAY = 0.5; // seconds a grounded piece waits before it locks
const MAX_RESETS = 15; // moves that restart that wait, per row reached
const GRACE = 0.5; // seconds after a game over before a button restarts

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
// rotation tries the spot itself, then nudges sideways, then up off the floor
const KICKS = [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1], [-1, -1], [1, -1], [0, -2]];
const COLORS = {
  color: { I: '#00c8f0', O: '#f8d000', T: '#b048f8', S: '#40c040', Z: '#f83800', J: '#2058f8', L: '#fc9838', bg: '#0e1626', board: '#000000', frame: '#5c6b85', hud: '#fcfcfc', dim: '#8fa0bf', hi: '#fc9838', flash: '#fcfcfc' },
  dmg: { I: DMG[2], O: DMG[1], T: DMG[3], S: DMG[2], Z: DMG[3], J: DMG[2], L: DMG[1], bg: DMG[0], board: DMG[0], frame: DMG[3], hud: DMG[3], dim: DMG[2], hi: DMG[3], flash: DMG[0] },
};

const rotate = (cells, kind, turns) => {
  if (kind === 'O') return cells;
  const size = kind === 'I' ? 4 : 3;
  let out = cells;
  for (let i = 0; i < ((turns % 4) + 4) % 4; i++) out = out.map(([x, y]) => [size - 1 - y, x]);
  return out;
};

// The next piece from a shuffled bag of all seven, refilled when empty.
function draw(g) {
  if (!g.bag.length) {
    const bag = [...KINDS];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(g.rand() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    g.bag = bag;
  }
  return g.bag.shift();
}

export function newBlocks(seed = Date.now(), best = 0) {
  const g = {
    rand: rng(seed),
    bag: [],
    board: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
    score: 0,
    best,
    lines: 0,
    level: 0,
    combo: -1,
    b2b: false,
    t: 0,
    mode: 'play',
    modeT: 0,
    palette: 'color',
    drop: 0,
    das: 0,
    flash: null,
    popup: null,
  };
  g.next = draw(g);
  spawn(g);
  return g;
}

function spawn(g) {
  g.kind = g.next;
  g.next = draw(g);
  g.rot = 0;
  g.x = 3;
  g.y = 0;
  g.lockT = 0;
  g.resets = 0;
  g.lowest = 0;
  if (collides(g, g.x, g.y, g.rot)) {
    g.mode = 'over';
    g.modeT = 0;
    g.best = Math.max(g.best, g.score);
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
const grounded = (g) => collides(g, g.x, g.y + 1, g.rot);

const say = (g, label) => {
  g.popup = { text: label, t: 0 };
};

function lock(g, events) {
  for (const [cx, cy] of cellsOf(g)) {
    const r = g.y + cy;
    const c = g.x + cx;
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) g.board[r][c] = g.kind;
  }
  const full = [];
  g.board.forEach((row, r) => row.every(Boolean) && full.push(r));
  if (!full.length) {
    g.combo = -1;
    spawn(g);
    return;
  }
  const n = full.length;
  const tetris = n === 4;
  g.combo += 1;
  let points = [0, 40, 100, 300, 1200][n] * (g.level + 1);
  if (tetris && g.b2b) points = Math.round(points * 1.5);
  if (g.combo > 0) points += 50 * g.combo * (g.level + 1);
  g.score += points;
  g.b2b = tetris;
  g.flash = { rows: full, t: 0 };
  const before = g.level;
  g.lines += n;
  g.level = Math.floor(g.lines / 10);
  if (g.level > before) say(g, `LEVEL ${g.level}`);
  else if (tetris) say(g, g.combo > 0 ? `TETRIS x${g.combo + 1}` : 'TETRIS!');
  else if (g.combo > 0) say(g, `COMBO x${g.combo + 1}`);
  events?.lines?.(g.lines);
  if (tetris) events?.tetris?.();
}

// Move or rotate if it fits (rotations try the kicks). A successful move by a
// grounded piece restarts its lock wait, a limited number of times.
function tryMove(g, dx, dy, drot = 0) {
  const rot = g.rot + drot;
  for (const [kx, ky] of drot ? KICKS : [[0, 0]]) {
    if (!collides(g, g.x + dx + kx, g.y + dy + ky, rot)) {
      g.x += dx + kx;
      g.y += dy + ky;
      g.rot = rot;
      if (g.y > g.lowest) {
        g.lowest = g.y;
        g.resets = 0;
      }
      if (g.lockT > 0 && g.resets < MAX_RESETS && (dx || drot)) {
        g.lockT = 0;
        g.resets += 1;
      }
      return true;
    }
  }
  return false;
}

export function stepBlocks(g, dt, input, events) {
  g.t += dt;
  g.modeT += dt;
  if (g.popup) {
    g.popup.t += dt;
    if (g.popup.t > 1.2) g.popup = null;
  }
  if (g.mode === 'over') return g.modeT > GRACE && (input.pressed.has('start') || input.pressed.has('a')) ? 'restart' : null;
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
  if (!grounded(g)) {
    const interval = input.down ? 0.04 : Math.max(0.08, 0.8 - g.level * 0.065);
    g.drop += dt;
    while (g.drop >= interval) {
      g.drop -= interval;
      if (!tryMove(g, 0, 1)) break;
      if (input.down) g.score += 1;
    }
    if (!grounded(g)) g.lockT = 0;
  } else {
    g.drop = 0;
    g.lockT += dt;
    if (g.lockT >= LOCK_DELAY) lock(g, events);
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
    // a grounded piece dims as its lock wait runs out
    const fading = g.lockT > 0 && pal === 'color' ? 1 - (g.lockT / LOCK_DELAY) * 0.45 : 1;
    ctx.globalAlpha = fading;
    for (const [cx, cy] of cellsOf(g)) if (g.y + cy >= 0) block(ctx, BX + (g.x + cx) * CELL, (g.y + cy) * CELL, c[g.kind], pal);
    ctx.globalAlpha = 1;
  }

  const px = 98;
  text(ctx, 'SCORE', px, 6, c.dim);
  text(ctx, String(g.score).padStart(6, '0'), px, 13, c.hud);
  text(ctx, 'BEST', px, 24, c.dim);
  text(ctx, String(Math.max(g.best, g.score)).padStart(6, '0'), px, 31, c.hud);
  text(ctx, `LINES ${g.lines}`, px, 44, c.hud);
  text(ctx, `LEVEL ${g.level}`, px, 53, c.hud);
  text(ctx, 'NEXT', px, 66, c.dim);
  ctx.fillStyle = c.board;
  ctx.fillRect(px - 2, 74, 40, 26);
  for (const [cx, cy] of rotate(SHAPES[g.next], g.next, 0)) block(ctx, px + 2 + cx * CELL, 78 + cy * CELL, c[g.next], pal);
  text(ctx, 'A B TURN', px, 110, c.dim);
  text(ctx, 'UP DROP', px, 119, c.dim);
  text(ctx, 'DOWN SOFT', px, 128, c.dim);

  if (g.popup) {
    const k = g.popup.t / 1.2;
    const w = g.popup.text.length * 4 - 1;
    const y = Math.round(60 - k * 10);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(BX + (COLS * CELL - w) / 2 - 3, y - 3, w + 6, 11);
    text(ctx, g.popup.text, Math.round(BX + (COLS * CELL - w) / 2), y, c.hi);
  }

  if (g.mode === 'over') {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(BX, 52, COLS * CELL, 34);
    text(ctx, 'GAME OVER', BX + 22, 60, '#fcfcfc');
    if (g.modeT > GRACE && Math.floor(g.t * 2) % 2 === 0) text(ctx, 'PRESS START', BX + 18, 72, '#fcfcfc');
  }
  if (paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, W, H);
    text(ctx, 'PAUSE', 60, 66, '#fcfcfc', 2);
  }
}
