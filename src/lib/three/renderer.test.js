import { describe, expect, it } from 'vitest';
import { precompile } from './renderer';

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
});
