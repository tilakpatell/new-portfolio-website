import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BATTLE, WIDTH, createBattle, inSights, perSide, turnToward } from './battle';
import { createDirector } from './battleDirector';
import { planFor } from './battlePlan';
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

describe('the flagships’ objectives', () => {
  // A shot stops at the first thing it meets, and a hull's spheres are among
  // them, so an objective buried in one can't be hit. Bolts at each from all
  // round its outer side, a frame's flight at a time (a bolt's 60 a second
  // and the ship's own, at 60 frames a second), through your guns' own hit():
  // a fair share of those that meet the flagship itself must meet the
  // objective (Home One's reactor, reached mostly from astern, is the least).
  it('can each be shot from outside: a fair share of bolts that meet the flagship from round an objective’s outer side meet it', () => {
    for (const w of Object.values(WARS))
      for (const attacker of [0, 1]) {
        const b = createBattle({ war: w, attacker, at: [0, 0, 0], axis: [1, 0], perSide: 4, rand: seeded() });
        b.setYou(attacker);
        const flag = flagOf(b, b.defender);
        const rand = seeded(11);
        for (const phase of [1, 2, 3]) {
          for (const s of flag.subs.filter((o) => o.phase === phase)) {
            const out = { x: s.pos.x - flag.pos.x, y: s.pos.y - flag.pos.y, z: s.pos.z - flag.pos.z };
            let reached = 0;
            let stopped = 0;
            for (let n = 0; n < 80; n++) {
              let d;
              do d = { x: rand() * 2 - 1, y: rand() * 2 - 1, z: rand() * 2 - 1 };
              while (Math.hypot(d.x, d.y, d.z) > 1 || d.x * out.x + d.y * out.y + d.z * out.z <= 0);
              const l = Math.hypot(d.x, d.y, d.z);
              let p = { x: s.pos.x + (d.x / l) * 40, y: s.pos.y + (d.y / l) * 40, z: s.pos.z + (d.z / l) * 40 };
              let hit = null;
              for (let f = 0; f < 30 && !hit; f++) {
                const q = { x: p.x - (d.x / l) * 2, y: p.y - (d.y / l) * 2, z: p.z - (d.z / l) * 2 };
                hit = b.hit(p, q, 0);
                p = q;
              }
              if (hit?.sub === s.id) reached++;
              else if ((hit?.shield || hit?.capital) && hit.id === flag.id) stopped++; // (its own hull, not an escort in the way)
            }
            expect(reached / (reached + stopped), `${w.id}: ${flag.kind} ${s.id}`).toBeGreaterThan(0.25);
          }
          // (then on to the next phase: each taken out point-blank, whatever's round it)
          for (const s of flag.subs.filter((o) => o.phase === phase)) for (let i = 0; i < 400 && s.alive; i++) b.hit(s.pos, { x: s.pos.x, y: s.pos.y - 0.01, z: s.pos.z }, 5);
          run(b, 0.1);
          expect(b.phase, `${w.id}: ${flag.kind} past phase ${phase}`).toBe(phase + 1);
        }
      }
  });
});

describe('the objectives on an Interdictor', () => {
  // the Empire's line with an Interdictor among its escorts
  const withInterdictor = { ...war, sides: [war.sides[0], { ...war.sides[1], capitals: [...war.sides[1].capitals, { kind: 'interdictor', role: 'escort', size: 11, hull: 220 }] }] };
  it('puts the defender’s objectives on the Interdictor, and leaves the flagship its hull', () => {
    const b = make({ war: withInterdictor, objectivesOn: 'interdictor' });
    const inter = b.capitals.find((c) => c.kind === 'interdictor');
    const flag = flagOf(b, 1);
    expect(inter.subs.map((x) => x.id)).toEqual(['gen-port', 'gen-star', 'bridge', 'reactor']);
    expect(flag.subs).toEqual([]);
    expect(flag.tracked).toBe(true);
    expect(inter.tracked).toBe(false);
    b.setYou(0);
    expect(b.targets.filter((t) => t.kind === 'subsystem').length).toBe(2);
  });
  it('wins the battle for the attacker when the Interdictor’s down', () => {
    const b = make({ war: withInterdictor, objectivesOn: 'interdictor', perSide: 0 });
    b.setYou(0);
    const inter = b.capitals.find((c) => c.kind === 'interdictor');
    for (const phase of [1, 2, 3]) {
      for (const s of inter.subs.filter((o) => o.phase === phase)) for (let i = 0; i < 400 && s.alive; i++) b.hit(s.pos, { x: s.pos.x, y: s.pos.y - 0.01, z: s.pos.z }, 5);
      run(b, 0.1);
    }
    const events = run(b, BATTLE.dying + 1);
    expect(b.over).toMatchObject({ winner: 0, why: 'interdictor' });
    expect(events.some((e) => e.type === 'over' && e.why === 'interdictor')).toBe(true);
    expect(flagOf(b, 1).alive).toBe(true);
  });
  it('without an Interdictor, they stay on the flagship', () => {
    const b = make({ objectivesOn: 'interdictor' });
    expect(flagOf(b, 1).subs.length).toBe(4);
  });
});

