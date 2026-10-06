import { describe, expect, it } from 'vitest';
import { FACTIONS, FIGHT, HUNTER_KINDS, LOSE, NAMES, blocked, clearOf, createHunt, entryPoint, fightSpeed, hitRadius, packPlan, shipVelocity, slotsFor, turnRate, turnRateAt, turnToward } from './hunterRules';
import { KINDS as GALAXY_KINDS, FACTIONS as GALAXY_FACTIONS } from '../galaxy/hunted';

// a seeded random, so a fight is the same every time
const seeded = (seed = 7) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const DT = 1 / 60;
const start = (over = {}) => ({ x: 0, y: 0, z: 0, heading: 0, pitch: 0, speed: 0, vy: 0, ...over });
// the ship a frame on, flying along its nose
const move = (s) => {
  const level = Math.cos(s.pitch);
  const vy = Math.sin(s.pitch) * s.speed;
  return { ...s, x: s.x - Math.sin(s.heading) * level * s.speed * DT, y: s.y + vy * DT, z: s.z - Math.cos(s.heading) * level * s.speed * DT, vy };
};
// a fight flown for `seconds`: fly(ship, t) steers; each(hunt, ship, t) looks
// at every frame. Returns what happened, counted.
function fight({ seed = 7, seconds = 60, fly = (s) => s, opts = { size: 4, ace: false }, faction = 'empire', solids = [], ship = start(), each = null, kinds, factions } = {}) {
  const hunt = createHunt({ rand: seeded(seed), solids, kinds, factions });
  let s = ship;
  hunt.pack(faction, s, opts);
  const seen = { shots: 0, hits: 0, events: [], hunt };
  for (let t = 0; t < seconds; t += DT) {
    s = move(fly(s, t));
    for (const e of hunt.update(DT, s)) {
      if (e.type === 'shot') seen.shots += 1;
      else if (e.type === 'laser') seen.hits += 1;
      else seen.events.push(e.type);
    }
    each?.(hunt, s, t);
  }
  seen.ship = s;
  return seen;
}
const apart = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

describe('who comes', () => {
  it('sends a small pack with no ace the first time, and more of them the more trouble you make', () => {
    const f = FACTIONS.empire;
    for (let i = 0; i < 40; i++) {
      const first = packPlan(f, { first: true, heat: 5, rand: seeded(i + 1) });
      expect(first).toHaveLength(f.size[0]);
      expect(first).not.toContain(f.ace);
    }
    const mean = (heat) => {
      let n = 0;
      let aces = 0;
      for (let i = 0; i < 300; i++) {
        const kinds = packPlan(f, { heat, rand: seeded(i * 13 + 5) });
        expect(kinds.length).toBeGreaterThanOrEqual(f.size[0]);
        expect(kinds.length).toBeLessThanOrEqual(f.size[1]);
        n += kinds.length;
        aces += kinds.includes(f.ace) ? 1 : 0;
      }
      return { n: n / 300, aces: aces / 300 };
    };
    const calm = mean(0);
    const hot = mean(5);
    expect(hot.n).toBeGreaterThan(calm.n + 0.6);
    expect(hot.aces).toBeGreaterThan(calm.aces * 2);
    expect(calm.aces).toBeGreaterThan(0.03);
  });

  it('takes a size and an ace as given', () => {
    expect(packPlan(FACTIONS.empire, { size: 3, ace: true, rand: seeded() })).toEqual(['tieadvanced', expect.any(String), expect.any(String)]);
    expect(packPlan(FACTIONS.bugs, { size: 2, ace: true, rand: seeded() })).toEqual(['gromflomite', 'gromflomite']); // (no ace to send)
    expect(packPlan(FACTIONS.empire, { size: 4, ace: false, heat: 5, rand: seeded() })).not.toContain('tieadvanced');
  });

  it('lets only some of a pack attack at once', () => {
    expect([1, 2, 3, 4, 5, 6].map(slotsFor)).toEqual([1, 2, 2, 2, 3, 3]);
  });

  it('knows every kind a faction can send, here and in the galaxy', () => {
    for (const [factions, kinds] of [
      [FACTIONS, HUNTER_KINDS],
      [GALAXY_FACTIONS, GALAXY_KINDS],
    ]) {
      for (const f of Object.values(factions)) for (const k of [...f.kinds.map(([id]) => id), f.ace].filter(Boolean)) expect(kinds[k], k).toBeTruthy();
      // (each turns quicker than you do, 2 radians a second, so you can't just out-turn one)
      for (const type of Object.values(kinds)) expect(turnRate(type)).toBeGreaterThan(2);
    }
  });
});

