// Placeholder: replaced by this family's own scene.
import { ambience, field } from '../kit';

export function create(canvas, ctx) {
  return ambience(canvas, ctx, (k) => {
    const dots = field(k, { count: 80, shape: 'spark', size: [3, 7], twinkle: 0.6 });
    return {
      step(dt, t) {
        dots.step(t);
      },
      recolor(c) {
        dots.colors(c.accent, [151, 206, 76]);
        dots.glow(c.dark);
      },
    };
  });
}
