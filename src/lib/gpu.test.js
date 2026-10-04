import { describe, expect, it } from 'vitest';
import { classify, probe, resolve3D } from './gpu';

const fakeDoc = (renderer, { webgl2 = true, webgl = true } = {}) => ({
  createElement: () => ({
    getContext: (kind) => {
      if ((kind === 'webgl2' && !webgl2) || (kind !== 'webgl2' && !webgl)) return null;
      return {
        getExtension: (name) => (name === 'WEBGL_debug_renderer_info' ? { UNMASKED_RENDERER_WEBGL: 1 } : name === 'WEBGL_lose_context' ? { loseContext: () => {} } : null),
        getParameter: () => renderer,
        RENDERER: 2,
      };
    },
  }),
});

describe('telling a real GPU from software WebGL', () => {
  it('calls SwiftShader, llvmpipe and Microsoft’s basic driver software', () => {
    for (const r of ['ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)', 'llvmpipe (LLVM 15.0.7, 256 bits)', 'ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11)', 'Apple Software Renderer']) {
      expect(classify(r).software).toBe(true);
    }
  });

  it('calls real graphics chips hardware', () => {
    for (const r of ['ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0)', 'Apple M2', 'Adreno (TM) 650', 'Mali-G78', 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11)']) {
      expect(classify(r).software).toBe(false);
    }
  });

  it('finds WebGL 2 on a GPU', () => {
    expect(probe(fakeDoc('Apple M2'))).toMatchObject({ webgl: true, webgl2: true, software: false, ok: true });
  });

  it('falls back to WebGL 1 and still works', () => {
    expect(probe(fakeDoc('Adreno (TM) 506', { webgl2: false }))).toMatchObject({ webgl: true, webgl2: false, ok: true });
  });

  it('does not count software WebGL as good enough on its own', () => {
    expect(probe(fakeDoc('llvmpipe (LLVM 15)'))).toMatchObject({ webgl: true, software: true, ok: false });
  });

  it('reports no WebGL at all, or a browser that throws, as none', () => {
    expect(probe(fakeDoc('x', { webgl2: false, webgl: false }))).toMatchObject({ webgl: false, ok: false });
    expect(probe({ createElement: () => ({ getContext: () => { throw new Error('blocked'); } }) })).toMatchObject({ webgl: false, ok: false });
    expect(probe(undefined)).toMatchObject({ webgl: false, ok: false });
  });
});

describe('choosing 3D or 2D', () => {
  const gpu = { webgl: true, ok: true };
  const soft = { webgl: true, ok: false };
  const none = { webgl: false, ok: false };

  it('uses 3D wherever WebGL exists, even drawn in software', () => {
    expect(resolve3D('auto', gpu)).toBe(true);
    expect(resolve3D('auto', soft)).toBe(true);
    expect(resolve3D('auto', none)).toBe(false);
  });

  it('lets the visitor turn it off, or on where WebGL exists at all', () => {
    expect(resolve3D('off', gpu)).toBe(false);
    expect(resolve3D('on', soft)).toBe(true);
    expect(resolve3D('on', none)).toBe(false);
  });
});
