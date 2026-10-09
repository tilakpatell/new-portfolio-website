// A press that lands (docs/superpowers/specs/2026-10-08-game-feel-design.md
// §1): a jump pressed a moment before landing still jumps when the feet
// touch (the buffer), and one pressed a moment after running off an edge
// still jumps (coyote time), as Roll out and Dot Matrix already do. Pure: the
// rules ask `take()` where they read the jump flag; the handler calls
// `press()` on the key’s edge and `ground(grounded, dt)` every step.
//
// The clock is the press’s own, moved only by the dt it is given, so a test
// (or a game in hitstop) runs it at any pace. A frame longer than a quarter
// second (a tab come back) forgets the press: it was made in another moment.
//
//   createPress({ buffer = 0.12, coyote = 0.1 }) → { press(), ground(onGround,
//     dt), take() → boolean, pending, reset(), set({ buffer, coyote }),
//     values() }
//   createCooldownPress({ buffer = 0.12 }) → { press(), ready(isReady, dt),
//     take() → boolean, pending, reset(), set({ buffer }), values() }: a dash
//     pressed during its cooldown waits `buffer` and fires as it ends
//   pressGroups(press) → the ?debug panel’s groups (lib/debugPanel)

const STALE = 0.25; // a frame longer than this forgets the press
const EPS = 1e-9; // so a press exactly `buffer` old still counts

function clock(numbers) {
  const o = { ...numbers };
  let t = 0;
  let pressed = -Infinity;
  let open = -Infinity; // when the ground (or the cooldown’s end) was last there
  return {
    o,
    press() {
      pressed = t;
    },
    tick(on, dt) {
      const d = Number.isFinite(dt) && dt > 0 ? dt : 0;
      if (d > STALE) pressed = -Infinity;
      t += d;
      if (on) open = t;
    },
    pending: () => t - pressed <= o.buffer + EPS,
    take(grace) {
      if (!(t - pressed <= o.buffer + EPS && t - open <= grace + EPS)) return false;
      // the press is spent, and so is the ground it used: one jump a press,
      // and none more from the coyote time once in the air
      pressed = -Infinity;
      open = -Infinity;
      return true;
    },
    reset() {
      t = 0;
      pressed = open = -Infinity;
    },
    set(next = {}) {
      for (const k of Object.keys(o)) if (Number.isFinite(next[k])) o[k] = next[k];
    },
  };
}

export function createPress({ buffer = 0.12, coyote = 0.1 } = {}) {
  const c = clock({ buffer, coyote });
  return {
    press: c.press,
    ground: (onGround, dt) => c.tick(onGround, dt),
    take: () => c.take(c.o.coyote),
    get pending() {
      return c.pending();
    },
    reset: c.reset,
    set: c.set,
    values: () => ({ ...c.o }),
  };
}

export function createCooldownPress({ buffer = 0.12 } = {}) {
  const c = clock({ buffer });
  return {
    press: c.press,
    ready: (isReady, dt) => c.tick(isReady, dt),
    // ready now, not a moment ago: a dash has no coyote time
    take: () => c.take(0),
    get pending() {
      return c.pending();
    },
    reset: c.reset,
    set: c.set,
    values: () => ({ ...c.o }),
  };
}

export function pressGroups(press) {
  const item = (key, label) => ({ key, label, type: 'range', min: 0, max: 0.3, step: 0.005, get: () => press.values()[key], set: (v) => press.set({ [key]: v }) });
  const items = [item('buffer', 'buffer (s)')];
  if ('coyote' in press.values()) items.push(item('coyote', 'coyote (s)'));
  return [{ name: 'press', items }];
}
