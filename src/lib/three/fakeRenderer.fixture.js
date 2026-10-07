// A stand-in WebGLRenderer and instant frames for the GPU-work tests
// (gpuWork, frameGuard), so neither needs a browser.

// A frame that comes at once, counting how many were asked for.
export const frames = () => {
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
export const fakeRenderer = ({ signalAfter = 2, webgl2 = true, readyAfter = 0, lostAfterPolls = Infinity } = {}) => {
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
    log: [],
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
      const signalled = sync.polls >= signalAfter;
      gl.log.push(signalled ? 'signal' : 'wait');
      return signalled ? gl.SIGNALED : gl.UNSIGNALED;
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
          get(m).currentProgram = {
            isReady: () => {
              gl.log.push('ready?');
              return left-- <= 0;
            },
          };
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
