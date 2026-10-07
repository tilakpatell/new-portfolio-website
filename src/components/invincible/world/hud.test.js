import { describe, expect, it } from 'vitest';
import { COMPASS, layoutCompass, markerSize, objectiveText, titleMode } from './hud';

const W = 420;
// a mark at x px along the strip (bearing back from x)
const at = (id, x) => ({ id, label: id, bearing: ((x - W / 2) / W) * COMPASS.span });

describe('the compass layout', () => {
  it('puts a mark where its bearing is, on the first row', () => {
    const [m] = layoutCompass([at('gda', 100)], W);
    expect(m.x).toBeCloseTo(100, 6);
    expect(m.row).toBe(0);
    expect(m.clipped).toBe(false);
  });

  it('stacks a mark within 72 px of another on the second row', () => {
    const out = layoutCompass([at('a', 100), at('b', 160)], W);
    expect(out.map((m) => m.row)).toEqual([0, 1]);
  });

  it('keeps marks 72 px or more apart on one row', () => {
    const out = layoutCompass([at('a', 40), at('b', 112)], W);
    expect(out.map((m) => m.row)).toEqual([0, 0]);
  });

  it('labels nothing in the right-hand 220 px the buttons sit over: clipped right', () => {
    const [m] = layoutCompass([at('x', W - 100)], 600);
    expect(m.clipped).toBe(true);
    expect(m.side).toBe('right');
  });

  it('clips a mark off either end of the strip to that side', () => {
    const out = layoutCompass([at('l', -50), at('r', W + 50)], W, { reserve: 0 });
    expect(out.map((m) => [m.clipped, m.side])).toEqual([
      [true, 'left'],
      [true, 'right'],
    ]);
    expect(out[0].x).toBe(0);
    expect(out[1].x).toBe(W);
  });

  it('drops a third mark crowding both rows (clipped, its side "crowd")', () => {
    const out = layoutCompass([at('a', 100), at('b', 130), at('c', 160)], W);
    expect(out[2]).toMatchObject({ clipped: true, side: 'crowd' });
  });

  it('keeps a name half a gap clear of a heading on the first row', () => {
    const out = layoutCompass([at('a', 120)], W, { taken: [100] });
    expect(out[0].row).toBe(1);
    expect(layoutCompass([at('a', 140)], W, { taken: [100] })[0].row).toBe(0);
  });

  it('keeps the order it was given (nearest first wins the first row)', () => {
    const out = layoutCompass([at('near', 160), at('far', 100)], W);
    expect(out.find((m) => m.id === 'near').row).toBe(0);
  });
});

describe('the title', () => {
  it('is full until he moves, then a chip 2.5 s after', () => {
    expect(titleMode(10, null, false)).toBe('full');
    expect(titleMode(1, 0, false)).toBe('full');
    expect(titleMode(3, 0, false)).toBe('chip');
  });
  it('is a chip at once when a mission starts', () => {
    expect(titleMode(0, null, true)).toBe('chip');
  });
});

describe('the objective line', () => {
  it('reads metres under a kilometre, and kilometres to a decimal over it', () => {
    expect(objectiveText({}, 1234)).toBe('1.2 km');
    expect(objectiveText({}, 640.4)).toBe('640 m');
    expect(objectiveText({ text: 'Get to the bank' }, 250)).toBe('Get to the bank · 250 m');
  });
  it('is the step alone without a distance, and nothing without a step', () => {
    expect(objectiveText({ text: 'Talk to Allen' }, null)).toBe('Talk to Allen');
    expect(objectiveText(null, 100)).toBe('');
  });
});

describe('the marker over a target', () => {
  it('is never smaller than 24 px', () => {
    expect(markerSize(5000, 540)).toBe(24);
  });
  it('grows nearer, and is capped', () => {
    expect(markerSize(40, 540)).toBeGreaterThan(markerSize(400, 540));
    expect(markerSize(1, 540)).toBe(COMPASS.markerMax);
  });
});
