// The WebGL backend: lib/three/renderer's WebGLRenderer (sRGB out, a
// pixel ratio the runtime sets, the context given back on dispose), its
// precompile for `compile`, and an EffectComposer for a post chain
// described as data.
//
// createWebGL(canvas, { budget, onLost, alpha, toneMapping, exposure }) → gfx

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { createRenderer, precompile, precompilePasses, uploadTextures } from '../lib/three/renderer';
import { makeGfx } from './gfx';

// [{ kind: 'render', scene, camera }, { kind: 'bloom', strength, radius,
// threshold }, { kind: 'shader', material }, { kind: 'output' }] → a
// composer with those passes, in that order
export function buildComposer(renderer, passes, size) {
  const composer = new EffectComposer(renderer);
  const made = [];
  for (const p of passes) {
    let pass;
    if (p.kind === 'render') pass = new RenderPass(p.scene, p.camera);
    else if (p.kind === 'bloom') pass = new UnrealBloomPass(new THREE.Vector2(size.w, size.h), p.strength ?? 0.5, p.radius ?? 0.4, p.threshold ?? 0.85);
    else if (p.kind === 'shader') pass = new ShaderPass(p.material, p.textureID ?? 'tDiffuse');
    else if (p.kind === 'output') pass = new OutputPass();
    else throw new Error(`unknown pass ${p.kind}`);
    if (p.enabled === false) pass.enabled = false;
    composer.addPass(pass);
    made.push(pass);
  }
  return {
    composer,
    passes: made,
    render: () => composer.render(),
    setSize: (w, h) => composer.setSize(w, h),
    compile: (camera) => precompilePasses(renderer, composer, camera),
    dispose: () => composer.dispose(),
  };
}

// (`invalidate`: the runtime's, asked for a frame when something the frame
// guard held back is ready)
export function createWebGL(canvas, { budget, onLost, invalidate, alpha = true, toneMapping = THREE.NoToneMapping, exposure = 1 } = {}) {
  const gl = createRenderer(canvas, { alpha, antialias: budget?.antialias ?? true, ratio: budget?.ratio ?? 2, toneMapping, exposure, onLost, guard: { invalidate } });
  const { renderer } = gl;
  const gfx = makeGfx({
    backend: 'webgl',
    renderer,
    canvas,
    compile: (root, camera, scene, target) => precompile(renderer, root, camera, scene, target),
    upload: (root) => uploadTextures(renderer, root),
    post: (passes) => buildComposer(renderer, passes, gfx.size),
    isLost: () => gl.lost,
    release: () => gl.dispose(),
  });
  // (lib/three/renderer sizes through gl; the gfx keeps the same numbers)
  gfx.setSize = (w, h) => {
    gfx.size.w = Math.max(1, Math.round(w));
    gfx.size.h = Math.max(1, Math.round(h));
    gl.setSize(gfx.size.w, gfx.size.h);
  };
  return gfx;
}
