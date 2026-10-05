import { describe, expect, it } from 'vitest';
import { DASH_START, FLIGHT, GATE } from './layout';
import { FLY, PLANK, STONES, TUMBLE, WATCHER, draught, grab, newDash, newFlight, newPlank, newTumble, stepDash, stepFlight, stepPlank, stepTumble } from './rules';

const DT = 1 / 30;
const door = { x: 0, z: GATE.cliff + 0.5 };

// a hobbit making for the Doors at a run; `dodge` sidesteps any strike
// marked ahead
function dash({ dodge = true, still = false, seed = 3 } = {}) {
  const d = newDash(seed);
  const h = { x: DASH_START.x, z: DASH_START.z, vx: 0, vz: 0 };
  const ev = [];
  let held = 0;
  while (d.state === 'on' && d.t < 30) {
    let dx = door.x - h.x;
    let dz = door.z - h.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    if (dodge) {
      const near = d.strikes.find((s) => !s.fallen && Math.hypot(s.x - h.x, s.z - h.z) < s.r + 1.2);
      if (near) {
        // step sideways, away from it
        const sx = -dz;
        const sz = dx;
        const side = (h.x - near.x) * sx + (h.z - near.z) * sz >= 0 ? 1 : -1;
        dx = sx * side * 0.9 + dx * 0.4;
        dz = sz * side * 0.9 + dz * 0.4;
      }
    }
    const v = still || held > 0 ? 0 : 6.2;
    h.vx = dx * v;
    h.vz = dz * v;
    h.x += h.vx * DT;
    h.z += h.vz * DT;
    held = Math.max(0, held - DT);
    for (const e of stepDash(d, DT, h, door)) {
      ev.push(e);
      if (e.type === 'grabbed') held = 0.6;
    }
  }
  return { d, ev };
}

describe('the Watcher in the Water', () => {
  it('takes a hobbit who stands still', () => {
    const { d, ev } = dash({ still: true });
    expect(d.state).toBe('taken');
    expect(ev.filter((e) => e.type === 'grabbed')).toHaveLength(WATCHER.grabs);
  });

  it('lets one through who runs for the Doors and sidesteps the strikes', () => {
    for (const seed of [1, 3, 7, 11]) {
      const { d } = dash({ seed });
      expect(d.state, `seed ${seed}`).toBe('in');
      expect(d.grabs, `seed ${seed}`).toBeLessThan(WATCHER.grabs);
    }
  });

  it('marks each strike before it falls, and only grabs where it falls', () => {
    const d = newDash(5);
    const h = { x: 0, z: 0, vx: 0, vz: 0 };
    const ev = [];
    for (let t = 0; t < WATCHER.first + 0.05; t += DT) ev.push(...stepDash(d, DT, h, { x: 50, z: 50 }));
    const warn = ev.find((e) => e.type === 'warn');
    expect(warn).toBeTruthy();
    // step well away before it falls
    h.x = 20;
    for (let t = 0; t < WATCHER.warn + 0.1; t += DT) ev.push(...stepDash(d, DT, h, { x: 50, z: 50 }));
    expect(ev.some((e) => e.type === 'slam')).toBe(true);
    expect(d.grabs).toBe(0);
  });
});

describe('the dwarf at the well', () => {
  const play = (when) => {
    const tm = newTumble();
    const got = [];
    const ev = [];
    while (tm.state === 'on' && tm.t < 20) {
      ev.push(...stepTumble(tm, DT));
      const it = TUMBLE.items.find((x) => x.id === tm.falling);
      if (it && when((tm.t - it.at) / it.fall)) {
        const r = grab(tm);
        if (r) got.push([it.id, r]);
      }
    }
    return { tm, got, ev };
  };

  it('can catch the skull and the body, but never the bucket', () => {
    const { tm, got } = play((k) => k > 0.6);
    expect(tm.caught).toEqual(['skull', 'body']);
    expect(tm.gone).toEqual(['bucket']);
    expect(got.find(([id]) => id === 'bucket')?.[1]).toBe('slipped');
    expect(tm.state).toBe('done');
  });

  it('lets everything fall for a hobbit who never reaches', () => {
    const { tm, ev } = play(() => false);
    expect(tm.caught).toEqual([]);
    expect(ev.filter((e) => e.type === 'down').map((e) => e.id)).toEqual(['skull', 'body', 'bucket']);
    expect(ev.at(-1).type).toBe('done');
  });

  it('is too early before it’s properly falling', () => {
    const tm = newTumble();
    while (!tm.falling) stepTumble(tm, DT);
    expect(grab(tm)).toBe('early');
    expect(tm.caught).toEqual([]);
  });

  it('starts fresh each time', () => {
    play(() => false);
    const { ev } = play(() => false);
    expect(ev.filter((e) => e.type === 'drop')).toHaveLength(3);
  });
});

