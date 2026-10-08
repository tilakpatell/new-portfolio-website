import { describe, expect, it, vi } from 'vitest';
import { createNearMaps, evict, wanted } from './nearMaps';

// a texture that remembers being disposed
const tex = (url) => ({ isTexture: true, url, disposed: false, dispose() { this.disposed = true; } });
// a load whose promises the test resolves (or rejects) by hand
const loader = () => {
  const calls = [];
  const load = vi.fn((url) => new Promise((resolve, reject) => calls.push({ url, resolve: () => resolve(tex(url)), reject: () => reject(new Error(`no ${url}`)) })));
  return { load, calls };
};
const flush = () => new Promise((r) => setTimeout(r, 0));
// a planet the manager can work on: its near set (step 2) is one file each,
// its standard set (step 1) none unless given
const planet = (id, x, set = [{ name: id, file: `${id}-hq.webp`, colour: true }], std = []) => ({
  id,
  at: [x, 0, 0],
  r: 1,
  nearSet: () => ({ std, near: set }),
  swapMaps: vi.fn(),
  nearGeometry: vi.fn(),
});
// one with both: its standard file at step 1, its -hq at step 2
const laddered = (id, x) => planet(id, x, [{ name: id, file: `${id}-hq.webp`, colour: true }], [{ name: id, file: `${id}.webp`, colour: true }]);
// the ids wanted at a step
const at = (want, step) => want.filter((w) => w.step === step).map((w) => w.id);

describe('which planets want their near maps', () => {
  it('wants the planets within six radii, nearest first', () => {
    expect(at(wanted([0, 0, 0], [{ id: 'a', at: [10, 0, 0], r: 1 }, { id: 'b', at: [3, 0, 0], r: 1 }, { id: 'c', at: [5, 0, 0], r: 1 }], { near: 6 }), 2)).toEqual(['b', 'c']);
  });
  it('measures in each planet’s own radii', () => {
    expect(at(wanted([0, 0, 0], [{ id: 'big', at: [50, 0, 0], r: 10 }, { id: 'small', at: [8, 0, 0], r: 1 }], { near: 6 }), 2)).toEqual(['big']);
  });
  it('holds one it already has a little further out, so the edge doesn’t flicker', () => {
    const ps = [{ id: 'a', at: [7, 0, 0], r: 1 }];
    expect(at(wanted([0, 0, 0], ps, { near: 6 }), 2)).toEqual([]);
    expect(at(wanted([0, 0, 0], ps, { near: 6, hold: 8, resident: ['a'] }), 2)).toEqual(['a']);
  });
  it('wants a planet at ten radii at step 1 and one at five at step 2, nearest first', () => {
    const ps = [{ id: 'a', at: [10, 0, 0], r: 1 }, { id: 'b', at: [5, 0, 0], r: 1 }, { id: 'c', at: [13, 0, 0], r: 1 }];
    expect(wanted([0, 0, 0], ps)).toEqual([
      { id: 'b', step: 2 },
      { id: 'a', step: 1 },
    ]);
  });
  it('holds each step out to its own edge: 7.5 radii for step 2, 15 for step 1', () => {
    const one = (x, opts) => wanted([0, 0, 0], [{ id: 'a', at: [x, 0, 0], r: 1 }], { hold: 7.5, holdFar: 15, ...opts });
    expect(one(7, {})).toEqual([{ id: 'a', step: 1 }]);
    expect(one(7, { resident: ['a'], residentFar: ['a'] })).toEqual([{ id: 'a', step: 2 }]);
    expect(one(8, { resident: ['a'], residentFar: ['a'] })).toEqual([{ id: 'a', step: 1 }]);
    expect(one(14, {})).toEqual([]);
    expect(one(14, { residentFar: ['a'] })).toEqual([{ id: 'a', step: 1 }]);
    expect(one(16, { residentFar: ['a'] })).toEqual([]);
  });
});

describe('the resident budget', () => {
  it('keeps the two nearest wanted and drops the rest', () => {
    expect(evict(['a', 'b'], ['c', 'b'], 2)).toEqual({ keep: ['c', 'b'], drop: ['a'] });
  });
  it('drops nothing while there is room', () => {
    expect(evict(['a'], ['a', 'b'], 2)).toEqual({ keep: ['a', 'b'], drop: [] });
  });
});

