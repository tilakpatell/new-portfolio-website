import { describe, expect, it } from 'vitest';
import { SKIRMISH, createSkirmish, placeAt } from './skirmish';
import { createHunt } from './hunterRules';
import { NODES } from './waypoints';
import { SOLIDS } from './ship';

// a seeded random, so a skirmish is the same every time; the seed is mixed
// first, so neighbouring seeds don't start alike (the pack's size is the
// first thing drawn)
const mix = (s) => {
  let x = Math.imul(s, 2654435761) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 2246822507) >>> 0;
  x ^= x >>> 13;
  return x >>> 0;
};
const seeded = (s = 7) => {
  let seed = mix(s);
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
};
const DT = 1 / 30;
const at = { x: 0, y: 0, z: 0 };
const fresh = (seed, opts = {}) => {
  const sk = createSkirmish({ rand: seeded(seed), ...opts });
  sk.start({ at, heading: 0.4, faction: seed % 2 ? 'empire' : 'federation', escort: seed % 2 ? 'xwing' : 'birdperson', civil: 'transport' });
  return sk;
};
// every hunter gone, by number (a test bolt across one can meet another first)
const killAll = (sk) => {
  for (const h of [...sk.hunt.live]) sk.hunt.damage(h.id, 99);
};
// one played out on its own: what happened, and when
function play(seed, seconds = 200) {
  const sk = fresh(seed);
  const seen = { enemy: 0, escort: 0, freighter: 0, over: [], overAt: null, endedAt: null };
  for (let t = 0; t < seconds && sk.active; t += DT) {
    for (const e of sk.update(DT)) {
      if (e.type === 'down') seen[e.side] += 1;
      if (e.type === 'over') {
        seen.over.push(e.winner);
        seen.overAt ??= t;
      }
    }
    if (!sk.active) seen.endedAt = t;
  }
  return { ...seen, sk };
}
const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1);

