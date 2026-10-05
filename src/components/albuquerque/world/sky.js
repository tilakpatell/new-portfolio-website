// Albuquerque's sky, and the light that comes from it, through a whole day.
//
// The time of day is one number: 0 is midnight, 0.25 sunrise, 0.5 noon and
// 0.75 sunset. `lightAt(tod)` says where the sun and the moon are and what
// colour everything is lit; `createSky()` is the dome that draws it: the
// gradient, the sun and its glow, the belt of pink opposite a low sun, the
// stars and the moon, an aurora (once it's earned) and the clouds, which
// cross the sky fast, the way the shows' time-lapses have them.

import * as THREE from 'three';
import { noiseAtlas } from '../../../lib/texture';


const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// The sun: up in the east, over the south, down in the west.
export function sunAt(tod, out = new THREE.Vector3()) {
  const a = (tod - 0.25) * Math.PI * 2;
  return out.set(Math.cos(a), Math.sin(a) * 0.92, 0.36 * Math.sin(a) + 0.2).normalize();
}

const C = (hex) => new THREE.Color(hex);
const PAL = {
  sunLow: C(0xff7a3a),
  sunHigh: C(0xfff0dc),
  moon: C(0x8fb0ff),
  skyDay: C(0xb7d3f0),
  skyDusk: C(0xf0a488),
  skyNight: C(0x24345c),
  groundDay: C(0xb08a5a),
  groundNight: C(0x191c2b),
  fogNoon: C(0xd9d6cc),
  fogDusk: C(0xeab489),
  fogNight: C(0x0c1222),
};

// Everything the scene's lights need for a time of day. `out` is reused.
export function lightAt(tod, out = {}) {
  const sun = sunAt(tod, out.sun ?? new THREE.Vector3());
  const e = sun.y;
  const day = smooth(-0.1, 0.2, e);
  const night = 1 - smooth(-0.3, 0, e);
  const dusk = 1 - smooth(0, 0.45, Math.abs(e + 0.02));
  const moon = (out.moon ?? new THREE.Vector3()).set(-sun.x * 0.8, Math.max(0.3, -e * 0.9 + 0.15), -sun.z - 0.3).normalize();
  const up = e > -0.03;
  out.sun = sun;
  out.moon = moon;
  out.day = day;
  out.night = night;
  out.dusk = dusk;
  // the one light that casts shadows: the sun while it's up, then the moon
  out.key = up ? sun : moon;
  out.keyColor = (out.keyColor ?? new THREE.Color()).copy(up ? PAL.sunLow : PAL.moon);
  if (up) out.keyColor.lerp(PAL.sunHigh, smooth(0.02, 0.5, e));
  out.keyIntensity = up ? 0.25 + 2.35 * smooth(-0.03, 0.2, e) - 0.35 * smooth(0.5, 0.9, e) : 0.75 * smooth(0.03, 0.22, -e);
  out.hemiSky = (out.hemiSky ?? new THREE.Color()).copy(PAL.skyNight).lerp(PAL.skyDay, day).lerp(PAL.skyDusk, dusk * 0.5);
  out.hemiGround = (out.hemiGround ?? new THREE.Color()).copy(PAL.groundNight).lerp(PAL.groundDay, day);
  out.hemiIntensity = 0.3 + 0.55 * day;
  out.fog = (out.fog ?? new THREE.Color()).copy(PAL.fogNight).lerp(PAL.fogNoon, day).lerp(PAL.fogDusk, dusk * day * 0.85);
  out.exposure = 0.92 + 0.06 * day;
  out.env = 0.12 + 0.25 * day;
  return out;
}

const VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const FRAG = /* glsl */ `
  uniform vec3 uSun;
  uniform vec3 uMoon;
  uniform float uTime;
  uniform float uCover;
  uniform float uAurora;
  uniform sampler2D uNoise;
  varying vec3 vDir;

  float hash(vec3 p) {
    p = fract(p * vec3(443.897, 441.423, 437.195));
    p += dot(p, p.yzx + 19.19);
    return fract((p.x + p.y) * p.z);
  }
  float cloudNoise(vec2 p) {
    return texture2D(uNoise, p).r * 0.56 + texture2D(uNoise, p * 2.63 + 0.31).r * 0.29 + texture2D(uNoise, p * 6.9 + 0.67).g * 0.15;
  }

  void main() {
    vec3 d = normalize(vDir);
    float h = max(d.y, 0.0);
    float e = uSun.y;
    float day = smoothstep(-0.10, 0.20, e);
    float night = 1.0 - smoothstep(-0.30, 0.0, e);
    float dusk = 1.0 - smoothstep(0.0, 0.45, abs(e + 0.02));

    // the gradient: deep overhead, pale at the horizon
    vec3 zen = mix(vec3(0.006, 0.010, 0.032), vec3(0.085, 0.24, 0.60), day);
    vec3 hor = mix(vec3(0.020, 0.032, 0.075), vec3(0.50, 0.68, 0.88), day);
    // a low sun: orange towards it, the pink belt and the earth's blue shadow away from it
    vec2 az = normalize(d.xz + 1e-5);
    float toward = dot(az, normalize(uSun.xz + 1e-5)) * 0.5 + 0.5;
    vec3 warm = mix(vec3(0.62, 0.26, 0.40), vec3(1.35, 0.55, 0.15), smoothstep(0.15, 0.95, toward));
    hor = mix(hor, warm, dusk * (0.5 + 0.5 * toward));
    zen = mix(zen, vec3(0.13, 0.11, 0.34), dusk * 0.6);
    float low = pow(1.0 - h, 3.2);
    vec3 c = mix(zen, hor, low);
    c = mix(c, c * vec3(0.62, 0.70, 0.95), dusk * (1.0 - toward) * smoothstep(0.10, 0.0, h) * 0.6);

    // the sun: a wide glow, a tight one, the disc
    float s = max(dot(d, uSun), 0.0);
    float upS = smoothstep(-0.07, 0.015, e);
    vec3 sunCol = mix(vec3(1.0, 0.42, 0.15), vec3(1.0, 0.93, 0.80), smoothstep(0.0, 0.5, e));
    c += sunCol * upS * (pow(s, 7.0) * (0.16 + 0.42 * dusk) + pow(s, 110.0) * 0.7 + smoothstep(0.99935, 0.9997, s) * 11.0);

    // the clouds, on a flat ceiling, drifting fast
    vec2 uv = d.xz / (d.y + 0.14);
    vec2 wind = vec2(0.011, 0.004) * uTime;
    float n = cloudNoise(uv * 0.055 + wind);
    float cover = 1.0 - uCover;
    float dens = smoothstep(cover, cover + 0.24, n) * smoothstep(0.015, 0.16, d.y);
    // lit from the sun's side: compare with the noise a step towards it
    vec2 toSun = normalize(uSun.xz + 1e-5) * 0.014;
    float lit = clamp((n - cloudNoise(uv * 0.055 + wind + toSun)) * 5.0 + 0.62, 0.0, 1.0);
    vec3 cloudDay = mix(vec3(0.50, 0.55, 0.66), vec3(1.0, 0.99, 0.96), lit);
    vec3 cloudDusk = mix(vec3(0.26, 0.17, 0.30), mix(vec3(1.0, 0.50, 0.42), vec3(1.5, 0.66, 0.24), toward), lit);
    vec3 cloudNight = mix(vec3(0.018, 0.024, 0.045), vec3(0.085, 0.10, 0.16), lit);
    vec3 cloud = mix(mix(cloudNight, cloudDay, day), cloudDusk, dusk * day);
    // high streaks of cirrus
    float cir = texture2D(uNoise, uv * vec2(0.010, 0.045) + wind * 0.4 + 0.5).g;
    float streak = smoothstep(0.62, 0.92, cir) * smoothstep(0.05, 0.3, d.y) * 0.4;

    // the stars and the galaxy's band, behind the clouds
    float starry = night * (1.0 - dens) * smoothstep(0.0, 0.12, d.y);
    if (starry > 0.01) {
      vec3 p = d * 190.0;
      vec3 ip = floor(p);
      float r = hash(ip);
      float tw = 0.7 + 0.3 * sin(uTime * (1.5 + r * 5.0) + r * 40.0);
      float star = step(0.9962, r) * smoothstep(0.42, 0.05, length(fract(p) - 0.5)) * tw;
      vec3 tint = mix(vec3(0.75, 0.84, 1.0), vec3(1.0, 0.86, 0.70), fract(r * 91.7));
      float band = smoothstep(0.55, 0.0, abs(dot(d, normalize(vec3(0.45, 0.25, -0.86))))) * texture2D(uNoise, d.xz * 0.9 + d.y).r;
      c += starry * (tint * star * 2.4 + vec3(0.10, 0.11, 0.17) * band * 0.55);
      // the moon: a disc with seas, and its halo
      float m = max(dot(d, uMoon), 0.0);
      float disc = smoothstep(0.99925, 0.99945, m);
      float seas = texture2D(uNoise, d.xy * 9.0 + d.z * 4.0).r;
      c += night * (1.0 - dens) * (vec3(0.82, 0.88, 1.0) * disc * (1.5 + seas * 2.2) + vec3(0.25, 0.32, 0.5) * pow(m, 220.0) * 0.6);
    }
    // the aurora: blue curtains, once the last of the Blue Sky is found
    if (uAurora > 0.01) {
      float curtain = texture2D(uNoise, vec2(uv.x * 0.02 + uTime * 0.006, 0.3)).r;
      float fold = sin(uv.x * 0.55 + curtain * 9.0 + uTime * 0.25) * 0.5 + 0.5;
      float band2 = smoothstep(0.10, 0.34, d.y) * smoothstep(0.85, 0.36, d.y);
      float rays = 0.55 + 0.45 * texture2D(uNoise, vec2(uv.x * 0.35 + curtain, uTime * 0.02)).g;
      c += uAurora * (0.35 + 0.65 * night) * (1.0 - dens * 0.8) * band2 * pow(fold, 2.2) * rays * mix(vec3(0.05, 0.45, 1.6), vec3(0.2, 1.4, 1.5), d.y * 1.6);
    }

    c = mix(c, cloud, dens * 0.94);
    c = mix(c, mix(cloud, vec3(1.0), 0.3 * day), streak * (1.0 - dens));
    gl_FragColor = vec4(c, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export function createSky({ radius = 1300 } = {}) {
  const noise = new THREE.DataTexture(noiseAtlas(256, 11), 256, 256, THREE.RGBAFormat);
  noise.wrapS = noise.wrapT = THREE.RepeatWrapping;
  noise.magFilter = THREE.LinearFilter;
  noise.minFilter = THREE.LinearMipmapLinearFilter;
  noise.generateMipmaps = true;
  noise.needsUpdate = true;
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uSun: { value: new THREE.Vector3(0, 1, 0) },
      uMoon: { value: new THREE.Vector3(0, 1, 0) },
      uTime: { value: 0 },
      uCover: { value: 0.56 },
      uAurora: { value: 0 },
      uNoise: { value: noise },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
  });
  const geometry = new THREE.SphereGeometry(radius, 48, 24);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return {
    mesh,
    noise,
    uniforms: material.uniforms,
    dispose() {
      geometry.dispose();
      material.dispose();
      noise.dispose();
    },
  };
}
