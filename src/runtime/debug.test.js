import { describe, expect, it, vi } from 'vitest';
import { createDebug } from './debug';

const fakePanel = () => {
  const made = [];
  const panel = (opts) => {
    const p = { opts, opened: [], closed: 0, open: (groups, o) => p.opened.push({ groups, ...o }), close: () => (p.closed += 1), dispose() {} };
    made.push(p);
    return p;
  };
  return { made, panel };
};
const GROUPS = [{ name: 'look', items: [{ key: 'k', type: 'range', get: () => 1, set() {} }] }];

describe('the tuning panel, from the runtime', () => {
  it('makes nothing without ?debug', () => {
    const { made, panel } = fakePanel();
    const d = createDebug({ on: false, panel });
    d.show('earth', GROUPS);
    d.hide();
    expect(made).toHaveLength(0);
    expect(d.on).toBe(false);
    expect(d.current).toBe(null);
  });

  it('opens nothing and logs nothing for a world with no tune()', () => {
    const { made, panel } = fakePanel();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const d = createDebug({ on: true, panel });
    d.show('earth', undefined);
    d.show('earth', []);
    d.show('earth', null);
    expect(made).toHaveLength(0);
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    log.mockRestore();
    warn.mockRestore();
  });

  it('opens one panel with the module’s id, and the same panel for the next world', () => {
    const { made, panel } = fakePanel();
    const d = createDebug({ on: true, panel });
    d.show('earth', GROUPS);
    expect(made).toHaveLength(1);
    expect(made[0].opened).toEqual([{ groups: GROUPS, title: 'earth', id: 'earth' }]);
    expect(d.current).toBe('earth');
    d.show('galaxy', GROUPS);
    expect(made).toHaveLength(1);
    expect(made[0].opened.map((o) => o.id)).toEqual(['earth', 'galaxy']);
    expect(d.current).toBe('galaxy');
  });

  it('closes it on hide, and a world with nothing to tune closes the last one’s', () => {
    const { made, panel } = fakePanel();
    const d = createDebug({ on: true, panel });
    d.show('earth', GROUPS);
    d.hide();
    expect(made[0].closed).toBe(1);
    expect(d.current).toBe(null);
    d.show('earth', GROUPS);
    d.show('music', undefined);
    expect(made[0].closed).toBe(2);
    expect(d.current).toBe(null);
  });
});

describe('whether it’s on', () => {
  it('is read afresh at each world when given as a function (the runtime outlives a route)', () => {
    const { made, panel } = fakePanel();
    let asked = false;
    const d = createDebug({ on: () => asked, panel });
    d.show('earth', GROUPS);
    expect(made).toHaveLength(0);
    asked = true;
    expect(d.on).toBe(true);
    d.show('earth', GROUPS);
    expect(made).toHaveLength(1);
  });

  it('is off in Node, where there is no address', () => {
    expect(createDebug().on).toBe(false);
  });
});
