// The jump to lightspeed in WebGL, with real depth: a field of stars in front
// of a perspective camera rushes toward it, so near stars sweep across the
// screen while far ones barely move. Each star is drawn as a streak whose
// length is how far it travels while the eye holds its light: a dot while
// drifting, a line snapping long at the jump, a long blue-white stroke
// curling round the vanishing point in the tunnel, then a dot again as the
// ship drops out. Same timeline and callbacks as the 2D version.

import * as THREE from 'three';
import { createRenderer, precompile } from '../../lib/three/renderer';
import { T, atPeak, clamp, clampStart, darkAt, ease, exposureAt, flashAt, holdStart, jumpStarted, speedAt, swirlOn } from './timeline';

const SEG = 10; // segments along a streak, so the swirl can bend it
const DEPTH = 80; // how deep the field is (world units)
const NEAR = 1.2; // a star this close goes round to the back again
const FOV = 60;
const PACE = 40; // world units a second per unit of the 2D speed curve
const MAX_LEN = DEPTH * 0.85;
const SPACE = [3 / 255, 7 / 255, 18 / 255]; // the deep blue-black behind the stars

const STAR_VERT = /* glsl */ `
attribute vec2 aRow;   // x: -1 head cap, 0..1 along the streak, 2 tail cap; y: side
attribute vec4 aStar;  // xy: place in the unit disc, z: depth phase, w: size
attribute vec2 aLook;  // x: tint, y: brightness
uniform float uTravel;
uniform float uLen;
uniform float uSwirl;
uniform float uTunnel;
uniform float uFade;
uniform vec2 uSpread;
uniform vec2 uView;
uniform float uPx;
varying float vAcross;
varying float vCap;
varying float vHalf;
varying float vF;
varying float vGlow;
varying vec3 vColor;

const float DEPTH = ${DEPTH.toFixed(1)};
const float NEAR = ${NEAR.toFixed(1)};

// a point f of the way from the head (nearest) to the tail, in view space;
// the swirl turns the far end more, so long streaks curve
vec3 along(float f, float dHead, float turn) {
  float d = dHead + f * uLen;
  float a = uSwirl * turn * clamp(d / (NEAR + DEPTH), 0.0, 1.0);
  vec2 xy = aStar.xy * uSpread;
  float c = cos(a);
  float s = sin(a);
  return vec3(c * xy.x - s * xy.y, s * xy.x + c * xy.y, -d);
}

vec2 toPx(vec4 clip) {
  return clip.xy / clip.w * 0.5 * uView;
}

void main() {
  float dHead = NEAR + mod(aStar.z * DEPTH - uTravel, DEPTH);
  float turn = 0.4 + aLook.x * 0.6;
  float f = clamp(aRow.x, 0.0, 1.0);
  vec3 p = along(f, dHead, turn);
  vec4 clip = projectionMatrix * vec4(p, 1.0);
  // which way the streak runs on screen here, head toward tail
  float g = f < 0.99 ? f + 0.02 : f - 0.02;
  vec2 here = toPx(clip);
  vec2 there = toPx(projectionMatrix * vec4(along(g, dHead, turn), 1.0));
  vec2 dir = f < 0.99 ? there - here : here - there;
  float len = length(dir);
  dir = len > 0.001 ? dir / len : (length(here) > 0.001 ? -normalize(here) : vec2(1.0, 0.0));
  vec2 side = vec2(-dir.y, dir.x);

  // nearer is thicker; anything under a pixel is drawn a pixel wide and dimmer
  float d = -p.z;
  float near = clamp(1.0 - (d - NEAR) / DEPTH, 0.0, 1.0);
  float hw = (0.35 + 1.25 * near * near) * aStar.w * uPx;
  float shown = max(hw, 0.7 * uPx);
  vec2 off = side * aRow.y * (shown + uPx);
  float cap = 0.0;
  if (aRow.x < 0.0) { off -= dir * shown; cap = shown; }
  if (aRow.x > 1.0) { off += dir * shown; cap = shown; }

  vAcross = aRow.y * (shown + uPx);
  vCap = cap;
  vHalf = shown;
  vF = f;
  // a star fades in as it comes out of the far dark, so nothing pops
  float arrive = 1.0 - smoothstep(NEAR + DEPTH * 0.72, NEAR + DEPTH, dHead);
  vGlow = aLook.y * arrive * uFade * (hw / shown) * (0.7 + 0.3 * near);
  float blue = mix(0.15 + aLook.x * 0.25, 0.55 + aLook.x * 0.45, uTunnel);
  vColor = vec3(1.0 - 0.43 * blue, 1.0 - 0.2 * blue, 1.0);
  gl_Position = vec4((here + off) / (0.5 * uView) * clip.w, clip.z, clip.w);
}
`;

