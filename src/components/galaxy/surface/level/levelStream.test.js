import { describe, expect, it } from 'vitest';
import { createLevelStream } from './levelStream';
import { wanted } from './levelPack';

const pack = (() => {
  const cells = {};
  for (let x = -6; x < 6; x++) for (let z = -6; z < 6; z++) cells[`${x},${z}`] = { bin: `cells/${x}_${z}.bin` };
  return { cell: 128, cells, far: { bin: 'far.bin' }, horizon: { bin: 'horizon.bin' } };
})();

// a fetch whose answers the test hands out, one path at a time
function fakeFetch() {
  const waiting = new Map();
  const asked = [];
  const fetch = (path, { signal }) =>
    new Promise((resolve, reject) => {
      asked.push(path);
      waiting.set(path, resolve);
      signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });
  const give = (path) => {
    waiting.get(path)?.(new ArrayBuffer(32));
    waiting.delete(path);
  };
  return { fetch, asked, give, waiting };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

function stream(f) {
  const got = { cells: new Map(), far: 0, horizon: 0, removed: [] };
  const s = createLevelStream({
    pack,
    fetch: f.fetch,
    wanted,
    tier: 'high',
    onFar: () => got.far++,
    onHorizon: () => got.horizon++,
    onCell: (key, bin, band) => got.cells.set(key, band),
    onDrop: (key) => {
      got.cells.delete(key);
      got.removed.push(key);
    },
  });
  return { s, got };
}

describe('createLevelStream', () => {
  it('asks for the far list first, and is ready when it has it, with no near cell yet', async () => {
    const f = fakeFetch();
    const { s, got } = stream(f);
    s.update([10, 10], 'high');
    expect(f.asked[0]).toBe('far.bin');
    expect(s.ready()).toBe(false);
    f.give('far.bin');
    await tick();
    expect(s.ready()).toBe(true);
    expect(got.far).toBe(1);
    expect(got.cells.size).toBe(0);
    s.dispose();
  });

  it('then the near cells, nearest first, then the ring', async () => {
    const f = fakeFetch();
    const { s, got } = stream(f);
    s.update([10, 10], 'high');
    f.give('far.bin');
    await tick();
    const cellsAsked = f.asked.filter((p) => p.startsWith('cells/'));
    expect(cellsAsked[0]).toBe('cells/0_0.bin');
    // (four at a time: hand out every answer until nothing is asked)
    while (f.waiting.size) {
      for (const p of [...f.waiting.keys()]) f.give(p);
      await tick();
    }
    expect([...got.cells.values()].filter((b) => b === 'near').length).toBe(9);
    expect([...got.cells.values()].filter((b) => b === 'mid').length).toBe(16);
    expect(s.progress()).toBe(1);
    s.dispose();
  });

  it('a near cell arriving after dispose adds nothing, and every fetch is aborted', async () => {
    const f = fakeFetch();
    const { s, got } = stream(f);
    s.update([10, 10], 'high');
    f.give('far.bin');
    await tick();
    s.dispose();
    f.give('cells/0_0.bin');
    await tick();
    expect(got.cells.size).toBe(0);
  });

  it('removes a cell left three cells behind, and keeps its bytes for coming back', async () => {
    const f = fakeFetch();
    const { s, got } = stream(f);
    s.update([10, 10], 'high');
    f.give('far.bin');
    await tick();
    while (f.waiting.size) {
      for (const p of [...f.waiting.keys()]) f.give(p);
      await tick();
    }
    expect(got.cells.has('-2,0')).toBe(true);
    s.update([10 + 128, 10], 'high'); // one cell east: -2,0 is three behind now
    await tick();
    expect(got.removed).toContain('-2,0');
    expect(got.cells.get('0,0')).toBe('near');
    expect(got.cells.has('-1,0')).toBe(true); // (two behind: the ring still)
    const before = f.asked.length;
    s.update([10, 10], 'high');
    await tick();
    expect(got.cells.has('-2,0')).toBe(true);
    expect(f.asked.slice(before)).not.toContain('cells/-2_0.bin');
    s.dispose();
  });
});
