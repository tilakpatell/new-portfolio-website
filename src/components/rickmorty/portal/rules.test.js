import { describe, expect, it } from 'vitest';
import { PANIC, aimAt, choose, dash, newGame, spawnEnemy, spawnBoss, step } from './rules';
import { autopilot } from './pilot';
import { LIE, createRoster } from './Portal3D';
import { animate, makeCast } from './cast';

const DT = PANIC.step;
// run the game for `secs`, setting input each step (fn may return early)
function run(g, secs, fn) {
  const n = Math.round(secs / DT);
  for (let i = 0; i < n; i++) {
    if (fn && fn(g, i) === false) break;
    step(g, DT);
  }
  return g;
}
// a quiet arena: no waves arrive while a test sets up its own fight
const quiet = (opts = {}) => {
  const g = newGame({ seed: 7, ...opts });
  g.portals = [];
  g.calm = 1e9;
  g.obstacles = [];
  return g;
};
const still = (g) => Object.assign(g.input, { mx: 0, my: 0, ax: 0, ay: 0, aiming: false, fire: false });

describe('Portal panic: starting', () => {
  it('starts in the backyard with full hearts, the hero in the middle', () => {
    const g = newGame({ seed: 1, hero: 'morty', level: 'easy' });
    expect(g.status).toBe('play');
    expect(g.dim).toBe(0);
    expect(g.wave).toBe(0);
    expect(g.p.hp).toBe(PANIC.heroes.morty.hp + PANIC.levels.easy.hp);
    expect(g.p.max).toBe(g.p.hp);
    expect(Math.hypot(g.p.x, g.p.y)).toBeLessThan(0.01);
    expect(g.obstacles.length).toBeGreaterThan(2);
    for (const o of g.obstacles) expect(Math.hypot(o.x, o.y)).toBeGreaterThan(o.r + 3);
  });

  it('is the same game for the same seed', () => {
    const a = newGame({ seed: 42 });
    const b = newGame({ seed: 42 });
    run(a, 20, autopilot);
    run(b, 20, autopilot);
    expect(a.p.x).toBe(b.p.x);
    expect(a.score).toBe(b.score);
    expect(a.enemies.length).toBe(b.enemies.length);
    expect(a.kills).toBe(b.kills);
  });
});

describe('Portal panic: moving', () => {
  it('moves at the hero’s speed and stays inside the arena', () => {
    const g = quiet({ hero: 'rick' });
    run(g, 1, (gg) => Object.assign(gg.input, { mx: 1, my: 0 }));
    expect(g.p.x).toBeGreaterThan(PANIC.heroes.rick.speed * 0.8);
    run(g, 6, (gg) => Object.assign(gg.input, { mx: 1, my: 0.3 }));
    expect(Math.hypot(g.p.x, g.p.y)).toBeLessThanOrEqual(PANIC.arena - g.p.r + 1e-6);
  });

  it('walks round obstacles, not through them', () => {
    const g = quiet();
    g.obstacles = [{ x: 4, y: 0, r: 1.5, kind: 'rock' }];
    run(g, 3, (gg) => Object.assign(gg.input, { mx: 1, my: 0 }));
    expect(Math.hypot(g.p.x - 4, g.p.y)).toBeGreaterThanOrEqual(1.5 + g.p.r - 1e-6);
  });
});

describe('Portal panic: shooting', () => {
  it('fires where you aim, at the hero’s rate', () => {
    const g = quiet({ hero: 'rick' });
    let fired = 0;
    run(g, 1, (gg) => {
      Object.assign(gg.input, { ax: 0, ay: -1, aiming: true, fire: true });
      fired += gg.events.filter((e) => e.type === 'shot').length;
      gg.events.length = 0;
    });
    const rate = PANIC.heroes.rick.fire;
    expect(fired).toBeGreaterThanOrEqual(Math.floor(rate) - 1);
    expect(fired).toBeLessThanOrEqual(Math.ceil(rate) + 1);
    for (const s of g.shots) expect(s.vy).toBeLessThan(0);
  });

  it('aims at the nearest enemy when you are not aiming', () => {
    const g = quiet();
    spawnEnemy(g, 'meeseeks', 0, 8);
    spawnEnemy(g, 'meeseeks', -12, 0);
    const a = aimAt(g);
    expect(a.y).toBeCloseTo(1, 3);
    expect(a.x).toBeCloseTo(0, 3);
  });

  it('kills what it hits; kills score and drop Mega Seeds', () => {
    const g = quiet();
    const e = spawnEnemy(g, 'meeseeks', 0, -5);
    e.speed = 0;
    run(g, 2, (gg) => Object.assign(gg.input, { fire: true }));
    expect(e.alive).toBe(false);
    expect(g.kills).toBe(1);
    expect(g.score).toBeGreaterThan(0);
    expect(g.pickups.some((p) => p.kind === 'seed')).toBe(true);
  });
});

