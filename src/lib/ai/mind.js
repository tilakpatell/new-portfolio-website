// The mind: a combat state machine whose states are a table, so a world
// adds one by adding a row. Interrupts (`on`: struck, dead, lost, found,
// or a world's own) are looked at before the active state ticks; a row's
// `on` decides where its own event goes, else the defaults below. A state
// ticks only when its timer is due (`rate` a second, each mind on its own
// phase so a crowd never thinks on one frame); between ticks the last
// intent is held. A tick answers an intent, or `{ to }` to change state,
// which runs the old state's `exit`, the new one's `enter`, and ticks it
// at once. The intent is the one thing a brain outputs; the body
// (lib/physics/character.js) reads nothing else. Pure.
//
//   STATES: { [name]: { enter?(bb, w), tick(bb, w, dt) → intent | { to, intent? }, exit?(bb, w),
//     on?: { [event]: (bb, ctx, w) → nextState | null } } }
//   IDLE: { vel: { x: 0, z: 0 }, face: null, jump: 0, act: null, clip: null, mode: 'hold' }
//   createMind(STATES, { start = 'patrol', seed = 1, rate = 10, phase = null }) → m
//     m: { state, intent, bb (the blackboard: clock, rand, and the world's own keys), timer, events,
//          on(event, ctx) }
//   mindStep(m, w, dt) → intent
//   Defaults: struck → stunned (bb.stun = ctx.stun) from any state but dead; dead → dead;
//   lost → search from chase or attack; found → chase from patrol, search or suspicious.

import { seeded } from '../seeded';

export const IDLE = Object.freeze({ vel: Object.freeze({ x: 0, z: 0 }), face: null, jump: 0, act: null, clip: null, mode: 'hold' });
const HOPS = 4; // transitions a step at most (a loop of { to } is cut here)

const DEFAULT_ON = {
  struck: (bb, ctx, state) => {
    if (state === 'dead') return null;
    bb.stun = ctx?.stun ?? 0.3;
    bb.hitKind = ctx?.kind ?? 'light';
    return 'stunned';
  },
  dead: () => 'dead',
  lost: (bb, ctx, state) => (state === 'chase' || state === 'attack' ? 'search' : null),
  found: (bb, ctx, state) => (state === 'patrol' || state === 'search' || state === 'suspicious' ? 'chase' : null),
};

export function createMind(states, { start = 'patrol', seed = 1, rate = 10, phase = null } = {}) {
  const rand = seeded(seed);
  const every = 1 / rate;
  return {
    states,
    state: start,
    intent: IDLE,
    bb: { clock: 0, rand },
    timer: phase ?? rand() * every,
    every,
    entered: false, // (the start state's enter runs on the first step, which has the world)
    events: [],
    on(event, ctx = null) {
      this.events.push([event, ctx]);
    },
  };
}

function go(m, to, w) {
  if (!to || to === m.state || !m.states[to]) return false;
  m.states[m.state]?.exit?.(m.bb, w);
  m.state = to;
  m.states[to].enter?.(m.bb, w);
  return true;
}

function tick(m, w, dt) {
  for (let hop = 0; hop < HOPS; hop++) {
    const row = m.states[m.state];
    const out = row?.tick ? row.tick(m.bb, w, dt) : IDLE;
    if (out && typeof out === 'object' && 'to' in out) {
      if (!go(m, out.to, w)) {
        m.intent = out.intent ?? IDLE;
        return;
      }
      if (out.intent) m.intent = out.intent;
      continue;
    }
    m.intent = out ?? IDLE;
    return;
  }
}

export function mindStep(m, w, dt) {
  m.bb.clock += dt;
  let forced = false;
  if (!m.entered) {
    m.entered = true;
    m.states[m.state]?.enter?.(m.bb, w);
  }
  if (m.events.length) {
    const pending = m.events;
    m.events = [];
    for (const [event, ctx] of pending) {
      const own = m.states[m.state]?.on?.[event];
      const next = own ? own(m.bb, ctx, w) : DEFAULT_ON[event]?.(m.bb, ctx, m.state);
      if (go(m, next, w)) forced = true;
    }
  }
  m.timer -= dt;
  if (forced || m.timer <= 0) {
    tick(m, w, dt);
    if (m.timer <= 0) m.timer += m.every;
    if (m.timer <= 0) m.timer = m.every; // (a long pause: one tick, not a burst)
  }
  return m.intent;
}
