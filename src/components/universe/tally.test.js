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
  it('reads the pilot’s tally id, if there is one, and turns away one that isn’t', () => {
    expect(readTally({ e: 'c', m: {}, t: {}, i: 'a1b2c3d4e5f60718' }).i).toBe('a1b2c3d4e5f60718');
    for (const i of ['', 'short', 'Not-An-Id!', 'x'.repeat(40), 42, null]) expect(readTally({ e: 'c', m: {}, t: {}, i }), String(i)).toBeNull();
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
    for (const bad of [null, 'x', { e: 'c1', mine: 'x' }, { e: 'c1', mine: { a: -3 }, floor: [] }, { e: 'c1', i: 'Not an id', mine: { a: 1 }, floor: {} }]) t.load(bad);
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

describe('a pilot known by their tally id', () => {
  const wire = (msg) => readTally(JSON.parse(JSON.stringify(msg)));
  // a pilot's page reloaded: their tally back from the save, as a new peer
  const reload = (t) => {
    const u = createTally(t.epoch, { id: 'fresh00000000000' });
    u.load(JSON.parse(JSON.stringify(t.save())));
    return u;
  };
  // every pilot's message, through the wire, to every other (by peer id)
  const talk = (room) => {
    for (const [peer, t] of Object.entries(room)) {
      const msg = wire(t.message());
      for (const [other, u] of Object.entries(room)) if (other !== peer) u.receive(peer, msg);
    }
  };

  it('counts a pilot once who comes back under a new peer id, with the same shares or with more', () => {
    const o = createTally('c1'); // a pilot who stayed online
    o.add('a', 1);
    const p = createTally('c1', { id: 'pilot00000000001' });
    p.add('a', 4);
    p.add('b', 2);
    o.receive('peer-1', wire(p.message()));
    expect(o.value('a')).toBe(5);
    const back = reload(p);
    expect(o.receive('peer-2', wire(back.message()))).toBe(false);
    expect(o.value('a')).toBe(5);
    expect(o.value('b')).toBe(2);
    expect(back.id).toBe('pilot00000000001');
    back.add('a', 3);
    expect(o.receive('peer-2', wire(back.message()))).toBe(true);
    expect(o.value('a')).toBe(8);
    // (and their word from before the reload, heard late, changes nothing)
    expect(o.receive('peer-1', wire(p.message()))).toBe(false);
    expect(o.value('a')).toBe(8);
  });
  it('two pilots, one of whom reloads, come to the same values, and so does one who arrives late, with nobody counted twice', () => {
    const a = createTally('c1', { id: 'pilotaaaaaaaaaaa' });
    const b = createTally('c1', { id: 'pilotbbbbbbbbbbb' });
    a.add('x', 3);
    b.add('x', 2);
    b.add('y', 5);
    talk({ 'peer-a1': a, 'peer-b': b });
    const a2 = reload(a);
    a2.add('x', 1);
    talk({ 'peer-a2': a2, 'peer-b': b });
    talk({ 'peer-a2': a2, 'peer-b': b });
    const c = createTally('c1', { id: 'pilotcccccccccccc' });
    talk({ 'peer-a2': a2, 'peer-b': b, 'peer-c': c });
    for (const t of [a2, b, c]) {
      expect(t.value('x')).toBe(6); // a's 3 and 1, b's 2
      expect(t.value('y')).toBe(5);
    }
  });
  it('takes a word under your own id (another tab of yours, or yours from before a reload) as yours already: only its totals count', () => {
    const t = createTally('c1', { id: 'pilot00000000001' });
    t.add('a', 2);
    expect(t.receive('p', { e: 'c1', i: 'pilot00000000001', m: { a: 2, b: 3 }, t: { a: 2, b: 3 } })).toBe(true);
    expect(t.value('a')).toBe(2);
    expect(t.value('b')).toBe(3);
    expect(t.mine('b')).toBe(0);
  });
  it('lets a peer speak for one pilot only', () => {
    const t = createTally('c1');
    t.receive('p', { e: 'c1', i: 'pilot00000000001', m: { a: 1 }, t: {} });
    expect(t.receive('p', { e: 'c1', i: 'pilot00000000002', m: { a: 5 }, t: { a: 5 } })).toBe(false);
    expect(t.value('a')).toBe(1);
  });
  it('forgets a peer gone, keeping what their pilot did in the floor, and counts the pilot once when they’re back', () => {
    const t = createTally('c1');
    t.receive('p1', { e: 'c1', i: 'pilot00000000001', m: { a: 4 }, t: {} });
    t.forget('p1');
    expect(t.value('a')).toBe(4);
    t.receive('p2', { e: 'c1', i: 'pilot00000000001', m: { a: 4 }, t: {} });
    expect(t.value('a')).toBe(4);
    t.receive('p2', { e: 'c1', i: 'pilot00000000001', m: { a: 6 }, t: {} });
    expect(t.value('a')).toBe(6);
  });
  it('keeps its id with the shares it told under it, and takes a saved one back', () => {
    const t = createTally('c1', { id: 'pilot00000000001' });
    t.add('a', 1);
    expect(t.message().i).toBe('pilot00000000001');
    const saved = t.save();
    expect(saved.i).toBe('pilot00000000001');
    const u = createTally('c1', { id: 'fresh00000000000' });
    u.load(saved);
    expect(u.id).toBe('pilot00000000001');
    // (another campaign's save isn't taken, nor its id)
    const v = createTally('c2', { id: 'fresh00000000000' });
    v.load(saved);
    expect(v.id).toBe('fresh00000000000');
    // and a tally with none tells none: its pilot's known by their peer id
    expect('i' in createTally('c1').message()).toBe(false);
  });
});
