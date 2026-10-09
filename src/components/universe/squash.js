// A landing's squash, for someone on foot (footScene.js): the feet touch,
// the body gives a little, wider and shorter, and springs back up, past and
// back once. On lib/spring.js's spring, kicked by how fast they came down;
// the scale is about the feet (the figure's own origin), its volume about
// kept. Pure: the scene steps it and multiplies the figure's scale by it.
//
//   createSquash({ k, c, max, per }) → { land(speed), step(dt) → [x, y, z],
//     reset(), spring }
//
// `speed` is the speed they came down at, metres a second; `per` is the
// squash's kick for each: a jump's landing (4.2 m/s) gives the body about
// 6% at most (the game-feel plan's range is 0.25 to 0.36; 0.05 barely showed).

import { createSpring } from '../../lib/spring';

export const SQUASH = { k: 120, c: 8, max: 0.3, per: 0.28 };

export function createSquash({ k = SQUASH.k, c = SQUASH.c, max = SQUASH.max, per = SQUASH.per } = {}) {
  const spring = createSpring({ k, c, max });
  const out = [1, 1, 1];
  return {
    spring,
    land(speed) {
      if (Number.isFinite(speed) && speed > 0) spring.kick(speed * per);
    },
    step(dt) {
      const s = spring.step(dt);
      out[0] = out[2] = 1 + s / 2;
      out[1] = 1 - s;
      return out;
    },
    reset: () => spring.reset(),
  };
}
