// The fog the sky's own colour, as Bruno Simon's folio has it (its fog is
// its background) and as the films' matte paintings do: what's far off
// fades not into one flat grey but into the sky beside it, the colour of
// the sky that way: the horizon's, its haze band, warmer toward the sun
// where the sun's glow is. So the far land meets the sky with no seam, and
// a ridge against the sunset goes the sunset's colour. Its thickness is
// three's own (the scene's FogExp2): only the colour changes, so nothing is
// seen any farther than before.
//
// createSkyFog(sky) → { uniforms, patch(material), scene(root), look({ halo, below }), indoors(on) }
// (`sky` is surface/sky.js's: the fog reads its uniforms, the very objects,
// so it's always the dome's colour.) Indoors, a room's own fog colour.

import * as THREE from 'three';

const PARS_VERTEX = '#include <fog_pars_vertex>';
const VERTEX = '#include <fog_vertex>';
const PARS_FRAGMENT = '#include <fog_pars_fragment>';
const FRAGMENT = '#include <fog_fragment>';
const MIX = 'gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );';

// the sky's colour along a direction: the dome's own sum (sky.js), its
// suns' broad glow but not their discs, and no clouds, stars or moons
export const SKY_FOG = /* glsl */ `
uniform vec3 uSfZenith, uSfHorizon, uSfBelow, uSfHaze, uSfHalo;
uniform float uSfHazeK, uSfMix, uSfBelowK;
uniform vec3 uSfSunDir[2];
uniform vec3 uSfSunColor[2];
uniform vec3 uSfSunSize[2];
vec3 skyFogColour(vec3 dir) {
  float el = dir.y;
  vec3 c = mix(uSfHorizon, uSfZenith, pow(smoothstep(0.0, 0.75, el), 0.6));
  c = mix(c, uSfBelow * uSfBelowK, smoothstep(0.0, -0.12, el));
  c = mix(c, uSfHaze, exp(-abs(el) * 9.0) * uSfHazeK);
  for (int i = 0; i < 2; i++) {
    if (uSfSunSize[i].z <= 0.0) continue;
    c += uSfSunColor[i] * pow(max(dot(dir, uSfSunDir[i]), 0.0), 12.0) * 0.32 * uSfSunSize[i].y;
  }
  // (the world's look: a halo round its sun, the house's)
  c += uSfHalo * pow(max(dot(dir, uSfSunDir[0]), 0.0), 6.0);
  return c;
}
`;

// The rewrite, as pure strings: a varying from the camera to the vertex in
// the world's axes, and the fog mixed toward the sky's colour that way by
// uSfMix (1 outdoors, 0 in a room). Shaders without three's fog chunks, or
// whose chunk three has changed, are left alone.
export function skyFogShader({ vertexShader, fragmentShader }, chunks) {
  const ok = vertexShader.includes(PARS_VERTEX) && vertexShader.includes(VERTEX) && fragmentShader.includes(PARS_FRAGMENT) && fragmentShader.includes(FRAGMENT) && typeof chunks?.fog_fragment === 'string' && chunks.fog_fragment.includes(MIX);
  if (!ok) return { vertexShader, fragmentShader, swapped: false };
  const vs = vertexShader.replace(PARS_VERTEX, `${PARS_VERTEX}\n#ifdef USE_FOG\nvarying vec3 vSkyFogDir;\n#endif`).replace(
    VERTEX,
    `${VERTEX}
#ifdef USE_FOG
  vSkyFogDir = transpose(mat3(viewMatrix)) * mvPosition.xyz;
#endif`,
  );
  const fs = fragmentShader
    .replace(PARS_FRAGMENT, `${PARS_FRAGMENT}\n#ifdef USE_FOG\nvarying vec3 vSkyFogDir;\n${SKY_FOG}\n#endif`)
    .replace(FRAGMENT, chunks.fog_fragment.replace(MIX, 'gl_FragColor.rgb = mix( gl_FragColor.rgb, mix( fogColor, skyFogColour( normalize( vSkyFogDir ) ), uSfMix ), fogFactor );'));
  return { vertexShader: vs, fragmentShader: fs, swapped: true };
}

export function createSkyFog(sky, chunks) {
  const u = sky.uniforms;
  const uniforms = {
    uSfZenith: u.uZenith,
    uSfHorizon: u.uHorizon,
    uSfBelow: u.uBelow,
    uSfHaze: u.uHaze,
    uSfHazeK: u.uHazeK,
    uSfSunDir: u.uSunDir,
    uSfSunColor: u.uSunColor,
    uSfSunSize: u.uSunSize,
    uSfMix: { value: 1 },
    // the world's look (look.js): its halo round the sun, and the haze below
    // the horizon as a share of the sky's colour there
    uSfHalo: { value: new THREE.Color(0, 0, 0) },
    uSfBelowK: { value: 1 },
  };
  const patch = (material) => {
    // (a shader material only where it asks for fog: the sea does, the sky doesn't)
    if (!material || material.userData.skyFog || !material.fog || material.isRawShaderMaterial) return material;
    material.userData.skyFog = true;
    const before = material.onBeforeCompile;
    material.onBeforeCompile = (sh, r) => {
      before?.call(material, sh, r);
      const out = skyFogShader(sh, chunks);
      if (!out.swapped) return;
      Object.assign(sh.uniforms, uniforms);
      sh.vertexShader = out.vertexShader;
      sh.fragmentShader = out.fragmentShader;
    };
    const key = material.customProgramCacheKey;
    material.customProgramCacheKey = () => `${key ? key.call(material) : ''}|skyfog`;
    material.needsUpdate = true;
    return material;
  };
  return {
    uniforms,
    patch,
    // every material under `root` not yet patched (cheap to run again: the
    // ones already done are passed over)
    scene(root) {
      root.traverse((o) => {
        if (!o.material) return;
        if (Array.isArray(o.material)) o.material.forEach(patch);
        else patch(o.material);
      });
    },
    // a world's look: { halo: '#rrggbb', below: share } (either left as it is)
    look({ halo = null, below = null } = {}) {
      if (halo != null) uniforms.uSfHalo.value.set(halo);
      if (below != null) uniforms.uSfBelowK.value = below;
    },
    // in a room: its own fog colour, not the sky's
    indoors(on) {
      uniforms.uSfMix.value = on ? 0 : 1;
    },
  };
}
