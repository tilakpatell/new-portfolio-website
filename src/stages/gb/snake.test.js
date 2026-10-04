import { describe, expect, it } from 'vitest';
import { GH, GW, newSnake, stepSnake } from './snake';

const none = () => ({ pressed: new Set() });
const press = (...keys) => ({ pressed: new Set(keys), ...Object.fromEntries(keys.map((k) => [k, true])) });
const hold = (...keys) => ({ pressed: new Set(), ...Object.fromEntries(keys.map((k) => [k, true])) });

// Steps until the snake has moved `n` cells (at the base speed).
function moves(g, n, input = none) {
  const start = g.moves;
  for (let i = 0; i < 2000 && g.moves - start < n && g.mode === 'play'; i++) stepSnake(g, 1 / 60, input());
}

describe('snake', () => {
  it('moves one cell per tick in its direction', () => {
    const g = newSnake(1);
    const [hx, hy] = g.body[0];
    moves(g, 1);
    expect(g.body[0]).toEqual([hx + 1, hy]);
  });

  it('cannot reverse into itself, even with two quick turns', () => {
    const g = newSnake(1);
    g.food = [0, 0];
    stepSnake(g, 0, press('left'));
    moves(g, 1);
    expect(g.mode).toBe('play');
    expect(g.dir).toEqual([1, 0]);
    // up then left in the same tick is a legal U-turn
    stepSnake(g, 0, press('up'));
    stepSnake(g, 0, press('left'));
    moves(g, 2);
    expect(g.mode).toBe('play');
    expect(g.dir).toEqual([-1, 0]);
  });

  it('grows and scores when it eats', () => {
    const g = newSnake(1);
    const [hx, hy] = g.body[0];
    g.food = [hx + 1, hy];
    const len = g.body.length;
    moves(g, 1);
    expect(g.body.length).toBe(len + 1);
    expect(g.score).toBe(1);
  });

  it('ends at a wall', () => {
    const g = newSnake(1);
    g.food = [0, 0];
    moves(g, GW);
    expect(g.mode).toBe('over');
  });

  it('wins, instead of freezing the page, when it fills the board', () => {
    const g = newSnake(1);
    // a snake snaking over every cell but the last, heading for it
    const body = [];
    for (let y = 0; y < GH; y++) {
      const row = [];
      for (let x = 0; x < GW; x++) row.push([x, y]);
      body.push(...(y % 2 ? row.reverse() : row));
    }
    const last = body.pop();
    g.body = body.reverse();
    const [hx, hy] = g.body[0];
    g.dir = [last[0] - hx, last[1] - hy];
    g.food = last;
    moves(g, 1);
    expect(g.mode).toBe('won');
    expect(g.body.length).toBe(GW * GH);
  });

  it('ignores buttons for a moment after a game over, so mashing A does not restart at once', () => {
    const g = newSnake(1);
    g.food = [0, 0];
    moves(g, GW);
    expect(g.mode).toBe('over');
    expect(stepSnake(g, 0.1, press('a'))).toBe(null);
    stepSnake(g, 0.6, none());
    expect(stepSnake(g, 0.01, press('a'))).toBe('restart');
  });

  it('puts out a golden apple every fifth meal, worth five, for a limited time', () => {
    const g = newSnake(1);
    for (let i = 0; i < 5; i++) {
      expect(g.bonus).toBe(null);
      const [hx, hy] = g.body[0];
      g.food = [hx + 1, hy];
      moves(g, 1);
    }
    expect(g.bonus).toBeTruthy();
    const [hx, hy] = g.body[0];
    g.bonus.at = [hx + 1, hy];
    const score = g.score;
    moves(g, 1);
    expect(g.score).toBe(score + 5);
    expect(g.bonus).toBe(null);
  });

  it('lets the golden apple go if it is not eaten in time', () => {
    const g = newSnake(1);
    g.bonus = { at: [0, 0], left: 0.2 };
    g.food = [GW - 1, GH - 1];
    stepSnake(g, 0.1, none());
    expect(g.bonus).toBeTruthy();
    stepSnake(g, 0.15, none());
    expect(g.bonus).toBe(null);
  });

  it('goes faster while B is held', () => {
    const slow = newSnake(1);
    const fast = newSnake(1);
    slow.food = fast.food = [0, 0];
    for (let i = 0; i < 30; i++) {
      stepSnake(slow, 1 / 60, none());
      stepSnake(fast, 1 / 60, hold('b'));
    }
    expect(fast.moves).toBeGreaterThan(slow.moves);
  });

  it('remembers the best score past the end of a game', () => {
    const g = newSnake(1, 7);
    g.score = 9;
    g.food = [0, 0];
    moves(g, GW);
    expect(g.best).toBe(9);
  });
});