describe('Portal panic: the portal dash', () => {
  it('jumps you ahead, spends a charge, and you can’t be hurt during it', () => {
    const g = quiet({ hero: 'rick' });
    g.input.mx = 1;
    const n = g.p.dashes;
    expect(dash(g)).toBe(true);
    expect(g.p.dashes).toBe(n - 1);
    run(g, PANIC.dash.time + 0.02);
    expect(g.p.x).toBeGreaterThan(PANIC.dash.dist * 0.9);
    expect(g.p.inv).toBeGreaterThan(0);
  });

  it('runs out, then recharges', () => {
    const g = quiet({ hero: 'rick' });
    g.input.mx = -1;
    for (let i = 0; i < 10; i++) {
      dash(g);
      run(g, 0.2);
    }
    expect(g.p.dashes).toBe(0);
    expect(dash(g)).toBe(false);
    run(g, PANIC.heroes.rick.recharge + 0.1);
    expect(g.p.dashes).toBeGreaterThanOrEqual(1);
  });

  it('never leaves you in a wall or outside the arena', () => {
    const g = quiet();
    g.obstacles = [{ x: 3, y: 0, r: 1.2, kind: 'rock' }];
    g.p.x = 0.5;
    g.input.mx = 1;
    dash(g);
    run(g, 0.4);
    expect(Math.hypot(g.p.x - 3, g.p.y)).toBeGreaterThanOrEqual(1.2 + g.p.r - 1e-6);
    g.p.x = PANIC.arena - 1;
    dash(g);
    run(g, 0.4);
    expect(Math.hypot(g.p.x, g.p.y)).toBeLessThanOrEqual(PANIC.arena - g.p.r + 1e-6);
  });
});

describe('Portal panic: a dash pressed a moment early', () => {
  it('fires as the dash before it ends, when pressed during it', () => {
    const g = quiet({ hero: 'rick' });
    g.input.mx = 1;
    expect(dash(g)).toBe(true);
    run(g, PANIC.dash.time - 0.05);
    const n = g.p.dashes;
    expect(dash(g)).toBe(false);
    run(g, 0.08);
    expect(g.p.dashes).toBe(n - 1);
    expect(g.p.dashT).toBeGreaterThan(0);
  });

  it('fires as a charge comes back, when pressed a moment before it does', () => {
    const g = quiet({ hero: 'rick' });
    g.input.mx = 1;
    while (g.p.dashes > 0) {
      dash(g);
      run(g, PANIC.dash.time + 0.02);
    }
    // till a charge is 0.05 s from coming back
    run(g, 5, () => g.p.recharge < PANIC.heroes.rick.recharge - 0.05);
    expect(g.p.dashes).toBe(0);
    expect(dash(g)).toBe(false);
    run(g, 0.1);
    expect(g.p.dashT).toBeGreaterThan(0);
  });

  it('forgets a press made long before', () => {
    const g = quiet({ hero: 'rick' });
    g.input.mx = 1;
    while (g.p.dashes > 0) {
      dash(g);
      run(g, PANIC.dash.time + 0.02);
    }
    expect(dash(g)).toBe(false);
    run(g, PANIC.heroes.rick.recharge + 0.1);
    expect(g.p.dashes).toBeGreaterThanOrEqual(1);
    expect(g.p.dashT).toBeLessThanOrEqual(0);
  });
});

describe('Portal panic: getting hurt', () => {
  it('a bolt costs a heart, then you blink and can’t be hit for a moment', () => {
    const g = quiet();
    const hp = g.p.hp;
    g.bolts.push({ x: 0, y: -2, vx: 0, vy: 10, r: 0.25, life: 2, dmg: 1 });
    g.bolts.push({ x: 0, y: -3, vx: 0, vy: 10, r: 0.25, life: 2, dmg: 1 });
    run(g, 0.5, still);
    expect(g.p.hp).toBe(hp - 1);
    expect(g.p.inv).toBeGreaterThan(0);
  });

  it('runs out of hearts and loses', () => {
    const g = quiet();
    g.p.hp = 1;
    g.bolts.push({ x: 0, y: -2, vx: 0, vy: 10, r: 0.25, life: 2, dmg: 1 });
    run(g, 0.5, still);
    expect(g.status).toBe('lost');
  });
});