describe('an ace', () => {
  it('is one of its side’s fighters, of its own kind, named, with its own hull', () => {
    const b = make({ ace: { 1: { kind: 'tieadvanced', name: 'Darth Vader', hp: 14 } } });
    const aces = b.fighters.filter((f) => f.ace);
    expect(aces).toHaveLength(1);
    const [a] = aces;
    expect(a).toMatchObject({ team: 1, kind: 'tieadvanced' });
    expect(a.tgt.name).toBe('Darth Vader');
    expect(a.hp).toBe(14);
    expect(a.tgt.hpMax).toBe(14);
  });
  it('down, says so, and doesn’t come back', () => {
    const b = make({ ace: { 1: { kind: 'tieadvanced', name: 'Darth Vader', hp: 3 } } });
    b.setYou(0);
    const a = b.fighters.find((f) => f.ace);
    for (let i = 0; i < 10 && a.alive; i++) shotAt(b, a.pos, 1);
    const events = run(b, 0.1);
    expect(events.find((e) => e.type === 'down' && e.mine)).toMatchObject({ ace: true, kind: 'tieadvanced' });
    expect(a.respawn).toBe(Infinity);
  });
});

describe('runners', () => {
  it('escaping, win the battle for their side', () => {
    const b = make({ perSide: 0, runners: { team: 1, kind: 'transport', size: 2.2, hp: 34, count: 4, need: 3, speed: 20, every: 0.5, from: [0, 0, 0], to: [0, 30, 0] } });
    const events = run(b, 20);
    expect(events.filter((e) => e.type === 'escaped' && e.team === 1).length).toBe(3);
    expect(b.over).toMatchObject({ winner: 1, why: 'runners' });
  });
  it('all down, lose it', () => {
    const b = make({ perSide: 0, runners: { team: 1, kind: 'transport', size: 2.2, hp: 2, count: 2, need: 2, speed: 2, every: 0.5, from: [0, 0, 0], to: [0, 400, 0] } });
    b.setYou(0);
    for (let t = 0; t < 4 && !b.over; t += 1 / 30) {
      for (const r of b.runners) if (r.alive) shotAt(b, r.pos, 5);
      b.update(1 / 30, null);
    }
    expect(b.runners.length).toBe(2);
    expect(b.over).toMatchObject({ winner: 0, why: 'runners' });
  });
});

