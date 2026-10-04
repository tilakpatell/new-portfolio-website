import { describe, expect, it } from 'vitest';
import { COLS, ROWS, newBlocks, stepBlocks } from './blocks';

const none = () => ({ pressed: new Set() });
const press = (...keys) => ({ pressed: new Set(keys), ...Object.fromEntries(keys.map((k) => [k, true])) });
const run = (g, secs, input = none, dt = 1 / 60) => {
  for (let t = 0; t < secs; t += dt) stepBlocks(g, dt, input());
};
const filled = (g) => g.board.flat().filter(Boolean).length;
// the piece, flat on the floor, with gravity having had its go
const land = (g, kind = 'T') => {
  g.kind = kind;
  g.rot = 0;
  g.x = 3;
  g.y = ROWS - 2;
  g.drop = 0.8; // gravity tries (and fails) to move it on the next step
};

// the top rows stacked up, with a gap in each so nothing clears
const blockTop = (g) => {
  for (let r = 0; r < 4; r++) g.board[r] = Array.from({ length: COLS }, (_, c) => (c === 0 ? null : 'Z'));
};

describe('block drop', () => {
  it('deals every piece once in each run of seven (a shuffled bag)', () => {
    const g = newBlocks(42);
    const seen = [g.kind];
    for (let i = 0; i < 13; i++) {
      stepBlocks(g, 0, press('up')); // hard drop, then the next piece
      g.board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
      if (g.flash) run(g, 0.4);
      seen.push(g.kind);
    }
    expect(new Set(seen.slice(0, 7)).size).toBe(7);
    expect(new Set(seen.slice(7, 14)).size).toBe(7);
  });

  it('gives a landed piece a moment before it locks, so it can still slide', () => {
    const g = newBlocks(1);
    land(g);
    run(g, 0.2);
    expect(filled(g)).toBe(0);
    stepBlocks(g, 1 / 60, press('left'));
    expect(g.x).toBe(2);
    run(g, 0.7);
    expect(filled(g)).toBe(4);
  });

  it('does not let endless sliding stall a piece forever', () => {
    const g = newBlocks(1);
    land(g);
    for (let i = 0; i < 40; i++) {
      stepBlocks(g, 0.1, press(i % 2 ? 'left' : 'right'));
    }
    expect(filled(g)).toBeGreaterThan(0);
  });

  it('locks at once on a hard drop', () => {
    const g = newBlocks(1);
    stepBlocks(g, 0, press('up'));
    expect(filled(g)).toBe(4);
  });

  it('kicks a flat I piece up off the floor so it can stand', () => {
    const g = newBlocks(1);
    g.kind = 'I';
    g.rot = 0;
    g.x = 3;
    g.y = ROWS - 2; // its cells sit in row 1 of its box: the bottom row
    stepBlocks(g, 0, press('a'));
    expect(g.rot % 4).toBe(1);
  });

  it('clears a full row and scores it', () => {
    const g = newBlocks(1);
    for (let c = 0; c < COLS; c++) if (c < 3 || c > 5) g.board[ROWS - 1][c] = 'J';
    land(g, 'T'); // three across the bottom row, the nub above
    stepBlocks(g, 0, press('up'));
    run(g, 0.4);
    expect(g.lines).toBe(1);
    expect(g.score).toBeGreaterThan(0);
  });

  it('pays a combo bonus for clears in a row', () => {
    const one = (g) => {
      for (let c = 0; c < COLS; c++) if (c < 3 || c > 5) g.board[ROWS - 1][c] = 'J';
      land(g, 'T');
      stepBlocks(g, 0, press('up'));
      run(g, 0.4);
    };
    const g = newBlocks(1);
    one(g);
    const first = g.score;
    one(g);
    expect(g.combo).toBe(1);
    expect(g.score - first).toBeGreaterThan(first);
  });

  it('ends when a new piece has nowhere to go', () => {
    const g = newBlocks(1);
    blockTop(g);
    stepBlocks(g, 0, press('up'));
    run(g, 0.5);
    expect(g.mode).toBe('over');
  });

  it('restarts from a game over with Start or A, after a short pause', () => {
    const g = newBlocks(1);
    g.mode = 'over';
    g.modeT = 0;
    expect(stepBlocks(g, 0.1, press('a'))).toBe(null);
    run(g, 0.6);
    expect(stepBlocks(g, 0.01, press('a'))).toBe('restart');
  });

  it('keeps the best score past a game over', () => {
    const g = newBlocks(1, 500);
    g.score = 900;
    blockTop(g);
    stepBlocks(g, 0, press('up'));
    run(g, 0.5);
    expect(g.best).toBe(900);
  });
});
