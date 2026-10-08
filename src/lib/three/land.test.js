import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createLandMaterial, landShader } from './land';
import { createLandMap } from './landmap';
import { landSpec } from '../land/spec';

const LAMBERT = { vertexShader: THREE.ShaderChunk.meshlambert_vert, fragmentShader: THREE.ShaderChunk.meshlambert_frag };
const TRACKS = { glsl: 'uniform sampler2D uTracks;\nvec4 tracksAt(vec2 xz) { return vec4(0.0); }', uniforms: { uTracks: { value: null } } };

describe('landShader', () => {
  it('colours the ground from the land map, by its slope and height', () => {
    const out = landShader(LAMBERT);
    expect(out.swapped).toBe(true);
    expect(out.fragmentShader).toContain('landColour(');
    expect(out.fragmentShader).toContain('landMask(vLandXz)');
    expect(out.vertexShader).toContain('vLandXz =');
    expect(out.fragmentShader).not.toContain('tracksAt(');
  });

  it('knocks the grass down under the tracks, when it has them', () => {
    const out = landShader(LAMBERT, { tracks: TRACKS });
    expect(out.fragmentShader).toContain('tracksAt(vLandXz)');
    expect(out.fragmentShader).toContain('vec4 tracksAt(vec2 xz)');
  });

  it('leaves a shader without its lines alone', () => {
    expect(landShader({ vertexShader: 'void main(){}', fragmentShader: 'void main(){}' }).swapped).toBe(false);
  });
});

describe('createLandMaterial', () => {
  it('is a Lambert patched once with the map’s uniforms', () => {
    const map = createLandMap({ radius: 1, palette: landSpec(1).palette });
    const m = createLandMaterial({ map, tracks: TRACKS });
    expect(m).toBeInstanceOf(THREE.MeshLambertMaterial);
    const sh = { uniforms: {}, ...LAMBERT };
    m.onBeforeCompile(sh);
    expect(sh.uniforms.uLandMasks).toBe(map.uniforms.uLandMasks);
    expect(sh.uniforms.uTracks).toBe(TRACKS.uniforms.uTracks);
    expect(sh.fragmentShader).toContain('tracksAt(vLandXz)');
    expect(m.customProgramCacheKey()).toContain('land');
    map.dispose();
  });
});
