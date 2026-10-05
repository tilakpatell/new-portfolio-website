import { describe, expect, it } from 'vitest';
import { COUNCIL, FOLLOW, REACH, RIDDLE, RIDDLES, SHARDS, answer, asked, closeHand, followAt, gathered, join, lead, newCouncil, newParty, newReach, newRiddles, newShards, placed, speak, stepCouncil, stepReach, stepRiddles, tapShard } from './rules';

describe('the shards of Narsil', () => {
  it('starts scattered, and the same way for the same seed', () => {
    const a = newShards(7);
    expect(a.order).toHaveLength(SHARDS);
    expect([...a.order].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(placed(a)).toBeLessThanOrEqual(1);
    expect(newShards(7).order).toEqual(a.order);
  });

  it('swaps the piece picked up with the one where it’s put', () => {
    const s = newShards(3);
    const [a, b] = [s.order[0], s.order[2]];
    expect(tapShard(s, 0)).toBe('held');
    expect(tapShard(s, 2)).toBe('swapped');
    expect(s.order[0]).toBe(b);
    expect(s.order[2]).toBe(a);
    // putting it back where it came from is no move
    tapShard(s, 1);
    expect(tapShard(s, 1)).toBe('held');
    expect(s.moves).toBe(1);
  });

  it('is solved by putting each piece in its place, in at most five moves', () => {
    const s = newShards(11);
    let last = null;
    for (let k = 0; k < SHARDS && !s.solved; k++) {
      const at = s.order.indexOf(k);
      if (at === k) continue;
      tapShard(s, at);
      last = tapShard(s, k);
    }
    expect(last).toBe('solved');
    expect(s.solved).toBe(true);
    expect(s.moves).toBeLessThanOrEqual(SHARDS - 1);
    expect(tapShard(s, 0)).toBeNull();
  });
});

describe('the Council of Elrond', () => {
  const run = (c, secs) => {
    const ev = [];
    for (let t = 0; t < secs; t += 0.1) ev.push(...stepCouncil(c, 0.1));
    return ev;
  };
  it('has Gimli take his axe to the Ring, then rises to its height', () => {
    const c = newCouncil();
    const ev = run(c, COUNCIL.ready / COUNCIL.rise + 1);
    const types = ev.map((e) => e.type);
    expect(types.indexOf('axe')).toBeGreaterThanOrEqual(0);
    expect(types.indexOf('axe')).toBeLessThan(types.indexOf('height'));
  });

  it('bids you wait if you stand too soon', () => {
    const c = newCouncil();
    run(c, 3);
    expect(speak(c)).toBe('wait');
    expect(c.spoken).toBe(0);
  });

  it('doesn’t hear you the first time, over the noise, but does the second', () => {
    const c = newCouncil();
    run(c, COUNCIL.ready / COUNCIL.rise + 0.5);
    expect(speak(c)).toBe('unheard');
    expect(speak(c)).toBe('heard');
    expect(c.state).toBe('heard');
    expect(speak(c)).toBeNull();
  });

  it('is drowned out by the Ring if you never stand', () => {
    const c = newCouncil();
    const ev = run(c, 1 / COUNCIL.rise + COUNCIL.drown + 1);
    expect(ev.at(-1).type).toBe('drowned');
    expect(c.state).toBe('drowned');
  });
});

describe('Bilbo’s hand', () => {
  it('creeps, then lunges, and is too late if you never close your hand', () => {
    const r = newReach(5);
    const ev = [];
    for (let t = 0; t < 10 && (r.state === 'creep' || r.state === 'lunge'); t += 0.05) ev.push(...stepReach(r, 0.05));
    expect(ev.map((e) => e.type)).toEqual(['lunge', 'late']);
    expect(r.t).toBeGreaterThan(REACH.from);
  });

  it('is only hurt if you pull away before he lunges', () => {
    const r = newReach(5);
    stepReach(r, 1);
    expect(closeHand(r)).toBe('early');
    expect(closeHand(r)).toBeNull();
  });

  it('is stopped if you close your hand as he lunges, with time to see it', () => {
    const r = newReach(9);
    let lungedAt = null;
    while (r.state === 'creep') if (stepReach(r, 0.02).length) lungedAt = r.t;
    expect(lungedAt).not.toBeNull();
    // a fair while to react in: how long the lunge takes to reach the Ring
    expect((1 - r.hand) / REACH.lunge).toBeGreaterThan(0.3);
    stepReach(r, 0.25);
    expect(closeHand(r)).toBe('won');
  });
});

describe('the Nine', () => {
  it('fall in one by one, each once', () => {
    const p = newParty();
    expect(join(p, 'sam')).toBe(true);
    expect(join(p, 'sam')).toBe(false);
    expect(gathered(p, ['sam', 'merry'])).toBe(false);
    join(p, 'merry');
    expect(gathered(p, [{ id: 'sam' }, { id: 'merry' }])).toBe(true);
  });

  it('walk behind you on your own path, a few steps apart', () => {
    const p = newParty();
    for (let x = 0; x <= 20; x += 0.1) lead(p, x, 0);
    const first = followAt(p, 0);
    const second = followAt(p, 1);
    expect(first.x).toBeCloseTo(20 - FOLLOW.gap, 0);
    expect(second.x).toBeCloseTo(20 - FOLLOW.gap * 2, 0);
    expect(first.z).toBeCloseTo(0, 5);
    // facing along the way you went (+x)
    expect(Math.cos(first.face)).toBeGreaterThan(0.99);
    // round a corner, the one behind is still on the path
    for (let z = 0; z >= -10; z -= 0.1) lead(p, 20, z);
    const round = followAt(p, 3);
    expect(Math.min(Math.abs(round.x - 20), Math.abs(round.z))).toBeLessThan(0.3);
  });

  it('keeps no more trail than it needs', () => {
    const p = newParty();
    for (let x = 0; x < 200; x += 0.3) lead(p, x, 0);
    expect(p.trail.length).toBeLessThanOrEqual(FOLLOW.keep);
  });
});

describe('on the side: riddles with Bilbo', () => {
  // the shown answer that's right, for the riddle being asked
  const right = (g) => g.opts.indexOf(0);
  const wrongOne = (g) => g.opts.findIndex((k) => k !== 0);

  it('has riddles enough, each with one answer and three it isn’t', () => {
    expect(RIDDLES.length).toBeGreaterThanOrEqual(RIDDLE.ask);
    for (const r of RIDDLES) {
      expect(r.a).toHaveLength(4);
      expect(new Set(r.a).size).toBe(4);
      expect(r.q.length).toBeGreaterThan(20);
    }
  });

  it('asks five different ones, the same way for the same seed', () => {
    const g = newRiddles(5);
    expect(new Set(g.order).size).toBe(RIDDLE.ask);
    expect(newRiddles(5).order).toEqual(g.order);
    expect(newRiddles(5).opts).toEqual(g.opts);
    const q = asked(g);
    expect(q.shown).toHaveLength(4);
    expect(q.shown[right(g)]).toBe(q.a[0]);
  });

  it('is won by a hobbit who knows them all, or misses just one', () => {
    const g = newRiddles(9);
    for (let i = 0; i < RIDDLE.ask; i++) expect(answer(g, right(g))).toBe('right');
    expect(g.state).toBe('won');
    expect(answer(g, 0)).toBe(null);
    const h = newRiddles(9);
    answer(h, wrongOne(h));
    while (h.state === 'ask') answer(h, right(h));
    expect(h.state).toBe('won');
    expect(h.right).toBe(RIDDLE.ask - 1);
  });

  it('is lost on the second wrong answer', () => {
    const g = newRiddles(2);
    expect(answer(g, wrongOne(g))).toBe('wrong');
    answer(g, right(g));
    expect(answer(g, wrongOne(g))).toBe('wrong');
    expect(g.state).toBe('lost');
  });

  it('counts the candle going out against you', () => {
    const g = newRiddles(4);
    const ev = [];
    for (let t = 0; t < RIDDLE.candle * 2 + 1 && g.state === 'ask'; t += 0.1) ev.push(...stepRiddles(g, 0.1).map((e) => e.type));
    expect(ev).toEqual(['out', 'out', 'lost']);
    // a fresh candle for each riddle
    const h = newRiddles(4);
    stepRiddles(h, RIDDLE.candle * 0.8);
    answer(h, right(h));
    expect(h.candle).toBe(1);
  });
});
