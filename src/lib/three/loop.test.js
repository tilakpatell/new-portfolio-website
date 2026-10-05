import { describe, expect, it } from 'vitest';
import { createLoop } from './loop';

// a stand-in for requestAnimationFrame: frames run when tick() says
const frames = () => {
  let q = new Map();
  let n = 0;
  return {
    raf: (f) => (q.set(++n, f), n),
    caf: (id) => q.delete(id),
    pending: () => q.size,
    tick(now = 0) {
      const run = q;
      q = new Map();
      for (const f of run.values()) f(now);
    },
  };
};

describe('createLoop', () => {
  it('keeps one chain when a frame kicks while drawing (a held trigger)', () => {
    const f = frames();
    let draws = 0;
    const loop = createLoop(
      () => {
        draws++;
        loop.kick(); // a shot fired from inside the frame
        return true;
      },
      { raf: f.raf, caf: f.caf },
    );
    loop.kick();
    for (let i = 0; i < 20; i++) f.tick();
    expect(f.pending()).toBe(1);
    expect(draws).toBe(20);
  });

  it('a kick while drawing still gets a next frame when the step says stop', () => {
    const f = frames();
    let first = true;
    const loop = createLoop(
      () => {
        if (first) loop.kick();
        first = false;
        return false;
      },
      { raf: f.raf, caf: f.caf },
    );
    loop.kick();
    f.tick();
    expect(f.pending()).toBe(1);
    f.tick();
    expect(f.pending()).toBe(0);
  });

  it('stop cancels, and kicks are ignored while it may not draw', () => {
    const f = frames();
    let ok = true;
    const loop = createLoop(() => true, { raf: f.raf, caf: f.caf, can: () => ok });
    loop.kick();
    loop.stop();
    expect(f.pending()).toBe(0);
    ok = false;
    loop.kick();
    expect(f.pending()).toBe(0);
  });
});
