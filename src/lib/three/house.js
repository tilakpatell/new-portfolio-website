// One look for every world, after Bruno Simon's folio-2025 (its one
// MeshDefaultMaterial) and Active Theory's one lighting include
// (docs/research/2026-10-06-why-theirs-look-expensive.md): polish made here
// reaches every material a world hands over, and each world supplies only a
// small look.
//
// It goes on last, after three has lit the point (the sun, the sky, lamps,
// shadow maps, occlusion, the baked floor light of lib/three/groundwork all
// count), and does two things to what three worked out:
//
//   - shade is a colour. How lit the point is (`k`, three's light against
//     the full light of the world's sun and sky on the same albedo) picks
//     between three's light and the albedo times the look's shadow colour,
//     with a soft edge between: a soft terminator, and shadows that go
//     violet or blue or warm, never grey. Metals keep their own light;
//     anything glowing is added back as it was.
//   - fog is the sky. Three's fog factor, but its colour is the sky's along
//     the view ray (the horizon below, a horizon-to-zenith gradient above,
//     the sun's halo), so far ground melts into the sky exactly.
//
//   createHouse(look) → { uniforms, toneMapping, exposure, material(opts), adopt(root),
//     set(look), light({ sun, hemi }), sky({ low, high, below, sunDir, halo }) }
//   houseShader(shader, { fog }, chunks) → { vertexShader, fragmentShader, swapped }
//
// A look: { shadow, edge: [from, to], mix, fogLow, fogHigh, fogBelow, halo,
// fogMix, exposure }. All the materials of one world share one set of uniforms, so a
// frame sets them once. Call adopt() after anything else that patches the
// world's materials (lib/three/groundwork's groundWorld): its shade then
// replaces their tints, and one shadow colour reaches everything.

import * as THREE from 'three';

export const LOOK = {
  shadow: 0x9d93c4, // the albedo times this, in full shade (sRGB)
  edge: [0.16, 0.82], // where shade turns to light, as a share of full light
  mix: 1, // how much of the look (0: three's own light)
  fogLow: 0xf6dfb0, // the sky at the horizon, and the haze below it
  fogHigh: 0x3f7ccc, // the sky overhead
  fogBelow: 0.92, // the haze below the horizon, as a share of fogLow
  halo: 0x000000, // the sun's glow in the fog (a colour, added)
  fogMix: 1, // how much of the sky's colour the fog takes (0: three's fogColor)
  // the house tone mapper is Neutral, which leaves mid-grey about where it
  // is; ACES (what the worlds were tuned under) lifts it by about 1.4, so a
  // world multiplies its own exposure by this to keep its brightness
  exposure: 1.4,
};

const PARS = /* glsl */ `
uniform vec3 uLookRef;
uniform vec3 uLookShadow;
uniform vec2 uLookEdge;
uniform float uLookMix;
uniform vec3 uLookFogLow;
uniform vec3 uLookFogHigh;
uniform float uLookFogBelow;
uniform vec3 uLookSunDir;
uniform vec3 uLookHalo;
uniform float uLookFogMix;
float lookLuma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// the sky along a direction, as the fog sees it
vec3 houseSky(vec3 d) {
  vec3 c = d.y < 0.0 ? uLookFogLow * uLookFogBelow : mix(uLookFogLow, uLookFogHigh, pow(max(d.y, 0.0), 0.5));
  return c + uLookHalo * pow(max(dot(d, uLookSunDir), 0.0), 6.0);
}
`;

const LOOK_GLSL = /* glsl */ `
{
  vec3 lkAlbedo = diffuseColor.rgb;
  vec3 lkLight = outgoingLight - totalEmissiveRadiance;
  float lkLit = lookLuma(lkLight) / max(lookLuma(lkAlbedo * uLookRef), 1e-4);
  float lkShade = (1.0 - smoothstep(uLookEdge.x, uLookEdge.y, lkLit)) * uLookMix;
  #ifdef STANDARD
    lkShade *= 1.0 - metalnessFactor;
  #endif
  outgoingLight = mix(lkLight, lkAlbedo * uLookShadow, lkShade) + totalEmissiveRadiance;
}
`;

const FOG_LINE = 'gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );';
// (the view ray in the world, from the view-space position every lit shader has)
const FOG_SKY = `{
		vec3 lkDir = normalize(transpose(mat3(viewMatrix)) * -vViewPosition);
		gl_FragColor.rgb = mix( gl_FragColor.rgb, mix(fogColor, houseSky(lkDir), uLookFogMix), fogFactor );
	}`;

