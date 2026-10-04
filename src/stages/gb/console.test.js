import { describe, expect, it } from 'vitest';
import { GAMES, newConsole, stepConsole } from './console';

const press = (...keys) => ({ pressed: new Set(keys), ...Object.fromEntries(keys.map((k) => [k, true])) });
const none = () => ({ pressed: new Set() });
const pick = (c, id) => {
  c.mode = 'menu';
  c.sel = GAMES.findIndex((g) => g.id === id);
  stepConsole(c, 1 / 60, press('a'));
};

describe('the console', () => {
  it('boots to the menu', () => {
    const c = newConsole();
    for (let i = 0; i < 100; i++) stepConsole(c, 1 / 60, none());
    expect(c.mode).toBe('menu');
  });

  it('hands each game its own best score', () => {
    const c = newConsole({ best: { snake: 12, blocks: 3400, mario: 9100 } });
    pick(c, 'snake');
    expect(c.game.best).toBe(12);
    pick(c, 'blocks');
    expect(c.game.best).toBe(3400);
    pick(c, 'mario');
    expect(c.game.best).toBe(9100);
  });

  it('tells the page about a new best, so it can be kept between visits', () => {
    const saved = [];
    const c = newConsole({ best: { snake: 2 } });
    pick(c, 'snake');
    c.game.score = 5;
    c.game.food = [0, 0];
    for (let i = 0; i < 400 && c.game.mode === 'play'; i++) stepConsole(c, 1 / 60, none(), { best: (b) => saved.push({ ...b }) });
    expect(c.best.snake).toBe(5);
    expect(saved.at(-1)).toMatchObject({ snake: 5 });
  });

  it('keeps one game’s best from leaking into another', () => {
    const c = newConsole({ best: { snake: 40 } });
    pick(c, 'blocks');
    expect(c.game.best).toBe(0);
  });

  it('switches colours from the menu and reports it', () => {
    let palette = null;
    const c = newConsole({ palette: 'color' });
    c.mode = 'menu';
    stepConsole(c, 1 / 60, press('select'), { palette: (p) => (palette = p) });
    expect(c.palette).toBe('dmg');
    expect(palette).toBe('dmg');
  });

  it('pauses with Start and goes back to the menu with Select', () => {
    const c = newConsole();
    pick(c, 'snake');
    stepConsole(c, 1 / 60, press('start'));
    expect(c.paused).toBe(true);
    const moves = c.game.moves;
    for (let i = 0; i < 60; i++) stepConsole(c, 1 / 60, none());
    expect(c.game.moves).toBe(moves);
    stepConsole(c, 1 / 60, press('select'));
    expect(c.mode).toBe('menu');
  });
});