describe('a skirmish', () => {
  it('is already going when you come on it: the freighter, the hunters on it and its escort', () => {
    let started = 0;
    const sizes = new Set();
    for (const seed of SEEDS.slice(0, 30)) {
      const sk = fresh(seed);
      expect(sk.active).toBe(true);
      expect(sk.freighter.alive).toBe(true);
      expect(sk.hunt.count).toBeGreaterThanOrEqual(1);
      expect(sk.wing.live.length).toBeGreaterThanOrEqual(1);
      sizes.add(sk.hunt.count);
      // they've closed on it
      const dist = Math.min(...sk.hunt.live.map((h) => Math.hypot(h.pos.x - sk.freighter.x, h.pos.y - sk.freighter.y, h.pos.z - sk.freighter.z)));
      expect(dist).toBeLessThan(30);
      // and mostly, the shooting's started
      if (sk.wing.fired > 0 || sk.hunt.lasers.some((m) => m.on) || sk.freighter.hp < SKIRMISH.hp) started += 1;
    }
    expect(started).toBeGreaterThan(15);
    expect(sizes.size).toBeGreaterThan(1); // (packs of more than one size)
    const sk = fresh(3);
    expect(sk.start({ at })).toBe(false); // (one at a time)
  });

  it('is a real fight on both sides that ends once and goes away, the freighter lost about as often as saved', () => {
    const outcome = { escort: 0, enemy: 0, jumped: 0 };
    let enemy = 0;
    let escort = 0;
    let freighter = 0;
    for (const seed of SEEDS) {
      const seen = play(seed);
      expect(seen.over.length, `seed ${seed}`).toBe(1);
      expect(seen.endedAt, `seed ${seed}: still going`).not.toBeNull();
      outcome[seen.over[0]] += 1;
      enemy += seen.enemy;
      escort += seen.escort;
      freighter += seen.freighter;
    }
    expect(enemy).toBeGreaterThan(30); // (hunters shot down)
    expect(escort).toBeGreaterThan(5); // (escorts shot down, by the hunters' own shots)
    expect(freighter).toBe(outcome.enemy); // (each loss is a freighter shot down)
    // left alone, it goes either way: worth flying in to help
    expect(outcome.escort / SEEDS.length).toBeGreaterThan(0.2);
    expect(outcome.enemy / SEEDS.length).toBeGreaterThan(0.2);
    expect(outcome.jumped / SEEDS.length).toBeLessThan(0.2);
  });

  it('is never a wall: it takes a while to play out on its own', () => {
    const overs = SEEDS.map((seed) => play(seed).overAt).filter((t) => t !== null);
    overs.sort((a, b) => a - b);
    expect(overs[Math.floor(overs.length / 2)]).toBeGreaterThan(15); // (half of them half a minute or so)
    expect(overs[Math.floor(overs.length * 0.1)]).toBeGreaterThan(4);
  });

  it('lets you lock on to its hunters and shoot them, none of them coming at you', () => {
    const sk = fresh(9);
    const targets = sk.targets;
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.every((o) => o.threat === 0)).toBe(true);
    const h = sk.hunt.live[0];
    const got = sk.hit({ x: h.pos.x - 3, y: h.pos.y, z: h.pos.z }, { x: h.pos.x + 3, y: h.pos.y, z: h.pos.z }, 99);
    expect(got).toMatchObject({ down: true });
    expect(sk.hit({ x: 900, y: 0, z: 0 }, { x: 903, y: 0, z: 0 })).toBeNull();
  });

  it('numbers its hunters apart from yours, so the lock never mixes them up', () => {
    const yours = createHunt({ rand: seeded(1) });
    yours.pack('empire', { x: 0, y: 0, z: 0, heading: 0, pitch: 0, speed: 0 }, { size: 4, ace: false });
    const sk = fresh(1);
    const mine = new Set(yours.targets.map((o) => o.id));
    expect(sk.targets.length).toBeGreaterThan(0);
    for (const o of sk.targets) expect(mine.has(o.id)).toBe(false);
  });

  it('takes a hit from a laser that passes within the freighter’s size, not only a fighter’s', () => {
    const sk2 = fresh(4);
    sk2.wing.clear();
    const f = sk2.freighter;
    const hp = f.hp;
    // a laser across its path, 0.4 off its middle: wider than a fighter's 0.2, inside its 0.6
    const m = sk2.hunt.lasers[sk2.hunt.lasers.length - 1];
    Object.assign(m, { on: true, x: f.x - 2, y: f.y + 0.4, z: f.z, vx: 60, vy: 0, vz: 0, life: 1, at: 'you', faction: 'empire' });
    sk2.update(1 / 30);
    expect(f.hp).toBe(hp - 1);
    expect(m.on).toBe(false);
    // and one a unit off misses
    const m2 = sk2.hunt.lasers[sk2.hunt.lasers.length - 2];
    Object.assign(m2, { on: true, x: f.x - 2, y: f.y + 1, z: f.z, vx: 60, vy: 0, vz: 0, life: 1, at: 'you', faction: 'empire' });
    const hp2 = f.hp;
    sk2.update(1 / 30);
    expect(f.hp).toBe(hp2);
  });

  it('loses an escort to two of the hunters’ shots, once', () => {
    const sk = fresh(5);
    const w = sk.wing.live[0];
    const n = sk.wing.live.length;
    const shoot = () => {
      const s = sk.shots[0];
      Object.assign(s, { on: true, x: w.pos.x - 2, y: w.pos.y, z: w.pos.z, vx: 60, vy: 0, vz: 0, life: 1, faction: 'empire' });
      // (pinned for the frame: it's the shot that's tested)
      w.vel.x = 0;
      w.vel.y = 0;
      w.vel.z = 0;
      return sk.update(1 / 30).filter((e) => e.type === 'down' && e.side === 'escort');
    };
    expect(shoot()).toEqual([]);
    expect(sk.wing.live).toContain(w);
    const downs = shoot();
    expect(downs).toHaveLength(1);
    expect(sk.wing.live).not.toContain(w);
    expect(sk.wing.live.length).toBe(n - 1);
    for (let t = 0; t < 2; t += DT) expect(sk.update(DT).filter((e) => e.type === 'down' && e.side === 'escort' && e.kind === w.kind && sk.wing.live.length === n - 1)).toEqual([]);
  });

  it('sends the hunters off when the freighter goes down, each gone only once well away from you', () => {
    const sk = fresh(4);
    sk.wing.clear();
    sk.freighter.hp = 1;
    const viewer = { x: 0, y: 0, z: 6 };
    let downAt = null;
    let aSecondOn = null;
    const events = [];
    const lastSeen = new Map();
    for (let t = 0; t < 120; t += DT) {
      for (const h of sk.hunt.live) lastSeen.set(h.id, { ...h.pos });
      const before = new Set(sk.hunt.live.map((h) => h.id));
      for (const e of sk.update(DT, viewer)) events.push(e);
      if (downAt === null && !sk.freighter.alive) downAt = t;
      if (downAt !== null && aSecondOn === null && t > downAt + 1) aSecondOn = sk.hunt.count;
      if (downAt !== null) for (const id of before) if (!sk.hunt.live.some((h) => h.id === id)) expect(Math.hypot(lastSeen.get(id).x - viewer.x, lastSeen.get(id).y - viewer.y, lastSeen.get(id).z - viewer.z)).toBeGreaterThan(100);
    }
    expect(events.find((e) => e.type === 'down' && e.side === 'freighter')).toBeTruthy();
    expect(events.filter((e) => e.type === 'over').map((e) => e.winner)).toEqual(['enemy']);
    expect(aSecondOn).toBeGreaterThan(0); // (still flying, a second on)
    expect(sk.hunt.targets).toHaveLength(0); // (and nothing for the guns: they're leaving)
    expect(sk.hunt.count).toBe(0);
    expect(sk.active).toBe(false);
  });

  it('never loses the freighter once the escort has won, to a laser still in flight', () => {
    for (const seed of [2, 3, 4, 5, 6, 7]) {
      const sk = fresh(seed);
      sk.freighter.hp = 1;
      const f = sk.freighter;
      const m = sk.hunt.lasers[0];
      Object.assign(m, { on: true, x: f.x + 3, y: f.y, z: f.z, vx: -30, vy: 0, vz: 0, life: 1, at: 'you', faction: 'empire' });
      sk.update(1 / 120);
      killAll(sk);
      const events = [];
      for (let t = 0; t < 3; t += DT) events.push(...sk.update(DT));
      expect(events.map((e) => `${e.type}:${e.side ?? e.winner}`), `seed ${seed}`).toEqual(['over:escort']);
      expect(f.alive).toBe(true);
    }
  });

  it('ends with the freighter jumping away on time if it drags on, the hunters peeling off after it', () => {
    const sk = fresh(6);
    sk.wing.clear(); // (nobody to fight them)
    sk.freighter.hp = 1e9; // (and nothing they can do to it)
    const viewer = { x: 0, y: 0, z: 0 };
    let overAt = null;
    let over = null;
    let aSecondOn = null;
    for (let t = 0; t < SKIRMISH.longest + 60 && sk.active; t += DT) {
      for (const e of sk.update(DT, viewer)) {
        if (e.type === 'over') {
          expect(over).toBeNull(); // (once)
          over = e;
          overAt = t;
        }
      }
      if (overAt !== null && aSecondOn === null && t > overAt + 1) aSecondOn = sk.hunt.count;
    }
    expect(over.winner).toBe('jumped');
    expect(over.at).toBeTruthy();
    // its clock counts the few seconds it was going before you came on it
    expect(Math.abs(overAt - (SKIRMISH.longest - SKIRMISH.preroll))).toBeLessThan(3 * DT);
    expect(aSecondOn).toBeGreaterThan(0);
    expect(sk.active).toBe(false);
    expect(sk.hunt.count).toBe(0);
  });

  it('keeps the freighter going round, then on its way once it is over', () => {
    const sk = fresh(2);
    const h0 = sk.freighter.heading;
    sk.update(1);
    expect(sk.freighter.heading).toBeCloseTo(h0 + SKIRMISH.circle, 6);
    killAll(sk);
    const ev = sk.update(DT);
    expect(ev).toContainEqual({ type: 'over', winner: 'escort' });
    for (let t = 0; t < 4; t += DT) sk.update(DT);
    expect(sk.freighter.speed).toBeCloseTo(SKIRMISH.away, 6);
    for (let t = 0; t < SKIRMISH.linger + 12; t += DT) sk.update(DT);
    expect(sk.active).toBe(false);
  });

  it('jumps away once it’s been about a while after winning, or before it would meet a planet', () => {
    let sk = fresh(2);
    killAll(sk);
    let away = null;
    for (let t = 0; t < SKIRMISH.linger + 2 && !away; t += DT) away = sk.update(DT).find((e) => e.type === 'away') ?? null;
    expect(away).toBeTruthy();
    expect(sk.freighter.alive).toBe(false);
    // a planet right where it's heading: it jumps short of it
    const probe = fresh(2);
    killAll(probe);
    probe.update(DT);
    const f = probe.freighter;
    const planet = { id: 'p', at: [f.x - Math.sin(f.heading) * 40, f.y, f.z - Math.cos(f.heading) * 40], r: 20 };
    sk = fresh(2, { solids: [planet] });
    killAll(sk);
    let closest = Infinity;
    away = null;
    for (let t = 0; t < SKIRMISH.linger + 2 && !away; t += DT) {
      away = sk.update(DT).find((e) => e.type === 'away') ?? null;
      if (sk.freighter.alive) closest = Math.min(closest, Math.hypot(sk.freighter.x - planet.at[0], sk.freighter.y - planet.at[1], sk.freighter.z - planet.at[2]) - planet.r);
    }
    expect(away).toBeTruthy();
    expect(closest).toBeGreaterThan(0);
  });

  it('waits for its last shot to land before it ends, and leaves nothing in the air', () => {
    const sk = fresh(7);
    sk.wing.clear();
    killAll(sk);
    let t = 0;
    for (; t < SKIRMISH.linger - 0.5; t += DT) sk.update(DT);
    Object.assign(sk.shots[0], { on: true, x: 500, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 3, faction: 'empire' });
    let endedWith = null;
    for (let k = 0; k < 6 && endedWith === null; k += DT) {
      sk.update(DT);
      if (!sk.active) endedWith = sk.shots.some((m) => m.on);
    }
    expect(endedWith).toBe(false);
    for (const seed of SEEDS.slice(0, 12)) {
      const seen = play(seed);
      expect(seen.sk.hunt.lasers.some((m) => m.on)).toBe(false);
      expect(seen.sk.shots.some((m) => m.on)).toBe(false);
      expect(seen.sk.wing.bolts.some((b) => b.on)).toBe(false);
    }
  });

  it('clears at once, nothing left in the air', () => {
    const sk = fresh(1);
    for (let t = 0; t < 3; t += DT) sk.update(DT);
    Object.assign(sk.shots[0], { on: true, life: 3 });
    sk.clear();
    expect(sk.active).toBe(false);
    expect(sk.hunt.count).toBe(0);
    expect(sk.wing.active).toBe(false);
    expect(sk.targets).toEqual([]);
    expect(sk.shots.some((m) => m.on) || sk.hunt.lasers.some((m) => m.on) || sk.wing.bolts.some((b) => b.on)).toBe(false);
    expect(sk.start({ at, faction: 'empire', escort: 'xwing' })).toBe(true);
  });
});

describe('placeAt', () => {
  it('puts a skirmish within 200 of a node of the lanes and clear of everything solid, for every node', () => {
    for (const node of NODES) {
      const p = placeAt(node, SOLIDS);
      expect(Math.hypot(p.x - node.at[0], p.y - node.at[1], p.z - node.at[2]), node.id).toBeLessThanOrEqual(200);
      for (const o of SOLIDS) expect(Math.hypot(p.x - o.at[0], p.y - o.at[1], p.z - o.at[2]), `${node.id} in ${o.id}`).toBeGreaterThan(o.r + SKIRMISH.clear);
    }
  });

  it('sits off the node itself, so the fight isn’t in its ramp ring', () => {
    for (const node of NODES) {
      const p = placeAt(node, SOLIDS);
      expect(Math.hypot(p.x - node.at[0], p.y - node.at[1], p.z - node.at[2]), node.id).toBeGreaterThan(40);
    }
  });

  it('takes ship.js’s solids when given none', () => {
    expect(placeAt(NODES[0])).toEqual(placeAt(NODES[0], SOLIDS));
  });
});
