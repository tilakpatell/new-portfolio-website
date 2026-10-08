// One quality level for the runtime: the device's tier and its budget
// (lib/device), the pace that softens the picture when frames come late
// (lib/three/pace), and a floor under it: when the pace has been at its
// last step for `floorAfter` ms of frames and the frames are still late,
// the level goes one past the steps, once, so a module can shed its own
// effects (what a scene's `onSlow` meant). The pixel ratio to draw at is
// the budget's, never past the screen's own (`dpr`: a 1× screen draws at
// 1), under a module's cap where it has one (`ratioUnder`), × scale; the
// runtime sets it on the renderer. The visitor's sharpness (the settings
// panel, lib/device's `sharpness()`) scales the screen's ratio, still under
// the budget's; a quality level picked while a world is up swaps the
// budget (`retune`).
//
// The budget row is the level's (lib/device's detail: an ultra desktop
// starts on the ultra row, more samples and a bigger shadow map), the tier
// still the tier.
//
// createQuality({ tier, detail, pace, floorAfter, dpr, sharp }) → { tier, budget,
//   level, scale, ratio, ratioUnder(cap), on(fn) → undo, frame(now) → the
//   new level or null, reset(), retune(level), setSharpness(k), setLevel(step) }
// (`setLevel`: a calibrated step of the pace, held as its ceiling:
// lib/three/calibrate)

import { BUDGETS, device, sharpness } from '../lib/device';
import { STEPS, createPace } from '../lib/three/pace';

export function createQuality({ tier, detail, pace = createPace(), floorAfter = 2500, dpr = Infinity, sharp = sharpness() } = {}) {
  // (a tier given alone is its own level: the tests, a forced tier)
  detail ??= tier ?? device().detail;
  tier ??= device().tier;
  let budget = BUDGETS[detail] ?? BUDGETS[tier] ?? BUDGETS.high;
  let k = sharp;
  const last = STEPS.length - 1;
  const listeners = new Set();
  let level = 0;
  let scale = 1;
  let atLastSince = null; // when the pace reached its last step
  let floored = false;
  const tell = (l) => {
    for (const fn of listeners) fn(l);
  };
  return {
    tier,
    get budget() {
      return budget;
    },
    get level() {
      return level;
    },
    get scale() {
      return scale;
    },
    get ratio() {
      return Math.min(budget.ratio, dpr * k) * scale;
    },
    ratioUnder(cap = Infinity) {
      return Math.min(cap ?? Infinity, budget.ratio, dpr * k) * scale;
    },
    retune(level) {
      budget = BUDGETS[level] ?? BUDGETS.high;
    },
    setSharpness(next) {
      k = Number.isFinite(next) ? Math.min(2, Math.max(0.5, next)) : 1;
    },
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    frame(now) {
      const changed = pace.frame(now);
      if (changed !== null && !floored) {
        scale = pace.scale;
        if (pace.level !== level) {
          level = pace.level;
          atLastSince = level === last ? now : null;
          tell(level);
          return level;
        }
      } else if (floored) {
        scale = STEPS[last];
      }
      if (!floored && level === last) {
        if (atLastSince === null) atLastSince = now;
        else if (now - atLastSince >= floorAfter) {
          floored = true;
          level = STEPS.length;
          tell(level);
          return level;
        }
      }
      return null;
    },
    setLevel(l) {
      pace.set?.(l);
      level = pace.level ?? l;
      scale = pace.scale ?? STEPS[level];
      atLastSince = null;
      tell(level);
    },
    reset() {
      pace.reset();
      level = 0;
      scale = 1;
      atLastSince = null;
      floored = false;
    },
  };
}
