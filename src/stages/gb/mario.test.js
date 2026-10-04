import { describe, expect, it } from 'vitest';
import { newMario, stepMario } from './mario';

const T = 8;
const input = (held = {}, pressed = []) => ({ pressed: new Set(pressed), ...held });
const none = () => input();
const run = (g, secs, inp = none, dt = 1 / 60) => {
  for (let t = 0; t < secs && g.mode === 'play'; t += dt) stepMario(g, dt, inp());
};
const playing = (course = 0) => {
  const g = newMario({ course });
  g.mode = 'play';
  return g;
};
const clearArea = (g, c0, c1, r0 = 2, r1 = 15) => {
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) g.grid[r][c] = '.';
};
const solidAt = (g, x, y) => '#BHM?U[]()=*'.includes(g.grid[Math.floor(y / T)]?.[Math.floor(x / T)] ?? '.');
const inWall = (g) => {
  const p = g.p;
  for (const x of [p.x + 1, p.x + p.w / 2, p.x + p.w - 1]) for (const y of [p.y + 1, p.y + p.h / 2, p.y + p.h - 1]) if (solidAt(g, x, y)) return true;
  return false;
};
const walker = (g, x, y) => {
  g.walkers.push({ x, y, vx: -22, vy: 0, alive: true, flat: 0 });
  return g.walkers[g.walkers.length - 1];
};

