// The clouds over the city: a few dozen banks of them, each a cluster of
// soft puffs turned to the camera, from 900 m to 1,500 m up, drifting on
// the wind. Lit on top and grey underneath, tinted by the time of day,
// hazed like everything else far off, and thinned to nothing round the
// camera, so he flies into one and out the other side. And the sky photo's
// own colours, which the haze takes (skyBands), and a sky of just those
// colours for high up (buildHaze).

import * as THREE from 'three';
import { rng } from './map';
import { sharpen } from '../../../lib/three/textures';

// sRGB bytes to linear light
const LIN = Float32Array.from({ length: 256 }, (_, i) => {
  const v = i / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
});
const BANDS = new WeakMap();

// The sky photo's colours, in linear light as the background draws them
// (before its intensity), each averaged right round: `horizon`, its first
// few degrees, where far hills and towers meet it; `below`, the haze just
// under it; `high`, the sky well overhead. So the haze the city fades into
// is the sky behind it, not one tint for every time of day. Read once a
// photo, from a copy shrunk to 256 × 128 (an equirect's middle row is the
// horizon). Null when there's no photo or it can't be read.
export function skyBands(photo) {
  const img = photo?.image;
  if (!img?.width || typeof document === 'undefined') return null;
  if (BANDS.has(photo)) return BANDS.get(photo);
  let out = null;
  try {
    const w = 256;
    const h = 128;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingQuality = 'high';
    x.drawImage(img, 0, 0, w, h);
    const px = x.getImageData(0, 0, w, h).data;
    // (the rows between two elevations, in degrees)
    const band = (lo, hi) => {
      const y0 = Math.round((0.5 - hi / 180) * h);
      const y1 = Math.max(y0 + 1, Math.round((0.5 - lo / 180) * h));
      const sum = [0, 0, 0];
      for (let i = y0 * w * 4; i < y1 * w * 4; i += 4) for (let k = 0; k < 3; k++) sum[k] += LIN[px[i + k]];
      const n = (y1 - y0) * w;
      return new THREE.Color(sum[0] / n, sum[1] / n, sum[2] / n);
    };
    out = { horizon: band(0, 4), below: band(-4, 0), high: band(30, 75) };
  } catch {
    out = null; // (the engine's own tint stands)
  }
  BANDS.set(photo, out);
  return out;
}

// The sky as the haze has it, on a dome round the camera: the horizon's
// colour, the haze's under it, the overhead colour above (as the house
// look's fog has it, lib/three/house). Faded in over the photo as he
// climbs: up there the photo dims toward space and its clouds turn to dark
// banks along the horizon, and the land's haze would end in a line against
// them. Drawn after the photo and before everything else, the stars too
// (in the opaque pass, blended by its own opacity).
export function buildHaze() {
  const uniforms = {
    uLow: { value: new THREE.Color() },
    uHigh: { value: new THREE.Color() },
    uBelow: { value: 1 },
    uOpacity: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uLow, uHigh;
      uniform float uBelow, uOpacity;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        vec3 c = d.y < 0.0 ? uLow * uBelow : mix(uLow, uHigh, pow(max(d.y, 0.0), 0.5));
        gl_FragColor = vec4(c, uOpacity);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(100, 24, 12), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -11; // (the stars are -10)
  mesh.visible = false;
  mesh.name = 'haze';
  return {
    mesh,
    // its colours (linear) and how much of the photo it hides; out of the
    // way altogether at nothing
    set(low, high, below, opacity) {
      uniforms.uLow.value.copy(low);
      uniforms.uHigh.value.copy(high);
      uniforms.uBelow.value = below;
      uniforms.uOpacity.value = opacity;
      mesh.visible = opacity > 0.002;
    },
    // round the camera, wherever it is
    update(camera) {
      mesh.position.copy(camera.position);
    },
  };
}

function puffTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const r = rng(77);
  for (let i = 0; i < 22; i++) {
    const px = 64 + (r() - 0.5) * 56;
    const py = 64 + (r() - 0.5) * 40;
    const rad = 16 + r() * 26;
    const g = x.createRadialGradient(px, py, 0, px, py, rad);
    g.addColorStop(0, 'rgba(255,255,255,0.42)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(c);
  sharpen(t);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildClouds({ small = false } = {}) {
  const r = rng(404);
  const banks = small ? 34 : 60;
  const rows = [];
  for (let i = 0; i < banks; i++) {
    const cx = (r() * 2 - 1) * 6500;
    const cz = (r() * 2 - 1) * 6500;
    const cy = 900 + r() * 600;
    const size = 140 + r() * 260;
    const n = 7 + Math.floor(r() * 9);
    for (let k = 0; k < n; k++) rows.push([cx + (r() - 0.5) * size * 2.2, cy + (r() - 0.5) * size * 0.35, cz + (r() - 0.5) * size * 1.4, size * (0.45 + r() * 0.55), r()]);
  }
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.setAttribute('aPuff', new THREE.InstancedBufferAttribute(new Float32Array(rows.flatMap((q) => q.slice(0, 4))), 4));
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(rows.map((q) => q[4])), 1));
  geo.instanceCount = rows.length;
  const uniforms = {
    uMap: { value: puffTexture() },
    uTime: { value: 0 },
    uLit: { value: new THREE.Color(1, 1, 1) },
    uShade: { value: new THREE.Color(0.62, 0.66, 0.74) },
    uFogColor: { value: new THREE.Color(0.7, 0.75, 0.8) },
    uFogDensity: { value: 0.00026 },
    uOpacity: { value: 0.92 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute vec4 aPuff; // x, y, z, size
      attribute float aSeed;
      uniform float uTime;
      varying vec2 vUv;
      varying float vDist;
      varying float vSeed;
      void main() {
        vUv = uv;
        vec3 c = aPuff.xyz;
        // the wind: east, and round again
        c.x = mod(c.x + uTime * 4.0 + 7000.0, 14000.0) - 7000.0;
        vec4 mv = viewMatrix * vec4(c, 1.0);
        mv.xy += position.xy * aPuff.w;
        vDist = -mv.z;
        vSeed = aSeed;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform vec3 uLit, uShade, uFogColor;
      uniform float uFogDensity, uOpacity;
      varying vec2 vUv;
      varying float vDist;
      varying float vSeed;
      void main() {
        vec2 uv = vUv;
        // each puff turned a different way, so they don't repeat
        float a = vSeed * 6.2831;
        uv = mat2(cos(a), -sin(a), sin(a), cos(a)) * (uv - 0.5) + 0.5;
        vec4 t = texture2D(uMap, uv);
        float alpha = t.a * uOpacity;
        // thin round the camera: fly in one side and out the other
        alpha *= smoothstep(25.0, 160.0, vDist);
        vec3 col = mix(uShade, uLit, smoothstep(0.15, 0.85, vUv.y));
        float fog = 1.0 - exp(-pow(uFogDensity * vDist * 0.7, 2.0));
        col = mix(col, uFogColor, fog);
        gl_FragColor = vec4(col, alpha * (1.0 - fog * 0.6));
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  mesh.name = 'clouds';
  return {
    mesh,
    uniforms,
    // the light: lit by the sun's colour, shaded by the sky's
    setLook({ lit, shade, opacity = 0.92 }) {
      uniforms.uLit.value.setRGB(...lit);
      uniforms.uShade.value.setRGB(...shade);
      uniforms.uOpacity.value = opacity;
    },
    update(t, fog) {
      uniforms.uTime.value = t;
      if (fog) {
        uniforms.uFogColor.value.copy(fog.color);
        uniforms.uFogDensity.value = fog.density ?? 0;
      }
    },
  };
}