describe('Portal panic: the enemies', () => {
  it('Meeseeks rush you', () => {
    const g = quiet();
    const e = spawnEnemy(g, 'meeseeks', 10, 0);
    run(g, 1, still);
    expect(e.x).toBeLessThan(10 - PANIC.enemies.meeseeks.speed * 0.6);
  });

  it('Gromflomites keep their distance and shoot', () => {
    const g = quiet();
    const e = spawnEnemy(g, 'gromflomite', 3, 0);
    let shots = 0;
    run(g, 5, (gg) => {
      still(gg);
      gg.p.inv = 1; // so the test sees every bolt
      shots += gg.events.filter((x) => x.type === 'bolt').length;
      gg.events.length = 0;
    });
    expect(Math.hypot(e.x, e.y)).toBeGreaterThan(PANIC.enemies.gromflomite.keep[0] - 1);
    expect(shots).toBeGreaterThan(0);
  });

  it('a Cronenberg splits in two when it dies', () => {
    const g = quiet();
    const e = spawnEnemy(g, 'cronenberg', 0, -6);
    e.speed = 0;
    run(g, 3, (gg) => Object.assign(gg.input, { ax: 0, ay: -1, aiming: true, fire: g.enemies.filter((x) => x.alive).length === 1 && e.alive }));
    expect(e.alive).toBe(false);
    expect(g.enemies.filter((x) => x.kind === 'blob').length).toBe(PANIC.enemies.cronenberg.split);
  });

  it('a Gazorpian winds up, then charges', () => {
    const g = quiet();
    g.p.inv = 99;
    const e = spawnEnemy(g, 'gazorpian', 9, 0);
    let wound = false;
    let charged = 0;
    run(g, 5, (gg) => {
      still(gg);
      if (e.state === 'windup') wound = true;
      if (e.state === 'charge') charged = Math.max(charged, Math.hypot(e.vx, e.vy));
    });
    expect(wound).toBe(true);
    expect(charged).toBeGreaterThan(PANIC.enemies.gazorpian.charge * 0.9);
  });
});

describe('Portal panic: pickups', () => {
  it('pulls Mega Seeds in from the magnet’s reach and counts them', () => {
    const g = quiet();
    g.pickups.push({ kind: 'seed', x: PANIC.magnet - 0.3, y: 0, t: 0 });
    g.pickups.push({ kind: 'seed', x: 9, y: 0, t: 0 });
    run(g, 1.5, still);
    expect(g.seeds).toBe(1);
    expect(g.pickups.length).toBe(1);
  });

  it('Szechuan sauce heals a heart', () => {
    const g = quiet();
    g.p.hp = 1;
    g.pickups.push({ kind: 'sauce', x: 0.5, y: 0, t: 0 });
    run(g, 0.5, still);
    expect(g.p.hp).toBe(2);
  });
});

