// Moria's games, as rules with no drawing, so they can be tested: dodging
// the Watcher's tentacles to the Doors, catching what falls down the well,
// keeping out of the troll's sight, and the flight down the stair and over
// the bridge. ./MoriaWorld.jsx steps them; ./scene.js draws them.

export function seeded(seed = 1) {
  let s = seed % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── The Watcher in the Water ──
// Tentacles rise out of the lake and slam down where you're running: each
// strike marks the ground (`warn` seconds), then falls. Under one when it
// falls and it has you; three times and it drags you off, and it starts
// again. Into the open Doors and you're through.
export const WATCHER = { first: 0.5, every: 0.85, warn: 0.95, r: 1.5, lead: 0.55, jitter: 1.2, hold: 0.55, grabs: 3, reach: 2.4 };

export function newDash(seed = 3) {
  return { t: 0, next: WATCHER.first, strikes: [], grabs: 0, state: 'on', rand: seeded(seed), held: 0 };
}

// One step. `hero` is { x, z, vx, vz }, `door` { x, z }. Events: { type:
// 'warn', strike } as one is marked, { type: 'slam', strike } as it falls,
// 'grabbed' when it falls on you, 'taken' at the last grab, 'in' through
// the Doors.
export function stepDash(d, dt, hero, door) {
  const ev = [];
  if (d.state !== 'on') return ev;
  d.t += dt;
  d.held = Math.max(0, d.held - dt);
  if (Math.hypot(hero.x - door.x, hero.z - door.z) < WATCHER.reach) {
    d.state = 'in';
    ev.push({ type: 'in' });
    return ev;
  }
  if (d.t >= d.next) {
    d.next = d.t + WATCHER.every;
    // where you'll be, near enough, when it falls
    const s = {
      x: hero.x + (hero.vx ?? 0) * WATCHER.warn * WATCHER.lead + (d.rand() - 0.5) * 2 * WATCHER.jitter,
      z: hero.z + (hero.vz ?? 0) * WATCHER.warn * WATCHER.lead + (d.rand() - 0.5) * 2 * WATCHER.jitter,
      r: WATCHER.r,
      t: 0,
      fallen: false,
    };
    d.strikes.push(s);
    ev.push({ type: 'warn', strike: s });
  }
  for (const s of d.strikes) {
    s.t += dt;
    if (!s.fallen && s.t >= WATCHER.warn) {
      s.fallen = true;
      ev.push({ type: 'slam', strike: s });
      if (d.held <= 0 && Math.hypot(hero.x - s.x, hero.z - s.z) < s.r) {
        d.grabs += 1;
        d.held = WATCHER.hold;
        ev.push({ type: 'grabbed', strike: s });
        if (d.grabs >= WATCHER.grabs) {
          d.state = 'taken';
          ev.push({ type: 'taken' });
          return ev;
        }
      }
    }
  }
  d.strikes = d.strikes.filter((s) => s.t < WATCHER.warn + 0.8);
  return ev;
}

// ── Fool of a Took! ──
// The dwarf on the well's edge comes apart: the skull, then the body, then
// the bucket on its chain. Catch each as it drops, in time; the bucket can't
// be caught.
export const TUMBLE = {
  items: [
    { id: 'skull', at: 0.6, fall: 1.0 },
    { id: 'body', at: 2.4, fall: 1.1 },
    { id: 'bucket', at: 4.2, fall: 1.6, slips: true },
  ],
  window: [0.35, 0.92],
};

export const newTumble = () => ({ t: 0, state: 'on', caught: [], gone: [], dropped: [], falling: null });

// how far the one falling has got, 0 to 1, or null
const fallen = (tm, item) => (tm.t - item.at) / item.fall;

// One step. Events: { type: 'drop', id } as one goes, { type: 'down', id }
// when one hits the bottom, 'done' when the last has.
export function stepTumble(tm, dt) {
  const ev = [];
  if (tm.state !== 'on') return ev;
  tm.t += dt;
  tm.falling = null;
  for (const it of TUMBLE.items) {
    if (tm.caught.includes(it.id) || tm.gone.includes(it.id)) continue;
    const k = fallen(tm, it);
    if (k < 0) continue;
    if (!tm.dropped.includes(it.id)) {
      tm.dropped.push(it.id);
      ev.push({ type: 'drop', id: it.id });
    }
    if (k >= 1) {
      tm.gone.push(it.id);
      ev.push({ type: 'down', id: it.id });
    } else tm.falling = it.id;
  }
  if (TUMBLE.items.every((it) => tm.caught.includes(it.id) || tm.gone.includes(it.id))) {
    tm.state = 'done';
    ev.push({ type: 'done' });
  }
  return ev;
}
// Reach for the one falling: 'caught', 'slipped' (the chain, through your
// fingers), 'early', 'late', or null if nothing's falling.
export function grab(tm) {
  const it = TUMBLE.items.find((x) => x.id === tm.falling);
  if (!it) return null;
  const k = fallen(tm, it);
  if (k < TUMBLE.window[0]) return 'early';
  if (k > TUMBLE.window[1]) return 'late';
  if (it.slips) return 'slipped';
  tm.caught.push(it.id);
  tm.falling = null;
  return 'caught';
}

// ── The cave troll ──
// It hunts round the chamber (../watchers.js does the seeing and the
// chasing): keep out of its sight till the end.
export const TROLL = { sight: 8.5, cone: 0.62, smell: 1.4, hear: 2.4, ringSight: 20, alert: 0.45, chase: 4.6, patrol: 1.7, giveUp: 3.5, leash: 30, catch: 1.5, look: 1.4, hold: 32 };

// ── The Bridge of Khazad-dûm ──
// The run down the stair and over the bridge, as distance along it (`s`)
// and how far across (`lat`). Stone falls from the roof where it's marked;
// the stair is broken where it's broken, and has to be leapt; the Balrog
// comes on behind.
export const FLY = { run: 5.6, stair: 4.8, steer: 3.2, wide: { stair: 1.1, bridge: 0.45 }, air: 0.8, rest: 0.25, slow: 2.2, slowFor: 0.8, behind: 12, balrog: 5.4, r: 0.9 };
export const STONES = [
  { s: 6, lat: -0.5 },
  { s: 11, lat: 0.6 },
  { s: 18, lat: -0.2 },
  { s: 33, lat: 0.5 },
  { s: 52, lat: 0 },
  { s: 66, lat: 0 },
];

export function newFlight() {
  return { t: 0, s: 0, lat: 0, air: 0, rest: 0, slowT: 0, behind: FLY.behind, state: 'on', hits: 0 };
}

// One step: `steer` -1..1, `jump` true to leap. `path` gives where the gap
// and the bridge are (./layout.js FLIGHT). Events: 'jump', { type: 'hit', s },
// 'fell', 'burnt', 'safe'.
export function stepFlight(f, dt, { steer = 0, jump = false } = {}, path) {
  const ev = [];
  if (f.state !== 'on') return ev;
  f.t += dt;
  f.air = Math.max(0, f.air - dt);
  f.rest = Math.max(0, f.rest - dt);
  f.slowT = Math.max(0, f.slowT - dt);
  if (jump && f.air <= 0 && f.rest <= 0) {
    f.air = FLY.air;
    f.rest = FLY.air + FLY.rest;
    ev.push({ type: 'jump' });
  }
  const onBridge = f.s >= path.bridge[0];
  const wide = onBridge ? FLY.wide.bridge : FLY.wide.stair;
  f.lat = Math.max(-wide, Math.min(wide, f.lat + Math.max(-1, Math.min(1, steer)) * FLY.steer * dt));
  const v = f.slowT > 0 ? FLY.slow : onBridge || f.s > path.stair[1] ? FLY.run : FLY.stair;
  const s0 = f.s;
  f.s += v * dt;
  for (const st of STONES) {
    if (st.s > s0 && st.s <= f.s && Math.abs(f.lat - st.lat) < FLY.r && f.air <= 0) {
      f.slowT = FLY.slowFor;
      f.hits += 1;
      ev.push({ type: 'hit', s: st.s });
    }
  }
  if (f.s > path.gap[0] && f.s < path.gap[1] && f.air <= 0) {
    f.state = 'fell';
    ev.push({ type: 'fell' });
    return ev;
  }
  // the Balrog, coming on behind
  f.behind += (v - FLY.balrog) * dt;
  if (f.behind <= 0) {
    f.state = 'burnt';
    ev.push({ type: 'burnt' });
    return ev;
  }
  if (f.s >= path.end) {
    f.state = 'safe';
    ev.push({ type: 'safe' });
  }
  return ev;
}
