// The 3D games' common ground: a renderer set up the same way for each (ACES
// tone mapping, sRGB, bloom for things that glow), sized to its canvas,
// that steps its own quality down when frames run long, tells the game when
// the GPU goes away, and frees everything it made when the game ends.
//
// Loaded only with a game, so nobody else downloads Three.js.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// Bright colours for things that glow: above 1, so bloom picks them up.
export const hot = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(k);

// A canvas as a texture, repeating, sharp at a glancing angle.
export function canvasTexture(canvas, renderer, { repeat = [1, 1], srgb = true, wrap = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Free a whole tree: geometries, materials and every texture they hold.
export function disposeTree(root) {
  root.traverse((o) => {
    o.geometry?.dispose?.();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      for (const v of Object.values(m)) if (v && v.isTexture) v.dispose();
      if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u?.value?.isTexture) u.value.dispose();
      m.dispose?.();
    }
    o.dispose?.(); // instanced meshes, skeletons
  });
}

// Steps down when frames run long: sharpness first, then shadows, then
// bloom, then sharpness again. Nothing comes back during a game, so the
// picture doesn't flicker between settings.
const LADDER = ['full', 'ratio', 'shadows', 'bloom', 'low'];

export function createStage(canvas, { soft = false, bloom = { strength: 0.65, radius: 0.42, threshold: 0.82 }, exposure = 1, shadows = false, fov = 60, near = 0.1, far = 600, onLost, onSlow } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !soft, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false, stencil: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.shadowMap.enabled = shadows && !soft;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const full = Math.min(soft ? 1 : 1.75, window.devicePixelRatio || 1);
  let ratio = full;
  renderer.setPixelRatio(ratio);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 16 / 9, near, far);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), bloom.strength, bloom.radius, bloom.threshold);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
  let useBloom = !soft;
  let level = soft ? LADDER.indexOf('bloom') : 0;

  let size = { w: 1, h: 1 };
  const resize = (w, h) => {
    size = { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) };
    renderer.setPixelRatio(ratio);
    renderer.setSize(size.w, size.h, false);
    composer.setPixelRatio(ratio);
    composer.setSize(size.w, size.h);
    bloomPass.resolution.set(size.w / 2, size.h / 2);
    camera.aspect = size.w / size.h;
    camera.updateProjectionMatrix();
  };

  // The GPU can go away (a driver reset, too many tabs): stop and tell the game.
  let lost = false;
  const onContextLost = (e) => {
    e.preventDefault();
    lost = true;
    onLost?.();
  };
  canvas.addEventListener('webglcontextlost', onContextLost);

  const setLevel = (name) => {
    level = Math.max(level, LADDER.indexOf(name));
    if (level >= LADDER.indexOf('ratio') && ratio > 1) {
      ratio = 1;
      resize(size.w, size.h);
    }
    if (level >= LADDER.indexOf('shadows') && renderer.shadowMap.enabled) {
      renderer.shadowMap.enabled = false;
      scene.traverse((o) => {
        if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true));
      });
    }
    if (level >= LADDER.indexOf('bloom')) useBloom = false;
    if (level >= LADDER.indexOf('low') && ratio > 0.75) {
      ratio = 0.75;
      resize(size.w, size.h);
    }
  };
  if (soft) setLevel('bloom');

  // Average the last two seconds of frames; past 24 ms, step down one rung.
  const perf = { acc: 0, n: 0, warm: 30 };
  const watch = (ms) => {
    if (perf.warm > 0) {
      perf.warm -= 1; // the first frames compile shaders
      return;
    }
    perf.acc += Math.min(ms, 250);
    perf.n += 1;
    if (perf.n < 120) return;
    const avg = perf.acc / perf.n;
    perf.acc = 0;
    perf.n = 0;
    if (avg < 24) return;
    if (level < LADDER.length - 1) setLevel(LADDER[level + 1]);
    else onSlow?.(avg);
  };

  const render = (ms = 16) => {
    if (lost || disposed) return;
    if (useBloom) composer.render();
    else renderer.render(scene, camera);
    watch(ms);
  };

  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    canvas.removeEventListener('webglcontextlost', onContextLost);
    disposeTree(scene);
    if (scene.environment?.isTexture) scene.environment.dispose();
    if (scene.background?.isTexture) scene.background.dispose();
    composer.dispose?.();
    bloomPass.dispose?.();
    renderer.dispose();
    // the canvas is the game's own and goes with it: give the context back now
    renderer.forceContextLoss();
  };

  return {
    renderer,
    scene,
    camera,
    composer,
    bloomPass,
    resize,
    render,
    dispose,
    setLevel,
    get size() {
      return size;
    },
    get lost() {
      return lost;
    },
    get disposed() {
      return disposed;
    },
    get quality() {
      return LADDER[level];
    },
    get shadows() {
      return renderer.shadowMap.enabled;
    },
  };
}
