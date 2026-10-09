import { describe, expect, it } from 'vitest';
import { pressLook } from './surfaceLook';

const fresh = () => ({ t: 5, ads: false, buttons: { fire: false, block: false }, fireQueued: false, pressAt: null, touchPress: false, blockAt: null });

describe('pressLook', () => {
  it('with a gun: left fires (queued, so a quick click still shoots), right holds the sights', () => {
    const s = fresh();
    pressLook(s, false, 0, true);
    pressLook(s, false, 0, false);
    expect(s.fireQueued).toBe(true);
    expect(s.buttons.fire).toBe(false);
    pressLook(s, false, 2, true);
    expect(s.ads).toBe(true);
    pressLook(s, false, 2, false);
    expect(s.ads).toBe(false);
  });

  it('with a saber: left notes the press for a stroke on release, right holds the block', () => {
    const s = fresh();
    pressLook(s, true, 0, true);
    expect(s.pressAt).toBe(5);
    expect(s.touchPress).toBe(true);
    expect(s.fireQueued).toBe(false);
    pressLook(s, true, 2, true);
    expect(s.buttons.block).toBe(true);
    expect(s.blockAt).toBe(5);
    expect(s.ads).toBe(false);
  });
});
