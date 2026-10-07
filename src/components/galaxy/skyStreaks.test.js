import { describe, expect, it } from 'vitest';
import { createSkyStreaks } from './skyStreaks';
import { STREAKS, laneLinks } from './skyTraffic';

const seeded = (seed = 9) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

describe('createSkyStreaks', () => {
  it('draws every streak in one mesh, and nothing in a backwater', () => {
    const s = createSkyStreaks({ rand: seeded() });
    expect(s.group.children).toHaveLength(1);
    const mesh = s.group.children[0];
    s.update(1 / 60);
    expect(mesh.visible).toBe(false);
    s.setSystem(laneLinks('coruscant'), 60);
    for (let i = 0; i < 300; i++) {
      s.update(1 / 60);
      expect(mesh.visible).toBe(true);
      expect(s.live).toBeGreaterThanOrEqual(STREAKS.min);
      expect(mesh.geometry.drawRange.count).toBe(s.live * 6);
    }
    s.setSystem(laneLinks('dagobah'), 60);
    s.update(1 / 60);
    expect(mesh.visible).toBe(false);
    expect(s.live).toBe(0);
    s.dispose();
  });
});
