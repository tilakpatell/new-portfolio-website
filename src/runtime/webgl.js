// The WebGL backend: lib/three/renderer's WebGLRenderer (sRGB out, a
// pixel ratio the runtime sets, the context given back on dispose), its
// precompile for `compile`, and an EffectComposer for a post chain
// described as data. Tone-mapped the house’s way (Neutral, lib/three/house)
// unless a world asks for none, and a bloom pass that names no numbers
// takes the house’s (lib/three/bloom: only what is over white glows).
//
// createWebGL(canvas, { budget, onLost, alpha, toneMapping, exposure }) → gfx

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BLOOM } from '../lib/three/bloom';
import { NODE_PASSES } from '../lib/three/light/post';
import { createRenderer, fitRatio, maxSide, precompile, precompilePasses, uploadTextures } from '../lib/three/renderer';
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
    else if (p.kind === 'bloom') pass = new UnrealBloomPass(new THREE.Vector2(size.w, size.h), p.strength ?? BLOOM.strength, p.radius ?? BLOOM.radius, p.threshold ?? BLOOM.threshold);
    else if (p.kind === 'shader') pass = new ShaderPass(p.material, p.textureID ?? 'tDiffuse');
    else if (p.kind === 'output') pass = new OutputPass();
    else if (NODE_PASSES.has(p.kind)) throw new Error(`a ${p.kind} pass needs the node renderer (a 'nodes' world): lib/three/light/post.js gives the classic renderer render, bloom and output only`);
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
export function createWebGL(canvas, { budget, onLost, invalidate, alpha = true, toneMapping = THREE.NeutralToneMapping, exposure = 1 } = {}) {
  const gl = createRenderer(canvas, { alpha, antialias: budget?.antialias ?? true, ratio: budget?.ratio ?? 2, toneMapping, exposure, onLost, guard: { invalidate } });
  const { renderer } = gl;
  // The gfx sizes the renderer itself, at the runtime's ratio, never through
  // gl.setSize: that put back lib/three/renderer's own ratio (the budget's,
  // for the page scenes and their watchdog), so the runtime and that one
  // took turns at the canvas, the galaxy drew at 2 on a 2× screen under its
  // 1.5 cap, and each quality step jumped from one to the other.
  const side = maxSide(renderer);
  const gfx = makeGfx({
    backend: 'webgl',
    renderer,
    canvas,
    compile: (root, camera, scene, target) => precompile(renderer, root, camera, scene, target),
    upload: (root) => uploadTextures(renderer, root),
    post: (passes) => buildComposer(renderer, passes, gfx.size),
    isLost: () => gl.lost,
    release: () => gl.dispose(),
    fit: (w, h, r) => fitRatio(w, h, r, { side }),
  });
  return gfx;
}