describe('super tilak land', () => {
  it('lands on a one-tile ledge from any height, even on slow frames', () => {
    for (let off = 0; off < 16; off++) {
      const g = playing();
      clearArea(g, 0, 12);
      g.walkers = [];
      for (let c = 2; c <= 6; c++) g.grid[10][c] = 'H';
      const p = g.p;
      p.x = 30;
      p.y = 10 * T - p.h - 30 - off;
      p.vy = 300;
      run(g, 0.6, none, 0.05);
      expect(p.y + p.h, `dropped from ${30 + off}px above`).toBe(10 * T);
    }
  });

  it('runs and jumps', () => {
    const g = playing();
    clearArea(g, 0, 30);
    g.walkers = [];
    const x0 = g.p.x;
    run(g, 0.5, () => input({ right: true }));
    expect(g.p.x).toBeGreaterThan(x0 + 20);
    stepMario(g, 1 / 60, input({ a: true }));
    run(g, 0.15, () => input({ a: true }));
    expect(g.p.y).toBeLessThan(16 * T - g.p.h - 16);
  });

  it('hops off the flagpole and walks to the castle, never through the base', () => {
    const g = playing();
    const p = g.p;
    p.x = g.flagX - p.w - 4;
    p.y = 15 * T - p.h - 12;
    g.cam = Math.max(0, p.x - 64);
    p.vx = 60;
    for (let i = 0; i < 600 && g.mode !== 'clear'; i++) {
      stepMario(g, 1 / 60, input({ right: true }));
      if (g.mode === 'walk') expect(inWall(g)).toBe(false);
    }
    expect(g.mode).toBe('clear');
  });

  it('gives a big plumber a fire flower from a mushroom block', () => {
    const g = playing();
    clearArea(g, 0, 12);
    g.walkers = [];
    g.big = true;
    const p = g.p;
    p.h = 23;
    p.x = 36;
    p.y = 16 * T - p.h;
    g.grid[11][5] = 'M';
    p.vy = -260;
    p.onGround = false;
    run(g, 0.5);
    const flower = g.items.find((it) => it.kind === 'flower');
    expect(flower).toBeTruthy();
    // pick it up
    p.x = flower.x;
    p.y = flower.y;
    run(g, 0.05);
    expect(g.fire).toBe(true);
  });

  it('throws fireballs with B (two at most) that bounce along and stop a walker', () => {
    const g = playing();
    clearArea(g, 0, 30);
    g.walkers = [];
    g.big = true;
    g.fire = true;
    g.p.h = 23;
    g.p.y = 16 * T - g.p.h;
    g.p.face = 1;
    const w = walker(g, g.p.x + 70, 15 * T);
    stepMario(g, 1 / 60, input({}, ['b']));
    stepMario(g, 1 / 60, input({}, ['b']));
    stepMario(g, 1 / 60, input({}, ['b']));
    expect(g.fireballs.length).toBe(2);
    run(g, 1.2);
    expect(w.alive).toBe(false);
  });

  it('steps down from fire to big, not small, when hit', () => {
    const g = playing();
    clearArea(g, 0, 30);
    g.walkers = [];
    g.big = true;
    g.fire = true;
    g.p.h = 23;
    g.p.y = 16 * T - g.p.h;
    walker(g, g.p.x + 4, 15 * T);
    run(g, 0.05);
    expect(g.fire).toBe(false);
    expect(g.big).toBe(true);
  });

  it('pays more for each stomp in a chain before landing', () => {
    const g = playing();
    clearArea(g, 0, 30);
    g.walkers = [];
    const p = g.p;
    const stomp = () => {
      walker(g, p.x, p.y + p.h - 2);
      p.vy = 120;
      const s = g.score;
      stepMario(g, 1 / 60, none());
      return g.score - s;
    };
    p.y = 60;
    const first = stomp();
    const second = stomp();
    const third = stomp();
    expect(first).toBe(100);
    expect(second).toBe(200);
    expect(third).toBe(400);
  });

  it('lets a starred plumber run through enemies', () => {
    const g = playing();
    clearArea(g, 0, 30);
    g.walkers = [];
    g.star = 5;
    g.p.y = 16 * T - g.p.h;
    const w = walker(g, g.p.x + 4, 15 * T);
    run(g, 0.05);
    expect(w.alive).toBe(false);
    expect(g.p.dead).toBe(false);
  });

  it('puts a star in a block on the first course', () => {
    const g = playing(0);
    expect(g.grid.some((row) => row.includes('*'))).toBe(true);
  });

  it('guards the castle bridge with a fire-breathing king', () => {
    const g = playing(3);
    expect(g.boss).toBeTruthy();
    const b = g.boss;
    g.p.x = b.x - 70;
    g.p.y = 13 * T - g.p.h;
    g.cam = Math.max(0, Math.min(g.cols * T - 160, g.p.x - 64));
    g.p.inv = 99;
    run(g, 4);
    expect(g.flames.length + g.flamesFired).toBeGreaterThan(0);
  });

  it('takes five fireballs to bring the king down', () => {
    const g = playing(3);
    const b = g.boss;
    g.cam = Math.max(0, Math.min(g.cols * T - 160, b.x - 64));
    g.p.x = b.x - 60;
    g.p.y = 13 * T - g.p.h; // on the bridge, not in the lava under it
    g.p.inv = 99;
    for (let i = 0; i < 5; i++) {
      expect(b.dead).toBe(false);
      g.fireballs.push({ x: b.x + 2, y: b.y + 6, vx: 150, vy: 0, life: 2 });
      stepMario(g, 1 / 60, none());
      b.hurt = 0;
    }
    expect(b.dead).toBe(true);
  });

  it('can be beaten in play: a fire plumber throwing from the bridge brings the king down', () => {
    const g = playing(3);
    const b = g.boss;
    g.big = true;
    g.fire = true;
    g.p.h = 23;
    g.p.x = b.x - 60;
    g.p.y = 13 * T - g.p.h;
    g.p.face = 1;
    g.cam = Math.max(0, Math.min(g.cols * T - 160, g.p.x - 64));
    for (let i = 0; i < 600 && !b.dead; i++) {
      g.p.inv = 99; // his fire can't knock the flower's power away mid-test
      stepMario(g, 1 / 60, input({}, i % 15 === 0 ? ['b'] : []));
    }
    expect(b.dead).toBe(true);
  });

  it('drops the king into the lava when the axe is pulled', () => {
    const g = playing(3);
    const b = g.boss;
    const before = g.score;
    g.p.x = g.axe.x;
    g.p.y = g.axe.y;
    g.cam = Math.max(0, Math.min(g.cols * T - 160, g.p.x - 64));
    stepMario(g, 1 / 60, none());
    expect(g.mode).toBe('bridge');
    for (let i = 0; i < 120; i++) stepMario(g, 1 / 60, none());
    expect(b.dead).toBe(true);
    expect(g.score).toBeGreaterThanOrEqual(before + 5000);
  });

  it('keeps the best score when the game ends', () => {
    const g = newMario({ best: 100 });
    g.mode = 'play';
    g.lives = 1;
    g.score = 4200;
    g.p.y = 300;
    for (let i = 0; i < 400 && g.mode === 'play'; i++) stepMario(g, 1 / 60, none());
    expect(g.mode).toBe('over');
    expect(g.best).toBe(4200);
  });
});
