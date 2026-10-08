import { describe, expect, it, vi } from 'vitest';

const calls = [];
vi.mock('./three/gpuWork', () => ({
  nextFrame: () => Promise.resolve(),
  prepareScene: vi.fn(async (o) => {
    calls.push(o);
    o.onProgress?.(0.5, 'shaders');
    if (o.fail) throw new Error('no');
  }),
}));

const { stagePrepare } = await import('./stagePrepare');
const { prepareScene } = await import('./three/gpuWork');

const fakeStage = () => {
  const targets = [];
  return {
    targets,
    lost: false,
    disposed: false,
    scene: { children: [{ visible: true, id: 'shown' }, { visible: false, id: 'hidden' }] },
    camera: {},
    composer: { readBuffer: 'buffer' },
    renderer: { setRenderTarget: (t) => targets.push(t) },
    precompile: vi.fn(() => Promise.resolve()),
    render: vi.fn(),
  };
};

// a frame that lays the world out (the world's render calling held()) every time it's waited on
const framesWith = (p) => () => {
  p.held();
  return Promise.resolve();
};

describe('stagePrepare', () => {
  it('holds frames only while preparing, and lets them go after', async () => {
    const stage = fakeStage();
    let p;
    const frame = () => {
      expect(p.held()).toBe(true);
      return Promise.resolve();
    };
    p = stagePrepare(stage, { frame });
    expect(p.held()).toBe(false);
    expect(p.preparing).toBe(false);
    const steps = [];
    await p.prepare((f, step) => steps.push([f, step]));
    expect(p.preparing).toBe(false);
    expect(p.held()).toBe(false);
    expect(steps.at(-1)).toEqual([1, 'first draw']);
    // prepared what's shown, into the passes' buffer, then back to the canvas
    const last = calls.at(-1);
    expect(last.roots.map((o) => o.id)).toEqual(['shown']);
    expect(stage.targets).toEqual(['buffer', null]);
    last.render();
    expect(stage.render).toHaveBeenCalledWith(0);
  });

  it('draws straight to the canvas for a soft stage', async () => {
    const stage = fakeStage();
    let p;
    p = stagePrepare(stage, { soft: true, frame: () => framesWith(p)() });
    await p.prepare();
    expect(stage.targets).toContain(null);
    expect(stage.targets).not.toContain('buffer');
  });

  it('waits for a bake under way, not one that has not started or is done', async () => {
    const stage = fakeStage();
    const baking = { stats: { started: true, baked: false }, bake: vi.fn(() => Promise.resolve(true)) };
    const idle = { stats: { started: false, baked: false }, bake: vi.fn() };
    const done = { stats: { started: true, baked: true }, bake: vi.fn() };
    let p;
    p = stagePrepare(stage, { grounds: () => [baking, idle, done, null], frame: () => framesWith(p)() });
    await p.prepare();
    expect(baking.bake).toHaveBeenCalledTimes(1);
    expect(idle.bake).not.toHaveBeenCalled();
    expect(done.bake).not.toHaveBeenCalled();
  });

  it('holds a floor back from baking until the late loads are in, then lets it start', async () => {
    const stage = fakeStage();
    const order = [];
    let land;
    const late = new Promise((r) => (land = r)).then(() => order.push('landed'));
    const floor = {
      stats: { started: false, baked: false },
      update() {
        if (!this.stats.started) {
          order.push('bake');
          this.stats.started = true;
        }
      },
      bake: vi.fn(() => Promise.resolve(true)),
    };
    let p;
    let frames = 0;
    p = stagePrepare(stage, {
      grounds: () => [floor],
      late: () => [late],
      frame: () => {
        floor.update(); // (the world's frame: its floor's update, then held)
        p.held();
        if (++frames === 1) setTimeout(land, 5);
        return Promise.resolve();
      },
    });
    await p.prepare();
    expect(order).toEqual(['landed', 'bake']);
    expect(floor.bake).toHaveBeenCalledTimes(1);
    // put back as it was
    expect(Object.hasOwn(floor, 'update')).toBe(true);
    floor.stats.started = false;
    floor.update();
    expect(order.at(-1)).toBe('bake');
  });

  it('waits on its late loads and while busy, both bounded', async () => {
    const stage = fakeStage();
    let busy = 3;
    let landed = false;
    const late = new Promise((r) => setTimeout(() => r((landed = true)), 5));
    let p;
    p = stagePrepare(stage, { busy: () => busy-- > 0, late: () => [late, null], frame: () => framesWith(p)() });
    await p.prepare();
    expect(busy).toBeLessThan(0);
    expect(landed).toBe(true);
    // a load that never comes, and a world never laid out: still over, after `wait`
    const q = stagePrepare(stage, { late: () => [new Promise(() => {})], wait: 20, frame: () => new Promise((r) => setTimeout(r, 2)) });
    await q.prepare();
    expect(q.preparing).toBe(false);
  });

  it('waits for no frame when the world runs none while it prepares', async () => {
    const stage = fakeStage();
    let frames = 0;
    const p = stagePrepare(stage, {
      layout: false,
      frame: () => {
        frames += 1;
        return Promise.resolve();
      },
    });
    const before = prepareScene.mock.calls.length;
    await p.prepare();
    expect(frames).toBe(0);
    expect(prepareScene.mock.calls.length).toBe(before + 1);
  });

  it('stops when the world is left, and never throws', async () => {
    const stage = fakeStage();
    const before = prepareScene.mock.calls.length;
    let alive = true;
    let p;
    p = stagePrepare(stage, {
      frame: () => {
        p.held();
        alive = false;
        return Promise.resolve();
      },
    });
    await p.prepare(null, () => alive);
    expect(prepareScene.mock.calls.length).toBe(before);
    expect(p.preparing).toBe(false);
    // left: frames are drawn again even before the prepare has noticed
    let q;
    let left = false;
    q = stagePrepare(stage, {
      frame: () => {
        left = true;
        expect(q.held()).toBe(false);
        return Promise.resolve();
      },
      wait: 5,
    });
    await q.prepare(null, () => !left);
    // a prepareScene that throws, a progress callback that throws, a roots() that throws
    prepareScene.mockImplementationOnce(async () => {
      throw new Error('gone');
    });
    let r;
    r = stagePrepare(stage, { roots: () => [stage.scene], frame: () => framesWith(r)() });
    await expect(
      r.prepare(() => {
        throw new Error('bar');
      }),
    ).resolves.toBeUndefined();
    expect(stage.targets.at(-1)).toBe(null);
  });
});
