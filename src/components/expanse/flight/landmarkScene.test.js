import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createLandmark } from './landmarkScene';

const list = [
  { kind: 'echobase', at: [1200, -800], y: 12, yaw: 0, scale: 1, abs: true, solid: false },
  { kind: 'hothgenerator', at: [1230, -790], y: 12, yaw: 1, scale: 1, abs: true, solid: false },
  { kind: 'kit', model: 'kit:space/MetalSupport', at: [1190, -760], y: 12, yaw: 0, scale: 3, abs: true, solid: false },
];

// a placer that gives each kind a mesh of its own geometry, or fails the ones asked to
function fakePlacer(fail = new Set()) {
  const put = vi.fn((spec) => {
    if (fail.has(spec.kind)) return Promise.resolve(null);
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    m.position.set(spec.at[0], spec.y, spec.at[1]);
    return Promise.resolve(m);
  });
  const placer = { put, update: vi.fn(), dispose: vi.fn() };
  return { placer, make: vi.fn((group) => ((placer.group = group), placer)) };
}

afterEach(() => vi.restoreAllMocks());

describe('createLandmark', () => {
  it('puts every placement once, under its own group, relative to the origin', async () => {
    const scene = new THREE.Scene();
    const { placer, make } = fakePlacer();
    const lm = createLandmark(scene, { list, placer: make, origin: [1000, 0, -1000] });
    await lm.ready;
    expect(placer.put).toHaveBeenCalledTimes(list.length);
    expect(placer.put.mock.calls.map((c) => c[0])).toEqual(list);
    expect(make.mock.calls[0][0]).toBe(lm.group);
    expect(lm.group.parent).toBe(scene);
    expect(lm.group.position.toArray()).toEqual([-1000, 0, 1000]);
    expect(lm.stats()).toEqual({ placed: 3, standIns: 0 });
  });

  it('stands a block where a model won’t come, and says so once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const scene = new THREE.Scene();
    const { make, placer } = fakePlacer(new Set(['echobase', 'kit']));
    placer.put.mockImplementationOnce(() => Promise.reject(new Error('gone')));
    const lm = createLandmark(scene, { list, placer: make, origin: [0, 0, 0] });
    await lm.ready;
    expect(lm.stats()).toEqual({ placed: 1, standIns: 2 });
    const blocks = [];
    lm.group.traverse((o) => o.name === 'landmark-stand-in' && blocks.push(o));
    expect(blocks).toHaveLength(2);
    // (stood where the placement is: its foot on its height)
    expect(blocks[0].position.x).toBe(1200);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('frees what it made and nothing a live landmark still draws', async () => {
    const scene = new THREE.Scene();
    const shared = new THREE.BoxGeometry(1, 1, 1);
    const spy = vi.spyOn(shared, 'dispose');
    const placer = { put: vi.fn(() => Promise.resolve(new THREE.Mesh(shared, new THREE.MeshBasicMaterial()))), update() {}, dispose: vi.fn() };
    const a = createLandmark(scene, { list, placer: () => placer, origin: [0, 0, 0] });
    const b = createLandmark(scene, { list, placer: () => placer, origin: [0, 0, 0] });
    await Promise.all([a.ready, b.ready]);
    a.dispose();
    expect(placer.dispose).toHaveBeenCalledTimes(1);
    expect(a.group.parent).toBe(null);
    expect(spy).not.toHaveBeenCalled();
    b.dispose();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('frees its stand-ins, and a model that comes after it’s gone', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const scene = new THREE.Scene();
    const late = [];
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const spy = vi.spyOn(geometry, 'dispose');
    const placer = {
      put: vi.fn((s) => (s.kind === 'kit' ? Promise.resolve(null) : new Promise((r) => late.push(() => r(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial())))))),
      update() {},
      dispose() {},
    };
    const lm = createLandmark(scene, { list, placer: () => placer, origin: [0, 0, 0] });
    await new Promise((r) => setTimeout(r, 0));
    const standIn = [];
    lm.group.traverse((o) => o.name === 'landmark-stand-in' && standIn.push(o));
    const blockSpy = vi.spyOn(standIn[0].geometry, 'dispose');
    lm.dispose();
    expect(blockSpy).toHaveBeenCalled();
    for (const f of late) f();
    await lm.ready;
    expect(spy).toHaveBeenCalled();
  });

  it('moves with the origin', () => {
    const scene = new THREE.Scene();
    const { make } = fakePlacer();
    const lm = createLandmark(scene, { list, placer: make, origin: [0, 0, 0] });
    lm.reanchor([2048, 10, -4096]);
    expect(lm.group.position.toArray()).toEqual([-2048, -10, 4096]);
  });
});
