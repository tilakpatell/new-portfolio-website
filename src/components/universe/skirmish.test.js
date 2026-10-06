import { describe, expect, it } from 'vitest';
import { SKIRMISH, createSkirmish } from './skirmish';
import { createHunt } from './hunterRules';

// a seeded random, so a skirmish is the same every time
const seeded = (seed = 7) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const DT = 1 / 30;
const at = { x: 0, y: 0, z: 0 };
// one played out on its own, for `seconds`: what happened
function play(seed, seconds = 200, each = null) {
  const sk = createSkirmish({ rand: seeded(seed) });
  sk.start({ at, heading: 0.4, faction: 'empire', escort: 'xwing', civil: 'transport' });
  const seen = { enemy: 0, escort: 0, freighter: 0, over: [], endedAt: null };
  for (let t = 0; t < seconds; t += DT) {
    for (const e of sk.update(DT)) {
      if (e.type === 'down') seen[e.side] += 1;
      if (e.type === 'over') seen.over.push(e.winner);
    }
    each?.(sk, t);
    if (!sk.active && seen.endedAt === null) seen.endedAt = t;
  }
  return { ...seen, sk };
}

describe('a skirmish', () => {
  it('is already going when you come on it: the freighter, the hunters on it and its escort', () => {
    const sk = createSkirmish({ rand: seeded(3) });
    expect(sk.start({ at, faction: 'empire', escort: 'xwing' })).toBe(true);
    expect(sk.active).toBe(true);
    expect(sk.start({ at, faction: 'empire', escort: 'xwing' })).toBe(false); // (one at a time)
    expect(sk.freighter.alive).toBe(true);
    expect(sk.hunt.count).toBeGreaterThanOrEqual(1);
    expect(sk.wing.live.length).toBeGreaterThanOrEqual(1);
    // a few seconds in: they've closed, and the shooting's started
    const dist = Math.min(...sk.hunt.live.map((h) => Math.hypot(h.pos.x - sk.freighter.x, h.pos.y - sk.freighter.y, h.pos.z - sk.freighter.z)));
    expect(dist).toBeLessThan(30);
  });

  it('is a real fight on both sides, ends once, and goes away', () => {
    let enemy = 0;
    let escort = 0;
    const winners = [];
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const seen = play(seed);
      enemy += seen.enemy;
      escort += seen.escort + seen.freighter;
      expect(seen.over.length, `seed ${seed}`).toBe(1);
      winners.push(seen.over[0]);
      expect(seen.endedAt, `seed ${seed}: still going`).not.toBeNull();
    }
    expect(enemy).toBeGreaterThan(4);
    expect(escort).toBeGreaterThan(0); // (the hunters land some too)
    expect(winners).toContain('escort');
  });

  it('is never a wall: the first hunter down takes a while, on its own', () => {
    const sk = createSkirmish({ rand: seeded(5) });
    sk.start({ at, faction: 'empire', escort: 'xwing' });
    const n0 = sk.hunt.count;
    let t = 0;
    while (sk.hunt.count === n0 && t < 120) {
      sk.update(DT);
      t += DT;
    }
    expect(t).toBeGreaterThan(2);
  });

  it('lets you lock on to its hunters and shoot them, none of them coming at you', () => {
    const sk = createSkirmish({ rand: seeded(9) });
    sk.start({ at, faction: 'federation', escort: 'birdperson', civil: 'saucer' });
    const targets = sk.targets;
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.every((o) => o.threat === 0)).toBe(true);
    const h = sk.hunt.live[0];
    const got = sk.hit({ x: h.pos.x - 3, y: h.pos.y, z: h.pos.z }, { x: h.pos.x + 3, y: h.pos.y, z: h.pos.z }, 5);
    expect(got).toMatchObject({ down: true });
    expect(sk.hit({ x: 900, y: 0, z: 0 }, { x: 903, y: 0, z: 0 })).toBeNull();
  });

  it('sends the hunters off when the freighter goes down, each gone only once well away from you', () => {
    const sk = createSkirmish({ rand: seeded(4) });
    sk.start({ at, faction: 'empire', escort: 'xwing' });
    // no escort, and a freighter on its last legs
    sk.wing.clear();
    sk.freighter.hp = 1;
    const viewer = { x: 0, y: 0, z: 6 }; // (you, watching from close by)
    let downAt = null;
    let countThen = 0;
    const events = [];
    const lastSeen = new Map();
    for (let t = 0; t < 120; t += DT) {
      for (const h of sk.hunt.live) lastSeen.set(h.id, { ...h.pos });
      const before = new Set(sk.hunt.live.map((h) => h.id));
      for (const e of sk.update(DT, viewer)) events.push(e);
      if (downAt === null && !sk.freighter.alive) {
        downAt = t;
        countThen = sk.hunt.count;
      }
      // any hunter gone this frame, after the freighter: well away from you
      if (downAt !== null) for (const id of before) if (!sk.hunt.live.some((h) => h.id === id)) expect(Math.hypot(lastSeen.get(id).x - viewer.x, lastSeen.get(id).y - viewer.y, lastSeen.get(id).z - viewer.z)).toBeGreaterThan(100);
    }
    expect(events.find((e) => e.type === 'down' && e.side === 'freighter')).toBeTruthy();
    expect(events.filter((e) => e.type === 'over').map((e) => e.winner)).toEqual(['enemy']);
    expect(countThen).toBeGreaterThan(0); // (not gone in the same moment)
    expect(sk.hunt.count).toBe(0);
    expect(sk.active).toBe(false);
  });

  it('numbers its hunters apart from yours, so the lock never mixes them up', () => {
    const yours = createHunt({ rand: seeded(1) });
    yours.pack('empire', { x: 0, y: 0, z: 0, heading: 0, pitch: 0, speed: 0 }, { size: 4, ace: false });
    const sk = createSkirmish({ rand: seeded(1) });
    sk.start({ at, faction: 'empire', escort: 'xwing' });
    const mine = new Set(yours.targets.map((o) => o.id));
    expect(sk.targets.length).toBeGreaterThan(0);
    for (const o of sk.targets) expect(mine.has(o.id)).toBe(false);
  });

  it('never loses the freighter once the escort has won, to a laser still in flight', () => {
    for (const seed of [2, 3, 4, 5]) {
      const sk = createSkirmish({ rand: seeded(seed) });
      sk.start({ at, faction: 'empire', escort: 'xwing' });
      sk.freighter.hp = 1;
      // a laser on its way to the freighter, then every hunter shot down
      const f = sk.freighter;
      const m = sk.hunt.lasers[0];
      Object.assign(m, { on: true, x: f.x + 3, y: f.y, z: f.z, vx: -30, vy: 0, vz: 0, life: 1, at: 'you', faction: 'empire' });
      sk.update(1 / 120);
      for (const h of [...sk.hunt.live]) sk.hit({ x: h.pos.x - 3, y: h.pos.y, z: h.pos.z }, { x: h.pos.x + 3, y: h.pos.y, z: h.pos.z }, 10);
      const events = [];
      for (let t = 0; t < 3; t += DT) events.push(...sk.update(DT));
      expect(events.map((e) => `${e.type}:${e.side ?? e.winner}`), `seed ${seed}`).toEqual(['over:escort']);
      expect(f.alive).toBe(true);
    }
  });

  it('waits for its last shot to land before it ends, and leaves nothing in the air', () => {
    const sk = createSkirmish({ rand: seeded(7) });
    sk.start({ at, faction: 'empire', escort: 'xwing' });
    sk.wing.clear();
    for (const h of [...sk.hunt.live]) sk.hit({ x: h.pos.x - 3, y: h.pos.y, z: h.pos.z }, { x: h.pos.x + 3, y: h.pos.y, z: h.pos.z }, 10);
    // the freighter on its way, nearly out of sight, and a shot still out
    let t = 0;
    for (; t < SKIRMISH.linger - 0.5; t += DT) sk.update(DT);
    Object.assign(sk.shots[0], { on: true, x: 500, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 3, faction: 'empire' });
    let endedWith = null;
    for (let k = 0; k < 6 && endedWith === null; k += DT) {
      sk.update(DT);
      if (!sk.active) endedWith = sk.shots.some((m) => m.on);
    }
    expect(endedWith).toBe(false);
  });

  it('leaves nothing in the air when it ends', () => {
    for (const seed of [3, 4, 5, 6]) {
      const seen = play(seed, 200);
      expect(seen.sk.active).toBe(false);
      expect(seen.sk.hunt.lasers.some((m) => m.on)).toBe(false);
      expect(seen.sk.shots.some((m) => m.on)).toBe(false);
      expect(seen.sk.wing.bolts.some((b) => b.on)).toBe(false);
    }
  });

  it('keeps the freighter going round, then on its way once it is over', () => {
    const sk = createSkirmish({ rand: seeded(2) });
    sk.start({ at, faction: 'empire', escort: 'xwing' });
    const h0 = sk.freighter.heading;
    sk.update(1);
    expect(sk.freighter.heading).toBeCloseTo(h0 + SKIRMISH.circle, 6);
    sk.update(DT); // (a short step, so a test bolt across one meets it)
    // all the hunters shot down: over, and it speeds up and goes
    for (const h of [...sk.hunt.live]) sk.hit({ x: h.pos.x - 3, y: h.pos.y, z: h.pos.z }, { x: h.pos.x + 3, y: h.pos.y, z: h.pos.z }, 10);
    const ev = sk.update(DT);
    expect(ev).toContainEqual({ type: 'over', winner: 'escort' });
    for (let t = 0; t < 4; t += DT) sk.update(DT);
    expect(sk.freighter.speed).toBeCloseTo(SKIRMISH.away, 6);
    for (let t = 0; t < SKIRMISH.linger + 12; t += DT) sk.update(DT);
    expect(sk.active).toBe(false);
  });

  it('ends with the freighter jumping away if it drags on, the hunters peeling off after it', () => {
    const sk = createSkirmish({ rand: seeded(6) });
    sk.start({ at, faction: 'empire', escort: 'xwing' });
    sk.wing.clear(); // (nobody to fight them)
    sk.freighter.hp = 1e9; // (and nothing they can do to it)
    const events = [];
    for (let t = 0; t < SKIRMISH.longest + 40; t += DT) events.push(...sk.update(DT));
    const over = events.filter((e) => e.type === 'over');
    expect(over.map((e) => e.winner)).toEqual(['jumped']);
    expect(over[0].at).toBeTruthy();
    expect(sk.active).toBe(false);
    expect(sk.hunt.count).toBe(0);
  });

  it('clears at once', () => {
    const sk = createSkirmish({ rand: seeded(1) });
    sk.start({ at, faction: 'empire', escort: 'xwing' });
    sk.clear();
    expect(sk.active).toBe(false);
    expect(sk.hunt.count).toBe(0);
    expect(sk.wing.active).toBe(false);
    expect(sk.targets).toEqual([]);
    expect(sk.start({ at, faction: 'empire', escort: 'xwing' })).toBe(true);
  });
});
