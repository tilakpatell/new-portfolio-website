import { describe, expect, it } from 'vitest';
import { markerStyle } from './waymark';

describe('markerStyle', () => {
  it('hides the marker when there is nothing to show', () => {
    expect(markerStyle(null)).toEqual({ hidden: true });
  });

  it('places it on the stage from the screen’s −1…1, y up, and says what it is and how far', () => {
    expect(markerStyle({ x: 0, y: 0, off: false, angle: null, kind: 'door', metres: 23.4 })).toMatchObject({ hidden: false, left: '50.00%', top: '50.00%', text: 'Door · 23 m', turn: '0rad', off: false });
    expect(markerStyle({ x: 1, y: 1, off: false, kind: 'goal', metres: 4 })).toMatchObject({ left: '100.00%', top: '0.00%', text: 'Objective · 4 m' });
  });

  it('turns its arrow round to a target off the screen', () => {
    expect(markerStyle({ x: 0.86, y: 0, off: true, angle: Math.PI / 2, kind: 'lift', metres: 80 })).toMatchObject({ off: true, turn: '1.571rad', text: 'Lift · 80 m' });
  });
});
