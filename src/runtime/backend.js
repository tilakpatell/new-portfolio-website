// Which renderer the runtime makes, and why. Pure, so it can be tested.
//
// 'webgpu' only when the browser has WebGPU and the module promises its
// materials are nodes (TSL): WebGPURenderer can't run a ShaderMaterial, an
// onBeforeCompile patch or an EffectComposer. 'webgl' otherwise, and always
// after a WebGPU device has been lost (one downgrade, never a loop). The
// visitor can force either with ?gpu=webgl|webgpu in the address or
// localStorage 'tp-gpu' (readOverride), short of a gpu that isn't there.

export const KINDS = ['webgl', 'webgpu'];

export function pickBackend({ gpu = false, shading = 'glsl', override = null, lost = false } = {}) {
  if (lost || !gpu) return 'webgl';
  if (KINDS.includes(override)) return override;
  return shading === 'nodes' ? 'webgpu' : 'webgl';
}

// ?gpu= in the search, or after the ? in the hash (the site uses hash
// routes), else what's stored.
export function readOverride(search = '', hash = '', stored = null) {
  const fromSearch = new URLSearchParams(search).get('gpu');
  const fromHash = new URLSearchParams(hash.split('?')[1] ?? '').get('gpu');
  const q = fromSearch ?? fromHash;
  if (KINDS.includes(q)) return q;
  if (q != null) return null; // asked for something that isn't a backend: nothing forced
  return KINDS.includes(stored) ? stored : null;
}
