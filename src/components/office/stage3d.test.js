import { beforeEach, describe, expect, it, vi } from 'vitest';

// the renderer needs a browser; a stand-in records what's asked of it, in
// order, beside the scene's own sizing and drawing
const log = [];
vi.mock('three', async (orig) => {
  const THREE = await orig();
  class WebGLRenderer {
    shadowMap = { enabled: false };
    info = { render: { calls: 0, triangles: 0 }, memory: { geometries: 0, textures: 0 } };
    setPixelRatio(pr) {
      log.push(['setPixelRatio', pr]);
    }
    setSize(w, h) {
      log.push(['setSize', w, h]);
    }
    setDrawingBufferSize(w, h, pr) {
      log.push(['canvas', w, h, pr]);
    }
    render() {
      log.push(['render']);
    }
    dispose() {}
  }
  return { ...THREE, WebGLRenderer };
});
vi.mock('../../lib/device', async (orig) => ({ ...(await orig()), pixelRatio: () => 2 }));
vi.mock('../../lib/three/frameGuard', () => ({ guard: () => ({}) }));
vi.mock('../../lib/three/renderer', () => ({ quiet: (r) => r, precompile: () => Promise.resolve() }));
vi.mock('../../lib/three/gpuWork', () => ({
  prepareScene: async ({ render }) => {
    log.push(['prepare']);
    render();
  },
}));

const { createStage } = await import('./stage3d');
const canvas = { addEventListener() {}, removeEventListener() {} };

describe('the office stage’s size', () => {
  beforeEach(() => {
    log.length = 0;
  });

  it('notes a new size when asked and makes it at the next frame drawn, the canvas once', () => {
    const stage = createStage(canvas);
    log.length = 0;
    stage.resize(800.4, 600);
    expect(log).toEqual([]);
    expect(stage.size).toEqual({ w: 800, h: 600 });
    expect(stage.camera.aspect).toBeCloseTo(800 / 600);
    stage.render();
    expect(log).toEqual([['canvas', 800, 600, 2], ['render']]);
    stage.render();
    expect(log).toEqual([['canvas', 800, 600, 2], ['render'], ['render']]);
  });

  it('sizes a scene’s own passes in the frame that makes the canvas, before they draw', () => {
    const stage = createStage(canvas);
    stage.onResize = (w, h, pr) => log.push(['passes', w, h, pr]);
    stage.draw = () => log.push(['draw']);
    log.length = 0;
    stage.resize(640, 480);
    stage.resize(1280, 720);
    expect(log).toEqual([]);
    stage.render();
    expect(log).toEqual([['canvas', 1280, 720, 2], ['passes', 1280, 720, 2], ['draw']]);
  });

  it('makes a quality step’s resolution at the next frame drawn, not after the slow one that asked for it', () => {
    const stage = createStage(canvas);
    stage.resize(800, 600);
    stage.render();
    log.length = 0;
    for (let i = 0; i < 60; i++) stage.render(60);
    expect(stage.info().dpr).toBe(1);
    const at = log.findIndex((e) => e[0] === 'canvas');
    expect(log[at]).toEqual(['canvas', 800, 600, 1]);
    expect(log[at + 1]).toEqual(['render']);
    expect(log.filter((e) => e[0] === 'canvas')).toHaveLength(1);
  });

  it('makes the size before the loading screen’s draws, while nothing’s been drawn', async () => {
    const stage = createStage(canvas);
    stage.resize(800, 600);
    log.length = 0;
    await stage.prepare();
    expect(log).toEqual([['canvas', 800, 600, 2], ['prepare'], ['render']]);
  });
});
