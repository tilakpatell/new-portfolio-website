// A planet's atmosphere, drawn as light scattered along the view through a
// sphere of air: thick near the ground and thinning with height, lit by up
// to two suns, white where a sun is high and its sunset colour along the
// terminator, with a glow toward the sun. The galaxy's planets drew it
// first (galaxy/bodyShaders.js re-exports these); the universe map's
// fandom planets draw it too.
//
// ATMO: the march (inscatter(ro, rd, tMax, out trans), in the planet's radii)
// for a surface shader to compose; SHELL_VERT and SHELL_FRAG: the shell
// round a planet, drawn from inside (back faces), so it's the glow round the
// limb from space and the sky from below.
// atmosphereParams(air) → { uAtmo, uAtmoP, uSunset } from { colour, top,
//   falloff, density, glow, sunset }
// createAtmosphere({ radius, top, colour, density, falloff, sunset, glow,
//   suns, segments, steps, inner, flat, uniforms }) → { mesh, set({ suns, strength }),
//   params, update(center), dispose }: `uniforms`, a body's own, shares its
//   sun and air with the shell (the galaxy's ground and air read one sun);
//   `inner`, how far in the ground starts (its sphere's facets: a little
//   under 1); `flat`, the air in two flat bands of its colour, as a cartoon
//   draws it (C-137's); each sun { dir (unit, toward it, world), colour (hex
//   or linear [r, g, b]) }, the second slot black with one

import * as THREE from 'three';

// the atmosphere between the eye and a point: light scattered toward the eye
// and how much of what's behind gets through. Planet-centred, in radii.
// uAtmoP = (shell radius, falloff, density, forward glow); STEPS along the
// ray (7 unless defined: the galaxy's)
export const ATMO = /* glsl */ `
#ifndef STEPS
#define STEPS 7
#endif
vec3 inscatter(vec3 ro, vec3 rd, float tMax, out float trans) {
  trans = 1.0;
  float Ra = uAtmoP.x;
  float b = dot(ro, rd);
  float c = dot(ro, ro) - Ra * Ra;
  float disc = b * b - c;
  if (disc <= 0.0) return vec3(0.0);
  float sq = sqrt(disc);
  float t0 = max(0.0, -b - sq);
  float t1 = min(tMax, -b + sq);
  if (t1 <= t0) return vec3(0.0);
  float dt = (t1 - t0) / float(STEPS);
  vec3 sum = vec3(0.0);
  float od = 0.0;
  float glow0 = pow(max(dot(rd, uSunDir[0]), 0.0), 12.0) * uAtmoP.w;
  float glow1 = pow(max(dot(rd, uSunDir[1]), 0.0), 12.0) * uAtmoP.w;
  for (int i = 0; i < STEPS; i++) {
    vec3 p = ro + rd * (t0 + dt * (float(i) + 0.5));
    float l = length(p);
    float h = max(l - 1.0, 0.0) / (Ra - 1.0);
    float dens = exp(-h * uAtmoP.y) * (1.0 - smoothstep(0.85, 1.0, h));
    vec3 n = p / l;
    float m0 = dot(n, uSunDir[0]);
    float m1 = dot(n, uSunDir[1]);
    vec3 l0 = uSunCol[0] * smoothstep(-0.14, 0.12, m0) * mix(uSunset, vec3(1.0), smoothstep(-0.06, 0.25, m0)) * (1.0 + glow0);
    vec3 l1 = uSunCol[1] * smoothstep(-0.14, 0.12, m1) * mix(uSunset, vec3(1.0), smoothstep(-0.06, 0.25, m1)) * (1.0 + glow1);
    sum += dens * (l0 + l1);
    od += dens;
  }
  float k = dt * uAtmoP.z;
  trans = exp(-od * k * 0.9);
  return sum * k * uAtmo;
}
`;

