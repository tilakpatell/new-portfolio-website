import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createSkyFog, skyFogShader } from './skyfog';

const sky = () => ({
  uniforms: {
    uZenith: { value: new THREE.Color('#4060a0') },
    uHorizon: { value: new THREE.Color('#c0d0e0') },
    uBelow: { value: new THREE.Color('#a0a8a0') },
    uHaze: { value: new THREE.Color('#d0d8d8') },
    uHazeK: { value: 0.5 },
    uSunDir: { value: [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0)] },
    uSunColor: { value: [new THREE.Color('#ffffff'), new THREE.Color('#000000')] },
    uSunSize: { value: [new THREE.Vector3(0.01, 1, 1), new THREE.Vector3(0.01, 1, 0)] },
  },
});
const standard = () => ({ vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader });

describe('the fog in the sky’s own colour', () => {
  it('mixes three’s fog toward the sky’s colour along the view, in three’s own shaders', () => {
    for (const lib of ['standard', 'lambert', 'basic']) {
      const out = skyFogShader({ vertexShader: THREE.ShaderLib[lib].vertexShader, fragmentShader: THREE.ShaderLib[lib].fragmentShader }, THREE.ShaderChunk);
      expect(out.swapped).toBe(true);
      expect(out.vertexShader).toContain('vSkyFogDir = transpose(mat3(viewMatrix)) * mvPosition.xyz;');
      expect(out.fragmentShader).toContain('mix( fogColor, skyFogColour( normalize( vSkyFogDir ) ), uSfMix )');
      expect(out.fragmentShader).toContain('vec3 skyFogColour(vec3 dir)');
      // (its thickness is three's: the same exp² as before)
      expect(out.fragmentShader).toContain('fogDensity * fogDensity * vFogDepth * vFogDepth');
    }
  });

  it('leaves a shader without fog, or one whose fog three has changed, alone', () => {
    const none = { vertexShader: 'void main() {}', fragmentShader: 'void main() {}' };
    expect(skyFogShader(none, THREE.ShaderChunk).swapped).toBe(false);
    expect(skyFogShader(standard(), { ...THREE.ShaderChunk, fog_fragment: 'something else' }).swapped).toBe(false);
  });

  it('reads the dome’s very uniforms, so the fog is always the sky’s colour', () => {
    const s = sky();
    const fog = createSkyFog(s, THREE.ShaderChunk);
    const m = new THREE.MeshStandardMaterial();
    fog.patch(m);
    const sh = { ...standard(), uniforms: {} };
    m.onBeforeCompile(sh);
    expect(sh.uniforms.uSfHorizon).toBe(s.uniforms.uHorizon);
    expect(sh.uniforms.uSfSunDir).toBe(s.uniforms.uSunDir);
    expect(sh.uniforms.uSfMix.value).toBe(1);
    fog.indoors(true);
    expect(sh.uniforms.uSfMix.value).toBe(0);
  });

  it('patches each material once, under its own cache key, after any hook already on it', () => {
    const fog = createSkyFog(sky(), THREE.ShaderChunk);
    const m = new THREE.MeshLambertMaterial();
    const seen = [];
    m.onBeforeCompile = () => seen.push('before');
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), m));
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), [m, m]));
    fog.scene(root);
    fog.scene(root);
    m.onBeforeCompile({ vertexShader: THREE.ShaderLib.lambert.vertexShader, fragmentShader: THREE.ShaderLib.lambert.fragmentShader, uniforms: {} });
    expect(seen).toEqual(['before']);
    expect(m.customProgramCacheKey().endsWith('|skyfog')).toBe(true);
  });

  it('passes over what asks for no fog (the sky dome itself)', () => {
    const fog = createSkyFog(sky(), THREE.ShaderChunk);
    const dome = new THREE.ShaderMaterial({ fog: false });
    const sea = new THREE.ShaderMaterial({ fog: true });
    fog.patch(dome);
    fog.patch(sea);
    expect(dome.userData.skyFog).toBeUndefined();
    expect(sea.userData.skyFog).toBe(true);
  });
});
