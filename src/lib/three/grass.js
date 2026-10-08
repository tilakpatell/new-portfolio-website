// Grass as Bruno Simon grows it (folio-2025's Grass.js;
// docs/research/2026-10-06-why-theirs-look-expensive.md): one mesh, one draw,
// a triangle a blade on a jittered grid, the whole patch wrapped round a
// centre in the vertex shader so it goes wherever you go. Each blade:
//
//   - stands on the ground map's height and grows as tall as its grass
//     amount says (none on a lane, under water, in a tilled field), with a
//     soft noise in its height and a fade toward the patch's edge;
//   - turns to face the camera, so it is never seen edge-on;
//   - is the ground's colour (groundColour at its root), its normal straight
//     up, so blade and ground are one surface and light as one;
//   - counts its root as shade (the look turns it the shadow's colour), so
//     each blade darkens into the ground with no occlusion map;
//   - moves only at its tip, by the world's one wind (lib/three/wind).
//
//   createGrass({ ground, wind, tracks, side, size, height, width, root })
//     → { mesh, material, uniforms, update(centre), set(opts), dispose() }
//   bladeLayout({ side, size, seed }) → { centres, rand }            (pure)
//   grassGeometry({ side, size, seed }) → BufferGeometry             (pure)
//   grassShader(shader, { ground }) → { vertexShader, fragmentShader, swapped }  (pure;
//     `ground` the GLSL that gives groundHeight/groundColour/groundGrass:
//     a ground map's (groundmap.js, the default) or a planet's land map's;
//     `tracks` lib/three/tracks's, to lie flat where the wheels went)
//
// `side` blades a side (Bruno's is 280: 78,400 blades), over a patch `size`
// metres across. The material is a Lambert: hand it to the world's house
// look (lib/three/house) like anything else.

import * as THREE from 'three';
import { seeded } from '../seeded';
import { GROUND_GLSL } from './groundmap';
import { WIND_GLSL } from './wind';

export function bladeLayout({ side = 280, size = 40, seed = 7 } = {}) {
  const rand = seeded(seed);
  const n = side * side;
  const centres = new Float32Array(n * 2);
  const r = new Float32Array(n);
  const cell = size / side;
  for (let iz = 0; iz < side; iz++)
    for (let ix = 0; ix < side; ix++) {
      const k = iz * side + ix;
      centres[k * 2] = -size / 2 + (ix + rand() * 0.98) * cell;
      centres[k * 2 + 1] = -size / 2 + (iz + rand() * 0.98) * cell;
      r[k] = rand();
    }
  return { centres, rand: r };
}

