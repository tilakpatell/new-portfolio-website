// Lamplight over Akshardham at night, for the "message of peace". The photo
// itself, drawn by a shader: the lit stone and lamps glow and flicker a
// little, out of step with each other, as oil lamps do; a soft warm halo
// rises off the brightest light; and only the reflection in the lake moves,
// a slow shimmer far smaller than the photo's own ripples. Each pluck of the
// tanpura, when the visitor plays it, swells the light a little.
// It replaces the CSS slow zoom and breathing glow, at the same pace.

import * as THREE from 'three';
import { clamp01, createRenderer } from '../../lib/three/renderer';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform sampler2D uPhoto;
  uniform vec2 uView;     // canvas size, px
  uniform float uAspect;  // photo width / height
  uniform float uTime;
  uniform float uDrift;   // 0..1 along the slow zoom
  uniform float uPluck;   // 0..1, a pluck's swell
  uniform float uWater;   // the water line, from the photo's top
  uniform float uStill;   // 1 under reduced motion
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

  void main() {
    // object-fit: cover, centred, then the slow zoom the CSS used to do
    // (1.08 to 1.16, drifting up and left)
    vec2 uv = vUv;
    float viewAspect = uView.x / uView.y;
    vec2 scale = viewAspect > uAspect ? vec2(1.0, uAspect / viewAspect) : vec2(viewAspect / uAspect, 1.0);
    float zoom = 1.08 + 0.08 * uDrift;
    uv = (uv - 0.5) * scale / zoom + 0.5 + vec2(0.015, -0.01) * uDrift;
    float fromTop = 1.0 - uv.y;

    // the lake: below the water line, a slow sideways shimmer that grows with
    // distance from the shore (and a touch more on a pluck)
    float t = uTime * (1.0 - uStill);
    float lake = smoothstep(uWater, uWater + 0.06, fromTop);
    float swell = 0.6 + 0.4 * sin(t * 0.37);
    float wave = sin(fromTop * 380.0 + t * 1.15 + noise(vec2(fromTop * 30.0, t * 0.2)) * 4.0);
    uv.x += lake * wave * (0.0009 + 0.0011 * uPluck) * swell * (1.0 - uStill);

    vec3 col = texture2D(uPhoto, uv).rgb;

    // where the light is: bright and warm (not the blue sky)
    float lum = luma(col);
    float warm = smoothstep(0.04, 0.22, col.r - col.b);
    float lit = smoothstep(0.42, 0.85, lum) * warm;

    // lamps flicker out of step: slow patches of brighter and dimmer, and a
    // finer, quicker shiver on top
    float slow = noise(uv * vec2(9.0, 6.0) + vec2(t * 0.21, -t * 0.13)) - 0.5;
    float quick = noise(uv * vec2(46.0, 30.0) + t * 1.7) - 0.5;
    col *= 1.0 + lit * ((0.09 * slow + 0.035 * quick) * (1.0 - uStill) + 0.14 * uPluck);

    // a soft halo rising off the brightest light, from a blurred mip of the
    // photo, breathing on a seven-second cycle
    vec3 soft = texture2D(uPhoto, uv, 5.0).rgb;
    float halo = smoothstep(0.28, 0.7, luma(soft)) * smoothstep(0.04, 0.2, soft.r - soft.b);
    float breathe = 0.85 + 0.15 * sin(t * 0.9);
    col += vec3(1.0, 0.72, 0.38) * halo * (0.07 * breathe + 0.08 * uPluck);

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export async function create(canvas, ctx) {
  const { src, aspect, water = 0.52 } = ctx;
  const gl = createRenderer(canvas, { alpha: false, antialias: false, ratio: 1, onLost: ctx.onLost, onSlow: ctx.onSlow });
  const { renderer } = gl;

  // the photo, decoded before the first frame so the swap from the <img> is
  // seamless
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  await img.decode();
  const photo = new THREE.Texture(img);
  photo.colorSpace = THREE.SRGBColorSpace;
  photo.generateMipmaps = true;
  photo.minFilter = THREE.LinearMipmapLinearFilter;
  photo.needsUpdate = true;
  renderer.initTexture(photo);

  const uniforms = {
    uPhoto: { value: photo },
    uView: { value: new THREE.Vector2(1, 1) },
    uAspect: { value: aspect },
    uTime: { value: 0 },
    uDrift: { value: 0 },
    uPluck: { value: 0 },
    uWater: { value: water },
    uStill: { value: ctx.reduced ? 1 : 0 },
  };
  const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, depthTest: false, depthWrite: false });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const camera = new THREE.Camera();

  // the tanpura's plucks (Peace.jsx sends them as a window event)
  let pluck = 0;
  const onPluck = () => {
    pluck = Math.min(1, pluck + 0.65);
    ctx.invalidate();
  };
  window.addEventListener('tp:tanpura', onPluck);

  // the CSS zoom took 40 s each way; keep the pace
  const start = performance.now();
  let lastDraw = 0;
  return {
    resize(w, h) {
      gl.setSize(w, h);
      uniforms.uView.value.set(Math.max(1, w), Math.max(1, h));
    },
    render(ms, now) {
      if (gl.lost) return false;
      if (ctx.reduced) {
        renderer.render(scene, camera);
        return false; // one still frame
      }
      // ambient light doesn't need 60 frames a second: about 30 is plenty
      pluck = Math.max(0, pluck - ms / 1400);
      if (now - lastDraw < 30) return true;
      lastDraw = now;
      const s = (now - start) / 1000;
      uniforms.uTime.value = s;
      uniforms.uDrift.value = 0.5 - 0.5 * Math.cos((s / 40) * Math.PI);
      uniforms.uPluck.value = clamp01(pluck) ** 1.5;
      renderer.render(scene, camera);
      gl.watch(now);
      return true;
    },
    dispose() {
      window.removeEventListener('tp:tanpura', onPluck);
      photo.dispose();
      material.dispose();
      quad.geometry.dispose();
      gl.dispose();
    },
  };
}
