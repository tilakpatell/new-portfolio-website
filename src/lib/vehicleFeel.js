// The car’s visible half (docs/superpowers/specs/2026-10-08-one-feel-site-wide-
// design.md §4): the physics half (lib/physics/vehicle.js) drives true; this
// is what the body does on top of it, exaggerated, from real springs rather
// than a sine. Pure: no three, no DOM; lib/three/vehicleBody.js puts it on
// the meshes.
//
// pitch and roll ease (at `ease` a second) towards the acceleration times
// their `per`, clamped to their `max`: back under throttle, forward under
// braking, away from the turn (the sprung body lags the wheels), level in
// the air. Negative pitch is the nose up; positive roll is the right side
// down. squash is a damped spring, s'' = −k s − c s', set at once to a
// landing’s speed × squashPerLanding or a hit’s gain × squashPerHit (the
// larger of that and where it is), then ringing back; clamped to ±squashMax.
// The antenna is his (research note: speedStrength 10, damping 0.035,
// pullBackStrength 0.02), driven by the chassis’s acceleration along the
// nose and to the right; its value is how far the tip trails along that
// acceleration, so a body bends the mesh the other way.
//
// His antenna numbers are per frame at 60 a second and his velocity is in
// metres a frame, so a frame’s change in it is the acceleration × (1/60)²:
// the springs here step at that fixed 1/60 s whatever the frame rate (the
// note’s pitfall: eased per frame, his feel shifted at 120 Hz). Both are the
// kit’s springs (lib/spring.js): the squash in seconds, the antenna in his
// frames (a step of 1, its pull the stiffness, its damping the damping, the
// acceleration’s push the place it is pulled towards).
//
//   FEEL: { pitchPer, pitchMax, rollPer, rollMax, squashStiffness,
//     squashDamping, squashPerLanding, squashPerHit, squashMax,
//     antenna: { speedStrength, damping, pullBackStrength, max }, ease }
//   createVehicleFeel(opts = FEEL) → { step({ forwardSpeed, forwardAccel,
//     lateralAccel (m/s², + right), steer, airborne, landed (m/s), hit
//     (gain 0…1) }, dt) → { squash, roll, pitch, antenna: [x, z] }, reset(),
//     set(opts), values() }
//   feelGroups(feel) → the debug panel’s groups (lib/debugPanel.js)
//
// forwardSpeed and steer are taken and not used: the accelerations already
// carry them, and a world without a measured one passes what it has.

import { createSpring } from './spring';

export const FEEL = {
  pitchPer: 0.05 / 9.81, // rad per m/s² of forward acceleration
  pitchMax: 0.05,
  rollPer: 0.11 / 9.81,
  rollMax: 0.11,
  squashStiffness: 120,
  squashDamping: 8,
  squashPerLanding: 0.05, // per m/s of landing speed
  squashPerHit: 0.15,
  squashMax: 0.3,
  antenna: { speedStrength: 10, damping: 0.035, pullBackStrength: 0.02, max: 0.6 },
  ease: 12, // pitch and roll, a second
};

const H = 1 / 60; // his frame, the springs’ step
const MOST = 30; // steps a call at most: a tab come back doesn’t replay its absence
const clamp = (v, max) => Math.max(-max, Math.min(max, v));
const num = (v) => (Number.isFinite(v) ? v : 0);

