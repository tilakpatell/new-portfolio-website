import { describe, expect, it } from 'vitest';
import { stageBloomGroups, stageRatio, stageTune } from './stage3d';

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