describe('the near maps, loaded and swapped', () => {
  it('installs a planet’s near set when it arrives and the planet is still near', async () => {
    const { load, calls } = loader();
    const near = createNearMaps({ level: 'high', load });
    const a = planet('a', 3);
    near.update([0, 0, 0], [a]);
    expect(load).toHaveBeenCalledTimes(1);
    expect(calls[0].url).toBe('/textures/universe/a-hq.webp');
    near.update([0, 0, 0], [a]); // (no second load while one's in flight)
    expect(load).toHaveBeenCalledTimes(1);
    calls[0].resolve();
    await flush();
    expect(a.swapMaps).toHaveBeenCalledTimes(1);
    expect(a.swapMaps.mock.calls[0][0].a.url).toBe('/textures/universe/a-hq.webp');
    expect(a.nearGeometry).toHaveBeenCalledWith(true, 'high');
    expect(near.resident()).toEqual(['a']);
  });

  it('does not install a set that arrives after the planet left', async () => {
    const { load, calls } = loader();
    const forget = vi.fn();
    const near = createNearMaps({ level: 'high', load, forget });
    const a = planet('a', 3);
    near.update([0, 0, 0], [a]);
    near.update([100, 0, 0], [a]); // (a fast fly-by: gone before the maps came)
    calls[0].resolve();
    await flush();
    expect(a.swapMaps).not.toHaveBeenCalled();
    expect(a.nearGeometry).not.toHaveBeenCalledWith(true, 'high');
    const t = await load.mock.results[0].value;
    expect(t.disposed).toBe(true);
    expect(forget).toHaveBeenCalledWith('/textures/universe/a-hq.webp');
    expect(near.resident()).toEqual([]);
  });

  it('disposes a dropped planet’s near set', async () => {
    const { load, calls } = loader();
    const near = createNearMaps({ level: 'high', load });
    const ps = [planet('a', 3), planet('b', 40), planet('c', 80)];
    const at = (x) => near.update([x, 0, 0], ps);
    at(0);
    calls[0].resolve();
    await flush();
    at(38); // b comes near; a is 35 out: dropped (only near ones are kept)
    calls[1].resolve();
    await flush();
    expect(ps[0].swapMaps).toHaveBeenLastCalledWith(null);
    expect(ps[0].nearGeometry).toHaveBeenLastCalledWith(false);
    expect((await load.mock.results[0].value).disposed).toBe(true);
    expect(near.resident()).toEqual(['b']);
  });

  it('keeps the two nearest when three are near, dropping the furthest', async () => {
    const { load, calls } = loader();
    const near = createNearMaps({ level: 'high', load });
    // three close together (C-137 and its moons): the ship by a and b
    const ps = [planet('a', 2), planet('b', 4), planet('c', 5.5)];
    near.update([0, 0, 0], ps);
    expect(calls.map((c) => c.url)).toEqual(['/textures/universe/a-hq.webp', '/textures/universe/b-hq.webp']);
    for (const c of calls) c.resolve();
    await flush();
    expect(near.resident().sort()).toEqual(['a', 'b']);
    // the ship moves on past a: now b and c are nearest; a goes
    near.update([5, 0, 0], ps);
    calls[2].resolve();
    await flush();
    expect(near.resident().sort()).toEqual(['b', 'c']);
    expect(ps[0].swapMaps).toHaveBeenLastCalledWith(null);
    expect((await load.mock.results[0].value).disposed).toBe(true);
    expect((await load.mock.results[1].value).disposed).toBe(false);
  });

  it('skips a planet with nothing to load and nothing to reshape', () => {
    const { load } = loader();
    const near = createNearMaps({ level: 'high', load });
    const station = { id: 's', at: [1, 0, 0], r: 1, nearSet: () => ({ std: [], near: [] }) };
    near.update([0, 0, 0], [station]);
    expect(load).not.toHaveBeenCalled();
    expect(near.resident()).toEqual([]);
  });

  it('a missing map leaves the planet its standard one, the rest still come', async () => {
    const { load, calls } = loader();
    const near = createNearMaps({ level: 'high', load });
    const a = planet('a', 3, [
      { name: 'a', file: 'a-hq.webp', colour: true },
      { name: 'a-normal', file: 'a-normal-hq.webp', colour: false },
    ]);
    near.update([0, 0, 0], [a]);
    calls[0].resolve();
    calls[1].reject();
    await flush();
    const T2 = a.swapMaps.mock.calls[0][0];
    expect(Object.keys(T2)).toEqual(['a']);
  });

  it('falls back through a set’s files in order when one won’t load', async () => {
    const { load, calls } = loader();
    const near = createNearMaps({ level: 'ultra', load });
    const a = planet('a', 3, [{ name: 'a', file: 'a-xl.ktx2', fallback: 'a-hq.webp', colour: true }]);
    near.update([0, 0, 0], [a]);
    calls[0].reject();
    await flush();
    expect(calls[1].url).toBe('/textures/universe/a-hq.webp');
    calls[1].resolve();
    await flush();
    expect(a.swapMaps.mock.calls[0][0].a.url).toBe('/textures/universe/a-hq.webp');
  });

  it('no near set and no finer sphere on low or on a small screen', () => {
    for (const opts of [{ level: 'low' }, { level: 'high', small: true }]) {
      const { load } = loader();
      const near = createNearMaps({ ...opts, load });
      near.update([0, 0, 0], [planet('a', 2)]);
      expect(load).not.toHaveBeenCalled();
      expect(near.resident()).toEqual([]);
    }
  });

  it('on low and on a small screen, a planet near still gets its standard set (step 1), never its near set', async () => {
    for (const opts of [{ level: 'low' }, { level: 'high', small: true }]) {
      const { load, calls } = loader();
      const near = createNearMaps({ ...opts, load });
      const a = laddered('a', 2);
      near.update([0, 0, 0], [a]);
      expect(calls.map((c) => c.url)).toEqual(['/textures/universe/a.webp']);
      calls[0].resolve();
      await flush();
      expect(a.swapMaps.mock.calls[0][0].a.url).toBe('/textures/universe/a.webp');
      expect(a.nearGeometry).not.toHaveBeenCalled();
      expect(near.resident()).toEqual([]);
      expect(near.resident(1)).toEqual(['a']);
    }
  });

  it('puts every planet back and disposes its sets when the scene goes', async () => {
    const { load, calls } = loader();
    const near = createNearMaps({ level: 'high', load });
    const a = planet('a', 2);
    const b = planet('b', 3);
    near.update([0, 0, 0], [a, b]);
    calls[0].resolve();
    await flush();
    near.dispose();
    calls[1].resolve(); // (b's arrives after: never installed)
    await flush();
    expect(a.swapMaps).toHaveBeenLastCalledWith(null);
    expect(b.swapMaps).not.toHaveBeenCalled();
    expect((await load.mock.results[0].value).disposed).toBe(true);
    expect((await load.mock.results[1].value).disposed).toBe(true);
  });
});

