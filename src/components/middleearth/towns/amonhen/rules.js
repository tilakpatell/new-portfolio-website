// Amon Hen's games, as rules with no drawing, so they can be tested: wood
// for the fire, getting away from Boromir with the Ring on, taking it off
// on the Seat before the Eye finds you, running past the Uruk-hai (the
// watching is ../watchers.js), and Sam in the water. ./AmonHenWorld.jsx
// steps them; ./scene.js draws them.

// ── Wood for the fire ──
export const newWood = (n) => ({ got: [], need: n });
export function pickStick(w, i) {
  if (w.got.includes(i) || i < 0 || i >= w.need) return null;
  w.got.push(i);
  return w.got.length >= w.need ? 'all' : 'got';
}

// ── None of us should wander alone ──
// With the Ring on, Boromir can't see you, but he hears you if you run
// near, and runs into you if you're close enough to touch (the watching
// is ../watchers.js with BOROMIR). Meanwhile the Ring pulls: faster when
// you run. Get to the stair before it's too much.
export const BOROMIR = { sight: 0, cone: 0, smell: 1.3, hear: 4.5, ringSight: 0, alert: 0.25, chase: 3.8, patrol: 2.4, giveUp: 2.6, leash: 16, catch: 1.25, look: 0.7 };
export const UNSEEN = { rise: 0.022, running: 1.8, reach: 2.6 };

export const newUnseen = () => ({ t: 0, pull: 0, state: 'on' });
// One step. `hero` { x, z, running }, `goal` { x, z }. Events: 'away' at
// the goal, 'found' if the Ring's pull gets too much.
export function stepUnseen(u, dt, hero, goal) {
  const ev = [];
  if (u.state !== 'on') return ev;
  u.t += dt;
  u.pull += UNSEEN.rise * (hero.running ? UNSEEN.running : 1) * dt;
  if (Math.hypot(hero.x - goal.x, hero.z - goal.z) < UNSEEN.reach) {
    u.state = 'away';
    ev.push({ type: 'away' });
  } else if (u.pull >= 1) {
    u.state = 'found';
    ev.push({ type: 'found' });
  }
  return ev;
}

// ── The Seat of Seeing ──
// The Eye's gaze sweeps across the land, and over you every `period`
// seconds, for `on` of them. Pull the Ring off: hold for `off` seconds,
// but while the gaze is on you the Ring won't come, and each pass that
// finds you still wearing it brings it closer. Three, and it has you.
export const SEAT_GAZE = { first: 1.6, period: 3, on: 0.8, off: 1.25, slip: 2, passes: 3 };

export const newSeat = () => ({ t: 0, pulling: 0, heat: 0, state: 'on', wasOn: false });
export const gazeOn = (st) => st.t >= SEAT_GAZE.first && (st.t - SEAT_GAZE.first) % SEAT_GAZE.period < SEAT_GAZE.on;
// how long till the gaze comes round again (0 while it's on you)
export const gazeIn = (st) => {
  if (st.t < SEAT_GAZE.first) return SEAT_GAZE.first - st.t;
  if (gazeOn(st)) return 0;
  return SEAT_GAZE.period - ((st.t - SEAT_GAZE.first) % SEAT_GAZE.period);
};
// One step; `hold` true while pulling at the Ring. Events: 'gaze' as it
// comes over you, 'burn' when it finds you still wearing it, 'off' when
// the Ring's off, 'seen' when it has you.
export function stepSeat(st, dt, hold) {
  const ev = [];
  if (st.state !== 'on') return ev;
  st.t += dt;
  const on = gazeOn(st);
  if (on && !st.wasOn) {
    ev.push({ type: 'gaze' });
    st.heat += 1;
    st.pulling = 0;
    ev.push({ type: 'burn' });
    if (st.heat >= SEAT_GAZE.passes) {
      st.state = 'seen';
      ev.push({ type: 'seen' });
      st.wasOn = on;
      return ev;
    }
  }
  st.wasOn = on;
  if (on) st.pulling = 0;
  else if (hold) st.pulling += dt;
  else st.pulling = Math.max(0, st.pulling - dt * SEAT_GAZE.slip);
  if (st.pulling >= SEAT_GAZE.off) {
    st.state = 'off';
    ev.push({ type: 'off' });
  }
  return ev;
}

// ── The Uruk-hai ──
export const URUKS = { sight: 11, cone: 0.68, smell: 1.4, hear: 3.6, ringSight: 0, alert: 0.4, chase: 4.7, patrol: 1.7, giveUp: 4, leash: 26, catch: 1.4, look: 1.2 };

// ── I made a promise ──
// Sam's in the water, going under and coming up. Paddle back to him (he's
// `gap` metres off and the boat drifts away), and reach for his hand while
// he's up. Reach while he's under and you miss him.
export const RESCUE = { gap: 7, drift: 0.55, paddle: 2.4, near: 1.6, up: 0.9, every: 2.3, first: 1.4 };

export const newRescue = () => ({ t: 0, gap: RESCUE.gap, state: 'on', misses: 0 });
export const samUp = (r) => r.t >= RESCUE.first && (r.t - RESCUE.first) % RESCUE.every < RESCUE.up;
// One step; `paddle` true while paddling back. Events: 'up' as he comes up,
// 'under' as he goes down.
export function stepRescue(r, dt, paddle) {
  const ev = [];
  if (r.state !== 'on') return ev;
  const was = samUp(r);
  r.t += dt;
  r.gap = Math.max(0.6, Math.min(RESCUE.gap + 3, r.gap + (RESCUE.drift - (paddle ? RESCUE.paddle : 0)) * dt));
  const now = samUp(r);
  if (now && !was) ev.push({ type: 'up' });
  if (!now && was) ev.push({ type: 'under' });
  return ev;
}
// Reach down for him: 'got', 'far' (too far off), 'under' (he's under).
export function reach(r) {
  if (r.state !== 'on') return null;
  if (r.gap > RESCUE.near) return 'far';
  if (!samUp(r)) {
    r.misses += 1;
    return 'under';
  }
  r.state = 'got';
  return 'got';
}
