// A meeting with a brain, flown frame by frame in Node: the harness the
// brains' scenario tests share (nemesis.test.js first had it). A seeded
// random, so a meeting is the same every time; you, flown by a script;
// every frame's events and the brain's state kept, as a `trace` two runs
// can be compared by.
//
//   meet({ brain, npc, at, seconds, ship, steer, world, seed, each, memory }) → seen
//   simulate(rules, script) → { frames, events }   for a world's rules.js
import { createBrains } from '../../npcRules';

export const DT = 1 / 60;

// a seeded random, so a meeting is the same every time
export const seeded = (seed = 7) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
export const apart = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const you = (over = {}) => ({ x: 0, y: 0, z: 0, heading: 0, pitch: 0, speed: 0, ...over });
export const fly = (s) => ({ ...s, x: s.x - Math.sin(s.heading) * s.speed * DT, z: s.z - Math.cos(s.heading) * s.speed * DT });

// a character with the brain named, flying a ship of the stats a brain of its kind has in the cast
export const foe = (brain = 'nemesis', over = {}) => ({
  id: `test-${brain}`,
  side: 'starwars',
  role: brain === 'nemesis' || brain === 'rival' ? 'enemy' : 'neutral',
  ship: 'tieadvanced',
  brain,
  faction: 'empire',
  relations: { fears: [], hunts: [] },
  stats: { speed: 26, accel: 22, turn: 3.0, hp: 20, fire: [0.45, 0.8], damage: 8 },
  ...over,
});

// a meeting flown for `seconds`: steer(ship, t) flies you; world(t, ship) gives what's about; each(me, ship, out, t) looks at every frame
export function meet({ brain = 'nemesis', npc = foe(brain), at = { x: 0, y: 0, z: -30 }, seconds = 30, ship = you(), steer = (s) => s, world = () => ({}), seed = 5, each, memory = {} } = {}) {
  const brains = createBrains({ rand: seeded(seed), memory });
  const n = brains.add(npc, at);
  const me = brains.live[0];
  let s = ship;
  const seen = { says: [], events: [], shots: [], n, me, brains, modes: new Set(), trace: [], frames: 0 };
  for (let t = 0; t < seconds; t += DT) {
    s = fly(steer(s, t));
    const out = brains.update(DT, { you: s, hunters: [], stations: [], ...world(t, s) });
    for (const e of out.events) {
      seen.events.push({ ...e, t });
      if (e.type === 'say') seen.says.push(e.key);
      if (e.type === 'shot') seen.shots.push({ ...e, t });
    }
    const live = brains.live[0];
    if (live) seen.modes.add(live.mind.mode);
    // what two runs of the same meeting must agree on, to the last bit
    seen.trace.push(live ? [live.pos.x, live.pos.y, live.pos.z, live.vel.x, live.vel.y, live.vel.z, live.mind.mode ?? null, out.events.length] : null);
    seen.frames += 1;
    each?.(live, s, out, t);
  }
  seen.ship = s;
  return seen;
}

// you, turned to keep your nose on it and flying after it: on its tail
export const chase = (me, s, speed) => {
  if (!me) return s;
  const dx = me.pos.x - s.x;
  const dz = me.pos.z - s.z;
  return { ...s, heading: Math.atan2(-dx, -dz), speed };
};

// A world's rules (a pure rules.js) run frame by frame: `rules.step(state,
// input, dt)` returns that frame's events (or nothing); `script.input(t,
// state)` is what the player does; `script.each` looks at every frame.
export function simulate(rules, { state = rules.create?.() ?? {}, seconds = 10, dt = DT, input = () => ({}), each } = {}) {
  const events = [];
  // counted in frames, so a summed dt's rounding never adds one
  const frames = Math.round(seconds / dt);
  for (let f = 0; f < frames; f++) {
    const t = f * dt;
    for (const e of rules.step(state, input(t, state), dt) ?? []) events.push({ ...e, t });
    each?.(state, t);
  }
  return { state, events, frames };
}