describe('the three steps: up front, standard within twelve radii, near within six', () => {
  it('a planet at ten radii gets its standard set, at five its near set over it and its finer sphere; each goes past its edge', async () => {
    const { load, calls } = loader();
    const near = createNearMaps({ level: 'high', load });
    const a = laddered('a', 0);
    const go = (x) => near.update([x, 0, 0], [a]);
    go(10);
    expect(calls.map((c) => c.url)).toEqual(['/textures/universe/a.webp']);
    calls[0].resolve();
    await flush();
    expect(a.swapMaps).toHaveBeenLastCalledWith({ a: expect.objectContaining({ url: '/textures/universe/a.webp' }) });
    expect(a.nearGeometry).not.toHaveBeenCalled();
    expect([near.resident(1), near.resident()]).toEqual([['a'], []]);
    go(5);
    expect(calls.map((c) => c.url)).toEqual(['/textures/universe/a.webp', '/textures/universe/a-hq.webp']);
    calls[1].resolve();
    await flush();
    // (the near file over the standard one, for the maps it has a finer copy of)
    expect(a.swapMaps.mock.lastCall[0].a.url).toBe('/textures/universe/a-hq.webp');
    expect(a.nearGeometry).toHaveBeenLastCalledWith(true, 'high');
    expect([near.resident(1), near.resident()]).toEqual([['a'], ['a']]);
    go(7); // (inside step 2's edge, 7.5: held)
    expect(load).toHaveBeenCalledTimes(2);
    expect(near.resident()).toEqual(['a']);
    go(8); // past it: back to the standard set
    expect(a.swapMaps.mock.lastCall[0].a.url).toBe('/textures/universe/a.webp');
    expect(a.nearGeometry).toHaveBeenLastCalledWith(false);
    expect((await load.mock.results[1].value).disposed).toBe(true);
    expect([near.resident(1), near.resident()]).toEqual([['a'], []]);
    go(14); // (inside step 1's edge, 15: held)
    expect(load).toHaveBeenCalledTimes(2);
    expect(near.resident(1)).toEqual(['a']);
    go(16); // past it: its own maps again
    expect(a.swapMaps).toHaveBeenLastCalledWith(null);
    expect((await load.mock.results[0].value).disposed).toBe(true);
    expect([near.resident(1), near.resident()]).toEqual([[], []]);
  });

  it('two planets within six radii both at step 2, a third waits at step 1 (two near sets at most)', async () => {
    const { load, calls } = loader();
    const near = createNearMaps({ level: 'high', load });
    const ps = [laddered('a', 2), laddered('b', 4), laddered('c', 5.5)];
    near.update([0, 0, 0], ps);
    const urls = calls.map((c) => c.url);
    expect(urls.filter((u) => u.endsWith('-hq.webp'))).toEqual(['/textures/universe/a-hq.webp', '/textures/universe/b-hq.webp']);
    expect(urls.filter((u) => !u.endsWith('-hq.webp'))).toEqual(['/textures/universe/a.webp', '/textures/universe/b.webp', '/textures/universe/c.webp']);
    for (const c of calls) c.resolve();
    await flush();
    expect(near.resident().sort()).toEqual(['a', 'b']);
    expect(near.resident(1).sort()).toEqual(['a', 'b', 'c']);
    expect(ps[2].nearGeometry).not.toHaveBeenCalled();
    // past a: b and c the nearest, c's near set comes, a keeps its standard one
    near.update([5, 0, 0], ps);
    expect(calls.map((c) => c.url).slice(5)).toEqual(['/textures/universe/c-hq.webp']);
    calls[5].resolve();
    await flush();
    expect(near.resident().sort()).toEqual(['b', 'c']);
    expect(ps[0].swapMaps.mock.lastCall[0].a.url).toBe('/textures/universe/a.webp');
  });

  it('keeps at most four standard sets, the nearest, and always those of the planets at step 2', async () => {
    const { calls, load } = loader();
    const near = createNearMaps({ level: 'high', load });
    const ps = [8, 9, 10, 11, 11.5].map((x, i) => laddered(`p${i}`, x));
    near.update([0, 0, 0], ps);
    expect(calls.map((c) => c.url)).toEqual(['p0', 'p1', 'p2', 'p3'].map((id) => `/textures/universe/${id}.webp`));
    const tight = loader();
    const one = createNearMaps({ level: 'high', load: tight.load, standard: 1 });
    one.update([0, 0, 0], [laddered('a', 2), laddered('b', 3)]);
    expect(tight.calls.map((c) => c.url).sort()).toEqual(['/textures/universe/a-hq.webp', '/textures/universe/a.webp', '/textures/universe/b-hq.webp', '/textures/universe/b.webp']);
  });

  it('on mid, step 2 is the finer sphere alone (its near set is the standard one)', async () => {
    const { load, calls } = loader();
    const near = createNearMaps({ level: 'mid', load });
    const a = planet('a', 3, [], [{ name: 'a', file: 'a.webp', colour: true }]);
    near.update([0, 0, 0], [a]);
    expect(calls.map((c) => c.url)).toEqual(['/textures/universe/a.webp']);
    calls[0].resolve();
    await flush();
    expect(a.nearGeometry).toHaveBeenCalledWith(true, 'mid');
    expect(a.swapMaps.mock.lastCall[0].a.url).toBe('/textures/universe/a.webp');
    expect(near.resident()).toEqual(['a']);
  });
});

