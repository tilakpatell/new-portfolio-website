import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ARM_JOINTS } from './arm';
import { bendArm } from './bend';

// a tentacle as Tide3D has one: a tall mesh in a model, turned some way about
// its height inside the group that leans it (whose +x is where it strikes)
const arm = (turn = 0) => {
  const lean = new THREE.Group();
  const model = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2, 0.4), new THREE.MeshStandardMaterial());
  model.add(mesh);
  model.rotation.y = turn;
  model.scale.setScalar(20);
  lean.add(model);
  return { lean, model, mesh };
};
const VERTEX = '#include <common>\nvoid main() {\n#include <beginnormal_vertex>\n#include <begin_vertex>\n}';
const compile = (material) => {
  const shader = { vertexShader: VERTEX, fragmentShader: '', uniforms: {} };
  material.onBeforeCompile(shader);
  return shader;
};

describe('bending a tentacle’s mesh', () => {
  it('bends its vertices and normals in the shader, in its shadow too', () => {
    const { lean, model, mesh } = arm();
    bendArm(model, lean);
    const s = compile(mesh.material);
    expect(s.vertexShader).toContain('armBend(');
    expect(s.vertexShader).toContain('armNormal(');
    expect(s.vertexShader.indexOf('uniform float uArmA')).toBeLessThan(s.vertexShader.indexOf('void main'));
    expect(s.uniforms.uArmA.value).toHaveLength(ARM_JOINTS + 1);
    expect(mesh.material.customProgramCacheKey()).toBe('kraken-arm');
    expect(mesh.customDepthMaterial).toBeInstanceOf(THREE.MeshDepthMaterial);
    const d = compile(mesh.customDepthMaterial);
    expect(d.vertexShader).toContain('armBend(');
    // the shadow's and the body's are the same uniforms
    expect(d.uniforms.uArmA).toBe(s.uniforms.uArmA);
  });

  it('measures the arm along the geometry’s height, from its base', () => {
    const { lean, model, mesh } = arm();
    bendArm(model, lean);
    const u = compile(mesh.material).uniforms.uArmAxis.value;
    expect(u.x).toBeCloseTo(-1); // the base
    expect(u.y).toBeCloseTo(2); // the length
    expect(u.z).toBeCloseTo(0);
    expect(u.w).toBeCloseTo(0);
  });

  it('bends toward where it strikes, however the model is turned', () => {
    for (const turn of [0, 0.7, 2.4, -1.9]) {
      const { lean, model, mesh } = arm(turn);
      bendArm(model, lean);
      const dir = compile(mesh.material).uniforms.uArmDir.value;
      // the geometry's way that, turned as the model is, points along the lean's +x
      const back = new THREE.Vector3(dir.x, 0, dir.y).applyAxisAngle(new THREE.Vector3(0, 1, 0), turn);
      expect(back.x).toBeCloseTo(1, 5);
      expect(back.z).toBeCloseTo(0, 5);
    }
  });

  it('takes the chain’s angles each frame, and frees its shadow’s material', () => {
    const { lean, model, mesh } = arm();
    const b = bendArm(model, lean);
    const u = compile(mesh.material).uniforms;
    const a = new Float32Array(ARM_JOINTS + 1).map((_, i) => i * 0.1);
    b.set({ a, b: a });
    expect(u.uArmA.value[3]).toBeCloseTo(0.3);
    expect(u.uArmB.value[ARM_JOINTS]).toBeCloseTo(ARM_JOINTS * 0.1);
    let freed = false;
    mesh.customDepthMaterial.addEventListener('dispose', () => (freed = true));
    b.dispose();
    expect(freed).toBe(true);
  });
});
