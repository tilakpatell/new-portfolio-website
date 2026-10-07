// One quality level for the runtime: the device's tier and its budget
// (lib/device), the pace that softens the picture when frames come late
// (lib/three/pace), and a floor under it: when the pace has been at its
// last step for `floorAfter` ms of frames and the frames are still late
// there (the pace's `stuck`), the level goes one past the steps, once, so a
// module can shed its own effects (what a scene's `onSlow` meant). Each
// world starts afresh (the runtime calls reset() and hold() as it's made):
// back at the sharpest, and its first few seconds of frames let go by
// unjudged (`hold(ms)`, from the first frame after it), since an arrival's
// hitches (models arriving, shaders linking, the page's HUD going up) say
// nothing of how the world will run. The pixel ratio to draw at is
// the screen's own (`dpr`), or the budget's least where that's more
// (`minRatio`: a 1× screen draws at 1.25 on the high tier, 1.5 with a
// strong card, as lib/device's pixelRatio has it for every renderer),
// never past the budget's most, under a module's cap where it has one
// (`ratioUnder`), × scale; the runtime sets it on the renderer, and
// nothing else does.
//
// createQuality({ tier, pace, floorAfter, dpr, minRatio }) → { tier,
//   budget, level, scale, ratio, ratioUnder(cap), on(fn) → undo,
//   frame(now) → the new level or null, reset(), hold(ms) }

import { BUDGETS, device } from '../lib/device';
import { STEPS, createPace } from '../lib/three/pace';

export function createQuality({ tier = device().tier, pace = createPace(), floorAfter = 2500, dpr = Infinity, minRatio = BUDGETS[tier]?.minRatio ?? 0 } = {}) {
  const budget = BUDGETS[tier] ?? BUDGETS.high;
  const sharpest = (cap) => Math.min(cap ?? Infinity, budget.ratio, Math.max(dpr, minRatio));
  const last = STEPS.length - 1;
  const listeners = new Set();
  let level = 0;
  let scale = 1;
  let atLastSince = null; // when the pace reached its last step
  let floored = false;
  let holdFor = 0; // ms of frames to let go by unjudged (hold)
  let heldTill = null; // till when: from the first frame after the hold was asked for
  const tell = (l) => {
    for (const fn of listeners) fn(l);
  };
  return {
    tier,
    budget,
    get level() {
      return level;
    },
    get scale() {
      return scale;
    },
    get ratio() {
      return sharpest() * scale;
    },
    // (`unscaled`: the level's ratio without the pace's scale, for a module
    // that softens through its own post chain and keeps its canvas as it is)
    ratioUnder(cap = Infinity, { unscaled = false } = {}) {
      return sharpest(cap) * (unscaled ? 1 : scale);
    },
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    frame(now) {
      if (holdFor) {
        heldTill ??= now + holdFor;
        // (none of it goes to the pace: its first frame after this starts its count)
        if (now < heldTill) return null;
        holdFor = 0;
        heldTill = null;
      }
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
      // (only with frames still late at the last step: it used to floor on
      // the clock alone, even once frames there had caught up)
      if (!floored && level === last) {
        if (atLastSince === null) atLastSince = now;
        else if (now - atLastSince >= floorAfter && pace.stuck > 0) {
          floored = true;
          level = STEPS.length;
          tell(level);
          return level;
        }
      }
      return null;
    },
    reset() {
      pace.reset();
      level = 0;
      scale = 1;
      atLastSince = null;
      floored = false;
    },
    hold(ms) {
      holdFor = ms;
      heldTill = null;
    },
  };
}
