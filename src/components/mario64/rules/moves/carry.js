// Carrying: picking a Bob-omb (or King Bob-omb, from behind) up, standing
// and walking with it held over his head (slowly, for the king), jumping
// with it, and throwing it on B: forward at 40 and up at 30.

import { airStep, emit, groundStep, setAction, setGroundVel } from '../physics';
import { approach, turnToward } from '../vec';
import { takeOff } from './air';

export const THROW = { fwd: 40, up: 30 };

function release(m) {
  const a = m.held;
  m.held = null;
  if (!a) return;
  a.vel = { x: Math.sin(m.yaw) * THROW.fwd + m.vel.x * 0.5, y: THROW.up, z: Math.cos(m.yaw) * THROW.fwd + m.vel.z * 0.5 };
  a.state = 'thrown';
  a.thrownBy = true;
  emit(m, 'throw', { id: a.id });
}

function moveOn(m, w) {
  setGroundVel(m);
  const r = groundStep(m, w);
  m.peakY = m.pos.y;
  if (r === 'left') {
    m.airborne = true;
    m.vel.y = 0;
    m.vel.x = m.fwd * Math.sin(m.yaw);
    m.vel.z = m.fwd * Math.cos(m.yaw);
    setAction(m, 'holdjump');
  }
}

function pickup(m, inp, w) {
  m.fwd = approach(m.fwd, 0, 4);
  moveOn(m, w);
  if (m.action === 'pickup' && m.t >= 6) setAction(m, 'hold');
  return false;
}

function hold(m, inp, w) {
  if (!m.held) return setAction(m, 'idle');
  if (inp.bp) {
    inp.bp = false;
    return setAction(m, 'throw');
  }
  if (inp.ap) {
    inp.ap = false;
    takeOff(m, 'holdjump');
    return true;
  }
  if (m.mag > 0) return setAction(m, 'holdwalk');
  m.fwd = 0;
  moveOn(m, w);
  return false;
}

function holdwalk(m, inp, w) {
  if (!m.held) return setAction(m, 'walk');
  if (inp.bp) {
    inp.bp = false;
    return setAction(m, 'throw');
  }
  if (inp.ap) {
    inp.ap = false;
    takeOff(m, 'holdjump');
    return true;
  }
  if (m.mag === 0) return setAction(m, 'hold');
  const top = (m.held.heavy ? 10 : 20) * m.mag;
  m.fwd = approach(m.fwd, top, 1);
  m.yaw = turnToward(m.yaw, m.iyaw, m.held.heavy ? 0.08 : 0.15);
  moveOn(m, w);
  if (m.action === 'holdwalk' && m.t % 10 === 0) emit(m, 'step');
  return false;
}

function holdjump(m, inp, w) {
  if (inp.bp && m.held) {
    inp.bp = false;
    release(m);
  }
  m.fwd = approach(m.fwd, (m.held?.heavy ? 8 : 16) * m.mag, 1);
  m.yaw = turnToward(m.yaw, m.iyaw, 0.05);
  m.vel.x = m.fwd * Math.sin(m.yaw);
  m.vel.z = m.fwd * Math.cos(m.yaw);
  const r = airStep(m, w, { aHeld: inp.a });
  if (r === 'landed') {
    m.airborne = false;
    m.vel.y = 0;
    emit(m, 'land', { fell: m.peakY - m.pos.y });
    return setAction(m, m.held ? 'hold' : 'land');
  }
  return false;
}

function throwIt(m, inp, w) {
  if (m.t === 2) release(m);
  m.fwd = approach(m.fwd, 0, 2);
  moveOn(m, w);
  if (m.action === 'throw' && m.t >= 8) setAction(m, m.mag > 0 ? 'walk' : 'idle');
  return false;
}

export const CARRY = { pickup, hold, holdwalk, holdjump, throw: throwIt };