const STAR_FRAG = /* glsl */ `
uniform float uPx;
varying float vAcross;
varying float vCap;
varying float vHalf;
varying float vF;
varying float vGlow;
varying vec3 vColor;

void main() {
  float dist = length(vec2(vAcross, vCap));
  float a = 1.0 - smoothstep(vHalf - 0.6 * uPx, vHalf + 0.6 * uPx, dist);
  // the tail is light from further back: let it fall away
  a *= vGlow * mix(1.0, 0.18, vF * vF);
  gl_FragColor = vec4(vColor * a, a);
}
`;

// full-screen passes: the glow at the vanishing point, and the flash
const SCREEN_VERT = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const GLOW_FRAG = /* glsl */ `
uniform vec2 uView;
uniform float uGlow;
void main() {
  float r = length(gl_FragCoord.xy - 0.5 * uView) / (0.5 * length(uView));
  // a blue-white core inside a wider blue, as the 2D version's gradient
  vec3 core = vec3(180.0, 215.0, 255.0) / 255.0 * 0.5 * exp(-r * r / 0.03);
  vec3 halo = vec3(70.0, 120.0, 230.0) / 255.0 * 0.3 * exp(-r * r / 0.28);
  float a = (0.5 * exp(-r * r / 0.03) + 0.3 * exp(-r * r / 0.28)) * uGlow;
  gl_FragColor = vec4((core + halo) * uGlow, min(a, 1.0));
}
`;

const FLASH_FRAG = /* glsl */ `
uniform float uFlash;
void main() {
  float a = 0.92 * uFlash;
  gl_FragColor = vec4(vec3(235.0, 244.0, 255.0) / 255.0 * a, a);
}
`;

// premultiplied colour: streaks add up, but the canvas's alpha never passes 1
const additive = {
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.OneFactor,
  blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
};
const over = {
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: THREE.OneFactor,
  blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
};

function streakGeometry(count) {
  const rows = SEG + 3;
  const row = new Float32Array(rows * 2 * 2);
  const index = [];
  for (let r = 0; r < rows; r++) {
    const f = r === 0 ? -1 : r === rows - 1 ? 2 : (r - 1) / SEG;
    row.set([f, -1, f, 1], r * 4);
    if (r < rows - 1) {
      const a = r * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  // the stars: a place in the unit disc (kept off the very centre so none
  // flies straight into the lens), a depth, a size, a tint and a brightness
  const star = new Float32Array(count * 4);
  const look = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(0.0025 + Math.random() * 0.9975);
    star.set([Math.cos(a) * r, Math.sin(a) * r, Math.random(), 0.6 + Math.random() * 0.7], i * 4);
    look.set([Math.random(), 0.35 + Math.pow(Math.random(), 0.6) * 0.65], i * 2);
  }
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('aRow', new THREE.Float32BufferAttribute(row, 2));
  // three needs a position attribute to draw; the shader builds its own
  geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(rows * 2 * 3), 3));
  geo.setIndex(index);
  geo.setAttribute('aStar', new THREE.InstancedBufferAttribute(star, 4));
  geo.setAttribute('aLook', new THREE.InstancedBufferAttribute(look, 2));
  geo.instanceCount = count;
  return geo;
}

function screenPass(frag, uniforms, blend, order) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const mat = new THREE.ShaderMaterial({ vertexShader: SCREEN_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, transparent: true, ...blend });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = order;
  return mesh;
}

