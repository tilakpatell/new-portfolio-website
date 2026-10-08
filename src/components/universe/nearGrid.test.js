import { describe, expect, it, vi } from 'vitest';
import { createNearGrid } from './nearGrid';
import { nearItems } from './nearMaps';

const flush = async (n = 4) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
};

// an item whose build the test can hold, and whose part says what was done to it
const item = (id, x, z = 0) => {
  const log = [];
  const part = { id, textures: [], show: vi.fn((on) => log.push(on ? 'on' : 'off')), dispose: vi.fn(() => log.push('gone')) };
  const it = { id, at: [x, 0, z], log, part, build: vi.fn(async () => part) };
  return it;
};
const at = (x, z = 0) => ({ x, y: 0, z });
const opts = { size: 100, near: 100, far: 200, ahead: 0 };

describe('the near grid', () => {
  it('builds and prepares a near cell, and only then shows it', async () => {
    const a = item('a', 50);
    let release;
    const prepare = vi.fn(() => new Promise((r) => (release = r)));
    const grid = createNearGrid({ items: [a], prepare, ...opts });
    grid.update(at(0));
    await flush();
    expect(a.build).toHaveBeenCalledTimes(1);
    expect(prepare).toHaveBeenCalledWith([a.part]);
    grid.update(at(0));
    expect(a.part.show).not.toHaveBeenCalled();
    release();
    await flush();
    grid.update(at(0));
    expect(a.log).toEqual(['on']);
    expect(grid.shown()).toEqual(['a']);
  });

  it('leaves a far cell alone, hides one past far and lets it go past twice that', async () => {
    const a = item('a', 50);
    const b = item('b', 5000);
    const grid = createNearGrid({ items: [a, b], ...opts });
    grid.update(at(0));
    await flush();
    grid.update(at(0));
    expect(b.build).not.toHaveBeenCalled();
    expect(a.log).toEqual(['on']);
    grid.update(at(320)); // (a's cell 220 off: hidden)
    expect(a.log).toEqual(['on', 'off']);
    expect(a.part.dispose).not.toHaveBeenCalled();
    grid.update(at(520)); // (420 off: let go)
    expect(a.part.dispose).toHaveBeenCalledTimes(1);
    expect(grid.shown()).toEqual([]);
  });

  it('a cell let go while it was being made is disposed, never shown', async () => {
    const a = item('a', 50);
    let release;
    const grid = createNearGrid({ items: [a], prepare: () => new Promise((r) => (release = r)), ...opts });
    grid.update(at(0));
    await flush();
    grid.update(at(5000));
    release();
    await flush();
    grid.update(at(5000));
    expect(a.part.show).not.toHaveBeenCalled();
    expect(a.part.dispose).toHaveBeenCalledTimes(1);
  });

  it('settles behind the veil: every near cell made and shown', async () => {
    const a = item('a', 50);
    const b = item('b', 150);
    const grid = createNearGrid({ items: [a, b], prepare: () => new Promise((r) => setTimeout(r, 5)), ...opts });
    await grid.settle(at(100), { cap: 2000 });
    expect(grid.shown().sort()).toEqual(['a', 'b']);
  });

  it('settle gives up at its cap', async () => {
    const a = item('a', 50);
    const grid = createNearGrid({ items: [a], prepare: () => new Promise(() => {}), ...opts });
    const t0 = Date.now();
    await grid.settle(at(0), { cap: 30 });
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(grid.shown()).toEqual([]);
  });

  it('a cell with an item that fails lets the rest go and is tried again later', async () => {
    const a = item('a', 50);
    const bad = { id: 'bad', at: [60, 0, 0], build: vi.fn(async () => Promise.reject(new Error('no'))) };
    const grid = createNearGrid({ items: [a, bad], ...opts });
    grid.update(at(0));
    await flush();
    expect(a.part.dispose).toHaveBeenCalledTimes(1);
    expect(grid.shown()).toEqual([]);
    await grid.settle(at(0), { cap: 50 }); // (nothing in flight: settle returns)
    for (let i = 0; i < 130; i++) grid.update(at(0));
    await flush();
    expect(bad.build).toHaveBeenCalledTimes(2);
  });

  it('builds ahead of the way the camera is going', async () => {
    const b = item('b', 450);
    const grid = createNearGrid({ items: [b], ...opts, ahead: 300 });
    grid.update(at(0));
    await flush();
    expect(b.build).not.toHaveBeenCalled();
    grid.update(at(20)); // (heading +x: the point ahead is at 320)
    await flush();
    expect(b.build).toHaveBeenCalledTimes(1);
  });

  it('puts everything back when it goes', async () => {
    const a = item('a', 50);
    const grid = createNearGrid({ items: [a], ...opts });
    grid.update(at(0));
    await flush();
    grid.update(at(0));
    grid.dispose();
    expect(a.log).toEqual(['on', 'off', 'gone']);
  });

  it('with nothing on it does nothing', async () => {
    const grid = createNearGrid({ items: [] });
    grid.update(at(0));
    await grid.settle(at(0));
    expect(grid.shown()).toEqual([]);
  });
});

