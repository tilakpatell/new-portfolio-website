// The Shire's sky and light, by the time of day: a long golden afternoon,
// the night of the party (stars, a moon, lanterns), and the dawn you leave
// in. One dome with the sun, soft clouds and stars painted in its shader;
// the lights, the fog, the water and the house look's shadow colour
// (lib/three/house) follow the same three moods, blended as the evening turns.

import * as THREE from 'three';

export const MOODS = {
  day: {
    top: 0x3f7ccc,
    horizon: 0xf6dfb0,
    sun: [0.55, 0.42, 0.42],
    sunColour: 0xffe2b0,
    sunPower: 2.6,
    hemiSky: 0xcfe2ff,
    hemiGround: 0x6a7a3a,
    hemi: 1.05,
    fog: 0xe8dcb8,
    fogNear: 46,
    fogFar: 210,
    cloud: 0.55,
    cloudColour: 0xfff4e4,
    stars: 0,
    exposure: 1.02,
    water: 0x8fb8d8,
    deep: 0x24524a,
    shadow: 0x9d93c4,
  },
  night: {
    top: 0x060b1e,
    horizon: 0x1b2a4a,
    sun: [-0.4, 0.62, -0.5],
    sunColour: 0x8aa6e6,
    sunPower: 0.8,
    hemiSky: 0x40568a,
    hemiGround: 0x1e2426,
    hemi: 0.55,
    fog: 0x141c30,
    fogNear: 30,
    fogFar: 150,
    cloud: 0.2,
    cloudColour: 0x2a3550,
    stars: 1,
    exposure: 1.24,
    water: 0x223a60,
    deep: 0x081420,
    shadow: 0x2c3866,
  },
  dawn: {
    top: 0x5a7ab8,
    horizon: 0xffc49a,
    sun: [0.8, 0.16, 0.2],
    sunColour: 0xffb784,
    sunPower: 2.1,
    hemiSky: 0xffd8c0,
    hemiGround: 0x5a5a3a,
    hemi: 0.85,
    fog: 0xf0c4a8,
    fogNear: 36,
    fogFar: 190,
    cloud: 0.6,
    cloudColour: 0xffc8a8,
    stars: 0.08,
    exposure: 1.05,
    water: 0xe8b8a0,
    deep: 0x3a3a50,
    shadow: 0xb08aa8,
  },
};
const SHIRE_MOODS = MOODS;

// A mood's shadow colour for the house look: its own, or (a town that gives
// none) its sky light's hue leaned a third toward violet, as bright as the
// sky light lets it be: pale lilac by day, deep blue by night, never grey.
const VIOLET = new THREE.Color(0x7a6ad8);
const lumOf = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
export function shadowFor(mood) {
  if (mood.shadow != null) return mood.shadow;
  const sky = new THREE.Color(mood.hemiSky ?? 0xcfe2ff);
  const want = 0.42 * lumOf(sky) * (mood.hemi ?? 1);
  const c = sky.clone().lerp(VIOLET, 0.35);
  const l = lumOf(c);
  if (l > 0) c.multiplyScalar(want / l);
  return c.getHex();
}
const KEYS = ['top', 'horizon', 'sunColour', 'hemiSky', 'hemiGround', 'fog', 'cloudColour', 'water', 'deep'];