describe('step 0: what a far planet shows, right after the first frame', () => {
  // a planet whose relief and glow were stood in for up front: their small files come in the background
  const far = (id, x, { std = [], near = [] } = {}) => ({
    ...planet(id, x, near, std),
    nearSet: () => ({ later: [{ name: `${id}-glow`, file: `${id}-glow.webp`, colour: true }, { name: `${id}-normal`, file: `${id}-normal-sm.webp`, colour: false }], std, near }),
  });
  // idle moments the test hands out
  const idler = () => {
    const q = [];
    const o = { idle: (fn) => q.push(fn), run: () => q.shift()?.() };
    Object.defineProperty(o, 'size', { get: () => q.length });
    return o;
  };

  it('fetches nothing for the first frame, every planet’s later maps at the first idle moment, and puts them on one planet per idle moment, nearest first', async () => {
    const { load, calls } = loader();
    const { idle, run } = idler();
    const near = createNearMaps({ level: 'high', load, idle });
    const ps = [far('b', 300), far('a', 100)];
    near.update([0, 0, 0], ps);
    expect(load).not.toHaveBeenCalled(); // (the first frame asks for none of them)
    run(); // the first idle moment: every fetch at once (about 0.78 MB on the map)
    expect(calls.map((c) => c.url)).toEqual(['/textures/universe/a-glow.webp', '/textures/universe/a-normal-sm.webp', '/textures/universe/b-glow.webp', '/textures/universe/b-normal-sm.webp']);
    for (const c of calls) c.resolve();
    await flush();
    expect(ps[1].swapMaps).not.toHaveBeenCalled(); // (the putting on waits for an idle moment of its own)
    run();
    await flush();
    expect(ps[1].swapMaps.mock.lastCall[0]).toEqual({ 'a-glow': expect.objectContaining({ url: '/textures/universe/a-glow.webp' }), 'a-normal': expect.objectContaining({ url: '/textures/universe/a-normal-sm.webp' }) });
    expect(near.resident(0)).toEqual(['a']);
    expect(ps[0].swapMaps).not.toHaveBeenCalled();
    expect(ps[1].nearGeometry).not.toHaveBeenCalled();
    run(); // (the next planet's at the next idle moment)
    await flush();
    expect(ps[0].swapMaps).toHaveBeenCalledTimes(1);
    expect(near.resident(0).sort()).toEqual(['a', 'b']);
    expect(load).toHaveBeenCalledTimes(4);
  });

  it('a planet whose maps are slow comes on when they land, the rest after it in turn', async () => {
    const { load, calls } = loader();
    const { idle, run } = idler();
    const near = createNearMaps({ level: 'high', load, idle });
    const ps = [far('a', 100), far('b', 300)];
    near.update([0, 0, 0], ps);
    run();
    for (const c of calls.slice(2)) c.resolve(); // (b's land first)
    await flush();
    run();
    await flush();
    expect(near.resident(0)).toEqual([]); // (a, nearest, is first in turn)
    for (const c of calls.slice(0, 2)) c.resolve();
    await flush();
    run();
    await flush();
    run();
    await flush();
    expect(near.resident(0)).toEqual(['a', 'b']);
  });

  it('sends each set to the graphics chip a slice at a time before it goes on', async () => {
    const { load, calls } = loader();
    const { idle, run } = idler();
    const sent = [];
    const near = createNearMaps({ level: 'high', load, idle, upload: async (ts) => sent.push(ts.map((t) => t.url)) });
    const a = far('a', 100);
    near.update([0, 0, 0], [a]);
    run();
    for (const c of calls) c.resolve();
    await flush();
    run();
    await flush();
    expect(sent).toEqual([['/textures/universe/a-glow.webp', '/textures/universe/a-normal-sm.webp']]);
    expect(a.swapMaps).toHaveBeenCalledTimes(1);
  });

  it('keeps them for good: the standard set over them near, back to them (not the stand-ins) past fifteen radii', async () => {
    const { load, calls } = loader();
    const { idle, run } = idler();
    const near = createNearMaps({ level: 'high', load, idle });
    const a = far('a', 0, { std: [{ name: 'a-glow', file: 'a-glow-std.webp', colour: true }] });
    near.update([100, 0, 0], [a]);
    run();
    for (const c of calls) c.resolve();
    await flush();
    run();
    await flush();
    near.update([10, 0, 0], [a]); // step 1: its standard glow over the small one
    calls[2].resolve();
    await flush();
    expect(a.swapMaps.mock.lastCall[0]['a-glow'].url).toBe('/textures/universe/a-glow-std.webp');
    expect(a.swapMaps.mock.lastCall[0]['a-normal'].url).toBe('/textures/universe/a-normal-sm.webp');
    near.update([100, 0, 0], [a]); // gone on: the small set again
    expect(a.swapMaps.mock.lastCall[0]['a-glow'].url).toBe('/textures/universe/a-glow.webp');
    expect((await load.mock.results[2].value).disposed).toBe(true);
    expect((await load.mock.results[0].value).disposed).toBe(false);
    near.dispose(); // (and freed with the scene)
    expect(a.swapMaps).toHaveBeenLastCalledWith(null);
    expect((await load.mock.results[0].value).disposed).toBe(true);
  });

  it('a file both the small and the standard set ask for (a map with no -sm) stays while either holds it', async () => {
    const { load, calls } = loader();
    const { idle, run } = idler();
    const near = createNearMaps({ level: 'high', load, idle });
    const a = { ...planet('a', 0), nearSet: () => ({ later: [{ name: 'a-rough', file: 'a-rough.webp', colour: false }], std: [{ name: 'a-rough', file: 'a-rough.webp', colour: false }], near: [] }) };
    near.update([10, 0, 0], [a]); // step 1 first (it starts beside it), step 0 at the next idle moment
    run();
    for (const c of calls) c.resolve();
    await flush();
    run();
    await flush();
    near.update([100, 0, 0], [a]); // step 1 goes; step 0 still wears the file
    expect((await load.mock.results[0].value).disposed).toBe(false);
  });

  it('a scene that goes mid-way frees every planet’s set, landed or still in flight, and puts none on', async () => {
    const { load, calls } = loader();
    const idler0 = idler();
    const { idle, run } = idler0;
    const forget = vi.fn();
    const near = createNearMaps({ level: 'high', load, forget, idle });
    const ps = [far('a', 100), far('b', 200), far('c', 300)];
    near.update([0, 0, 0], ps);
    run(); // every fetch at once
    expect(calls).toHaveLength(6);
    for (const c of calls.slice(0, 4)) c.resolve(); // a's and b's land; c's are still on the way
    await flush();
    near.dispose(); // (a's turn queued, not yet taken)
    for (const c of calls.slice(4)) c.resolve();
    await flush();
    while (idler0.size) run(); // (an idle moment that comes after: nothing to do)
    await flush();
    for (const [i, r] of load.mock.results.entries()) expect((await r.value).disposed, calls[i].url).toBe(true);
    expect(forget.mock.calls.map(([u]) => u).sort()).toEqual(calls.map((c) => c.url).sort());
    for (const p of ps) expect(p.swapMaps).not.toHaveBeenCalled();
    expect(near.resident(0)).toEqual([]);
  });

  it('a scene that goes while a set is being sent up frees it once it’s up, the rest as they land', async () => {
    const { load, calls } = loader();
    const { idle, run } = idler();
    const forget = vi.fn();
    let sent = null;
    const near = createNearMaps({ level: 'high', load, forget, idle, upload: () => new Promise((r) => (sent = r)) });
    const ps = [far('a', 100), far('b', 200)];
    near.update([0, 0, 0], ps);
    run();
    for (const c of calls) c.resolve();
    await flush();
    run(); // a's turn: sent up, slowly
    await flush();
    near.dispose();
    sent();
    await flush();
    for (const r of load.mock.results) expect((await r.value).disposed).toBe(true);
    expect(forget).toHaveBeenCalledTimes(4);
    expect(ps[0].swapMaps).not.toHaveBeenCalled();
  });

  it('runs on every level, low and a phone too (it’s what they wore from the start before)', async () => {
    for (const opts of [{ level: 'low' }, { level: 'high', small: true }, { level: 'ultra' }]) {
      const { load, calls } = loader();
      const { idle, run } = idler();
      const near = createNearMaps({ ...opts, load, idle });
      near.update([0, 0, 0], [far('a', 100)]);
      run();
      expect(calls.length, JSON.stringify(opts)).toBe(2);
    }
  });
});

