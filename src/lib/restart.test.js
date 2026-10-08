import { describe, expect, it } from 'vitest';
import { VISIT_KEYS, forgetVisit } from './restart';

// a stand-in for localStorage: the calls forgetVisit makes, over a Map
const storage = (entries) => {
  const m = new Map(Object.entries(entries));
  return {
    removeItem: (k) => m.delete(k),
    keys: () => [...m.keys()].sort(),
  };
};

describe('starting the site over', () => {
  it('forgets the intro, the front door choice, the cockpit, the ship, the tour and the pages shown', () => {
    const s = storage({ 'tp-intro': '1', 'tp-start': '"home"', 'tp-cockpit': '"xwing"', 'tp-universe-ship': '"cruiser"', 'tp-tour': '"done"', 'tp-visited-ever': '["/home"]' });
    forgetVisit(s);
    expect(s.keys()).toEqual([]);
    expect(VISIT_KEYS).toEqual(expect.arrayContaining(['tp-intro', 'tp-start', 'tp-cockpit', 'tp-universe-ship', 'tp-tour', 'tp-visited-ever']));
  });

  it('keeps what was unlocked and set', () => {
    const kept = {
      'tp-achievements': '["konami"]',
      'tp-eggs': '["reactor"]',
      'tp-mode': '"dark"',
      'tp-sound': 'true',
      'tp-theme-pin': '"jedi"',
      'tp-custom-color': '"#7c3aed"',
      'tp-hector-best': '9',
    };
    const s = storage({ ...kept, 'tp-intro': '1', 'tp-start': '"universe"' });
    forgetVisit(s);
    expect(s.keys()).toEqual(Object.keys(kept).sort());
  });

  it('carries on when storage is unavailable', () => {
    expect(() =>
      forgetVisit({
        removeItem() {
          throw new Error('denied');
        },
      }),
    ).not.toThrow();
    expect(() => forgetVisit(null)).not.toThrow();
  });
});
