import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createLivery } from './livery';

const FIT = { mid: 0.4, marks: [0.5, 0.7], keep: 0.04 };
// what three hands a MeshStandardMaterial's onBeforeCompile
const compiled = (m) => {
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  m.onBeforeCompile(shader);
  return shader;
};

describe('the livery’s rim', () => {
  it('a painted material has the rim’s uniforms, and its light on its edges', () => {
    const m = new THREE.MeshStandardMaterial();
    const root = new THREE.Mesh(new THREE.BoxGeometry(), m);
    createLivery().apply(root, FIT);
    const shader = compiled(m);
    expect(shader.uniforms.uRimStrength.value).toBe(0.5);
    expect(shader.uniforms.uRimColour.value.isColor).toBe(true);
    expect(shader.uniforms.uRimDir.value.isVector3).toBe(true);
    expect(shader.fragmentShader).toContain('uRimColour * uRimStrength * edge');
    // (the paint is still there: the rim is another line, not a new hook)
    expect(shader.fragmentShader).toContain('paintOn');
  });

  it('rim writes its light and leaves the paint alone', () => {
    const m = new THREE.MeshStandardMaterial();
    const livery = createLivery();
    livery.apply(new THREE.Mesh(new THREE.BoxGeometry(), m), FIT);
    livery.set({ hull: '#336699', trim: '#ffcc00' });
    const shader = compiled(m);
    const hull = shader.uniforms.paintHull.value.clone();
    const on = shader.uniforms.paintOn.value;
    livery.rim({ colour: [0.2, 0.3, 0.9], dir: [0, 0, 1] });
    expect(shader.uniforms.uRimColour.value.toArray()).toEqual([0.2, 0.3, 0.9]);
    expect(shader.uniforms.uRimDir.value.toArray()).toEqual([0, 0, 1]);
    livery.rim({ colour: new THREE.Color(1, 0.5, 0), dir: new THREE.Vector3(1, 0, 0) });
    expect(shader.uniforms.uRimColour.value.toArray()).toEqual([1, 0.5, 0]);
    expect(shader.uniforms.paintHull.value.equals(hull)).toBe(true);
    expect(shader.uniforms.paintOn.value).toBe(on);
  });
});
