import { describe, expect, it } from 'vitest';
import { readEntry } from './entry';
import { createSky, skyUniforms } from './sky';
import hoth from './fixtures/hoth.ve.json';

describe('createSky', () => {
  it('a node material whose uniforms are the record’s scattering and sun', async () => {
    const sky = await createSky(hoth.sunny);
    const p = readEntry(hoth.sunny);
    expect(sky.material.isNodeMaterial).toBe(true);
    expect(sky.material.colorNode).toBeTruthy();
    expect(sky.uniforms.betaR.value.z).toBeCloseTo(3e-5);
    expect(sky.uniforms.betaM.value).toBe(0);
    expect(sky.uniforms.mieG.value).toBe(0.785);
    expect(sky.uniforms.heightR.value).toBe(8000);
    expect(sky.uniforms.luminance.value).toBeCloseTo(p.sky.luminance);
    expect(sky.uniforms.sunDir.value.y).toBeCloseTo(p.sun.dir[1]);
    expect(sky.mesh.frustumCulled).toBe(false);
    sky.set(readEntry(hoth.sunset));
    expect(sky.uniforms.sunColor.value.g).toBeCloseTo(0.28355);
    sky.update({ position: { x: 1, y: 2, z: 3 }, far: 500 });
    expect(sky.mesh.position.y).toBe(2);
    expect(sky.mesh.scale.x).toBe(450);
    sky.dispose();
  });
  it('skyUniforms copies, never shares, the entry’s arrays', () => {
    const p = readEntry(hoth.sunny);
    const u = skyUniforms(p);
    u.betaR[0] = 1;
    expect(p.sky.rayleigh[0]).toBe(1e-5);
  });
});
