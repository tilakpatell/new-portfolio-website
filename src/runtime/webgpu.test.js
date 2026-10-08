import { beforeEach, describe, expect, it, vi } from 'vitest';

// WebGPURenderer needs a browser; a stand-in records what it was made with
const made = [];
vi.mock('three/webgpu', () => ({
  WebGPURenderer: class {
    constructor(options) {
      this.options = options;
      this.backend = { device: { lost: new Promise(() => {}) } };
      this.init = vi.fn(async () => {});
      this.setPixelRatio = vi.fn();
      this.setSize = vi.fn();
      this.dispose = vi.fn();
      this.getPixelRatio = vi.fn(() => 1);
      this.setClearColor = vi.fn();
      made.push(this);
    }
  },
}));
vi.mock('../lib/settle', () => ({ settle: (p) => p }));

const { createWebGPU } = await import('./webgpu');

const fakeCanvas = () => ({ addEventListener: vi.fn(), removeEventListener: vi.fn() });

describe('createWebGPU', () => {
  beforeEach(() => {
    made.length = 0;
  });

  it('forceWebGL makes the nodes-webgl kind on a WebGL 2 context', async () => {
    const gfx = await createWebGPU(fakeCanvas(), { forceWebGL: true });
    expect(gfx.backend).toBe('nodes-webgl');
    expect(made[0].options.forceWebGL).toBe(true);
  });

  it('without it the kind is webgpu', async () => {
    const canvas = fakeCanvas();
    const gfx = await createWebGPU(canvas);
    expect(gfx.backend).toBe('webgpu');
    expect(made[0].options.forceWebGL).toBe(false);
    expect(canvas.addEventListener).not.toHaveBeenCalled(); // (the device says when it's lost)
  });

  it('a WebGL 2 context lost is reported through onLost, and the listener goes with the gfx', async () => {
    const onLost = vi.fn();
    const canvas = fakeCanvas();
    const gfx = await createWebGPU(canvas, { forceWebGL: true, onLost });
    const [, handler] = canvas.addEventListener.mock.calls.find((c) => c[0] === 'webglcontextlost');
    const preventDefault = vi.fn();
    handler({ preventDefault });
    expect(onLost).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalled();
    expect(gfx.lost).toBe(true);
    gfx.dispose();
    expect(canvas.removeEventListener).toHaveBeenCalledWith('webglcontextlost', handler);
  });
});