export function createVehicleFeel(opts = FEEL) {
  let o;
  const set = (next = {}) => {
    o = { ...o, ...next, antenna: { ...o?.antenna, ...next.antenna } };
  };
  set({ ...FEEL, ...opts, antenna: { ...FEEL.antenna, ...opts.antenna } });

  let pitch, roll, carry;
  const squash = createSpring();
  const tip = createSpring({ dims: 2 });
  // the springs take the numbers as they are now (the panel may have moved them)
  const tune = () => {
    squash.set({ k: o.squashStiffness, c: o.squashDamping, max: o.squashMax });
    tip.set({ k: o.antenna.pullBackStrength, c: o.antenna.damping, max: o.antenna.max });
  };
  const out = { squash: 0, roll: 0, pitch: 0, antenna: [0, 0] };
  function reset() {
    pitch = roll = carry = 0;
    squash.reset();
    tip.reset();
  }
  reset();

  function step({ forwardAccel = 0, lateralAccel = 0, airborne = false, landed = 0, hit = 0 } = {}, dt = H) {
    const fa = num(forwardAccel);
    const la = num(lateralAccel);
    const t = Math.max(0, num(dt));
    // the lean, eased the same at any frame rate
    const k = 1 - Math.exp(-o.ease * t);
    const wantPitch = airborne ? 0 : clamp(-fa * o.pitchPer, o.pitchMax);
    const wantRoll = airborne ? 0 : clamp(-la * o.rollPer, o.rollMax);
    pitch += (wantPitch - pitch) * k;
    roll += (wantRoll - roll) * k;

    // the springs, at their own step (a hair’s slack so halves add up to a whole)
    carry = Math.min(carry + t, MOST * H);
    const a = o.antenna;
    tune();
    // a frame’s push on the tip, in his units
    const push = [fa * a.speedStrength * H * H, la * a.speedStrength * H * H];
    // (with no pull back there is no place to be pulled to: the push is a kick)
    const pulled = a.pullBackStrength > 0;
    if (pulled) tip.target(push.map((f) => f / a.pullBackStrength));
    while (carry >= H - 1e-9) {
      carry -= H;
      squash.step(H);
      if (!pulled) tip.kick(push);
      tip.step(1);
    }
    carry = Math.max(0, carry);

    // a landing or a hit sets the squash at once; it rings back from there
    const kick = Math.max(Math.max(0, num(landed)) * o.squashPerLanding, Math.max(0, Math.min(1, num(hit))) * o.squashPerHit);
    if (kick > 0 && kick > squash.x) squash.x = Math.min(kick, o.squashMax);

    out.pitch = pitch;
    out.roll = roll;
    out.squash = squash.x;
    [out.antenna[0], out.antenna[1]] = tip.x;
    return out;
  }

  return {
    step,
    reset,
    set,
    values: () => ({ ...o, antenna: { ...o.antenna } }),
  };
}

// [key, label, min, max, step, its name under antenna (an antenna number)]
const ITEMS = [
  ['pitchPer', 'pitch / accel', 0, 0.02, 0.0005],
  ['pitchMax', 'pitch max', 0, 0.3, 0.005],
  ['rollPer', 'roll / accel', 0, 0.04, 0.0005],
  ['rollMax', 'roll max', 0, 0.4, 0.005],
  ['ease', 'lean ease', 1, 40, 0.5],
  ['squashStiffness', 'squash k', 10, 400, 5],
  ['squashDamping', 'squash damp', 0, 40, 0.5],
  ['squashPerLanding', 'squash / land', 0, 0.2, 0.005],
  ['squashPerHit', 'squash / hit', 0, 0.5, 0.01],
  ['squashMax', 'squash max', 0, 0.6, 0.01],
  ['antennaSpeedStrength', 'aerial pull', 0, 40, 0.5, 'speedStrength'],
  ['antennaDamping', 'aerial damp', 0, 0.2, 0.001, 'damping'],
  ['antennaPullBackStrength', 'aerial spring', 0, 0.1, 0.001, 'pullBackStrength'],
  ['antennaMax', 'aerial max', 0, 1.5, 0.01, 'max'],
];

export function feelGroups(feel) {
  return [
    {
      name: 'car feel',
      items: ITEMS.map(([key, label, min, max, step, inAntenna]) => ({
        key,
        label,
        type: 'range',
        min,
        max,
        step,
        get: () => (inAntenna ? feel.values().antenna[inAntenna] : feel.values()[key]),
        set: (v) => feel.set(inAntenna ? { antenna: { [inAntenna]: v } } : { [key]: v }),
      })),
    },
  ];
}
