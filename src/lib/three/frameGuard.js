// A guard on a renderer so no frame waits on a shader or a picture. three.js
// compiles a material's shader, and sends its pictures, the first time it's
// drawn, and the frame that does it can take a quarter of a second. Here a
// draw whose material has never been compiled, or holds a picture never sent,
// is skipped that frame instead, and the material is readied after the frame,
// a few milliseconds and a few megabytes at a time, with a fence after each
// batch so its shader's link is only asked about once the chip has caught up.
// From then on it draws every frame and is never checked again (unless it's
// swapped for another material).
//
// Shadow-map draws (scene null) pass through: their depth shaders are small
// and shared. So does everything drawn by a render of something that isn't a
// Scene (a post-processing quad): holding one back would black out the frame.

import { batchRoot, fence, nextFrame, textureBytes, uploaded } from './gpuWork';
import { uploadTexture } from './renderer';

const guards = new WeakMap();

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// Every picture a material holds: its own texture properties, and a shader
// material's texture uniforms (one at a time, or a list of them).
function texturesOf(material) {
  const found = [];
  const add = (v) => {
    if (v?.isTexture) found.push(v);
    else if (Array.isArray(v)) for (const t of v) if (t?.isTexture) found.push(t);
  };
  for (const v of Object.values(material)) add(v);
  if (material.uniforms) for (const u of Object.values(material.uniforms)) add(u?.value);
  return found;
}

// The Scene an object hangs under, or null once it's been taken out of one.
function sceneOf(object) {
  let o = object;
  while (o?.parent) o = o.parent;
  return o?.isScene ? o : null;
}

// `tries`: how many pumps a material gets before it's let draw anyway (a
// picture three never sends early, a shader that never says it has linked),
// so nothing stays hidden for good.
export function guard(renderer, { uploadMB = 8, compileMs = 4, adopt = null, tries = 5, frame = nextFrame } = {}) {
  if (guards.has(renderer)) return guards.get(renderer);

  const draw = renderer.renderBufferDirect;
  const render = renderer.render;
  const hooks = new Set(adopt ? [adopt] : []);
  const ready = new WeakSet(); // drawn freely from now on
  const started = new WeakSet(); // adopted and compiled once already
  // material → { object, scene, camera } of the first draw of it skipped
  const queue = new Map();
  const inFlight = new Map(); // compiled, waiting on its fence
  const pumped = new WeakMap(); // material → how many pumps it has had
  let inScene = false; // drawing for a render of a Scene (not a quad's)
  let depth = 0; // renders inside renders
  let lastScene = null;
  let lastCamera = null;
  let scheduled = false;
  let fencing = false;
  let disposed = false;

  const picturesUp = (material) => texturesOf(material).every((t) => uploaded(renderer, t));

  const knownReady = (material) => {
    if (ready.has(material)) return true;
    if (queue.has(material) || inFlight.has(material)) return false;
    let program = null;
    try {
      program = renderer.properties.get(material).currentProgram;
    } catch {
      return true; // a renderer that can't say draws as it would have
    }
    if (program && picturesUp(material)) {
      ready.add(material);
      return true;
    }
    return false;
  };

  function guardedDraw(camera, scene, geometry, material, object, group) {
    if (!handle.enabled || scene === null || !inScene || !material || knownReady(material)) {
      return draw.call(this, camera, scene, geometry, material, object, group);
    }
    if (!inFlight.has(material) && !queue.has(material)) queue.set(material, { object, scene, camera });
  }

  function guardedRender(scene, camera) {
    const isScene = !!scene?.isScene;
    if (isScene) {
      lastScene = scene;
      lastCamera = camera;
    }
    // (only the outermost render is timed, so nothing is logged twice)
    const programs = import.meta.env.DEV && depth === 0 ? renderer.info?.programs : null;
    const before = programs ? programs.length : 0;
    const t0 = programs ? now() : 0;
    const was = inScene;
    inScene = isScene;
    depth += 1;
    try {
      return render.call(this, scene, camera);
    } finally {
      inScene = was;
      depth -= 1;
      if (programs && programs.length > before) {
        console.warn(`[frameGuard] ${programs.length - before} shader(s) compiled mid-frame (${(now() - t0).toFixed(1)}ms)`);
      }
      if (isScene && queue.size && !scheduled && !fencing && !disposed) {
        scheduled = true;
        queueMicrotask(pump);
      }
    }
  }

  // One batch: as many queued materials as fit in `compileMs` (at least
  // one), each adopted and compiled once and given the pictures this frame's
  // `uploadMB` allows, smallest first; then a fence, and only after it
  // signals is each shader asked whether it has linked.
  async function pump() {
    scheduled = false;
    if (fencing || disposed || !queue.size) return;
    const t0 = now();
    const budget = uploadMB * 1024 * 1024;
    let bytes = 0;
    let sentAny = false;
    for (const [material, entry] of queue) {
      if (inFlight.size && now() - t0 > compileMs) break;
      queue.delete(material);
      const { object } = entry;
      // (taken out of its world since: if it comes back, its draw queues it again)
      if (!sceneOf(object)) continue;
      const count = (pumped.get(material) ?? 0) + 1;
      pumped.set(material, count);
      if (count > tries) {
        ready.add(material);
        continue;
      }
      const todo = texturesOf(material)
        .filter((t) => !uploaded(renderer, t))
        .map((t) => [t, textureBytes(t)])
        .sort((a, b) => a[1] - b[1]);
      for (const [t, size] of todo) {
        if (sentAny && bytes + size > budget) break;
        uploadTexture(renderer, t);
        bytes += size;
        sentAny = true;
      }
      if (!started.has(material)) {
        started.add(material);
        for (const hook of hooks) {
          try {
            hook(object);
          } catch {
            // a look that can't be put on draws without it
          }
        }
        try {
          // (against the scene and camera it was drawn for, as its real draw will be)
          renderer.compile(batchRoot([object]), entry.camera ?? lastCamera, entry.scene ?? lastScene);
        } catch {
          // three reports a broken shader on its draw, as it always has
          ready.add(material);
          continue;
        }
      }
      inFlight.set(material, entry);
    }
    if (!inFlight.size) return;
    fencing = true;
    const caughtUp = await fence(renderer, { frame });
    fencing = false;
    for (const [material, entry] of inFlight) {
      inFlight.delete(material);
      if (disposed) continue;
      if (caughtUp) {
        try {
          const program = renderer.properties.get(material).currentProgram;
          // (no program after its compile: three makes it on the draw)
          if ((!program || program.isReady()) && picturesUp(material)) {
            ready.add(material);
            continue;
          }
        } catch {
          ready.add(material);
          continue;
        }
      }
      // not linked, pictures still to send, or the chip not caught up: next frame
      queue.set(material, entry);
    }
  }

  const handle = {
    enabled: true,
    // Runs `fn(object)` on each queued object before its compile (a world's
    // house look, so the shader compiled is the one it will draw with).
    // Returns a function that takes it off again.
    adopt(fn) {
      hooks.add(fn);
      return () => hooks.delete(fn);
    },
    pending: () => queue.size + inFlight.size,
    dispose() {
      if (disposed) return;
      disposed = true;
      renderer.renderBufferDirect = draw;
      renderer.render = render;
      queue.clear();
      guards.delete(renderer);
    },
  };
  renderer.renderBufferDirect = guardedDraw;
  renderer.render = guardedRender;
  guards.set(renderer, handle);
  return handle;
}
