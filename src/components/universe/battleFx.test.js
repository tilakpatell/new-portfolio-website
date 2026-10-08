import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MARK, createBoltDraw, fitPx } from './battleFx';

describe('the bolts', () => {
  it('are drawn on along their way by the time the battle’s step still owes', () => {
    const parent = new THREE.Group();
    const draw = createBoltDraw(parent, { count: 4 });
    const bolt = { on: true, team: 0, kind: 'laser', x: 0, y: 0, z: 0, vx: 60, vy: 0, vz: 0 };
    const at = () => {
      const mesh = parent.children.find((o) => o.isInstancedMesh);
      const m = new THREE.Matrix4();
      mesh.getMatrixAt(0, m);
      return new THREE.Vector3().setFromMatrixPosition(m).x;
    };
    draw.sync([bolt], () => [1, 1, 1]);
    const still = at();
    draw.sync([bolt], () => [1, 1, 1], null, 0.01);
    expect(at() - still).toBeCloseTo(0.6, 6);
    draw.dispose();
  });
});

describe('the objective markers', () => {
  it('shrink a name to fit the card, never past the smallest that reads', () => {
    expect(fitPx(200, 244)).toBe(20); // (fits as it is)
    expect(fitPx(300, 244)).toBe(16); // ('Destroy: Shield generator' at 20px is about 300 wide)
    expect(fitPx(1000, 244)).toBe(12);
  });

  it('are wide enough for the longest name at its full size', () => {
    // (a monospace 20px is about 12px a letter)
    expect(MARK.w - 2 * MARK.pad).toBeGreaterThanOrEqual('Destroy: Shield generator'.length * 12);
  });
});
