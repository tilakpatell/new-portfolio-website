import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { batchRoot, compileSlices, drawables, fence, prepareScene, textureBytes, uploadSlices, uploaded } from './gpuWork';

// A frame that comes at once, counting how many were asked for.
const frames = () => {
  const f = () => {
    f.count += 1;
    return Promise.resolve();
  };
  f.count = 0;
  return f;
};

// A stand-in for a WebGLRenderer, as far as gpuWork touches one: a fence
// signals after `signalAfter` polls, compile records what each stand-in root
// walks, and a program is ready after `readyAfter` asks.
const fakeRenderer = ({ signalAfter = 2, webgl2 = true, readyAfter = 0, lostAfterPolls = Infinity } = {}) => {
  const props = new WeakMap();
  const get = (o) => {
    if (!props.has(o)) props.set(o, {});
    return props.get(o);
  };
  let polls = 0;
  const gl = {
    SYNC_GPU_COMMANDS_COMPLETE: 0x9117,
    SYNC_STATUS: 0x9114,
    SIGNALED: 0x9119,
    UNSIGNALED: 0x9118,
    fences: 0,
    deleted: 0,
    flushes: 0,
    lost: false,
    flush() {
      gl.flushes += 1;
    },
    isContextLost: () => gl.lost,
  };
  if (webgl2) {
    gl.fenceSync = () => {
      gl.fences += 1;
      return { polls: 0 };
    };
    gl.getSyncParameter = (sync) => {
      polls += 1;
      if (polls >= lostAfterPolls) gl.lost = true;
      sync.polls += 1;
      return sync.polls >= signalAfter ? gl.SIGNALED : gl.UNSIGNALED;
    };
    gl.deleteSync = () => {
      gl.deleted += 1;
    };
  }
  const renderer = {
    gl,
    batches: [],
    compiled: [],
    uploads: [],
    getContext: () => gl,
    properties: { get },
    initTexture(t) {
      renderer.uploads.push(t);
      get(t).__webglInit = true;
    },
    compile(root, camera, scene) {
      const batch = [];
      const materials = new Set();
      root.traverse((o) => {
        batch.push(o);
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          materials.add(m);
          renderer.compiled.push(m);
          let left = readyAfter;
          get(m).currentProgram = { isReady: () => left-- <= 0 };
        }
      });
      renderer.batches.push({ batch, camera, scene, fencesBefore: gl.fences });
      return materials;
    },
    scissor: { x: 0, y: 0, z: 10, w: 10 },
    scissorTest: false,
    getScissor(target) {
      return target.copy(renderer.scissor);
    },
    setScissor(x, y, w, h) {
      renderer.scissor = { x, y, z: w, w: h };
    },
    getScissorTest: () => renderer.scissorTest,
    setScissorTest(on) {
      renderer.scissorTest = on;
    },
  };
  return renderer;
};

const picture = (w, h, extra = {}) => Object.assign(new THREE.Texture({ width: w, height: h }), { version: 1 }, extra);

describe('fence', () => {
  it('resolves only once the graphics chip has signalled, and deletes the sync', async () => {
    const r = fakeRenderer({ signalAfter: 3 });
    const frame = frames();
    await fence(r, { frame });
    expect(frame.count).toBe(3);
    expect(r.gl.flushes).toBe(1);
    expect(r.gl.deleted).toBe(1);
  });

  it('waits two frames without WebGL2', async () => {
    const r = fakeRenderer({ webgl2: false });
    const frame = frames();
    await fence(r, { frame });
    expect(frame.count).toBe(2);
  });

  it('resolves when the context is lost', async () => {
    const r = fakeRenderer({ signalAfter: Infinity, lostAfterPolls: 2 });
    const frame = frames();
    await fence(r, { frame });
    expect(frame.count).toBeLessThanOrEqual(3);
  });

  it('resolves when the renderer throws, and after its cap', async () => {
    const broken = { getContext: () => ({ fenceSync: () => { throw new Error('gone'); }, isContextLost: () => false }) };
    await expect(fence(broken, { frame: frames() })).resolves.toBeUndefined();
    const never = fakeRenderer({ signalAfter: Infinity });
    const slow = () => new Promise((r) => setTimeout(r, 5));
    await expect(fence(never, { frame: slow, cap: 20 })).resolves.toBeUndefined();
  });
});