describe('Portal panic: waves, upgrades and dimensions', () => {
  it('opens portals, and clearing a wave offers three different gadgets', () => {
    const g = newGame({ seed: 3, level: 'easy' });
    g.p.inv = 1e9;
    let opened = false;
    run(g, 60, (gg) => {
      if (gg.portals.length) opened = true;
      // a perfect shot: whatever came through dies
      for (const e of gg.enemies) if (e.alive && e.t > 0.5) e.hp = 0;
      return gg.status === 'play';
    });
    expect(opened).toBe(true);
    expect(g.status).toBe('pick');
    expect(g.offer.length).toBe(3);
    expect(new Set(g.offer).size).toBe(3);
    for (const id of g.offer) expect(PANIC.upgrades[id]).toBeTruthy();
  });

  it('applies what you pick, up to its limit', () => {
    const g = quiet({ hero: 'rick' });
    g.status = 'pick';
    g.offer = ['battery', 'overclock', 'butter'];
    const max = g.p.max;
    choose(g, 'battery');
    expect(g.status).toBe('play');
    expect(g.p.max).toBe(max + 1);
    expect(g.p.hp).toBe(g.p.max);
    g.ups.overclock = PANIC.upgrades.overclock.max;
    g.status = 'pick';
    g.offer = ['overclock'];
    expect(choose(g, 'overclock')).toBe(false);
  });

  it('butter robots stop bolts', () => {
    const g = quiet();
    g.ups.butter = 2;
    const hp = g.p.hp;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      g.bolts.push({ x: Math.cos(a) * 6, y: Math.sin(a) * 6, vx: -Math.cos(a) * 8, vy: -Math.sin(a) * 8, r: 0.25, life: 3, dmg: 1 });
    }
    run(g, 2, still);
    expect(g.blocked).toBeGreaterThan(0);
    expect(g.p.hp).toBeGreaterThanOrEqual(hp - 1);
  });

  it('more Portal fluid fires more shots per trigger', () => {
    const g = quiet();
    g.ups.fluid = 2;
    g.input.fire = true;
    step(g, DT);
    expect(g.shots.length).toBe(3);
  });

  it('after three waves the dimension’s boss comes through, with a second phase', () => {
    const g = quiet();
    const b = spawnBoss(g, 'snowball');
    expect(g.boss).toBe(b);
    expect(b.hp).toBe(PANIC.bosses.snowball.hp);
    g.p.inv = 1e9;
    let phase2 = false;
    run(g, 20, (gg) => {
      gg.boss && (gg.boss.hp -= 0.12);
      if (gg.events.some((e) => e.type === 'bossPhase')) phase2 = true;
      gg.events.length = 0;
      return gg.status === 'play';
    });
    expect(phase2).toBe(true);
  });

  it('beating the boss carries you through a portal to the next dimension', () => {
    const g = newGame({ seed: 5 });
    g.wave = 3;
    g.portals = [];
    g.calm = 1e9;
    spawnBoss(g, 'snowball');
    g.boss.hp = 0;
    run(g, 0.1);
    expect(g.status).toBe('travel');
    run(g, PANIC.travel + 0.2, () => undefined);
    expect(g.status).toBe('play');
    expect(g.dim).toBe(1);
    expect(g.wave).toBe(0);
  });

  it('beating the last boss wins', () => {
    const g = newGame({ seed: 5 });
    g.dim = PANIC.dims.length - 1;
    g.wave = 3;
    g.portals = [];
    spawnBoss(g, 'evilmorty');
    g.boss.hp = 0;
    run(g, PANIC.travel + 0.5);
    expect(g.status).toBe('won');
  });

  it('every boss fights back', () => {
    for (const id of Object.keys(PANIC.bosses)) {
      const g = quiet();
      spawnBoss(g, id);
      let threats = 0;
      run(g, 12, (gg) => {
        gg.p.inv = 1;
        threats = Math.max(threats, gg.bolts.length + gg.hazards.length + gg.enemies.filter((e) => e.alive).length);
        return gg.status === 'play';
      });
      expect(threats, id).toBeGreaterThan(0);
    }
  });
});

// every event of a run, kept (the host drains them; a test reads them all)
function heard(g, secs, fn) {
  const all = [];
  run(g, secs, (gg, i) => {
    const r = fn?.(gg, i);
    all.push(...gg.events);
    gg.events.length = 0;
    return r;
  });
  return all;
}

