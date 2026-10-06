import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createTrail } from './trail';

// how far the drawn plume reaches back from the nozzle: the farthest point
// of its middle line on a stretch that is still alight (the light runs on
// down to a point that's out, as the GPU blends between them)
const reachOf = (trail, nozzle) => {
  const geo = trail.mesh.children[0].geometry;
  const pos = geo.attributes.position.array;
  const fade = geo.attributes.aFade.array;
  let far = 0;
  for (let i = 0; i < pos.length / 6; i++) {
    if (fade[i * 2] <= 0 && !(i > 0 && fade[(i - 1) * 2] > 0)) continue;
    const x = (pos[i * 6] + pos[i * 6 + 3]) / 2;
    const y = (pos[i * 6 + 1] + pos[i * 6 + 4]) / 2;
    const z = (pos[i * 6 + 2] + pos[i * 6 + 5]) / 2;
    far = Math.max(far, Math.hypot(x - nozzle.x, y - nozzle.y, z - nozzle.z));
  }
  return far;
};

// fly the nozzle along −z at `speed`, frame by frame; the plume's reach each frame
const fly = ({ speed, dts, length = 0.3, life = 0.4, stretch = 1 }) => {
  const trail = createTrail({ length, life });
  trail.setColors('#ff6a36', '#fff0dc');
  const nozzle = new THREE.Vector3();
  const camera = new THREE.Vector3(0, 0.6, 2.4);
  let t = 0;
  const reaches = [];
  for (const dt of dts) {
    t += dt;
    nozzle.z -= speed * dt;
    camera.z -= speed * dt;
    trail.update(dt, t, nozzle, 1, camera, stretch);
    reaches.push(reachOf(trail, nozzle));
  }
  trail.dispose();
  return reaches;
};

describe('an engine’s plume', () => {
  it('holds one flame’s length at the galaxy’s boost, whatever the frame rate does', () => {
    // 120 fps, then a few uneven frames: a sample every other frame or so,
    // each further back than the flame is long
    const dts = [...Array(60).fill(1 / 120), ...Array(30).fill(0).map((_, i) => (i % 3 ? 1 / 120 : 1 / 50))];
    const reaches = fly({ speed: 120, dts, length: 0.3, stretch: 2 }).slice(20);
    for (const r of reaches) expect(r).toBeGreaterThan(0.3 * 2 * 0.9);
    for (const r of reaches) expect(r).toBeLessThanOrEqual(0.3 * 2 + 1e-4);
  });

  it('is as long as it has flown when it’s only just set off', () => {
    const reaches = fly({ speed: 2, dts: Array(6).fill(1 / 60), length: 0.3 });
    const last = reaches.at(-1);
    expect(last).toBeGreaterThan(0.15);
    expect(last).toBeLessThanOrEqual(0.3 + 1e-4);
  });

  it('runs to its full length at cruise, and no further', () => {
    const reaches = fly({ speed: 5.5, dts: Array(90).fill(1 / 60), length: 0.3 }).slice(40);
    for (const r of reaches) {
      expect(r).toBeGreaterThan(0.3 * 0.9);
      expect(r).toBeLessThanOrEqual(0.3 + 1e-4);
    }
  });
});
