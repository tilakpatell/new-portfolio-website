import { describe, expect, it } from 'vitest';
import { antiTileShader } from './surface';

// three's chunks as this version has them (the lines the rewrite looks for)
const CHUNKS = {
  map_fragment: '#ifdef USE_MAP\n\tvec4 sampledDiffuseColor = texture2D( map, vMapUv );\n\tdiffuseColor *= sampledDiffuseColor;\n#endif\n',
  roughnessmap_fragment: 'float roughnessFactor = roughness;\n#ifdef USE_ROUGHNESSMAP\n\tvec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );\n\troughnessFactor *= texelRoughness.g;\n#endif\n',
  metalnessmap_fragment: 'float metalnessFactor = metalness;\n#ifdef USE_METALNESSMAP\n\tvec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );\n\tmetalnessFactor *= texelMetalness.b;\n#endif\n',
  aomap_fragment: '#ifdef USE_AOMAP\n\tfloat ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;\n\treflectedLight.indirectDiffuse *= ambientOcclusion;\n#endif\n',
  normal_fragment_maps: '#ifdef USE_NORMALMAP_OBJECTSPACE\n#elif defined( USE_NORMALMAP_TANGENTSPACE )\n\tvec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;\n\tmapN.xy *= normalScale;\n\tnormal = normalize( tbn * mapN );\n#endif\n',
};

const SHADER = {
  vertexShader: '#include <common>\nvoid main() {\n#include <begin_vertex>\n#include <worldpos_vertex>\n}',
  fragmentShader: '#include <common>\nvoid main() {\n#include <clipping_planes_fragment>\n#include <map_fragment>\n#include <roughnessmap_fragment>\n#include <metalnessmap_fragment>\n#include <normal_fragment_maps>\n#include <aomap_fragment>\n}',
};

describe('breaking a tiled surface up in the shader', () => {
  it('blends every map it knows with one weight', () => {
    const out = antiTileShader(SHADER, {}, CHUNKS);
    expect(out.blended).toEqual({ map: true, roughness: true, metalness: true, ao: true, normal: true });
    expect(out.fragmentShader).toContain('float atW = ');
    expect(out.fragmentShader).toContain('atMix( map, vMapUv, atW )');
    expect(out.fragmentShader).toContain('atMix( roughnessMap, vRoughnessMapUv, atW )');
    expect(out.fragmentShader).toContain('atUv2( vAoMapUv )');
    expect(out.fragmentShader).toContain('atUv2( vNormalMapUv )');
    expect(out.fragmentShader).not.toContain('#include <map_fragment>');
    expect(out.vertexShader).toContain('vAtPos = (modelMatrix * atp).xyz');
  });

  it('reads its noise off the plane the surface lies in', () => {
    expect(antiTileShader(SHADER, { axis: 'xz' }, CHUNKS).fragmentShader).toContain('atNoise(vAtPos.xz * uAtFreq)');
    expect(antiTileShader(SHADER, { axis: 'xy' }, CHUNKS).fragmentShader).toContain('atNoise(vAtPos.xy * uAtFreq)');
    expect(antiTileShader(SHADER, { axis: 'nonsense' }, CHUNKS).fragmentShader).toContain('atNoise(vAtPos.xz * uAtFreq)');
  });

  it('adds the detail normal only when asked', () => {
    expect(antiTileShader(SHADER, {}, CHUNKS).fragmentShader).not.toContain('uAtDetail');
    const out = antiTileShader(SHADER, { detail: true }, CHUNKS);
    expect(out.fragmentShader).toContain('uniform sampler2D uAtDetail;');
    expect(out.fragmentShader).toContain('uAtDetailRange');
  });

  it('leaves a map alone when its chunk is not what it expects', () => {
    const out = antiTileShader(SHADER, {}, { ...CHUNKS, map_fragment: 'something else entirely' });
    expect(out.blended.map).toBe(false);
    expect(out.fragmentShader).toContain('#include <map_fragment>');
    expect(out.blended.normal).toBe(true);
  });

  it('works against the chunks three actually ships', async () => {
    const THREE = await import('three');
    const out = antiTileShader(SHADER, { detail: true }, THREE.ShaderChunk);
    expect(out.blended).toEqual({ map: true, roughness: true, metalness: true, ao: true, normal: true });
  });
});