describe('the fixed step', () => {
  // The battle moves on BATTLE.step at a time whatever the frame rate (a
  // frame's time owed carried to the next), so the same seed fights the same
  // battle on a 144 Hz screen, a 60 Hz one, a phone at 30 and a browser
  // check at 10: the same events in the same order, every fighter in the
  // same place.
  const transports = { team: 1, kind: 'transport', size: 2.2, hp: 34, count: 4, need: 4, speed: 6, every: 25, from: [60, 0, 0], to: [60, 0, -300] };
  const stateOf = (b) =>
    JSON.stringify({
      clock: b.clock,
      phase: b.phase,
      over: b.over,
      tickets: b.teams.map((t) => t.tickets),
      fighters: b.fighters.map((f) => [f.alive, f.hp, ...[f.pos.x, f.pos.y, f.pos.z].map((x) => Math.round(x * 1e6))]),
      subs: b.capitals.flatMap((c) => c.subs.map((s) => s.hp)),
      hulls: b.capitals.map((c) => c.hull),
      runners: b.runners.map((r) => [r.alive, r.hp, ...[r.pos.x, r.pos.y, r.pos.z].map((x) => Math.round(x * 1e6))]),
    });
  const fight = (dt) => {
    const b = make({ perSide: 8, rand: seeded(21), runners: transports });
    const log = [];
    for (let i = 0, n = Math.round(120 / dt); i < n; i++) for (const e of b.update(dt, null)) log.push(e);
    return { log: JSON.stringify(log), state: stateOf(b), events: log.length };
  };
  it('fights the same battle at any frame rate: same seed, same events and state after 120 s at 1/144, 1/60, 1/30 and 0.1 s a frame', () => {
    const base = fight(1 / 30);
    expect(base.events).toBeGreaterThan(50); // (a battle, not a quiet sky)
    for (const dt of [1 / 144, 1 / 60, 0.1]) {
      const other = fight(dt);
      expect(other.state, `state at dt ${dt}`).toBe(base.state);
      expect(other.log, `events at dt ${dt}`).toBe(base.log);
    }
  });
  it('carries a frame shorter than a step over to the next, and says how far ahead the drawing is', () => {
    const b = make();
    b.update(0.02, null);
    expect(b.clock).toBe(0);
    expect(b.ahead).toBeCloseTo(0.02, 9);
    b.update(0.02, null);
    expect(b.clock).toBeCloseTo(BATTLE.step, 9);
    expect(b.ahead).toBeCloseTo(0.04 - BATTLE.step, 9);
  });
  it('takes at most BATTLE.steps a frame: a long frame’s rest is dropped, so the battle slows rather than leaping', () => {
    const b = make();
    b.update(2, null);
    expect(b.clock).toBeCloseTo(BATTLE.steps * BATTLE.step, 9);
    expect(b.ahead).toBeLessThan(BATTLE.step);
  });
  it('locks on to a fighter where it’s drawn: on along its way by the time still owed', () => {
    const b = make();
    b.setYou(0);
    b.update(0.05, null);
    const f = b.fighters.find((o) => o.team === 1 && o.alive);
    const t = b.targets.find((o) => o.id === f.id);
    expect(t.at.x).toBeCloseTo(f.pos.x + f.vel.x * b.ahead, 9);
    expect(t.at.z).toBeCloseTo(f.pos.z + f.vel.z * b.ahead, 9);
    // and a shot through where it's drawn hits it
    expect(shotAt(b, t.at)?.id).toBe(f.id);
  });
});

