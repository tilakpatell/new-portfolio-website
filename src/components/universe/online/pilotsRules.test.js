import { describe, expect, it } from 'vitest';
import { DRAW, howToDraw } from './pilotsRules';
import { LANES, carriageway, laneAt } from '../hyperlanes';
import { bezier } from '../lanes';

// a pose where they are, riding or not
const pose = (x, y, z, lane = false) => ({ x, y, z, lane });
// halfway along the first trunk lane's outbound carriageway: on a lane
const trunk = LANES.find((l) => l.tier === 'trunk');
const [lx, ly, lz] = bezier(carriageway(trunk, 'out'), 0.5);

describe('howToDraw', () => {
  it('draws a pilot within DRAW of you as a ship, riding or not', () => {
    expect(DRAW).toBe(3000);
    const me = { x: 0, y: 0, z: 0 };
    expect(howToDraw(pose(100, 0, 0), me, { laneAt })).toBe('ship');
    expect(howToDraw(pose(0, 0, DRAW - 1), me, { laneAt })).toBe('ship');
    expect(howToDraw(pose(lx, ly, lz, true), { x: lx + 500, y: ly, z: lz }, { laneAt })).toBe('ship');
  });
  it('draws one riding a lane beyond it as a streak on the lane', () => {
    expect(laneAt(lx, ly, lz)?.lane.id).toBe(trunk.id); // (the point is on the lane)
    const me = { x: lx + DRAW + 1000, y: ly, z: lz };
    expect(howToDraw(pose(lx, ly, lz, true), me, { laneAt })).toBe('streak');
  });
  it('draws one flying free beyond it as a blip on the chart alone', () => {
    const me = { x: lx + DRAW + 1000, y: ly, z: lz };
    expect(howToDraw(pose(lx, ly, lz, false), me, { laneAt })).toBe('blip'); // (on a lane, but not riding it)
    expect(howToDraw(pose(20000, 0, 20000), { x: 0, y: 0, z: 0 }, { laneAt })).toBe('blip');
  });
  it('never draws a streak for a lane bit without a lane (an old client, or a liar)', () => {
    // (high over the disc, well off every lane)
    const off = pose(20000, 900, 20000, true);
    expect(laneAt(off.x, off.y, off.z)).toBeNull();
    expect(howToDraw(off, { x: 0, y: 0, z: 0 }, { laneAt })).toBe('blip');
  });
  it('treats you as far from everyone when you are not flying', () => {
    expect(howToDraw(pose(1, 0, 0), null, { laneAt })).toBe('blip');
    expect(howToDraw(pose(lx, ly, lz, true), null, { laneAt })).toBe('streak');
  });
});
