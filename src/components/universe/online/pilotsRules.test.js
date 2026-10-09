import { describe, expect, it } from 'vitest';
import { DRAW, howToDraw } from './pilotsRules';

// a pose where they are (`lane`: what an old client still says when it rode a hyperlane)
const pose = (x, y, z, lane = false) => ({ x, y, z, lane });

describe('howToDraw', () => {
  it('draws a pilot within DRAW of you as a ship', () => {
    expect(DRAW).toBe(3000);
    const me = { x: 0, y: 0, z: 0 };
    expect(howToDraw(pose(100, 0, 0), me)).toBe('ship');
    expect(howToDraw(pose(0, 0, DRAW - 1), me)).toBe('ship');
  });
  it('draws one beyond it as a blip on the chart alone, whatever its lane bit says (the lanes are gone)', () => {
    const me = { x: 0, y: 0, z: 0 };
    expect(howToDraw(pose(20000, 0, 20000), me)).toBe('blip');
    expect(howToDraw(pose(20000, 0, 20000, true), me)).toBe('blip');
  });
  it('treats you as far from everyone when you are not flying', () => {
    expect(howToDraw(pose(1, 0, 0), null)).toBe('blip');
    expect(howToDraw(pose(1, 0, 0, true), null)).toBe('blip');
  });
});
