import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { complement, createLivery } from './livery';

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

const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

describe('the hull’s light ratio', () => {
  it('complement turns a warm key bluish at the same luminance', () => {
    const c = complement([1, 0.6, 0.3]);
    expect(c[2]).toBeGreaterThan(c[0]);
    expect(Math.abs(lum(c) - lum([1, 0.6, 0.3])) / lum([1, 0.6, 0.3])).toBeLessThan(0.05);
  });

  it('complement of a white key is a grey of its luminance, not black', () => {
    const c = complement([2, 2, 2]);
    expect(c[0]).toBeCloseTo(c[2], 6);
    expect(lum(c)).toBeCloseTo(2, 4);
  });

  it('with a key, the rim is half the fill and half the key’s complement', () => {
    const m = new THREE.MeshStandardMaterial();
    const livery = createLivery();
    livery.apply(new THREE.Mesh(new THREE.BoxGeometry(), m), FIT);
    const shader = compiled(m);
    const fill = [0.2, 0.3, 0.9];
    const key = [1, 0.6, 0.3];
    livery.rim({ colour: fill, dir: [0, 0, 1], key: new THREE.Color(...key) });
    const c = complement(key);
    const got = shader.uniforms.uRimColour.value.toArray();
    fill.forEach((f, i) => expect(got[i]).toBeCloseTo((f + c[i]) / 2, 5));
    // (without a key, the fill's colour as it always was)
    livery.rim({ colour: fill, dir: [0, 0, 1] });
    expect(shader.uniforms.uRimColour.value.toArray()).toEqual(fill);
  });

  it('the rim is half strength and the fill 0.6, the fill found by its direction', () => {
    const m = new THREE.MeshStandardMaterial();
    createLivery().apply(new THREE.Mesh(new THREE.BoxGeometry(), m), FIT);
    const shader = compiled(m);
    expect(shader.uniforms.uRimStrength.value).toBe(0.5);
    expect(shader.uniforms.uFillScale.value).toBe(0.6);
    // the scale goes on the light the rim comes from, as its info is read
    // in the loop, which is left for other hooks to find
    expect(shader.fragmentShader).toMatch(/#include <lights_pars_begin>[\s\S]*il\.color \*= uFillScale[\s\S]*#define getDirectionalLightInfo/);
    expect(shader.fragmentShader).toContain('#include <lights_fragment_begin>');
  });

  it('the paint still reads its texel before the light is touched', () => {
    const m = new THREE.MeshStandardMaterial();
    createLivery().apply(new THREE.Mesh(new THREE.BoxGeometry(), m), FIT);
    const f = compiled(m).fragmentShader;
    expect(f.indexOf('paintOn > 0.0')).toBeLessThan(f.indexOf('#include <lights_fragment_begin>'));
  });

  it('a mesh marked noPaint is left alone', () => {
    const m = new THREE.MeshStandardMaterial();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), m);
    mesh.userData.noPaint = true;
    createLivery().apply(mesh, FIT);
    expect(m.userData.painted).toBeUndefined();
    const shader = { uniforms: {}, vertexShader: '', fragmentShader: THREE.ShaderLib.standard.fragmentShader };
    m.onBeforeCompile(shader);
    expect(shader.uniforms.uFillScale).toBeUndefined();
  });
});
