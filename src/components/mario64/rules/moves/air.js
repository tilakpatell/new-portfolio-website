// Mario's actions in the air. A jump's numbers are the original's: how fast
// he leaves the ground, the air drag and steering of update_air_without_turn,
// and gravity of 4 a frame to a terminal 75.

import { airStep, emit, setAction } from '../physics';

// steering in the air: drag toward 0, a push along the facing, and a
// sideways drift from the stick, as the original does it
export function airControl(m, { drag = 32 } = {}) {
  m.fwd = m.fwd > 0 ? Math.max(0, m.fwd - 0.35) : Math.min(0, m.fwd + 0.35);
  let side = 0;
  if (m.mag > 0) {
    const d = m.iyaw - m.yaw;
    m.fwd += m.mag * Math.cos(d) * 1.5;
    side = m.mag * Math.sin(d) * 10;
  }
  if (m.fwd > drag) m.fwd -= 1;
  if (m.fwd < -16) m.fwd += 2;
  const s = Math.sin(m.yaw), c = Math.cos(m.yaw);
  // the side drift is along the facing turned a quarter left: (sin(yaw + π/2), cos(yaw + π/2))
  m.vel.x = m.fwd * s + side * c;
  m.vel.z = m.fwd * c - side * s;
}

export function takeOff(m, kind) {
  m.airborne = true;
  m.cutJump = false;
  m.vel.y = 0;
  setAction(m, kind);
  m.peakY = m.pos.y;
  emit(m, 'jump', { kind });
}

export function landOn(m) {
  m.airborne = false;
  m.vel.y = 0;
  emit(m, 'land');
  setAction(m, 'land');
}

function freefall(m, inp, w) {
  airControl(m);
  const r = airStep(m, w, { ledge: true, aHeld: inp.a });
  if (r === 'landed') landOn(m);
  return false;
}

export const AIR = { freefall };
