import { describe, expect, it } from 'vitest';
import { createCooldownPress } from '../../../lib/press';
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

describe('a dash that lands', () => {
  // dash once, then press again `early` seconds before the cooldown is over
  const again = (early) => {
    const s = newRush(PONY);
    const p = s.players[0];
    const press = createCooldownPress();
    const dt = 1 / 60;
    press.press();
    movePlayer(s, p, { x: 1, z: 0, press }, dt);
    const first = p.cool;
    let t = dt;
    let pressed = false;
    let dashes = 0;
    while (t < first + 0.5) {
      if (!pressed && t >= first - early) {
        press.press();
        pressed = true;
      }
      const cool = p.cool;
      movePlayer(s, p, { x: 1, z: 0, press }, dt);
      if (p.cool > cool) dashes++;
      t += dt;
    }
    return dashes;
  };

  it('goes as the cooldown ends when pressed a moment before', () => {
    expect(again(0.05)).toBe(1);
  });

  it('is let go when pressed too long before', () => {
    expect(again(0.3)).toBe(0);
  });

  it('dashes at once when it’s ready, and once a press', () => {
    const s = newRush(PONY);
    const p = s.players[0];
    const press = createCooldownPress();
    press.press();
    movePlayer(s, p, { x: 1, z: 0, press }, 1 / 60);
    expect(p.dash).toBeGreaterThan(0);
    const cool = p.cool;
    movePlayer(s, p, { x: 1, z: 0, press }, 1 / 60);
    expect(p.cool).toBeLessThan(cool);
  });
});

