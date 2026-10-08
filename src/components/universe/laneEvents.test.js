import { describe, expect, it } from 'vitest';
import { AHEAD, WELL, ahead, ambushStep, offRamp } from './laneEvents';
import { LANES, carriageway, laneAt, nodeById } from './hyperlanes';
import { bezier } from './lanes';

const lane = LANES.find((l) => l.length > 4000);
const ride = (over = {}) => ({ lane, way: 'out', s: 0.2, off: [0, 0], speed: 1200, ...over });
const apart = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('the lane events’ places', () => {
  it('keeps the spec’s distances: the capital ship 600 ahead, the jam 900', () => {
    expect(AHEAD.interdiction).toBe(600);
    expect(AHEAD.lanejam).toBe(900);
    expect(WELL).toBeGreaterThan(2);
  });

  it('finds the point a distance on along the ride, in the carriageway, the way it goes', () => {
    for (const way of ['out', 'in']) {
      const r = ride({ way });
      const now = bezier(carriageway(lane, way), r.s);
      const on = ahead(r, 600);
      expect(on.s).toBeGreaterThan(r.s);
      expect(Math.abs(apart(on.at, now) - 600)).toBeLessThan(60);
      const at = laneAt(...on.at);
      expect(at?.lane).toBe(lane);
      expect(at?.way).toBe(way);
    }
    // (past the lane's end, nowhere)
    expect(ahead(ride({ s: 0.99 }), 900)).toBeNull();
  });

  it('knows the off-ramp: the node at the end of the way it’s going', () => {
    expect(offRamp(ride())).toBe(nodeById(lane.to));
    expect(offRamp(ride({ way: 'in' }))).toBe(nodeById(lane.from));
  });

  it('springs the ambush coming off at its node, waits while the ride’s still for it, and gives up otherwise', () => {
    const node = offRamp(ride());
    const near = { x: node.at[0] + 30, y: node.at[1], z: node.at[2] };
    const far = { x: node.at[0] + 3000, y: node.at[1], z: node.at[2] };
    expect(ambushStep({ node }, ride(), near)).toBe('wait');
    expect(ambushStep({ node }, null, near)).toBe('spring');
    expect(ambushStep({ node }, null, far)).toBe('gone');
    // (on, onto another lane through the junction: they missed you)
    const other = LANES.find((l) => l.from !== lane.to && l.to !== lane.to);
    expect(ambushStep({ node }, { ...ride(), lane: other }, near)).toBe('gone');
  });
});
