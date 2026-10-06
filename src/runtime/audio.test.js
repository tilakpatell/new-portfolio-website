import { describe, expect, it, vi } from 'vitest';
import { createAudioBus } from './audio';

const fakeContext = () => {
  const ctx = { currentTime: 3 };
  ctx.createGain = () => ({ gain: { setTargetAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() });
  return ctx;
};

describe('createAudioBus', () => {
  it('makes one gain per module into the master, and fades it out', () => {
    const ctx = fakeContext();
    const master = { m: true };
    const timers = [];
    const a = createAudioBus({ context: () => ctx, output: () => master, later: (fn, ms) => timers.push([fn, ms]) });
    const g = a.bus();
    expect(a.bus()).toBe(g);
    expect(g.connect).toHaveBeenCalledWith(master);
    a.fadeOut(150);
    expect(g.gain.setTargetAtTime).toHaveBeenCalledWith(0, 3, 150 / 1000 / 4);
    expect(timers[0][1]).toBe(200);
    timers[0][0]();
    expect(g.disconnect).toHaveBeenCalled();
    expect(a.bus()).not.toBe(g); // the next module gets its own
  });

  it('is quiet without Web Audio', () => {
    const a = createAudioBus({ context: () => null, output: () => null });
    expect(a.bus()).toBe(null);
    expect(() => a.fadeOut()).not.toThrow();
  });
});
