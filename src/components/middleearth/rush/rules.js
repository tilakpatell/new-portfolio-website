// The rush: a busy kitchen for one to four hobbits, in Overcooked's mould.
// Pure rules, no drawing and no network: the host's browser runs them for
// everyone (./net.js), a solo game runs them alone, and ./scene.js draws
// what they say.
//
// A level is a grid of one-metre tiles (./levels/*.js): floor ('.') to walk
// on, and counters and stations to work at. Positions are in tile units:
// x along a row (0 at the left), z down the rows (0 at the back wall), so
// tile (i, j) covers x i..i+1, z j..j+1. `face` turns +x to
// (cos face, −sin face), as in the walkable towns.
//
// Tiles: '#' counter, 'B' chopping board, 'P' pot, 'O' oven, 'T' tap (or
// cask), 'L' leaf table (to wrap things in), 'F' fishing line (held down
// till something bites), 'G' a patch where something grows (pick it when
// it's up), 'A' a carving table (a platter put together from its parts),
// 'W' wash tub, 'X' bin, 'S' serving counter, 'R' where dirty dishes come
// back, '.' floor, ',' floor that's webbed or mired (slow going), '~' water
// (not to be walked on), and the level's own crates and shelves (the
// Pony's: 'c' carrots, 'p' potatoes, 'd' dough, 'm' mugs, 'b' bowls).
// Anything else is wall.
//
// A level can also have fires to keep fed (`fuel`: its pots and ovens burn
// down, and cook nothing once they're out, till someone puts wood on), and
// a thief (`thief`: now and then he creeps up to a counter with something
// he likes on it, and takes it unless a hobbit gets there first).
//
// Things are { k, s }, of the kinds in KINDS. What a level's stations make
// is the level's to say (`crates`, `shelves`, `pot`, `oven`, `tap`,
// `dishes`, and `patch`, `line`, `wrap`, `platter` for the stations that
// need them); the Pony's are the defaults: stew of three chopped carrots or
// potatoes in a bowl, dough baked to a loaf, a mug filled with ale. An oven
// can have more than one recipe (a list), each by what goes in.

import { byFrame } from '../ease';

// every kind of thing, and what it can be (added to, never reordered: the
// wire counts on the order)
export const KINDS = {
  mug: ['clean', 'dirty', 'ale', 'tea'],
  bowl: ['clean', 'dirty', 'stew', 'soup', 'chowder'],
  carrot: ['raw', 'chopped'],
  potato: ['raw', 'chopped'],
  dough: ['raw'],
  loaf: ['baked', 'burnt'],
  goblet: ['clean', 'dirty', 'wine'],
  mushroom: ['raw', 'chopped'],
  herb: ['raw', 'chopped'],
  ore: ['raw', 'chopped'], // (crushed, at the forge)
  mould: ['clean', 'dirty', 'mithril'],
  iron: ['raw'],
  axe: ['forged', 'ruined'],
  lembas: ['baked', 'burnt', 'wrapped'],
  fibre: ['raw', 'chopped'], // (spun into rope, at the wheel)
  phial: ['clean', 'dirty', 'light'],
  fish: ['raw', 'chopped'],
  skewer: ['grilled', 'charred'], // (a fish on a stick, over the campfire)
  skin: ['clean', 'dirty', 'water'],
  cake: ['baked', 'burnt'],
  skillet: ['fried', 'burnt'], // (mushrooms, in the pan)
  wood: ['raw'],
  tomato: ['raw', 'chopped'],
  sausage: ['raw', 'chopped'],
  banger: ['grilled', 'burnt'], // (sausages on a stick, over the fire)
  plate: ['clean', 'dirty', 'fryup'],
  coney: ['raw', 'chopped'],
  roast: ['roasted', 'charred'],
  meat: ['raw', 'chopped'],
  platter: ['feast'],
};
const CONTAINER = (k) => KINDS[k]?.includes('dirty');
const CHOPS = (k) => KINDS[k]?.includes('chopped');
const PONY_RECIPES = {
  crates: { c: 'carrot', p: 'potato', d: 'dough' },
  shelves: { m: 'mug', b: 'bowl' },
  pot: { takes: ['carrot', 'potato'], need: 3, into: 'bowl', makes: 'stew' },
  oven: { takes: 'dough', makes: 'loaf' },
  tap: { into: 'mug', makes: 'ale' },
};
const PONY_DISHES = {
  pint: { k: 'mug', s: 'ale', back: 'mug' },
  stew: { k: 'bowl', s: 'stew', back: 'bowl' },
  bread: { k: 'loaf', s: 'baked', back: null },
};
// a level's recipes, with the Pony's where it doesn't say
export const recipesOf = (level) => ({ ...PONY_RECIPES, ...level?.recipes, dishes: Object.fromEntries(Object.entries(level?.dishes ?? PONY_DISHES).map(([d, x]) => [d, { ...PONY_DISHES[d], ...x }])) });
const HOLDS = new Set(['#', 'B', 'O', 'T', 'L', 'F', 'G', 'A']); // stations that hold one thing
const OPEN = new Set(['.', ',', 'x', '~']); // tiles with no station
const FLOOR = new Set(['.', ',']);
// the oven's recipe for a thing that goes in, or comes out
export const ovenFor = (R, k) => [R.oven].flat().find((o) => o.takes === k || o.makes === k) ?? null;
export const RADIUS = 0.3;

