import { describe, expect, it } from 'vitest';
import { calibrate, pickLevel, recall, remember } from './calibrate';

const now = () => Promise.resolve();

// a context with the timer extension, whose frames cost `cost(level)` ms on the chip
const timedGl = (cost, state) => {
  const ext = { TIME_ELAPSED_EXT: 1, GPU_DISJOINT_EXT: 2 };
  return {
    QUERY_RESULT_AVAILABLE: 3,
    QUERY_RESULT: 4,
    getExtension: (n) => (n === 'EXT_disjoint_timer_query_webgl2' ? ext : null),
    createQuery: () => ({ ms: cost(state.level) }),
    beginQuery() {},
    endQuery() {},
    deleteQuery() {},
    isContextLost: () => false,
    getParameter: () => false,
    getQueryParameter: (q, p) => (p === 3 ? true : q.ms * 1e6),
  };
};

describe('pickLevel', () => {
  it('takes the sharpest level that fits the budget', () => {
    const samples = [0, 0, 0, 1, 1, 1].map((level, i) => ({ level, ms: level === 0 ? 20 + i : 9 }));
    expect(pickLevel(samples, 12)).toBe(1);
  });
  it('takes the softest measured when nothing fits', () => {
    expect(pickLevel([{ level: 0, ms: 40 }, { level: 2, ms: 30 }], 12)).toBe(2);
  });
  it('judges by the typical frame, not the worst', () => {
    expect(pickLevel([5, 6, 7, 50].map((ms) => ({ level: 0, ms })), 12)).toBe(0);
  });
});

describe('calibrate', () => {
  it('walks down until a level fits and stops there', async () => {
    const state = { level: -1 };
    const gl = timedGl((l) => [30, 20, 10, 6, 4][l], state);
    const tried = [];
    const level = await calibrate({
      renderer: { getContext: () => gl },
      draw() {},
      setLevel: (l) => {
        state.level = l;
        tried.push(l);
      },
      budget: 12,
      frames: 4,
      frame: now,
    });
    expect(level).toBe(2);
    expect(tried).toEqual([0, 1, 2]);
  });

  it('starts from where it was kept', async () => {
    const state = { level: -1 };
    const gl = timedGl(() => 5, state);
    const tried = [];
    await calibrate({ renderer: { getContext: () => gl }, draw() {}, setLevel: (l) => tried.push((state.level = l)), frames: 2, frame: now, start: 2 });
    expect(tried).toEqual([2]);
  });
});

describe('the store', () => {
  it('keeps a level per key', () => {
    const mem = {};
    globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => (mem[k] = v) };
    expect(recall('a')).toBe(null);
    remember('a', 2);
    expect(recall('a')).toBe(2);
    delete globalThis.localStorage;
  });
});
