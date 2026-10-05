import { describe, expect, it } from 'vitest';
import { PONY } from './levels/pony';
import { dishOf, facingTile, grab, movePlayer, newRush, parseLevel, starsOf, stepRush, work } from './rules';

// stand a hobbit on floor tile (i, j), facing a side: 'N' (−z), 'S', 'E' (+x), 'W'
const FACE = { E: 0, N: Math.PI / 2, W: Math.PI, S: -Math.PI / 2 };
const stand = (p, i, j, f) => Object.assign(p, { x: i + 0.5, z: j + 0.5, face: FACE[f], vx: 0, vz: 0 });
const quiet = (lvl = PONY) => ({ ...lvl, orders: { ...lvl.orders, first: 1e9 } }); // no orders unless asked
const run = (s, secs, step = 0.05) => {
  const ev = [];
  for (let t = 0; t < secs - 1e-9; t += step) ev.push(...stepRush(s, step));
  return ev;
};
const workFor = (s, p, secs) => {
  p.work = true;
  const ev = run(s, secs);
  p.work = false;
  return ev;
};

describe('the level', () => {
  it('parses, and every station can be reached from the floor', () => {
    const g = parseLevel(PONY);
    expect([g.W, g.D]).toEqual([12, 8]);
    const s = newRush(PONY);
    const reach = (i, j) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => g.at(i + a, j + b) === '.');
    for (const k of Object.keys(s.spots)) {
      const [i, j] = k.split(',').map(Number);
      const c = g.at(i, j);
      if (c !== '#') expect(reach(i, j), `${c} at ${k}`).toBe(true);
    }
    for (const [i, j] of PONY.spawn) expect(g.at(i, j)).toBe('.');
  });
});

describe('walking', () => {
  it('walks, and stops at a counter', () => {
    const s = newRush(PONY);
    const p = s.players[0];
    stand(p, 5, 2, 'S');
    for (let i = 0; i < 40; i++) movePlayer(s, p, { x: 0, z: 1 }, 0.05);
    // the island's top edge is z = 3
    expect(p.z).toBeLessThanOrEqual(3 - 0.3 + 1e-6);
    expect(p.z).toBeGreaterThan(2.6);
    expect(p.face).toBeCloseTo(-Math.PI / 2);
  });

  it('dashes further than it walks', () => {
    const s = newRush(PONY);
    const [a, b] = [newRush(PONY).players[0], s.players[0]];
    stand(a, 1, 1, 'E');
    stand(b, 1, 1, 'E');
    for (let i = 0; i < 6; i++) {
      movePlayer(s, a, { x: 1, z: 0 }, 0.05);
      movePlayer(s, b, { x: 1, z: 0, dash: i === 0 }, 0.05);
    }
    expect(b.x - a.x).toBeGreaterThan(0.6);
  });

  it('shoulders past another hobbit rather than through him', () => {
    const s = newRush(PONY, { players: 2 });
    const [a, b] = s.players;
    stand(a, 2, 1, 'E');
    stand(b, 4, 1, 'W');
    for (let i = 0; i < 30; i++) movePlayer(s, a, { x: 1, z: 0 }, 0.05, [b]);
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(0.6 - 1e-6);
  });

  it('faces the tile in front, and nothing across the floor', () => {
    const s = newRush(PONY);
    const p = s.players[0];
    stand(p, 1, 1, 'N');
    expect(facingTile(s, p)).toEqual([1, 0]); // the carrot crate
    stand(p, 2, 2, 'E');
    expect(facingTile(s, p)).toBe(null);
  });
});

