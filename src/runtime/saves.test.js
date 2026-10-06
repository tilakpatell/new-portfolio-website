import { describe, expect, it, vi } from 'vitest';
import { createSaves } from './saves';

const store = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), map: m };
};
const broken = () => ({
  getItem() {
    throw new Error('no');
  },
  setItem() {
    throw new Error('no');
  },
  removeItem() {
    throw new Error('no');
  },
});
const fakeWin = () => {
  const on = new Map();
  return {
    addEventListener: (t, fn) => on.set(t, [...(on.get(t) ?? []), fn]),
    removeEventListener: (t, fn) => on.set(t, (on.get(t) ?? []).filter((f) => f !== fn)),
    fire: (t, e) => (on.get(t) ?? []).forEach((fn) => fn(e)),
  };
};

describe('createSaves', () => {
  it('reads JSON with a fallback and never throws', () => {
    const s = createSaves({ local: broken(), session: broken() });
    expect(s.get('tp-x', 1)).toBe(1);
    expect(s.session.get('tp-y', 'z')).toBe('z');
    expect(() => s.set('tp-x', 2)).not.toThrow();
    expect(() => s.remove('tp-x')).not.toThrow();
    expect(() => s.session.set('tp-y', 2)).not.toThrow();
  });

  it('round-trips a value in each store, and a bad value is the fallback', () => {
    const local = store();
    const session = store();
    const s = createSaves({ local, session });
    s.set('tp-a', { n: 1 });
    expect(s.get('tp-a')).toEqual({ n: 1 });
    expect(session.map.has('tp-a')).toBe(false);
    s.session.set('tp-b', [1, 2]);
    expect(s.session.get('tp-b')).toEqual([1, 2]);
    expect(local.map.has('tp-b')).toBe(false);
    local.setItem('tp-c', '{not json');
    expect(s.get('tp-c', 'fb')).toBe('fb');
    s.remove('tp-a');
    expect(s.get('tp-a')).toBe(null);
  });

  it('migrates a registered key once', () => {
    const local = store();
    local.setItem('tp-earth-stamps', JSON.stringify(['home']));
    const s = createSaves({ local, session: store() });
    const migrate = vi.fn((old) => ({ ids: old }));
    s.register({ key: 'tp-earth-stamps', version: 1, migrate });
    expect(s.get('tp-earth-stamps')).toEqual({ ids: ['home'] });
    expect(s.get('tp-earth-stamps')).toEqual({ ids: ['home'] });
    expect(migrate).toHaveBeenCalledTimes(1);
    expect(migrate).toHaveBeenCalledWith(['home'], 0);
    expect(JSON.parse(local.getItem('tp-earth-stamps'))).toEqual({ v: 1, data: { ids: ['home'] } });
    s.set('tp-earth-stamps', { ids: ['home', 'paris'] });
    expect(JSON.parse(local.getItem('tp-earth-stamps'))).toEqual({ v: 1, data: { ids: ['home', 'paris'] } });
    expect(s.get('tp-earth-stamps')).toEqual({ ids: ['home', 'paris'] });
    // a fresh key: no migration, the fallback
    s.register({ key: 'tp-new', version: 2, migrate });
    expect(s.get('tp-new', 'fb')).toBe('fb');
    expect(migrate).toHaveBeenCalledTimes(1);
  });

  it('watch fires on set and on another tab', () => {
    const win = fakeWin();
    const s = createSaves({ local: store(), session: store(), win });
    const fn = vi.fn();
    const off = s.watch('tp-k', fn);
    s.set('tp-k', 1);
    win.fire('storage', { key: 'tp-k', newValue: '2' });
    win.fire('storage', { key: 'tp-other', newValue: '3' });
    expect(fn.mock.calls.map((c) => c[0])).toEqual([1, 2]);
    off();
    s.set('tp-k', 4);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
