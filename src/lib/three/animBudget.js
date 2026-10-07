// How often each of many figures is animated, so a crowd can grow without
// every mixer stepping every frame: near and in view every frame, further
// off every second frame, far away every fourth, out of view not at all
// (its last pose held). It takes over from the Citadel's every-third-frame
// and actors.js's every-fourth throttles.
// (docs/superpowers/specs/2026-10-07-living-characters-design.md, animBudget.js)
//
// createAnimBudget({ near = 12, far = 40, max = 64 }) → { rate(pos, camera,
//   inView) → 0 | 0.25 | 0.5 | 1, frame() }
//   pos: where the figure is ({ x, y, z }, the world's units); camera:
//   anything with a world `position` ({ x, y, z }), or null to judge by
//   view alone; inView: whether the caller found it on screen (true when
//   left out). rate is the share of frames the figure is stepped on. No
//   more than `max` figures get 1 between one frame() and the next; the
//   rest asked for it drop to 0.5, first asked first served, so a world
//   that wants its nearest sharpest asks nearest first. Call frame() once
//   a rendered frame, before asking.
// budgetClock(seed) → (rate, dt) → the time to step the figure by this
//   frame, or 0 on a frame it skips: one per figure. A figure skipped three
//   frames is stepped by all four frames' time on the fourth, so it keeps
//   time with one stepped every frame; seeds spread figures at one rate
//   over the frames, so a crowd's work isn't all on every fourth one. At
//   rate 0 the time missed is let go, so a figure coming back into view
//   doesn't leap forward. Each frame's dt counts for a tenth of a second
//   at most.
//
// Pure: no three.js.

const LONGEST = 0.1;
const GOLDEN = 0.6180339887498949;

export function createAnimBudget({ near = 12, far = 40, max = 64 } = {}) {
  let full = 0; // figures given rate 1 since the last frame()
  const nearSq = near * near;
  const farSq = far * far;

  const rate = (pos, camera, inView = true) => {
    if (!inView) return 0;
    const c = camera?.position;
    const d = c ? (pos.x - c.x) ** 2 + (pos.y - c.y) ** 2 + (pos.z - c.z) ** 2 : 0;
    if (d > farSq) return 0.25;
    if (d > nearSq) return 0.5;
    if (full >= max) return 0.5;
    full++;
    return 1;
  };

  const frame = () => {
    full = 0;
  };

  return { rate, frame };
}

export function budgetClock(seed = 0) {
  // where in its round of frames this figure starts: the golden ratio's
  // steps land evenly however many figures there are
  let share = (((seed * GOLDEN) % 1) + 1) % 1;
  let held = 0;
  return (rate, dt) => {
    if (!(rate > 0)) {
      held = 0;
      return 0;
    }
    held += dt > 0 ? Math.min(dt, LONGEST) : 0;
    share += rate;
    if (share < 1) return 0;
    share -= Math.floor(share);
    const out = held;
    held = 0;
    return out;
  };
}
