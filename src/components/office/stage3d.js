// The office's WebGL stage: one renderer, scene and camera, set up the way
// both 3D views need them (filmic tone mapping, soft shadows, the office HDRI
// for light and reflections), plus the watchdog the site's 3D games share:
// if frames can't keep up it first drops resolution, then shadows, then asks
// to go back to 2D; a lost context does the same at once.

import * as THREE from 'three';

export function createStage(canvas, { onLost, onSlow, fov = 50 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const coarse = typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches ?? false);
  let ratio = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);
  renderer.setPixelRatio(ratio);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9e6df);
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.05, 120);
  const size = { w: 1, h: 1 };

  const resize = (w, h) => {
    size.w = Math.max(1, Math.round(w));
    size.h = Math.max(1, Math.round(h));
    renderer.setPixelRatio(ratio);
    renderer.setSize(size.w, size.h, false);
    camera.aspect = size.w / size.h;
    camera.updateProjectionMatrix();
  };

  let lost = false;
  const onContextLost = (e) => {
    e.preventDefault();
    lost = true;
    onLost?.();
  };
  canvas.addEventListener('webglcontextlost', onContextLost);

  // the watchdog: two seconds of frames at a time
  const perf = { acc: 0, n: 0, step: 0 };
  const watch = (ms) => {
    perf.acc += ms;
    perf.n += 1;
    if (perf.n < 120) return;
    const avg = perf.acc / perf.n;
    perf.acc = 0;
    perf.n = 0;
    if (avg < 24) return;
    perf.step += 1;
    if (perf.step === 1 && ratio > 1) {
      ratio = 1;
      resize(size.w, size.h);
    } else if (perf.step <= 2) renderer.shadowMap.enabled = false;
    else if (avg > 34) onSlow?.();
  };

  const tmp = new THREE.Vector3();
  // where a world point is on the canvas, in CSS pixels (and whether it's in front)
  const project = (x, y, z) => {
    tmp.set(x, y, z).project(camera);
    return { x: ((tmp.x + 1) / 2) * size.w, y: ((1 - tmp.y) / 2) * size.h, front: tmp.z < 1 };
  };

  const render = (ms = 16) => {
    if (lost) return;
    renderer.render(scene, camera);
    watch(ms);
  };

  const dispose = () => {
    canvas.removeEventListener('webglcontextlost', onContextLost);
    scene.traverse((o) => {
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) m.dispose?.();
    });
    renderer.dispose();
  };

  return { renderer, scene, camera, size, resize, project, render, dispose, coarse, get lost() { return lost; } };
}

// The office's light: the HDRI for ambient and reflections, a cool overhead
// key standing in for the fluorescent troffers (it casts the shadows), and a
// soft fill from the windows.
export function lightOffice(stage, kit, { target = new THREE.Vector3(), span = 16, shadowSize = 2048 } = {}) {
  const { scene, renderer } = stage;
  if (kit.env) {
    scene.environment = kit.env;
    scene.environmentIntensity = 0.55;
  }
  const hemi = new THREE.HemisphereLight(0xf4f6ff, 0x5d6170, 0.55);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xf5f7ff, 1.9);
  key.position.set(target.x + span * 0.35, span * 0.9, target.z + span * 0.5);
  key.target.position.copy(target);
  key.castShadow = true;
  const mobile = stage.coarse;
  key.shadow.mapSize.set(mobile ? Math.min(1024, shadowSize) : shadowSize, mobile ? Math.min(1024, shadowSize) : shadowSize);
  const c = key.shadow.camera;
  c.left = -span;
  c.right = span;
  c.top = span;
  c.bottom = -span;
  c.near = 1;
  c.far = span * 3;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 3;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xfff1dc, 0.45);
  fill.position.set(target.x - span, span * 0.4, target.z - span * 0.6);
  scene.add(fill);
  renderer.toneMappingExposure = 1.0;
  return { hemi, key, fill };
}