// Runs the jump on `canvas` (a full-screen fixed canvas). Returns { stop }.
// Throws if WebGL can't start; calls onFail if the context is lost mid-jump.
export function run(canvas, { entry = false, onPeak, onDone, onFail, uncover }) {
  let failed = false;
  const fail = () => {
    if (failed) return;
    failed = true;
    stop();
    onFail?.();
  };
  // the intro runs while the page is still loading, so it draws at 1x
  const gl = createRenderer(canvas, { antialias: false, ratio: entry ? 1 : 1.5, onLost: fail });
  const { renderer } = gl;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 400);
  const view = new THREE.Vector2(1, 1);

  const W0 = window.innerWidth;
  const H0 = window.innerHeight;
  const count = W0 * H0 > 900000 ? 2600 : 1500;
  const starU = {
    uTravel: { value: 0 },
    uLen: { value: 0 },
    uSwirl: { value: 0 },
    uTunnel: { value: 0 },
    uFade: { value: 1 },
    uSpread: { value: new THREE.Vector2(1, 1) },
    uView: { value: view },
    uPx: { value: 1 },
  };
  const stars = new THREE.Mesh(
    streakGeometry(count),
    // double-sided: a streak's winding flips with the way it points
    new THREE.ShaderMaterial({ vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, uniforms: starU, side: THREE.DoubleSide, depthTest: false, depthWrite: false, transparent: true, ...additive }),
  );
  stars.frustumCulled = false;
  stars.renderOrder = 1;
  const glowU = { uView: { value: view }, uGlow: { value: 0 } };
  const flashU = { uFlash: { value: 0 } };
  const glow = screenPass(GLOW_FRAG, glowU, over, 0);
  const flash = screenPass(FLASH_FRAG, flashU, over, 2);
  scene.add(glow, stars, flash);

  const fit = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    gl.setSize(w, h);
    renderer.getDrawingBufferSize(view);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    starU.uPx.value = gl.ratio;
    // the field's cross-section fills the view at its far end (and the corners)
    const r = (NEAR + DEPTH) * Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * 1.2;
    starU.uSpread.value.set(r * camera.aspect, r);
  };
  fit();
  window.addEventListener('resize', fit);
  renderer.setClearColor(new THREE.Color().setRGB(...SPACE, THREE.SRGBColorSpace), 0);
  // draw one empty frame now: it compiles the shaders (so the first real
  // frame doesn't stall) and shows up a shader that won't build, in which
  // case the 2D version takes over
  let broken = false;
  renderer.debug.onShaderError = (glc, program, vs, fs) => {
    broken = true;
    if (import.meta.env.DEV) console.error('[hyperspace] shader failed', glc.getShaderInfoLog(vs), glc.getShaderInfoLog(fs), glc.getProgramInfoLog(program));
  };
  starU.uFade.value = 0;
  renderer.render(scene, camera);
  if (broken) {
    scene.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    window.removeEventListener('resize', fit);
    gl.dispose();
    throw new Error('hyperspace shaders failed');
  }

  let raf = 0;
  let start = 0;
  let last = 0;
  let swirl = 0;
  let travel = 0;
  let peaked = false;
  let done = false;
  let covered = entry;
  const peak = () => {
    if (peaked) return;
    peaked = true;
    onPeak?.();
  };

  // the intro: any click, key, scroll or touch skips to the exit
  let skipped = false;
  const skip = () => {
    if (skipped || !start) return;
    skipped = true;
    if (performance.now() - start < T.tunnel) start = performance.now() - T.tunnel;
  };
  const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
  if (entry) events.forEach((e) => window.addEventListener(e, skip, { passive: true }));

  const frame = (now) => {
    raf = 0;
    if (failed || gl.lost) return;
    // timed from the first frame actually drawn, so a slow start skips
    // nothing (and a page waiting on its dark times its fallback from there)
    if (!start) {
      start = now - (entry ? T.drift : 0);
      jumpStarted();
    }
    // (and a stall moves it on 50 ms only: starved, it waits where it was, timeline.js)
    else start = clampStart(start, last, now);
    start = holdStart(now, start); // (held in the tunnel while the galaxy builds its next system: timeline.js)
    const t = now - start;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;

    const v = speedAt(t) * PACE;
    travel += v * dt;
    swirl = swirlOn(swirl, t, dt); // (not while held: timeline.js)
    const dark = darkAt(t);
    starU.uTravel.value = travel % DEPTH;
    starU.uLen.value = Math.min(MAX_LEN, v * exposureAt(t));
    starU.uSwirl.value = swirl;
    // blue-white from the flash (which hides the change) until the exit
    starU.uTunnel.value = t < T.tunnel ? clamp((t - (T.jump - 80)) / 200) : 1 - ease(clamp((t - T.tunnel) / 260));
    starU.uFade.value = t > T.tunnel ? 0.6 + 0.4 * dark : 1;
    glowU.uGlow.value = t > T.jump - 250 && t < T.end - 120 ? (t < T.flash ? clamp((t - (T.jump - 250)) / 400) : t < T.tunnel ? 1 : 1 - clamp((t - T.tunnel) / (T.end - 120 - T.tunnel))) : 0;
    flashU.uFlash.value = flashAt(t);
    renderer.setClearAlpha(dark);
    renderer.render(scene, camera);
    if (covered) {
      covered = false;
      uncover?.();
    }
    if (atPeak(t)) peak();

    if (t < T.end) raf = requestAnimationFrame(frame);
    else {
      peak();
      done = true;
      onDone?.();
    }
  };
  // the first frame waits for the shaders to link in the background (a few
  // frames), rather than stopping the page to link them
  precompile(renderer, scene, camera).then(() => {
    if (!failed && !done && !raf) raf = requestAnimationFrame(frame);
  });

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
    window.removeEventListener('resize', fit);
    events.forEach((e) => window.removeEventListener(e, skip));
    scene.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    gl.dispose();
  }

  return {
    stop() {
      if (!failed) {
        failed = true; // nothing more after this, not even a late onFail
        stop();
      }
      return done;
    },
  };
}
