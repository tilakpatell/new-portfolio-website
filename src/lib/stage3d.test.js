import { describe, expect, it } from 'vitest';
import { stageBloomGroups, stageRatio, stageSizing, stageTune } from './stage3d';

describe('the stage’s pixel ratio', () => {
  // (no window under test: the screen's ratio is 1)
  it('supersamples a high-tier desktop, as lib/device budgets it', () => {
    expect(stageRatio({ tier: 'high' })).toBe(1.25);
    expect(stageRatio({ tier: 'ultra' })).toBe(1.5);
  });

  it('keeps a phone, a weak device and software rendering at the screen’s pixels', () => {
    expect(stageRatio({ tier: 'mid' })).toBe(1);
    expect(stageRatio({ tier: 'low' })).toBe(1);
    expect(stageRatio({ soft: true, tier: 'ultra' })).toBe(1);
  });
});

describe('the stage’s drawing buffers', () => {
  const sizing = (ratio = 1.75, soft = false) => {
    const made = [];
    const z = stageSizing({ ratio, soft, canvas: (w, h, pr) => made.push(['canvas', w, h, pr]), buffers: (w, h, pr) => made.push(['buffers', w, h, pr]) });
    return { made, z };
  };

  it('makes nothing when asked, only at fit (the start of a frame that draws)', () => {
    const { made, z } = sizing();
    expect(z.resize(1470, 878)).toBe(true);
    z.scale(0.85);
    expect(made).toEqual([]);
    expect(z.stale).toBe(true);
    expect(z.fit()).toBe(true);
    expect(made).toEqual([
      ['canvas', 1470, 878, 1.75],
      ['buffers', 1470, 878, 1.75 * 0.85],
    ]);
    expect(z.fit()).toBe(false);
    expect(made).toHaveLength(2);
  });

  it('makes a pace step in the composer’s buffers alone: the canvas, which waits on the graphics chip, is left as it is', () => {
    const { made, z } = sizing();
    z.resize(1470, 878);
    z.fit();
    made.length = 0;
    for (const k of [0.85, 0.72, 1]) {
      z.scale(k);
      z.fit();
    }
    expect(made).toEqual([
      ['buffers', 1470, 878, 1.75 * 0.85],
      ['buffers', 1470, 878, 1.75 * 0.72],
      ['buffers', 1470, 878, 1.75],
    ]);
  });

  it('makes a step in the canvas when the scene is drawn straight to it (soft)', () => {
    const { made, z } = sizing(1, true);
    z.resize(800, 600);
    z.scale(0.5);
    z.fit();
    expect(made).toEqual([
      ['canvas', 800, 600, 0.5],
      ['buffers', 800, 600, 0.5],
    ]);
  });

  it('keeps a world’s sharpness when the watchdog drops the ratio, and makes a new size with it as one', () => {
    const { made, z } = sizing();
    z.resize(1470, 878);
    z.scale(0.6);
    z.fit();
    made.length = 0;
    z.setRatio(1);
    z.resize(1300, 800);
    z.fit();
    expect(made).toEqual([
      ['canvas', 1300, 800, 1],
      ['buffers', 1300, 800, 0.6],
    ]);
  });

  it('makes nothing for the same size again, or for a change undone before a frame drew', () => {
    const { made, z } = sizing(1);
    z.resize(800.4, 600.2);
    z.fit();
    made.length = 0;
    expect(z.resize(800, 600)).toBe(false);
    z.scale(0.85);
    z.scale(1);
    z.resize(900, 600);
    z.resize(800, 600);
    expect(z.fit()).toBe(false);
    expect(made).toEqual([]);
    expect(z.size).toEqual({ w: 800, h: 600 });
  });

  it('never sizes below a pixel', () => {
    const { made, z } = sizing(1);
    z.resize(0, -4);
    z.scale(0.5);
    z.fit();
    expect(z.size).toEqual({ w: 1, h: 1 });
    expect(made).toEqual([['buffers', 1, 1, 0.5]]);
  });
});

describe('the stage’s tuning panel', () => {
  const pass = () => ({ threshold: 0.82, strength: 0.65, radius: 0.42 });
  const fake = () => {
    const made = [];
    const panel = () => {
      const p = { opened: [], disposed: 0, open: (groups, o) => p.opened.push({ groups, ...o }), dispose: () => (p.disposed += 1) };
      made.push(p);
      return p;
    };
    return { made, panel };
  };

  it('makes nothing without ?debug', () => {
    const { made, panel } = fake();
    const t = stageTune({ bloomPass: pass(), on: () => false, panel, title: () => 'roy' });
    t.tune([{ name: 'game', items: [] }]);
    t.close();
    expect(made).toHaveLength(0);
  });

  it('builds nothing and throws nothing with no document (the real panel, ?debug read from no address)', () => {
    const t = stageTune({ bloomPass: pass() });
    expect(() => t.tune([])).not.toThrow();
    expect(() => t.close()).not.toThrow();
  });

  it('opens the bloom first and the game’s groups after, under the page’s name, once', () => {
    const { made, panel } = fake();
    const bloomPass = pass();
    const t = stageTune({ bloomPass, on: () => true, panel, title: () => 'roy' });
    const game = { name: 'game', items: [] };
    t.tune([game]);
    t.tune([game]);
    expect(made).toHaveLength(1);
    const { groups, title, id } = made[0].opened[1];
    expect([title, id]).toEqual(['roy', 'roy']);
    expect(groups.map((g) => g.name)).toEqual(['bloom', 'game']);
    const threshold = groups[0].items.find((i) => i.key === 'threshold');
    expect(threshold.get()).toBe(0.82);
    threshold.set(1);
    expect(bloomPass.threshold).toBe(1);
    t.close();
    expect(made[0].disposed).toBe(1);
  });

  it('reads the bloom group straight off the pass', () => {
    const p = pass();
    const [g] = stageBloomGroups(p);
    expect(g.items.map((i) => [i.key, i.get()])).toEqual([['threshold', 0.82], ['strength', 0.65], ['radius', 0.42]]);
  });
});