describe('Portal panic: the events say whose they are', () => {
  it('a kill and every hit before it carry the enemy’s id', () => {
    const g = quiet();
    const e = spawnEnemy(g, 'gromflomite', 0, -5);
    e.speed = 0;
    e.cool = 1e9;
    const all = heard(g, 2, (gg) => Object.assign(gg.input, { ax: 0, ay: -1, aiming: true, fire: true }));
    const hits = all.filter((x) => x.type === 'hit');
    expect(hits.length).toBeGreaterThan(1);
    for (const h of hits) expect(h.id).toBe(e.id);
    expect(all.find((x) => x.type === 'kill')).toMatchObject({ id: e.id, kind: 'gromflomite' });
  });

  it('a bolt says who fired it, a Gazorpian’s windup is its own, and one walking into you says so', () => {
    const g = quiet();
    g.p.inv = 1e9;
    const gun = spawnEnemy(g, 'gromflomite', 8, 0);
    const big = spawnEnemy(g, 'gazorpian', -9, 0);
    const all = heard(g, 5, still);
    const bolts = all.filter((x) => x.type === 'bolt');
    expect(bolts.length).toBeGreaterThan(0);
    for (const b of bolts) expect(b.id).toBe(gun.id);
    expect(all.find((x) => x.type === 'windup')?.id).toBe(big.id);
    const q = quiet();
    const rusher = spawnEnemy(q, 'meeseeks', 3, 0);
    expect(heard(q, 2, still).find((x) => x.type === 'hurt')).toMatchObject({ id: rusher.id, from: 'meeseeks' });
  });

  it('a boss’s bolts say they’re the boss’s', () => {
    const g = quiet();
    g.p.inv = 1e9;
    spawnBoss(g, 'evilmorty');
    const bolts = heard(g, 8, still).filter((x) => x.type === 'bolt');
    expect(bolts.length).toBeGreaterThan(0);
    for (const b of bolts) expect(b).toMatchObject({ boss: true });
  });

  it('a Meeseeks from the box stops to punch, says whom and which it is, then poofs', () => {
    const g = quiet();
    g.ups.meeseeks = 1;
    g.p.inv = 1e9;
    g.allyT = 99;
    const e = spawnEnemy(g, 'cronenberg', 4, 0);
    e.speed = 0;
    e.hp = 1e9;
    let stood = false;
    const all = heard(g, 9, (gg) => {
      still(gg);
      const a = gg.allies[0];
      if (a && Math.hypot(a.x - e.x, a.y - e.y) <= e.r + 0.6) stood ||= a.vx === 0 && a.vy === 0;
    });
    expect(all.find((x) => x.type === 'meeseeks')).toMatchObject({ ally: 0 });
    const punches = all.filter((x) => x.type === 'punch');
    expect(punches.length).toBeGreaterThan(0);
    for (const p of punches) expect(p).toMatchObject({ id: e.id, ally: 0 });
    expect(stood).toBe(true);
    expect(all.find((x) => x.type === 'poof')).toMatchObject({ ally: 0 });
  });
});

// the drawing's enemies by id (./Portal3D.js): fakes for the pool's figures
describe('Portal panic: a dying enemy’s figure', () => {
  const pool = () => {
    const out = { taken: [], freed: [] };
    out.take = (kind, id) => {
      const c = { kind, id };
      out.taken.push(c);
      return c;
    };
    out.free = (c) => out.freed.push(c);
    return out;
  };
  const alive = (...list) => list.map(([id, kind = 'meeseeks']) => ({ id, kind, alive: true }));

  it('is kept until its fall ends and it has lain a moment, then goes back', () => {
    const p = pool();
    const r = createRoster({ take: p.take, free: p.free, lie: LIE });
    r.sync(alive([1], [2]));
    const [one, two] = p.taken;
    expect(r.figure(1)).toBe(one);
    r.sync(alive([2]), new Map([[1, 2.2]]));
    expect(r.figure(1)).toBe(null);
    expect(p.freed).toEqual([]);
    expect(r.dying.map((d) => d.c)).toEqual([one]);
    for (let t = 0; t < 2.2 + LIE - 0.05; t += 0.05) r.step(0.05);
    expect(p.freed).toEqual([]);
    for (let t = 0; t < 1; t += 0.05) r.step(0.05);
    expect(p.freed).toEqual([one]);
    expect(r.dying).toEqual([]);
    expect(r.figure(2)).toBe(two);
  });

  it('goes at once when it can’t fall, or went without a kill', () => {
    const p = pool();
    const r = createRoster({ take: p.take, free: p.free });
    r.sync(alive([1], [2]));
    r.sync([], new Map([[1, 0]]));
    expect(p.freed.map((c) => c.id).sort()).toEqual([1, 2]);
    expect(r.dying).toEqual([]);
  });

  it('a new kind under the same id gets a figure of its own; clearing frees the living and the dying', () => {
    const p = pool();
    const r = createRoster({ take: p.take, free: p.free });
    r.sync(alive([1, 'meeseeks'], [2]));
    r.sync(alive([1, 'cop'], [2]));
    expect(r.figure(1).kind).toBe('cop');
    expect(p.freed.map((c) => c.kind)).toEqual(['meeseeks']);
    r.sync(alive([1, 'cop']), new Map([[2, 3]]));
    r.clear();
    expect(p.freed.length).toBe(3);
    expect(r.figure(1)).toBe(null);
    expect(r.dying).toEqual([]);
  });
});

