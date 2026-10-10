// The GLSL a WebGPU port removes: the classic renderer's shader materials,
// patches and post passes under src/, which three/webgpu refuses. Each world
// ported to node materials (TSL) lowers it, and the ratchet keeps it down, so
// the number is the WebGPU lane's progress bar and the one
// docs/stack/webgpu-tsl.md quotes.
// Design: docs/superpowers/specs/2026-10-08-webgpu-acceleration-design.md.
import { metric } from './context.mjs';
import { isTest, uncomment } from './graph.mjs';

export const NAMES = ['RawShaderMaterial', 'ShaderMaterial', 'onBeforeCompile', 'EffectComposer', 'ShaderPass', 'UnrealBloomPass', 'RenderPass', 'OutputPass'];

// the infrastructure that names these words to wrap or choose a renderer, not
// to draw with GLSL: the same list the WebGPU design's closure guard exempts,
// so the two counts agree. A path ending in / is a folder
export const EXEMPT = ['src/lib/three/frameGuard.js', 'src/lib/three/renderer.js', 'src/lib/three/gpuWork.js', 'src/runtime/'];

// one alternation, longest first and whole words, so RawShaderMaterial is one
// site and not a RawShaderMaterial and a ShaderMaterial
const RE = new RegExp(`\\b(?:${[...NAMES].sort((a, b) => b.length - a.length).join('|')})\\b`, 'g');

export const sites = (text) => (text.match(RE) ?? []).length;

const exempt = (rel) => EXEMPT.some((e) => (e.endsWith('/') ? rel.startsWith(e) : rel === e));

export default async function glslSites(ctx) {
  const detail = [];
  let total = 0;
  for (const p of ctx.src) {
    const rel = ctx.rel(p);
    if (isTest(p) || exempt(rel)) continue;
    // a comment that names a ShaderMaterial is no site
    const n = sites(uncomment(await ctx.read(p)));
    if (!n) continue;
    total += n;
    detail.push({ file: rel, n });
  }
  return metric({ id: 'glsl-sites', label: 'GLSL sites a WebGPU port removes', unit: 'sites', value: total, detail });
}
