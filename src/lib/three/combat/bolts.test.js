import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createBolts } from '../../combat/bolt';
import { createBoltMeshes } from './bolts';

describe('the bolts drawn', () => {
  it('draws one streak for each bolt in the air, behind its head', () => {
    const scene = new THREE.Scene();
    const draw = createBoltMeshes(scene, { pool: 8 });
    const bolts = createBolts({ pool: 8 });
    bolts.fire({ from: [0, 1, 0], dir: [1, 0, 0], colour: '#4aa8ff' });
    bolts.fire({ from: [0, 1, 0], dir: [0, 0, 1] });
    bolts.step(0.1, { solids: () => null, bodies: [], blades: [] });
    draw.sync(bolts.live());
    expect(draw.mesh.count).toBe(2);
    const m = new THREE.Matrix4();
    draw.mesh.getMatrixAt(0, m);
    const at = new THREE.Vector3().setFromMatrixPosition(m);
    expect(at.x).toBeCloseTo(9 - 0.8);
    expect(at.y).toBeCloseTo(1);
    const c = new THREE.Color();
    draw.mesh.getColorAt(0, c);
    expect(c.b).toBeGreaterThan(c.r);
    draw.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it('a fresh bolt’s streak is no longer than it has flown', () => {
    const draw = createBoltMeshes(new THREE.Scene(), { pool: 2 });
    draw.sync([{ pos: [0.2, 1, 0], dir: [1, 0, 0], flown: 0.2, colour: '#ff3b30' }]);
    const m = new THREE.Matrix4();
    draw.mesh.getMatrixAt(0, m);
    const s = new THREE.Vector3();
    m.decompose(new THREE.Vector3(), new THREE.Quaternion(), s);
    expect(s.z).toBeCloseTo(0.2 / 1.6);
  });
});
