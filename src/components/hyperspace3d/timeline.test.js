import { afterEach, describe, expect, it, vi } from 'vitest';
import { HOLD_AT, T, clampStart, handJump, holdJump, holdStart, jumpHeld, letHandedGo } from './timeline';

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

describe('a jump held from one page to the next', () => {
  afterEach(() => {
    letHandedGo();
    vi.useRealTimers();
  });

  it('holds the tunnel until the page it was handed to lets it go', () => {
    handJump();
    expect(jumpHeld()).toBe(true);
    expect(5000 - holdStart(5000, 1000)).toBe(HOLD_AT);
    letHandedGo();
    expect(jumpHeld()).toBe(false);
    expect(holdStart(5000, 1000)).toBe(1000);
    letHandedGo(); // (again, or with none held: harmless)
    expect(jumpHeld()).toBe(false);
  });

  it('a second takes the place of the first, and leaves the jumps the galaxy holds alone', () => {
    const own = holdJump();
    handJump();
    handJump();
    letHandedGo();
    expect(jumpHeld()).toBe(true); // (the galaxy's own hold, still on)
    own();
    expect(jumpHeld()).toBe(false);
  });

  it('lets go on its own if no page ever does', () => {
    vi.useFakeTimers();
    handJump(8000);
    vi.advanceTimersByTime(7999);
    expect(jumpHeld()).toBe(true);
    vi.advanceTimersByTime(2);
    expect(jumpHeld()).toBe(false);
  });
});

describe("a jump's clock, starved of frames", () => {
  it('runs on with frames on the beat', () => {
    expect(clampStart(1000, 5000, 5016)).toBe(1000);
    expect(clampStart(1000, 5000, 5050)).toBe(1000);
  });

  it('moves on at most 50 ms for a frame that came late, so a stall pauses the jump instead of skipping it', () => {
    const start = clampStart(1000, 5000, 7000); // (two seconds without a frame)
    expect(7000 - start - (5000 - 1000)).toBe(50);
    expect(clampStart(1000, 5000, 5300, 100)).toBe(1200);
  });
});
