import { describe, expect, it } from 'vitest';
import { SKY_R, createSky, seenTo } from './sky';

describe('how far there is anything to see under a landing’s sky', () => {
  it('is no further than the dome (and a little past its edge) in full day with no space showing through', () => {
    expect(seenTo(1, 0)).toBeGreaterThan(SKY_R);
    expect(seenTo(1, 0)).toBeLessThan(SKY_R * 1.2);
    expect(seenTo(0.995, 0)).toBe(seenTo(1, 0));
  });

  it('is as far as the camera sees by night, at dusk, or where space shows through by day', () => {
    expect(seenTo(0.98, 0)).toBeNull();
    expect(seenTo(0, 0)).toBeNull();
    expect(seenTo(1, 0.3)).toBeNull();
  });

  it('is what the sky says of itself, as it hides what’s beyond it', () => {
    const day = createSky({}, '#8ab4ff');
    day.set({ day: 1 });
    expect(day.seenTo).toBe(seenTo(1, 0));
    expect(day.mat.depthWrite).toBe(true);
    day.set({ day: 0.5 });
    expect(day.seenTo).toBeNull();
    expect(day.mat.depthWrite).toBe(false);
    const thin = createSky({ space: 0.4 }, '#8ab4ff');
    thin.set({ day: 1 });
    expect(thin.seenTo).toBeNull();
    expect(thin.mat.depthWrite).toBe(false);
    day.dispose();
    thin.dispose();
  });
});