describe('a bounty hunter', () => {
  it('comes alone, tough and quick, for either universe', () => {
    expect(packPlan(FACTIONS.fett, { size: 1, rand: seeded() })).toEqual(['slave1']);
    expect(packPlan(FACTIONS.phoenix, { size: 1, rand: seeded() })).toEqual(['phoenixperson']);
    expect(FACTIONS.fett.family).toBe('starwars');
    expect(FACTIONS.phoenix.family).toBe('rickmorty');
    for (const kind of ['slave1', 'phoenixperson']) {
      expect(HUNTER_KINDS[kind].hp).toBeGreaterThanOrEqual(5);
      expect(HUNTER_KINDS[kind].speed).toBeGreaterThan(20); // (faster than you boost: no outrunning one)
      expect(NAMES[kind]).toBeTruthy();
    }
    // and Slave I lands shots, and takes its six hits
    const seen = fight({ faction: 'fett', opts: { size: 1 }, seconds: 60 });
    expect(seen.shots).toBeGreaterThan(5);
    const h = seen.hunt.live[0];
    const through = () => seen.hunt.hit({ x: h.pos.x - 3, y: h.pos.y, z: h.pos.z }, { x: h.pos.x + 3, y: h.pos.y, z: h.pos.z }, 1);
    for (let i = 0; i < 5; i++) expect(through()?.down).toBeFalsy();
    expect(through()?.down).toBe(true);
  });
});

describe('where they come in', () => {
  const moon = { id: 'moon', at: [0, 0, 30], r: 9 };
  it('comes in behind you, ahead of you or out of portals, and never inside anything solid', () => {
    const ship = start();
    for (const mode of [{}, { ahead: true }, { portal: true }]) {
      for (let i = 0; i < 5; i++) {
        const p = entryPoint(ship, i, 5, { ...mode, rand: seeded(i + 3), solids: [moon, { id: 'rock', at: [0, 0, -40], r: 12 }] });
        const ahead = -p.z; // (the nose is along −z)
        if (mode.ahead || mode.portal) expect(ahead).toBeGreaterThan(5);
        else expect(ahead).toBeLessThan(-15);
        expect(apart(p, { x: 0, y: 0, z: 30 })).toBeGreaterThanOrEqual(moon.r + 1.99);
        expect(apart(p, { x: 0, y: 0, z: -40 })).toBeGreaterThanOrEqual(12 + 1.99);
      }
    }
  });

  it('moves a point out of a solid the way it already is from its middle', () => {
    const p = clearOf({ x: 1, y: 0, z: 30 }, [moon], 2);
    expect(apart(p, { x: 0, y: 0, z: 30 })).toBeCloseTo(11, 6);
    expect(p.x).toBeCloseTo(11, 6);
    expect(clearOf({ x: 50, y: 0, z: 0 }, [moon])).toEqual({ x: 50, y: 0, z: 0 });
    // out of one and into its neighbour: out of that too
    const pair = [moon, { id: 'twin', at: [12, 0, 30], r: 9 }];
    const q = clearOf({ x: 5, y: 0.5, z: 30 }, pair, 2);
    for (const o of pair) expect(apart(q, { x: o.at[0], y: o.at[1], z: o.at[2] })).toBeGreaterThanOrEqual(o.r + 2 - 1e-6);
  });
});