// a runner who steers clear of the stones marked ahead and leaps the gap
function flee({ jumps = true, dodge = true } = {}) {
  const f = newFlight();
  const ev = [];
  while (f.state === 'on' && f.t < 60) {
    const ahead = STONES.find((st) => st.s > f.s && st.s < f.s + 4);
    const to = dodge && ahead ? (ahead.lat > 0 ? -1 : 1) * (f.s >= FLIGHT.bridge[0] ? 0.45 : 1.1) : 0;
    const jump = jumps && f.s > FLIGHT.gap[0] - 1.2 && f.s < FLIGHT.gap[0];
    ev.push(...stepFlight(f, DT, { steer: (to - f.lat) * 3, jump }, FLIGHT));
  }
  return { f, ev };
}

describe('the flight to the bridge', () => {
  it('falls at the broken stair if you don’t leap', () => {
    const { f } = flee({ jumps: false });
    expect(f.state).toBe('fell');
    expect(f.s).toBeGreaterThan(FLIGHT.gap[0]);
  });

  it('gets you over, leaping the gap and steering round the stone', () => {
    const { f, ev } = flee();
    expect(f.state).toBe('safe');
    expect(ev.some((e) => e.type === 'jump')).toBe(true);
    expect(f.behind).toBeGreaterThan(0);
  });

  it('lets the Balrog catch one who runs into every stone', () => {
    const f = newFlight();
    let ev = [];
    while (f.state === 'on' && f.t < 60) {
      const st = STONES.find((x) => x.s > f.s);
      const jump = f.s > FLIGHT.gap[0] - 1.2 && f.s < FLIGHT.gap[0];
      ev = stepFlight(f, DT, { steer: st ? (st.lat - f.lat) * 4 : 0, jump }, FLIGHT);
    }
    expect(f.hits).toBeGreaterThan(2);
    expect(f.state).toBe('burnt');
    expect(ev.at(-1).type).toBe('burnt');
  });

  it('keeps you on the stair, and narrower on the bridge', () => {
    const f = newFlight();
    for (let i = 0; i < 60; i++) stepFlight(f, DT, { steer: 1 }, FLIGHT);
    expect(f.lat).toBeCloseTo(FLY.wide.stair, 5);
    f.s = FLIGHT.bridge[0] + 1;
    stepFlight(f, DT, { steer: 1 }, FLIGHT);
    expect(f.lat).toBeCloseTo(FLY.wide.bridge, 5);
  });
});

describe('on the side: mind the well', () => {
  // out along the plank and back, leaning as `steer` says, for up to 30 s
  const cross = (steer, { seed = 5, walk = true } = {}) => {
    const pl = newPlank(seed);
    const seen = [];
    const types = [];
    for (let t = 0; t < 30 && pl.state === 'on'; t += DT) {
      seen.push({ lean: pl.lean, spin: pl.spin });
      types.push(...stepPlank(pl, DT, { walk, lean: steer(pl, seen) }).map((e) => e.type));
    }
    return { pl, types };
  };
  // a hobbit who leans against it, a moment after he feels it go
  const steady = (pl, seen) => {
    const p = seen[Math.max(0, seen.length - 1 - Math.round(0.25 / DT))];
    const v = p.lean + 0.3 * p.spin;
    return v > 0.1 ? -1 : v < -0.1 ? 1 : 0;
  };

  it('tips you over if you do nothing, even standing still', () => {
    for (const seed of [1, 5, 21]) {
      const { pl, types } = cross(() => 0, { seed, walk: false });
      expect(pl.state, `seed ${seed}`).toBe('fell');
      expect(types).toEqual(['wobble', 'fell']);
      expect(pl.t).toBeLessThan(12);
    }
  });

  it('gets the pipe and you back, for a hobbit who leans against it', () => {
    for (const seed of [1, 5, 21]) {
      const { pl, types } = cross(steady, { seed });
      expect(pl.state, `seed ${seed}`).toBe('won');
      expect(types.filter((x) => x !== 'wobble')).toEqual(['pipe', 'won']);
      expect(pl.t).toBeCloseTo((PLANK.half * 2) / PLANK.walk, 0);
    }
  });

  it('is over quickly if you lean the wrong way', () => {
    const { pl } = cross((p) => (p.lean > 0 ? 1 : -1));
    expect(pl.state).toBe('fell');
    expect(pl.t).toBeLessThan(2);
  });

  it('only gets you anywhere while you walk, and the draught is worst over the middle', () => {
    const pl = newPlank(5);
    for (let t = 0; t < 3; t += DT) stepPlank(pl, DT, { walk: false, lean: -Math.sign(pl.lean + 0.3 * pl.spin) });
    expect(pl.state).toBe('on');
    expect(pl.at).toBe(0);
    const out = cross(steady, { seed: 5 });
    expect(out.pl.back).toBe(true);
    // gusting harder out over the middle
    const p = newPlank(5);
    const edge = Math.max(...Array.from({ length: 200 }, (_, k) => Math.abs(draught(p, k * 0.1))));
    p.at = PLANK.half;
    const middle = Math.max(...Array.from({ length: 200 }, (_, k) => Math.abs(draught(p, k * 0.1))));
    expect(middle).toBeGreaterThan(edge * 1.5);
  });
});
