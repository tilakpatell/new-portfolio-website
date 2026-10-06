// A pilot that plays the game through a route of steps, pressing what a
// player would press, so a test can show every star can be reached. It
// steers with the stick relative to the camera, as a player does.
//
// fly(g, route, { limit }) → { ok, frames, why }. A step is one of:
//   { go: [x, z], tol, mag }            run to a point
//   { jump: [x, z], at, kind, top,      run at a point and jump at `at` from
//     brake }                           it ('single' or 'double'), steering
//                                       on (pulling back within `brake` of
//                                       it, so as not to run off the far
//                                       side), until landed (on y ≥ top)
//   { drop: [x, z] }                    run off an edge and pound the fall
//   { wait: n }
//   { star: index }                     to the star and into it, and wait
//                                       out the celebration
//   { fn(g, mem) → input | 'done' }     anything else, a frame at a time

import { camYaw } from './camera';
import { stepGame } from './game';

const NONE = { sx: 0, sy: 0, a: false, ap: false, b: false, bp: false, z: false, zp: false };

export function toward(g, x, z, mag = 1) {
  const m = g.mario;
  const rel = Math.atan2(x - m.pos.x, z - m.pos.z) - camYaw(g.cam);
  return { ...NONE, sx: -Math.sin(rel) * mag, sy: Math.cos(rel) * mag };
}
export const flat = (g, x, z) => Math.hypot(x - g.mario.pos.x, z - g.mario.pos.z);
const grounded = (m) => !m.airborne && !['jump', 'double', 'triple', 'freefall', 'pound', 'dive'].includes(m.action);

function stepper(step) {
  const mem = { t: 0, phase: 0 };
  if (step.go)
    return (g) => {
      const [x, z] = step.go;
      if (flat(g, x, z) < (step.tol ?? 120)) return 'done';
      return toward(g, x, z, step.mag ?? 1);
    };
  if (step.jump)
    return (g) => {
      const [x, z] = step.jump;
      const m = g.mario;
      const steer = toward(g, x, z, step.mag ?? 1);
      const jumps = step.kind === 'double' ? 2 : 1;
      // landed for good: let him come to a stop where he landed
      if (mem.down) return ++mem.down > 12 ? 'done' : NONE;
      if (mem.phase === 0) {
        if (flat(g, x, z) <= (step.at ?? 350) && grounded(m)) {
          mem.phase = 1;
          return { ...steer, a: true, ap: true };
        }
        return steer;
      }
      // in the air: hold A and steer; on landing, the next jump or done
      if (m.airborne) {
        mem.air = true;
        const last = mem.phase >= jumps;
        if (last && step.brake && flat(g, x, z) < step.brake) return { ...NONE, sx: -steer.sx, sy: -steer.sy, a: true };
        return { ...steer, a: true };
      }
      if (!mem.air) return { ...steer, a: true };
      mem.air = false;
      if (mem.phase < jumps) {
        mem.phase++;
        return { ...steer, a: true, ap: true };
      }
      if (step.top != null && m.pos.y < step.top - 1) return 'fail';
      mem.down = 1;
      return NONE;
    };
  if (step.drop)
    return (g) => {
      const m = g.mario;
      const [x, z] = step.drop;
      if (m.action === 'poundland' || (mem.pounded && !m.airborne)) return m.action === 'poundland' && m.t < 12 ? NONE : 'done';
      if (m.airborne && m.vel.y < 0 && !mem.pounded) {
        mem.pounded = true;
        return { ...NONE, z: true, zp: true };
      }
      if (m.airborne) return NONE;
      return toward(g, x, z);
    };
  if (step.wait)
    return () => (mem.t++ >= step.wait ? 'done' : NONE);
  if (step.star != null)
    return (g) => {
      if (g.mode === 'starget') {
        mem.seen = true;
        return NONE;
      }
      if (mem.seen) return 'done';
      const s = g.actors.find((a) => a.type === 'star' && a.index === step.star);
      if (!s) return mem.t++ > 400 ? 'fail' : NONE;
      // a star above his reach: jump into it
      const high = s.pos.y > g.mario.pos.y + 60;
      const near = flat(g, s.pos.x, s.pos.z) < 60;
      if (near && high && grounded(g.mario)) return { ...NONE, a: true, ap: true };
      if (near) return { ...NONE, a: true };
      return toward(g, s.pos.x, s.pos.z, flat(g, s.pos.x, s.pos.z) < 200 ? 0.4 : 1);
    };
  if (step.fn) return (g) => step.fn(g, mem);
  throw new Error(`a pilot step it can't fly: ${JSON.stringify(step)}`);
}

// a reflex any player has: a Goomba chasing him close by gets jumped on
function stomper() {
  let target = null;
  let t = 0;
  return (g) => {
    const m = g.mario;
    if (target) {
      if (!target.alive || target.state === 'flat' || ++t > 40) target = null;
      else if (m.airborne) return { ...toward(g, target.pos.x, target.pos.z, flat(g, target.pos.x, target.pos.z) < 40 ? 0 : 0.8), a: true };
      else if (t > 2) target = null;
      return null;
    }
    if (!grounded(m) || m.held) return null;
    const goomba = g.actors.find((a) => a.type === 'goomba' && a.state === 'chase' && flat(g, a.pos.x, a.pos.z) < 260 && Math.abs(a.pos.y - m.pos.y) < 80);
    if (!goomba) return null;
    target = goomba;
    t = 0;
    return { ...toward(g, goomba.pos.x, goomba.pos.z, 0.6), a: true, ap: true };
  };
}

export function fly(g, route, { limit = 20000, log } = {}) {
  let frames = 0;
  const reflex = stomper();
  for (let i = 0; i < route.length; i++) {
    const run = stepper(route[i]);
    let spent = 0;
    for (;;) {
      if (frames++ > limit) return { ok: false, frames, why: `out of time at step ${i}` };
      if (g.mode === 'dead' || g.mode === 'over') return { ok: false, frames, why: `died at step ${i} (${JSON.stringify(route[i]).slice(0, 80)}) at ${Math.round(g.mario.pos.x)}, ${Math.round(g.mario.pos.y)}, ${Math.round(g.mario.pos.z)}` };
      // dialogs are read and closed
      if (g.mode === 'dialog') {
        stepGame(g, frames % 4 === 0 ? { ...NONE, a: true, ap: true } : NONE);
        continue;
      }
      const quick = g.mode === 'play' ? reflex(g) : null;
      if (quick) {
        stepGame(g, quick);
        continue;
      }
      const inp = run(g);
      if (inp === 'done') break;
      if (inp === 'fail') return { ok: false, frames, why: `step ${i} failed (${JSON.stringify(route[i]).slice(0, 80)}) at ${Math.round(g.mario.pos.x)}, ${Math.round(g.mario.pos.y)}, ${Math.round(g.mario.pos.z)}` };
      if (++spent > 3000) return { ok: false, frames, why: `stuck at step ${i} (${JSON.stringify(route[i]).slice(0, 80)}) at ${Math.round(g.mario.pos.x)}, ${Math.round(g.mario.pos.y)}, ${Math.round(g.mario.pos.z)}, ${g.mario.action}` };
      stepGame(g, inp);
      log?.(g, i);
    }
  }
  return { ok: true, frames };
}