export function makeSky(radius) {
  const uniforms = {
    uTop: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColour: { value: new THREE.Color() },
    uCloud: { value: 0.5 },
    uCloudColour: { value: new THREE.Color() },
    uStars: { value: 0 },
    uMoon: { value: 0 },
    uTime: { value: 0 },
    uGrey: { value: 0 },
    uEye: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: `
      uniform vec3 uTop, uHorizon, uSunDir, uSunColour, uCloudColour;
      uniform float uCloud, uStars, uMoon, uTime, uGrey, uEye;
      varying vec3 vDir;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
      void main() {
        vec3 d = normalize(vDir);
        float up = max(d.y, 0.0);
        vec3 col = mix(uHorizon, uTop, pow(up, 0.5));
        // below the horizon: the haze the hills fade into
        col = d.y < 0.0 ? uHorizon * 0.92 : col;
        float sd = max(dot(d, normalize(uSunDir)), 0.0);
        col += uSunColour * (pow(sd, 6.0) * 0.35 + pow(sd, 64.0) * 0.6) * (1.0 - uMoon);
        // the sun's disc, or the moon's
        col += uSunColour * smoothstep(0.9993, 0.9997, sd) * mix(6.0, 1.6, uMoon);
        // stars, twinkling, thinning towards the horizon
        if (uStars > 0.0) {
          vec2 sp = d.xz / (d.y + 0.35) * 160.0;
          float s = hash(floor(sp));
          float tw = 0.6 + 0.4 * sin(uTime * 2.0 + s * 40.0);
          float star = smoothstep(0.9965, 1.0, s) * smoothstep(0.35, 0.05, length(fract(sp) - 0.5)) * tw;
          col += vec3(1.4, 1.35, 1.2) * star * uStars * smoothstep(0.02, 0.3, d.y);
        }
        // clouds, drifting
        if (uCloud > 0.0 && d.y > 0.0) {
          vec2 p = d.xz / (d.y + 0.18);
          float c = fbm(p * 1.3 + vec2(uTime * 0.008, uTime * 0.003));
          c = smoothstep(0.48, 0.78, c);
          vec3 lit = uCloudColour * (0.8 + 0.5 * pow(sd, 3.0));
          col = mix(col, lit, c * uCloud * smoothstep(0.0, 0.18, d.y));
        }
        // the Eye, far off to the east, while the Ring is on
        if (uEye > 0.0) {
          vec3 e = normalize(vec3(1.0, 0.06, 0.25));
          float ed = dot(d, e);
          float slit = smoothstep(0.9985, 0.99985, ed) * (0.6 + 0.4 * sin(uTime * 7.0));
          col += vec3(3.0, 0.8, 0.12) * (pow(max(ed, 0.0), 300.0) * 1.4 + slit) * uEye;
        }
        float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = mix(col, vec3(l) * vec3(0.8, 0.85, 0.95), uGrey);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(radius, 40, 20), material);
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  return { dome, uniforms };
}

// Blends the moods: night 0…1 (the party), dawn 0…1 (leaving), and writes
// them into the sky, the lights, the fog and the water. Another town passes
// its own `moods`, with the same three keys and fields. With a `house`
// (lib/three/house), the look's full light, its shadow colour (a mood's
// `shadow`, or one from its sky light: shadowFor) and the sky its fog takes
// its colour from follow too, and the
// fog everything else uses is the haze under the horizon, so the two agree.
export function makeAtmosphere({ sky, sun, hemi, fog, water, stage, house = null, moods: MOODS = SHIRE_MOODS }) {
  const mix = {};
  for (const k of KEYS) mix[k] = new THREE.Color();
  mix.shadow = new THREE.Color();
  const halo = new THREE.Color();
  const tmp = new THREE.Color();
  const sunDir = new THREE.Vector3();
  const dawnSun = new THREE.Vector3(...MOODS.dawn.sun);
  const colour = (k, night, dawn) => {
    mix[k].set(MOODS.day[k]).lerp(tmp.set(MOODS.night[k]), night);
    if (dawn > 0) mix[k].lerp(tmp.set(MOODS.dawn[k]), dawn);
    return mix[k];
  };
  const num = (k, night, dawn) => {
    let v = MOODS.day[k] + (MOODS.night[k] - MOODS.day[k]) * night;
    if (dawn > 0) v += (MOODS.dawn[k] - v) * dawn;
    return v;
  };
  return (night, dawn) => {
    const u = sky.uniforms;
    u.uTop.value.copy(colour('top', night, dawn));
    u.uHorizon.value.copy(colour('horizon', night, dawn));
    u.uSunColour.value.copy(colour('sunColour', night, dawn));
    u.uCloudColour.value.copy(colour('cloudColour', night, dawn));
    u.uCloud.value = num('cloud', night, dawn);
    u.uStars.value = num('stars', night, dawn);
    u.uMoon.value = night * (1 - dawn);
    const a = MOODS.day.sun;
    const b = MOODS.night.sun;
    sunDir.set(a[0] + (b[0] - a[0]) * night, a[1] + (b[1] - a[1]) * night, a[2] + (b[2] - a[2]) * night);
    if (dawn > 0) sunDir.lerp(dawnSun, dawn);
    sunDir.normalize();
    u.uSunDir.value.copy(sunDir);
    sun.color.copy(colour('sunColour', night, dawn));
    sun.intensity = num('sunPower', night, dawn);
    hemi.color.copy(colour('hemiSky', night, dawn));
    hemi.groundColor.copy(colour('hemiGround', night, dawn));
    hemi.intensity = num('hemi', night, dawn);
    fog.color.copy(colour('fog', night, dawn));
    fog.near = num('fogNear', night, dawn);
    fog.far = num('fogFar', night, dawn);
    water.uniforms.uSky.value.copy(colour('water', night, dawn));
    water.uniforms.uDeep.value.copy(colour('deep', night, dawn));
    water.uniforms.uSun.value.copy(sunDir);
    water.uniforms.uSunColor.value.copy(sun.color);
    water.uniforms.uGlints.value = 1 - night * 0.6;
    stage.renderer.toneMappingExposure = num('exposure', night, dawn) * (house?.exposure ?? 1);
    if (house) {
      // (each mood's own shadow, or one from its sky light)
      house.set({ shadow: mix.shadow.set(shadowFor(MOODS.day)).lerp(tmp.set(shadowFor(MOODS.night)), night).lerp(tmp.set(shadowFor(MOODS.dawn)), dawn) });
      house.light({ sun, hemi });
      // (the sky dome's own halo round the sun, which the moon hasn't)
      halo.copy(u.uSunColour.value).multiplyScalar(0.35 * (1 - u.uMoon.value));
      house.sky({ low: u.uHorizon.value, high: u.uTop.value, below: 0.92, sunDir, halo });
      fog.color.copy(u.uHorizon.value).multiplyScalar(0.92);
    }
    return sunDir;
  };
}

// The house look (lib/three/house) following a town that blends its own
// moods (Doom, Edoras, Minas Tirith, Orthanc, Cirith Ungol): once a frame,
// after the town has set its lights, its sky and its exposure, the look
// takes its full light from those lights, its shadow from the sky light
// (shadowFor), and its fog from the sky; the town's other fog becomes the
// haze under the horizon, so the two agree. With the sky put away (a hall,
// a lair, the dark under a mountain) the fog stays the town's own.
const haloOf = new THREE.Color();
export function lookFrom(house, { sky, sun, hemi, fog, renderer, exposure = 1 }) {
  const u = sky.uniforms;
  const out = sky.dome.visible !== false;
  house.set({ shadow: shadowFor({ hemiSky: hemi.color.getHex(), hemi: hemi.intensity }), fogMix: out ? 1 : 0 });
  house.light({ sun, hemi });
  haloOf.copy(u.uSunColour.value).multiplyScalar(0.35 * (1 - (u.uMoon?.value ?? 0)));
  house.sky({ low: u.uHorizon.value, high: u.uTop.value, below: 0.92, sunDir: u.uSunDir.value, halo: haloOf });
  if (out) fog.color.copy(u.uHorizon.value).multiplyScalar(0.92);
  renderer.toneMappingExposure = exposure * house.exposure;
}
