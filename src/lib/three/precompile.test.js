import { describe, expect, it } from 'vitest';
import { precompile } from './renderer';
import { fakeRenderer as gpuRenderer, frames } from './fakeRenderer.fixture';

// a stand-in for a WebGLRenderer, as far as precompile() touches one
const fakeRenderer = ({ compile = () => new Set(), restore = () => {} } = {}) => {
  let target = null;
  let sets = 0;
  return {
    getRenderTarget: () => target,
    setRenderTarget: (t) => {
      sets += 1;
      if (sets > 1) restore();
      target = t;
    },
    compile,
    getContext: () => ({ isContextLost: () => false }),
    properties: { get: () => ({ currentProgram: { isReady: () => true } }) },
  };
};

describe('precompile', () => {
  it('resolves once the shaders are linked', async () => {
    await expect(precompile(fakeRenderer({ compile: () => new Set([{}, {}]) }), {}, {}, null, 'buffer')).resolves.toBeUndefined();
  });

  it('never throws, even when the renderer goes while it compiles', async () => {
    const gone = fakeRenderer({
      compile: () => {
        throw new Error('disposed');
      },
      restore: () => {
        throw new Error('disposed');
      },
    });
    let p;
    expect(() => (p = precompile(gone, {}, {}, null, 'buffer'))).not.toThrow();
    await expect(p).resolves.toBeUndefined();
  });

  // (the Task 2 stand-in, with KHR_parallel_shader_compile or without)
  const parallelRenderer = (opts, has = true) => {
    const r = gpuRenderer(opts);
    r.extensions = { has: (name) => has && name === 'KHR_parallel_shader_compile' };
    r.getRenderTarget = () => null;
    r.setRenderTarget = () => {};
    return r;
  };
  const meshes = (n) => ({ traverse: (fn) => Array.from({ length: n }, () => fn({ material: {} })).length });

  it('asks no shader whether it has linked until a fence has signalled, with the extension', async () => {
    const r = parallelRenderer({ signalAfter: 3 });
    await precompile(r, meshes(2), {}, null, undefined, { frame: frames() });
    expect(r.gl.fences).toBe(1);
    expect(r.gl.log.filter((x) => x === 'ready?').length).toBe(2);
    expect(r.gl.log.lastIndexOf('signal')).toBeLessThan(r.gl.log.indexOf('ready?'));
  });

  it('asks again once a frame until every shader has linked', async () => {
    const r = parallelRenderer({ readyAfter: 2 });
    const frame = frames();
    await precompile(r, meshes(1), {}, null, undefined, { frame });
    // (two frames of fence, then two more frames of asking)
    expect(r.gl.log.filter((x) => x === 'ready?').length).toBe(3);
    expect(frame.count).toBe(4);
  });

  it('resolves without asking when the fence cannot say (the context went)', async () => {
    const r = parallelRenderer({ signalAfter: Infinity, lostAfterPolls: 1 });
    await expect(precompile(r, meshes(2), {}, null, undefined, { frame: frames() })).resolves.toBeUndefined();
    expect(r.gl.log).not.toContain('ready?');
  });

  it('asks at once, with no fence, without the extension (where asking never waits)', async () => {
    const r = parallelRenderer({}, false);
    await precompile(r, meshes(2), {}, null, undefined, { frame: frames() });
    expect(r.gl.fences).toBe(0);
    expect(r.gl.log.filter((x) => x === 'ready?').length).toBe(2);
  });
});