describe('uploaded', () => {
  const r = fakeRenderer();
  it('counts what has nothing to send as sent', () => {
    expect(uploaded(r, picture(4, 4, { isVideoTexture: true }))).toBe(true);
    expect(uploaded(r, picture(4, 4, { isRenderTargetTexture: true }))).toBe(true);
    expect(uploaded(r, picture(4, 4, { version: 0 }))).toBe(true);
    expect(uploaded(r, new THREE.Texture())).toBe(true);
  });
  it('knows a picture already on the graphics chip, and one that is not', () => {
    const t = picture(4, 4);
    expect(uploaded(r, t)).toBe(false);
    r.initTexture(t);
    expect(uploaded(r, t)).toBe(true);
  });
});

describe('textureBytes', () => {
  it('is width × height × depth × 4, or the compressed mips', () => {
    expect(textureBytes(picture(16, 8))).toBe(512);
    expect(textureBytes(picture(4, 4, { image: { width: 4, height: 4, depth: 3 } }))).toBe(192);
    const c = Object.assign(new THREE.CompressedTexture([{ data: new Uint8Array(100) }, { data: new Uint8Array(25) }], 8, 8), { version: 1 });
    expect(textureBytes(c)).toBe(125);
  });
});

describe('uploadSlices', () => {
  it('sends smallest first, fences after every slice, and skips what is up', async () => {
    const r = fakeRenderer();
    const big = picture(1024, 1024); // 4MB
    const ts = [big, picture(1024, 1024), picture(1024, 1024), picture(512, 512)];
    const done = picture(64, 64);
    r.initTexture(done);
    r.uploads.length = 0;
    const steps = [];
    const sent = await uploadSlices(r, [...ts, done, picture(8, 8, { isVideoTexture: true })], {
      sliceMB: 4,
      frame: frames(),
      onStep: (i, n) => steps.push([i, n, r.gl.fences]),
    });
    expect(sent).toBe(4);
    expect(r.uploads[0]).toBe(ts[3]);
    expect(r.uploads).not.toContain(done);
    // 1MB, then 4MB (slice reached: fence), 4MB (fence), 4MB (fence)
    expect(r.gl.fences).toBe(3);
    expect(steps.map((s) => s[0])).toEqual([1, 2, 3, 4]);
    expect(steps.every((s) => s[1] === 4)).toBe(true);
  });

  it('stops when the context is lost', async () => {
    const r = fakeRenderer();
    r.gl.lost = true;
    expect(await uploadSlices(r, [picture(8, 8), picture(8, 8)], { frame: frames() })).toBe(0);
  });
});

describe('drawables', () => {
  it('keeps one object per kind of draw, hidden ones too', () => {
    const shared = new THREE.MeshStandardMaterial();
    const other = new THREE.MeshBasicMaterial();
    const geo = new THREE.BoxGeometry();
    const root = new THREE.Group();
    const a = new THREE.Mesh(geo, shared);
    const b = new THREE.Mesh(geo, shared);
    b.visible = false;
    const c = new THREE.Mesh(geo, other);
    const skinned = new THREE.SkinnedMesh(geo, shared);
    const coloured = new THREE.BufferGeometry();
    coloured.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
    coloured.setAttribute('color', new THREE.Float32BufferAttribute([1, 1, 1], 3));
    const d = new THREE.Mesh(coloured, shared);
    const hiddenGroup = new THREE.Group();
    hiddenGroup.visible = false;
    const e = new THREE.Points(geo, new THREE.PointsMaterial());
    hiddenGroup.add(e);
    root.add(a, b, c, skinned, d, hiddenGroup, new THREE.Mesh(geo, null));
    const found = drawables([root]);
    expect(found).toContain(a);
    expect(found).not.toContain(b);
    expect(found).toEqual(expect.arrayContaining([c, skinned, d, e]));
    expect(found.length).toBe(5);
  });
});

