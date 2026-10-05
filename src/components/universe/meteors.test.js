import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createMeteors, stormPlan } from './meteors';

const seeded = (seed = 1) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

describe('a meteor storm', () => {
  it('is a stream of rocks along its lane, all going its way, none on top of another, each a size', () => {
    const lane = [
      [-70, 2, 60],
      [70, 2, 60],
    ];
    const rocks = stormPlan(lane, seeded(4), 24);
    expect(rocks).toHaveLength(24);
    for (const r of rocks) {
      // along the lane's first stretch, scattered a little across and up
      expect(r.at[0]).toBeGreaterThanOrEqual(-70 - 4);
      expect(r.at[0]).toBeLessThanOrEqual(-70 + 40 + 4);
      expect(Math.abs(r.at[2] - 60)).toBeLessThanOrEqual(4);
      expect(Math.abs(r.at[1] - 2)).toBeLessThanOrEqual(3);
      // moving the lane's way, 12 to 16 a second
      const speed = Math.hypot(...r.vel);
      expect(speed).toBeGreaterThanOrEqual(12);
      expect(speed).toBeLessThanOrEqual(16);
      expect(r.vel[0] / speed).toBeGreaterThan(0.99);
      expect(r.size).toBeGreaterThanOrEqual(0.25);
      expect(r.size).toBeLessThanOrEqual(0.7);
    }
    for (const a of rocks) for (const b of rocks) if (a !== b) expect(Math.hypot(a.at[0] - b.at[0], a.at[1] - b.at[1], a.at[2] - b.at[2])).toBeGreaterThan(a.size + b.size);
  });

  it('hits the ship it tunnels through between two frames, and frees its draw when disposed', () => {
    const parent = new THREE.Group();
    const m = createMeteors(parent, { small: true });
    // a stream across a ship's path far out in the open, so a lane is found
    const ship = { x: 2000, y: 100, z: -1500, heading: 2.2, speed: 0 };
    let seed = 8;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    expect(m.storm(ship, rand)).toBe(true);
    const rock = m.targets[0];
    // the ship a frame before: well short of the rock; a frame on: well past it, straight through
    const before = { x: rock.at.x, y: rock.at.y, z: rock.at.z + 3 };
    m.update(1 / 60, before);
    const after = { x: rock.at.x, y: rock.at.y, z: rock.at.z - 3 };
    const events = m.update(1 / 60, after);
    expect(events.map((e) => e.type)).toContain('meteor');
    expect(m.count).toBeLessThan(m.targets.length + 1);
    const mesh = parent.children.find((o) => o.name === 'meteors');
    let freed = false;
    mesh.dispose = () => (freed = true);
    m.dispose();
    expect(freed).toBe(true);
    expect(parent.children).toHaveLength(0);
  });
});
