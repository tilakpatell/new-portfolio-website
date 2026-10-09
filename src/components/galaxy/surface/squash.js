// A landing's squash (the game-feel design's Tier 2): the figure squats
// on landing, as wide as it goes low, and springs back up through upright
// and back, on lib/spring.js's spring (k 120, c 8: the plan's numbers). Set
// at once on the landing (the speed it hit at × PER, to `max`), so the
// squat is there the frame the feet touch. A step down under 3 m/s is
// nothing; reduced motion holds the figure as it is. Pure: the scene puts
// scale() on the figure's holder, whose origin is at its feet.
//
//   createSquash({ calm }) → { land(speed), step(dt), scale() → [x, y, z] }

import { createSpring } from '../../../lib/spring';

export const SQUASH = { k: 120, c: 8, max: 0.3, per: 0.025, from: 3 };

export function createSquash({ calm = false } = {}) {
  const s = createSpring({ k: SQUASH.k, c: SQUASH.c, max: SQUASH.max });
  return {
    land(speed) {
      if (calm || !(speed > SQUASH.from)) return;
      s.x = Math.min(SQUASH.max, speed * SQUASH.per);
    },
    step: (dt) => s.step(dt),
    scale() {
      const q = s.x;
      return q === 0 ? [1, 1, 1] : [1 + q / 2, 1 - q, 1 + q / 2];
    },
  };
}
