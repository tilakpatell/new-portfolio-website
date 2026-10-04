// The WebGL renderer every page scene draws with: sRGB output, a pixel ratio
// the device can afford, a watchdog that trades sharpness for frame rate before
// giving up on 3D, context loss reported (not thrown), and a dispose that frees
// everything a scene made. Only lazily loaded scene modules import this, so a
// page that never draws in 3D never downloads three.js.

import * as THREE from 'three';

const coarse = () => window.matchMedia?.('(pointer: coarse)').matches ?? false;

// The sharpest a device starts at. Phones and small screens start lower.
export function maxRatio(cap = 2) {
  const narrow = Math.min(window.screen?.width ?? 1920, window.innerWidth ?? 1920) < 700;
  const mem = navigator.deviceMemory ?? 8;
  const start = coarse() || narrow || mem <= 4 ? Math.min(cap, 1.5) : cap;
  return Math.min(start, window.devicePixelRatio || 1);
}

// A [r, g, b] (0-255, sRGB) from lib/three/theme as a THREE.Color.
export const color = (rgb, target = new THREE.Color()) => target.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace);

export function createRenderer(canvas, { alpha = true, antialias = true, ratio = 2, toneMapping = THREE.NoToneMapping, exposure = 1, onLost, onSlow } = {}) {
  // (in development, window.__tpKeepFrames keeps the last frame readable for
  // automated screenshots of scenes that have stopped drawing)
  const preserveDrawingBuffer = import.meta.env.DEV && typeof window !== 'undefined' && !!window.__tpKeepFrames;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha, antialias, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = toneMapping;
  renderer.toneMappingExposure = exposure;
  if (alpha) renderer.setClearColor(0x000000, 0);

  let pixelRatio = maxRatio(ratio);
  renderer.setPixelRatio(pixelRatio);
  const size = { w: 1, h: 1 };

  let lost = false;
  const onContextLost = (e) => {
    e.preventDefault();
    lost = true;
    onLost?.();
  };
  canvas.addEventListener('webglcontextlost', onContextLost);

  // Slow frames, measured over a couple of seconds of real drawing (a pause
  // longer than a second starts the count again). 3D first: nothing falls
  // back to 2D for being slow. Sharpness steps down a quarter at a time, and
  // only after two slow stretches in a row, so a hiccup doesn't cost
  // anything; at the floor the scene is told once, so it can lower its own
  // effects.
  const FLOOR = 0.75;
  let spent = 0;
  let frames = 0;
  let window0 = 0;
  let lastAt = 0;
  let slowRuns = 0;
  let told = false;
  const watch = (now) => {
    if (!lastAt || now - lastAt > 1000) {
      lastAt = now;
      window0 = now;
      spent = 0;
      frames = 0;
      return;
    }
    spent += now - lastAt;
    frames += 1;
    lastAt = now;
    if (now - window0 < 2500 || frames < 60) return;
    const avg = spent / frames;
    window0 = now;
    spent = 0;
    frames = 0;
    // 25fps or better is fine (a laptop on battery caps at 30)
    slowRuns = avg < 40 ? 0 : slowRuns + 1;
    if (slowRuns < 2) return;
    slowRuns = 0;
    if (pixelRatio > FLOOR) {
      pixelRatio = Math.max(FLOOR, Math.round((pixelRatio - 0.25) * 4) / 4);
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(size.w, size.h, false);
    } else if (!told) {
      told = true;
      onSlow?.();
    }
  };

  return {
    renderer,
    get lost() {
      return lost;
    },
    get ratio() {
      return pixelRatio;
    },
    setSize(w, h) {
      size.w = Math.max(1, Math.round(w));
      size.h = Math.max(1, Math.round(h));
      renderer.setSize(size.w, size.h, false);
    },
    size,
    // call once per drawn frame, with the frame's timestamp
    watch,
    dispose() {
      canvas.removeEventListener('webglcontextlost', onContextLost);
      renderer.dispose();
      if (!lost) renderer.forceContextLoss?.(); // free the GPU now, not at GC
    },
  };
}

// Free every geometry, material and texture under `root`.
export function disposeTree(root) {
  const seen = new Set();
  const free = (thing) => {
    if (!thing || seen.has(thing)) return;
    seen.add(thing);
    thing.dispose?.();
  };
  root.traverse((o) => {
    free(o.geometry);
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      for (const value of Object.values(m)) if (value?.isTexture) free(value);
      if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u?.value?.isTexture) free(u.value);
      free(m);
    }
  });
}

// Easing the site already uses in CSS: cubic-bezier(0.16, 1, 0.3, 1) is
// close to an exponential ease-out.
export const easeOut = (t) => (t >= 1 ? 1 : t <= 0 ? 0 : 1 - 2 ** (-10 * t));
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