const key = (i, j) => `${i},${j}`;
export const dishOf = (item, level) => {
  if (!item) return null;
  const dishes = recipesOf(level).dishes;
  return Object.keys(dishes).find((d) => dishes[d].k === item.k && dishes[d].s === item.s) ?? null;
};

// mulberry32: the host's dice, kept in the state so a round can be replayed
function rand(s) {
  s.seed = (s.seed + 0x6d2b79f5) | 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// The level's grid, checked: every row as long as the first.
export function parseLevel(level) {
  const rows = level.tiles;
  const W = rows[0].length;
  const D = rows.length;
  for (const r of rows) if (r.length !== W) throw new Error(`level ${level.id}: rows of different lengths`);
  const at = (i, j) => (i < 0 || j < 0 || i >= W || j >= D ? 'x' : rows[j][i]);
  return { W, D, at };
}

const spotFor = (c, level, R) => {
  const fire = level.fuel && (c === 'P' || c === 'O') ? { fuel: 1 } : {};
  if (c === 'A') return { item: null, prog: 0, parts: [] };
  if (HOLDS.has(c)) return { item: null, prog: 0, ...fire };
  if (c === 'P') return { n: 0, cook: 0, s: 'empty', prog: 0, ...fire };
  if (c === 'W') return { dirty: [], clean: [], prog: 0 };
  if (R.shelves[c]) return { n: level.stock?.[R.shelves[c]] ?? 0 };
  if (c === 'R') return Object.fromEntries([...new Set(Object.values(R.shelves))].map((k) => [k, 0]));
  return {};
};

// A new round: `players` hobbits at the level's spawn tiles.
export function newRush(level, { players = 1, seed = 1 } = {}) {
  const g = parseLevel(level);
  const R = recipesOf(level);
  const spots = {};
  for (let j = 0; j < g.D; j++)
    for (let i = 0; i < g.W; i++) {
      const c = g.at(i, j);
      if (!OPEN.has(c)) spots[key(i, j)] = spotFor(c, level, R);
    }
  const n = Math.max(1, Math.min(4, players));
  return {
    level,
    W: g.W,
    D: g.D,
    seed,
    t: 0,
    left: level.time,
    over: false,
    coins: 0,
    served: 0,
    lapsed: 0,
    players: Array.from({ length: n }, (_, slot) => newPlayer(level, slot)),
    spots,
    orders: [],
    nextOrder: level.orders.first ?? 2,
    orderId: 0,
    returns: [],
    // (the thief: when he next comes, and where he's creeping, if he is)
    ...(level.thief ? { nextSteal: level.thief.first, sneak: null } : {}),
  };
}

export function newPlayer(level, slot) {
  const [i, j] = level.spawn[slot % level.spawn.length];
  return { slot, x: i + 0.5, z: j + 0.5, face: Math.PI / 2, vx: 0, vz: 0, held: null, work: false, dash: 0, cool: 0 };
}

// how many hobbits the round is pitched for (orders come faster with more)
const busy = (s) => 1 + 0.35 * (s.players.length - 1);
export const starsFor = (s) => s.level.stars.map((c) => Math.round(c * (1 + 0.3 * (s.players.length - 1))));
export const starsOf = (s) => starsFor(s).filter((c) => s.coins >= c).length;

// ── walking ──

export const solid = (s, i, j) => {
  const g = s.level.tiles;
  if (i < 0 || j < 0 || i >= s.W || j >= s.D) return true;
  return !FLOOR.has(g[j][i]);
};

// push a circle out of the tiles round it
export function pushOut(s, x, z, r = RADIUS) {
  for (let pass = 0; pass < 2; pass++) {
    const ci = Math.floor(x);
    const cj = Math.floor(z);
    for (let j = cj - 1; j <= cj + 1; j++)
      for (let i = ci - 1; i <= ci + 1; i++) {
        if (!solid(s, i, j)) continue;
        const nx = Math.max(i, Math.min(i + 1, x));
        const nz = Math.max(j, Math.min(j + 1, z));
        const dx = x - nx;
        const dz = z - nz;
        const d = Math.hypot(dx, dz);
        if (d >= r) continue;
        if (d > 1e-6) {
          x = nx + (dx / d) * r;
          z = nz + (dz / d) * r;
        } else {
          // the centre's inside the tile: out the nearest side that's open
          const sides = [
            [i - r - x, 0, i - 1, j],
            [i + 1 + r - x, 0, i + 1, j],
            [0, j - r - z, i, j - 1],
            [0, j + 1 + r - z, i, j + 1],
          ].sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
          const out = sides.find((o) => !solid(s, o[2], o[3])) ?? sides[0];
          x += out[0];
          z += out[1];
        }
      }
  }
  return [x, z];
}

// One hobbit's step: move = { x, z } (−1..1, already turned to the room),
// dash (pressed this step), or `press` (lib/press.js's createCooldownPress:
// a dash pressed a moment before the cooldown ends goes as it ends, where
// the flag alone was dropped). Run by whoever owns the hobbit; `others` are
// the rest, to be shouldered past.
export function movePlayer(s, p, { x: mx = 0, z: mz = 0, dash = false, press = null } = {}, dt, others = []) {
  const L = s.level.move;
  const len = Math.hypot(mx, mz);
  const k = len > 1 ? 1 / len : 1;
  p.cool = Math.max(0, p.cool - dt);
  if (press) {
    press.ready(p.cool <= 0, dt);
    dash = dash || press.take();
  }
  if (dash && p.cool <= 0) {
    p.dash = L.dashTime;
    p.cool = L.dashCool;
  }
  // (webs, or mire, underfoot: slow going, even at a dash)
  const slow = s.level.tiles[Math.floor(p.z)]?.[Math.floor(p.x)] === ',' ? (L.web ?? 0.45) : 1;
  let speed = L.speed * slow;
  let tx = mx * k;
  let tz = mz * k;
  if (p.dash > 0) {
    p.dash = Math.max(0, p.dash - dt);
    speed = L.dashSpeed * slow;
    if (len < 0.1) {
      tx = Math.cos(p.face);
      tz = -Math.sin(p.face);
    }
  }
  // by dt, as `min(1, dt × k)` was at 60 Hz (../ease.js)
  const ease = byFrame(p.dash > 0 ? 30 : 16, dt);
  p.vx += (tx * speed - p.vx) * ease;
  p.vz += (tz * speed - p.vz) * ease;
  if (len < 0.05 && p.dash <= 0 && Math.hypot(p.vx, p.vz) < 0.05) {
    p.vx = 0;
    p.vz = 0;
  }
  let x = p.x + p.vx * dt;
  let z = p.z + p.vz * dt;
  for (const o of others) {
    const dx = x - o.x;
    const dz = z - o.z;
    const d = Math.hypot(dx, dz);
    if (d < RADIUS * 2 && d > 1e-6) {
      x = o.x + (dx / d) * RADIUS * 2;
      z = o.z + (dz / d) * RADIUS * 2;
    }
  }
  [x, z] = pushOut(s, x, z);
  p.x = x;
  p.z = z;
  if (len > 0.1) p.face = Math.atan2(-mz, mx);
  return p;
}

// The tile a hobbit is facing and can work at, as [i, j], or null.
export function facingTile(s, p) {
  const dx = Math.cos(p.face);
  const dz = -Math.sin(p.face);
  const tryAt = (ax, az) => {
    const i = Math.floor(p.x + ax * 0.75);
    const j = Math.floor(p.z + az * 0.75);
    const c = s.level.tiles[j]?.[i];
    return c && c !== '.' && s.spots[key(i, j)] ? [i, j] : null;
  };
  // straight ahead, then along whichever way he's mostly facing
  return tryAt(dx, dz) ?? (Math.abs(dx) > Math.abs(dz) ? tryAt(Math.sign(dx), 0) : tryAt(0, Math.sign(dz)));
}

// ── grab: pick up, put down, combine ──

export function grab(s, p) {
  const ev = [];
  if (s.over) return ev;
  const at = facingTile(s, p);
  if (!at) return ev;
  const [i, j] = at;
  const c = s.level.tiles[j][i];
  const sp = s.spots[key(i, j)];
  const held = p.held;
  const R = recipesOf(s.level);
  const say = (type, more = {}) => ev.push({ type, at, p: p.slot, ...more });
  const take = (item) => {
    p.held = item;
    say('pick', { k: item.k });
  };
  const nope = () => say('nope');
  const F = s.level.fuel;

  if (F && held?.k === F.wood && (c === 'P' || c === 'O')) {
    // wood on the fire
    sp.fuel = Math.min(1, sp.fuel + F.load);
    p.held = null;
    say('stoked');
  } else if (c === 'A' && R.platter) {
    // the carving table: the platter's parts, one of each, then the platter
    const parts = R.platter.parts;
    if (held && !sp.item && parts.some((q) => q.k === held.k && q.s === held.s) && !sp.parts.some((q) => q.k === held.k)) {
      sp.parts.push(held);
      p.held = null;
      say('put', { k: held.k });
      if (sp.parts.length === parts.length) {
        sp.item = { ...R.platter.makes };
        sp.parts = [];
        say('plated');
      }
    } else if (!held && sp.item) {
      take(sp.item);
      sp.item = null;
    } else if (!held && sp.parts.length) take(sp.parts.pop());
    else nope();
  } else if (HOLDS.has(c)) {
    if (!held && sp.item) {
      take(sp.item);
      sp.item = null;
      sp.prog = 0;
    } else if (held && !sp.item) {
      const fits = c === '#' || c === 'B' || c === 'L' || (c === 'O' && ovenFor(R, held.k)?.takes === held.k) || (c === 'T' && held.k === R.tap.into && held.s === 'clean');
      if (!fits) {
        nope();
        return ev;
      }
      sp.item = held;
      sp.prog = 0;
      p.held = null;
      say('put', { k: held.k });
    } else if (held && sp.item) nope();
  } else if (R.crates[c]) {
    if (!held) take({ k: R.crates[c], s: 'raw' });
    else if (held.k === R.crates[c] && held.s === 'raw') {
      p.held = null;
      say('put', { k: held.k });
    } else nope();
  } else if (R.shelves[c]) {
    const k = R.shelves[c];
    if (!held && sp.n > 0) {
      sp.n -= 1;
      take({ k, s: 'clean' });
    } else if (held && held.k === k && held.s === 'clean') {
      sp.n += 1;
      p.held = null;
      say('put', { k });
    } else nope();
  } else if (c === 'P') {
    if (held && R.pot.takes.includes(held.k) && held.s === 'chopped' && sp.n < R.pot.need && (sp.s === 'empty' || sp.s === 'part')) {
      sp.n += 1;
      sp.s = sp.n === R.pot.need ? 'cooking' : 'part';
      sp.cook = 0;
      p.held = null;
      say('add', { k: held.k, n: sp.n });
    } else if (held && held.k === R.pot.into && held.s === 'clean' && sp.s === 'done') {
      held.s = R.pot.makes;
      Object.assign(sp, { n: 0, cook: 0, s: 'empty', prog: 0 });
      say('ladle');
    } else nope();
  } else if (c === 'W') {
    if (held && CONTAINER(held.k) && held.s === 'dirty') {
      sp.dirty.push(held.k);
      p.held = null;
      say('put', { k: held.k });
    } else if (!held && sp.clean.length) take({ k: sp.clean.shift(), s: 'clean' });
    else nope();
  } else if (c === 'R') {
    const k = Object.keys(sp).find((x) => sp[x] > 0);
    if (!held && k) {
      sp[k] -= 1;
      take({ k, s: 'dirty' });
    } else nope();
  } else if (c === 'X') {
    if (held && !CONTAINER(held.k)) p.held = null;
    else if (held && held.s !== 'clean' && held.s !== 'dirty') held.s = 'dirty';
    else {
      nope();
      return ev;
    }
    say('bin', { k: held.k });
  } else if (c === 'S') {
    const dish = dishOf(held, s.level);
    const o = dish && s.orders.find((x) => x.dish === dish);
    if (!o) {
      nope();
      return ev;
    }
    const L = s.level;
    const coins = L.prices[dish] + Math.round(L.tip * Math.max(0, o.t) / o.of);
    s.coins += coins;
    s.served += 1;
    s.orders = s.orders.filter((x) => x !== o);
    p.held = null;
    if (R.dishes[dish].back) s.returns.push({ at: s.t + L.times.back, k: R.dishes[dish].back });
    say('served', { dish, coins, order: o.id });
  }
  return ev;
}

// ── work: chop, wash, scrape (held down) ──

export function work(s, p, dt) {
  const ev = [];
  if (s.over || p.held) return ev;
  const at = facingTile(s, p);
  if (!at) return ev;
  const [i, j] = at;
  const c = s.level.tiles[j][i];
  const sp = s.spots[key(i, j)];
  const T = s.level.times;
  const R = recipesOf(s.level);
  if (c === 'F' && !sp.item && R.line) {
    // the fishing line: held till something bites
    sp.prog += dt / T.fish;
    ev.push({ type: 'reel', at, p: p.slot });
    if (sp.prog >= 1) {
      sp.item = { k: R.line.makes, s: 'raw' };
      sp.prog = 0;
      ev.push({ type: 'caught', at, p: p.slot, k: sp.item.k });
    }
  } else if (c === 'L' && sp.item && R.wrap && sp.item.k === R.wrap.takes.k && sp.item.s === R.wrap.takes.s) {
    // the leaf table: wrapping (lembas in mallorn leaves), held down
    sp.prog += dt / T.wrap;
    ev.push({ type: 'chop', at, p: p.slot });
    if (sp.prog >= 1) {
      sp.item.s = R.wrap.makes;
      sp.prog = 0;
      ev.push({ type: 'chopped', at, p: p.slot, k: sp.item.k });
    }
  } else if (c === 'B' && sp.item && CHOPS(sp.item.k) && sp.item.s === 'raw') {
    sp.prog += dt / T.chop;
    ev.push({ type: 'chop', at, p: p.slot });
    if (sp.prog >= 1) {
      sp.item.s = 'chopped';
      sp.prog = 0;
      ev.push({ type: 'chopped', at, p: p.slot, k: sp.item.k });
    }
  } else if (c === 'W' && sp.dirty.length) {
    sp.prog += dt / T.wash;
    ev.push({ type: 'scrub', at, p: p.slot });
    if (sp.prog >= 1) {
      sp.clean.push(sp.dirty.shift());
      sp.prog = 0;
      ev.push({ type: 'washed', at, p: p.slot });
    }
  } else if (c === 'P' && sp.s === 'burnt') {
    sp.prog += dt / T.scrape;
    ev.push({ type: 'scrub', at, p: p.slot });
    if (sp.prog >= 1) {
      Object.assign(sp, { n: 0, cook: 0, s: 'empty', prog: 0 });
      ev.push({ type: 'scraped', at, p: p.slot });
    }
  }
  return ev;
}

// ── the thief ──

// Now and then he creeps up to a counter with something he likes on it
// (`sneak`, for as long as `warn`), and takes it, unless a hobbit comes
// within `guard` of it first. He never tries one a hobbit's already by.
function stepThief(s, ev) {
  const th = s.level.thief;
  const near = (i, j) => s.players.some((p) => Math.hypot(p.x - (i + 0.5), p.z - (j + 0.5)) < th.guard);
  const next = () => (s.nextSteal = s.t + th.every[0] + rand(s) * (th.every[1] - th.every[0]));
  if (s.sneak) {
    const [i, j] = s.sneak.at;
    const sp = s.spots[key(i, j)];
    if (near(i, j)) {
      ev.push({ type: 'shooed', at: s.sneak.at });
      s.sneak = null;
      next();
    } else if (s.t >= s.sneak.until) {
      if (sp.item && th.steals.includes(sp.item.k)) {
        ev.push({ type: 'stolen', at: s.sneak.at, k: sp.item.k });
        sp.item = null;
        sp.prog = 0;
      }
      s.sneak = null;
      next();
    }
  } else if (s.t >= s.nextSteal) {
    const likes = Object.keys(s.spots).filter((k) => {
      const [i, j] = k.split(',').map(Number);
      const c = s.level.tiles[j][i];
      const it = s.spots[k].item;
      return (c === '#' || c === 'B') && it && th.steals.includes(it.k) && !near(i, j);
    });
    if (likes.length) {
      const at = likes[Math.floor(rand(s) * likes.length)].split(',').map(Number);
      s.sneak = { at, until: s.t + th.warn };
      ev.push({ type: 'sneak', at });
    } else s.nextSteal = s.t + 3;
  }
}

// ── the round ──

// One step for the host: the grabs asked for this step (in the order they
// came: [{ p: slot }]), then work, the stations, the orders and the clock.
// Returns what happened, for the sounds, the lines and the guests.
export function stepRush(s, dt, grabs = []) {
  const ev = [];
  if (s.over) return ev;
  s.t += dt;
  for (const g of grabs) {
    const p = s.players[g.p];
    if (p) ev.push(...grab(s, p));
  }
  for (const p of s.players) if (p.work) ev.push(...work(s, p, dt));
  const T = s.level.times;
  const R = recipesOf(s.level);
  const F = s.level.fuel;
  for (const [k, sp] of Object.entries(s.spots)) {
    const [i, j] = k.split(',').map(Number);
    const c = s.level.tiles[j][i];
    const at = [i, j];
    // a fire burns down while something's on it, and what's over it waits
    // while it's out
    if (F && 'fuel' in sp && sp.fuel > 0 && (sp.item || sp.s === 'cooking' || sp.s === 'done')) {
      sp.fuel = Math.max(0, sp.fuel - dt / F.burn);
      if (sp.fuel === 0) ev.push({ type: 'out', at });
    }
    if (F && sp.fuel === 0) continue;
    if (c === 'P' && (sp.s === 'cooking' || sp.s === 'done')) {
      sp.cook += dt;
      if (sp.s === 'cooking' && sp.cook >= T.cook) {
        sp.s = 'done';
        ev.push({ type: 'cooked', at });
      } else if (sp.s === 'done' && sp.cook >= T.cook + T.burn) {
        sp.s = 'burnt';
        ev.push({ type: 'burnt', at, k: 'stew' });
      }
    } else if (c === 'O' && sp.item) {
      sp.prog += dt;
      // (what the oven makes is done, then spoilt: a loaf baked then burnt,
      // an axe forged then ruined)
      const o = ovenFor(R, sp.item.k);
      const [done, spoilt] = o ? KINDS[o.makes] : [];
      if (o && sp.item.k === o.takes && sp.prog >= T.bake) {
        sp.item = { k: o.makes, s: done };
        sp.prog = 0;
        ev.push({ type: 'baked', at });
      } else if (o && sp.item.k === o.makes && sp.item.s === done && sp.prog >= T.char) {
        sp.item.s = spoilt;
        ev.push({ type: 'burnt', at, k: o.makes });
      }
    } else if (c === 'G' && !sp.item && R.patch) {
      // the patch: something comes up, given time
      sp.prog += dt / T.grow;
      if (sp.prog >= 1) {
        sp.item = { k: R.patch.grows, s: 'raw' };
        sp.prog = 0;
        ev.push({ type: 'grown', at });
      }
    } else if (c === 'T' && sp.item?.k === R.tap.into) {
      sp.prog += dt;
      if (sp.item.s === 'clean' && sp.prog >= T.fill) {
        sp.item.s = R.tap.makes;
        sp.prog = 0;
        ev.push({ type: 'filled', at });
      } else if (sp.item.s === R.tap.makes && sp.prog >= T.spill) {
        sp.item.s = 'dirty';
        sp.prog = 0;
        ev.push({ type: 'spilt', at });
      }
    }
  }
  if (s.level.thief) stepThief(s, ev);
  // the dirty ones, back from the common room
  if (s.returns.length) {
    const back = s.returns.filter((r) => r.at <= s.t);
    if (back.length) {
      s.returns = s.returns.filter((r) => r.at > s.t);
      const r = Object.entries(s.spots).find(([k]) => {
        const [i, j] = k.split(',').map(Number);
        return s.level.tiles[j][i] === 'R';
      });
      if (r) {
        for (const b of back) r[1][b.k] += 1;
        ev.push({ type: 'back', at: r[0].split(',').map(Number), n: back.length });
      }
    }
  }
  // orders: patience running out, and new ones in
  const O = s.level.orders;
  for (const o of s.orders) o.t -= dt;
  const gone = s.orders.filter((o) => o.t <= 0);
  if (gone.length) {
    s.orders = s.orders.filter((o) => o.t > 0);
    for (const o of gone) {
      s.coins = Math.max(0, s.coins - O.lapse);
      s.lapsed += 1;
      ev.push({ type: 'lapsed', dish: o.dish, order: o.id });
    }
  }
  s.nextOrder -= dt;
  if (s.nextOrder <= 0) {
    if (s.orders.length < O.max + Math.floor((s.players.length - 1) / 2)) {
      const r = rand(s);
      let acc = 0;
      let dish = Object.keys(O.mix)[0];
      for (const [d, w] of Object.entries(O.mix)) {
        acc += w;
        if (r < acc) {
          dish = d;
          break;
        }
      }
      s.orderId += 1;
      const of = O.patience[dish];
      s.orders.push({ id: s.orderId, dish, t: of, of });
      ev.push({ type: 'order', dish, order: s.orderId });
    }
    s.nextOrder = s.orderId < 2 ? (O.second ?? 5) : (O.every / busy(s)) * (0.8 + 0.4 * rand(s));
  }
  s.left -= dt;
  if (s.left <= 0) {
    s.left = 0;
    s.over = true;
    for (const p of s.players) p.work = false;
    ev.push({ type: 'end', coins: s.coins, stars: starsOf(s) });
  }
  return ev;
}