describe('the walk’s ease', () => {
  it('gets up to speed as fast at 30 or 120 frames a second as at 60', () => {
    const after = (hz) => {
      const s = newRush(PONY);
      const p = s.players[0];
      for (let i = 0; i < hz * 0.1; i++) movePlayer(s, p, { x: 1, z: 0 }, 1 / hz);
      return p.vx;
    };
    expect(Math.abs(after(30) - after(60)) / after(60)).toBeLessThan(0.01);
    expect(Math.abs(after(120) - after(60)) / after(60)).toBeLessThan(0.01);
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
    expect(dishOf(p.held, PONY)).toBe('stew');
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

describe('Rivendell’s kitchen', () => {
  // (imported here, so the Pony's tests above stand alone)
  it('makes mushroom soup and pours wine, its own way', async () => {
    const { RIVENDELL } = await import('./levels/rivendell');
    const s = newRush({ ...RIVENDELL, orders: { ...RIVENDELL.orders, first: 1e9 } });
    s.orders.push({ id: 1, dish: 'soup', t: 80, of: 80 }, { id: 2, dish: 'wine', t: 50, of: 50 });
    const p = s.players[0];
    // two mushrooms and a herb, chopped, into the cauldron (across the bridge)
    for (const crate of [1, 1, 2]) {
      stand(p, crate, 1, 'N');
      grab(s, p);
      expect(['mushroom', 'herb']).toContain(p.held.k);
      stand(p, 3, 1, 'N');
      grab(s, p);
      workFor(s, p, 1.6);
      grab(s, p);
      expect(p.held.s).toBe('chopped');
      stand(p, 8, 1, 'N');
      grab(s, p);
    }
    expect(s.spots['8,0'].s).toBe('cooking');
    run(s, RIVENDELL.times.cook + 0.1);
    stand(p, 1, 6, 'W');
    grab(s, p);
    stand(p, 8, 1, 'N');
    grab(s, p);
    expect(p.held).toEqual({ k: 'bowl', s: 'soup' });
    expect(dishOf(p.held, RIVENDELL)).toBe('soup');
    stand(p, 3, 6, 'S');
    expect(grab(s, p)[0]).toMatchObject({ type: 'served', dish: 'soup' });
    // a goblet of wine from the cask
    stand(p, 1, 5, 'W');
    grab(s, p);
    expect(p.held).toEqual({ k: 'goblet', s: 'clean' });
    stand(p, 10, 2, 'E');
    grab(s, p);
    run(s, RIVENDELL.times.fill + 0.1);
    grab(s, p);
    expect(p.held).toEqual({ k: 'goblet', s: 'wine' });
    stand(p, 7, 6, 'S');
    expect(grab(s, p)[0]).toMatchObject({ type: 'served', dish: 'wine' });
    run(s, RIVENDELL.times.back + 0.1);
    expect(s.spots['2,7']).toEqual({ goblet: 1, bowl: 1 });
  });

  it('can’t be waded across: only the bridges cross the stream', async () => {
    const { RIVENDELL } = await import('./levels/rivendell');
    const s = newRush(RIVENDELL);
    const p = s.players[0];
    stand(p, 3, 3, 'E'); // beside the stream, between the bridges
    for (let i = 0; i < 60; i++) movePlayer(s, p, { x: 1, z: 0 }, 0.05);
    expect(p.x).toBeLessThanOrEqual(5 - 0.3 + 1e-6);
    stand(p, 3, 2, 'E'); // on the bridge's row
    for (let i = 0; i < 60; i++) movePlayer(s, p, { x: 1, z: 0 }, 0.05);
    expect(p.x).toBeGreaterThan(8);
    expect(s.spots['5,3']).toBeUndefined(); // (the water's no station)
  });
});

describe('Moria’s forges', () => {
  it('casts mithril in a mould, forges an axe (and ruins one left too long)', async () => {
    const { MORIA } = await import('./levels/moria');
    const s = newRush({ ...MORIA, orders: { ...MORIA.orders, first: 1e9 } });
    s.orders.push({ id: 1, dish: 'mithril', t: 90, of: 90 }, { id: 2, dish: 'axe', t: 60, of: 60 });
    const p = s.players[0];
    for (let n = 0; n < 3; n++) {
      stand(p, 1, 1, 'N');
      grab(s, p); // ore
      stand(p, 4, 1, 'N');
      grab(s, p); // on the anvil
      workFor(s, p, MORIA.times.chop + 0.1);
      grab(s, p);
      expect(p.held).toEqual({ k: 'ore', s: 'chopped' });
      stand(p, 7, 1, 'N');
      grab(s, p); // into the crucible
    }
    run(s, MORIA.times.cook + 0.1);
    expect(s.spots['7,0'].s).toBe('done');
    // a mould from the near side, over the bridge, under the crucible
    stand(p, 1, 5, 'W');
    grab(s, p);
    expect(p.held).toEqual({ k: 'mould', s: 'clean' });
    stand(p, 7, 1, 'N');
    grab(s, p);
    expect(p.held).toEqual({ k: 'mould', s: 'mithril' });
    stand(p, 4, 6, 'S');
    expect(grab(s, p)[0]).toMatchObject({ type: 'served', dish: 'mithril' });
    // iron to the forge: an axe, then (left) ruined
    stand(p, 1, 1, 'W');
    grab(s, p);
    expect(p.held).toEqual({ k: 'iron', s: 'raw' });
    stand(p, 10, 1, 'N');
    grab(s, p);
    run(s, MORIA.times.bake + 0.1);
    expect(s.spots['10,0'].item).toEqual({ k: 'axe', s: 'forged' });
    const ev = run(s, MORIA.times.char + 0.1);
    expect(s.spots['10,0'].item).toEqual({ k: 'axe', s: 'ruined' });
    expect(ev.some((e) => e.type === 'burnt' && e.k === 'axe')).toBe(true);
  });

  it('can’t be walked across the molten channel but on the bridges', async () => {
    const { MORIA } = await import('./levels/moria');
    const s = newRush(MORIA);
    const p = s.players[0];
    stand(p, 5, 2, 'S');
    for (let i = 0; i < 60; i++) movePlayer(s, p, { x: 0, z: 1 }, 0.05);
    expect(p.z).toBeLessThanOrEqual(3 - 0.3 + 1e-6);
    stand(p, 3, 2, 'S');
    for (let i = 0; i < 60; i++) movePlayer(s, p, { x: 0, z: 1 }, 0.05);
    expect(p.z).toBeGreaterThan(5);
  });
});

describe('Lothlórien’s gifts', () => {
  it('bakes lembas and wraps it in leaves, spins rope, fills a phial', async () => {
    const { LORIEN } = await import('./levels/lorien');
    const s = newRush({ ...LORIEN, orders: { ...LORIEN.orders, first: 1e9 } });
    s.orders.push({ id: 1, dish: 'lembas', t: 80, of: 80 }, { id: 2, dish: 'rope', t: 60, of: 60 }, { id: 3, dish: 'phial', t: 55, of: 55 });
    const p = s.players[0];
    // lembas: dough, over the bridge to the oven, then to a leaf table
    stand(p, 2, 1, 'N');
    grab(s, p);
    expect(p.held).toEqual({ k: 'dough', s: 'raw' });
    stand(p, 9, 1, 'N');
    grab(s, p);
    run(s, LORIEN.times.bake + 0.1);
    grab(s, p);
    expect(p.held).toEqual({ k: 'lembas', s: 'baked' });
    stand(p, 10, 1, 'E');
    grab(s, p); // on the leaf table
    workFor(s, p, LORIEN.times.wrap + 0.1);
    grab(s, p);
    expect(p.held).toEqual({ k: 'lembas', s: 'wrapped' });
    stand(p, 9, 6, 'S');
    expect(grab(s, p)[0]).toMatchObject({ type: 'served', dish: 'lembas' });
    // rope: fibre spun on the wheel
    stand(p, 1, 1, 'N');
    grab(s, p);
    stand(p, 4, 1, 'N');
    grab(s, p);
    workFor(s, p, LORIEN.times.chop + 0.1);
    grab(s, p);
    expect(p.held).toEqual({ k: 'fibre', s: 'chopped' });
    stand(p, 3, 6, 'S');
    expect(grab(s, p)[0]).toMatchObject({ type: 'served', dish: 'rope' });
    // a phial, filled at the fountain
    stand(p, 1, 4, 'W');
    grab(s, p);
    stand(p, 10, 3, 'E');
    grab(s, p);
    run(s, LORIEN.times.fill + 0.1);
    grab(s, p);
    expect(p.held).toEqual({ k: 'phial', s: 'light' });
    stand(p, 10, 6, 'S');
    expect(grab(s, p)[0]).toMatchObject({ type: 'served', dish: 'phial' });
    // and a lembas left in the oven burns; a burnt one won't wrap
    s.spots['10,0'].item = { k: 'lembas', s: 'baked' };
    run(s, LORIEN.times.char + 0.1);
    expect(s.spots['10,0'].item.s).toBe('burnt');
    s.spots['11,2'].item = { k: 'lembas', s: 'burnt' };
    stand(p, 10, 2, 'E');
    p.held = null;
    expect(work(s, p, 2)).toEqual([]);
  });
});

describe('Supper at Parth Galen', () => {
  it('catches fish off the rocks, grills them, makes chowder, fills a waterskin', async () => {
    const { AMON_HEN } = await import('./levels/amonhen');
    const T = AMON_HEN.times;
    const s = newRush(quiet(AMON_HEN));
    s.orders.push({ id: 1, dish: 'fish', t: 60, of: 60 }, { id: 2, dish: 'chowder', t: 85, of: 85 }, { id: 3, dish: 'water', t: 45, of: 45 });
    const p = s.players[0];
    const fishAt = (i) => {
      stand(p, i, 6, 'S');
      const ev = workFor(s, p, T.fish + 0.1);
      expect(ev.filter((e) => e.type === 'caught')).toHaveLength(1);
      grab(s, p);
      expect(p.held).toEqual({ k: 'fish', s: 'raw' });
    };
    const chop = () => {
      stand(p, 4, 1, 'N');
      grab(s, p);
      workFor(s, p, T.chop + 0.1);
      grab(s, p);
    };
    // the line: held till one bites, not before; and nothing goes back on it
    stand(p, 1, 6, 'S');
    expect(workFor(s, p, T.fish * 0.5).some((e) => e.type === 'caught')).toBe(false);
    expect(workFor(s, p, T.fish * 0.5 + 0.1).filter((e) => e.type === 'caught')).toHaveLength(1);
    grab(s, p);
    expect(p.held).toEqual({ k: 'fish', s: 'raw' });
    expect(grab(s, p)[0].type).toBe('nope');
    // grilled on the spit, out to the boats
    stand(p, 1, 2, 'W');
    grab(s, p);
    run(s, T.bake + 0.1);
    grab(s, p);
    expect(p.held).toEqual({ k: 'skewer', s: 'grilled' });
    stand(p, 3, 6, 'S');
    expect(grab(s, p)[0]).toMatchObject({ type: 'served', dish: 'fish' });
    // chowder: a fish and two herbs, chopped, in the pot
    fishAt(10);
    chop();
    expect(p.held).toEqual({ k: 'fish', s: 'chopped' });
    stand(p, 7, 1, 'N');
    grab(s, p);
    for (let n = 0; n < 2; n++) {
      stand(p, 1, 1, 'N');
      grab(s, p);
      chop();
      stand(p, 7, 1, 'N');
      grab(s, p);
    }
    expect(s.spots['7,0'].s).toBe('cooking');
    run(s, T.cook + 0.1);
    stand(p, 10, 1, 'N');
    grab(s, p);
    stand(p, 7, 1, 'N');
    grab(s, p);
    expect(p.held).toEqual({ k: 'bowl', s: 'chowder' });
    stand(p, 4, 6, 'S');
    expect(grab(s, p)[0]).toMatchObject({ type: 'served', dish: 'chowder' });
    // a waterskin, filled at the spring
    stand(p, 1, 5, 'W');
    grab(s, p);
    stand(p, 10, 3, 'E');
    grab(s, p);
    run(s, T.fill + 0.1);
    grab(s, p);
    expect(p.held).toEqual({ k: 'skin', s: 'water' });
    stand(p, 7, 6, 'S');
    expect(grab(s, p)[0]).toMatchObject({ type: 'served', dish: 'water' });
    // the bowl and the skin come back to be washed
    run(s, T.back + 0.1);
    expect(s.spots['11,6']).toEqual({ bowl: 1, skin: 1 });
    // and a fish left on the spit chars, and goes in the bin
    s.spots['0,3'].item = { k: 'skewer', s: 'grilled' };
    run(s, T.char + 0.1);
    expect(s.spots['0,3'].item.s).toBe('charred');
    stand(p, 1, 3, 'W');
    grab(s, p);
    stand(p, 10, 5, 'E');
    expect(grab(s, p)[0]).toMatchObject({ type: 'bin' });
    expect(p.held).toBe(null);
  });
});

describe('the Long-expected Party', () => {
  it('grows mushrooms in the patch, fries them, and bakes seed-cake in the same ovens', async () => {
    const { PARTY } = await import('./levels/party');
    const T = PARTY.times;
    const s = newRush(quiet(PARTY));
    s.orders.push({ id: 1, dish: 'mushrooms', t: 55, of: 55 }, { id: 2, dish: 'cake', t: 70, of: 70 });
    const p = s.players[0];
    // the patch: nothing to pick till it's up, and nothing goes back in it
    stand(p, 1, 1, 'W');
    expect(grab(s, p)).toEqual([]);
    expect(run(s, T.grow + 0.1).filter((e) => e.type === 'grown').length).toBeGreaterThanOrEqual(1);
    grab(s, p);
    expect(p.held).toEqual({ k: 'mushroom', s: 'raw' });
    expect(grab(s, p)[0].type).toBe('nope');
    // the pan, then out
    stand(p, 4, 1, 'N');
    grab(s, p);
    run(s, T.bake + 0.1);
    grab(s, p);
    expect(p.held).toEqual({ k: 'skillet', s: 'fried' });
    stand(p, 3, 6, 'S');
    expect(grab(s, p)[0]).toMatchObject({ type: 'served', dish: 'mushrooms' });
    // the same ovens bake the cake
    stand(p, 1, 1, 'N');
    grab(s, p);
    stand(p, 5, 1, 'N');
    grab(s, p);
    run(s, T.bake + 0.1);
    grab(s, p);
    expect(p.held).toEqual({ k: 'cake', s: 'baked' });
    stand(p, 8, 6, 'S');
    expect(grab(s, p)[0]).toMatchObject({ type: 'served', dish: 'cake' });
    // and a cake left in burns
    s.spots['6,0'].item = { k: 'cake', s: 'baked' };
    run(s, T.char + 0.1);
    expect(s.spots['6,0'].item.s).toBe('burnt');
  });
});

describe('Supper on Weathertop', () => {
  it('cooks only while the fire is fed, and wood brings it back', async () => {
    const { WEATHERTOP } = await import('./levels/weathertop');
    const T = WEATHERTOP.times;
    const F = WEATHERTOP.fuel;
    const s = newRush(quiet(WEATHERTOP));
    const p = s.players[0];
    // a sausage on the spit: it cooks while the fire burns, and the fire burns down
    expect(s.spots['4,2'].fuel).toBe(1);
    s.spots['4,2'].item = { k: 'sausage', s: 'raw' };
    run(s, T.bake + 0.1);
    expect(s.spots['4,2'].item).toEqual({ k: 'banger', s: 'grilled' });
    expect(s.spots['4,2'].fuel).toBeLessThan(1);
    // an idle fire doesn't burn down
    const idle = s.spots['7,2'].fuel;
    run(s, 5);
    expect(s.spots['7,2'].fuel).toBe(idle);
    // let one go out: what's on it stops, and says so
    s.spots['4,2'].item = { k: 'sausage', s: 'raw' };
    s.spots['4,2'].fuel = 0.01;
    const ev = run(s, 1);
    expect(ev.filter((e) => e.type === 'out')).toHaveLength(1);
    const was = s.spots['4,2'].prog;
    run(s, T.bake + 1);
    expect(s.spots['4,2'].item).toEqual({ k: 'sausage', s: 'raw' });
    expect(s.spots['4,2'].prog).toBe(was);
    // wood on it, and it's back
    stand(p, 1, 1, 'W');
    grab(s, p);
    expect(p.held).toEqual({ k: 'wood', s: 'raw' });
    stand(p, 4, 1, 'S');
    expect(grab(s, p)[0].type).toBe('stoked');
    expect(s.spots['4,2'].fuel).toBeCloseTo(F.load);
    expect(p.held).toBe(null);
    run(s, T.bake + 0.1);
    expect(s.spots['4,2'].item.k).toBe('banger');
    // the pans too: a fry-up of three, chopped, on a plate
    for (const k of ['tomato', 'sausage', 'tomato']) {
      p.held = { k, s: 'chopped' };
      stand(p, 7, 1, 'N');
      grab(s, p);
    }
    expect(s.spots['7,0'].s).toBe('cooking');
    run(s, T.cook + 0.1);
    p.held = { k: 'plate', s: 'clean' };
    grab(s, p);
    expect(p.held).toEqual({ k: 'plate', s: 'fryup' });
    // tea from the kettle
    p.held = { k: 'mug', s: 'clean' };
    stand(p, 10, 1, 'E');
    grab(s, p);
    run(s, T.fill + 0.1);
    grab(s, p);
    expect(p.held).toEqual({ k: 'mug', s: 'tea' });
  });
});

describe('Herbs and stewed rabbit', () => {
  it('Sméagol creeps up for a coney, is shooed off by a hobbit, or takes it', async () => {
    const { ITHILIEN } = await import('./levels/ithilien');
    const th = ITHILIEN.thief;
    const s = newRush(quiet(ITHILIEN));
    const p = s.players[0];
    stand(p, 9, 6, 'S'); // well away
    s.spots['4,2'].item = { k: 'coney', s: 'raw' };
    s.spots['7,3'].item = { k: 'potato', s: 'raw' }; // (he doesn't want taters)
    // nothing till he's due
    expect(run(s, th.first - 1).some((e) => e.type === 'sneak')).toBe(false);
    const ev = run(s, 1.2);
    expect(ev.filter((e) => e.type === 'sneak')).toEqual([expect.objectContaining({ at: [4, 2] })]);
    // left alone, it's gone
    const gone = run(s, th.warn + 0.1);
    expect(gone.filter((e) => e.type === 'stolen')).toEqual([expect.objectContaining({ at: [4, 2], k: 'coney' })]);
    expect(s.spots['4,2'].item).toBe(null);
    expect(s.spots['7,3'].item).toEqual({ k: 'potato', s: 'raw' });
    // next time a hobbit gets there first
    s.spots['4,3'].item = { k: 'coney', s: 'chopped' };
    let creep = [];
    for (let n = 0; n < 40 && !creep.length; n++) creep = run(s, 1).filter((e) => e.type === 'sneak');
    expect(creep[0].at).toEqual([4, 3]);
    stand(p, 3, 3, 'E');
    expect(run(s, 0.1).filter((e) => e.type === 'shooed')).toHaveLength(1);
    expect(s.spots['4,3'].item).toEqual({ k: 'coney', s: 'chopped' });
    // and he never tries one with a hobbit standing by it
    s.sneak = null;
    s.nextSteal = s.t;
    expect(run(s, 1).some((e) => e.type === 'sneak')).toBe(false);
  });

  it('stews coney with herbs and taters, and roasts it', async () => {
    const { ITHILIEN } = await import('./levels/ithilien');
    const T = ITHILIEN.times;
    const s = newRush(quiet({ ...ITHILIEN, thief: null }));
    const p = s.players[0];
    for (const k of ['coney', 'herb', 'potato']) {
      p.held = { k, s: 'chopped' };
      stand(p, 7, 1, 'N');
      grab(s, p);
    }
    run(s, T.cook + 0.1);
    p.held = { k: 'bowl', s: 'clean' };
    grab(s, p);
    expect(p.held).toEqual({ k: 'bowl', s: 'stew' });
    p.held = { k: 'coney', s: 'raw' };
    stand(p, 1, 3, 'W');
    grab(s, p);
    run(s, T.bake + 0.1);
    grab(s, p);
    expect(p.held).toEqual({ k: 'roast', s: 'roasted' });
  });
});

describe('the orcs’ mess', () => {
  it('webs underfoot slow a hobbit down, dash and all', async () => {
    const { TOWER } = await import('./levels/tower');
    const s = newRush(quiet(TOWER));
    const p = s.players[0];
    const pace = (x, z) => {
      Object.assign(p, { x, z, vx: 0, vz: 0, dash: 0, cool: 0 });
      for (let n = 0; n < 10; n++) movePlayer(s, p, { x: 1, z: 0 }, 0.05);
      return p.x - x;
    };
    const clear = pace(6.2, 4.5); // along row 4's clear floor
    const webbed = pace(3.2, 2.5); // into row 2's webs
    expect(webbed).toBeLessThan(clear * 0.6);
    // and you can walk on them (they're floor, not counters)
    expect(parseLevel(TOWER).at(4, 2)).toBe(',');
    expect(facingTile(s, Object.assign(p, { x: 3.5, z: 2.5, face: 0 }))).toBe(null);
  });
});

describe('the feast at Cormallen', () => {
  it('puts a platter together on the carving table, one of each part', async () => {
    const { CORMALLEN } = await import('./levels/cormallen');
    const T = CORMALLEN.times;
    const s = newRush(quiet(CORMALLEN));
    s.orders.push({ id: 1, dish: 'feast', t: 95, of: 95 });
    const p = s.players[0];
    // the ovens: a roast, and bread
    s.spots['4,0'].item = { k: 'meat', s: 'raw' };
    s.spots['5,0'].item = { k: 'dough', s: 'raw' };
    run(s, T.bake + 0.1);
    expect(s.spots['4,0'].item).toEqual({ k: 'roast', s: 'roasted' });
    expect(s.spots['5,0'].item).toEqual({ k: 'loaf', s: 'baked' });
    stand(p, 3, 2, 'E');
    p.held = { k: 'roast', s: 'roasted' };
    expect(grab(s, p)[0]).toMatchObject({ type: 'put', k: 'roast' });
    // not two of the same, nor something raw, nor anything not on the list
    p.held = { k: 'roast', s: 'roasted' };
    expect(grab(s, p)[0].type).toBe('nope');
    p.held = { k: 'herb', s: 'raw' };
    expect(grab(s, p)[0].type).toBe('nope');
    p.held = { k: 'goblet', s: 'wine' };
    expect(grab(s, p)[0].type).toBe('nope');
    // a part taken back off, and put on again
    p.held = { k: 'loaf', s: 'baked' };
    grab(s, p);
    p.held = null;
    grab(s, p);
    expect(p.held).toEqual({ k: 'loaf', s: 'baked' });
    grab(s, p);
    p.held = { k: 'herb', s: 'chopped' };
    const ev = grab(s, p);
    expect(ev.map((e) => e.type)).toEqual(['put', 'plated']);
    expect(s.spots['4,2']).toMatchObject({ item: { k: 'platter', s: 'feast' }, parts: [] });
    grab(s, p);
    expect(p.held).toEqual({ k: 'platter', s: 'feast' });
    stand(p, 3, 6, 'S');
    expect(grab(s, p)[0]).toMatchObject({ type: 'served', dish: 'feast' });
  });
});
