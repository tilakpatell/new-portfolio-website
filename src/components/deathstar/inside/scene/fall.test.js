// What a falling body lands on aboard: the deck under it, never a wall, and
// nothing at all over a void.
import { describe, expect, it } from 'vitest';
import { buildLayout } from '../rules/layout';
import { STATIONS } from '../rules/stations';
import { colliderFor } from './fall';

const layout = buildLayout(STATIONS.ds1);

describe('colliderFor', () => {
  const bay = layout.rooms.get('bay327');
  it('lifts a point that has sunk into the deck back onto it, and says it is down', () => {
    const at = { x: bay.x, z: bay.z + 6 };
    const collide = colliderFor(layout, { room: 'bay327', at });
    const p = { x: at.x, y: bay.y - 0.05, z: at.z };
    expect(collide(p, 0.1)).toBe(true);
    expect(p.y).toBeCloseTo(layout.floorAt('bay327', at.x, at.z) + 0.1);
    // (and one in the air is left falling)
    const q = { x: at.x, y: bay.y + 1, z: at.z };
    expect(collide(q, 0.1)).toBe(false);
    expect(q.y).toBe(bay.y + 1);
  });

  it('pushes a point out of a wall it fell against, onto the room’s side', () => {
    const corr = layout.rooms.get('corr327');
    const wall = layout.walls.find((w) => w.room === 'corr327' && !w.door && Math.hypot(w.x1 - w.x0, w.z1 - w.z0) > 2);
    const mid = { x: (wall.x0 + wall.x1) / 2, z: (wall.z0 + wall.z1) / 2 };
    const collide = colliderFor(layout, { room: 'corr327', at: mid });
    const p = { x: mid.x, y: corr.y + 1, z: mid.z };
    collide(p, 0.12);
    expect(Math.hypot(p.x - mid.x, p.z - mid.z)).toBeCloseTo(0.12, 3);
    // (the corridor's side: where the room says it is)
    expect(layout.roomAt(p.x, corr.y + 1, p.z)).toBe('corr327');
  });

  it('gives nothing to stand on over the magnetic field’s void', () => {
    const field = layout.rooms.get('field327');
    const at = { x: field.x, z: field.z };
    const collide = colliderFor(layout, { room: 'field327', at });
    const p = { x: at.x, y: field.y - 0.01, z: at.z };
    expect(collide(p, 0.1)).toBe(false);
  });
});