describe('a phone’s standard set', () => {
  it('asks each planet for its sets as a phone, so a 2048 standard map stays at its smallest there', () => {
    for (const [opts, small] of [[{ level: 'high', small: true }, true], [{ level: 'low' }, false], [{ level: 'high' }, false]]) {
      const { load } = loader();
      const near = createNearMaps({ ...opts, load, idle: () => {} });
      const a = planet('a', 100);
      a.nearSet = vi.fn(() => ({ later: [], std: [], near: [] }));
      near.update([0, 0, 0], [a]);
      expect(a.nearSet).toHaveBeenCalledWith(opts.level, { small });
    }
  });
});

describe('a planet that comes back before its old set arrived', () => {
  it('keeps the texture the loader’s cache gave both sets', async () => {
    const shared = tex('/textures/universe/a-hq.webp');
    const waiting = [];
    const load = vi.fn(() => new Promise((r) => waiting.push(() => r(shared))));
    const near = createNearMaps({ level: 'high', load });
    const a = planet('a', 3);
    near.update([0, 0, 0], [a]);
    near.update([100, 0, 0], [a]); // gone
    near.update([0, 0, 0], [a]); // back: a second set, the same cached texture
    expect(load).toHaveBeenCalledTimes(2);
    for (const go of waiting) go(); // (the old set lands first, then the new)
    await flush();
    expect(shared.disposed).toBe(false);
    expect(a.swapMaps).toHaveBeenCalledWith({ a: shared });
  });
});
