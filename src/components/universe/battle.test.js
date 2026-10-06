import { describe, expect, it } from 'vitest';
import { BATTLE, WIDTH, createBattle, inSights, perSide, turnToward } from './battle';
import { FIGHTERS, WARS } from './wars';

// a seeded random, so every run of a battle is the same
const seeded = (seed = 7) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const war = WARS.starwars;
const make = (o = {}) => createBattle({ war, attacker: 0, at: [0, 0, 0], axis: [1, 0], perSide: 8, rand: seeded(), ...o });
const run = (b, seconds, you = null, dt = 1 / 30) => {
  const events = [];
  for (let t = 0; t < seconds && !b.over; t += dt) events.push(...b.update(dt, you));
  return events;
};
const flagOf = (b, team) => b.capitals.find((c) => c.team === team && c.role === 'flagship');
// a shot from 2 units off straight through a point
const shotAt = (b, p, damage = 1) => b.hit({ x: p.x, y: p.y + 2, z: p.z }, { x: p.x, y: p.y - 0.01, z: p.z }, damage);

describe('perSide', () => {
  it('is 32 a side on a strong desktop, 20 on a middling one, 10 on a phone', () => {
    expect(perSide('high')).toBe(32);
    expect(perSide('mid')).toBe(20);
    expect(perSide('low')).toBe(10);
    expect(perSide(undefined)).toBe(20);
  });
});

describe('turnToward and inSights', () => {
  it('turns the nose toward where it wants to go, no faster than it can', () => {
    const f = turnToward({ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 0 }, 0.5);
    expect(Math.acos(f.z)).toBeCloseTo(0.5, 5);
    expect(Math.hypot(f.x, f.y, f.z)).toBeCloseTo(1, 9);
    const g = turnToward({ x: 0, y: 0, z: 1 }, { x: 0.1, y: 0, z: 1 }, 0.5);
    expect(g.x / g.z).toBeCloseTo(0.1, 5);
  });

  it('fires only with the target inside its cone and in range', () => {
    const type = FIGHTERS.xwing;
    expect(inSights({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 10 }, type)).toBe(true);
    expect(inSights({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: type.range + 1 }, type)).toBe(false);
    expect(inSights({ x: 0, y: 0, z: 1 }, { x: 3, y: 0, z: 10 }, type)).toBe(false);
  });
});

