// Mario in water. Under it he swims with tank controls, as in the original:
// the stick turns him and pitches him (pushed up he dives, pulled back he
// climbs), A strokes, holding A flutter-kicks, and he drifts up a little. At
// the surface he treads water 80 under it: the stick moves him, A jumps out,
// Z or B dives under. Where the floor comes up to the surface, he stands.

import { airStep, emit, setAction } from '../physics';
import { approach, clamp, turnToward, wrapAngle } from '../vec';
import { takeOff } from './air';

export const WATER_ACTIONS = new Set(['swim', 'surface']);
const SURFACE = 80; // he treads water this far under it

export function enterWater(m) {
  const from = m.action;
  m.swimSpeed = Math.min(20, Math.hypot(m.vel.x, m.vel.z));
  m.pitch = m.vel.y < -20 ? -0.7 : -0.2;
  m.airborne = false;
  m.held = null;
  setAction(m, 'swim');
  if (from !== 'surface') emit(m, 'splash');
}

function swim(m, inp, w) {
  m.pitch = approach(m.pitch ?? 0, clamp(-inp.sy * 1.1, -1.2, 1.2), 0.08);
  m.yaw = wrapAngle(m.yaw - inp.sx * 0.07);
  if (inp.ap) {
    inp.ap = false;
    m.swimSpeed = Math.min(28, (m.swimSpeed ?? 0) + 12);
    emit(m, 'stroke');
  } else if (inp.a) m.swimSpeed = approach(m.swimSpeed ?? 0, 14, 0.5);
  else m.swimSpeed = approach(m.swimSpeed ?? 0, 0, 0.4);
  const cp = Math.cos(m.pitch);
  m.fwd = m.swimSpeed * cp;
  m.vel.x = m.fwd * Math.sin(m.yaw);
  m.vel.z = m.fwd * Math.cos(m.yaw);
  m.vel.y = m.swimSpeed * Math.sin(m.pitch) + 1;
  const r = airStep(m, w, { gravity: 'none' });
  if (r === 'landed') m.vel.y = 0;
  if (m.pos.y >= m.water - SURFACE) {
    m.pos.y = m.water - SURFACE;
    m.pitch = 0;
    return setAction(m, 'surface');
  }
  return false;
}

function surface(m, inp, w) {
  if (m.water === -Infinity) {
    m.airborne = true;
    return setAction(m, 'freefall');
  }
  if (inp.ap) {
    inp.ap = false;
    takeOff(m, 'jump');
    m.vel.y = 42;
    return true;
  }
  if (inp.zp || inp.bp) {
    inp.zp = inp.bp = false;
    m.pitch = -0.8;
    m.swimSpeed = 10;
    return setAction(m, 'swim');
  }
  m.fwd = approach(m.fwd, 12 * m.mag, 1);
  if (m.mag > 0) m.yaw = turnToward(m.yaw, m.iyaw, 0.15);
  m.vel.x = m.fwd * Math.sin(m.yaw);
  m.vel.z = m.fwd * Math.cos(m.yaw);
  m.vel.y = 0;
  m.pos.y = m.water - SURFACE;
  airStep(m, w, { gravity: 'none' });
  m.pos.y = Math.max(m.water - SURFACE, m.pos.y);
  // the shore: the floor up to the surface, so he stands
  if (m.floor && m.floorY >= m.water - 100 && m.floorY >= m.pos.y - 20) {
    m.pos.y = m.floorY;
    m.vel.y = 0;
    return setAction(m, m.mag > 0 ? 'walk' : 'idle');
  }
  return false;
}

export const WATER = { swim, surface };