describe('how they turn', () => {
  it('turns a direction toward another by no more than it may, the short way', () => {
    const d = [0, 0, -1];
    expect(turnToward(d, [1, 0, 0], 0.1)).toBeCloseTo(0.1, 6);
    expect(Math.atan2(d[0], -d[2])).toBeCloseTo(0.1, 6);
    expect(Math.hypot(...d)).toBeCloseTo(1, 6);
    // near enough: all the way, and no further
    const e = [0, 0, -1];
    turnToward(e, [Math.sin(0.05), 0, -Math.cos(0.05)], 0.1);
    expect(e[0]).toBeCloseTo(Math.sin(0.05), 6);
  });

  it('turns a small angle toward it too, however little it may turn in a frame', () => {
    // (a 240 Hz frame: the angle left is tiny, and so is the turn allowed)
    const d = [Math.sin(0.018), 0, -Math.cos(0.018)];
    turnToward(d, [0, 0, -1], 0.01);
    expect(Math.atan2(d[0], -d[2])).toBeCloseTo(0.008, 6);
  });

  it('comes round from dead astern, level, to its own side', () => {
    for (const side of [1, -1]) {
      const d = [0, 0, -1];
      let turned = 0;
      for (let i = 0; i < 400 && turned < Math.PI - 1e-3; i++) turned += turnToward(d, [0, 0, 1], 0.05, side);
      expect(d[2]).toBeCloseTo(1, 3);
      expect(turned).toBeCloseTo(Math.PI, 2);
      const first = [0, 0, -1];
      turnToward(first, [0, 0, 1], 0.05, side);
      expect(Math.sign(first[0])).toBe(side);
      expect(first[1]).toBeCloseTo(0, 6);
    }
  });
});

describe('what they know of you', () => {
  it('reads the way you are really going, climbing and diving too', () => {
    expect(shipVelocity({ heading: 0, pitch: 0, speed: 10, vy: 0 })).toEqual([-0, 0, -10]);
    const up = shipVelocity({ heading: 0, pitch: 1, speed: 10 }); // (no vy given: along the nose)
    expect(up[1]).toBeCloseTo(10 * Math.sin(1), 6);
    expect(up[2]).toBeCloseTo(-10 * Math.cos(1), 6);
    expect(shipVelocity({ heading: 0, pitch: 1, speed: 10, vy: 3 })[1]).toBe(3); // (the ship's own word for it)
  });

  it('knows when something solid is in the way', () => {
    const moon = [{ at: [0, 0, 0], r: 5 }];
    expect(blocked({ x: -20, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }, moon)).toBe(true);
    expect(blocked({ x: -20, y: 6, z: 0 }, { x: 20, y: 6, z: 0 }, moon)).toBe(false);
    expect(blocked({ x: -20, y: 0, z: 0 }, { x: -10, y: 0, z: 0 }, moon)).toBe(false); // (it stops short of it)
  });
});

