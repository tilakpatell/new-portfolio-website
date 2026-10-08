import { describe, expect, it, vi } from 'vitest';
import { createLook, defaultMode, RELOCK, SPIKE, TP_LOOK, PROMPT } from './look';

// a stand-in for window, the document or the canvas: listeners by type,
// fire(type, event) hands the event to each
function fakeTarget(extra = {}) {
  const on = new Map();
  return {
    addEventListener: (type, fn) => on.set(type, [...(on.get(type) ?? []), fn]),
    removeEventListener: (type, fn) => on.set(type, (on.get(type) ?? []).filter((f) => f !== fn)),
    fire: (type, e = {}) => (on.get(type) ?? []).forEach((fn) => fn(e)),
    count: () => [...on.values()].reduce((n, fns) => n + fns.length, 0),
    ...extra,
  };
}

function world({ refuse = null, mode = 'lock', active } = {}) {
  const doc = fakeTarget({ pointerLockElement: null, exitPointerLock: vi.fn() });
  const calls = [];
  const host = fakeTarget({
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    setPointerCapture: () => {},
    // (a promise, as Chromium and Firefox now give; `refuse` rejects it)
    requestPointerLock: vi.fn((opts) => {
      calls.push(opts);
      const why = typeof refuse === 'function' ? refuse(opts) : refuse;
      if (why) return Promise.reject(Object.assign(new Error(why), { name: why }));
      return Promise.resolve();
    }),
  });
  const store = new Map();
  const win = fakeTarget({ document: doc, localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) } });
  let t = 100;
  const turns = [];
  const buttons = [];
  const locks = [];
  const look = createLook({
    host,
    win,
    mode,
    active,
    now: () => t,
    onTurn: (dx, dy) => turns.push([dx, dy]),
    onButton: (which, down) => buttons.push([which, down]),
    onLock: (on) => locks.push(on),
  });
  look.attach();
  const lock = () => {
    doc.pointerLockElement = host;
    doc.fire('pointerlockchange');
  };
  const unlock = () => {
    doc.pointerLockElement = null;
    doc.fire('pointerlockchange');
  };
  return { look, host, doc, win, calls, turns, buttons, locks, store, lock, unlock, tick: (s) => (t += s) };
}

