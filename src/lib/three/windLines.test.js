import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createWindLines, windLineCurve } from './windLines';
import { createWind } from './wind';

describe('windLineCurve', () => {
  it('runs 10 m in 30 divisions, zigzagging half a metre', () => {
    const pts = windLineCurve(3);
    expect(pts).toHaveLength(31);
    const span = Math.hypot(pts[30].x - pts[0].x, pts[30].z - pts[0].z);
    expect(span).toBeGreaterThan(9);
    expect(span).toBeLessThan(11);
    for (const p of pts) expect(Math.abs(p.z)).toBeLessThanOrEqual(0.75);
  });
});

describe('createWindLines', () => {
  it('spawns his four round the focus, at the wind’s angle', () => {
    const wind = createWind({ strength: 0.6, angle: 0.6 * Math.PI });
    const lines = createWindLines({ wind, count: 4 });
    expect(lines.group).toBeInstanceOf(THREE.Group);
    expect(lines.group.children).toHaveLength(4);
    for (let i = 0; i < 600; i++) lines.update(1 / 60, { x: 30, z: -10 });
    const live = lines.group.children.filter((m) => m.visible);
    expect(live.length).toBeGreaterThan(0);
    for (const m of live) {
      expect(Math.abs(m.position.x - 30)).toBeLessThan(40);
      expect(m.position.y).toBeCloseTo(2, 0);
    }
    lines.dispose();
    wind.dispose();
  });
});
