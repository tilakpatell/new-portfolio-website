// What the C-137 world's people show of what they're doing, kept apart from
// the drawing so it's tested in Node: how long a line takes to say (the
// time a talker gestures for), the head sweeping across a searcher's cone,
// a nervous glance about now and then for Morty standing still, the motion a
// brain's step gives its figure's feet (lib/ai/body.js's, with a jump across
// the room taken for someone put there, not a step), and whether a word to
// someone is a new one. Pure: no three.js.
//
//   lineHold(text) → the seconds a line takes to say: 1.6 to 6
//   scanAt({ x, z, yaw }, t, { span = 0.9, period = 3.2, dist = 4, phase = 0 })
//     → { x, z }: where a searcher's head is turned at t, swept `span`
//     radians either side of its facing over `period` seconds, `dist` ahead
//     (yaw: 0 along +z, toward +x, as a figure's group turns; phase: 0…1, so
//     two searchers don't sweep together)
//   createGlance({ seed, every = [6, 14], hold = [1, 1.8], span = [0.5, 0.95] })
//     → { step(dt, still) → radians | null }: stood still `every` seconds, a
//     look off to one side (+ his left) for `hold` seconds, then ahead again;
//     moving, never, and a move starts the wait again. The seed's own times.
//   stepMotion(prev, next, dt, { scale = 1, jump = 2 }) → { speed, side, turn }
//     from two steps ({ x, z, yaw }) a frame apart: speed along its facing,
//     side across it (+ right), turn (+ left), in its figure's own units
//     (the world's over `scale`, its group's); none for a jump further than
//     `jump` metres (someone put back where they started)
//   heard(talk, id, seen) → whether Morty's word `talk` ({ id, n }) is to `id`
//     and new since the one numbered `seen`
//   attend(c, b, id, t, state, { y = 0, near = 3 }) → where its head's turned
//     ({ x, y, z } or null): one who stands or sits about (a room's people, a
//     place's, the street's), its head on Morty while he's within `near` or
//     while his word to it plays, and its hands going for that word (react's
//     `say`, on its upper half if it's sat). c: a figure, its calls optional
//     (one in shapes has none); b: its own { talkN, until, looking }, kept
//     between frames; y: the floor it stands on (Morty's eyes are over it)

import { bodyFrom } from '../../../lib/ai/body';
import { seeded } from '../../../lib/seeded';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function lineHold(text) {
  const n = typeof text === 'string' ? text.length : 0;
  return clamp(0.8 + n * 0.055, 1.6, 6);
}

export function scanAt(at, t, { span = 0.9, period = 3.2, dist = 4, phase = 0 } = {}) {
  const yaw = (at.yaw ?? 0) + span * Math.sin(2 * Math.PI * (t / period + phase));
  return { x: at.x + Math.sin(yaw) * dist, z: at.z + Math.cos(yaw) * dist };
}

export function createGlance({ seed = 1, every = [6, 14], hold = [1, 1.8], span = [0.5, 0.95] } = {}) {
  const rand = seeded(seed);
  const pick = ([lo, hi]) => lo + rand() * (hi - lo);
  let wait = null; // seconds till the next, while he stands
  let left = 0; // seconds left of this one
  let angle = 0;
  return {
    step(dt, still) {
      if (!still) {
        wait = null;
        left = 0;
        return null;
      }
      if (left > 0) {
        left -= dt;
        if (left > 0) return angle;
        wait = pick(every);
        return null;
      }
      wait ??= pick(every);
      wait -= dt;
      if (wait > 0) return null;
      angle = (rand() < 0.5 ? -1 : 1) * pick(span);
      left = pick(hold);
      return angle;
    },
  };
}

const NONE = () => ({ speed: 0, side: 0, turn: 0 });
export function stepMotion(prev, next, dt, { scale = 1, jump = 2 } = {}) {
  if (!prev || !next || !(dt > 0)) return NONE();
  if (Math.hypot(next.x - prev.x, next.z - prev.z) > jump) return NONE();
  const { speed, side, turn } = bodyFrom(prev, next, dt, { unit: scale || 1 }).motion;
  return { speed, side, turn };
}

export const heard = (talk, id, seen) => Boolean(talk && talk.id === id && talk.n !== seen);

export const EYES = 1.45; // Morty's eyes, over the floor he stands on (m)
export function attend(c, b, id, t, state, { y = 0, near = 3 } = {}) {
  const m = state?.morty;
  const eyes = m ? { x: m.x, y: y + EYES, z: m.z } : null;
  if (heard(state?.talk, id, b.talkN)) {
    b.talkN = state.talk.n;
    const hold = state.talk.hold ?? 2;
    b.until = t + hold;
    if (eyes) c.react?.('say', { hold, target: eyes });
  }
  const p = c.group.position;
  const look = eyes && ((b.until ?? 0) > t || Math.hypot(m.x - p.x, m.z - p.z) < near) ? eyes : null;
  if (look || b.looking) {
    c.look?.(look);
    b.looking = Boolean(look);
  }
  return look;
}
