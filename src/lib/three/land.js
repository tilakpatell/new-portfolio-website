// The ground's material for a planet's land: the cells' meshes (lib/land's
// cellMesh) coloured from the land map (landmap.js) as Bruno Simon colours
// his floor, by depth, grass, sand and rock, and lit by their own normals
// (real relief, where his floor is flat). With the tracks (tracks.js), the
// wheels knock the grass down to the dirt under them before the colour is
// chosen, as his terrain node does. A Lambert: hand it to the world's house
// look (lib/three/house) like anything else.
//
//   createLandMaterial({ map, tracks = null }) → MeshLambertMaterial
//   landShader(shader, { tracks }) → { vertexShader, fragmentShader, swapped } (pure)

import * as THREE from 'three';
import { LAND_GLSL } from './landmap';

export function landShader({ vertexShader, fragmentShader }, { tracks = null } = {}) {
  const ok = vertexShader.includes('#include <worldpos_vertex>') && fragmentShader.includes('#include <color_fragment>');
  if (!ok) return { vertexShader, fragmentShader, swapped: false };
  const vs = vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec2 vLandXz;\nvarying float vLandUp;\nvarying float vLandY;')
    .replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
{
  vec4 landWorld = modelMatrix * vec4(transformed, 1.0);
  vLandXz = landWorld.xz;
  vLandY = landWorld.y;
  vLandUp = normalize(mat3(modelMatrix) * objectNormal).y;
}`,
    );
  const knock = tracks ? 'landM.g *= 1.0 - tracksAt(vLandXz).r;\n' : '';
  const fs = fragmentShader
    .replace('#include <common>', `#include <common>\nvarying vec2 vLandXz;\nvarying float vLandUp;\nvarying float vLandY;\n${LAND_GLSL}\n${tracks ? tracks.glsl : ''}`)
    .replace(
      '#include <color_fragment>',
      `#include <color_fragment>
{
  vec4 landM = landMask(vLandXz);
  ${knock}// (the slope as rise over run, from the normal's lean)
  float landUp = clamp(vLandUp, 0.05, 1.0);
  float landSlope = sqrt(1.0 - landUp * landUp) / landUp;
  diffuseColor.rgb *= landColour(landM, landSlope, vLandY);
}`,
    );
  return { vertexShader: vs, fragmentShader: fs, swapped: true };
}

export function createLandMaterial({ map, tracks = null } = {}) {
  const material = new THREE.MeshLambertMaterial({ color: 0xffffff });
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, map.uniforms, tracks?.uniforms ?? {});
    const out = landShader(sh, { tracks });
    sh.vertexShader = out.vertexShader;
    sh.fragmentShader = out.fragmentShader;
  };
  material.customProgramCacheKey = () => (tracks ? 'land|tracks' : 'land');
  return material;
}
