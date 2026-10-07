import { describe, expect, it } from 'vitest';
import { createTrack, leafPlaces } from './index';

const STEP = 1 / 30;
const slide = { kind: 'slide', w: 2, h: 2.6 };
const blast = { kind: 'blast', w: 2.4, h: 2.6 };

describe('a door’s leaves, from how open the game says it is', () => {
  it('shuts a sliding door with two halves meeting in the middle', () => {
    expect(leafPlaces(slide, 0)).toEqual([
      { x0: -1, x1: 0, y0: 0, y1: 2.6, lead: 'x1' },
      { x0: 0, x1: 1, y0: 0, y1: 2.6, lead: 'x0' },
    ]);
  });

  it('parts the halves sideways into the wall, showing only what is still in the doorway', () => {
    const [left, right] = leafPlaces(slide, 0.5);
    expect(left.x0).toBeCloseTo(-1);
    expect(left.x1).toBeCloseTo(-0.5);
    expect(right.x0).toBeCloseTo(0.5);
    expect(right.x1).toBeCloseTo(1);
  });

  it('shows no leaf at all once a door is wide open, and never one in an arch', () => {
    expect(leafPlaces(slide, 1)).toEqual([]);
    expect(leafPlaces(blast, 1)).toEqual([]);
    expect(leafPlaces({ kind: 'arch', w: 56, h: 20 }, 0)).toEqual([]);
  });

  it('drops a blast door from above: its foot rises as it opens', () => {
    expect(leafPlaces(blast, 0)).toEqual([{ x0: -1.2, x1: 1.2, y0: 0, y1: 2.6, lead: 'y0' }]);
    const [leaf] = leafPlaces(blast, 0.5);
    expect(leaf.y0).toBeCloseTo(1.3);
    expect(leaf.y1).toBeCloseTo(2.6);
  });
});

describe('where a body is drawn between the game’s steps', () => {
  it('is drawn between its last two steps, and goes at their pace', () => {
    const track = createTrack();
    track.push(0, { x: 0, y: 0, z: 0, yaw: 0 });
    track.push(STEP, { x: 0.1, y: 0, z: 0, yaw: 0 });
    expect(track.at(0.5).x).toBeCloseTo(0.05);
    expect(track.at(1).x).toBeCloseTo(0.1);
    expect(track.speed()).toBeCloseTo(3);
  });

  it('keeps the pair when the same step is pushed again', () => {
    const track = createTrack();
    track.push(0, { x: 0, y: 0, z: 0, yaw: 0 });
    track.push(STEP, { x: 0.1, y: 0, z: 0, yaw: 0 });
    track.push(STEP, { x: 0.1, y: 0, z: 0, yaw: 0 });
    expect(track.at(0.5).x).toBeCloseTo(0.05);
  });

  it('draws a lift ride or a teleport where it lands, not on the way', () => {
    const track = createTrack();
    track.push(0, { x: 0, y: 0, z: 0, yaw: 0 });
    track.push(STEP, { x: 30, y: -36, z: -40, yaw: 0 });
    expect(track.at(0)).toMatchObject({ x: 30, y: -36, z: -40 });
    expect(track.speed()).toBe(0);
  });

  it('turns the short way round', () => {
    const track = createTrack();
    track.push(0, { x: 0, y: 0, z: 0, yaw: 3.1 });
    track.push(STEP, { x: 0, y: 0, z: 0, yaw: -3.1 });
    expect(Math.abs(track.at(0.5).yaw)).toBeCloseTo(Math.PI, 2);
  });
});