const mouse = (extra = {}) => ({ pointerType: 'mouse', pointerId: 1, button: 0, clientX: 0, clientY: 0, movementX: 0, movementY: 0, preventDefault: () => {}, ...extra });
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('createLook', () => {
  it('a click in lock mode asks for pointer lock with unadjusted movement, then plainly when that is refused', async () => {
    const w = world({ refuse: (opts) => (opts ? 'NotSupportedError' : null) });
    w.host.fire('pointerdown', mouse());
    await flush();
    expect(w.calls).toEqual([{ unadjustedMovement: true }, undefined]);
  });

  it('the first pointermove after locking is dropped; the next turns by movement × sensitivity', () => {
    const w = world();
    w.lock();
    expect(w.look.locked).toBe(true);
    expect(w.locks).toEqual([true]);
    w.win.fire('pointermove', mouse({ movementX: 30, movementY: -10 }));
    expect(w.turns).toEqual([]);
    w.win.fire('pointermove', mouse({ movementX: 10, movementY: -10 }));
    expect(w.turns[0][0]).toBeCloseTo(10 * 0.0022);
    expect(w.turns[0][1]).toBeCloseTo(-10 * 0.0018);
  });

  it('a movement of 400 px is clamped to 60', () => {
    const w = world();
    w.lock();
    w.win.fire('pointermove', mouse());
    w.win.fire('pointermove', mouse({ movementX: 400, movementY: -400 }));
    expect(SPIKE).toBe(60);
    expect(w.turns[0][0]).toBeCloseTo(60 * 0.0022);
    expect(w.turns[0][1]).toBeCloseTo(-60 * 0.0018);
  });

  it('a refused lock (the promise rejects) leaves mode "lock", locked false, prompt shown, and drag still turns', async () => {
    const w = world({ refuse: 'SecurityError' });
    w.host.fire('pointerdown', mouse({ clientX: 100, clientY: 100 }));
    await flush();
    expect(w.look.mode).toBe('lock');
    expect(w.look.locked).toBe(false);
    expect(w.look.prompt).toBe(PROMPT);
    w.win.fire('pointermove', mouse({ clientX: 120, clientY: 100 }));
    expect(w.turns.length).toBe(1);
    expect(w.turns[0][0]).toBeGreaterThan(0);
  });

  it('after a refusal a click that stays put is the left button, so the mouse can still fire', async () => {
    const w = world({ refuse: 'SecurityError' });
    w.host.fire('pointerdown', mouse({ clientX: 100, clientY: 100 }));
    await flush();
    w.win.fire('pointerup', mouse({ clientX: 100, clientY: 100 }));
    w.host.fire('pointerdown', mouse({ clientX: 100, clientY: 100 }));
    await flush();
    w.win.fire('pointerup', mouse({ clientX: 100, clientY: 100 }));
    expect(w.buttons).toEqual([
      [0, true],
      [0, false],
      [0, true],
      [0, false],
    ]);
  });

  it('a lock that throws at once (an old browser, an iframe) is caught too', async () => {
    const w = world();
    w.host.requestPointerLock = () => {
      throw new Error('no');
    };
    expect(() => w.host.fire('pointerdown', mouse())).not.toThrow();
    await flush();
    expect(w.look.locked).toBe(false);
  });

  it('Esc (pointerlockchange to null) calls onLock(false) and shows the prompt again; a click within 1.25 s does not re-request', async () => {
    const w = world();
    w.lock();
    expect(w.look.prompt).toBe(null);
    w.unlock();
    expect(w.locks).toEqual([true, false]);
    expect(w.look.prompt).toBe(PROMPT);
    w.tick(RELOCK / 2);
    w.host.fire('pointerdown', mouse());
    await flush();
    expect(w.calls.length).toBe(0);
    w.tick(RELOCK);
    w.host.fire('pointerdown', mouse());
    await flush();
    expect(w.calls.length).toBe(1);
  });

  it('buttons while locked report onButton(0 | 2, down)', () => {
    const w = world();
    w.lock();
    w.host.fire('pointerdown', mouse({ button: 0 }));
    w.win.fire('pointerup', mouse({ button: 0 }));
    w.host.fire('pointerdown', mouse({ button: 2 }));
    w.win.fire('pointerup', mouse({ button: 2 }));
    w.host.fire('pointerdown', mouse({ button: 1 }));
    expect(w.buttons).toEqual([
      [0, true],
      [0, false],
      [2, true],
      [2, false],
    ]);
    expect(w.calls.length).toBe(0);
  });

  it("drag mode turns by the pointer's drag from down to move", () => {
    const w = world({ mode: 'drag' });
    w.host.fire('pointerdown', mouse({ clientX: 100, clientY: 100 }));
    w.win.fire('pointermove', mouse({ clientX: 110, clientY: 95 }));
    w.win.fire('pointermove', mouse({ clientX: 130, clientY: 95 }));
    w.win.fire('pointerup', mouse({ clientX: 130, clientY: 95 }));
    w.win.fire('pointermove', mouse({ clientX: 200, clientY: 95 }));
    expect(w.calls.length).toBe(0);
    expect(w.turns.length).toBe(2);
    expect(w.turns[0][0]).toBeGreaterThan(0);
    expect(w.turns[0][1]).toBeLessThan(0);
    expect(w.turns[1][0]).toBeCloseTo(w.turns[0][0] * 2);
    expect(w.look.prompt).toBe(null);
  });

  it('drag mode: a click that does not move is the left button; the right is reported as it goes', () => {
    const w = world({ mode: 'drag' });
    w.host.fire('pointerdown', mouse({ clientX: 100, clientY: 100 }));
    w.win.fire('pointerup', mouse({ clientX: 101, clientY: 100 }));
    w.host.fire('pointerdown', mouse({ clientX: 100, clientY: 100 }));
    w.win.fire('pointermove', mouse({ clientX: 160, clientY: 100 }));
    w.win.fire('pointerup', mouse({ clientX: 160, clientY: 100 }));
    w.host.fire('pointerdown', mouse({ button: 2 }));
    w.win.fire('pointerup', mouse({ button: 2 }));
    expect(w.buttons).toEqual([
      [0, true],
      [0, false],
      [2, true],
      [2, false],
    ]);
  });

  it('touch mode never requests a lock and never turns', async () => {
    const w = world({ mode: 'touch' });
    w.host.fire('pointerdown', mouse({ clientX: 0 }));
    w.win.fire('pointermove', mouse({ clientX: 50, movementX: 50 }));
    await flush();
    expect(w.calls.length).toBe(0);
    expect(w.turns.length).toBe(0);
    expect(w.look.prompt).toBe(null);
  });

  it('a touch pointer is left to the world in every mode', async () => {
    const w = world();
    w.host.fire('pointerdown', mouse({ pointerType: 'touch' }));
    await flush();
    expect(w.calls.length).toBe(0);
  });

  it('set(mode) is kept under tp-look and leaving lock releases it', () => {
    const w = world();
    w.lock();
    w.look.set('drag');
    expect(w.store.get(TP_LOOK)).toBe('drag');
    expect(w.look.mode).toBe('drag');
    expect(w.doc.exitPointerLock).toHaveBeenCalled();
  });

  it('while not active (the map, not the walk) nothing is asked, and a lock is let go', async () => {
    let on = false;
    const w = world({ active: () => on });
    w.host.fire('pointerdown', mouse());
    await flush();
    expect(w.calls.length).toBe(0);
    expect(w.look.prompt).toBe(null);
    on = true;
    w.lock();
    on = false;
    w.win.fire('pointermove', mouse({ movementX: 10 }));
    expect(w.doc.exitPointerLock).toHaveBeenCalled();
    expect(w.turns.length).toBe(0);
  });

  it('says when the browser refused the lock', async () => {
    const w = world({ refuse: 'SecurityError' });
    expect(w.look.refused).toBe(false);
    w.host.fire('pointerdown', mouse());
    await flush();
    expect(w.look.refused).toBe(true);
  });

  it('detach takes every listener off', () => {
    const w = world();
    w.look.detach();
    expect(w.host.count() + w.win.count() + w.doc.count()).toBe(0);
  });
});

describe('defaultMode', () => {
  it('coarse → touch, Safari with no mouse → drag, else lock; a kept choice wins off touch', () => {
    expect(defaultMode({ coarse: true })).toBe('touch');
    expect(defaultMode({ coarse: true, kept: 'lock' })).toBe('touch');
    expect(defaultMode({ safariNoMouse: true })).toBe('drag');
    expect(defaultMode({})).toBe('lock');
    expect(defaultMode({ kept: 'drag' })).toBe('drag');
    expect(defaultMode({ safariNoMouse: true, kept: 'lock' })).toBe('lock');
    expect(defaultMode({ kept: 'nonsense' })).toBe('lock');
  });
});