// the shapes drawn when a model won't load (./cast.js)
describe('Portal panic: a figure of shapes', () => {
  const leg = (c) => c.legs[0].rotation.x;
  const walk = (c, speed, secs) => {
    for (let i = 0; i < Math.round(secs * 60); i++) animate(c, i / 60, 1, 0, { dt: 1 / 60, motion: { speed, side: 0, turn: 0 } });
  };

  it('answers a model’s calls, doing nothing', async () => {
    const c = makeCast('gromflomite');
    expect(c.anim).toBe(null);
    expect(c.react('hit', {})).toBe(null);
    expect(c.react('down', {})).toBe(null);
    await expect(c.play('cheer')).resolves.toBe(false);
    expect(() => {
      c.stop(0.2, 'upper');
      c.look({ x: 1, z: 2 });
      c.base('sit');
    }).not.toThrow();
  });

  // (`move` says 1 throughout: the ground covered is what counts)
  it('swings its legs with the ground it covers, not the clock: standing, it doesn’t march', () => {
    const c = makeCast('rick');
    walk(c, 0, 2);
    expect(Math.abs(leg(c))).toBeLessThan(1e-6);
    const swings = new Set();
    for (let i = 0; i < 60; i++) {
      animate(c, i / 60, 1, 0, { dt: 1 / 60, motion: { speed: 4, side: 0, turn: 0 } });
      swings.add(Math.sign(Math.round(leg(c) * 100)));
    }
    expect(swings.has(1) && swings.has(-1)).toBe(true);
    // twice the pace, twice the strides: the same ground, the same place in the stride
    const a = makeCast('rick');
    const b = makeCast('rick');
    a.seed = b.seed = 7;
    walk(a, 2, 1);
    walk(b, 4, 0.5);
    expect(leg(a)).toBeCloseTo(leg(b), 4);
  });

  it('flinches back when hurt, and goes down sat first, then onto its back', () => {
    const c = makeCast('morty');
    animate(c, 0, 0, 0, { dt: 1 / 60, motion: { speed: 0, side: 0, turn: 0, hurt: 1 } });
    expect(c.body.rotation.x).toBeLessThan(-0.2);
    animate(c, 0.1, 0, 0, { dt: 1 / 60, motion: { speed: 0, side: 0, turn: 0 }, down: 0.4 });
    expect(c.body.position.y).toBeLessThan(-0.2);
    expect(c.body.rotation.x).toBeGreaterThan(-0.5);
    animate(c, 0.2, 0, 0, { dt: 1 / 60, motion: { speed: 0, side: 0, turn: 0 }, down: 1 });
    expect(c.body.rotation.x).toBeLessThan(-1.3);
    expect(c.arms[0].rotation.x).toBeLessThan(-2.5);
  });
});

describe('Portal panic: fair', () => {
  it('standing still loses', () => {
    const g = newGame({ seed: 11 });
    run(g, 240, (gg) => {
      if (gg.status === 'pick') choose(gg, gg.offer[0]);
      still(gg);
      return gg.status !== 'lost';
    });
    expect(g.status).toBe('lost');
  });

  for (const level of ['easy', 'normal']) {
    it(`a simple bot clears the backyard on ${level}`, () => {
      for (const seed of [1, 2, 3]) {
        const g = newGame({ seed, level, hero: 'rick' });
        run(g, 400, (gg) => {
          if (gg.status === 'pick') choose(gg, gg.offer[0]);
          autopilot(gg);
          return gg.dim === 0 && gg.status !== 'lost';
        });
        expect(g.dim, `seed ${seed}: ${g.status} in wave ${g.wave}, ${g.p.hp} hearts`).toBe(1);
      }
    });
  }

  it('never stalls: a whole game ends, won or lost, on every level', () => {
    for (const level of Object.keys(PANIC.levels)) {
      for (const seed of [1, 2]) {
        const g = newGame({ seed, level, hero: 'morty' });
        run(g, 900, (gg) => {
          if (gg.status === 'pick') choose(gg, gg.offer[gg.offer.length - 1]);
          autopilot(gg);
          return gg.status === 'play' || gg.status === 'travel' || gg.status === 'pick';
        });
        expect(['won', 'lost'], `${level} seed ${seed}: dim ${g.dim} wave ${g.wave}`).toContain(g.status);
      }
    }
  });
});
