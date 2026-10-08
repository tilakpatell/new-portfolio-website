import { describe, expect, it, vi } from 'vitest';
import { driveWarmUp } from './useScene';

// a frame that comes at once, counting how many were asked for
const frames = () => {
  const f = vi.fn(() => Promise.resolve());
  return f;
};

describe('driving a scene’s warm-up a slice a frame', () => {
  it('calls warmUp once a frame until it says it’s done', async () => {
    let n = 0;
    const warmUp = vi.fn(() => ++n >= 3);
    const frame = frames();
    await expect(driveWarmUp(warmUp, { frame })).resolves.toBe(true);
    expect(warmUp).toHaveBeenCalledTimes(3);
    expect(frame).toHaveBeenCalledTimes(2);
  });

  it('gives each slice about `budget` ms (10 by default)', async () => {
    const seen = [];
    await driveWarmUp((timeLeft) => seen.push(timeLeft()) > 0, { frame: frames() });
    expect(seen[0]).toBeGreaterThan(9);
    expect(seen[0]).toBeLessThanOrEqual(10);
    const more = [];
    await driveWarmUp((timeLeft) => more.push(timeLeft()) > 0, { frame: frames(), budget: 4 });
    expect(more[0]).toBeLessThanOrEqual(4);
  });

  it('counts anything but false as done (a warmUp that returns nothing ran once)', async () => {
    const warmUp = vi.fn(() => undefined);
    await expect(driveWarmUp(warmUp, { frame: frames() })).resolves.toBe(true);
    expect(warmUp).toHaveBeenCalledTimes(1);
  });

  it('stops at the next slice once the scene is gone', async () => {
    let live = true;
    const warmUp = vi.fn(() => {
      live = false;
      return false;
    });
    await expect(driveWarmUp(warmUp, { frame: frames(), alive: () => live })).resolves.toBe(false);
    expect(warmUp).toHaveBeenCalledTimes(1);
  });

  it('never throws: a warm-up that throws is over, and the scene carries on', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const warmUp = vi.fn(() => {
      throw new Error('boom');
    });
    await expect(driveWarmUp(warmUp, { frame: frames() })).resolves.toBe(true);
    expect(warmUp).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('gives up after `cap` ms of slices, so a warm-up that never finishes can’t hold the scene back', async () => {
    let t = 0;
    const now = vi.spyOn(performance, 'now').mockImplementation(() => t);
    const warmUp = vi.fn(() => {
      t += 10;
      return false;
    });
    await expect(driveWarmUp(warmUp, { frame: frames(), cap: 100 })).resolves.toBe(false);
    expect(warmUp.mock.calls.length).toBeLessThanOrEqual(11);
    now.mockRestore();
  });
});
