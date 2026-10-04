// A careful pilot, for the tests (and nothing else): it flies the case to the
// pad with a cascade of PD controllers. Horizontally it chooses how fast the
// case should go, leans the jet to put the hook where the case needs it
// (which also damps the swing), and lets the jet's own speed follow. Up and
// down it holds the case's base a safe height over whatever is ahead, keeps
// the jet under girders and roofs, then lowers the case gently onto the pad.

import { CABLE, CASE, G, GANTRY, HANGAR, JET, LEGS, PADS, TREES, groundAt, hookAt, hoverSpool, ringAt, windAt } from './rules';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const HANG = CASE.h + CASE.sling + CABLE + JET.hook; // case base to jet middle, cable taut and straight
const FIN = 4.9; // the most the jet's tail rises above its middle, leaning

// the highest thing the case must clear between a and b
function floorBetween(a, b) {
  let top = -Infinity;
  for (let x = Math.min(a, b); x <= Math.max(a, b); x += 1) top = Math.max(top, groundAt(x));
  for (const [x, h] of TREES) if (x + h * 0.2 > Math.min(a, b) && x - h * 0.2 < Math.max(a, b)) top = Math.max(top, groundAt(x) + h);
  return top;
}
// the lowest roof over the jet between a and b
function ceilingBetween(a, b) {
  let c = Infinity;
  const lo = Math.min(a, b) - 10;
  const hi = Math.max(a, b) + 10;
  if (GANTRY.x + GANTRY.w / 2 > lo && GANTRY.x - GANTRY.w / 2 < hi) c = Math.min(c, GANTRY.y);
  if (HANGAR.x1 > lo && HANGAR.x0 < hi) c = Math.min(c, HANGAR.roof);
  return c;
}

export function pilot(g, { speed = 8, margin = 3.5 } = {}) {
  const J = g.jet;
  const C = g.case;
  const pad = PADS[LEGS[g.leg].to];
  const dx = pad.x - C.x;
  const dist = Math.abs(dx);
  const dir = Math.sign(dx) || 1;

  // ── the case's base: over everything ahead, then down onto the pad ──
  const look = clamp(Math.abs(C.vx) * 3 + 24, 24, 45);
  const ahead = C.x + dir * Math.min(look, dist);
  let base = floorBetween(C.x - dir * 3, ahead) + margin;
  base = Math.max(base, groundAt(C.x) + 2.5);

  // ── how fast the case should go: slow down to arrive, slower under roofs,
  // and hardly at all until it's high enough for what's ahead ──
  let vmax = speed;
  const ceil = ceilingBetween(J.x, J.x + dir * 30);
  if (ceil < Infinity) vmax = Math.min(vmax, 5);
  const short = base - C.y;
  if (dist >= 22 && short > 1.5) vmax = Math.min(vmax, Math.max(0.8, 5 - short));
  const vd = clamp(0.32 * dx, -vmax, vmax);
  let descending = false;
  if (dist < 22) {
    // the approach: lower as it closes, then right down once it's over the pad and steady
    const over = dist < 1.5 && Math.abs(C.vx) < 0.6 && Math.abs(C.vx - J.vx) < 0.8;
    const floor = floorBetween(C.x - 3, pad.x + 3);
    base = Math.max(floor + 0.6 + dist * 0.18, groundAt(C.x) + 1);
    if (over || g.descend) {
      g.descend = true;
      descending = true;
    }
  } else g.descend = false;
  let yt = groundAt(C.x) + Math.max(base - groundAt(C.x), 0) + HANG;
  if (descending) yt = groundAt(pad.x) + HANG - 0.6; // let the cable go a little slack once it's down
  // under a roof the jet must keep its tail clear
  const roof = ceilingBetween(J.x, J.x + dir * Math.max(26, Math.abs(J.vx) * 6));
  if (roof < Infinity) yt = Math.min(yt, roof - FIN - 0.8);

  // ── horizontal: lean so the hook leads the case where it should go ──
  // The case goes where the cable leans it and the wind pushes it; the jet
  // also has the wind and the cable's pull to lean against.
  const hanging = g.taut && !C.grounded;
  const [jwx] = windAt(g, J.x, J.y);
  const [cwx] = windAt(g, C.x, C.y + CASE.h / 2);
  const [, hy] = hookAt(J);
  const [, ry] = ringAt(C);
  const lv = Math.max(4, hy - ry);
  const lead = clamp(((0.8 * (vd - C.vx) - CASE.drag * (cwx - C.vx)) * lv) / G, -4.5, 4.5);
  let axd = 2.2 * (C.x + lead - J.x) + 2.6 * (C.vx - J.vx) - JET.drag * (jwx - J.vx);
  if (hanging) axd += ((CASE.mass / JET.mass) * G * (J.x - C.x)) / lv;
  const lift = G * (1 + (hanging ? CASE.mass / JET.mass : 0));
  const tilt = clamp(Math.atan2(axd, lift) / JET.maxTilt, -1, 1);

  // ── vertical: hold the height, gently ──
  const down = descending ? (C.grounded ? 1.2 : clamp((C.y - groundAt(C.x)) * 0.5, 0.45, 1.4)) : 3;
  const vyt = clamp(0.9 * (yt - J.y), -down, 3.2);
  const hover = hoverSpool(!C.grounded || g.taut) / Math.max(0.6, Math.cos(J.angle));
  const thrust = clamp(hover + 0.12 * (vyt - J.vy), 0, 1);
  return { thrust, tilt };
}