describe('batchRoot', () => {
  it('walks just its list and has no lights to show', () => {
    const seen = [];
    const root = batchRoot([1, 2]);
    root.traverse((o) => seen.push(o));
    root.traverseVisible(() => seen.push('light'));
    expect(seen).toEqual([1, 2]);
  });
});

describe('compileSlices', () => {
  const world = (n) => {
    const root = new THREE.Group();
    for (let i = 0; i < n; i++) root.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
    return root;
  };

  it('compiles every material once, a fence after each batch, then waits for the links', async () => {
    const r = fakeRenderer({ readyAfter: 3 });
    const root = world(12);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const steps = [];
    const frame = frames();
    const mats = await compileSlices(r, [root], camera, scene, { frame, onStep: (i, n) => steps.push([i, n]) });
    expect(mats.size).toBe(12);
    expect(r.compiled.length).toBe(12);
    expect(new Set(r.compiled).size).toBe(12);
    expect(r.batches.length).toBeGreaterThan(1);
    // each batch after the last one's fence, and one more fence after the last
    r.batches.forEach((b, i) => expect(b.fencesBefore).toBe(i));
    expect(r.gl.fences).toBe(r.batches.length);
    expect(r.batches.every((b) => b.scene === scene && b.camera === camera)).toBe(true);
    expect(steps.at(-1)).toEqual([12, 12]);
    // every program was asked until it was ready
    for (const m of mats) expect(r.properties.get(m).currentProgram.isReady()).toBe(true);
  });

  it('resolves when the context goes or compile throws', async () => {
    const r = fakeRenderer({ readyAfter: Infinity, lostAfterPolls: 1 });
    await expect(compileSlices(r, [world(3)], {}, {}, { frame: frames() })).resolves.toBeInstanceOf(Set);
    const t = fakeRenderer();
    t.compile = () => {
      throw new Error('disposed');
    };
    await expect(compileSlices(t, [world(3)], {}, {}, { frame: frames() })).resolves.toBeInstanceOf(Set);
  });
});

describe('prepareScene', () => {
  const setup = () => {
    const r = fakeRenderer({ readyAfter: 1 });
    const root = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const m = new THREE.MeshBasicMaterial({ map: picture(256, 256) });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(), m);
      mesh.visible = i % 2 === 0;
      root.add(mesh);
    }
    return { r, root };
  };

  it('reports rising progress through each step, ending at 1', async () => {
    const { r, root } = setup();
    const seen = [];
    let drawn = null;
    await prepareScene({
      renderer: r,
      roots: [root],
      scene: root,
      camera: {},
      frame: frames(),
      render: () => {
        drawn = { scissor: r.scissorTest, all: root.children.every((c) => c.visible) };
      },
      onProgress: (f, step) => seen.push([f, step]),
    });
    const fs = seen.map((s) => s[0]);
    expect(fs.every((f, i) => i === 0 || f >= fs[i - 1])).toBe(true);
    expect(fs.at(-1)).toBe(1);
    expect(new Set(seen.map((s) => s[1]))).toEqual(new Set(['pictures', 'shaders', 'first draw']));
    expect(r.uploads.length).toBe(4);
    expect(drawn).toEqual({ scissor: true, all: true });
    expect(r.scissorTest).toBe(false);
    expect(root.children.map((c) => c.visible)).toEqual([true, false, true, false]);
  });

  it('stops at the next slice when the world is left', async () => {
    const { r, root } = setup();
    const seen = [];
    let alive = true;
    let rendered = false;
    await prepareScene({
      renderer: r,
      roots: [root],
      scene: root,
      camera: {},
      frame: frames(),
      render: () => {
        rendered = true;
      },
      alive: () => alive,
      onProgress: (f) => {
        seen.push(f);
        if (f > 0) alive = false;
      },
    });
    expect(r.compiled.length).toBe(0);
    expect(rendered).toBe(false);
    expect(seen.at(-1)).toBeLessThan(1);
  });
});