describe('a battle', () => {
  it('puts each side’s fleet in its line, and its fighters up', () => {
    const b = make();
    for (const team of [0, 1]) {
      const side = war.sides[team];
      const fighters = b.fighters.filter((f) => f.team === team);
      expect(fighters).toHaveLength(8);
      for (const f of fighters) expect(side.fighters.map((o) => o.kind)).toContain(f.kind);
      expect(b.capitals.filter((c) => c.team === team)).toHaveLength(side.capitals.length);
      expect(b.teams[team].tickets).toBe(BATTLE.tickets);
    }
    // the attacker's line is on the −axis side, the defender's on the +axis side
    expect(flagOf(b, 0).pos.x).toBeLessThan(0);
    expect(flagOf(b, 1).pos.x).toBeGreaterThan(0);
  });

  it('a fighter takes as many hits as it has hp, then it’s down and a ticket’s gone', () => {
    const b = make();
    b.setYou(0);
    const f = b.fighters.find((o) => o.team === 1);
    const hp = f.hp;
    let r = null;
    for (let i = 0; i < hp; i++) r = shotAt(b, f.pos);
    expect(r.down).toBe(true);
    expect(f.alive).toBe(false);
    expect(b.teams[1].tickets).toBe(BATTLE.tickets - 1);
    const events = run(b, 0.1);
    expect(events.some((e) => e.type === 'down' && e.team === 1 && e.mine)).toBe(true);
  });

  it('your shots don’t touch your own side', () => {
    const b = make();
    b.setYou(0);
    const f = b.fighters.find((o) => o.team === 0);
    expect(shotAt(b, f.pos)).toBeNull();
    expect(f.alive).toBe(true);
  });

  it('only the defender’s flagship has objectives', () => {
    const b = make();
    b.setYou(0);
    expect(flagOf(b, 0).subs).toHaveLength(0);
    expect(flagOf(b, 1).subs).toHaveLength(4);
    const subs = b.targets.filter((t) => t.sub);
    expect(subs.length).toBe(2); // phase 1: the two shield generators
    for (const t of subs) expect(flagOf(b, 1).subs.map((s) => s.id)).toContain(t.sub);
  });

  it('the shield holds everything off the flagship till both generators are down', () => {
    const b = make();
    b.setYou(0);
    const flag = flagOf(b, 1);
    const bridge = flag.subs.find((s) => s.kind === 'bridge');
    const before = bridge.hp;
    shotAt(b, bridge.pos, 5);
    expect(bridge.hp).toBe(before);
    const gens = flag.subs.filter((s) => s.kind === 'shieldgen');
    for (const g of gens) while (g.alive) shotAt(b, g.pos, 5);
    const events = run(b, 0.1);
    expect(b.phase).toBe(2);
    expect(events.some((e) => e.type === 'shield' && e.down)).toBe(true);
    expect(events.some((e) => e.type === 'phase' && e.phase === 2)).toBe(true);
    shotAt(b, bridge.pos, 5);
    expect(bridge.hp).toBe(before - 5 * BATTLE.youShare);
  });

  it('takes the phases only in order', () => {
    const b = make();
    b.setYou(0);
    const flag = flagOf(b, 1);
    const reactor = flag.subs.find((s) => s.kind === 'reactor');
    const hp = reactor.hp;
    for (let i = 0; i < 20; i++) shotAt(b, reactor.pos, 5);
    expect(reactor.hp).toBe(hp);
    expect(b.phase).toBe(1);
  });

  it('breaks the flagship and ends the battle when the reactor goes', () => {
    const b = make();
    b.setYou(0);
    const flag = flagOf(b, 1);
    for (const phase of [1, 2, 3]) {
      for (const s of flag.subs.filter((o) => o.phase === phase)) while (s.alive) shotAt(b, s.pos, 5);
      run(b, 0.1);
    }
    expect(flag.dying).toBeGreaterThan(0);
    const events = run(b, 10);
    expect(events.some((e) => e.type === 'capital' && e.team === 1)).toBe(true);
    expect(b.over).toEqual({ winner: 0, why: 'flagship' });
  });

  it('a dead player is not targeted', () => {
    const b = make();
    b.setYou(1);
    const you = { x: -60, y: 0, z: 0, alive: false };
    run(b, 6, you);
    expect(b.fighters.some((f) => f.target === b.you)).toBe(false);
  });

  it('the player is targeted only by the other side', () => {
    const b = make();
    b.setYou(0);
    const you = { x: 0, y: 0, z: 0, alive: true };
    run(b, 8, you);
    expect(b.fighters.filter((f) => f.team === 0).some((f) => f.target === b.you)).toBe(false);
    expect(b.fighters.filter((f) => f.team === 1).some((f) => f.target === b.you)).toBe(true);
  });

  it('hurts you with the other side’s fire', () => {
    const b = make();
    b.setYou(0);
    const you = { x: 0, y: 0, z: 0, alive: true };
    const events = run(b, 30, you);
    expect(events.some((e) => e.type === 'hurt' && e.damage > 0)).toBe(true);
  });

  it('no respawn without tickets', () => {
    const b = make();
    b.setYou(1);
    b.teams[0].tickets = 0;
    const f = b.fighters.find((o) => o.team === 0);
    while (f.alive) shotAt(b, f.pos, 5);
    run(b, 15);
    expect(f.alive).toBe(false);
    expect(b.teams[0].tickets).toBe(0);
  });

  it('brings a fighter back from its side’s tickets after a while', () => {
    const b = make();
    b.setYou(1);
    const f = b.fighters.find((o) => o.team === 0);
    while (f.alive) shotAt(b, f.pos, 5);
    const events = run(b, BATTLE.respawn[1] + 0.5);
    expect(f.alive).toBe(true);
    expect(events.some((e) => e.type === 'arrive' && e.team === 0)).toBe(true);
  });

  it('counts your shots on a subsystem for more than an AI’s torpedo', () => {
    const b = make();
    b.setYou(0);
    const g = flagOf(b, 1).subs.find((s) => s.kind === 'shieldgen');
    const hp = g.hp;
    shotAt(b, g.pos, 1);
    expect(hp - g.hp).toBeCloseTo(BATTLE.youShare, 9);
    // a torpedo from just off it, straight in
    const h2 = g.hp;
    b.fire(0, { x: g.pos.x, y: g.pos.y + 3, z: g.pos.z }, { x: 0, y: -1, z: 0 }, 'torpedo');
    run(b, 1);
    expect(h2 - g.hp).toBeCloseTo(BATTLE.bolts.torpedo.damage * BATTLE.aiShare, 6);
    expect(BATTLE.youShare).toBeGreaterThan(BATTLE.aiShare);
  });

  it('a battle left to itself ends within its clock', () => {
    const b = make({ perSide: 10, rand: seeded(11) });
    run(b, BATTLE.clock + 1, null, 1 / 20);
    expect(b.over).not.toBeNull();
    expect([0, 1]).toContain(b.over.winner);
    expect(b.clock).toBeLessThanOrEqual(BATTLE.clock + 0.1);
  });

  it('flies 64 fighters a frame quickly enough', () => {
    const b = make({ perSide: 32 });
    const t0 = performance.now();
    for (let i = 0; i < 1200; i++) b.update(1 / 60, { x: 0, y: 0, z: 0, alive: true });
    expect(performance.now() - t0).toBeLessThan(4000);
  });

  it('names what your guns lock on to', () => {
    const b = make();
    b.setYou(0);
    for (const t of b.targets) expect(typeof t.name).toBe('string');
    expect(b.targets.find((t) => t.kind === 'tie')?.name).toBe('TIE fighter');
    expect(b.targets.find((t) => t.sub === 'gen-port')?.name).toBe('Shield generator');
  });

  it('ends at once when asked (a dev hook)', () => {
    const b = make();
    b.end(1);
    expect(b.over).toEqual({ winner: 1, why: 'forced' });
  });

  // ── a battle in the galaxy (galaxy/warfront.js): its own size, round its planet, shared ──
  it('takes its own lines and radius', () => {
    const b = make({ lines: 120, radius: 200 });
    expect(flagOf(b, 0).pos.x).toBeCloseTo(-120);
    expect(flagOf(b, 1).pos.x).toBeCloseTo(120);
    expect(b.radius).toBe(200);
  });

  it('keeps a big fleet’s capital ships clear of each other', () => {
    const big = {
      ...war,
      sides: [
        { ...war.sides[0], capitals: [{ kind: 'moncal', role: 'flagship', size: 26, hull: 500 }, ...Array.from({ length: 6 }, (_, i) => ({ kind: i % 2 ? 'nebulon' : 'moncal', role: 'escort', size: i % 2 ? 6 : 22, hull: 200 }))] },
        { ...war.sides[1], capitals: [{ kind: 'executor', role: 'flagship', size: 110, hull: 2000 }, ...Array.from({ length: 5 }, () => ({ kind: 'destroyer', role: 'escort', size: 30, hull: 600 }))] },
      ],
    };
    const b = make({ war: big, lines: 100 });
    // side by side across the line, each as wide as it is (WIDTH: a share of its length)
    for (const team of [0, 1]) {
      const caps = b.capitals.filter((c) => c.team === team);
      for (let i = 0; i < caps.length; i++)
        for (let j = i + 1; j < caps.length; j++) {
          const across = Math.abs(caps[i].pos.z - caps[j].pos.z);
          const w = (WIDTH[caps[i].kind] * caps[i].size + WIDTH[caps[j].kind] * caps[j].size) / 2;
          expect(across, `${caps[i].kind} ${i} and ${caps[j].kind} ${j}`).toBeGreaterThan(w);
        }
    }
  });

  it('steers its fighters clear of what it’s told to keep out of (a planet, a shield)', () => {
    const inside = (avoid) => {
      const b = make({ perSide: 12, rand: seeded(5), avoid });
      const ball = { c: { x: 0, y: 0, z: 0 }, r: 30 };
      let n = 0;
      for (let i = 0; i < 600; i++) {
        b.update(1 / 30, null);
        for (const f of b.fighters) if (f.alive && Math.hypot(f.pos.x - ball.c.x, f.pos.y - ball.c.y, f.pos.z - ball.c.z) < ball.r) n++;
      }
      return n;
    };
    const free = inside([]);
    const kept = inside([{ c: { x: 0, y: 0, z: 0 }, r: 30 }]);
    expect(kept).toBeLessThan(free * 0.25);
  });

  it('counts what other pilots did to an objective, and tells what you did', () => {
    const done = new Map([['gen-port', 1000]]);
    const mine = [];
    const b = make({ shared: (id) => done.get(id) ?? 0, onMine: (id, dmg) => mine.push([id, dmg]) });
    b.setYou(0);
    const events = run(b, 0.1);
    expect(events.some((e) => e.type === 'sub' && e.sub === 'gen-port' && !e.mine)).toBe(true);
    const g = flagOf(b, 1).subs.find((s) => s.id === 'gen-star');
    shotAt(b, g.pos, 2);
    expect(mine).toEqual([['gen-star', 2 * BATTLE.youShare]]);
    done.set('gen-star', 1000);
    run(b, 0.1);
    expect(b.phase).toBe(2);
  });

  it('starts its clock where the shared schedule is, and ends on its own clock', () => {
    const b = make({ elapsed: 300, clock: 320, perSide: 4 });
    expect(b.clock).toBe(300);
    run(b, 30, null, 1 / 10);
    expect(b.over?.why).toBe('clock');
    expect(b.info.left).toBe(0);
  });

  it('ends on tickets as it always has, unless told not to', () => {
    const b = make({ perSide: 2 });
    b.teams[0].tickets = 0;
    for (const f of b.fighters) if (f.team === 0) (f.alive = false), (f.respawn = Infinity);
    run(b, 0.2);
    expect(b.over?.why).toBe('tickets');
  });

  it('lets the defender hold out: no tickets end when told so', () => {
    const b = make({ tickets: false, perSide: 2 });
    b.teams[0].tickets = 0;
    for (const f of b.fighters) if (f.team === 0) (f.alive = false), (f.respawn = Infinity);
    run(b, 2);
    expect(b.over).toBeNull();
  });
});
