// The WebGL renderer every page scene draws with: sRGB output, a pixel ratio
// the device can afford, a watchdog that trades sharpness for frame rate before
// giving up on 3D, context loss reported (not thrown), and a dispose that frees
// everything a scene made. Only lazily loaded scene modules import this, so a
// page that never draws in 3D never downloads three.js.

import * as THREE from 'three';
import { budget, pixelRatio } from '../device';

// The sharpest a device starts at: lib/device's tier (phones and small
// screens start lower), under the scene's own cap.
export const maxRatio = (cap = 2) => pixelRatio(cap);

// A [r, g, b] (0-255, sRGB) from lib/three/theme as a THREE.Color.
export const color = (rgb, target = new THREE.Color()) => target.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace);

export function createRenderer(canvas, { alpha = true, antialias = true, ratio = 2, toneMapping = THREE.NoToneMapping, exposure = 1, onLost, onSlow } = {}) {
  // (in development, window.__tpKeepFrames keeps the last frame readable for
  // automated screenshots of scenes that have stopped drawing)
  const preserveDrawingBuffer = import.meta.env.DEV && typeof window !== 'undefined' && !!window.__tpKeepFrames;
  // a weak device skips multisampling: at its pixel ratio it costs more than it shows
  const renderer = new THREE.WebGLRenderer({ canvas, alpha, antialias: antialias && budget().antialias, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer });
  // reading a shader's error log waits on the graphics chip, every new
  // shader: only worth it while developing
  renderer.debug.checkShaderErrors = Boolean(import.meta.env.DEV);
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

  const dog = watchdog({
    ratio: pixelRatio,
    set(r) {
      pixelRatio = r;
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(size.w, size.h, false);
    },
    onSlow: () => onSlow?.(),
  });

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
    watch: dog.watch,
    dispose() {
      canvas.removeEventListener('webglcontextlost', onContextLost);
      renderer.dispose();
      if (!lost) renderer.forceContextLoss?.(); // free the GPU now, not at GC
    },
  };
}

// Slow frames, measured over a couple of seconds of real drawing (a pause
// longer than a second starts the count again). 3D first: nothing falls
// back to 2D for being slow. A stretch is slow when its typical frame (the
// slowest few left out, so a model arriving doesn't count) is under about
// 45fps, which on a 60Hz screen means it's missing the screen's beat.
// Sharpness steps down a quarter at a time, after two slow stretches in a
// row; if that and one more made frames no faster, they're taken back and
// that's the end of it (the screen or the browser is holding frames to 30,
// as a laptop on battery can, or the time is going somewhere sharpness
// doesn't reach). At the floor the scene is told once, so it can lower its own
// effects.
// `set(ratio)` applies a new sharpness; `watch(now)` is called once per
// drawn frame.
export function watchdog({ ratio, set, onSlow, floor = 0.75, slow = 22 }) {
  const gaps = [];
  let window0 = 0;
  let lastAt = 0;
  let slowRuns = 0;
  let tried = null; // the steps just taken: { from, before, steps }
  let settled = false;
  let told = false;
  let pixelRatio = ratio;
  const sharpness = (r) => {
    pixelRatio = r;
    set(r);
  };
  const watch = (now) => {
    if (!lastAt || now - lastAt > 1000) {
      lastAt = now;
      window0 = now;
      gaps.length = 0;
      return;
    }
    gaps.push(now - lastAt);
    lastAt = now;
    if (now - window0 < 2500 || gaps.length < 45) return;
    gaps.sort((a, b) => a - b);
    const keep = gaps.length - Math.ceil(gaps.length * 0.05);
    let spent = 0;
    for (let i = 0; i < keep; i++) spent += gaps[i];
    const typical = spent / keep;
    window0 = now;
    gaps.length = 0;
    const down = () => sharpness(Math.max(floor, Math.round((pixelRatio - 0.25) * 4) / 4));
    if (tried) {
      if (typical <= tried.before * 0.92) tried = null;
      else if (tried.steps < 2 && pixelRatio > floor) {
        // (with the screen's beat, one step may not be enough to show)
        tried.steps += 1;
        down();
      } else {
        sharpness(tried.from);
        settled = true;
        tried = null;
      }
      return;
    }
    slowRuns = typical < slow ? 0 : slowRuns + 1;
    if (slowRuns < 2 || settled) return;
    slowRuns = 0;
    if (pixelRatio > floor) {
      tried = { from: pixelRatio, before: typical, steps: 1 };
      down();
    } else if (!told) {
      told = true;
      onSlow?.();
    }
  };
  return { watch };
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
