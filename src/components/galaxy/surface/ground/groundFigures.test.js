import { describe, expect, test } from 'vitest';
import { createPool } from './groundFigures';

describe('the figure pool', () => {
  const pool = () => {
    let n = 0;
    return createPool({ make: (kind) => ({ kind, n: n++ }) });
  };
  test('pool returns a figure only to its own kind', async () => {
    const p = pool();
    const trooper = await p.take('stormtrooper', 'a');
    p.give('a');
    const rebel = await p.take('rebel', 'b');
    expect(rebel.kind).toBe('rebel');
    expect(rebel).not.toBe(trooper);
    expect(p.free('stormtrooper')).toBe(1);
  });
  test('a dropped figure is reused for the next of its kind', async () => {
    const p = pool();
    const a = await p.take('stormtrooper', 'a');
    p.give('a');
    const b = await p.take('stormtrooper', 'b');
    expect(b).toBe(a);
    expect(p.free('stormtrooper')).toBe(0);
    expect(p.made()).toBe(1);
  });
  test('a figure still being made when its soldier is dropped goes to the pool, not to it', async () => {
    let done;
    const p = createPool({
      make: (kind) => new Promise((r) => (done = () => r({ kind }))),
    });
    const wait = p.take('clone', 'a');
    p.give('a');
    done();
    expect(await wait).toBeNull();
    expect(p.free('clone')).toBe(1);
  });
  test('a figure that could not be made is nobody’s', async () => {
    const p = createPool({ make: () => null });
    expect(await p.take('clone', 'a')).toBeNull();
    p.give('a');
    expect(p.free('clone')).toBe(0);
  });
});
