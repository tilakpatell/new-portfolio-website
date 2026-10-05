// A world's water, out to the horizon: a sea (Kamino's storm-grey, Scarif's
// lagoons, Ahch-To's cold Atlantic), a swamp (Dagobah's black water), lava
// (Mustafar's rivers, glowing, crusting over), or a sea of cloud (Bespin,
// far below the city). One plane at the site's level, its waves in the
// light (a shader: the scene's sun and fog, a sheen toward the sun, foam
// where it's shallow over the land); lava lights itself.
//
// site.water: { level, color, deep, kind, foam?, glow? }

import * as THREE from 'three';
import { FAR } from './terrain';
import { noiseTexture } from './noiseTex';

const VERT = `
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = `
varying vec3 vWorld;
uniform vec3 uColor, uDeep, uSun, uSunColor, uSky;
uniform float uTime, uKind, uFoam, uGlow, uWaves;
#include <fog_pars_fragment>
uniform sampler2D uNoise;
float wFbm(vec2 p) { vec4 a = texture2D(uNoise, p * 0.08); vec4 b = texture2D(uNoise, p * 0.19 + 0.37); return a.r * 0.35 + a.g * 0.3 + b.b * 0.2 + b.a * 0.15; }
void main() {
  vec2 xz = vWorld.xz;
  float dist = length(vWorld - cameraPosition);
  vec3 view = normalize(cameraPosition - vWorld);
  vec3 c;
  if (uKind > 1.5) {
    // lava: hot channels under a crust that cracks and drifts
    float flow = wFbm(xz * 0.05 + vec2(uTime * 0.02, uTime * 0.013));
    float crust = smoothstep(0.42, 0.62, wFbm(xz * 0.11 - vec2(uTime * 0.03, 0.0)));
    vec3 hot = mix(uColor, vec3(1.0, 0.85, 0.4), smoothstep(0.55, 0.8, flow));
    c = mix(hot * uGlow * (0.8 + 0.4 * flow), uDeep, crust * 0.85);
  } else {
    // water (or cloud): waves in the light, darker looking down into it
    float e = 0.6;
    vec2 p = xz * 0.09 * uWaves;
    float t = uTime * 0.6;
    float h0 = wFbm(p + vec2(t * 0.3, t * 0.2));
    float hx = wFbm(p + vec2(e * 0.09, 0.0) + vec2(t * 0.3, t * 0.2));
    float hz = wFbm(p + vec2(0.0, e * 0.09) + vec2(t * 0.3, t * 0.2));
    float fade = 1.0 - smoothstep(80.0, 900.0, dist);
    vec3 n = normalize(vec3((h0 - hx) * 3.0 * fade, 1.0, (h0 - hz) * 3.0 * fade));
    float facing = clamp(dot(n, view), 0.0, 1.0);
    float fresnel = pow(1.0 - facing, 4.0);
    c = mix(uDeep, uColor, 0.35 + 0.65 * (1.0 - facing));
    c = mix(c, uSky, fresnel * 0.75);
    vec3 h = normalize(uSun + view);
    float spec = pow(max(dot(n, h), 0.0), uKind > 0.5 ? 40.0 : 220.0);
    c += uSunColor * spec * (uKind > 0.5 ? 0.25 : 1.6);
    // foam, in streaks
    c = mix(c, vec3(0.92), smoothstep(0.72, 0.8, wFbm(p * 2.3 + t * 0.4)) * uFoam * fade);
  }
  gl_FragColor = vec4(c, 1.0);
  #include <fog_fragment>
}`;

const KIND = { sea: 0, swamp: 0, clouds: 1, lava: 2, salt: 0 };

export function createWater(site, sunDir, sunColor) {
  const w = site.water;
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uColor: { value: new THREE.Color(w.color) },
      uDeep: { value: new THREE.Color(w.deep ?? w.color) },
      uSun: { value: sunDir.clone() },
      uSunColor: { value: new THREE.Color(sunColor) },
      uSky: { value: new THREE.Color(site.sky.horizon) },
      uTime: { value: 0 },
      uKind: { value: KIND[w.kind] ?? 0 },
      uFoam: { value: w.foam ?? (w.kind === 'sea' ? 0.5 : 0) },
      uGlow: { value: w.glow ?? 3 },
      uWaves: { value: w.waves ?? (w.kind === 'swamp' ? 2.2 : w.kind === 'clouds' ? 0.12 : 1) },
      uNoise: { value: noiseTexture() },
    },
  ]);
  const material = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, fog: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(FAR * 2.2, FAR * 2.2, 1, 1).rotateX(-Math.PI / 2), material);
  mesh.position.y = w.level;
  mesh.receiveShadow = false;
  mesh.name = 'water';
  // lava lights what's round it
  const glow = w.kind === 'lava' ? new THREE.HemisphereLight('#000000', '#ff6a1a', 0.9) : null;
  return {
    mesh,
    glow,
    update(t) {
      uniforms.uTime.value = t;
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
