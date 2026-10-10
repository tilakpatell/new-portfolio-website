import { describe, expect, it } from 'vitest';
import { hear, mannerOf, pickWant, placesOf, relate } from './needs';
import { reserve, slotOf, spotOf, taken } from '../../../lib/ai/needs';

const wants = [
  { id: 'diner', kind: 'food', at: [10, 0], pause: 8 },
  { id: 'stall', kind: 'food', at: [40, 0] },
  { id: 'platform', kind: 'transit', at: [0, 30] },
  { id: 'lane', kind: 'view', at: [-50, 0] },
];
const b = (x = 0, z = 0) => ({ x, z, home: [x, z], visited: {} });
const fixed = (v) => () => v;

describe('what the people want', () => {
  it('a want is not picked twice running', () => {
    const me = b();
    const spec = { needs: ['food', 'transit'] };
    const first = pickWant(spec, wants, me, 0, fixed(0.5));
    expect(first).toBeTruthy();
    me.visited[first.id] = 0;
    me.last = first.id;
    const second = pickWant(spec, wants, me, 1, fixed(0.5));
    expect(second).toBeTruthy();
    expect(second.id).not.toBe(first.id);
  });

  it('a nearer want of the same kind wins when nothing else differs', () => {
    expect(pickWant({ needs: ['food'] }, wants, b(0, 0), 0, fixed(0.5)).id).toBe('diner');
    expect(pickWant({ needs: ['food'] }, wants, b(45, 0), 0, fixed(0.5)).id).toBe('stall');
  });

  it('a kind not in `needs` is never picked', () => {
    for (let i = 0; i < 20; i++) expect(pickWant({ needs: ['view'] }, wants, b(), i * 7, () => (i % 10) / 10).id).toBe('lane');
    expect(pickWant({ needs: ['sleep'] }, wants, b(), 0, fixed(0.5))).toBe(null);
    expect(pickWant({}, wants, b(), 0, fixed(0.5))).toBe(null);
  });

  it('a want just visited waits its turn: the other of its kind comes first', () => {
    const me = b(0, 0);
    me.visited.diner = 100;
    me.last = 'platform';
    expect(pickWant({ needs: ['food'] }, wants, me, 101, fixed(0.5)).id).toBe('stall');
    expect(pickWant({ needs: ['food'] }, wants, me, 400, fixed(0.5)).id).toBe('diner');
  });
});

describe('whom the people know', () => {
  const trooper = { kind: 'stormtrooper', x: 10, z: 0 };
  const wall = (a, c) => (a.x < 5) === (c.x < 5);
  it('a wanderer with `fears` runs from a kind it has seen, and not one behind a wall', () => {
    const me = b(0, 0);
    const spec = { fears: ['stormtrooper'] };
    expect(relate(me, spec, [trooper], 10, { seesThrough: () => true })).toEqual({ flee: { x: 10, z: 0 }, until: 16 });
    expect(me.flee).toEqual({ from: [10, 0], until: 16 });
    const other = b(0, 0);
    expect(relate(other, spec, [trooper], 10, { seesThrough: wall })).toBe(null);
    expect(other.flee).toBeUndefined();
    // (too far: not seen)
    expect(relate(b(0, 0), spec, [{ kind: 'stormtrooper', x: 30, z: 0 }], 10, { seesThrough: () => true })).toBe(null);
  });
  it('one that `chases` a kind goes after it within 25 m', () => {
    const me = b(0, 0);
    const out = relate(me, { chases: ['villager'] }, [{ kind: 'villager', x: 20, z: 5 }], 3, { seesThrough: () => true });
    expect(out).toEqual({ chase: { x: 20, z: 5 }, until: 9 });
    expect(relate(b(), { chases: ['villager'] }, [{ kind: 'villager', x: 30, z: 0 }], 3, { seesThrough: () => true })).toBe(null);
  });
});

describe('the places a site’s wants are', () => {
  const site = [
    { id: 'bar', kind: 'food', at: [0, 0], clip: 'drink', slots: 3, spots: [[4, 0], [0, 4], [-4, 0]], pause: 9 },
    { id: 'vap', kind: 'work', at: [10, 10], clip: 'kneel.fix', face: 1.2 },
    { id: 'plaza', kind: 'rest', at: [-30, 0] },
  ];
  it('are copies, each with its need, its slots, a spot for each and how long it’s used', () => {
    const places = placesOf(site);
    expect(places).toHaveLength(3);
    expect(places[0]).not.toBe(site[0]);
    expect(places[0]).toMatchObject({ id: 'bar', need: 'food', kind: 'food', slots: 3, clip: 'drink', duration: 9 });
    expect(places[1]).toMatchObject({ need: 'work', slots: 1, clip: 'kneel.fix', face: 1.2, duration: 6 });
    // (an open place, a plaza: room for a few, round its middle, a step apart)
    expect(places[2].slots).toBeGreaterThan(1);
    expect(places[2].spots).toHaveLength(places[2].slots);
    for (const s of places[2].spots) expect(Math.hypot(s[0] + 30, s[1])).toBeGreaterThan(0.9);
    for (let i = 1; i < places[2].spots.length; i++) expect(Math.hypot(places[2].spots[i][0] - places[2].spots[0][0], places[2].spots[i][1] - places[2].spots[0][1])).toBeGreaterThan(0.9);
    // (the table itself is as it was)
    expect(site[2].spots).toBeUndefined();
  });
  it('a full place isn’t picked by anyone but those in it, and its slots never overbook', () => {
    const [bar, vap] = placesOf(site);
    const me = { x: 0, z: 0, home: [0, 0], visited: {} };
    const others = [{}, {}, {}, {}];
    for (const o of others) reserve(bar, o);
    expect(taken(bar)).toBe(3);
    expect(slotOf(bar, others[3])).toBe(-1);
    expect(pickWant({ needs: ['food', 'work'] }, [bar, vap], me, 0, () => 0.5, { who: me })).toBe(vap);
    expect(pickWant({ needs: ['food', 'work'] }, [bar, vap], me, 0, () => 0.5, { who: others[0] })).toBe(bar);
    // (each in its own spot)
    expect(new Set(others.slice(0, 3).map((o) => spotOf(bar, o).join())).size).toBe(3);
  });
});

