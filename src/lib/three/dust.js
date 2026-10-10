// Dust for a hit (Bruno Simon’s puff when a crate lands; folio-2025, research
// note Part 3): soft cards cut from puffs.js’s blob, each rising, swelling to
// twice its size and fading over its life. One InstancedMesh a world, so a
// field of barrels knocked about is still one draw; the moving is all in the
// vertex shader from the card’s start time, so a frame’s work on the CPU is
// one uniform. A burst takes the next free cards round the place it is
// given (a slot is free once its life is up), turned so they rise along the
// `up` it is given (a planet’s up is not +y). What doesn’t fit is dropped: a
// puff missed in a pile-up is better than one stolen from the one before.
// With nothing in the air the mesh is hidden, so it costs no draw call.
//
//   createDust({ count = 256, colour, size = 0.5, life = 0.8, up = [0, 1, 0] })
//     → { mesh, burst(at, n = 1, up?), update(dt), used, dispose() }
//   dustShader(shader) → { vertexShader, fragmentShader, swapped } (pure)
//
// Sizes are in the mesh’s own units (metres at scale 1): a world in other
// units scales the mesh, and the cards keep to it.

import * as THREE from 'three';
import { blob } from './puffs';

const RISE = 0.6; // metres a card climbs over its life
const JITTER = 0.3; // metres a card may start from the place
const NEVER = -1e9; // a start time for a card that hasn’t been used

const PARS_VS = /* glsl */ `
attribute float aStart;
attribute float aSeed;
uniform float uDustTime;
uniform float uDustLife;
uniform float uDustRise;
varying float vDustFade;
`;
const PARS_FS = /* glsl */ `
varying float vDustFade;
`;

export function dustShader({ vertexShader, fragmentShader }) {
  const ok = vertexShader.includes('#include <project_vertex>') && fragmentShader.includes('#include <map_fragment>');
  if (!ok) return { vertexShader, fragmentShader, swapped: false };
  const vs = vertexShader.replace('#include <common>', `#include <common>\n${PARS_VS}`).replace(
    '#include <project_vertex>',
    // (mvPosition declared outside the block: three's fog chunk reads it
    // after, and with fog on, the ultra level's, the shader didn't compile)
    `vec4 mvPosition;
{
  float dustAge = (uDustTime - aStart) / uDustLife;
  float dustLive = step(0.0, dustAge) * step(dustAge, 1.0);
  float dustA = clamp(dustAge, 0.0, 1.0);
  // in quickly, out slowly; up fast, then hanging
  vDustFade = dustLive * smoothstep(0.0, 0.08, dustA) * (1.0 - dustA) * (1.0 - dustA);
  float dustUp = uDustRise * (1.0 - (1.0 - dustA) * (1.0 - dustA));
  mat4 dustM = modelMatrix;
  #ifdef USE_INSTANCING
  dustM = modelMatrix * instanceMatrix;
  #endif
  mvPosition = viewMatrix * dustM * vec4(0.0, dustUp, 0.0, 1.0);
  // the card faces the camera, at the mesh’s own scale, turned by its seed
  float dustTurn = aSeed * 6.2831853 + dustA * (aSeed - 0.5) * 2.0;
  float dustC = cos(dustTurn);
  float dustS = sin(dustTurn);
  vec2 dustXy = mat2(dustC, dustS, -dustS, dustC) * position.xy * (1.0 + dustA) * length(modelMatrix[0].xyz);
  mvPosition.xy += dustXy * dustLive;
  gl_Position = projectionMatrix * mvPosition;
}`,
  );
  const fs = fragmentShader.replace('#include <common>', `#include <common>\n${PARS_FS}`).replace(
    '#include <map_fragment>',
    `#ifdef USE_MAP
  diffuseColor.a *= texture2D(map, vMapUv).r;
#endif
  diffuseColor.a *= vDustFade;
  if (diffuseColor.a < 0.01) discard;`,
  );
  return { vertexShader: vs, fragmentShader: fs, swapped: true };
}

export function createDust({ count = 256, colour = 0xd9c8a8, size = 0.5, life = 0.8, up = [0, 1, 0] } = {}) {
  const texture = blob();
  const geometry = new THREE.PlaneGeometry(size, size);
  const starts = new Float32Array(count).fill(NEVER);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) seeds[i] = Math.random();
  const aStart = new THREE.InstancedBufferAttribute(starts, 1);
  aStart.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aStart', aStart);
  geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  const uniforms = { uDustTime: { value: 0 }, uDustLife: { value: life }, uDustRise: { value: RISE } };
  const material = new THREE.MeshBasicMaterial({ color: colour, map: texture, transparent: true, depthWrite: false });
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    const out = dustShader(sh);
    sh.vertexShader = out.vertexShader;
    sh.fragmentShader = out.fragmentShader;
  };
  material.customProgramCacheKey = () => 'dust';
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.name = 'dust';
  // (the cards are placed in the shader: three’s bounds don’t know where)
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  // (nothing in the air, nothing drawn: no draw call for dust till a hit)
  mesh.visible = false;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const Y = new THREE.Vector3(0, 1, 0);
  const u = new THREE.Vector3();
  for (let i = 0; i < count; i++) mesh.setMatrixAt(i, m.identity());
  let time = 0;
  let next = 0; // where the search for a free card starts
  let until = -Infinity; // when the last card out is gone
  const free = (i) => time - starts[i] >= life;
  return {
    mesh,
    uniforms,
    burst(at, n = 1, rise = up) {
      if (!at?.every?.(Number.isFinite) || !(n > 0)) return;
      q.setFromUnitVectors(Y, u.set(...rise).normalize());
      let placed = 0;
      const from = next;
      for (let k = 0; k < count && placed < n; k++) {
        const i = (from + k) % count;
        if (!free(i)) continue;
        const r = () => (Math.random() * 2 - 1) * JITTER;
        p.set(at[0] + r(), at[1] + r(), at[2] + r());
        mesh.setMatrixAt(i, m.compose(p, q, one));
        starts[i] = time;
        placed++;
        next = (i + 1) % count;
      }
      if (!placed) return;
      until = time + life;
      mesh.visible = true;
      mesh.instanceMatrix.needsUpdate = true;
      aStart.needsUpdate = true;
    },
    update(dt) {
      time += Math.max(0, dt || 0);
      uniforms.uDustTime.value = time;
      if (mesh.visible && time > until) mesh.visible = false;
    },
    get used() {
      let n = 0;
      for (let i = 0; i < count; i++) if (!free(i)) n++;
      return n;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      texture.dispose();
      mesh.dispose?.();
    },
  };
}
