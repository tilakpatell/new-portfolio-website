import { describe, expect, it, vi } from 'vitest';
import { capPrepare, showPrepared } from './prepareWorld';

const tick = (ms) => new Promise((r) => setTimeout(r, ms));

describe('capPrepare', () => {
  it('waits for a prepare that finishes, passing its progress on', async () => {
    const seen = [];
    await capPrepare(
      async (report) => {
        report(0.5, 'shaders');
        await tick(5);
      },
      { onProgress: (v, s) => seen.push([v, s]), cap: 1000 },
    );
    expect(seen).toEqual([[0.5, 'shaders']]);
  });

  it('stops waiting at the cap, and the prepare is told to stop', async () => {
    let alive = null;
    const seen = [];
    const t = Date.now();
    await capPrepare(
      (report, going) => {
        alive = going;
        return new Promise(() => {});
      },
      { cap: 20, onProgress: (v) => seen.push(v) },
    );
    expect(Date.now() - t).toBeLessThan(500);
    expect(alive()).toBe(false);
  });

  it('turns alive false with the page, and never rejects', async () => {
    let page = true;
    let going = null;
    const p = capPrepare(
      async (r, g) => {
        going = g;
        await tick(5);
        throw new Error('no');
      },
      { alive: () => page, cap: 1000 },
    );
    await tick(0);
    expect(going()).toBe(true);
    page = false;
    expect(going()).toBe(false);
    await expect(p).resolves.toBeUndefined();
    await expect(capPrepare(null, { cap: 10 })).resolves.toBeUndefined();
  });
});

describe('showPrepared', () => {
  it('says preparing, then on, unless something else came first', async () => {
    let gl = 'loading';
    const setGl = vi.fn((v) => (gl = typeof v === 'function' ? v(gl) : v));
    const setPrep = vi.fn();
    await showPrepared((report) => report(1, 'first draw'), { setGl, setPrep });
    expect(setGl).toHaveBeenNthCalledWith(1, 'preparing');
    expect(gl).toBe('on');
    expect(setPrep).toHaveBeenCalledWith({ value: 1, step: 'first draw' });
    gl = 'loading';
    await showPrepared(() => {
      gl = 'lost';
    }, { setGl, setPrep });
    expect(gl).toBe('lost');
    // a page let go meanwhile: left alone
    gl = 'loading';
    await showPrepared(() => {}, { setGl, setPrep, alive: () => false });
    expect(gl).toBe('preparing');
  });
});
