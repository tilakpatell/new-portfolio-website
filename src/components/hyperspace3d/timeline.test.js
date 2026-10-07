import { afterEach, describe, expect, it, vi } from 'vitest';
import { HOLD_AT, STALL, T, atPeak, clampStart, handJump, holdJump, holdStart, jumpHeld, jumpStarted, letHandedGo, onJumpStart, swirlOn } from './timeline';

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

describe("a jump's first frame", () => {
  it('is heard by whoever listens, until they stop', () => {
    const fn = vi.fn();
    const off = onJumpStart(fn);
    jumpStarted();
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    jumpStarted();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('reaches every listener, even one that stops listening as it hears it', () => {
    const a = vi.fn();
    const offB = onJumpStart(() => offB());
    const offA = onJumpStart(a);
    jumpStarted();
    expect(a).toHaveBeenCalledTimes(1);
    offA();
  });
});

describe("a jump's clock, starved of frames", () => {
  it('runs on with frames on the beat', () => {
    expect(clampStart(1000, 5000, 5016)).toBe(1000);
    expect(clampStart(1000, 5000, 5050)).toBe(1000);
  });

  // (it used to move on 50 ms at most for any frame later than that, so
  // below 20 frames a second every jump played in slow motion, and its
  // sound, on the wall's clock, came apart from its flash: deliberately
  // changed to the stalls alone)
  it('keeps the wall’s time at an ordinary low frame rate, so its sound stays on its flash', () => {
    expect(clampStart(1000, 5000, 5100)).toBe(1000); // (10 a second)
    expect(clampStart(1000, 5000, 5000 + STALL)).toBe(1000);
  });

  it('moves on 50 ms for a stall (a frame over 250 ms late, where the pace stops judging too), so the jump pauses instead of skipping its middle', () => {
    expect(STALL).toBe(250);
    const start = clampStart(1000, 5000, 7000); // (two seconds without a frame)
    expect(7000 - start - (5000 - 1000)).toBe(50);
    expect(clampStart(1000, 5000, 5251)).toBe(1201);
    expect(clampStart(1000, 5000, 5300, 100)).toBe(1200);
  });
});

describe("a jump's peak", () => {
  it('comes after its flash begins and before its tunnel ends, where a held jump waits', () => {
    expect(atPeak(T.jump + 19)).toBe(false);
    expect(atPeak(T.jump + 20)).toBe(true);
    expect(atPeak(HOLD_AT)).toBe(true);
    expect(atPeak(T.tunnel)).toBe(false); // (an intro skipped to its exit doesn't peak there)
  });

  it('is never stepped over by a clock that moves on whole frames up to a stall', () => {
    for (let t = 0; t < T.jump + 20; t += 7) {
      const next = t + STALL;
      if (next >= T.jump + 20) expect(atPeak(next)).toBe(true);
    }
  });
});

describe("a jump's tunnel swirl", () => {
  it('winds on through the tunnel, and only there', () => {
    expect(swirlOn(0, T.flash - 1, 0.1)).toBe(0);
    expect(swirlOn(0, T.flash, 0.1)).toBeCloseTo(0.09);
    expect(swirlOn(0.3, T.tunnel - 1, 0.1)).toBeCloseTo(0.39);
    expect(swirlOn(0.5, T.tunnel, 0.1)).toBe(0.5);
  });

  it('stops winding while the jump is held, so a held tunnel stops brightening, and goes on once let go', () => {
    const go = holdJump();
    expect(swirlOn(0.45, HOLD_AT, 0.1)).toBe(0.45);
    go();
    expect(swirlOn(0.45, HOLD_AT, 0.1)).toBeCloseTo(0.54);
  });
});
