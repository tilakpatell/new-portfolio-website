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

  it('every flash in one draw, however many land at once', () => {
    const scene = new THREE.Scene();
    const draw = createBoltMeshes(scene, { pool: 4, flashes: 6, look: null });
    for (let i = 0; i < 9; i++) draw.flash([i, 0, 0]);
    draw.update(0.01);
    expect(draw.flashes.isInstancedMesh).toBe(true);
    expect(draw.flashes.count).toBe(6);
    // and gone once they've cooled
    draw.update(0.5);
    expect(draw.flashes.count).toBe(0);
    draw.dispose();
  });

  it('takes the game’s burst for its flash when it has the sheet, its own soft disc when not', () => {
    const own = createBoltMeshes(new THREE.Scene(), { look: null });
    expect(own.flashes.material.uniforms.uHasMap.value).toBe(0);
    const tex = new THREE.Texture();
    tex.userData.look = { name: 'impact', grid: [1, 1], channels: { burst: 'g' } };
    const game = createBoltMeshes(new THREE.Scene(), { look: null });
    game.setLook({ burst: tex, ramp: null });
    expect(game.flashes.material.uniforms.uHasMap.value).toBe(1);
    expect(game.flashes.material.uniforms.uMap.value).toBe(tex);
    // the burst's rays are the sheet's green
    expect(game.flashes.material.uniforms.uChan.value.toArray()).toEqual([0, 1, 0, 0]);
  });
});
