// The runtime's browser parts, loaded on the first mount (they bring
// three.js with them): the backends and the loaders.

import { loadTexture, forgetTexture } from '../lib/three/textures';
import { loadGltf, forgetGltf } from '../lib/three/gltf';
import { loadBuffer } from '../lib/audio';
import { createWebGL } from './webgl';
import { createWebGPU } from './webgpu';

export function makeBackend(kind, opts) {
  const canvas = document.createElement('canvas');
  canvas.className = 'world-canvas';
  // ('nodes-webgl' is the node renderer on WebGL 2: never the classic one)
  return kind === 'webgl' ? createWebGL(canvas, opts) : createWebGPU(canvas, { ...opts, forceWebGL: kind === 'nodes-webgl' });
}

export const loaders = {
  texture: (url, opts) => loadTexture(url, opts),
  gltf: (url, opts) => loadGltf(url, opts),
  audio: (url) => loadBuffer(url),
};

export const forget = {
  texture: (url) => forgetTexture(url),
  gltf: (url) => forgetGltf(url),
};