describe('the pace of a fight', () => {
  const tie = HUNTER_KINDS.tie;
  const interceptor = HUNTER_KINDS.interceptor;
  it('flies the fight at a little over your speed, never under its floor nor over its top', () => {
    // at cruise, close in: near you, not its top
    expect(fightSpeed(tie, 5.5, 8)).toBeLessThan(11);
    expect(fightSpeed(tie, 5.5, 8)).toBeGreaterThan(5.5);
    // sitting still: the floor
    expect(fightSpeed(tie, 0, 8)).toBeCloseTo(tie.speed * FIGHT.floor, 9);
    // boosting at 20: a TIE flat out (you can outrun one), an interceptor with you
    expect(fightSpeed(tie, 20, 8)).toBe(tie.speed);
    expect(fightSpeed(interceptor, 20, 8)).toBeGreaterThan(20);
    expect(fightSpeed(interceptor, 20, 8)).toBeLessThanOrEqual(interceptor.speed);
    // far off, it comes in flat out whatever you're doing; between, in between
    expect(fightSpeed(tie, 0, FIGHT.closeFrom + 5)).toBe(tie.speed);
    const mid = fightSpeed(tie, 0, (FIGHT.engageAt + FIGHT.closeFrom) / 2);
    expect(mid).toBeGreaterThan(tie.speed * FIGHT.floor);
    expect(mid).toBeLessThan(tie.speed);
  });

  it('turns a little quicker than you at the fight’s speed, and less at its top', () => {
    for (const type of Object.values(HUNTER_KINDS)) {
      expect(turnRate(type)).toBeGreaterThan(2);
      expect(turnRate(type)).toBeLessThan(3.3);
      expect(turnRateAt(type, type.speed * FIGHT.floor)).toBeCloseTo(turnRate(type), 9);
      expect(turnRateAt(type, type.speed)).toBeCloseTo(turnRate(type) * (1 - FIGHT.stiff), 9);
      expect(turnRateAt(type, type.speed * 2)).toBeCloseTo(turnRate(type) * (1 - FIGHT.stiff), 9);
    }
  });

  it('is flown at your pace: at cruise, the ones coming at you are slow enough to follow, and still shoot', () => {
    const near = { run: [0, 0], set: [0, 0] };
    let fastestRun = 0;
    let shots = 0;
    for (const seed of [7, 12]) {
      const seen = fight({
        seed,
        seconds: 50,
        fly: (s) => ({ ...s, speed: 5.5, heading: s.heading + 0.3 * DT }),
        each: (hunt, s, t) => {
          if (t < 6) return; // (in from where they came)
          for (const h of hunt.live) {
            if (apart(h.pos, s) > FIGHT.engageAt) continue;
            const v = Math.hypot(h.vel.x, h.vel.y, h.vel.z);
            const k = h.mode === 'set' ? 'set' : 'run';
            near[k][0] += v;
            near[k][1] += 1;
            if (k === 'run') fastestRun = Math.max(fastestRun, v);
          }
        },
      });
      shots += seen.shots;
    }
    expect(near.run[1]).toBeGreaterThan(200);
    expect(near.run[0] / near.run[1]).toBeLessThan(10); // (on a run at you: near your own speed)
    expect(fastestRun).toBeLessThan(HUNTER_KINDS.tie.speed * 0.8);
    expect(near.set[0] / near.set[1]).toBeLessThan(13); // (swinging out past you: quicker, but not flat out)
    expect(shots).toBeGreaterThan(40);
  });

  it('gets out ahead of you to turn in: a run starts in front of you, even while you turn', () => {
    let runs = 0;
    let ahead = 0;
    for (const seed of [3, 9, 20]) {
      const mode = new Map();
      fight({
        seed,
        seconds: 60,
        fly: (s) => ({ ...s, speed: 5.5, heading: s.heading + 0.3 * DT }),
        each: (hunt, s) => {
          for (const h of hunt.live) {
            if (mode.get(h.id) === 'set' && h.mode === 'run') {
              runs += 1;
              if ((h.pos.x - s.x) * -Math.sin(s.heading) + (h.pos.z - s.z) * -Math.cos(s.heading) > 0) ahead += 1;
            }
            mode.set(h.id, h.mode);
          }
        },
      });
    }
    expect(runs).toBeGreaterThan(60);
    expect(ahead / runs).toBeGreaterThan(0.85);
  });

  it('opens up with you when you boost: the pack keeps pace, an interceptor faster than a TIE', () => {
    // a fight at cruise, then the boost: the same pack, near you, before and after
    const cruise = [0, 0];
    const boost = [0, 0];
    let tie = 0;
    let fast = 0;
    fight({
      seconds: 24,
      opts: { size: 4, ace: false },
      fly: (s, t) => ({ ...s, speed: t < 10 ? 5.5 : 20 }),
      each: (hunt, s, t) => {
        for (const h of hunt.live) {
          if (apart(h.pos, s) > 45 || h.mode === 'tail') continue;
          const v = Math.hypot(h.vel.x, h.vel.y, h.vel.z);
          if (t > 4 && t < 10) {
            cruise[0] += v;
            cruise[1] += 1;
          }
          if (t > 13) {
            boost[0] += v;
            boost[1] += 1;
            if (h.kind === 'tie') tie = Math.max(tie, v);
            else fast = Math.max(fast, v);
          }
        }
      },
    });
    expect(cruise[1]).toBeGreaterThan(100);
    expect(boost[1]).toBeGreaterThan(100);
    expect(boost[0] / boost[1]).toBeGreaterThan(cruise[0] / cruise[1] + 5); // (they open up with you)
    expect(tie).toBeGreaterThan(15);
    expect(tie).toBeLessThanOrEqual(HUNTER_KINDS.tie.speed + 1e-6);
    if (fast > 0) expect(fast).toBeGreaterThan(tie);
  });

  it('flies after prey at its floor, not flat out', () => {
    const hunt = createHunt({ rand: seeded(5) });
    const prey = { at: { x: 0, y: 0, z: -12 }, dir: (out) => ((out[0] = 0), (out[1] = 0), (out[2] = -1)), alive: () => true };
    let s = start();
    hunt.pack('bugs', s, { prey, size: 2 });
    let fastest = 0;
    for (let t = 0; t < 20; t += DT) {
      s = move(s);
      hunt.update(DT, s);
      if (t < 6) continue;
      for (const h of hunt.live) if (Math.hypot(h.pos.x - prey.at.x, h.pos.y - prey.at.y, h.pos.z - prey.at.z) < FIGHT.engageAt) fastest = Math.max(fastest, Math.hypot(h.vel.x, h.vel.y, h.vel.z));
    }
    expect(fastest).toBeGreaterThan(0);
    expect(fastest).toBeLessThan(HUNTER_KINDS.gromflomite.speed * 0.75);
  });
});

