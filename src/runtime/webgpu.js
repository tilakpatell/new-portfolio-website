// The WebGPU backend: three/webgpu's WebGPURenderer, initialised before
// the first frame, with three/tsl's PostProcessing for a post chain
// described as data. Only a 'nodes' module gets it (backend.js): it can't
// run a ShaderMaterial, an onBeforeCompile patch or an EffectComposer, so
// a 'shader' pass is refused here. A lost device is reported through
// onLost, and the runtime comes back on WebGL.
//
// createWebGPU(canvas, { budget, onLost, alpha, toneMapping, exposure }) → Promise<gfx>

import * as THREE from 'three';
import { settle } from '../lib/settle';
import { makeGfx } from './gfx';

export const hasWebGPU = () => typeof navigator !== 'undefined' && Boolean(navigator.gpu);

// the chain as data → a PostProcessing graph; `ready` resolves once the
// nodes are loaded, and render() draws nothing until then
export function buildPostProcessing(renderer, passes) {
  let post = null;
  let scenePass = null;
  const ready = Promise.all([import('three/webgpu'), import('three/tsl'), import('three/addons/tsl/display/BloomNode.js')]).then(([webgpu, tsl, bloomMod]) => {
    post = new webgpu.PostProcessing(renderer);
    let node = null;
    for (const p of passes) {
      if (p.kind === 'render') {
        scenePass = tsl.pass(p.scene, p.camera);
        node = scenePass.getTextureNode();
      } else if (p.kind === 'bloom') {
        if (!node) throw new Error('a bloom pass needs a render pass first');
        node = node.add(bloomMod.bloom(node, p.strength ?? 0.5, p.radius ?? 0.4, p.threshold ?? 0.85));
      } else if (p.kind === 'output') {
        // (the output transform is the renderer's own on this backend)
      } else if (p.kind === 'shader') throw new Error('a shader pass needs the webgl backend');
      else throw new Error(`unknown pass ${p.kind}`);
    }
    post.outputNode = node;
    return post;
  });
  return {
    ready,
    get passes() {
      return passes;
    },
    render: () => post?.render(),
    setSize: () => {},
    compile: () => settle(ready, 4000),
    dispose: () => {
      post?.dispose?.();
      scenePass?.dispose?.();
    },
  };
}

export async function createWebGPU(canvas, { budget, onLost, alpha = true, toneMapping = THREE.NoToneMapping, exposure = 1 } = {}) {
  const { WebGPURenderer } = await import('three/webgpu');
  const renderer = new WebGPURenderer({ canvas, alpha, antialias: budget?.antialias ?? true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = toneMapping;
  renderer.toneMappingExposure = exposure;
  if (alpha) renderer.setClearColor(0x000000, 0);
  await renderer.init();
  let lost = false;
  const device = renderer.backend?.device;
  device?.lost?.then(() => {
    lost = true;
    onLost?.();
  });
  return makeGfx({
    backend: 'webgpu',
    renderer,
    canvas,
    compile: (root, camera, scene) => settle(renderer.compileAsync(root, camera, scene ?? root), 4000),
    upload: (root) =>
      root.traverse((o) => {
        for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
          for (const v of Object.values(m)) {
            if (v?.isTexture && v.image) {
              try {
                renderer.initTexture(v);
              } catch {
                /* it goes up on its first frame */
              }
            }
          }
        }
      }),
    post: (passes) => buildPostProcessing(renderer, passes),
    isLost: () => lost,
  });
}
