import { describe, expect, it } from 'vitest';
import { watchdog } from './renderer';

// Runs `seconds` of frames through a watchdog, each frame taking
// frameMs(ratio) at the ratio it's at then; the screen shows a frame on its
// next beat (`beat` ms apart), as a display with vsync does, or (beat 0) as
// soon as it's done.
function run({ ratio = 2, seconds = 30, beat = 1000 / 60, frameMs, hitchEvery = 0 }) {
  const seen = { ratio, slow: 0, steps: [] };
  const dog = watchdog({
    ratio,
    set: (r) => {
      seen.ratio = r;
      seen.steps.push(r);
    },
    onSlow: () => (seen.slow += 1),
  });
  let now = 1000;
  let n = 0;
  while (now < 1000 + seconds * 1000) {
    dog.watch(now);
    let work = frameMs(seen.ratio);
    if (hitchEvery && ++n % hitchEvery === 0) work += 400; // a model arriving
    now += beat ? Math.max(1, Math.ceil(work / beat)) * beat : work;
  }
  return seen;
}

describe('watchdog', () => {
  it('leaves a scene that keeps up alone', () => {
    const seen = run({ frameMs: () => 9 });
    expect(seen.steps).toEqual([]);
    expect(seen.slow).toBe(0);
  });

  it('is not fooled by the odd long frame', () => {
    const seen = run({ frameMs: () => 9, hitchEvery: 90 });
    expect(seen.steps).toEqual([]);
  });

  // fill-bound: the work goes with the pixels, so with the ratio squared
  it('trades sharpness for frame rate when the graphics chip is the limit', () => {
    const seen = run({ frameMs: (r) => 7 * r * r, beat: 0, seconds: 40 });
    expect(seen.ratio).toBeLessThan(2);
    expect(7 * seen.ratio * seen.ratio).toBeLessThan(22);
    expect(seen.slow).toBe(0);
  });

  it('keeps going when one step is too small to show on the screen', () => {
    const seen = run({ frameMs: (r) => 6 * r * r, seconds: 40 });
    expect(seen.steps).toEqual([1.75, 1.5]);
    expect(seen.slow).toBe(0);
  });

  it('takes back steps that bought nothing (a screen held to 30fps)', () => {
    const seen = run({ frameMs: () => 5, beat: 1000 / 30, seconds: 40 });
    expect(seen.steps).toEqual([1.75, 1.5, 2]);
    expect(seen.ratio).toBe(2);
    expect(seen.slow).toBe(0);
  });

  it('at the floor and still slow, tells the scene once', () => {
    const seen = run({ ratio: 1, frameMs: (r) => 18 + 30 * r * r, beat: 0, seconds: 60 });
    expect(seen.ratio).toBe(0.75);
    expect(seen.slow).toBe(1);
  });
});