describe('the Overcooked loop', () => {
  it('stew: crates, boards, the pot, a bowl, served', () => {
    const s = newRush(quiet(PONY));
    s.orders.push({ id: 1, dish: 'stew', t: 80, of: 80 });
    const p = s.players[0];
    for (let n = 0; n < 3; n++) {
      stand(p, 1, 1, 'N');
      grab(s, p); // a carrot
      expect(p.held).toEqual({ k: 'carrot', s: 'raw' });
      stand(p, 5, 1, 'N');
      grab(s, p); // on the board
      expect(p.held).toBe(null);
      workFor(s, p, 1.7);
      grab(s, p);
      expect(p.held).toEqual({ k: 'carrot', s: 'chopped' });
      stand(p, 7, 1, 'N');
      grab(s, p); // into the pot
    }
    expect(s.spots['7,0'].s).toBe('cooking');
    const ev = run(s, 9.1);
    expect(ev.some((e) => e.type === 'cooked')).toBe(true);
    stand(p, 1, 6, 'W');
    grab(s, p);
    expect(p.held).toEqual({ k: 'bowl', s: 'clean' });
    stand(p, 7, 1, 'N');
    grab(s, p);
    expect(dishOf(p.held)).toBe('stew');
    stand(p, 4, 6, 'S');
    const served = grab(s, p);
    expect(served[0].type).toBe('served');
    expect(s.coins).toBeGreaterThanOrEqual(PONY.prices.stew);
    expect(s.orders).toHaveLength(0);
    // and the bowl comes back dirty
    run(s, PONY.times.back + 0.1);
    expect(s.spots['2,7'].bowl).toBe(1);
  });

  it('a pot left on the fire burns, and has to be scraped', () => {
    const s = newRush(quiet(PONY));
    Object.assign(s.spots['7,0'], { n: 3, s: 'cooking', cook: 0 });
    const ev = run(s, PONY.times.cook + PONY.times.burn + 0.1);
    expect(ev.map((e) => e.type)).toEqual(expect.arrayContaining(['cooked', 'burnt']));
    const p = s.players[0];
    stand(p, 1, 6, 'W');
    grab(s, p);
    stand(p, 7, 1, 'N');
    expect(grab(s, p)[0].type).toBe('nope'); // no ladling burnt stew
    p.held = null;
    workFor(s, p, PONY.times.scrape + 0.1);
    expect(s.spots['7,0'].s).toBe('empty');
  });

  it('pints: a clean mug on the tap fills, and spills if it’s left', () => {
    const s = newRush(quiet(PONY));
    const p = s.players[0];
    stand(p, 1, 5, 'W');
    grab(s, p);
    expect(p.held).toEqual({ k: 'mug', s: 'clean' });
    expect(s.spots['0,5'].n).toBe(PONY.stock.mug - 1);
    stand(p, 10, 2, 'E');
    grab(s, p);
    run(s, PONY.times.fill + 0.1);
    expect(s.spots['11,2'].item.s).toBe('ale');
    run(s, PONY.times.spill + 0.1);
    expect(s.spots['11,2'].item.s).toBe('dirty');
  });

  it('bread bakes, and burns', () => {
    const s = newRush(quiet(PONY));
    const p = s.players[0];
    stand(p, 1, 1, 'W');
    grab(s, p);
    expect(p.held.k).toBe('dough');
    stand(p, 10, 1, 'N');
    grab(s, p);
    run(s, PONY.times.bake + 0.1);
    expect(s.spots['10,0'].item).toEqual({ k: 'loaf', s: 'baked' });
    run(s, PONY.times.char + 0.1);
    expect(s.spots['10,0'].item.s).toBe('burnt');
    grab(s, p);
    stand(p, 1, 3, 'W');
    grab(s, p); // the bin
    expect(p.held).toBe(null);
  });

  it('washing up: dirty in, scrub, clean out', () => {
    const s = newRush(quiet(PONY));
    s.spots['2,7'].mug = 1;
    const p = s.players[0];
    stand(p, 2, 6, 'S');
    grab(s, p);
    expect(p.held).toEqual({ k: 'mug', s: 'dirty' });
    stand(p, 8, 6, 'S');
    grab(s, p);
    expect(s.spots['8,7'].dirty).toEqual(['mug']);
    workFor(s, p, PONY.times.wash + 0.1);
    grab(s, p);
    expect(p.held).toEqual({ k: 'mug', s: 'clean' });
  });

  it('the tap takes only clean mugs, the oven only dough', () => {
    const s = newRush(quiet(PONY));
    const p = s.players[0];
    p.held = { k: 'carrot', s: 'raw' };
    stand(p, 10, 2, 'E');
    expect(grab(s, p)[0].type).toBe('nope');
    stand(p, 10, 1, 'N');
    expect(grab(s, p)[0].type).toBe('nope');
    expect(p.held.k).toBe('carrot');
  });

  it('the counter turns away a dish no one ordered', () => {
    const s = newRush(quiet(PONY));
    const p = s.players[0];
    p.held = { k: 'mug', s: 'ale' };
    stand(p, 4, 6, 'S');
    expect(grab(s, p)[0].type).toBe('nope');
    expect(p.held).toEqual({ k: 'mug', s: 'ale' });
  });
});

describe('orders and the clock', () => {
  it('orders come in, lapse, and cost coins', () => {
    const s = newRush(PONY);
    s.coins = 20;
    const ev = run(s, 2.1);
    expect(ev.filter((e) => e.type === 'order')).toHaveLength(1);
    const o = s.orders[0];
    o.t = 0.04;
    const ev2 = run(s, 0.05);
    expect(ev2.some((e) => e.type === 'lapsed')).toBe(true);
    expect(s.coins).toBe(20 - PONY.orders.lapse);
  });

  it('never more on the board than it holds', () => {
    const s = newRush(PONY);
    run(s, 120);
    expect(s.orders.length).toBeLessThanOrEqual(PONY.orders.max);
    expect(s.lapsed).toBeGreaterThan(0);
  });

  it('ends at the bell, with stars by the coins', () => {
    const s = newRush(PONY);
    s.coins = PONY.stars[1];
    const ev = run(s, PONY.time + 0.1, 0.5);
    expect(s.over).toBe(true);
    const end = ev.find((e) => e.type === 'end');
    expect(end).toBeTruthy();
    expect(starsOf(s)).toBe(end.stars);
    expect(stepRush(s, 1)).toEqual([]);
  });

  it('asks more of more hobbits', () => {
    const solo = newRush(PONY, { players: 1, seed: 7 });
    const four = newRush(PONY, { players: 4, seed: 7 });
    run(solo, 90);
    run(four, 90);
    expect(four.orderId).toBeGreaterThan(solo.orderId);
  });
});

describe('work', () => {
  it('needs empty hands', () => {
    const s = newRush(quiet(PONY));
    s.spots['5,0'].item = { k: 'potato', s: 'raw' };
    const p = s.players[0];
    stand(p, 5, 1, 'N');
    p.held = { k: 'carrot', s: 'raw' };
    expect(work(s, p, 1)).toEqual([]);
    p.held = null;
    work(s, p, 2);
    expect(s.spots['5,0'].item.s).toBe('chopped');
  });
});
