import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ATMO, SHELL_FRAG, atmosphereParams, createAtmosphere } from './atmosphere';
import { NOISE } from './noiseGlsl';
import * as body from '../../components/galaxy/bodyShaders';

describe('the atmosphere shell', () => {
  it('turns an air description into the shell’s uniforms', () => {
    const p = atmosphereParams({ colour: '#a6ccff', density: 2.2, top: 1.065, falloff: 3.5, glow: 0.8 });
    expect(p.uAtmoP.toArray()).toEqual([1.065, 3.5, 2.2, 0.8]);
    const want = new THREE.Color('#a6ccff');
    expect(p.uAtmo.r).toBeCloseTo(want.r, 6);
    expect(p.uAtmo.b).toBeCloseTo(want.b, 6);
    // (the defaults: a little falloff and a forward glow, a warm sunset)
    const d = atmosphereParams({ colour: '#ffffff' });
    expect(d.uAtmoP.toArray()).toEqual([1.06, 3.5, 2, 0.8]);
    expect(d.uSunset.getHexString()).toBe(new THREE.Color('#ffa070').getHexString());
  });

  it('a shell with one sun has a black second slot', () => {
    const a = createAtmosphere({ radius: 10, colour: '#9fc4ff', suns: [{ dir: [0, 1, 0], colour: '#ffffff' }] });
    const u = a.mesh.material.uniforms;
    expect(u.uSunDir.value[0].toArray()).toEqual([0, 1, 0]);
    expect(u.uSunCol.value[1].getHex()).toBe(0);
    a.set({ suns: [{ dir: [1, 0, 0], colour: [1, 0.5, 0.25] }, { dir: [0, 0, 1], colour: '#ff0000' }], strength: 1.5 });
    expect(u.uSunDir.value[1].toArray()).toEqual([0, 0, 1]);
    expect(u.uSunCol.value[0].toArray()).toEqual([1, 0.5, 0.25]);
    expect(u.uStrength.value).toBe(1.5);
    a.dispose();
  });

  it('marches the steps it is told, the galaxy’s seven by default', () => {
    expect(createAtmosphere({ radius: 1, colour: '#ffffff', steps: 5 }).mesh.material.defines.STEPS).toBe(5);
    expect(createAtmosphere({ radius: 1, colour: '#ffffff' }).mesh.material.defines.STEPS).toBe(7);
    expect(ATMO).toContain('STEPS');
    expect(SHELL_FRAG).toContain('inscatter');
  });

  it('is what the galaxy’s bodies draw with (moved, not copied)', () => {
    expect(body.NOISE).toBe(NOISE);
    expect(body.ATMO).toBe(ATMO);
    expect(body.SHELL_FRAG).toBe(SHELL_FRAG);
  });

  it('can share a body’s uniforms, so the ground and its air read the same sun', () => {
    const shared = { uSunDir: { value: [new THREE.Vector3(0, 1, 0), new THREE.Vector3()] } };
    const a = createAtmosphere({ radius: 1, colour: '#ffffff', uniforms: shared });
    expect(a.mesh.material.uniforms.uSunDir).toBe(shared.uSunDir);
  });
});
