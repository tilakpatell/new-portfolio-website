import { afterEach, describe, expect, it, vi } from 'vitest';
import { HOLD_AT, T, holdJump, holdStart, jumpHeld, markJumpStart, overlayFrom } from './timeline';

describe('a jump held in its tunnel', () => {
  afterEach(() => vi.useRealTimers());

  it('is held while anyone holds it, and only then', () => {
    expect(jumpHeld()).toBe(false);
    const a = holdJump();
    const b = holdJump();
    expect(jumpHeld()).toBe(true);
    a();
    a(); // (letting go twice is letting go once)
    expect(jumpHeld()).toBe(true);
    b();
    expect(jumpHeld()).toBe(false);
  });

  it('lets go on its own if it is never let go, so the screen is never stuck', () => {
    vi.useFakeTimers();
    holdJump(5000);
    expect(jumpHeld()).toBe(true);
    vi.advanceTimersByTime(5001);
    expect(jumpHeld()).toBe(false);
  });

  it('holds the clock in the tunnel, after the flash, and lets it run on once let go', () => {
    expect(HOLD_AT).toBeGreaterThan(T.flash);
    expect(HOLD_AT).toBeLessThan(T.tunnel);
    // not held: the clock runs
    expect(holdStart(5000, 1000)).toBe(1000);
    const release = holdJump();
    // held: before the hold point, the clock runs; past it, it stays there
    expect(holdStart(1000 + HOLD_AT - 10, 1000)).toBe(1000);
    expect(5000 - holdStart(5000, 1000)).toBe(HOLD_AT);
    release();
    expect(holdStart(5000, 1000)).toBe(1000);
  });
});

describe('a scene keeping time with the jump on the page', () => {
  it('waits for the overlay to start drawing, takes its start, and gives up waiting after a while', () => {
    markJumpStart(null);
    expect(overlayFrom(1000, 1100)).toBe(null);
    markJumpStart(500); // (an earlier jump's: not this one's)
    expect(overlayFrom(1000, 1100)).toBe(null);
    markJumpStart(1240);
    expect(overlayFrom(1000, 1300)).toBe(1240);
    markJumpStart(null);
    expect(overlayFrom(1000, 1700)).toBe(1000);
  });
});
