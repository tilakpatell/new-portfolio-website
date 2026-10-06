import { describe, expect, it } from 'vitest';
import { MAX_STEPS, enterCourse, newGame, stepGame, tick } from './game';
import { SAVE, blank, readSave, starTotal, writeSave } from './save';

const input = (o = {}) => ({ sx: 0, sy: 0, a: false, ap: false, b: false, bp: false, z: false, zp: false, walk: false, start: false, ...o });
const steps = (g, n, inp = input()) => {
  for (let i = 0; i < n; i++) stepGame(g, typeof inp === 'function' ? inp(i) : inp);
};
const types = (g) => g.out.map((e) => e.type);

describe('the game', () => {
  it('starts at the title, on the castle grounds', () => {
    const g = newGame();
    expect(g.mode).toBe('title');
    expect(g.areaId).toBe('grounds');
    steps(g, 1, input({ ap: true, a: true }));
    expect(g.mode).toBe('play');
  });

  it('opens Bob-omb Ridge from its card, at its start', () => {
    const g = newGame();
    g.mode = 'play';
    g.out.push({ type: 'card', course: 'bobomb' });
    steps(g, 1);
    expect(g.mode).toBe('card');
    steps(g, 1, input({ ap: true, a: true }));
    expect(g.areaId).toBe('bobomb');
    expect(g.mode).toBe('play');
    expect(g.mario.pos.z).toBe(5000);
  });

  it('says a course that isn\'t built yet is coming soon, and stays put', () => {
    const g = newGame();
    g.mode = 'play';
    g.out.push({ type: 'card', course: 'snow' });
    steps(g, 1);
    expect(g.mode).toBe('card');
    expect(g.out.find((e) => e.type === 'card')).toMatchObject({ course: 'snow', live: false });
    steps(g, 1, input({ ap: true, a: true }));
    expect(g.mode).toBe('play');
    expect(g.areaId).toBe('grounds');
  });

  it('keeps a star, celebrates it, then returns Mario to the castle by its painting', () => {
    const g = newGame();
    enterCourse(g, 'bobomb');
    const star = g.actors.find((a) => a.type === 'gate') && g.actors.find((a) => a.type === 'star' && a.index === 2);
    expect(star).toBeDefined();
    g.out.push({ type: 'star', index: 2 });
    steps(g, 1);
    expect(g.mode).toBe('starget');
    expect(g.save.stars.bobomb[2]).toBe(true);
    expect(g.saveDirty).toBe(true);
    expect(types(g)).toContain('starget');
    steps(g, 120);
    expect(g.mode).toBe('play');
    expect(g.areaId).toBe('castle');
    expect(g.mario.pos.x).toBe(-3000);
  });

  it('costs a life to die, and starts the course again', () => {
    const g = newGame();
    enterCourse(g, 'bobomb');
    const lives = g.lives;
    g.mario.pos.y = -5000;
    steps(g, 1);
    expect(g.mode).toBe('dead');
    steps(g, 100);
    expect(g.lives).toBe(lives - 1);
    expect(g.mode).toBe('play');
    expect(g.areaId).toBe('bobomb');
    expect(g.mario.health).toBe(8);
  });

  it('dies when a foe takes his last wedge', () => {
    const g = newGame();
    enterCourse(g, 'bobomb');
    const goomba = g.actors.find((a) => a.type === 'goomba');
    g.mario.pos = { x: goomba.pos.x, y: goomba.pos.y, z: goomba.pos.z + 200 };
    g.mario.health = 1;
    steps(g, 60);
    expect(g.mode).toBe('dead');
  });

  it('carries Mario once when the post he stands on sinks, not every frame after', () => {
    const g = newGame();
    enterCourse(g, 'bobomb');
    const post = g.actors.find((a) => a.type === 'post');
    const top = post.pos.y + 120;
    g.mario.pos = { x: post.pos.x, y: top + 5, z: post.pos.z };
    g.mario.placed = false;
    g.actors = g.actors.filter((a) => a.type !== 'chomp');
    steps(g, 5);
    expect(g.mario.pos.y).toBeCloseTo(top, 0);
    // pounded once: the post sinks 35
    g.mario.action = 'poundland';
    g.mario.t = 0;
    post.def.id = post.def.id ?? 'post';
    g.actors.find((a) => a.type === 'post').hits = 0;
    steps(g, 20);
    expect(g.mario.pos.y).toBeGreaterThan(top - 36);
    expect(g.mario.pos.y).toBeLessThan(top - 34);
  });

  it('is over with no lives left, and goes back to the title', () => {
    const g = newGame();
    enterCourse(g, 'bobomb');
    g.lives = 1;
    g.mario.lives = 1;
    g.mario.pos.y = -5000;
    steps(g, 100);
    expect(g.mode).toBe('over');
    steps(g, 1, input({ ap: true, a: true }));
    expect(g.mode).toBe('title');
    expect(g.lives).toBe(4);
  });

  it('reads signs as dialogs, the world waiting until A', () => {
    const g = newGame();
    g.mode = 'play';
    g.out.push({ type: 'dialog', title: 'Sign', text: 'Hi' });
    steps(g, 1);
    expect(g.mode).toBe('dialog');
    const z = g.mario.pos.z;
    steps(g, 10, input({ sy: 1 }));
    expect(g.mario.pos.z).toBe(z);
    steps(g, 1, input({ ap: true, a: true }));
    expect(g.mode).toBe('play');
  });

  it('runs at most four steps for a long frame, and drops the rest', () => {
    const g = newGame();
    g.mode = 'play';
    expect(tick(g, 5, input())).toBe(MAX_STEPS);
    expect(tick(g, 1 / 30, input())).toBeLessThanOrEqual(2);
  });

  it('keeps a press made on a frame with no step for the next step', () => {
    const g = newGame();
    expect(tick(g, 0.001, input({ ap: true, a: true }))).toBe(0);
    tick(g, 1 / 30, input({ a: true }));
    expect(g.mode).toBe('play');
  });
});

describe('the save', () => {
  it('reads what was written', () => {
    const mem = new Map();
    const store = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
    const s = blank();
    s.stars.bobomb = [true, false, true];
    s.look = 'ultra';
    writeSave(store, s);
    expect(mem.has(SAVE)).toBe(true);
    const back = readSave(store);
    expect(back.stars.bobomb).toEqual([true, false, true]);
    expect(back.look).toBe('ultra');
    expect(starTotal(back)).toBe(2);
  });

  it('gives a blank save when storage throws, and writing never throws', () => {
    const store = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readSave(store)).toEqual(blank());
    expect(() => writeSave(store, blank())).not.toThrow();
  });

  it('cleans up a save that is the wrong shape', () => {
    const store = { getItem: () => JSON.stringify({ v: 1, data: { stars: { bobomb: 'yes', nope: [1, 1] }, look: 'neon' } }) };
    const s = readSave(store);
    expect(s.stars).toEqual({});
    expect(s.look).toBe('modern');
    expect(s.sound).toBe(true);
  });
});
