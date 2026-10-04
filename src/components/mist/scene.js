// Low cloud over a lake, drawn in one full-screen shader at half resolution
// (mist is soft, so the extra pixels would buy nothing) and about 30 frames a
// second (it moves too slowly to tell). It is five banks of mist standing on
// the water at increasing distances: far banks crowd toward the shoreline,
// small and settled into haze; near ones are broad, soft and low. The same
// wind and the same small nudge of the eye (the pointer) move a near bank
// further across the screen than a far one, which is what makes it read as
// depth, and scrolling through the photo lifts the near banks a little.
// Colour: near-white in light mode, a cool grey in dark mode, never the accent.

import * as THREE from 'three';
import { createRenderer } from '../../lib/three/renderer';
import { mix } from '../../lib/three/theme';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uLook;
uniform float uScroll;
uniform vec3 uTint;
uniform float uAlpha;
uniform float uHorizon; // the shoreline's height at the middle, 0 = bottom
uniform float uTilt;    // how it rises or falls across the box
uniform float uClear;

const float Z_FAR = 8.0;

// hash without sine: stable on phone GPUs at large coordinates
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

const mat2 ROT = mat2(0.8, -0.6, 0.6, 0.8);

float fbm3(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p = ROT * p * 2.03 + 11.7;
    a *= 0.5;
  }
  return v / 0.875;
}

float fbm5(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = ROT * p * 2.01 + 7.3;
    a *= 0.5;
  }
  return v / 0.96875;
}

// One bank of mist standing on the water at distance z (1 is the nearest).
// Its foot sits where the water at that distance meets the screen: just
// below the bottom edge for the nearest, the shoreline for the farthest.
// Positions on the bank are in world units, so the wind and the eye's nudge
// move a near bank further across the screen.
float bank(vec2 uv, float aspect, float shore, float z, float height, float seed) {
  float c = (shore + 0.04) / (1.0 - 1.0 / Z_FAR);
  float foot = -0.04 + c * (1.0 - 1.0 / z) + (uScroll * 0.12 + uLook.y * 0.012) / z;
  vec2 w = vec2((uv.x - 0.5) * aspect * z, (uv.y - foot) * z);
  w.x += uLook.x * 0.05 + uTime * 0.012 + seed;
  // a bank is deep as well as tall, so its foot is soft on screen
  float body = smoothstep(foot - 0.07, foot + 0.025, uv.y);
  // (most of the screen is clear of any one bank: skip the noise there)
  if (body <= 0.0 || w.y > height * 1.5 * 6.0) return 0.0;
  // a ragged top: the bank rises and dips along its length
  float top = height * (0.3 + 1.2 * fbm3(vec2(w.x * 0.7, seed * 0.37 + uTime * 0.006)));
  body *= exp(-max(w.y, 0.0) / max(top, 0.02) * 1.4);
  // patches, with clear water between them
  float cover = smoothstep(0.2, 0.55, fbm3(vec2(w.x * 0.32 + seed, uTime * 0.004 + seed)));
  if (body * cover < 0.002) return 0.0;
  // wisps inside it, long and low, curling slowly
  vec2 p = w * vec2(1.8, 8.0);
  vec2 q = vec2(fbm3(p * 0.5 + vec2(0.0, uTime * 0.02)), fbm3(p * 0.5 + vec2(4.7, 1.9) - uTime * 0.016));
  float n = fbm5(p + (q - 0.5) * 2.4 + vec2(-uTime * 0.03, 0.0));
  // far banks are finer than a pixel can show: let them settle to haze
  n = mix(n, 0.6, smoothstep(0.12, 0.35, 8.0 * z / uRes.y));
  return body * cover * smoothstep(0.36, 0.68, n);
}