describe('the battle’s modules', () => {
  // (battle.js was one file over a thousand lines: it's split by what each
  // part does, the fighters' flying, the capital ships, the runners, so each
  // stays under the health check's warning line, scripts/health/big-files.mjs)
  it('each stay under 800 lines', () => {
    // (and the galaxy's shared battle beside them: its director, its plan, its stages in the sim)
    for (const file of ['battle.js', 'battleKit.js', 'battleAi.js', 'battleCapitals.js', 'battleRunners.js', 'battleDirector.js', 'battlePlan.js', 'battleStages.js', 'battleObjectives.js', 'battleProps.js', 'battleScene.js', 'battleFx.js']) {
      const lines = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8').split('\n').length;
      expect(lines, file).toBeLessThan(800);
    }
  });
});

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
    // (and says what it was: the galaxy's war counts a bomber down as an intercept)
    expect(events.find((e) => e.type === 'down' && e.mine).role).toBe(f.role);
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

  it('without tickets (the galaxy’s), brings a fighter back even once its side’s are spent', () => {
    // (tickets: false is a battle fought to its clock: the fighters keep
    // coming, and the count's only a count)
    const b = make({ tickets: false });
    b.setYou(1);
    b.teams[0].tickets = 0;
    const f = b.fighters.find((o) => o.team === 0);
    while (f.alive) shotAt(b, f.pos, 5);
    const events = run(b, BATTLE.respawn[1] + 0.5);
    expect(f.alive).toBe(true);
    expect(events.some((e) => e.type === 'arrive' && e.team === 0)).toBe(true);
    expect(b.teams[0].tickets).toBe(0);
  });

  it('lets the defender hold out: no tickets end when told so', () => {
    const b = make({ tickets: false, perSide: 2 });
    b.teams[0].tickets = 0;
    for (const f of b.fighters) if (f.team === 0) (f.alive = false), (f.respawn = Infinity);
    run(b, 2);
    expect(b.over).toBeNull();
  });

  // ── the set pieces' hooks (galaxy/warpieces/) ──
  it('lets an ion cannon disable a capital ship a while: its guns quiet, hits on it counting more', () => {
    const b = make({ perSide: 2 });
    b.setYou(0);
    const esc = b.capitals.find((c) => c.team === 1 && c.role === 'escort');
    const events = [];
    b.disable(esc.id, 5);
    events.push(...b.update(0.1, null));
    expect(events.some((e) => e.type === 'disabled' && e.id === esc.id)).toBe(true);
    expect(esc.disabled).toBeGreaterThan(0);
    // (its batteries hold their fire)
    for (const tu of esc.turrets) tu.turbo = tu.flak = 0;
    const firing = () => b.bolts.filter((o) => o.on && o.team === 1).length;
    const before = firing();
    b.update(0.05, null);
    const after = b.bolts.filter((o) => o.on && o.team === 1 && Math.hypot(o.x - esc.pos.x, o.y - esc.pos.y, o.z - esc.pos.z) < esc.size).length;
    expect(after).toBe(0);
    expect(before).toBeGreaterThanOrEqual(0);
    const hull = esc.hull;
    const sp = esc.spheres[0].c;
    b.hit({ x: sp.x, y: sp.y + 30, z: sp.z }, { x: sp.x, y: sp.y - 0.01, z: sp.z }, 1);
    expect(hull - esc.hull).toBeCloseTo(BATTLE.youShare * BATTLE.youHull * 3, 6);
    run(b, 6, null, 0.1);
    expect(esc.disabled).toBe(0);
  });

  it('makes its batteries targets: shot out, they’re quiet for good', () => {
    const b = make({ perSide: 2 });
    b.setYou(0);
    const cap = b.capitals.find((c) => c.team === 1 && c.role === 'escort');
    const tu = cap.turrets[0];
    expect(tu.alive).toBe(true);
    let hit = null;
    for (let i = 0; i < 20 && tu.alive; i++) hit = b.hit({ x: tu.at.x, y: tu.at.y + 2, z: tu.at.z }, { x: tu.at.x, y: tu.at.y - 0.01, z: tu.at.z }, 1);
    expect(tu.alive).toBe(false);
    expect(hit.kind).toBe('turret');
    const events = b.update(0.05, null);
    expect(events.some((e) => e.type === 'turret' && e.mine)).toBe(true);
    // the ones near you, on the lock's list
    b.update(0.05, { x: cap.pos.x, y: cap.pos.y + 4, z: cap.pos.z, alive: true });
    const near = b.targets.filter((t) => t.kind === 'turret');
    expect(near.length).toBeGreaterThan(0);
    expect(near.every((t) => t.id !== tu.num)).toBe(true);
  });

  it('moves and turns a capital ship with everything on it (its hull, batteries, objectives)', () => {
    const b = make({ perSide: 2 });
    const flag = flagOf(b, 1);
    const sub = flag.subs[0].pos;
    const was = { ...sub };
    const sp = { ...flag.spheres[0].c };
    b.moveCapital(flag, { x: 5, y: -2, z: 1 });
    expect(sub.x - was.x).toBeCloseTo(5);
    expect(flag.spheres[0].c.y - sp.y).toBeCloseTo(-2);
    const d0 = Math.hypot(sub.x - flag.pos.x, sub.y - flag.pos.y, sub.z - flag.pos.z);
    b.turnCapital(flag, { x: 0, y: 1, z: 0 }, 0.6);
    expect(Math.hypot(sub.x - flag.pos.x, sub.y - flag.pos.y, sub.z - flag.pos.z)).toBeCloseTo(d0, 6);
    expect(Math.hypot(flag.fwd.x, flag.fwd.y, flag.fwd.z)).toBeCloseTo(1, 6);
  });

  it('flies runners for the jump (Hoth’s transports): the other side goes for them, and they get away or don’t', () => {
    const b = make({ perSide: 8, rand: seeded(3) });
    const r = b.addRunner({ team: 0, kind: 'transport', size: 2.2, hp: 30, from: { x: -20, y: 0, z: 0 }, to: { x: -20, y: 0, z: -150 }, speed: 8 });
    expect(r.alive).toBe(true);
    const events = run(b, 24, null, 0.05);
    const done = events.find((e) => (e.type === 'escaped' || e.type === 'runner') && e.id === r.id);
    expect(done).toBeTruthy();
    // (the other side went after it)
    expect(r.hitBy).toBeGreaterThan(0);
  });
});

