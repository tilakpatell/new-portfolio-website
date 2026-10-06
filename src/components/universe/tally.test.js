import { describe, expect, it } from 'vitest';
import { TALLY, createTally, readTally } from './tally';

describe('readTally', () => {
  it('reads a message: its epoch, the shares and the totals', () => {
    expect(readTally({ e: 'c3', m: { 'hoth:4': 2 }, t: { 'hoth:4': 5 } })).toEqual({ e: 'c3', m: { 'hoth:4': 2 }, t: { 'hoth:4': 5 } });
  });
  it('takes a number for an epoch, as its text', () => {
    expect(readTally({ e: 12, m: {}, t: {} })?.e).toBe('12');
  });
  it('turns away anything malformed', () => {
    for (const bad of [null, 'x', { e: '', m: {}, t: {} }, { e: 'c', m: [], t: {} }, { e: 'c', m: {}, t: null }, { e: 'c', m: { 'Bad Key!': 1 }, t: {} }, { e: 'c', m: { a: -1 }, t: {} }, { e: 'c', m: { a: Infinity }, t: {} }, { e: 'c', m: { a: '3' }, t: {} }, { e: 'x'.repeat(80), m: {}, t: {} }])
      expect(readTally(bad), JSON.stringify(bad)).toBeNull();
  });
  it('turns away a message with too many keys', () => {
    const m = Object.fromEntries(Array.from({ length: TALLY.keys + 1 }, (_, i) => [`k${i}`, 1]));
    expect(readTally({ e: 'c', m, t: {} })).toBeNull();
  });
  it('clamps a value to the most it may be', () => {
    expect(readTally({ e: 'c', m: { a: TALLY.value * 10 }, t: {} }).m.a).toBe(TALLY.value);
  });
});

describe('createTally', () => {
  it('sums your share and the others’', () => {
    const t = createTally('c1');
    t.add('a', 2);
    t.add('a', 1);
    expect(t.receive('p', { e: 'c1', m: { a: 4 }, t: { a: 4 } })).toBe(true);
    expect(t.mine('a')).toBe(3);
    expect(t.value('a')).toBe(7);
  });
  it('takes the floor when someone’s told of more than the shares add up to', () => {
    const t = createTally('c1');
    t.add('a', 1);
    t.receive('p', { e: 'c1', m: { a: 1 }, t: { a: 9 } });
    expect(t.value('a')).toBe(9);
  });
  it('only lets a share grow (a smaller one heard late is ignored)', () => {
    const t = createTally('c1');
    t.receive('p', { e: 'c1', m: { a: 5 }, t: {} });
    t.receive('p', { e: 'c1', m: { a: 2 }, t: {} });
    expect(t.value('a')).toBe(5);
  });
  it('ignores a message from another epoch', () => {
    const t = createTally('c1');
    expect(t.receive('p', { e: 'c2', m: { a: 5 }, t: { a: 5 } })).toBe(false);
    expect(t.value('a')).toBe(0);
  });
  it('starts over at a new epoch', () => {
    const t = createTally('c1');
    t.add('a', 3);
    t.receive('p', { e: 'c1', m: { b: 1 }, t: { b: 1 } });
    t.reset('c2');
    expect(t.epoch).toBe('c2');
    expect(t.value('a')).toBe(0);
    expect(t.value('b')).toBe(0);
  });
  it('sends your shares and the totals it knows', () => {
    const t = createTally('c1');
    t.add('a', 2);
    t.receive('p', { e: 'c1', m: { b: 3 }, t: { b: 3 } });
    expect(t.message()).toEqual({ e: 'c1', m: { a: 2 }, t: { a: 2, b: 3 } });
  });
  it('forgets a pilot who’s gone, but keeps what they did in the floor', () => {
    const t = createTally('c1');
    t.receive('p', { e: 'c1', m: { a: 4 }, t: {} });
    t.forget('p');
    expect(t.value('a')).toBe(4);
  });
  it('lists every key it knows', () => {
    const t = createTally('c1');
    t.add('a', 1);
    t.receive('p', { e: 'c1', m: { b: 1 }, t: { c: 2 } });
    expect(t.keys().sort()).toEqual(['a', 'b', 'c']);
  });
  it('keeps to so many keys, past which a new one is let go', () => {
    const t = createTally('c1', { keys: 2 });
    t.add('a', 1);
    t.add('b', 1);
    t.add('c', 1);
    expect(t.value('c')).toBe(0);
  });
  it('saves and comes back to the same epoch, but not another', () => {
    const t = createTally('c1');
    t.add('a', 2);
    t.receive('p', { e: 'c1', m: { b: 3 }, t: {} });
    const saved = t.save();
    const u = createTally('c1');
    u.load(saved);
    expect(u.mine('a')).toBe(2);
    expect(u.value('b')).toBe(3);
    const v = createTally('c2');
    v.load(saved);
    expect(v.value('a')).toBe(0);
  });
  it('shrugs off a save that isn’t one', () => {
    const t = createTally('c1');
    for (const bad of [null, 'x', { e: 'c1', mine: 'x' }, { e: 'c1', mine: { a: -3 }, floor: [] }]) t.load(bad);
    expect(t.keys()).toEqual([]);
  });
  it('takes a share told as more than the cap as the cap, and a total as no more than a room of pilots could make', () => {
    const t = createTally('c1', { cap: 10 });
    t.add('a', 50);
    expect(t.mine('a')).toBe(10);
    t.receive('p', { e: 'c1', m: { b: 500 }, t: { c: 1e6 } });
    expect(t.value('b')).toBe(10);
    expect(t.value('c')).toBe(10 * TALLY.pilots);
  });
});