// The rewrite of a lit material's shaders, as pure strings. `chunks` is
// three's ShaderChunk (passed in so this can be tested with stubs). A part
// whose line isn't where this expects it (another three version) is left
// out, and says so in `swapped`.
export function houseShader({ vertexShader, fragmentShader }, { fog = true } = {}, chunks = THREE.ShaderChunk) {
  const swapped = { look: false, fog: false };
  if (!fragmentShader.includes('#include <opaque_fragment>')) return { vertexShader, fragmentShader, swapped };
  let fs = fragmentShader.replace('#include <common>', `#include <common>\n${PARS}`).replace('#include <opaque_fragment>', `${LOOK_GLSL}#include <opaque_fragment>`);
  swapped.look = true;
  const chunk = chunks.fog_fragment;
  if (fog && typeof chunk === 'string' && chunk.includes(FOG_LINE) && fs.includes('#include <fog_fragment>')) {
    fs = fs.replace('#include <fog_fragment>', chunk.replace(FOG_LINE, FOG_SKY));
    swapped.fog = true;
  }
  return { vertexShader, fragmentShader: fs, swapped };
}

const LIT = (m) => Boolean(m && (m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial || m.isMeshToonMaterial));
const colour = (v, out) => (v?.isColor ? out.copy(v) : out.set(v));

export function createHouse(look = {}) {
  const uniforms = {
    uLookRef: { value: new THREE.Color(1, 1, 1) },
    uLookShadow: { value: new THREE.Color() },
    uLookEdge: { value: new THREE.Vector2() },
    uLookMix: { value: 1 },
    uLookFogLow: { value: new THREE.Color() },
    uLookFogHigh: { value: new THREE.Color() },
    uLookFogBelow: { value: 1 },
    uLookSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uLookHalo: { value: new THREE.Color() },
    uLookFogMix: { value: 1 },
  };

  const set = (o = {}) => {
    const u = uniforms;
    if (o.shadow != null) colour(o.shadow, u.uLookShadow.value);
    if (o.edge) u.uLookEdge.value.set(o.edge[0], o.edge[1]);
    if (o.mix != null) u.uLookMix.value = o.mix;
    if (o.fogLow != null) colour(o.fogLow, u.uLookFogLow.value);
    if (o.fogHigh != null) colour(o.fogHigh, u.uLookFogHigh.value);
    if (o.fogBelow != null) u.uLookFogBelow.value = o.fogBelow;
    if (o.halo != null) colour(o.halo, u.uLookHalo.value);
    if (o.fogMix != null) u.uLookFogMix.value = o.fogMix;
  };
  set({ ...LOOK, ...look });

  // the look onto one material, once
  const patch = (m) => {
    if (!LIT(m) || m.userData.house || m.userData.noHouse) return false;
    const before = m.onBeforeCompile;
    m.onBeforeCompile = (sh, r) => {
      before?.call(m, sh, r);
      Object.assign(sh.uniforms, uniforms);
      const out = houseShader(sh);
      sh.vertexShader = out.vertexShader;
      sh.fragmentShader = out.fragmentShader;
    };
    const key = m.customProgramCacheKey;
    m.customProgramCacheKey = () => `${key ? key.call(m) : ''}|house`;
    m.userData.house = uniforms;
    m.needsUpdate = true;
    return true;
  };

  const tmp = new THREE.Color();
  return {
    uniforms,
    toneMapping: THREE.NeutralToneMapping,
    exposure: look.exposure ?? LOOK.exposure,
    set,
    // every lit material under `root` (a mesh, a group, a scene) in the
    // look; how many it took on (each is patched once, however often asked)
    adopt(root) {
      let n = 0;
      root?.traverse?.((o) => {
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (patch(m)) n += 1;
      });
      return n;
    },
    // a new material, already in the look (a Lambert: no specular, the
    // illustrated finish)
    material(opts = {}) {
      const m = new THREE.MeshLambertMaterial(opts);
      patch(m);
      return m;
    },
    // full light, from the world's sun and sky: what a face square to the
    // sun, open to the sky, takes in (three's Lambert divides by pi). Once a
    // frame where the light moves; never quite nothing, so night still has
    // a scale to measure by.
    light({ sun = null, hemi = null, ambient = null } = {}) {
      const ref = uniforms.uLookRef.value.setRGB(0, 0, 0);
      if (sun) ref.add(tmp.copy(sun.color).multiplyScalar(sun.intensity));
      if (hemi) ref.add(tmp.copy(hemi.color).multiplyScalar(hemi.intensity));
      if (ambient) ref.add(tmp.copy(ambient.color).multiplyScalar(ambient.intensity));
      ref.multiplyScalar(1 / Math.PI);
      ref.setRGB(Math.max(ref.r, 1e-3), Math.max(ref.g, 1e-3), Math.max(ref.b, 1e-3));
    },
    // the sky the fog is coloured by: its horizon, its zenith, how the haze
    // below the horizon compares, the direction to the sun and its glow
    sky({ low = null, high = null, below = null, sunDir = null, halo = null } = {}) {
      if (low) colour(low, uniforms.uLookFogLow.value);
      if (high) colour(high, uniforms.uLookFogHigh.value);
      if (below != null) uniforms.uLookFogBelow.value = below;
      if (sunDir) uniforms.uLookSunDir.value.copy(sunDir).normalize();
      if (halo) colour(halo, uniforms.uLookHalo.value);
    },
  };
}
