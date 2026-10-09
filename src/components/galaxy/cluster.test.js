import { describe, expect, it } from 'vitest';
import { createCluster } from './cluster';

// (the tests run in Node: a stand-in for each element, with the calls cluster.js makes)
const el = () => {
  const attrs = new Set();
  const vars = new Map();
  return {
    textContent: '',
    style: { setProperty: (k, v) => vars.set(k, v), getPropertyValue: (k) => vars.get(k) ?? '' },
    toggleAttribute: (n, on) => (on ? attrs.add(n) : attrs.delete(n)),
    hasAttribute: (n) => attrs.has(n),
  };
};
const PARTS = ['.fc-shield', '.fc-shield-n', '.fc-speed', '.fc-speed-n', '.fc-kills-n', '.fc-target', '.fc-target-name', '.fc-target-dist', '.fc-target-hp'];
const dom = () => {
  const parts = Object.fromEntries(PARTS.map((s) => [s, el()]));
  return { ...el(), querySelector: (s) => parts[s] ?? null };
};
const v = (o = {}) => ({ on: true, shield: 82, low: false, speed: 6, top: 12, boosting: false, kills: 3, lock: null, ...o });

describe('flight cluster', () => {
  it('writes the ship', () => {
    const root = dom();
    createCluster().place(root, v());
    expect(root.hasAttribute('data-on')).toBe(true);
    expect(root.querySelector('.fc-shield-n').textContent).toBe('82%');
    expect(root.querySelector('.fc-shield').style.getPropertyValue('--v')).toBe('0.82');
    expect(root.querySelector('.fc-speed').style.getPropertyValue('--v')).toBe('0.5');
    expect(root.querySelector('.fc-speed-n').textContent).toBe('SPD 60');
    expect(root.querySelector('.fc-kills-n').textContent).toBe('3');
  });
  it('flags low deflectors and the boost', () => {
    const root = dom();
    const c = createCluster();
    c.place(root, v({ shield: 20, low: true, boosting: true }));
    expect(root.querySelector('.fc-shield').hasAttribute('data-low')).toBe(true);
    expect(root.querySelector('.fc-speed').hasAttribute('data-boost')).toBe(true);
    c.place(root, v());
    expect(root.querySelector('.fc-shield').hasAttribute('data-low')).toBe(false);
    expect(root.querySelector('.fc-speed').hasAttribute('data-boost')).toBe(false);
  });
  it('writes the target, and clears it', () => {
    const root = dom();
    const c = createCluster();
    c.place(root, v({ lock: { name: 'TIE Interceptor', dist: '14', hp: 0.5 } }));
    expect(root.querySelector('.fc-target').hasAttribute('data-on')).toBe(true);
    expect(root.querySelector('.fc-target-name').textContent).toBe('TIE Interceptor');
    expect(root.querySelector('.fc-target-hp').hasAttribute('data-on')).toBe(true);
    c.place(root, v());
    expect(root.querySelector('.fc-target').hasAttribute('data-on')).toBe(false);
  });
  it('shows no hull bar for a one-hit fighter', () => {
    const root = dom();
    createCluster().place(root, v({ lock: { name: 'TIE Fighter', dist: '9', hp: null } }));
    expect(root.querySelector('.fc-target').hasAttribute('data-on')).toBe(true);
    expect(root.querySelector('.fc-target-hp').hasAttribute('data-on')).toBe(false);
  });
  it('hides when not flying, and writes nothing it already wrote', () => {
    const root = dom();
    const c = createCluster();
    c.place(root, v());
    const n = root.querySelector('.fc-shield-n');
    n.textContent = 'tampered';
    c.place(root, v());
    expect(n.textContent).toBe('tampered'); // (unchanged value: no write)
    c.place(root, v({ on: false }));
    expect(root.hasAttribute('data-on')).toBe(false);
  });
});