describe('how the people take a shot or a blast', () => {
  const fresh = (x = 0, z = 0) => ({ x, z, yaw: 0, home: [x, z], speed: 1, to: [x + 5, z], wait: 0, leg: 0, visited: {}, last: null });
  it('knows each kind’s manner: townsfolk scatter, soldiers raise their guns, Tuskens and Gamorreans brandish theirs', () => {
    expect(mannerOf({ kind: 'jawa' })).toMatchObject({ hears: 'scatter', greets: 'wave', chats: true });
    expect(mannerOf({ kind: 'villager' }).hears).toBe('scatter');
    expect(mannerOf({ kind: 'stormtrooper' })).toMatchObject({ hears: 'raise', greets: null, chats: false });
    expect(mannerOf({ kind: 'rebel' }).hears).toBe('raise');
    expect(mannerOf({ kind: 'tusken' })).toMatchObject({ hears: 'brandish', greets: 'cheer' });
    expect(mannerOf({ kind: 'gamorrean' }).hears).toBe('brandish');
    expect(mannerOf({ kind: 'rancor' }).hears).toBe(null);
    expect(mannerOf({ kind: 'jedi' }).hears).toBe('watch');
    // (a site's own word for one goes first)
    expect(mannerOf({ kind: 'jawa', hears: 'watch', greets: null }).hears).toBe('watch');
    expect(mannerOf({ kind: 'jawa', greets: null }).greets).toBe(null);
  });
  it('a townsman near a shot startles, then runs from it faster than it walks; one far off doesn’t hear it', () => {
    const b = fresh(5, 0);
    expect(hear(b, { kind: 'villager' }, { at: [0, 0], loudness: 1 }, 10, () => 0.5)).toBe('scatter');
    expect(b.hold).toBeGreaterThan(10);
    expect(b.hold).toBeLessThan(11.5);
    expect(b.flee.from).toEqual([0, 0]);
    expect(b.flee.until).toBeGreaterThan(b.hold + 3);
    expect(b.flee.pace).toBeGreaterThan(1.6);
    expect(b.to).toBe(null);
    const far = fresh(200, 0);
    expect(hear(far, { kind: 'villager' }, { at: [0, 0], loudness: 1 }, 10, () => 0.5)).toBe(null);
    expect(far.flee).toBeUndefined();
    // (a blast is heard further off)
    expect(hear(fresh(60, 0), { kind: 'villager' }, { at: [0, 0], loudness: 2 }, 10, () => 0.5)).toBe('scatter');
    // (another shot while it runs: on, from the new one, not startled again)
    const hold = b.hold;
    expect(hear(b, { kind: 'villager' }, { at: [10, 0] }, 12, () => 0.5)).toBe('scatter');
    expect(b.hold).toBe(hold);
    expect(b.flee.from).toEqual([10, 0]);
  });
  it('a soldier stops and turns to it; one who stands still only looks; a stall keeper ducks where it is', () => {
    const b = fresh(0, 5);
    expect(hear(b, { kind: 'stormtrooper' }, { at: [0, 0] }, 3, () => 0.5)).toBe('raise');
    expect(b.flee).toBeUndefined();
    expect(b.hold).toBeGreaterThan(5);
    expect(b.holdFace).toBeCloseTo(Math.PI, 6);
    const post = fresh(0, 5);
    expect(hear(post, { kind: 'stormtrooper', still: true }, { at: [0, 0] }, 3, () => 0.5)).toBe('raise');
    expect(post.hold).toBeUndefined();
    const keeper = fresh(0, 5);
    expect(hear(keeper, { kind: 'villager', still: true }, { at: [0, 0] }, 3, () => 0.5)).toBe('scatter');
    expect(keeper.flee).toBeUndefined();
    expect(hear(fresh(0, 5), { kind: 'rancor' }, { at: [0, 0] }, 3, () => 0.5)).toBe(null);
  });
});
