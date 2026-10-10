import { describe, expect, it } from 'vitest';
import { advance, confidence, createSquads, createTokens, flankers, frontline, morale, posture, withdraw } from './squad';

const P = (x, z) => ({ x, y: 0, z });
const m = (id, x, z, over = {}) => ({ id, at: P(x, z), side: 'a', alive: true, ...over });

describe('squads', () => {
  it('members within reach are one squad, across a gap two, and sides never mix', () => {
    const s = createSquads({ reach: 10 });
    const out = s.update([m(1, 0, 0), m(2, 5, 0), m(3, 40, 0), m(4, 2, 0, { side: 'b' })]);
    expect(out).toHaveLength(3);
    expect(s.of(1).members).toEqual([1, 2]);
    expect(s.of(3).members).toEqual([3]);
    expect(s.of(4).side).toBe('b');
    expect(s.of(99)).toBeNull();
  });

  it('a chain strung out stays one squad, and a squad keeps its id as it moves', () => {
    const s = createSquads({ reach: 10 });
    const first = s.update([m(1, 0, 0), m(2, 8, 0), m(3, 16, 0)]);
    expect(first).toHaveLength(1);
    const id = first[0].id;
    const again = s.update([m(1, 1, 0), m(2, 9, 0), m(3, 17, 0)]);
    expect(again[0].id).toBe(id);
    // split in two: one keeps the id, the other is new
    const split = s.update([m(1, 0, 0), m(2, 2, 0), m(3, 50, 0)]);
    expect(split).toHaveLength(2);
    expect(split.some((q) => q.id === id)).toBe(true);
  });

  it('an empty squad is dropped and its tokens come back', () => {
    const s = createSquads({ reach: 10 });
    s.update([m(1, 0, 0), m(2, 5, 0)]);
    const tokens = createTokens({ pools: { run: 1 } });
    expect(tokens.claim('run', 1)).toBe(true);
    expect(s.update([m(1, 0, 0, { alive: false }), m(2, 5, 0, { alive: false })])).toHaveLength(0);
    tokens.audit(0.1, () => false);
    expect(tokens.count('run')).toBe(0);
    expect(tokens.claim('run', 2)).toBe(true);
  });
});

describe('confidence and posture', () => {
  const squad = { id: 1, side: 'a', members: [1, 2] };
  const mine = [m(1, 0, 0), m(2, 2, 0)];

  it('with no enemy is neutral; even sides are neutral; a crowd is confident', () => {
    expect(confidence(squad, mine, []).level).toBe('neutral');
    expect(confidence(squad, mine, [m(9, 20, 0, { side: 'b' }), m(8, 22, 0, { side: 'b' })]).level).toBe('neutral');
    expect(confidence(squad, mine, [m(9, 20, 0, { side: 'b' })]).level).toBe('confident');
    expect(confidence(squad, mine, [m(9, 20, 0, { side: 'b' }), m(8, 22, 0, { side: 'b' }), m(7, 22, 0, { side: 'b' }), m(6, 22, 0, { side: 'b' }), m(5, 22, 0, { side: 'b' }), m(4, 22, 0, { side: 'b' })]).level).toBe('panicked');
  });

  it('a panicked ally counts for the enemy; kills and losses count; value weighs', () => {
    const foes = [m(9, 20, 0, { side: 'b' }), m(8, 22, 0, { side: 'b' })];
    const even = confidence(squad, mine, foes).ratio;
    const shaken = confidence(squad, [m(1, 0, 0, { level: 'panicked' }), m(2, 2, 0)], foes).ratio;
    expect(shaken).toBeLessThan(even);
    expect(confidence(squad, mine, foes, { kills: 2 }).level).toBe('confident');
    expect(confidence(squad, mine, foes, { losses: 3 }).level).toBe('worried');
    expect(confidence(squad, mine, foes, { value: (u) => (u.side === 'a' ? 3 : 1) }).level).toBe('heroic');
    // a panicked enemy counts for us
    expect(confidence(squad, mine, [m(9, 20, 0, { side: 'b', level: 'panicked' })]).ratio).toBe(Infinity);
  });

  it('a leader down drops a bin, a rally raises one', () => {
    expect(morale('confident', { type: 'leaderDown' })).toBe('neutral');
    expect(morale('panicked', { type: 'leaderDown' })).toBe('panicked');
    expect(morale('heroic', { type: 'rally' })).toBe('heroic');
    expect(morale('neutral', null)).toBe('neutral');
  });

  it('posture follows the level', () => {
    expect(posture('panicked')).toBe('retreat');
    expect(posture('worried')).toBe('retreat');
    expect(posture('neutral')).toBe('hold');
    expect(posture('confident')).toBe('press');
    expect(posture('heroic')).toBe('press');
  });
});