// ── The atmosphere's shell: drawn from inside (back faces), so it's there
// whether you're out in space (the glow round the limb) or down in it (the
// sky); the ground hides the part behind the planet ──
export const SHELL_VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
export const SHELL_FRAG = /* glsl */ `
uniform float uR;
uniform vec3 uCenter;
uniform vec3 uSunDir[2];
uniform vec3 uSunCol[2];
uniform vec3 uAtmo;
uniform vec4 uAtmoP;
uniform vec3 uSunset;
uniform float uInner;
uniform float uStrength;
varying vec3 vWorld;
${ATMO}
void main() {
  vec3 ro = (cameraPosition - uCenter) / uR;
  vec3 rd = normalize(vWorld - cameraPosition);
  float b = dot(ro, rd);
  float c = dot(ro, ro) - uInner * uInner;
  float disc = b * b - c;
  float tMax = 1e4;
  if (disc > 0.0) {
    float t = -b - sqrt(disc);
    if (t > 0.0) tMax = t;
  }
  float tr;
  vec3 col = inscatter(ro, rd, tMax, tr);
  #ifdef FLAT
  // two flat bands of the air's own colour: how much air and light the view
  // passes through, against the colour's own brightness, stepped at an eighth
  // and a half (a band a cartoon would draw), each step a pixel soft (so the
  // limb doesn't crawl as it turns)
  float luma = dot(uAtmo, vec3(0.2126, 0.7152, 0.0722));
  float a = dot(col, vec3(0.2126, 0.7152, 0.0722)) / max(luma, 1e-4);
  float e = max(fwidth(a), 1e-3);
  col = uAtmo * (0.45 * smoothstep(0.12 - e, 0.12 + e, a) + 0.55 * smoothstep(0.5 - e, 0.5 + e, a));
  #endif
  gl_FragColor = vec4(col * uStrength, 1.0);
  #include <colorspace_fragment>
}`;

const DEFAULTS = { top: 1.06, falloff: 3.5, density: 2, glow: 0.8, sunset: '#ffa070' };

export function atmosphereParams(air = {}) {
  const a = { ...DEFAULTS, ...air };
  return {
    uAtmo: new THREE.Color(a.colour ?? '#000000'),
    uAtmoP: new THREE.Vector4(a.top, a.falloff, a.density, a.glow),
    uSunset: new THREE.Color(a.sunset),
  };
}

const setColour = (c, v) => (Array.isArray(v) ? c.setRGB(v[0], v[1], v[2]) : c.set(v));

export function createAtmosphere({ radius, top = DEFAULTS.top, colour = '#000000', density = DEFAULTS.density, falloff = DEFAULTS.falloff, sunset = DEFAULTS.sunset, glow = DEFAULTS.glow, suns = [], segments = [64, 40], steps = 7, inner = 0.995, flat = false, uniforms = null } = {}) {
  const p = atmosphereParams({ colour, top, falloff, density, glow, sunset });
  const own = {
    uR: { value: radius },
    uCenter: { value: new THREE.Vector3() },
    uSunDir: { value: [new THREE.Vector3(1, 0.3, 0.4).normalize(), new THREE.Vector3(1, 0.3, 0.4).normalize()] },
    uSunCol: { value: [new THREE.Color(1.25, 1.2, 1.1), new THREE.Color(0, 0, 0)] },
    uAtmo: { value: p.uAtmo },
    uAtmoP: { value: p.uAtmoP },
    uSunset: { value: p.uSunset },
  };
  const u = { ...own, ...(uniforms ?? {}), uInner: { value: inner }, uStrength: { value: 1 } };
  const geo = new THREE.SphereGeometry(radius * top, segments[0], segments[1]);
  const mat = new THREE.ShaderMaterial({ vertexShader: SHELL_VERT, fragmentShader: flat ? `#define FLAT\n${SHELL_FRAG}` : SHELL_FRAG, uniforms: u, defines: { STEPS: steps }, side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  const set = ({ suns: list = null, strength = null } = {}) => {
    if (list) {
      for (let i = 0; i < 2; i++) {
        const s = list[i];
        if (s) {
          u.uSunDir.value[i].set(s.dir[0], s.dir[1], s.dir[2]);
          setColour(u.uSunCol.value[i], s.colour);
        } else u.uSunCol.value[i].setRGB(0, 0, 0);
      }
    }
    if (strength !== null) u.uStrength.value = strength;
  };
  if (suns.length) set({ suns });
  return {
    mesh,
    params: p,
    set,
    // where the planet's middle is, in the world (each frame: it moves with its map)
    update(center) {
      u.uCenter.value.copy(center);
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
