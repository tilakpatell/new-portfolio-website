// Game feel (moved down from the HQ games, which still import it through
// avengers/hq/feel.js): trauma-based camera shake (shake goes with the
// square of trauma, so small knocks barely move the camera and big ones snap
// it), hitstop (the game slows for a moment on a heavy hit, the camera and
// effects don't), and a field-of-view punch. With `calm` (reduced motion) the
// camera never moves; hitstop still happens, because it changes no pixels by
// itself. `calm` defaults to the visitor’s reduced-motion setting, read when
// the feel is made, so a game that forgets to pass it still holds still.
//
// The loop rule: a loop that owns a feel steps its game by `feel.step(dt)`
// (or multiplies its dt by `feel.timeScale(dt)`, the same thing), once a
// frame; else hitstop does nothing.
//
//   createFeel({ seed, calm = prefersReducedMotion(), baseFov, offset })
//     → { trauma(k), hitstop(ms), punch(deg), setBaseFov(v), scale(dt),
//         timeScale(dt), step(dt) → dt × timeScale(dt), update(dt, camera),
//         set({ decay, offset, roll, punchTau, stopScale }), values(), state() }
//   feelGroups(feel) → the ?debug panel’s groups (lib/debugPanel)

import { prefersReducedMotion } from '../hooks';

const DECAY = 1.5; // trauma per second
const MAX_OFFSET = 0.12; // world units at full trauma
const MAX_ROLL = 0.05; // radians
const PUNCH_TAU = 0.18; // seconds for the fov punch to fall to 1/e
const STOP_SCALE = 0.06; // how fast the game runs in a hitstop

const noise = (t, seed) => {
  const x = Math.sin(t * 12.9898 + seed * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};

export function createFeel({ seed = 1, calm = prefersReducedMotion(), baseFov = 60, offset = MAX_OFFSET } = {}) {
  // the numbers the panel can set
  const o = { decay: DECAY, offset, roll: MAX_ROLL, punchTau: PUNCH_TAU, stopScale: STOP_SCALE };
  let trauma = 0;
  let time = 0;
  let stop = 0;
  let fov = 0;
  let base = baseFov;
  // smoothed noise: sample at a steady rate and blend, so it reads as a shake
  // rather than a jitter
  const shake = (t, s) => {
    const a = Math.floor(t);
    const k = t - a;
    const f = k * k * (3 - 2 * k);
    return noise(a, s) * (1 - f) + noise(a + 1, s) * f;
  };
  function scale(dt) {
    if (stop <= 0) return 1;
    stop -= dt;
    return stop > 0 ? o.stopScale : 1;
  }
  return {
    trauma(k) {
      trauma = Math.min(1, trauma + k);
    },
    hitstop(ms) {
      stop = Math.max(stop, ms / 1000);
    },
    punch(deg) {
      fov = Math.min(12, fov + deg);
    },
    setBaseFov(v) {
      base = v;
    },
    // How much of this real frame the game should advance (hitstop).
    scale,
    timeScale: scale,
    // the frame’s dt as the game should advance it: the loop rule in one call
    step: (dt) => dt * scale(dt),
    // After the camera has been placed for the frame: add shake and punch.
    update(dt, camera) {
      time += dt;
      trauma = Math.max(0, trauma - o.decay * dt);
      fov *= Math.exp(-dt / Math.max(1e-3, o.punchTau));
      if (fov < 0.01) fov = 0;
      if (calm) return;
      if (trauma > 0) {
        const s = trauma * trauma;
        const t = time * 26;
        camera.position.x += o.offset * s * shake(t, seed);
        camera.position.y += o.offset * s * shake(t, seed + 1);
        camera.rotation.z += o.roll * s * shake(t, seed + 2);
      }
      const want = base + fov;
      if (Math.abs(camera.fov - want) > 1e-3) {
        camera.fov = want;
        camera.updateProjectionMatrix();
      }
    },
    set(next = {}) {
      for (const k of Object.keys(o)) if (Number.isFinite(next[k])) o[k] = next[k];
    },
    values: () => ({ ...o }),
    state: () => ({ trauma, stop, fov }),
  };
}

export function feelGroups(feel) {
  const item = (key, label, min, max, step) => ({ key, label, type: 'range', min, max, step, get: () => feel.values()[key], set: (v) => feel.set({ [key]: v }) });
  return [
    {
      name: 'feel',
      items: [
        item('decay', 'trauma decay /s', 0, 4, 0.05),
        item('offset', 'shake offset', 0, 1, 0.005),
        item('roll', 'shake roll', 0, 0.2, 0.005),
        item('punchTau', 'punch τ (s)', 0.05, 0.6, 0.01),
        item('stopScale', 'hitstop scale', 0, 0.5, 0.01),
      ],
    },
  ];
}
