import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DEFAULTS, MAPS, antiTile, antiTileOptions, patchChunk, patchFragment, patchVertex } from './surface';

describe('antiTile', () => {
  it('takes only numbers a shader can use', () => {
    expect(antiTileOptions()).toEqual(DEFAULTS);
    expect(antiTileOptions({ scale: 0.4, strength: 0.3, size: 20 })).toEqual({ scale: 0.4, strength: 0.3, size: 20 });
    expect(antiTileOptions({ scale: 1, strength: 2, size: 0 })).toEqual({ scale: DEFAULTS.scale, strength: 1, size: DEFAULTS.size });
    expect(antiTileOptions({ scale: -1, strength: -1, size: NaN })).toEqual({ scale: DEFAULTS.scale, strength: 0, size: DEFAULTS.size });
  });

  it("routes each map's sample through atSample and leaves the rest", () => {
    for (const m of MAPS) expect(patchChunk(`vec4 t = texture2D( ${m}, v${m}Uv );`)).toBe(`vec4 t = atSample( ${m}, v${m}Uv );`);
    expect(patchChunk('texture2D(map, vMapUv)')).toBe('atSample( map, vMapUv )');
    expect(patchChunk('texture2D( emissiveMap, vEmissiveMapUv )')).toBe('texture2D( emissiveMap, vEmissiveMapUv )');
    expect(patchChunk('texture2D( map, uv )')).toBe('texture2D( map, uv )');
  });

  it("patches three's own chunks, and every map chunk has something to patch", () => {
    for (const name of ['map_fragment', 'normal_fragment_maps', 'roughnessmap_fragment', 'aomap_fragment', 'metalnessmap_fragment']) {
      const src = THREE.ShaderChunk[name];
      expect(src, name).toBeTypeOf('string');
      expect(patchChunk(src), name).not.toBe(src);
    }
  });

  it('adds the world position to the vertex shader before it is projected, once', () => {
    const v = 'void main() {\n\t#include <begin_vertex>\n\t#include <project_vertex>\n}';
    const out = patchVertex(v);
    expect(out.startsWith('varying vec3 vAtWorld;')).toBe(true);
    expect(out.indexOf('vAtWorld = ( modelMatrix * atPos ).xyz;')).toBeLessThan(out.indexOf('#include <project_vertex>'));
    expect(out).toContain('instanceMatrix');
    expect(patchVertex(out)).toBe(out);
  });

  it('expands and patches the map chunks and sets the blend first thing in main', () => {
    const f = 'void main() {\n\t#include <map_fragment>\n\t#include <normal_fragment_maps>\n\t#include <roughnessmap_fragment>\n\t#include <aomap_fragment>\n\t#include <metalnessmap_fragment>\n\t#include <emissivemap_fragment>\n}';
    const out = patchFragment(f, THREE.ShaderChunk);
    expect(out).toContain('vec4 atSample( sampler2D t, vec2 uv )');
    expect(out).toContain('void main() {\n\tatK = atBlend( vAtWorld.xz );');
    for (const m of MAPS) expect(out).toContain(`atSample( ${m}, `);
    expect(out).toContain('#include <emissivemap_fragment>');
    expect(out).not.toMatch(/#include <(map_fragment|normal_fragment_maps|roughnessmap_fragment|aomap_fragment|metalnessmap_fragment)>/);
    expect(patchFragment(out, THREE.ShaderChunk)).toBe(out);
  });

  it('patches a material once, keeps its own onBeforeCompile, and gives it a cache key of its own', () => {
    const calls = [];
    const mat = new THREE.MeshStandardMaterial();
    mat.onBeforeCompile = (shader) => calls.push(shader.fragmentShader.length);
    const plainKey = new THREE.MeshStandardMaterial().customProgramCacheKey();
    expect(antiTile(mat, { scale: 0.3 })).toBe(mat);
    expect(mat.userData.antiTile.atScale.value).toBe(0.3);
    expect(mat.customProgramCacheKey()).not.toBe(plainKey);
    expect(mat.customProgramCacheKey()).toContain('antiTile');
    const other = antiTile(new THREE.MeshStandardMaterial());
    expect(other.customProgramCacheKey()).not.toBe(mat.customProgramCacheKey());
    const shader = { uniforms: {}, vertexShader: 'void main() {\n\t#include <project_vertex>\n}', fragmentShader: 'void main() {\n\t#include <map_fragment>\n}' };
    mat.onBeforeCompile(shader, null);
    expect(calls).toEqual([shader.fragmentShader.length > 0 ? calls[0] : -1]);
    expect(shader.uniforms.atScale.value).toBe(0.3);
    expect(shader.vertexShader).toContain('vAtWorld');
    expect(shader.fragmentShader).toContain('atSample( map, vMapUv )');
    antiTile(mat, { scale: 0.9 });
    expect(mat.userData.antiTile.atScale.value).toBe(0.3);
    expect(antiTile(null)).toBeNull();
  });
});