void main() {
  vec2 uv = vUv;
  float aspect = uRes.x / uRes.y;
  float shore = uHorizon + uTilt * (uv.x - 0.5);
  float a = 0.0;
  // back to front, each over the last
  a = mix(a, 1.0, bank(uv, aspect, shore, 8.0, 0.4, 3.1) * 0.85);
  a = mix(a, 1.0, bank(uv, aspect, shore, 5.0, 0.34, 11.7) * 0.7);
  a = mix(a, 1.0, bank(uv, aspect, shore, 3.0, 0.3, 23.9) * 0.62);
  a = mix(a, 1.0, bank(uv, aspect, shore, 1.8, 0.26, 37.3) * 0.55);
  a = mix(a, 1.0, bank(uv, aspect, shore, 1.0, 0.24, 52.1) * 0.45);

  // it lies low: densest over the near water
  a *= mix(1.0, 0.75, smoothstep(0.0, shore, uv.y));
  // and thins behind the headline
  a *= 1.0 - uClear * (1.0 - smoothstep(0.18, 0.6, uv.x)) * smoothstep(shore - 0.3, shore + 0.04, uv.y);
  a *= uAlpha;

  // a hair of dither so the soft edges don't band in 8 bits
  a += (hash(gl_FragCoord.xy + fract(uTime * 7.0) * 61.0) - 0.5) / 255.0;
  a = clamp(a, 0.0, 1.0);
  gl_FragColor = vec4(uTint * a, a);
}
`;

// near-white in light mode; in dark mode a cool grey, as if lit by the sky
function tint(c) {
  if (!c.dark) return { rgb: mix(c.surface, c.bgDeep, 0.25), alpha: 0.8 };
  const base = mix(c.muted, c.text, 0.22);
  const lum = 0.2126 * base[0] + 0.7152 * base[1] + 0.0722 * base[2];
  const grey = mix(base, [lum, lum, lum], 0.55);
  return { rgb: [grey[0] - 4, grey[1], grey[2] + 6].map((v) => Math.max(0, Math.min(255, v))), alpha: 0.78 };
}

// Where the photo's shoreline lands in the box. The photo fills the box like
// object-fit: cover (centred); `shore` is the shoreline's height from the top
// of the photo at its left and right edges. Returns its height from the
// bottom of the box at the box's middle, and how much it changes across it.
function shoreIn(w, h, ratio, [left, right]) {
  const scale = Math.max(w, h / ratio);
  const shownW = scale;
  const shownH = scale * ratio;
  const boxX = (px) => (px * shownW - (shownW - w) / 2) / w;
  const boxY = (py) => 1 - (py * shownH - (shownH - h) / 2) / h;
  const x0 = boxX(0);
  const x1 = boxX(1);
  const tilt = (boxY(right) - boxY(left)) / (x1 - x0);
  return { mid: boxY(left) + tilt * (0.5 - x0), tilt };
}

const FPS_GAP = 31; // ms between drawn frames

export function create(canvas, ctx) {
  const gl = createRenderer(canvas, { antialias: false, ratio: 0.5, onLost: ctx.onLost, onSlow: ctx.onSlow });
  const { renderer } = gl;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const geo = new THREE.BufferGeometry();
  // one triangle that covers the screen
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const uniforms = {
    uRes: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 40 + Math.random() * 200 },
    uLook: { value: new THREE.Vector2() },
    uScroll: { value: 0 },
    uTint: { value: new THREE.Vector3(1, 1, 1) },
    uAlpha: { value: 0.5 },
    uHorizon: { value: 0.45 },
    uTilt: { value: 0 },
    uClear: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, depthTest: false, depthWrite: false, blending: THREE.NoBlending });
  const quad = new THREE.Mesh(geo, mat);
  quad.frustumCulled = false;
  scene.add(quad);

  let props = { ratio: ctx.ratio, shore: ctx.shore, clear: ctx.clear ?? 0 };
  const size = { w: 1, h: 1 };
  const place = () => {
    const s = shoreIn(size.w, size.h, props.ratio, props.shore);
    uniforms.uHorizon.value = s.mid;
    uniforms.uTilt.value = s.tilt;
    uniforms.uClear.value = props.clear;
  };
  const recolor = (c) => {
    const t = tint(c);
    uniforms.uTint.value.set(t.rgb[0] / 255, t.rgb[1] / 255, t.rgb[2] / 255);
    uniforms.uAlpha.value = t.alpha;
  };
  recolor(ctx.colors);

  // the pointer nudges the eye a little (fine pointers only); both it and the
  // scroll position ease, so nothing jumps
  const look = { x: 0, y: 0, tx: 0, ty: 0 };
  let scroll = 0;
  const fine = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches ?? false;
  const onMove = (e) => {
    const r = ctx.el.getBoundingClientRect();
    look.tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    look.ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
  };
  // how far the box has scrolled up past the top of the screen, 0 to 1
  const scrolled = () => {
    const r = ctx.el.getBoundingClientRect();
    return r.height ? Math.max(0, Math.min(1, -r.top / r.height)) : 0;
  };
  let listening = false;
  const listen = (on) => {
    if (ctx.reduced || !fine || on === listening) return;
    listening = on;
    if (on) window.addEventListener('pointermove', onMove, { passive: true });
    else window.removeEventListener('pointermove', onMove);
  };

  let lastDraw = 0;
  let drawn = false;
  const draw = () => {
    renderer.render(scene, camera);
    drawn = true;
  };

  return {
    resize(w, h) {
      size.w = Math.max(1, w);
      size.h = Math.max(1, h);
      gl.setSize(size.w, size.h);
      renderer.getDrawingBufferSize(uniforms.uRes.value);
      place();
      drawn = false;
    },
    setVisible(on) {
      listen(on);
    },
    setColors(c) {
      recolor(c);
      drawn = false;
    },
    update(next) {
      if (!next) return;
      props = { ...props, ...next };
      place();
      drawn = false;
    },
    render(ms, now) {
      if (gl.lost) return false;
      gl.watch(now);
      // reduced motion: one still frame, redrawn only when something changes
      if (ctx.reduced) {
        if (!drawn) draw();
        return false;
      }
      const k = 1 - Math.exp(-ms / 600);
      look.x += (look.tx - look.x) * k;
      look.y += (look.ty - look.y) * k;
      scroll += (scrolled() - scroll) * (1 - Math.exp(-ms / 250));
      uniforms.uTime.value += ms / 1000;
      if (drawn && now - lastDraw < FPS_GAP) return true;
      lastDraw = now;
      uniforms.uLook.value.set(look.x, -look.y);
      uniforms.uScroll.value = scroll;
      draw();
      return true;
    },
    dispose() {
      listen(false);
      geo.dispose();
      mat.dispose();
      gl.dispose();
    },
  };
}