describe('the planets as items on the grid', () => {
  const tex = (url) => ({ isTexture: true, url, disposed: false, dispose() { this.disposed = true; } });
  const planet = (id, x, list = [{ name: id, file: `${id}-hq.webp`, colour: true }]) => {
    const swapMaps = vi.fn();
    swapMaps.fit = vi.fn();
    return { id, at: [x, 0, 0], nearSet: () => list, swapMaps, nearGeometry: vi.fn() };
  };

  it('fetches a set, fits it before it is sent, and wears it on show', async () => {
    const load = vi.fn(async (url) => tex(url));
    const p = planet('a', 0);
    const [it] = nearItems([p], { level: 'high', load, forget: vi.fn() });
    const part = await it.build();
    expect(load).toHaveBeenCalledWith('/textures/universe/a-hq.webp', { color: true });
    expect(p.swapMaps.fit).toHaveBeenCalledTimes(1);
    expect(part.textures.map((t) => t.url)).toEqual(['/textures/universe/a-hq.webp']);
    expect(p.swapMaps).not.toHaveBeenCalled();
    part.show(true);
    expect(p.swapMaps.mock.calls[0][0].a.url).toBe('/textures/universe/a-hq.webp');
    expect(p.nearGeometry).toHaveBeenCalledWith(true, 'high');
    part.dispose();
    expect(p.swapMaps).toHaveBeenLastCalledWith(null);
    expect(p.nearGeometry).toHaveBeenLastCalledWith(false, 'high');
    expect(part.textures[0].disposed).toBe(true);
  });

  it('keeps a texture two sets share till the last lets it go', async () => {
    const shared = tex('/textures/universe/a-hq.webp');
    const forget = vi.fn();
    const p = planet('a', 0);
    const [it] = nearItems([p], { level: 'high', load: async () => shared, forget });
    const one = await it.build();
    const two = await it.build();
    one.dispose();
    expect(shared.disposed).toBe(false);
    expect(forget).not.toHaveBeenCalled();
    two.dispose();
    expect(shared.disposed).toBe(true);
    expect(forget).toHaveBeenCalledWith('/textures/universe/a-hq.webp');
  });

  it('falls back through a set’s files, and a missing map is just left out', async () => {
    const load = vi.fn(async (url) => {
      if (url.endsWith('.ktx2') || url.includes('normal')) throw new Error('no');
      return tex(url);
    });
    const p = planet('a', 0, [
      { name: 'a', file: 'a-xl.ktx2', fallback: 'a-hq.webp', colour: true },
      { name: 'a-normal', file: 'a-normal-hq.webp', colour: false },
    ]);
    const [it] = nearItems([p], { level: 'ultra', load, forget: vi.fn() });
    const part = await it.build();
    expect(part.textures.map((t) => t.url)).toEqual(['/textures/universe/a-hq.webp']);
  });

  it('none on low, on a phone, or for a planet with nothing finer', () => {
    const p = planet('a', 0);
    expect(nearItems([p], { level: 'low' })).toEqual([]);
    expect(nearItems([p], { level: 'high', small: true })).toEqual([]);
    expect(nearItems([{ id: 's', at: [0, 0, 0], nearSet: () => [] }], { level: 'high' })).toEqual([]);
  });
});
