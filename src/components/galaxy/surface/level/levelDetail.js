// The game's detail normals on a level's materials (lane E0; the pack's
// detail.json, scripts/lib/bf2017-level-detail.mjs): a second, tiling
// normal map added to the material's own in tangent space, at the game's
// tiling and strength, on high and ultra. The classic renderer's materials
// take it through onBeforeCompile; the node renderer's ignore that hook, so
// there it is simply not drawn (a duller surface, never a fault). A
// material without a normal map is left alone.
//
//   wantsDetail(tier, renderer) → bool
//   addDetail(material, { map, tiling: [u, v], strength })
//   detailShader(shader) → the shader with the detail added (pure: the test's)

import * as THREE from 'three';

export const wantsDetail = (tier, renderer) => (tier === 'high' || tier === 'ultra') && !renderer?.isWebGPURenderer;

const PARS = /* glsl */ `
uniform sampler2D uDetailNormal;
uniform vec2 uDetailTiling;
uniform float uDetailStrength;
`;
const ADD = /* glsl */ `mapN.xy *= normalScale;
	mapN.xy += ( texture2D( uDetailNormal, vNormalMapUv * uDetailTiling ).xy * 2.0 - 1.0 ) * uDetailStrength;`;

export function detailShader(shader) {
  const maps = THREE.ShaderChunk.normal_fragment_maps.replace('mapN.xy *= normalScale;', ADD);
  shader.fragmentShader = shader.fragmentShader.replace('#include <normalmap_pars_fragment>', `#include <normalmap_pars_fragment>\n${PARS}`).replace('#include <normal_fragment_maps>', maps);
  return shader;
}

export function addDetail(material, { map, tiling, strength = 1 }) {
  if (!material?.normalMap || !map) return false;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.needsUpdate = true;
  const uniforms = { uDetailNormal: { value: map }, uDetailTiling: { value: new THREE.Vector2(...tiling) }, uDetailStrength: { value: strength } };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    detailShader(shader);
  };
  material.customProgramCacheKey = () => 'level-detail';
  material.needsUpdate = true;
  return true;
}
