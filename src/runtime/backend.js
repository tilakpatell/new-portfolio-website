// Which renderer the runtime makes, and why. Pure, so it can be tested.
//
// Three kinds. 'webgl' is the classic WebGLRenderer, and every 'glsl'
// module gets it, always: its ShaderMaterials, onBeforeCompile patches and
// EffectComposers run nowhere else. A 'nodes' module (its materials are
// TSL) never meets the classic renderer, which can't draw a node material:
// it gets 'webgpu' (WebGPURenderer on a WebGPU device) when the browser has
// WebGPU, and 'nodes-webgl' (the same renderer forced onto WebGL 2)
// everywhere else: no navigator.gpu, a device lost once (one downgrade,
// never a loop), or ?gpu=webgl. So the override picks between the two
// kinds a 'nodes' module can run on and does nothing for a 'glsl' one,
// which used to be handed WebGPU it couldn't draw on. The visitor sets it
// with ?gpu=webgl|webgpu in the address or localStorage 'tp-gpu'
// (readOverride); 'nodes-webgl' is the runtime's own, never asked for.

export const KINDS = ['webgl', 'webgpu', 'nodes-webgl'];

const ASKABLE = ['webgl', 'webgpu'];

export function pickBackend({ gpu = false, shading = 'glsl', override = null, lost = false } = {}) {
  if (shading !== 'nodes') return 'webgl';
  if (lost || !gpu || override === 'webgl') return 'nodes-webgl';
  return 'webgpu';
}

// ?gpu= in the search, or after the ? in the hash (the site uses hash
// routes), else what's stored.
export function readOverride(search = '', hash = '', stored = null) {
  const fromSearch = new URLSearchParams(search).get('gpu');
  const fromHash = new URLSearchParams(hash.split('?')[1] ?? '').get('gpu');
  const q = fromSearch ?? fromHash;
  if (ASKABLE.includes(q)) return q;
  if (q != null) return null; // asked for something that isn't a backend: nothing forced
  return ASKABLE.includes(stored) ? stored : null;
}