// Past 1.4 radii a battle never noticed you, and an unsworn pilot's shots
// went through it as if it weren't there. Now a couple of the other side's
// come out to its edge for you (out to BATTLE.edge radii), and unsworn, a
// side you fire on hunts you a while (BATTLE.grudge seconds), that side alone.
describe('a pilot at the battle’s edge, and an unsworn one', () => {
  // (across the lines from the middle, the radius 125: in the ring and past it)
  const ring = { x: 0, y: 0, z: 250, alive: true };
  const past = { x: 0, y: 0, z: 325, alive: true };
  const middle = { x: 0, y: 0, z: 0, alive: true };
  const onYou = (b) => b.fighters.filter((f) => f.alive && f.target === b.you);
  // a step at a time for `seconds`, `look(events, t)` after each (`you`: where you are, or a function saying where)
  const fly = (b, seconds, you, look = () => {}) => {
    for (let i = 0, n = Math.round(seconds * 30); i < n && !b.over; i++) look(b.update(1 / 30, typeof you === 'function' ? you() : you), (i + 1) / 30);
  };

  it('reaches out to 2.4 radii, two a side, and holds a grudge 45 seconds', () => {
    expect(BATTLE).toMatchObject({ edge: 2.4, edgeOn: 2, grudge: 45 });
  });

  for (const tactics of [false, true]) {
    const how = tactics ? ' (with tactics)' : '';
    it(`a pilot at the battle’s edge draws two interceptors at most${how}: the other side’s, on you within ten seconds, and one comes within 20`, () => {
      const b = make({ tactics });
      b.setYou(0);
      let most = 0;
      let first = Infinity;
      let nearest = Infinity;
      const teams = new Set();
      fly(b, 30, ring, (events, t) => {
        const on = onYou(b);
        most = Math.max(most, on.length);
        if (on.length) first = Math.min(first, t);
        for (const f of on) {
          teams.add(f.team);
          nearest = Math.min(nearest, Math.hypot(f.pos.x - ring.x, f.pos.y - ring.y, f.pos.z - ring.z));
        }
      });
      expect(most).toBeLessThanOrEqual(2);
      expect(first).toBeLessThanOrEqual(10);
      expect([...teams]).toEqual([1]);
      expect(nearest).toBeLessThan(20);
    });

    it(`past the edge nobody comes${how}`, () => {
      const b = make({ tactics });
      b.setYou(0);
      let most = 0;
      fly(b, 20, past, () => (most = Math.max(most, onYou(b).length)));
      expect(most).toBe(0);
    });

    it(`the edge is a fight${how}: its interceptors’ fire hurts you there`, () => {
      const b = make({ tactics });
      b.setYou(0);
      let hurt = 0;
      fly(b, 30, ring, (events) => (hurt += events.filter((e) => e.type === 'hurt').length));
      expect(hurt).toBeGreaterThan(0);
    });

    it(`point defence reaches the edge${how}: a battery fires its flak at you 15 off it, outside 1.4 radii`, () => {
      // (a tight battle, the radius 60, so a battery of the other side's sits near enough its edge)
      const b = make({ tactics, radius: 60 });
      b.setYou(0);
      const tu = b.capitals.filter((c) => c.team === 1).flatMap((c) => c.turrets).reduce((p, q) => (Math.hypot(q.at.x, q.at.y, q.at.z) > Math.hypot(p.at.x, p.at.y, p.at.z) ? q : p));
      // (15 further out from the middle than the battery, following it if its ship moves)
      const off = () => {
        const l = Math.hypot(tu.at.x, tu.at.y, tu.at.z);
        return { x: tu.at.x * (1 + 15 / l), y: tu.at.y * (1 + 15 / l), z: tu.at.z * (1 + 15 / l), alive: true };
      };
      const at = off();
      expect(Math.hypot(at.x, at.y, at.z)).toBeGreaterThan(60 * 1.4);
      let aimed = 0;
      const fire = b.fire;
      b.fire = (team, from, dir, kind, target) => {
        if (team === 1 && kind === 'flak') {
          const you = b.you.pos;
          const to = Math.hypot(you.x - from.x, you.y - from.y, you.z - from.z);
          const l = Math.hypot(dir.x, dir.y, dir.z);
          if (((you.x - from.x) * dir.x + (you.y - from.y) * dir.y + (you.z - from.z) * dir.z) / (to * l) > 0.98) aimed += 1;
        }
        return fire(team, from, dir, kind, target);
      };
      fly(b, 5, off);
      expect(aimed).toBeGreaterThan(0);
    });

    it(`an unsworn pilot who fires on a side is hunted by that side alone${how}, and only for its grudge`, () => {
      const b = make({ tactics });
      b.update(1 / 30, middle);
      const f = b.fighters.find((o) => o.alive && o.team === 1 && !o.ace);
      expect(shotAt(b, f.seen, 0.5)?.id).toBe(f.id);
      expect(b.you.angry[1]).toBeGreaterThan(0);
      expect(b.you.angry[0]).toBe(0);
      const by = [0, 0];
      fly(b, 20, middle, () => {
        for (const o of onYou(b)) by[o.team] += 1;
      });
      expect(by[0]).toBe(0);
      expect(by[1]).toBeGreaterThan(0);
      // (no more shots: once the grudge is out, nobody)
      fly(b, BATTLE.grudge + 5 - 20, middle);
      expect(b.you.angry).toEqual([0, 0]);
      expect(onYou(b)).toHaveLength(0);
    });
  }

  it('an unsworn pilot’s shot downs a fighter of either side, and its side holds the grudge', () => {
    const b = make();
    b.update(1 / 30, middle);
    const f = b.fighters.find((o) => o.alive && o.team === 0 && !o.ace);
    expect(shotAt(b, f.seen, 99)).toMatchObject({ id: f.id, kind: f.kind, size: f.size, down: true });
    expect(f.alive).toBe(false);
    expect(b.you.angry).toEqual([BATTLE.grudge, 0]);
    expect(b.update(1 / 30, middle).find((e) => e.type === 'down' && e.kind === f.kind && e.team === 0)).toMatchObject({ mine: true });
  });

  it('an unsworn pilot’s shot on a hull only lights it up: no damage, and that side’s grudge', () => {
    const b = make({ perSide: 2 });
    const shoot = (cap) => {
      const sp = cap.spheres[0].c;
      return b.hit({ x: sp.x, y: sp.y + 30, z: sp.z }, { x: sp.x, y: sp.y - 0.01, z: sp.z }, 1);
    };
    // (an escort’s bare hull, then the flagship that’s the objective, its shield up)
    const esc = b.capitals.find((c) => c.team === 0 && c.role === 'escort');
    const flag = flagOf(b, 1);
    const hulls = [esc.hull, flag.hull];
    expect(shoot(esc)).toEqual({ id: esc.id, kind: esc.kind, at: expect.any(Object), size: 0.4, down: false, capital: true });
    expect(b.you.angry).toEqual([BATTLE.grudge, 0]);
    expect(shoot(flag)).toEqual({ id: flag.id, kind: 'shield', at: expect.any(Object), size: 0.4, down: false, shield: true });
    expect(b.you.angry).toEqual([BATTLE.grudge, BATTLE.grudge]);
    expect([esc.hull, flag.hull]).toEqual(hulls);
    const lit = b.update(1 / 30, null).filter((e) => e.type === 'impact' && e.size === 0.6);
    expect(lit.map((e) => e.shield)).toEqual([false, true]);
  });

  it('an unsworn pilot’s shot at an ace counts nothing: the tally’s never told', () => {
    const plan = { ...planFor({ id: 'edge.ace', kind: 'assault', attacker: 0 }), side: [{ id: 'ace-1', type: 'ace', team: 1, at: 0, hp: 64, kind: 'tieadvanced', name: 'Darth Vader' }] };
    const d = createDirector({ plan, seed: plan.id });
    const told = [];
    const b = make({ tactics: true, tickets: false, plan, director: { state: () => d.state(60, () => 0) }, ace: { 1: { kind: 'tieadvanced', name: 'Darth Vader', hp: 64 } }, onMine: (id) => told.push(id) });
    fly(b, 0.1, middle);
    const ace = b.fighters.find((f) => f.ace);
    expect(ace.alive).toBe(true);
    for (let i = 0; i < 20; i++) expect(shotAt(b, ace.seen, 5)?.id).not.toBe(ace.id);
    fly(b, 0.1, middle);
    expect(ace.alive).toBe(true);
    expect(told).toEqual([]);
  });
});
