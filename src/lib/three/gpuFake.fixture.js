// A stand-in for a WebGLRenderer and its context, as far as lib/three's
// GPU work (gpuWork.js, frameGuard.js) touches them, for tests in Node.
//
// fakeGl({ signalAfter, fences }) → a context whose fences signal after
//   `signalAfter` polls (no fenceSync at all with fences: false)
// fakeRenderer({ gl, linkAfter }) → compile() gives each material a program
//   that's ready after `linkAfter` asks; initTexture() marks a picture sent;
//   render(scene, camera) draws every visible mesh through
//   renderBufferDirect, as three.js does; `compiled`, `uploads` and `draws`
//   record what happened. A material changed since its program was made
//   (marked changed, and with another program key or map: a look put on, a
//   map taken off) is given a new one, mid-draw if it's drawn first, as
//   three.js does; one freed (dispose()) loses its program, as three's does

export function fakeGl({ signalAfter = 2, fences = true } = {}) {
  const gl = {
    SYNC_GPU_COMMANDS_COMPLETE: 0x9117,
    SYNC_STATUS: 0x9114,
    SIGNALED: 0x9119,
    UNSIGNALED: 0x9118,
    lost: false,
    syncs: 0,
    deleted: 0,
    polls: 0,
    isContextLost: () => gl.lost,
    flush() {},
  };
  if (fences) {
    gl.fenceSync = () => {
      gl.syncs += 1;
      return { polls: 0 };
    };
    gl.getSyncParameter = (sync) => {
      gl.polls += 1;
      sync.polls += 1;
      return sync.polls >= signalAfter ? gl.SIGNALED : gl.UNSIGNALED;
    };
    gl.deleteSync = () => {
      gl.deleted += 1;
    };
  }
  return gl;
}

// (what three's program cache key would see change)
const keyOf = (m) => `${m.customProgramCacheKey()}|${m.map ? 'map' : ''}`;

export function fakeRenderer({ gl = fakeGl(), linkAfter = 0 } = {}) {
  const props = new WeakMap();
  const get = (o) => {
    if (!props.has(o)) props.set(o, {});
    return props.get(o);
  };
  // (a program for `m` as it is now, unless the one it has still is)
  const stale = (m, p) => !p.currentProgram || (p.version !== m.version && p.key !== keyOf(m));
  // (freed, it's forgotten: made again from nothing the next time it's drawn)
  const watched = new WeakSet();
  const watch = (m) => {
    if (watched.has(m) || !m.addEventListener) return;
    watched.add(m);
    m.addEventListener('dispose', () => props.delete(m));
  };
  const r = {
    gl,
    compiled: [],
    compiledInto: [],
    target: null,
    uploads: [],
    draws: [],
    info: { programs: [] },
    getContext: () => gl,
    properties: { get },
    size: { x: 100, y: 100 },
    getDrawingBufferSize(v) {
      v.x = r.size.x;
      v.y = r.size.y;
      return v;
    },
    getRenderTarget: () => r.target,
    setRenderTarget(t) {
      r.target = t;
    },
    compile(root) {
      r.compiledInto.push(r.target);
      const mats = new Set();
      root.traverse((o) => {
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (!m) continue;
          mats.add(m);
          const p = get(m);
          if (!stale(m, p)) continue;
          let left = linkAfter;
          p.currentProgram = { isReady: () => left-- <= 0 };
          watch(m);
          p.version = m.version;
          p.key = keyOf(m);
          r.info.programs.push(p.currentProgram);
          r.compiled.push(m);
        }
      });
      return mats;
    },
    initTexture(t) {
      const p = get(t);
      p.__webglInit = true;
      p.__version = t.version;
      r.uploads.push(t);
    },
    renderBufferDirect(camera, scene, geometry, material) {
      // (a draw with no program yet makes one, as three.js does, mid-frame)
      const p = get(material);
      if (scene !== null && stale(material, p)) {
        p.currentProgram = { isReady: () => true };
        watch(material);
        r.info.programs.push(p.currentProgram);
        r.compiled.push(material);
      }
      p.version = material.version;
      p.key = keyOf(material);
      r.draws.push(material);
    },
    render(scene, camera) {
      scene.traverseVisible?.((o) => {
        if (!o.isMesh) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) r.renderBufferDirect(camera, scene, o.geometry, m, o, null);
      });
    },
    // the shadow pass: the same draws with no scene (three's depth materials aside)
    shadow(scene, camera) {
      scene.traverseVisible((o) => {
        if (o.isMesh) r.renderBufferDirect(camera, null, o.geometry, o.material, o, null);
      });
    },
    setScissor() {},
    setScissorTest() {},
  };
  return r;
}

// a frame that comes at once (tests don't wait for the screen)
export const now = () => Promise.resolve();
