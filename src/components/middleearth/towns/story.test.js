import { describe, expect, it } from 'vitest';
import { nearest, progress } from './story';

const QUESTS = [
  { id: 'gate', name: 'The gate' },
  { id: 'pony', name: 'The inn', needs: 'gate' },
  { id: 'pints', name: 'Pints', needs: 'pony' },
];

describe('progress through a town', () => {
  it('starts with only what needs nothing open', () => {
    const p = progress(QUESTS, []);
    expect(p.quests.map((q) => q.open)).toEqual([true, false, false]);
    expect(p.next).toBe('gate');
    expect(p.finished).toBe(false);
  });
  it('opens what each finished step leads to, and ends when all are done', () => {
    expect(progress(QUESTS, ['gate']).next).toBe('pony');
    const p = progress(QUESTS, ['gate', 'pony', 'pints']);
    expect(p.finished).toBe(true);
    expect(p.next).toBeNull();
  });
  it('ignores ids it does not know, and steps saved out of order', () => {
    const p = progress(QUESTS, ['narnia', 'pints']);
    expect(p.quests.find((q) => q.id === 'pints')).toMatchObject({ done: false, open: false });
    expect(p.done).toEqual([]);
    expect(p.next).toBe('gate');
  });
});

describe('what is nearest', () => {
  const SPOTS = [
    { id: 'a', x: 0, z: 0, r: 1 },
    { id: 'b', x: 3, z: 0, r: 5 },
  ];
  it('takes each spot’s own reach', () => {
    expect(nearest(SPOTS, 0.5, 0)?.id).toBe('a');
    expect(nearest(SPOTS, -1.5, 0)?.id).toBe('b');
    expect(nearest(SPOTS, -3, 0)).toBeNull();
  });
  it('falls back to the reach it is given', () => {
    expect(nearest([{ id: 'c', x: 0, z: 0 }], 2, 0, 2.5)?.id).toBe('c');
    expect(nearest([{ id: 'c', x: 0, z: 0 }], 2, 0, 1.5)).toBeNull();
  });
});