export function grassGeometry({ side = 280, size = 40, seed = 7 } = {}) {
  const { centres, rand } = bladeLayout({ side, size, seed });
  const n = side * side;
  const pos = new Float32Array(n * 9);
  const blade = new Float32Array(n * 9);
  const CORNERS = [-1, 0, 0, 1, 0, 0, 0, 1, 0];
  for (let k = 0; k < n; k++) {
    pos.set(CORNERS, k * 9);
    for (let c = 0; c < 3; c++) blade.set([centres[k * 2], centres[k * 2 + 1], rand[k]], k * 9 + c * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aBlade', new THREE.BufferAttribute(blade, 3));
  return g;
}

const parsVs = (ground, tracks) => /* glsl */ `
attribute vec3 aBlade;
uniform vec2 uGrassCentre;
uniform float uGrassSize;
uniform float uGrassHeight;
uniform float uGrassWidth;
varying vec3 vGrassColour;
varying float vGrassTip;
${ground}
${tracks ? tracks.glsl : ''}
${WIND_GLSL}
`;

const BLADE_VS = /* glsl */ `
  // wrapped round the centre: the patch goes wherever you go
  vec2 gRel = mod(aBlade.xy - uGrassCentre + uGrassSize * 0.5, uGrassSize) - uGrassSize * 0.5;
  vec2 gXz = uGrassCentre + gRel;
  float gGrass = groundGrass(gXz);
  // GRASS_TRACKS
  // as tall as the ground's grass says, a soft noise over it, and fading out
  // toward the patch's edge, so the wrap is never seen
  float gEdge = 1.0 - smoothstep(0.32, 0.5, length(gRel) / uGrassSize);
  float gNoise = texture2D(uWindNoise, gXz * 0.0321).r;
  float gH = uGrassHeight * (0.45 + 0.55 * aBlade.z) * (0.55 + 0.6 * gNoise) * smoothstep(0.1, 0.6, gGrass) * gEdge;
  // (no grass: no width either, a triangle of no area draws nothing)
  float gW = uGrassWidth * step(0.1, gGrass) * step(0.001, gH);
  // turned square to the camera
  vec2 gTo = normalize(cameraPosition.xz - gXz + vec2(1e-4, 0.0));
  vec2 gAcross = vec2(-gTo.y, gTo.x);
  vec3 transformed = vec3(gXz.x, groundHeight(gXz), gXz.y);
  transformed.xz += gAcross * position.x * gW;
  transformed.y += position.y * gH;
  // only the tip moves in the wind
  transformed.xz += windOffset(gXz) * position.y * gH * 2.0;
  vGrassTip = position.y;
  vGrassColour = groundColour(gXz) * (0.9 + 0.2 * aBlade.z) * (1.0 + 0.3 * position.y);
`;

const PARS_FS = /* glsl */ `
uniform float uGrassRoot;
varying vec3 vGrassColour;
varying float vGrassTip;
`;

export function grassShader({ vertexShader, fragmentShader }, { ground = GROUND_GLSL, tracks = null } = {}) {
  const ok = vertexShader.includes('#include <begin_vertex>') && vertexShader.includes('#include <beginnormal_vertex>') && fragmentShader.includes('#include <color_fragment>') && fragmentShader.includes('#include <opaque_fragment>');
  if (!ok) return { vertexShader, fragmentShader, swapped: false };
  const vs = vertexShader
    .replace('#include <common>', `#include <common>\n${parsVs(ground, tracks)}`)
    .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);\n#ifdef USE_TANGENT\nvec3 objectTangent = vec3(1.0, 0.0, 0.0);\n#endif')
    .replace('#include <begin_vertex>', BLADE_VS.replace('  // GRASS_TRACKS\n', tracks ? '  // (flat where the wheels went: his G × (1 − r))\n  gGrass *= 1.0 - tracksAt(gXz).r;\n' : ''));
  const fs = fragmentShader
    .replace('#include <common>', `#include <common>\n${PARS_FS}`)
    .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vGrassColour;')
    .replace('#include <opaque_fragment>', 'outgoingLight *= mix(uGrassRoot, 1.0, vGrassTip);\n#include <opaque_fragment>');
  return { vertexShader: vs, fragmentShader: fs, swapped: true };
}

export function createGrass({ ground, wind, tracks = null, side = 280, size = 40, height = 0.55, width = 0.07, root = 0.5, seed = 7 } = {}) {
  const geometry = grassGeometry({ side, size, seed });
  const uniforms = {
    uGrassCentre: { value: new THREE.Vector2() },
    uGrassSize: { value: size },
    uGrassHeight: { value: height },
    uGrassWidth: { value: width },
    uGrassRoot: { value: root },
  };
  const material = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, ground.uniforms, wind.uniforms, tracks?.uniforms ?? {}, uniforms);
    const out = grassShader(sh, { ground: ground.glsl ?? GROUND_GLSL, tracks });
    sh.vertexShader = out.vertexShader;
    sh.fragmentShader = out.fragmentShader;
  };
  material.customProgramCacheKey = () => (tracks ? 'grass|tracks' : 'grass');
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'grass';
  // (placed in the shader, so the mesh's own bounds mean nothing)
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return {
    mesh,
    material,
    uniforms,
    // where the patch is centred: wherever the eye is on (the hobbit, the
    // camera's target), once a frame
    update(centre) {
      uniforms.uGrassCentre.value.set(centre.x, centre.z);
    },
    set({ height: h = null, width: w = null, root: r = null } = {}) {
      if (h != null) uniforms.uGrassHeight.value = h;
      if (w != null) uniforms.uGrassWidth.value = w;
      if (r != null) uniforms.uGrassRoot.value = r;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
