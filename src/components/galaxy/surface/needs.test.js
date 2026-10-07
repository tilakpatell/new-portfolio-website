import { describe, expect, it } from 'vitest';
import { pickWant, relate } from './needs';

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
