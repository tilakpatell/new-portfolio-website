import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jumpHeld, jumpStarted, letHandedGo } from '../hyperspace3d/timeline';
import { JUMP_WAIT, jumpOut } from './jumpOut';

// a stand-in for App's Lightspeed: it takes the event's onPeak, as App does
const lightspeed = () => {
  const seen = { peak: null, style: null };
  const dispatch = (e) => {
    seen.style = e.detail.style;
    if (typeof e.detail.onPeak === 'function') {
      seen.peak = e.detail.onPeak;
      e.detail.taken = true;
    }
  };
  return { seen, dispatch };
};

describe('a page leaving through a jump', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    letHandedGo();
    vi.useRealTimers();
  });

  it('changes page at the jump’s flash, once', () => {
    const { seen, dispatch } = lightspeed();
    const navigate = vi.fn();
    jumpOut({ style: 'portal', to: '/somewhere', navigate, delay: 900, dispatch });
    expect(seen.style).toBe('portal');
    vi.advanceTimersByTime(1000);
    expect(navigate).not.toHaveBeenCalled(); // (taken: the jump says when, not the plan's delay)
    seen.peak();
    seen.peak();
    vi.advanceTimersByTime(JUMP_WAIT);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/somewhere');
  });

  it('takes the tunnel’s hold as the page changes, not at the click, so its limit runs from there', () => {
    const { seen, dispatch } = lightspeed();
    const navigate = vi.fn(() => expect(jumpHeld()).toBe(true)); // (held before the next page is up)
    jumpOut({ to: '/galaxy', navigate, hold: true, delay: 900, dispatch });
    expect(jumpHeld()).toBe(false);
    vi.advanceTimersByTime(3000); // (a jump slow to reach its flash)
    seen.peak();
    expect(navigate).toHaveBeenCalled();
    vi.advanceTimersByTime(7900);
    expect(jumpHeld()).toBe(true); // 8 s from the page change, not from the click
    vi.advanceTimersByTime(200);
    expect(jumpHeld()).toBe(false);
  });

  it('takes no hold for a place that won’t let one go', () => {
    const { seen, dispatch } = lightspeed();
    jumpOut({ to: '/marvel', navigate: () => {}, delay: 900, dispatch });
    seen.peak();
    expect(jumpHeld()).toBe(false);
  });

  it('times its fallback from the jump’s first frame, not the click, so a jump slow to start is dark before the page changes', () => {
    const { dispatch } = lightspeed();
    const navigate = vi.fn();
    jumpOut({ to: '/galaxy', navigate, hold: true, delay: 900, dispatch });
    vi.advanceTimersByTime(5000); // (the jump's first frame, five seconds late)
    jumpStarted();
    vi.advanceTimersByTime(JUMP_WAIT - 1);
    expect(navigate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(jumpHeld()).toBe(true); // (taken there: from the change)
    jumpStarted(); // (another jump later: nothing more)
    vi.advanceTimersByTime(JUMP_WAIT * 2);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('goes on the clock from the click when the jump never draws', () => {
    const { dispatch } = lightspeed();
    const navigate = vi.fn();
    jumpOut({ to: '/somewhere', navigate, delay: 900, dispatch });
    vi.advanceTimersByTime(JUMP_WAIT + 1);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('goes after the plan’s delay when no jump takes the event', () => {
    const navigate = vi.fn();
    jumpOut({ to: '/somewhere', navigate, delay: 900, dispatch: () => {} });
    vi.advanceTimersByTime(899);
    expect(navigate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('does nothing more once the page has gone before its own change: no page change, no hold', () => {
    const { seen, dispatch } = lightspeed();
    const navigate = vi.fn();
    const trip = jumpOut({ to: '/galaxy', navigate, hold: true, delay: 900, dispatch });
    trip.cancel();
    jumpStarted();
    seen.peak();
    vi.advanceTimersByTime(JUMP_WAIT * 2);
    expect(navigate).not.toHaveBeenCalled();
    expect(jumpHeld()).toBe(false);
  });

  it('keeps its hold when the page goes because of its own change', () => {
    const { seen, dispatch } = lightspeed();
    let trip = null;
    trip = jumpOut({ to: '/galaxy', navigate: () => trip.cancel(), hold: true, delay: 900, dispatch });
    seen.peak();
    expect(jumpHeld()).toBe(true); // (the galaxy's page lets it go)
  });
});