describe('a fight', () => {
  it('says they are coming, and they shoot at you however you fly', () => {
    const flying = {
      still: (s) => s,
      cruising: (s) => ({ ...s, speed: 5.5 }),
      // (these two shook the old ones off entirely: their station swung round with your nose)
      spinning: (s) => ({ ...s, heading: s.heading + 2 * DT }),
      circling: (s) => ({ ...s, speed: 5.5, heading: s.heading + DT }),
      looping: (s, t) => ({ ...s, speed: 12, heading: s.heading + Math.sin(t * 1.3) * 1.4 * DT, pitch: Math.sin(t * 0.9) * 0.6 }),
    };
    for (const [name, fly] of Object.entries(flying)) {
      let shots = 0;
      let hits = 0;
      for (const seed of [3, 11, 29]) {
        const seen = fight({ seed, fly });
        expect(seen.events[0], name).toBe('hunted');
        shots += seen.shots;
        hits += seen.hits;
      }
      expect(shots, `${name}: shots`).toBeGreaterThan(30); // (ten a minute at the very least)
      expect(hits, `${name}: hits`).toBeGreaterThan(0);
      // a cloud of lasers, not a wall: most miss
      expect(hits / shots, `${name}: accuracy`).toBeLessThan(0.4);
    }
  });

  it('is as dangerous at any frame rate', () => {
    const at = (hz) => {
      const hunt = createHunt({ rand: seeded(21) });
      let s = start({ speed: 5.5 });
      hunt.pack('empire', s, { size: 4, ace: false });
      let shots = 0;
      for (let t = 0; t < 120; t += 1 / hz) {
        s = { ...s, z: s.z - s.speed / hz };
        for (const e of hunt.update(1 / hz, s)) if (e.type === 'shot') shots += 1;
      }
      return shots;
    };
    const slow = at(30);
    const fast = at(144);
    expect(slow).toBeGreaterThan(40);
    expect(slow / fast).toBeGreaterThan(0.6);
    expect(slow / fast).toBeLessThan(1.6);
  });

  it('puts no more of a pack on a run at once than it has places for', () => {
    let most = 0;
    const seen = fight({
      opts: { size: 5, ace: false },
      fly: (s) => ({ ...s, speed: 5.5, heading: s.heading + 0.5 * DT }),
      each: (hunt) => {
        const on = hunt.live.filter((h) => h.mode !== 'set').length;
        most = Math.max(most, on);
        expect(on).toBeLessThanOrEqual(slotsFor(5));
        expect(hunt.packs[0].attacking).toBe(on);
      },
    });
    expect(most).toBe(slotsFor(5));
    expect(seen.shots).toBeGreaterThan(10);
  });

  it('keeps them apart from each other', () => {
    let nearest = Infinity;
    fight({
      opts: { size: 5, ace: false },
      seconds: 40,
      each: (hunt, s, t) => {
        if (t < 2) return; // (out of the formation they came in)
        for (const a of hunt.live) for (const b of hunt.live) if (a.id < b.id) nearest = Math.min(nearest, apart(a.pos, b.pos));
      },
    });
    expect(nearest).toBeGreaterThan(0.35); // (more than one of them is wide)
  });

  it('flies round a planet, never through it, and holds its fire behind it', () => {
    // you sit one side of a moon; they come in on the far side of it
    const moon = { id: 'moon', at: [0, 0, 22], r: 8 };
    let deepest = Infinity;
    const seen = fight({
      solids: [moon],
      seconds: 30,
      each: (hunt) => {
        for (const h of hunt.live) deepest = Math.min(deepest, apart(h.pos, { x: 0, y: 0, z: 22 }) - moon.r);
        for (const l of hunt.lasers) if (l.on) expect(apart(l, { x: 0, y: 0, z: 22 })).toBeGreaterThan(moon.r - 0.7); // (a frame's flight at most)
      },
    });
    expect(deepest).toBeGreaterThan(0);
    expect(seen.shots).toBeGreaterThan(3); // (they got round it to you)
  });

  it('comes in after you when you are down in something (a trench)', () => {
    // inside the solid's own radius, as the Death Star's trench is: it isn't in their way
    const station = { id: 'station', at: [0, -30, 0], r: 30.5 }; // (you're half a unit under its skin)
    const seen = fight({ solids: [station], seconds: 30 });
    expect(seen.shots).toBeGreaterThan(3);
  });

  it('gives up once you have outrun them, and flies off', () => {
    const seen = fight({ fly: (s) => ({ ...s, speed: 60 }), seconds: LOSE.after + 30 });
    expect(seen.events).toContain('escaped');
    expect(seen.hunt.active).toBe(false);
    expect(seen.hunt.targets).toHaveLength(0);
    expect(seen.hunt.count).toBe(0); // (out of sight, and gone)
  });

  it('leave() sends them all off without a moment’s vanishing, gone once well away from whoever’s looking', () => {
    const hunt = createHunt({ rand: seeded(3) });
    const you = start();
    hunt.pack('empire', you, { size: 3, ace: false });
    for (let t = 0; t < 3; t += DT) hunt.update(DT, you);
    hunt.leave();
    hunt.update(DT, you);
    expect(hunt.count).toBe(3); // (still there)
    expect(hunt.active).toBe(false);
    expect(hunt.targets).toHaveLength(0); // (nothing for the guns: they're leaving)
    let shots = 0;
    let t = 0;
    for (; t < 60 && hunt.count; t += DT) for (const e of hunt.update(DT, you)) if (e.type === 'shot') shots += 1;
    expect(shots).toBe(0);
    expect(hunt.count).toBe(0);
    expect(t).toBeGreaterThan(2);
  });

  it('all leave when you stop flying', () => {
    const hunt = createHunt({ rand: seeded() });
    hunt.pack('federation', start(), { size: 3 });
    hunt.update(DT, start());
    expect(hunt.count).toBe(3);
    hunt.update(DT, null);
    expect(hunt.count).toBe(0);
    expect(hunt.active).toBe(false);
  });

  it('has the quick ones sit on your tail now and then, and lets go of the place when they break off', () => {
    let tailed = 0;
    for (const seed of [2, 5, 9, 14]) {
      fight({
        seed,
        opts: { size: 2, ace: true },
        fly: (s) => ({ ...s, speed: 5.5 }),
        each: (hunt) => {
          for (const h of hunt.live) {
            if (h.mode !== 'tail') continue;
            tailed += 1;
            expect(h.type.tail).toBeGreaterThan(0);
            expect(h.clock).toBeLessThanOrEqual(FIGHT.tailFor[1] + DT);
          }
          expect(hunt.packs[0].attacking).toBe(hunt.live.filter((h) => h.mode !== 'set').length);
        },
      });
    }
    expect(tailed).toBeGreaterThan(30); // (half a second of it, at the least)
  });

  it('goes after prey instead, until you shoot at them or it gets away', () => {
    const prey = { at: { x: 30, y: 0, z: -30 }, there: true, alive: () => prey.there, dir: (out) => Object.assign(out, [0, 0, 1]) };
    const hunt = createHunt({ rand: seeded(4) });
    hunt.pack('bugs', start(), { prey, size: 2, ace: false });
    let atYou = 0;
    const flown = (seconds) => {
      for (let t = 0; t < seconds; t += DT) for (const e of hunt.update(DT, start())) if (e.type === 'shot' || e.type === 'laser') atYou += 1;
    };
    flown(20);
    expect(atYou).toBe(0);
    expect(hunt.active).toBe(false); // (not after you)
    expect(hunt.targets.every((c) => c.threat === 0)).toBe(true);
    expect(hunt.lasers.some((l) => l.on && l.at === 'prey') || hunt.count === 2).toBe(true);
    // a shot of yours into one: they turn on you
    const h = hunt.live[0];
    const got = hunt.hit({ x: h.pos.x, y: h.pos.y, z: h.pos.z - 1 }, h.pos, 1);
    expect(got).toMatchObject({ kind: 'gromflomite', down: true });
    expect(hunt.active).toBe(true);
    flown(30);
    expect(atYou).toBeGreaterThan(0);
    // and a pack whose prey got away, unprovoked, leaves
    const other = createHunt({ rand: seeded(4) });
    other.pack('bugs', start(), { prey, size: 2, ace: false });
    other.update(DT, start());
    prey.there = false;
    const events = [];
    for (let t = 0; t < 1; t += DT) events.push(...other.update(DT, start()).map((e) => e.type));
    expect(other.targets).toHaveLength(0);
    expect(events).not.toContain('escaped'); // (they weren't after you)
  });
});