describe('the frontline', () => {
  const squad = { id: 1, side: 'a', members: [1, 2, 3, 4] };
  const mine = [m(1, 0, 0), m(2, 3, 0), m(3, 6, 2), m(4, -3, -1)];
  const foes = [m(9, 0, 30, { side: 'b' }), m(8, 6, 32, { side: 'b' })];

  it('points at the enemy, stops short of them, and makes a lane a member', () => {
    const f = frontline(squad, mine, foes, { buffer: 8 });
    expect(f.dir.z).toBeGreaterThan(0.95);
    expect(f.line.z).toBeLessThan(30 - 7);
    expect(f.line.z).toBeGreaterThan(15);
    expect(f.lanes).toHaveLength(4);
    // assigned by least movement: the leftmost member gets the leftmost lane
    const left = f.lanes.reduce((a, b) => (a.at.x < b.at.x ? a : b));
    expect(left.id).toBe(4);
    // every lane is apart from the next
    const xs = f.lanes.map((l) => l.at.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThan(2);
    // with no enemy it still has a direction and a line
    expect(frontline(squad, mine, []).lanes).toHaveLength(4);
  });

  it('withdraw moves the nearest half, advance the furthest', () => {
    const f = frontline(squad, mine, foes);
    const w = withdraw(squad, mine, f);
    expect(w.move).toContain(3); // the one furthest forward (z 2)
    expect(w.cover).toContain(4);
    const a = advance(squad, mine, f);
    expect(a.move).toContain(4);
    expect(a.cover).toContain(3);
    expect(a.move.length + a.cover.length).toBe(4);
  });

  it('flankers go off the sides and leave the rear open', () => {
    const f = frontline(squad, mine, foes);
    const fl = flankers(squad, mine, f, foes);
    expect(fl).toHaveLength(2);
    const foeCentreZ = 31;
    for (const x of fl) {
      expect(Math.abs(x.at.z - foeCentreZ)).toBeLessThan(3);
      expect(Math.abs(x.at.x - 3)).toBeGreaterThan(4);
    }
    expect(flankers(squad, mine, f, [])).toEqual([]);
  });
});

describe('tokens', () => {
  it('never two tail tokens; a higher priority steals; claims are idempotent', () => {
    const t = createTokens({ pools: { tail: 1, run: 2 } });
    expect(t.claim('tail', 'a')).toBe(true);
    expect(t.claim('tail', 'a')).toBe(true);
    expect(t.claim('tail', 'b')).toBe(false);
    expect(t.count('tail')).toBe(1);
    expect(t.steal('tail', 'b', 0)).toBe(false);
    expect(t.steal('tail', 'b', 1)).toBe(true);
    expect(t.held('tail', 'a')).toBe(false);
    expect(t.held('tail', 'b')).toBe(true);
    t.release('tail', 'b');
    expect(t.claim('tail', 'a')).toBe(true);
    // per target
    expect(t.claim('tail', 'c', { target: 'prey' })).toBe(true);
  });

  it('scale is the difficulty of every pool; audit reclaims the dead and the stale', () => {
    const t = createTokens({ pools: { run: 2 }, scale: 0.5, timeout: 3 });
    expect(t.claim('run', 'a')).toBe(true);
    expect(t.claim('run', 'b')).toBe(false);
    t.audit(4);
    expect(t.count('run')).toBe(0);
    t.claim('run', 'a');
    t.audit(0.1, (who) => who !== 'a');
    expect(t.held('run', 'a')).toBe(false);
    expect(t.claim('none', 'a')).toBe(false);
    t.clear();
  });
});
