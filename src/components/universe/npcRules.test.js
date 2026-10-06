import { describe, expect, it } from 'vitest';
import { BRAINS, NPC, createBrains } from './npcRules';

// a seeded random, so a meeting is the same every time
const seeded = (seed = 7) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const DT = 1 / 60;
const apart = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const finite = (p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
// you, flying along your nose at `speed` (heading 0 is −z)
const you = (over = {}) => ({ x: 0, y: 0, z: 0, heading: 0, pitch: 0, speed: 0, ...over });
const fly = (s) => ({ ...s, x: s.x - Math.sin(s.heading) * s.speed * DT, z: s.z - Math.cos(s.heading) * s.speed * DT });

// a character of our own, for the engine alone (the registry's are npcs/index.js's)
const spec = (brain, over = {}) => ({ id: `test-${brain}`, side: 'breakingbad', role: 'neutral', ship: 'saulcaddy', brain, relations: { fears: [], hunts: [] }, stats: { speed: 16, accel: 14, turn: 2.4, hp: 6, fire: [0.6, 1.1], damage: 6 }, ...over });

// a meeting flown for `seconds`: each(brains, ship, out, t) looks at every frame; world(t) gives what's about
function meet(npc, { at = { x: 30, y: 0, z: 0 }, seconds = 30, ship = you(), steer = (s) => s, world = () => ({}), seed = 3, each } = {}) {
  const brains = createBrains({ rand: seeded(seed) });
  const n = brains.add(npc, at);
  let s = ship;
  const seen = { says: [], events: [], shots: [], n, brains };
  for (let t = 0; t < seconds; t += DT) {
    s = fly(steer(s, t));
    const out = brains.update(DT, { you: s, hunters: [], stations: [], ...world(t, s) });
    for (const e of out.events) {
      seen.events.push(e);
      if (e.type === 'say') seen.says.push(e.key);
      if (e.type === 'shot') seen.shots.push(e);
    }
    for (const m of brains.live) expect(finite(m.pos)).toBe(true);
    each?.(brains, s, out, t);
  }
  seen.ship = s;
  return seen;
}
const types = (seen) => seen.events.map((e) => e.type);

describe('the brains', () => {
  it('has a brain for each kind of character, and takes no character without one', () => {
    for (const b of ['wingman', 'bounty', 'merchant', 'informant', 'rival']) expect(typeof BRAINS[b], b).toBe('function');
    const brains = createBrains({ rand: seeded() });
    expect(brains.add(spec('nonsense'), { x: 0, y: 0, z: 0 })).toBeNull();
    const n = brains.add(spec('merchant'), { x: 0, y: 0, z: 0 });
    expect(brains.live.map((m) => m.n)).toEqual([n]);
    brains.remove(n);
    expect(brains.live).toHaveLength(0);
  });

  it('hands a wingman to the wing and a bounty hunter to the hunt, and flies neither itself', () => {
    const wing = meet(spec('wingman', { ship: 'birdperson' }), { seconds: 2 });
    expect(wing.events).toContainEqual(expect.objectContaining({ type: 'delegate', via: 'wing', kind: 'birdperson', n: wing.n }));
    const bounty = meet(spec('bounty', { faction: 'fett', ship: 'slave1' }), { seconds: 2 });
    expect(bounty.events).toContainEqual(expect.objectContaining({ type: 'delegate', via: 'hunt', faction: 'fett', n: bounty.n }));
    // (once only, and they stay where they were put: the wing and the hunt fly them)
    expect(types(wing).filter((t) => t === 'delegate')).toHaveLength(1);
    expect(wing.brains.live[0].pos).toEqual({ x: 30, y: 0, z: 0 });
  });

  it('says it has seen you once, the first time you come near', () => {
    const seen = meet(spec('merchant'), { at: { x: NPC.seen + 20, y: 0, z: 0 }, ship: you({ heading: -Math.PI / 2, speed: 6 }), seconds: 12 });
    expect(seen.says.filter((k) => k === 'seen')).toHaveLength(1);
  });
});

describe('a merchant', () => {
  const stations = [
    { id: 'far', at: { x: 400, y: 0, z: 0 }, r: 4 },
    { id: 'near', at: { x: 60, y: 0, z: -20 }, r: 4 },
  ];
  it('flies to the nearest station and parks there, then offers you a part once when you come by', () => {
    let parked = null;
    const seen = meet(spec('merchant'), {
      at: { x: 20, y: 0, z: 0 },
      seconds: 40,
      // (you sit still a while, then fly over to it)
      steer: (s, t) => (t < 20 ? s : { ...s, heading: Math.atan2(-(60 - s.x), -(-20 - s.z)), speed: apart(s, { x: 60, y: 0, z: -20 }) > 8 ? 10 : 0 }),
      world: () => ({ stations }),
      each: (brains, s, out, t) => {
        if (t > 18 && t < 19) parked = { ...brains.live[0].pos };
      },
    });
    expect(apart(parked, stations[1].at)).toBeLessThan(stations[1].r + NPC.park + 1);
    const offers = seen.events.filter((e) => e.type === 'offer');
    expect(offers).toHaveLength(1);
    expect(seen.says).toContain('hello');
  });

  it('runs from a fight, says so, and is gone once well away', () => {
    let left = false;
    const seen = meet(spec('merchant'), {
      at: { x: 10, y: 0, z: 0 },
      seconds: 30,
      world: (t) => ({ stations, hunters: t > 5 ? [{ id: 1, at: { x: 58, y: 0, z: -14 }, faction: 'empire' }] : [] }), // (a fight comes to its station)
      each: (brains) => {
        if (brains.live[0]?.leaving) left = true;
      },
    });
    expect(left).toBe(true);
    expect(seen.says).toContain('leaving');
    expect(types(seen)).toContain('gone');
    expect(seen.brains.live).toHaveLength(0);
  });
});

describe('an informant', () => {
  it('flies up to you, says hello and tells you what’s coming, then leaves', () => {
    let closest = Infinity;
    const seen = meet(spec('informant'), {
      at: { x: 80, y: 4, z: 30 },
      ship: you({ speed: 5 }),
      seconds: 50,
      world: () => ({ next: { id: 'roadblock', in: 40 } }),
      each: (brains, s) => {
        for (const m of brains.live) closest = Math.min(closest, apart(m.pos, s));
      },
    });
    expect(closest).toBeLessThan(NPC.alongside + 2);
    expect(closest).toBeGreaterThan(1); // (alongside, not into you)
    expect(seen.events).toContainEqual(expect.objectContaining({ type: 'tip', next: { id: 'roadblock', in: 40 } }));
    const say = seen.says;
    expect(say.indexOf('hello')).toBeGreaterThanOrEqual(0);
    expect(say.indexOf('leaving')).toBeGreaterThan(say.indexOf('hello'));
    expect(types(seen)).toContain('gone');
  });
});

describe('a rival', () => {
  it('dogfights you: stays in the fight, shoots at you (a cloud, not a wall), and is on the guns', () => {
    let near = 0;
    let frames = 0;
    const seen = meet(spec('rival', { role: 'enemy' }), {
      at: { x: 0, y: 0, z: 40 },
      ship: you({ speed: 8 }),
      steer: (s) => ({ ...s, heading: s.heading + 0.4 * DT }),
      seconds: 25,
      each: (brains, s, out, t) => {
        const m = brains.live[0];
        if (!m || t < 6) return;
        frames += 1;
        if (apart(m.pos, s) < 25) near += 1;
        expect(brains.targets.map((c) => c.id)).toEqual([m.id]);
      },
    });
    expect(near / frames).toBeGreaterThan(0.7);
    const atYou = seen.shots.filter((e) => e.at === 'you');
    expect(atYou.length).toBeGreaterThan(8);
    const hits = atYou.filter((e) => e.hit).length;
    expect(hits).toBeGreaterThan(0);
    expect(hits / atYou.length).toBeLessThan(0.5);
  });

  it('calls it a draw once you have hurt it enough, and goes without another shot', () => {
    let hurtAt = null;
    let shotsAfter = 0;
    const seen = meet(spec('rival', { role: 'enemy' }), {
      at: { x: 0, y: 0, z: 30 },
      ship: you({ speed: 6 }),
      seconds: 30,
      each: (brains, s, out, t) => {
        const m = brains.live[0];
        if (m && hurtAt === null && t > 5) {
          hurtAt = t;
          expect(brains.hit(m.id, 1)).toMatchObject({ down: false });
          expect(brains.hit(m.id, 2)).toMatchObject({ down: false });
        }
        if (hurtAt !== null && t > hurtAt + 0.1) shotsAfter += out.events.filter((e) => e.type === 'shot').length;
      },
    });
    expect(seen.says).toContain('hit');
    expect(types(seen)).toContain('draw');
    expect(seen.says).toContain('leaving');
    expect(shotsAfter).toBe(0);
    expect(seen.brains.targets).toHaveLength(0);
  });

  it('goes down to a hit that takes the last of it', () => {
    const brains = createBrains({ rand: seeded() });
    brains.add(spec('rival', { role: 'enemy', stats: { ...spec('rival').stats, hp: 2 } }), { x: 0, y: 0, z: 20 });
    brains.update(DT, { you: you(), hunters: [], stations: [] });
    const [m] = brains.live;
    expect(brains.hit(m.id, 5)).toMatchObject({ down: true, kind: 'saulcaddy' });
    expect(brains.update(DT, { you: you(), hunters: [], stations: [] }).events).toContainEqual(expect.objectContaining({ type: 'downed' }));
    expect(brains.live).toHaveLength(0);
    expect(brains.hit(m.id, 1)).toBeNull();
  });
});

describe('relations', () => {
  it('has one that fears a faction leave when that faction turns up near it, and not for anyone else', () => {
    const fearful = spec('informant', { relations: { fears: ['dea'], hunts: [] } });
    const go = (faction) =>
      meet(fearful, {
        at: { x: 20, y: 0, z: 0 },
        seconds: 4,
        world: (t) => ({ hunters: t > 1 ? [{ id: 7, at: { x: 25, y: 0, z: 0 }, faction }] : [] }),
      });
    const scared = go('dea');
    expect(scared.events).toContainEqual(expect.objectContaining({ type: 'fled', faction: 'dea' }));
    expect(scared.brains.live[0]?.leaving ?? true).toBe(true);
    const calm = go('cartel');
    expect(types(calm)).not.toContain('fled');
    expect(calm.brains.live[0].leaving).toBe(false);
  });

  it('has one that hunts a faction go after one near you and shoot at it, not at you', () => {
    const hunter = { id: 42, at: { x: 10, y: 0, z: -20 }, faction: 'federation' };
    let closest = Infinity;
    const seen = meet(spec('informant', { relations: { fears: [], hunts: ['federation'] } }), {
      at: { x: 40, y: 0, z: 10 },
      seconds: 20,
      world: () => ({ hunters: [hunter] }),
      each: (brains) => {
        const m = brains.live[0];
        if (m) closest = Math.min(closest, apart(m.pos, hunter.at));
      },
    });
    expect(closest).toBeLessThan(15);
    expect(seen.shots.length).toBeGreaterThan(3);
    expect(seen.shots.every((e) => e.at === 42)).toBe(true);
  });
});

describe('being careful', () => {
  it('keeps every one of them out of anything solid, however it flies', () => {
    const solids = [{ at: [40, 0, -10], r: 12 }];
    for (const brain of ['merchant', 'informant', 'rival']) {
      meet(spec(brain, { role: brain === 'rival' ? 'enemy' : 'neutral' }), {
        at: { x: 70, y: 0, z: -10 },
        ship: you({ speed: 7 }),
        steer: (s) => ({ ...s, heading: s.heading + 0.3 * DT }),
        seconds: 30,
        world: () => ({ solids, stations: [{ id: 'st', at: { x: 40, y: 0, z: -10 }, r: 12 }] }),
        each: (brains) => {
          for (const m of brains.live) expect(Math.hypot(m.pos.x - 40, m.pos.y, m.pos.z + 10), brain).toBeGreaterThan(12);
        },
      });
    }
  });

  it('lets go of one you have left far behind', () => {
    const seen = meet(spec('merchant'), { at: { x: 0, y: 0, z: 0 }, ship: you({ speed: 40 }), seconds: NPC.forget + 12 });
    expect(types(seen)).toContain('gone');
    expect(seen.brains.live).toHaveLength(0);
  });
});