describe('shooting them', () => {
  it('takes a hit along the whole of a bolt’s way, the tough ones more than one, and says when the pack is cleared', () => {
    const hunt = createHunt({ rand: seeded() });
    const [ace, tie] = hunt.pack('empire', start(), { size: 2, ace: true });
    hunt.update(DT, start());
    expect(ace.kind).toBe('tieadvanced');
    const through = (h) => hunt.hit({ x: h.pos.x - 3, y: h.pos.y, z: h.pos.z }, { x: h.pos.x + 3, y: h.pos.y, z: h.pos.z }, 1);
    expect(hunt.hit({ x: 500, y: 0, z: 0 }, { x: 503, y: 0, z: 0 })).toBeNull();
    const first = through(ace);
    expect(first).toMatchObject({ id: ace.id, kind: 'tieadvanced', down: false });
    expect(hunt.targets.find((c) => c.id === ace.id)).toMatchObject({ hp: 4, hpMax: 5 });
    // a fusion cannon's bolt is worth three
    expect(hunt.hit({ x: ace.pos.x - 3, y: ace.pos.y, z: ace.pos.z }, { x: ace.pos.x + 3, y: ace.pos.y, z: ace.pos.z }, 3)).toMatchObject({ down: false });
    expect(through(ace)).toMatchObject({ down: true, at: { x: ace.pos.x, y: ace.pos.y, z: ace.pos.z } });
    expect(hunt.count).toBe(1);
    expect(through(tie)).toMatchObject({ kind: expect.stringMatching(/tie|interceptor/), down: true });
    expect(hunt.update(DT, start()).map((e) => e.type)).toContain('cleared');
    expect(hunt.active).toBe(false);
  });

  it('counts a shot passing within its hit radius, and not one just outside it', () => {
    const hunt = createHunt({ rand: seeded(4) });
    const [h] = hunt.pack('empire', start(), { size: 1, ace: false });
    const r = hitRadius(h.type);
    expect(r).toBeGreaterThan(h.type.size);
    const past = (off) => hunt.hit({ x: h.pos.x - 3, y: h.pos.y + off, z: h.pos.z }, { x: h.pos.x + 3, y: h.pos.y + off, z: h.pos.z }, 1);
    expect(past(r + 0.02)).toBeNull();
    expect(past(r - 0.02)).toMatchObject({ down: true });
  });

  it('takes a hit told to it by number (another pilot’s shot), and nothing for one it doesn’t have', () => {
    const hunt = createHunt({ rand: seeded() });
    const [a, b] = hunt.pack('federation', start(), { size: 2 });
    expect(hunt.damage(999)).toBeNull();
    expect(hunt.damage(a.id, 1)).toMatchObject({ id: a.id, kind: 'patrol', down: false });
    expect(hunt.damage(a.id, 1)).toMatchObject({ down: true });
    expect(hunt.damage(a.id, 1)).toBeNull(); // (it's gone)
    expect(hunt.wire()).toEqual([[b.id, 'patrol', b.pos.x, b.pos.y, b.pos.z, b.vel.x, b.vel.y, b.vel.z, 2]]);
  });

  it('gives the guns everyone in the fight, the ones on a run as threats', () => {
    let threats = 0;
    fight({
      seconds: 20,
      each: (hunt) => {
        const t = hunt.targets;
        expect(t).toHaveLength(hunt.count);
        for (const c of t) {
          const h = hunt.live.find((o) => o.id === c.id);
          expect(c.at).toBe(h.pos);
          expect(c.threat).toBe(h.mode === 'set' ? 0 : 1);
          threats += c.threat;
        }
      },
    });
    expect(threats).toBeGreaterThan(0);
  });
});
