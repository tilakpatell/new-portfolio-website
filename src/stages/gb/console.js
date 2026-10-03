// The handheld's "operating system": boot logo, cartridge menu, demo mode,
// pause and back-to-menu, routing input to whichever game is running.
import { DMG, H, W, centerText, text } from './font';
import { drawPlumberIcon, newMario, renderMario, stepMario } from './mario';
import { newBlocks, renderBlocks, stepBlocks } from './blocks';
import { newSnake, renderSnake, stepSnake } from './snake';

export const GAMES = [
  { id: 'mario', name: 'SUPER TILAK LAND', blurb: 'RUN, JUMP, STOMP', step: stepMario, render: renderMario },
  { id: 'blocks', name: 'BLOCK DROP', blurb: 'CLEAR THE LINES', step: stepBlocks, render: renderBlocks },
  { id: 'snake', name: 'SNAKE', blurb: 'EAT, GROW, SURVIVE', step: stepSnake, render: renderSnake },
];

export function newConsole({ start = 'boot' } = {}) {
  const c = { mode: 'boot', t: 0, modeT: 0, sel: 0, palette: 'color', game: null, def: null, paused: false, idle: 0, attract: false, best: 0 };
  if (start === 'attract') startGame(c, 0, { attract: true });
  return c;
}

function startGame(c, idx, { attract = false } = {}) {
  const def = GAMES[idx];
  if (def.id === 'mario') c.game = newMario({ attract, seed: 1989 + Math.floor(Math.random() * 1000) });
  else if (def.id === 'blocks') c.game = newBlocks();
  else c.game = newSnake(Date.now(), c.best);
  c.game.palette = c.palette;
  c.def = def;
  c.sel = idx;
  c.mode = 'game';
  c.paused = false;
  c.attract = attract;
  c.modeT = 0;
}

const toMenu = (c) => {
  if (c.game?.best) c.best = Math.max(c.best, c.game.best);
  c.mode = 'menu';
  c.modeT = 0;
  c.idle = 0;
  c.paused = false;
};

export function stepConsole(c, dt, input, events) {
  c.t += dt;
  c.modeT += dt;
  const p = input.pressed;
  const any = p.size > 0;

  if (c.mode === 'boot') {
    if (c.modeT > 1.4 || any) toMenu(c);
    return;
  }
  if (c.mode === 'menu') {
    if (p.has('up')) c.sel = (c.sel + GAMES.length - 1) % GAMES.length;
    if (p.has('down')) c.sel = (c.sel + 1) % GAMES.length;
    if (p.has('select') || p.has('b')) c.palette = c.palette === 'color' ? 'dmg' : 'color';
    if (p.has('a') || p.has('start')) return startGame(c, c.sel);
    c.idle = any ? 0 : c.idle + dt;
    if (c.idle > 9) startGame(c, 0, { attract: true });
    return;
  }
  // in a game
  if (c.attract) {
    if (p.has('start') || p.has('a')) return startGame(c, 0);
    if (any) return toMenu(c);
    c.def.step(c.game, dt, input, events);
    return;
  }
  if (p.has('select')) return toMenu(c);
  if (p.has('start') && c.game.mode !== 'over') c.paused = !c.paused;
  if (c.paused) return;
  const r = c.def.step(c.game, dt, input, events);
  if (r === 'restart') startGame(c, c.sel);
  if (r === 'exit') toMenu(c);
}

function renderMenu(ctx, c) {
  const color = c.palette === 'color';
  const bg = color ? '#0e1626' : DMG[0];
  const ink = color ? '#fcfcfc' : DMG[3];
  const dim = color ? '#8fa0bf' : DMG[2];
  const hi = color ? '#fc9838' : DMG[3];
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  if (color) {
    ctx.fillStyle = '#16233a';
    for (let i = 0; i < 6; i++) ctx.fillRect(0, 22 + i * 3, W, 1);
  }
  centerText(ctx, 'TP-01', 10, ink, 2);
  centerText(ctx, 'GAME PAK', 24, dim);
  GAMES.forEach((g, i) => {
    const y = 44 + i * 26;
    const on = i === c.sel;
    if (on) {
      ctx.fillStyle = color ? '#1d2f4f' : DMG[1];
      ctx.fillRect(8, y - 4, W - 16, 22);
      if (Math.floor(c.t * 3) % 2 === 0) text(ctx, '>', 12, y + 2, hi);
    }
    // icons
    const ix = 22;
    if (g.id === 'mario') drawPlumberIcon(ctx, ix, y - 2, c.palette);
    else if (g.id === 'blocks') {
      const cols = color ? ['#b048f8', '#b048f8', '#b048f8', '#b048f8'] : [DMG[3], DMG[3], DMG[3], DMG[3]];
      [[1, 0], [0, 1], [1, 1], [2, 1]].forEach(([bx, by], k) => {
        ctx.fillStyle = cols[k];
        ctx.fillRect(ix + bx * 5, y + 2 + by * 5, 4, 4);
      });
    } else {
      ctx.fillStyle = color ? '#58d854' : DMG[2];
      [[0, 8], [3, 8], [6, 8], [6, 5], [6, 2], [9, 2]].forEach(([sx, sy]) => ctx.fillRect(ix + sx, y + sy, 3, 3));
      ctx.fillStyle = color ? '#f83800' : DMG[3];
      ctx.fillRect(ix + 12, y + 2, 2, 2);
    }
    text(ctx, g.name, 40, y + 1, on ? ink : dim);
    text(ctx, g.blurb, 40, y + 9, dim);
  });
  centerText(ctx, 'A START   SELECT COLORS', 124, dim);
  centerText(ctx, color ? 'COLOR' : 'CLASSIC', 133, hi);
}

export function renderConsole(ctx, c) {
  if (c.mode === 'boot') {
    const color = c.palette === 'color';
    ctx.fillStyle = color ? '#0e1626' : DMG[0];
    ctx.fillRect(0, 0, W, H);
    const t = Math.min(1, c.modeT / 0.9);
    centerText(ctx, 'TILAK', Math.round(-12 + t * 62), color ? '#fcfcfc' : DMG[3], 2);
    if (t >= 1) centerText(ctx, 'TP-01', 72, color ? '#8fa0bf' : DMG[2]);
    return;
  }
  if (c.mode === 'menu') return renderMenu(ctx, c);
  c.def.render(ctx, c.game, { paused: c.paused, hint: !c.attract });
}
