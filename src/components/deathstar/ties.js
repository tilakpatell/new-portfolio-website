// What the trench run's 3D view (./Trench3D.js) makes of the TIE fighters
// and of Vader, apart from the drawing. The rules (./trench.js) say where a
// TIE is, when it fires and when it's hit; here it looks like a pilot's in
// it: its window (the guns are under it) turns toward the X-wing as it
// closes, eased, it banks into its weave, it rolls away from a laser that
// goes close by, and its guns flash green as it fires. Vader, who was only
// bolts from behind, comes in over you with his two wingmen as he joins the
// chase and drops back onto your tail (the 2D rear view shows him there),
// and when Han clears him he's seen spinning away up out of the trench,
// one wingman gone and the other tumbling off. None of it changes the run:
// it reads the rules' state and keeps its own.
//
// CAMERA_BACK: how far behind the run's z the camera rides.
// tieAim(tie, g) → { yaw, pitch }: where its window points to face the
//   ship (Euler 'YXZ', yaw about up, + toward +x; within what a TIE closing
//   head-on turns); g is the run ({ z, px, py }).
// nearMiss(tie, lasers) → whether a laser is going by close and not into it.
// jinkRoll(since) → the roll of a jink `since` seconds in (0 outside it);
//   JINK its length.
// createTieLife() → { step(tie, g, lasers, dt) → { yaw, pitch, roll, jink,
//   flash } }: one TIE's drawn life, kept per TIE (the rules' own objects,
//   untouched); flash 1…0 for a moment after it fires.
// vaderFlight(v, since, g) → { vader: { x, y, z, visible, spin, roll },
//   wings: [two of the same] }: where Vader and his wingmen fly, in the
//   run's units, from the rules' vader ({ on, gone, away, spin }) and the
//   seconds since he joined.
//
// Pure: no three.js.

import { turn } from '../../lib/three/gait';
import { TRENCH } from './trench';

export const CAMERA_BACK = 1.45;
const SHIP_AHEAD = 0.55; // (Trench3D draws the X-wing this far ahead of the run's z)
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const ease = (v) => {
  const t = clamp(v, 0, 1);
  return t * t * (3 - 2 * t);
};

export function tieAim(tie, g) {
  const dx = g.px - tie.x;
  const dy = g.py - tie.y;
  const ahead = Math.max(0.3, tie.z - (g.z + SHIP_AHEAD));
  return { yaw: clamp(Math.atan2(dx, ahead), -0.6, 0.6), pitch: clamp(-Math.atan2(dy, Math.hypot(dx, ahead)), -0.5, 0.5) };
}

const CLOSE = 0.9; // a laser this close across, and not a hit, makes a TIE pilot jink
export function nearMiss(tie, lasers = []) {
  for (const l of lasers) {
    if (!(l.life > 0) || Math.abs(l.z - tie.z) > 1.2) continue;
    const d = Math.hypot(l.x - tie.x, l.y - tie.y);
    if (d >= TRENCH.tie.hit && d < CLOSE) return true;
  }
  return false;
}

export const JINK = 0.55;
export const jinkRoll = (since) => (since >= 0 && since <= JINK ? Math.sin((Math.PI * since) / JINK) * 1.1 : 0);

const FLASH = 0.09; // seconds a TIE's guns glow as it fires
export function createTieLife() {
  const seen = new WeakMap();
  return {
    step(tie, g, lasers, dt) {
      const d = dt > 0 ? Math.min(dt, 0.1) : 0;
      let s = seen.get(tie);
      if (!s) {
        s = { yaw: 0, pitch: 0, jinkT: -1, side: 1, fire: tie.fire ?? 0, flash: 0 };
        seen.set(tie, s);
      }
      const aim = tieAim(tie, g);
      s.yaw = turn(s.yaw, aim.yaw, d, 4);
      s.pitch = turn(s.pitch, aim.pitch, d, 4);
      if (!(s.jinkT >= 0 && s.jinkT <= JINK) && nearMiss(tie, lasers)) {
        s.jinkT = 0;
        const by = lasers.find((l) => l.life > 0 && Math.abs(l.z - tie.z) <= 1.2);
        s.side = by && by.x > tie.x ? -1 : 1; // (away from it)
      } else if (s.jinkT >= 0) s.jinkT += d;
      // its fire timer starts again from the top when it fires
      if ((tie.fire ?? 0) > s.fire + 0.05) s.flash = FLASH;
      else s.flash = Math.max(0, s.flash - d);
      s.fire = tie.fire ?? 0;
      return { yaw: s.yaw, pitch: s.pitch, roll: Math.cos(tie.phase ?? 0) * 0.35, jink: jinkRoll(s.jinkT) * s.side, flash: s.flash / FLASH };
    },
  };
}

// Vader's flight: in over the X-wing from behind as he joins (ahead of the
// camera for a second, his wingmen either side), then back onto your tail;
// cleared by Han, up and out over you, spinning
const SWOOP = 2.8; // seconds
const BEHIND = -4.2; // the run's units behind its z: past the camera, out of sight
const none = () => ({ x: 0, y: 0, z: 0, visible: false, spin: 0, roll: 0 });
export function vaderFlight(v, since, g) {
  const out = { vader: none(), wings: [none(), none()] };
  if (!v) return out;
  if (v.gone) {
    if (!(v.away > 0)) return out;
    const k = 1 - v.away;
    const e = ease(k);
    out.vader = { x: g.px + 1.3 * e, y: g.py + 0.35 + 3.4 * k * k + 0.6 * e, z: g.z - 3.6 + 7.5 * e, visible: true, spin: v.spin ?? 0, roll: 0 };
    // one wingman gone; the other, knocked into, tumbling off the other way
    out.wings[1] = { x: out.vader.x - 0.45 - 1.6 * e, y: out.vader.y - 0.3 + 1.2 * e, z: out.vader.z - 0.5, visible: true, spin: (v.spin ?? 0) * 0.7, roll: 0 };
    return out;
  }
  if (!v.on || !(since >= 0) || since > SWOOP) return out;
  const dz = since < 1.1 ? BEHIND + (3.2 - BEHIND) * ease(since / 1.1) : since < 1.7 ? 3.2 - 0.4 * ease((since - 1.1) / 0.6) : 2.8 + (BEHIND - 2.8) * ease((since - 1.7) / 1.1);
  const x = g.px * 0.4 + Math.sin(since * 1.3) * 0.15;
  const y = g.py + 0.95 - 0.35 * ease(since / 1.1);
  const roll = Math.sin(since * 2.4) * 0.25;
  out.vader = { x, y, z: g.z + dz, visible: true, spin: 0, roll };
  out.wings = [-1, 1].map((side) => ({ x: x + side * 0.45, y: y - 0.08, z: g.z + dz - 0.55, visible: true, spin: 0, roll }));
  return out;
}
